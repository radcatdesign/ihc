#!/usr/bin/env node
/*
 * Make small copies (800px WebP, "-t800.webp" next to the original) of the photos each
 * homepage bubble fades through, so the homepage doesn't pull full-size photos.
 * Needs sharp:  npm i --no-save sharp && node scripts/bubble-thumbs.js
 * Then run  npm run case-studies  to write content/home-images.json with the new copies.
 * Photos uploaded through the builder live in Blob storage and are already compressed,
 * so they're used as they are.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const R = require(path.join(ROOT, 'builder', 'render.js'));
let sharp;
try { sharp = require('sharp'); } catch (e) { console.error('This needs sharp: npm i --no-save sharp'); process.exit(1); }

const thumbOf = (src) => src.replace(/(-p-\d+)?\.(avif|webp|jpe?g|png)$/i, '') + '-t800.webp';
const original = (src) => src.replace(/-p-\d+(\.\w+)$/, '$1');

(async () => {
  const dir = path.join(ROOT, 'content', 'case-studies');
  let made = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const l = d.listing || {};
    if (!(l.listed && l.home && l.home.showHomepage)) continue;
    // ask for the originals so each thumb is made from the best copy
    for (const url of R.bubbleImages(d, (m) => m.src)) {
      if (!url.startsWith('/images/')) continue;
      const out = path.join(ROOT, thumbOf(url));
      if (fs.existsSync(out)) continue;
      // the original, or else the biggest resized copy that came over from Webflow
      const base = original(url).replace(/\.\w+$/, '');
      const ext = path.extname(original(url));
      const src = [original(url)].concat([2000, 1600, 1080, 800].map((w) => `${base}-p-${w}${ext}`))
        .map((p) => path.join(ROOT, p)).find((p) => fs.existsSync(p));
      if (!src) continue;
      await sharp(src).rotate().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 72 }).toFile(out);
      made++;
    }
  }
  console.log(`Made ${made} bubble photo${made === 1 ? '' : 's'}.`);
})();
