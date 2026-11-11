// Shared helpers for the case study builder API (not a route: files starting with _ aren't deployed as functions).
//
// Environment variables (Vercel > Settings > Environment Variables):
//   BUILDER_PASSWORD       password for /builder
//   GITHUB_TOKEN           fine-grained token with Contents: read and write on the site repo
//   GITHUB_REPO            owner/name, defaults to radcatdesign/ihc
//   GITHUB_BRANCH          defaults to main
//   BLOB_READ_WRITE_TOKEN  added automatically when a Blob store is connected to the project
//   BUILDER_LOCAL_ROOT     local development only: read and write files in this folder instead of GitHub

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO = process.env.GITHUB_REPO || 'radcatdesign/ihc';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const LOCAL = process.env.BUILDER_LOCAL_ROOT || '';

const SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
const WRITABLE = [
  new RegExp(`^content/case-studies/${SLUG}\\.json$`),
  new RegExp(`^case-study/${SLUG}\\.html$`),
  new RegExp(`^case-studies-items/${SLUG}\\.html$`),
  /^content\/index\.json$/,
  new RegExp(`^content/templates/${SLUG}\\.json$`),
  /^content\/templates\/index\.json$/,
  /^content\/home-images\.json$/,
  /^work\.html$/,
  /^cms\/cs\.html$/,
  /^sitemap\.xml$/,
];
const READABLE = WRITABLE.concat([/^builder\/case-study\.template$/]);

function allowed(list, p) {
  return typeof p === 'string' && !p.includes('..') && list.some((rx) => rx.test(p));
}

function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}

function checkPassword(given) {
  const want = process.env.BUILDER_PASSWORD;
  if (!want) return { ok: false, status: 503, error: 'BUILDER_PASSWORD is not set in Vercel yet.' };
  if (!given || !safeEqual(given, want)) return { ok: false, status: 401, error: 'Wrong password.' };
  return { ok: true };
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

// Returns true when the request carries the right password, otherwise answers it.
async function guard(req, res) {
  const r = checkPassword(req.headers['x-builder-key']);
  if (r.ok) return true;
  if (r.status === 401) await new Promise((ok) => setTimeout(ok, 700));
  send(res, r.status, { error: r.error });
  return false;
}

async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const s = Buffer.concat(chunks).toString('utf8');
  return s ? JSON.parse(s) : {};
}

