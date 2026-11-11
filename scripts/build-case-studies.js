#!/usr/bin/env node
/*
 * Rebuild every case study page from its block data.
 *
 *   node scripts/build-case-studies.js            all case studies
 *   node scripts/build-case-studies.js prey abigail   just these
 *
 * Run it after changing builder/case-study.template, builder/render.js or the
 * piece styles in builder/src/. It also re-hashes builder/src/cs-blocks.{css,js}
 * into css/ and js/ so browsers pick up the new versions.
 * The builder at /builder does the same rendering in the browser when you publish.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const R = require(path.join(ROOT, 'builder', 'render.js'));
const TPL = path.join(ROOT, 'builder', 'case-study.template');

function hashAsset(src, dir, ext, base = 'cs-blocks') {
  const body = fs.readFileSync(path.join(ROOT, 'builder', 'src', src), 'utf8');
  const h = crypto.createHash('sha1').update(body).digest('hex').slice(0, 10);
  const name = `${base}.${h}.${ext}`;
  const old = new RegExp(`^${base}\\.[0-9a-f]{10}\\.`);
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (old.test(f) && f !== name) fs.unlinkSync(path.join(ROOT, dir, f));
  }
  fs.writeFileSync(path.join(ROOT, dir, name), body);
  return name;
}

const cssName = hashAsset('cs-blocks.css', 'css', 'css');
const jsName = hashAsset('cs-blocks.js', 'js', 'js');

// The page wipe script runs on every page that has the wipe, so point them all at the new copy.
const wipeName = hashAsset('wipe.js', 'js', 'js', 'wipe');
(function updateWipe(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (!['node_modules', '.git', 'case-study', 'builder', 'api', 'scripts'].includes(f.name)) updateWipe(p); continue; }
    if (!f.name.endsWith('.html')) continue;
    const t = fs.readFileSync(p, 'utf8');
    const next = t.replace(/\/js\/wipe\.[0-9a-f]{10}\.js/g, '/js/' + wipeName);
    if (next !== t) fs.writeFileSync(p, next);
  }
})(ROOT);
let tpl = fs.readFileSync(TPL, 'utf8')
  .replace(/\/css\/cs-blocks\.[0-9a-f]{10}\.css/, '/css/' + cssName)
  .replace(/\/js\/cs-blocks\.[0-9a-f]{10}\.js/, '/js/' + jsName)
  .replace(/\/js\/wipe\.[0-9a-f]{10}\.js/, '/js/' + wipeName);
fs.writeFileSync(TPL, tpl);

const only = process.argv.slice(2);
const dir = path.join(ROOT, 'content', 'case-studies');
const all = [];
let n = 0;
for (const f of fs.readdirSync(dir).sort((a, b) => (a.slice(0, -5) < b.slice(0, -5) ? -1 : 1))) {
  if (!f.endsWith('.json')) continue;
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  all.push(d);
  if (only.length && !only.includes(d.slug)) continue;
  fs.writeFileSync(path.join(ROOT, 'case-study', d.slug + '.html'), R.page(tpl, d));
  n++;
}

// content/index.json: the builder's list of case studies, services, awards and homepage categories.
const services = new Map();
const awards = new Map();
const categories = new Set();
for (const d of all) {
  for (const s of d.services || []) if (!services.has(s.slug)) services.set(s.slug, s.name);
  for (const a of d.awards || []) if (!awards.has(a.slug)) awards.set(a.slug, a.name);
  const home = d.listing && d.listing.home;
  if (home && home.category) categories.add(home.category);
}
const index = {
  caseStudies: all.map((d) => R.indexEntry(d)),
  services: [...services].map(([slug, name]) => ({ name, slug })).sort((a, b) => a.name.localeCompare(b.name)),
  awards: [...awards].map(([slug, name]) => ({ name, slug })).sort((a, b) => a.name.localeCompare(b.name)),
  categories: [...categories].sort(),
};
fs.writeFileSync(path.join(ROOT, 'content', 'index.json'), JSON.stringify(index, null, 1) + '\n');

console.log(`Rebuilt ${n} case stud${n === 1 ? 'y' : 'ies'} (${cssName}, ${jsName}), index of ${all.length}`);
