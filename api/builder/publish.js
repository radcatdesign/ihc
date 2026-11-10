// POST /api/builder/publish
//   { message, files: [{ path, content }], expect: { path: sha | null } }
// Commits the files to the site repo in one commit. Vercel then redeploys.
// 409 { conflicts: [paths] } when one of the files changed since the builder read it.
const { guard, send, readBody, commitFiles, allowed, WRITABLE } = require('./_lib');

const MAX = 3.5 * 1024 * 1024;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!(await guard(req, res))) return;
  let body;
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: 'Bad JSON' }); }
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length || files.length > 12) return send(res, 400, { error: 'Send 1 to 12 files.' });
  const bad = files.filter((f) => !f || !allowed(WRITABLE, f.path) || (f.content != null && typeof f.content !== 'string'));
  if (bad.length) return send(res, 400, { error: 'Not writable: ' + bad.map((f) => f && f.path).join(', ') });
  if (files.reduce((n, f) => n + (f.content ? f.content.length : 0), 0) > MAX) return send(res, 413, { error: 'Too much at once.' });
  for (const f of files) {
    if (f.path.endsWith('.json') && f.content != null) {
      try { JSON.parse(f.content); } catch (e) { return send(res, 400, { error: 'Invalid JSON in ' + f.path }); }
    }
  }
  const expect = body.expect && typeof body.expect === 'object' ? body.expect : {};
  const message = String(body.message || 'Update case study').slice(0, 200) + '\n\nPublished from the case study builder.';
  try {
    const r = await commitFiles(files, expect, message);
    if (r.conflicts) return send(res, 409, { error: 'Changed since you opened it.', conflicts: r.conflicts });
    send(res, 200, r);
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};