function gitSha(text) {
  const buf = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

// ---------- GitHub ----------
async function gh(method, url, body) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw Object.assign(new Error('GITHUB_TOKEN is not set in Vercel yet.'), { status: 503 });
  const r = await fetch(url.startsWith('http') ? url : `https://api.github.com${url}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'ihc-case-study-builder',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(`GitHub ${method} ${url.split('?')[0]}: ${r.status} ${data.message || ''}`.trim());
    e.status = r.status === 401 || r.status === 403 ? 502 : r.status;
    e.github = r.status;
    throw e;
  }
  return data;
}

function gql(query, variables) {
  return gh('POST', '/graphql', { query, variables }).then((d) => {
    if (d.errors) throw new Error('GitHub: ' + d.errors.map((e) => e.message).join('; '));
    return d.data;
  });
}

// Read text files at the branch head. Returns { head, files: { path: { text, sha } | null } }
async function readFiles(paths) {
  if (LOCAL) {
    const files = {};
    for (const p of paths) {
      const f = path.join(LOCAL, p);
      files[p] = fs.existsSync(f) ? { text: fs.readFileSync(f, 'utf8'), sha: gitSha(fs.readFileSync(f, 'utf8')) } : null;
    }
    return { head: 'local', files };
  }
  const [owner, name] = REPO.split('/');
  const fields = paths.map((p, i) => `f${i}: object(expression: $e${i}) { ... on Blob { oid text isBinary isTruncated } }`).join('\n');
  const vars = paths.map((_, i) => `$e${i}: String!`).join(', ');
  const q = `query($owner: String!, $name: String!, $ref: String!${vars ? ', ' + vars : ''}) {
    repository(owner: $owner, name: $name) {
      ref(qualifiedName: $ref) { target { oid } }
      ${fields}
    }
  }`;
  const v = { owner, name, ref: `refs/heads/${BRANCH}` };
  paths.forEach((p, i) => { v['e' + i] = `${BRANCH}:${p}`; });
  const d = await gql(q, v);
  const files = {};
  for (let i = 0; i < paths.length; i++) {
    const o = d.repository['f' + i];
    if (!o || o.isBinary) { files[paths[i]] = null; continue; }
    if (o.isTruncated || o.text == null) {
      // GraphQL cuts off large files; the blob API returns the whole thing
      const b = await gh('GET', `/repos/${owner}/${name}/git/blobs/${o.oid}`);
      files[paths[i]] = { text: Buffer.from(b.content, 'base64').toString('utf8'), sha: o.oid };
    } else {
      files[paths[i]] = { text: o.text, sha: o.oid };
    }
  }
  return { head: d.repository.ref.target.oid, files };
}

// Current blob shas for paths (null when missing), plus head commit and its tree.
async function currentShas(paths) {
  const [owner, name] = REPO.split('/');
  const fields = paths.map((p, i) => `f${i}: object(expression: $e${i}) { oid }`).join('\n');
  const vars = paths.map((_, i) => `$e${i}: String!`).join(', ');
  const q = `query($owner: String!, $name: String!, $ref: String!${vars ? ', ' + vars : ''}) {
    repository(owner: $owner, name: $name) {
      ref(qualifiedName: $ref) { target { oid ... on Commit { tree { oid } } } }
      ${fields}
    }
  }`;
  const v = { owner, name, ref: `refs/heads/${BRANCH}` };
  paths.forEach((p, i) => { v['e' + i] = `${BRANCH}:${p}`; });
  const d = await gql(q, v);
  const shas = {};
  paths.forEach((p, i) => { shas[p] = d.repository['f' + i] ? d.repository['f' + i].oid : null; });
  return { head: d.repository.ref.target.oid, tree: d.repository.ref.target.tree.oid, shas };
}

// Write files in one commit. files: [{ path, content }] (content null deletes).
// expect: { path: sha | null } checked against the branch head first.
async function commitFiles(files, expect, message) {
  if (LOCAL) {
    const conflicts = Object.entries(expect || {}).filter(([p, sha]) => {
      const f = path.join(LOCAL, p);
      const now = fs.existsSync(f) ? gitSha(fs.readFileSync(f, 'utf8')) : null;
      return now !== sha;
    }).map(([p]) => p);
    if (conflicts.length) return { conflicts };
    for (const f of files) {
      const full = path.join(LOCAL, f.path);
      if (f.content == null) { if (fs.existsSync(full)) fs.unlinkSync(full); continue; }
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, f.content);
    }
    return { commit: 'local', url: null };
  }
  const [owner, name] = REPO.split('/');
  for (let attempt = 0; attempt < 3; attempt++) {
    const check = Object.keys(expect || {});
    const cur = await currentShas(check);
    const conflicts = check.filter((p) => cur.shas[p] !== expect[p]);
    if (conflicts.length) return { conflicts };
    const tree = await gh('POST', `/repos/${owner}/${name}/git/trees`, {
      base_tree: cur.tree,
      tree: files.map((f) => (f.content == null
        ? { path: f.path, mode: '100644', type: 'blob', sha: null }
        : { path: f.path, mode: '100644', type: 'blob', content: f.content })),
    });
    const commit = await gh('POST', `/repos/${owner}/${name}/git/commits`, {
      message,
      tree: tree.sha,
      parents: [cur.head],
    });
    try {
      await gh('PATCH', `/repos/${owner}/${name}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
      return { commit: commit.sha, url: `https://github.com/${owner}/${name}/commit/${commit.sha}` };
    } catch (e) {
      if (e.github !== 422) throw e; // someone pushed in between: try again from the new head
    }
  }
  throw Object.assign(new Error('The branch kept moving while publishing. Try again.'), { status: 409 });
}

module.exports = { WRITABLE, READABLE, allowed, checkPassword, guard, send, readBody, readFiles, commitFiles, gitSha, REPO, BRANCH, LOCAL };
