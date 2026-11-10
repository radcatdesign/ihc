# IHEARTCOMIX

The iheartcomix.com website: plain static HTML, CSS and JS with one small serverless function for the email forms. Hosted on Vercel.

## What's in here

| Path | What it is |
| --- | --- |
| `index.html`, `work.html`, `about.html`, `news-press.html`, `gotg.html`, `404.html` | Top level pages |
| `case-study/` | Case study pages (`/case-study/<slug>`) |
| `case-studies-items/` | Case study detail pages linked from the Work grid (`/case-studies-items/<slug>`) |
| `news/` | News detail pages (`/news/<slug>`) |
| `cms/`, `internal/styleguide.html` | Internal utility pages carried over from the old site |
| `css/`, `js/` | Styles and scripts. File names carry a content hash for caching |
| `images/`, `media/`, `fonts/`, `data/` | Images, video, the Founders Grotesk webfont, Lottie JSON |
| `api/subscribe.js` | Receives sign-ups from the Join popup and footer Subscribe forms |
| `vercel.json` | Clean URLs (`/work` serves `work.html`) and long cache headers on assets |
| `sitemap.xml`, `robots.txt` | SEO basics |

URLs match the old site one to one, so existing links and search results keep working.

## Deploying on Vercel

1. In the IHEARTCOMIX Vercel team, **Add New > Project** and import `radcatdesign/ihc`.
2. Framework preset: **Other**. Leave Build Command and Output Directory empty.
3. Add the environment variable `SUBSCRIBE_WEBHOOK_URL` (see Forms below).
4. Deploy, check the preview URL, then add `www.iheartcomix.com` (and the bare domain redirecting to it) under **Settings > Domains** and update DNS as Vercel instructs.

Every push to `main` redeploys production. Branches get preview URLs.

## Forms

Both sign-up forms post to `/api/subscribe`, which forwards the email as JSON to whatever URL is in `SUBSCRIBE_WEBHOOK_URL`. A Zapier or Make webhook is the quickest option and can push to Klaviyo, Mailchimp, a Google Sheet or Slack. Until that variable is set, the forms show their error message instead of quietly dropping sign-ups.

## Editing content

There's no CMS anymore, so content changes are HTML edits.

- **New case study:** duplicate a file in `case-studies-items/`, swap the copy and images, add a card for it in `work.html`, and add its URL to `sitemap.xml`.
- **New images:** drop them in `images/` and reference them as `/images/<file>`. Export web sizes (2000px wide max) and keep files under a few hundred KB where you can.
- **CSS or JS changes:** if you edit a hashed file like `css/ihc.203c8a3824.css`, rename it with a new hash (or any new suffix) and update the references, otherwise returning visitors keep the cached copy for up to a year.

## Previewing locally

```
npx serve .
```

`serve` handles the clean URLs. Use `npx vercel dev` if you also want the forms function running locally.

## Notes

- Responsive image variants wider than 2000px were left out to keep the deployment under Vercel's 1 GB static file limit. Pages already fall back to the 2000px versions.
- A few videos (the bunny loop and reel backgrounds) load from IHC's own CloudFront bucket at `d1e09wm0wupq53.cloudfront.net/ihc/`. They were never on the old host, so they're unchanged.
- `news-press---test*.html` are test pages that were live on the old site. They're not in the sitemap and can be deleted any time.
