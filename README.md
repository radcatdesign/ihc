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

## Versions and branches

- **`main` is the live site.** Vercel deploys it to production, which is what the client sees and uses (including the builder at `/builder`). Releases are tagged: `v1.0.0` is the first. The builder shows its version next to its name.
- **`next` is the next version** (social media tools first). Every push to it gets a Vercel preview deployment, private to the Vercel team. A preview's builder publishes to its own branch, never to `main`, and shows a yellow "Test build" flag so it's never mistaken for the live one.
- **Fixes for the live site** go on `main` (tag `v1.0.1` and so on), then get merged into `next`.
- **Content keeps flowing on `main`**: case studies the client publishes land there. Merge `main` into `next` now and then so the preview has current content.
- **Releasing**: merge `next` into `main` and tag `v2.0.0`.
- For the preview's builder to sign in and save, `BUILDER_PASSWORD`, `GITHUB_TOKEN` and the Blob variables need **Preview** ticked in Vercel's Environment Variables (they're per environment). To be extra safe, also add `GITHUB_BRANCH` = `next` for Preview.

## Deploying on Vercel

1. In the IHEARTCOMIX Vercel team, **Add New > Project** and import `radcatdesign/ihc`.
2. Framework preset: **Other**. Leave Build Command and Output Directory empty.
3. Add the environment variable `SUBSCRIBE_WEBHOOK_URL` (see Forms below), plus the builder's variables (see Case study builder below).
4. Deploy, check the preview URL, then add `www.iheartcomix.com` (and the bare domain redirecting to it) under **Settings > Domains** and update DNS as Vercel instructs.

Every push to `main` redeploys production. Branches get preview URLs.

## Forms

Both sign-up forms post to `/api/subscribe`, which forwards the email as JSON to whatever URL is in `SUBSCRIBE_WEBHOOK_URL`. A Zapier or Make webhook is the quickest option and can push to Klaviyo, Mailchimp, a Google Sheet or Slack. Until that variable is set, the forms show their error message instead of quietly dropping sign-ups.

## Case study builder

Go to `/builder` on the site. It lists every case study. Open one, or start a new one (blank or as a copy of an existing page), and build it from blocks:

- **Section:** the colored accordion panels on the page. Drag the dots to reorder them. The palette button in a section's header sets its color (Auto follows the page's usual color order).
- **Words:** Text, Two columns, Photo + text, Quote, Marquee (giant scrolling words), Steps.
- **Photos and video:** Gallery, Wide gallery, Big image (photo or loop), Two-up, Photo grid (three, four or mosaic), Social row (vertical clips), Before + after (drag slider), Video (an uploaded video or a Vimeo link).
- **Results and credits:** Stats, Logos, Credits.
- **Intro photos:** the slider next to the intro text, only in the Intro.

Hover a block in the left column to see a real render of it (on a phone, the Add sheet shows the same previews). The preview images live in `builder/previews/`. Drag a block onto the page, or click it to add it to the selected section. The live preview on the right is the real page template. Work in progress is saved in the browser until you publish, and Undo/Redo covers everything.

**Photos** go through a crop step first (Original, Free, Square, 4:5, 3:2, 16:9, 9:16; bubble photos start square). Logos, GIFs and SVGs skip it. Then they're resized and compressed to WebP in the browser: if the result is still over about 1.6 MB, the quality and then the size step down until it fits, so a 15 MB camera photo lands well under 1 MB. A toast shows the saving ("14 MB → 676 KB, 95% smaller") and the slot keeps it on the photo. Everything is stored in Vercel Blob.

