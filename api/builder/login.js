// POST /api/builder/login  { password }  ->  200 { ok: true } | 401
const { checkPassword, send, readBody } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  let body = {};
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: 'Bad JSON' }); }
  const r = checkPassword(body.password);
  if (!r.ok) {
    if (r.status === 401) await new Promise((ok) => setTimeout(ok, 700));
    return send(res, r.status, { error: r.error });
  }
  const missing = ['GITHUB_TOKEN', 'BLOB_READ_WRITE_TOKEN'].filter((k) => !process.env[k] && !process.env.BUILDER_LOCAL_ROOT);
  send(res, 200, { ok: true, missing, local: !!process.env.BUILDER_LOCAL_ROOT });
};
