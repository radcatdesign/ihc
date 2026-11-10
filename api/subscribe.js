// Receives email sign-ups from the site's Join and Subscribe forms.
//
// Set SUBSCRIBE_WEBHOOK_URL in the Vercel project (Settings > Environment Variables)
// to any endpoint that accepts a JSON POST: Zapier/Make webhook, Klaviyo, Mailchimp
// via an automation, a Google Sheet script, Slack incoming webhook, etc.
//
// Payload sent to the webhook:
//   { email, form, page, fields, submittedAt, userAgent }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const email = String(body.email || '').trim();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ ok: false, error: 'Invalid email' });
  }

  const hook = process.env.SUBSCRIBE_WEBHOOK_URL;
  if (!hook) {
    console.error('subscribe: SUBSCRIBE_WEBHOOK_URL is not set; dropped sign-up for', body.form);
    return res.status(503).json({ ok: false, error: 'Sign-ups are not configured' });
  }

  try {
    const r = await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        form: String(body.form || '').slice(0, 100),
        page: String(body.page || '').slice(0, 300),
        fields: body.fields && typeof body.fields === 'object' ? body.fields : {},
        submittedAt: new Date().toISOString(),
        userAgent: req.headers['user-agent'] || ''
      })
    });
    if (!r.ok) {
      console.error('subscribe: webhook responded', r.status);
      return res.status(502).json({ ok: false });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('subscribe: webhook error', err);
    return res.status(502).json({ ok: false });
  }
};
