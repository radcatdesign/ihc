// POST /api/builder/upload
// The builder compresses photos in the browser, then sends them to Vercel Blob one of two ways:
//
// 1. Through this function (default). Works with Vercel's standard Blob connection,
//    which sets BLOB_STORE_ID and signs in with the deployment's own identity (OIDC).
//    Request: raw file body, ?name=case-studies/<slug>/<file>, headers x-builder-key and x-content-type.
//    Vercel caps function requests at 4.5 MB, which every compressed photo fits under.
//
// 2. Straight from the browser, for big files like video loops. Needs BLOB_READ_WRITE_TOKEN
//    (the store's read-write token). This route then only hands out short-lived upload tokens.
//
// The Blob store must be a public store: these files are photos for the public site.
const { put } = require('@vercel/blob');
const { handleUpload } = require('@vercel/blob/client');
const { checkPassword, guard, send, readBody } = require('./_lib');

// Files come in as application/octet-stream, which Vercel hands over as a Buffer in req.body.

const TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif', 'image/svg+xml', 'video/mp4', 'video/webm'];
const NAME = /^case-studies\/[a-z0-9-]+\/[\w.-]+$/;
const MAX_DIRECT = 4.4 * 1024 * 1024;

function storeError(e) {
  const m = String(e && e.message || e);
  if (/private/i.test(m)) return 'The connected Blob store is private. Connect a public store instead (Vercel > Storage).';
  if (/credentials|token|oidc/i.test(m)) return 'The Blob store isn’t connected to this deployment. Connect it in Vercel > Storage, then redeploy.';
  return m;
}

async function rawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'binary');
  const chunks = [];
  let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > MAX_DIRECT) throw Object.assign(new Error('That file is over 4 MB.'), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const url = new URL(req.url, 'http://x');
  const name = url.searchParams.get('name');

  if (name) {
    if (!(await guard(req, res))) return;
    if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return send(res, 503, { error: 'No Blob store is connected to this Vercel project yet.' });
    const type = String(req.headers['x-content-type'] || '');
    if (!NAME.test(name)) return send(res, 400, { error: 'Bad file name.' });
    if (!TYPES.includes(type)) return send(res, 400, { error: 'That file type isn’t allowed.' });
    try {
      const body = await rawBody(req);
      if (!body.length) return send(res, 400, { error: 'Empty file.' });
      const blob = await put(name, body, { access: 'public', addRandomSuffix: true, contentType: type });
      return send(res, 200, { url: blob.url });
    } catch (e) {
      return send(res, e.status || 500, { error: storeError(e) });
    }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) return send(res, 503, { error: 'Big uploads need BLOB_READ_WRITE_TOKEN set in Vercel.' });
  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: 'Bad JSON' }); }
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let key = '';
        try { key = JSON.parse(clientPayload || '{}').key; } catch (e) { /* ignore */ }
        const r = checkPassword(key);
        if (!r.ok) throw new Error(r.error);
        if (!NAME.test(pathname)) throw new Error('Bad file name.');
        return { allowedContentTypes: TYPES, maximumSizeInBytes: 250 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    send(res, 200, json);
  } catch (e) {
    send(res, 400, { error: storeError(e) });
  }
};
