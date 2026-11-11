# IHEARTCOMIX

The iheartcomix.com website: plain static HTML, CSS and JS, a few small serverless functions for the email forms and the case study builder. Hosted on Vercel.

## What's in here

| Path | What it is |
| --- | --- |
| `index.html`, `work.html`, `about.html`, `news-press.html`, `gotg.html`, `404.html` | Top level pages |
| `case-study/` | Case study pages (`/case-study/<slug>`), built from `content/case-studies/` |
| `case-studies-items/` | Older links from the Work grid. They forward to `/case-study/<slug>` and hold each page's hand-picked Related Work list |
| `content/case-studies/` | Each case study as building blocks (JSON). The builder edits these |
| `builder/` | The drag and drop case study builder at `/builder`, plus the page template and renderer |
| `news/` | News detail pages (`/news/<slug>`) |
| `cms/`, `internal/styleguide.html` | Internal utility pages carried over from the old site |
| `css/`, `js/` | Styles and scripts. File names carry a content hash for caching |
| `images/`, `media/`, `fonts/`, `data/` | Images, video, the Founders Grotesk webfont, Lottie JSON |
| `api/subscribe.js` | Receives sign-ups from the Join popup and footer Subscribe forms |
| `api/builder/` | Login, file reads, publishing and uploads for the builder |
| `scripts/build-case-studies.js` | Rebuilds every case study page from its blocks (`npm run case-studies`) |
| `vercel.json` | Clean URLs (`/work` serves `work.html`) and long cache headers on assets |
| `sitemap.xml`, `robots.txt` | SEO basics |

URLs match the old site one to one, so existing links and search results keep working.

## Deploying on Vercel

1. In the IHEARTCOMIX Vercel team, **Add New > Project** and import `radcatdesign/ihc`.
2. Framework preset: **Other**. Leave Build Command and Output Directory empty.
3. Add the environment variable `SUBSCRIBE_WEBHOOK_URL` (see Forms below), plus the builder's variables (see Case study builder below).
4. Deploy, check the preview URL, then add `www.iheartcomix.com` (and the bare domain redirecting to it) under **Settings > Domains** and update DNS as Vercel instructs.

Every push to `main` redeploys production. Branches get preview URLs.

## Forms

Both sign-up forms post to `/api/subscribe`, which forwards the email as JSON to whatever URL is in `SUBSCRIBE_WEBHOOK_URL`. A Zapier or Make webhook is the quickest option and can push to Klaviyo, Mailchimp, a Google Sheet or Slack. Until that variable is set, the forms show their error message instead of quietly dropping sign-ups.

## Case study builder

Go to `/builder` on the site. It lists every case study. Open one, or start a new one (blank or as a copy of an existing page), and snap it together from pieces:

- **Section:** the colored accordion panels on the page. Drag the dots to reorder them.
- **Inside a section:** Text, Two columns, Gallery, Wide gallery, Video, and the newer Big image (photo or looping MP4), Two-up, Stats and Quote.
- **Intro photos:** the slider next to the intro text, only in the Intro.

Drag a piece from the left onto the page, or click it to drop it into the selected section. Photos dropped in are resized and compressed to WebP in the browser, then stored in Vercel Blob. Videos inside galleries are Vimeo links. The live preview on the right is the real page template. Work in progress is saved in the browser until you publish, and Undo/Redo covers everything.

**Page settings** holds the page title and description for Google and link previews, whether the page shows on the Work page (with its summary and hover photo) and whether it gets a homepage bubble (category, bubble photo, hover clip, award badge).

**Publish** commits the page, its block data, and any changes to `work.html`, `cms/cs.html`, `sitemap.xml` and `content/index.json` to `main` in one commit. Vercel redeploys and the builder tells you when it's live, usually within a minute or two. If someone else published the same case study after you opened it, it stops and asks you to reload first.

### Setup (once)

In the Vercel project, **Settings > Environment Variables** (Production):

| Variable | Value |
| --- | --- |
| `BUILDER_PASSWORD` | The password for `/builder`. Share it with whoever edits case studies |
| `GITHUB_TOKEN` | A GitHub fine-grained token: Repository access **Only select repositories > radcatdesign/ihc**, Permissions **Contents: Read and write** |
| `BLOB_STORE_ID` | Added for you when a **public** Blob store is connected to the project (**Storage** tab). A private store won't work: the photos are for the public site |
| `BLOB_READ_WRITE_TOKEN` | Optional. Only needed to upload files over 4 MB (video loops) straight from the browser. Copy it from the Blob store's `.env.local` tab |

Optional: `GITHUB_REPO` (default `radcatdesign/ihc`) and `GITHUB_BRANCH` (default `main`). Redeploy after adding variables.

### Changing the template or piece styles

Case study pages are rendered from `builder/case-study.template` by `builder/render.js`. Styles for the newer pieces live in `builder/src/cs-blocks.css` and a small helper script in `builder/src/cs-blocks.js`. After changing any of these, run `npm run case-studies` to rebuild every page (and re-hash the CSS/JS), then commit. Hand edits to `case-study/*.html` get replaced the next time that page is published, so make content changes in the builder or the JSON.

## Editing content

Case studies are edited in the builder (above). Everything else is plain HTML.

- **New images:** drop them in `images/` and reference them as `/images/<file>`. Export web sizes (2000px wide max, WebP or AVIF) and keep files under a few hundred KB.
- **CSS or JS changes:** CSS and JS are minified. If you edit a hashed file like `css/ihc.<hash>.css`, rename it with a new hash (or any new suffix) and update the references, otherwise returning visitors keep the cached copy for up to a year.

## Previewing locally

```
npx serve .
```

`serve` handles the clean URLs. Use `npx vercel dev` if you also want the forms function running locally.

## Notes

- Responsive image variants wider than 2000px were left out to keep the deployment under Vercel's 1 GB static file limit. Pages already fall back to the 2000px versions.
- Homepage bubbles use 800px WebP thumbnails (`*-t800.webp`), and the hover previews are animated WebP instead of GIF. Both are referenced from `cms/cs.html`, which the homepage reads for its project list.
- Hover backgrounds on the Work list, homepage previews and the reel video only load when they're on screen (see the small `ihc*` helpers at the top of each page's `<head>`).
- Videos live in `media/`. Re-encode new ones with FFmpeg before adding them: VP9 WebM at CRF 42 plus H.265 MP4 at CRF 30, sized to about twice their on-screen width, audio removed for muted backgrounds.
- The mobile intro animation still loads from IHC's CloudFront bucket (`d1e09wm0wupq53.cloudfront.net/ihc/ihc-mob-intro`).
- `news-press---test*.html` are test pages that were live on the old site. They're not in the sitemap and can be deleted any time.
- New case studies use the default Related Work list at the bottom of the page. The hand-picked lists for older pages live in `case-studies-items/<slug>.html`.
- The builder's drag and drop is SortableJS and its upload client is `@vercel/blob`, both vendored in `builder/vendor/` with their licenses.
