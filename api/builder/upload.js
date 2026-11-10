// POST /api/builder/upload  (Vercel Blob client uploads)
// The builder compresses images in the browser, then uploads straight to Blob storage.
// This route only hands out short-lived upload tokens, after checking the password.
const { handleUpload } = require('@vercel/blob/client');
const { checkPassword, send, readBody } = require('./_lib');

const TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/gif', 'image/avif', 'image/svg+xml', 'video/mp4', 'video/webm'];

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return send(res, 503, { error: 'No Blob store is connected to this Vercel project yet.' });
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
        if (!/^case-studies\/[a-z0-9-]+\/[\w.-]+$/.test(pathname)) throw new Error('Bad file name.');
        return { allowedContentTypes: TYPES, maximumSizeInBytes: 250 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    send(res, 200, json);
  } catch (e) {
    send(res, 400, { error: e.message });
  }
};