**Videos** (MP4, MOV or WebM) are converted to WebM (VP9, with Opus sound where it's kept) in the browser before they upload, with a progress readout and the saving shown at the end. Long side up to 1920 (1280 for the vertical hero), up to 30 fps. Loops drop the sound; videos in galleries and the Video block keep it. Conversion runs at roughly real time on a recent laptop in Chrome or Edge. Browsers that can't make WebM upload MP4 and WebM files as they are. The encoder is [mediabunny](https://mediabunny.dev) 1.65.2 (MPL-2.0), vendored in `builder/vendor/` and only loaded when a video is dropped in. Where videos go:

- Galleries: uploaded videos play in the slider with controls (Vimeo links still work).
- Video block: upload a file or paste a Vimeo link.
- Hero: a background video (muted loop) instead of a Vimeo link.
- Big image, Two-up, Photo grid, Social row: muted loops, as before.

**Hero bubbles** are the numbers floating over the hero (300+ Fans). Four rows to start; Add a bubble goes up to eight, and the × on a row removes it. With five or more, every bubble on the page runs a little smaller so they still fit, on phones too. Bubbles five to eight are pink, yellow, mint and white.

**Hero layout** is either Photo or video (the usual) or **Vertical videos**: up to three 9:16 cards (Reels, TikToks, Stories; photos work too) standing in the middle over a blurred copy of the middle one, with the big title running behind them and the client and services along the bottom. On phones they stack: cards, then the title, then client and services.

**Templates** are saved layouts (intro blocks and sections, with their colors and settings). In a case study, the Templates button saves the current layout as one, either just the layout or with the words and photos, or loads one in (replace the blocks or add its sections to the end; Undo puts things back). The Templates tab on the case study list lists them, opens them in the same editor to change, deletes them, and starts new case studies from them. They live in `content/templates/`.

**Awards** sit under Services in the hero card. They show as filled bubbles ahead of the service bubbles on the case study hero and the Work page, the Work page filter gets an Awards group, and `/work?awards=<slug>` links straight to a filtered list.

**Page settings** holds the page title and description for Google and link previews, whether the page shows on the Work page (with its summary and hover photo) and whether it gets a homepage bubble (category, bubble photo, hover clip, award badge).

**Publish** commits the page, its block data, and any changes to `work.html`, `cms/cs.html`, `sitemap.xml` and `content/index.json` to `main` in one commit. Vercel redeploys and the builder tells you when it's live, usually within a minute or two. If someone else published the same case study after you opened it, it stops and asks you to reload first.

### Social studio (version 2, on `next`)

The **Social** tab in the builder. Three parts:

- **Planner:** a month calendar of posts. Drag a post onto a day to schedule it, set a time, the platforms it's going out on and where it's at (Idea, Draft, Ready to post, Posted). Posts without a date wait in "Not scheduled yet". Save writes `content/social/posts.json`. It tracks posts; it doesn't post to Instagram or anywhere else.
- **Post maker:** New post, pick a case study and a shape (Story 9:16, Post 4:5, Square 1:1). It drafts slides from the case study: cover, the summary, photos, numbers in IHC bubbles (three to a slide), a pull quote if there is one, and a sign-off with the link. Every slide can be edited, reordered, recolored or given a different photo (from the case study, or uploaded). The Caption tab writes a caption from the case study in three takes and counts characters per platform. Export: one PNG per slide, or an MP4 of all the slides with the site's color wipe between them.
- **Motion studio:** clips to drop into a video edit: stat bubble, bubble burst, color wipe, title slam, lower third, logo pop. Any shape (plus Wide 16:9), any length. Background can be clear (a WebM with transparency), green screen (an MP4 to key out) or a brand color.

Everything is drawn on a canvas by `builder/social-engine.js` (slides, motion elements, PNG and video export); the screens are in `builder/social.js` and `builder/social.css`. Video export uses the same vendored mediabunny encoder as uploads and needs Chrome or Edge for MP4.

### Setup (once)

In the Vercel project, **Settings > Environment Variables** (Production):

| Variable | Value |
| --- | --- |
| `BUILDER_PASSWORD` | The password for `/builder`. Share it with whoever edits case studies |
| `GITHUB_TOKEN` | A GitHub fine-grained token: Repository access **Only select repositories > radcatdesign/ihc**, Permissions **Contents: Read and write** |
| `BLOB_STORE_ID` | Added for you when a **public** Blob store is connected to the project (**Storage** tab). A private store won't work: the photos are for the public site |
| `BLOB_READ_WRITE_TOKEN` | Needed for any upload that's still over 4 MB after compression (most hero and full-length videos), which goes straight from the browser to Blob. Copy it from the Blob store's `.env.local` tab |

Optional: `GITHUB_REPO` (default `radcatdesign/ihc`) and `GITHUB_BRANCH` (default `main`). Redeploy after adding variables.

### Changing the template or block styles

Case study pages are rendered from `builder/case-study.template` by `builder/render.js`. Styles for the newer blocks live in `builder/src/cs-blocks.css` and a small helper script in `builder/src/cs-blocks.js`. After changing any of these, run `npm run case-studies` to rebuild every page (and re-hash the CSS/JS), then commit. Hand edits to `case-study/*.html` get replaced the next time that page is published, so make content changes in the builder or the JSON.

## Editing content

Case studies are edited in the builder (above). Everything else is plain HTML.

- **New images:** drop them in `images/` and reference them as `/images/<file>`. Export web sizes (2000px wide max, WebP or AVIF) and keep files under a few hundred KB.
- **Homepage bubble photos:** each project bubble shows one featured photo, the bubble photo set in the builder's Page settings.
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
