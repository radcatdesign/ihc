// GET /api/builder/files?path=a&path=b  ->  { head, files: { path: { text, sha } | null } }
// Reads the latest version straight from the repo, so the builder never edits a stale copy.
const { guard, send, readFiles, allowed, READABLE } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  if (!(await guard(req, res))) return;
  const url = new URL(req.url, 'http://x');
  const paths = url.searchParams.getAll('path');
  if (!paths.length || paths.length > 12) return send(res, 400, { error: 'Ask for 1 to 12 files.' });
  const bad = paths.filter((p) => !allowed(READABLE, p));
  if (bad.length) return send(res, 400, { error: 'Not readable: ' + bad.join(', ') });
  try {
    send(res, 200, await readFiles(paths));
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};
