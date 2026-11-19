// Social studio: a planner, a post maker that drafts slides from a case study, and a motion
// studio for overlay clips. Drawing lives in social-engine.js; this file is the screens.
// builder.js hands over its helpers (h, api, toast and friends) as `kit` when it routes here.
import * as G from './social-engine.js';

let K = null;
const h = (...a) => K.h(...a);
const POSTS = 'content/social/posts.json';
// [key, name, short tag, caption limit (0 = no warning)]
const PLATFORMS = [['instagram', 'Instagram', 'IG', 2200], ['tiktok', 'TikTok', 'TT', 0], ['linkedin', 'LinkedIn', 'IN', 3000], ['x', 'X', 'X', 280], ['facebook', 'Facebook', 'FB', 0]];
const STATUS = [['idea', 'Idea'], ['draft', 'Draft'], ['ready', 'Ready to post'], ['posted', 'Posted']];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SO = { posts: null, sha: null, dirty: false, cs: new Map() };

export function socialRoute(app, kit) {
  K = kit;
  const hash = location.hash;
  if (hash === '#/social') { renderPlanner(app); return true; }
  if (hash === '#/social/motion') { renderMotion(app); return true; }
  const m = hash.match(/^#\/social\/post\/([a-z0-9]+)/);
  if (m) { renderPost(app, m[1]); return true; }
  return false;
}

/* ---------------- data ---------------- */
async function loadPosts() {
  if (!K.S.index) await K.loadIndex();
  if (SO.posts) return SO.posts;
  const r = await K.readFiles([POSTS]);
  const f = r.files[POSTS];
  SO.posts = f ? JSON.parse(f.text).posts || [] : [];
  SO.sha = f ? f.sha : null;
  const local = K.store.get('ihc-social-unsaved');
  if (local && Array.isArray(local.posts)) {
    SO.posts = local.posts; SO.dirty = true;
    K.toast('Picked up your unsaved social changes from this browser.');
  }
  return SO.posts;
}
function touch(post) {
  if (post) post.updated = Date.now();
  SO.dirty = true;
  K.store.set('ihc-social-unsaved', { posts: SO.posts });
  syncSave();
}
function syncSave() {
  K.$$('.so-save').forEach((b) => { b.disabled = !SO.dirty || b.dataset.busy === '1'; b.textContent = b.dataset.busy === '1' ? 'Saving…' : SO.dirty ? 'Save' : 'Saved'; });
}
async function savePosts() {
  K.$$('.so-save').forEach((b) => { b.dataset.busy = '1'; });
  syncSave();
  try {
    await K.api('publish', { method: 'POST', body: { message: 'Social planner: save', files: [{ path: POSTS, content: JSON.stringify({ posts: SO.posts }, null, 1) + '\n' }], expect: { [POSTS]: SO.sha } } });
    const r = await K.readFiles([POSTS]);
    SO.sha = r.files[POSTS] ? r.files[POSTS].sha : null;
    SO.dirty = false;
    K.store.del('ihc-social-unsaved');
    K.toast('Saved.');
  } catch (e) {
    K.toast(e.status === 409 ? 'Someone else saved the planner after you opened it. Reload to get theirs. Your changes stay in this browser.' : e.message, 'err', 8000);
  } finally {
    K.$$('.so-save').forEach((b) => { delete b.dataset.busy; });
    syncSave();
  }
}
const saveButton = () => { const b = h('button', { type: 'button', class: 'btn primary so-save', onclick: savePosts }, 'Save'); setTimeout(syncSave); return b; };

async function loadCs(slug) {
  if (SO.cs.has(slug)) return SO.cs.get(slug);
  const p = `content/case-studies/${slug}.json`;
  const r = await K.readFiles([p]);
  if (!r.files[p]) throw new Error('That case study is gone.');
  const d = JSON.parse(r.files[p].text);
  SO.cs.set(slug, d);
  return d;
}
const strip = (html) => { const t = document.createElement('div'); t.innerHTML = String(html || ''); return (t.textContent || '').replace(/\s+/g, ' ').trim(); };
const summaryOf = (cs) => strip((cs.listing && cs.listing.work && cs.listing.work.summary) || cs.description || cs.intro);
// Every photo in a case study (logos left out), hero first
function photosOf(cs) {
  const out = [];
  const add = (src) => { if (typeof src === 'string' && /\.(avif|webp|jpe?g|png)(\?|$)/i.test(src) && !out.includes(src)) out.push(src); };
  const walk = (o, key) => {
    if (!o || typeof o !== 'object' || /logo/i.test(key || '') || o.type === 'logos') return;
    if (Array.isArray(o)) { o.forEach((x) => walk(x, key)); return; }
    if (o.type !== 'video') add(o.src);
    for (const [k, v] of Object.entries(o)) walk(v, k);
  };
  walk(cs.heroImage, 'hero'); walk(cs.introPieces, 'intro'); walk(cs.sections, 'sections'); walk(cs.listing, 'listing'); walk(cs.heroVertical, 'vertical');
  return out;
}
const quoteOf = (cs) => {
  // some case studies keep a pull quote in the headline: “Coolest package ever.” - Name
  const hq = String(cs.headline || '').trim().match(/^[“"](.+?)[”"]\s*(?:[-–—]\s*(.+))?$/);
  if (hq) return { quote: hq[1], by: hq[2] || '', fromHeadline: true };
  for (const p of [...(cs.introPieces || []), ...(cs.sections || []).flatMap((s) => s.pieces || [])]) if (p.type === 'quote' && strip(p.text || p.quote || p.html)) return { quote: strip(p.text || p.quote || p.html), by: strip(p.by || p.name || p.cite || '') };
  return null;
};
// A first draft of slides from a case study. Everything in it can be changed afterwards.
function draftSlides(cs) {
  const photos = photosOf(cs), stats = (cs.stats || []).filter((s) => String(s.value || '').trim()), sum = summaryOf(cs), q = quoteOf(cs);
  const slides = [{ type: 'cover', photo: photos[0] || '', title: cs.title || '', kicker: cs.client || '', badge: ((cs.awards || [])[0] || {}).name || '' }];
  if (sum) slides.push({ type: 'text', color: 'violet', heading: (q && q.fromHeadline ? '' : cs.headline) || cs.title || '', body: sum });
  if (photos[1]) slides.push({ type: 'photo', photo: photos[1], caption: '' });
  for (let i = 0; i < stats.length && i < 9; i += 3) slides.push({ type: 'stats', color: i ? 'night' : 'blue', heading: i ? '' : 'By the numbers', items: stats.slice(i, i + 3).map((s) => ({ value: s.value, label: s.label || '' })), footer: cs.title || '' });
  if (photos[2]) slides.push({ type: 'photo', photo: photos[2], caption: '' });
  if (q) slides.push({ type: 'quote', color: 'pink', quote: q.quote, by: q.by });
  slides.push({ type: 'outro', color: 'yellow', line: 'See the full case study', url: `iheartcomix.com/case-study/${cs.slug}` });
  return slides.map((s) => ({ id: K.uid(), ...s }));
}
const BLANK = {
  cover: { title: 'Title', kicker: '', badge: '', photo: '' }, text: { color: 'violet', heading: 'Say it loud', body: '' }, photo: { photo: '', caption: '' },
  stats: { color: 'blue', heading: 'By the numbers', items: [{ value: '100+', label: 'Things' }], footer: '' }, quote: { color: 'pink', quote: 'Something worth repeating', by: '' },
  outro: { color: 'yellow', line: 'See the full case study', url: 'iheartcomix.com' },
};
// Captions written from what the case study already says. Three takes.
function captionsOf(cs) {
  const names = String(cs.client || '').split(/\s*[•,]\s*/).filter(Boolean);
  const client = names.length > 2 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names.join(' and ');
  const head = cs.title + (client ? ' for ' + client : '') + '.';
  const sum = summaryOf(cs), first = (sum.match(/^.*?[.!?](\s|$)/) || [sum])[0].trim();
  // labels are stored in caps: lower them, but keep an award's own spelling ("1 Silver Clio")
  const proper = (label) => { const a = (cs.awards || []).find((x) => String(label || '').toLowerCase().includes(x.name.toLowerCase())); return a ? a.name : String(label || '').toLowerCase(); };
  const stats = (cs.stats || []).filter((s) => String(s.value || '').trim()).map((s) => `${s.value} ${proper(s.label)}`.trim());
  const tag = (s) => { const t = String(s || '').replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(''); return t && t.length <= 30 ? '#' + t : ''; };
  const tags = [...new Set(['#iheartcomix', tag(cs.title), ...names.map(tag), ...(cs.services || []).slice(0, 3).map((s) => tag(s.name)), ...(cs.awards || []).map((a) => tag(a.name))].filter(Boolean))].join(' ');
  const link = `iheartcomix.com/case-study/${cs.slug}`;
  return {
    recap: [head, sum, stats.join(' / '), 'Full case study: ' + link, tags].filter(Boolean).join('\n\n'),
    numbers: [stats.length ? stats.map((s) => s[0].toUpperCase() + s.slice(1)).join('. ') + '.' : '', head + (first ? ' ' + first : ''), link, tags].filter(Boolean).join('\n\n'),
    short: [head, stats[0] ? stats[0][0].toUpperCase() + stats[0].slice(1) + '.' : '', link].filter(Boolean).join(' '),
  };
}

/* ---------------- shared bits ---------------- */
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const niceTime = (t) => { if (!t) return ''; const [hh, mm] = t.split(':').map(Number); return `${hh % 12 || 12}${mm ? ':' + pad(mm) : ''}${hh < 12 ? 'am' : 'pm'}`; };
const seg = (items, get, set) => {
  const box = h('div', { class: 'seg', role: 'group' });
  const draw = () => box.replaceChildren(...items.map(([k, label]) => h('button', { type: 'button', class: get() === k ? 'is-on' : '', 'aria-pressed': String(get() === k), onclick: () => { set(k); draw(); } }, label)));
  draw();
  return box;
};
const swatches = (get, set, names = Object.keys(G.COLORS)) => {
  const box = h('div', { class: 'so-sws', role: 'group', 'aria-label': 'Color' });
  const draw = () => box.replaceChildren(...names.map((c) => h('button', { type: 'button', class: 'so-sw', title: c[0].toUpperCase() + c.slice(1), 'aria-label': c, 'aria-pressed': String(get() === c), style: { background: G.COLORS[c] }, onclick: () => { set(c); draw(); } })));
  draw();
  return box;
};
const field = (label, control, note) => h('label', { class: 'field' }, h('span', {}, label), control, note ? h('small', {}, note) : null);
async function thumb(canvas, format, slide) {
  const E = await G.env(format, slide ? [slide] : []);
  if (!canvas.isConnected) return;
  const k = canvas.width / E.W;
  canvas.height = Math.round(E.H * k);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  if (slide) G.drawSlide(ctx, slide, 99, E);
}
const head = (on, title, sub, ...tools) => h('div', { class: 'library-head' },
  h('div', {}, K.libTabs(on), h('h1', {}, title), h('p', {}, sub)),
  h('div', { class: 'library-tools' }, tools));
function shell(app, title) {
  document.title = title + ' · Builder';
  K.S.cs = null;
  document.body.classList.remove('preview-open');
  const page = h('div', { class: 'library so-page' }, h('div', { class: 'boot' }, 'Loading…'));
  app.replaceChildren(K.topbarLibrary(), page);
  return page;
}

/* ---------------- planner ---------------- */
async function renderPlanner(app) {
  const page = shell(app, 'Social');
  try { await loadPosts(); } catch (e) { page.replaceChildren(h('div', { class: 'empty' }, e.message)); return; }
  const now = new Date();
  let view = K.store.get('ihc-social-month') || { y: now.getFullYear(), m: now.getMonth() };
  const cal = h('div', { class: 'so-cal' }), loose = h('div', { class: 'so-loose' }), label = h('h2', { class: 'so-month' });

  const chip = (post) => {
    const tags = (post.platforms || []).map((p) => (PLATFORMS.find((x) => x[0] === p) || [])[2]).filter(Boolean);
    const c = h('a', { class: 'so-chip', href: '#/social/post/' + post.id, draggable: 'true', 'data-status': post.status || 'draft', title: (STATUS.find((s) => s[0] === post.status) || STATUS[1])[1] },
      h('canvas', { class: 'so-thumb', width: 96, height: 96 }),
      h('span', { class: 'so-chip-t' }, h('b', {}, post.title || 'Untitled'),
        h('span', { class: 'so-chip-m' }, post.time ? h('span', {}, niceTime(post.time)) : null, tags.map((t) => h('i', {}, t)))));
    c.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', post.id); e.dataTransfer.effectAllowed = 'move'; });
    setTimeout(() => thumb(c.firstChild, post.format, post.slides[0]));
    return c;
  };
  const dropOn = (el, date) => {
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop-ok'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop-ok'));
    el.addEventListener('drop', (e) => {
      e.preventDefault(); el.classList.remove('drop-ok');
      const post = SO.posts.find((p) => p.id === e.dataTransfer.getData('text/plain'));
      if (post && (post.date || '') !== date) { post.date = date; touch(post); draw(); }
    });
  };
  const draw = () => {
    K.store.set('ihc-social-month', view);
    label.textContent = `${MONTHS[view.m]} ${view.y}`;
    const first = new Date(view.y, view.m, 1), start = new Date(view.y, view.m, 1 - first.getDay()), today = ymd(new Date());
    const cells = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => h('div', { class: 'so-dow' }, d));
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), date = ymd(d);
      if (i >= 35 && d.getMonth() !== view.m) break;
      const posts = SO.posts.filter((p) => p.date === date).sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
      const cell = h('div', { class: 'so-day' + (d.getMonth() !== view.m ? ' is-out' : '') + (date === today ? ' is-today' : '') + (posts.length ? ' has-posts' : '') },
        h('div', { class: 'so-day-h' }, h('span', { class: 'so-num' }, h('em', {}, d.toLocaleDateString('en-US', { weekday: 'short' }) + ' '), d.getDate()),
          h('button', { type: 'button', class: 'so-add', 'aria-label': 'New post on ' + d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }), onclick: () => newPostModal(date) }, '+')),
        posts.map(chip));
      dropOn(cell, date);
      cells.push(cell);
    }
    cal.replaceChildren(...cells);
    const free = SO.posts.filter((p) => !p.date);
    loose.replaceChildren(h('h3', {}, 'Not scheduled yet'), free.length ? h('div', { class: 'so-loose-list' }, free.map(chip)) : h('p', { class: 'so-none' }, 'Posts without a date wait here. Drag one onto a day to schedule it.'));
  };
  dropOn(loose, '');
  const step = (n) => { const d = new Date(view.y, view.m + n, 1); view = { y: d.getFullYear(), m: d.getMonth() }; draw(); };
  page.replaceChildren(
    head('social', 'Social', 'Plan what goes out, make posts from case studies, and build clips for edits.',
      h('a', { class: 'btn', href: '#/social/motion' }, 'Motion studio'), h('button', { class: 'btn primary', onclick: () => newPostModal('') }, 'New post')),
    h('div', { class: 'so-bar' },
      h('div', { class: 'so-nav' }, h('button', { class: 'btn small', 'aria-label': 'Previous month', onclick: () => step(-1) }, '‹'), label, h('button', { class: 'btn small', 'aria-label': 'Next month', onclick: () => step(1) }, '›'),
        h('button', { class: 'btn small ghost', onclick: () => { view = { y: now.getFullYear(), m: now.getMonth() }; draw(); } }, 'Today')),
      h('div', { class: 'so-key' }, STATUS.map(([k, name]) => h('span', { 'data-status': k }, name))),
      saveButton()),
    cal, loose);
  draw();
}

function newPostModal(date) {
  const list = (K.S.index.caseStudies || []).slice().sort((a, b) => a.title.localeCompare(b.title));
  let format = 'story';
  const sel = h('select', { class: 'select', 'aria-label': 'Case study' }, h('option', { value: '' }, 'A blank post'), list.map((c) => h('option', { value: c.slug }, c.title + (c.client ? ' (' + c.client + ')' : ''))));
  if (list[0]) sel.value = list[0].slug;
  const go = h('button', { class: 'btn primary', onclick: async () => {
    go.disabled = true; go.textContent = 'Drafting…';
    try {
      const post = { id: K.uid(), title: 'Untitled post', slug: sel.value, format, per: 3, slides: [], caption: '', platforms: ['instagram'], date, time: '', status: 'draft' };
      if (sel.value) {
        const cs = await loadCs(sel.value);
        Object.assign(post, { title: cs.title, slides: draftSlides(cs), caption: captionsOf(cs).recap });
      } else post.slides = [{ id: K.uid(), ...K.clone(BLANK.text) }, { id: K.uid(), ...K.clone(BLANK.outro) }];
      SO.posts.push(post); touch(post);
      m.close();
      location.hash = '#/social/post/' + post.id;
    } catch (e) { K.toast(e.message, 'err'); go.disabled = false; go.textContent = 'Draft it'; }
  } }, 'Draft it');
  const m = K.modal(h('div', { class: 'modal' },
    h('h2', {}, 'New post'),
    field('Make it from', sel, 'Picks the photos, numbers and words out of the case study. You can change all of it.'),
    h('div', { class: 'field' }, h('span', {}, 'Shape'), seg(['story', 'post', 'square'].map((k) => [k, `${G.FORMATS[k].label} ${G.FORMATS[k].note}`]), () => format, (k) => { format = k; })),
    h('div', { class: 'actions' }, h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Cancel'), go)));
}

/* ---------------- post maker ---------------- */
const FIELDS = {
  cover: [['title', 'Title'], ['kicker', 'Line above the title'], ['badge', 'Badge, like an award'], ['photo', 'Photo', 'photo']],
  text: [['heading', 'Heading'], ['body', 'Words', 'area'], ['color', 'Color', 'color']],
  photo: [['caption', 'Caption (optional)'], ['photo', 'Photo', 'photo']],
  stats: [['heading', 'Heading'], ['items', 'Numbers', 'stats'], ['footer', 'Small line at the bottom'], ['color', 'Color', 'color']],
  quote: [['quote', 'Quote', 'area'], ['by', 'Who said it'], ['color', 'Color', 'color']],
  outro: [['line', 'Line'], ['url', 'Link'], ['color', 'Color', 'color']],
};
async function renderPost(app, id) {
  const page = shell(app, 'Post');
  let post, cs = null;
  try {
    await loadPosts();
    post = SO.posts.find((p) => p.id === id);
    if (post && post.slug) cs = await loadCs(post.slug).catch(() => null);
  } catch (e) { page.replaceChildren(h('div', { class: 'empty' }, e.message)); return; }
  if (!post) { page.replaceChildren(h('div', { class: 'empty' }, 'That post isn’t in the planner any more. ', h('a', { href: '#/social' }, 'Back to the planner'))); return; }
  post.per = post.per || 3;
  const photos = cs ? photosOf(cs) : [];
  let sel = 0, E = null, playing = false, tab = 'slide';
  const canvas = h('canvas', { class: 'so-canvas', width: 1080, height: 1920 });
  const stripEl = h('div', { class: 'so-strip' }), panel = h('div', { class: 'so-panel' }), playBtn = h('button', { type: 'button', class: 'btn', onclick: () => (playing ? stop() : play()) }, 'Play');
  const fname = (ext, n) => `${post.slug || 'post'}-${post.format}${n ? '-' + n : ''}.${ext}`;

  const paint = () => {
    if (playing || !E) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, E.W, E.H);
    if (post.slides[sel]) G.drawSlide(ctx, post.slides[sel], 99, E);
  };
  const refresh = async () => {
    E = await G.env(post.format, post.slides);
    if (canvas.width !== E.W || canvas.height !== E.H) { canvas.width = E.W; canvas.height = E.H; }
    paint(); drawStrip();
  };
  const thumbsSoon = K.debounce(() => K.$$('.so-slide canvas', stripEl).forEach((c, i) => thumb(c, post.format, post.slides[i])), 250);
  const changed = (reload) => { touch(post); if (reload) refresh(); else { paint(); thumbsSoon(); } };
  const stop = () => { playing = false; playBtn.textContent = 'Play'; paint(); };
  const play = () => {
    if (!E || !post.slides.length) return;
    playing = true; playBtn.textContent = 'Stop';
    const total = G.sequenceLength(post.slides, post.per), from = sel * post.per, t0 = performance.now(), ctx = canvas.getContext('2d');
    const tick = (now) => {
      if (!playing || !canvas.isConnected) { playing = false; return; }
      const T = from + (now - t0) / 1000;
      if (T >= total) { stop(); return; }
      ctx.clearRect(0, 0, E.W, E.H);
      G.drawSequence(ctx, post.slides, T, E, { per: post.per });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const pick = (i) => { if (playing) stop(); sel = Math.max(0, Math.min(post.slides.length - 1, i)); paint(); drawStrip(); drawPanel(); };

  function drawStrip() {
    const typeName = (t) => (G.SLIDE_TYPES.find((x) => x[0] === t) || ['', 'Slide'])[1];
    const add = h('select', { 'aria-label': 'Add a slide' }, h('option', { value: '' }, '+ Add a slide'), G.SLIDE_TYPES.map(([k, name]) => h('option', { value: k }, name)));
    add.addEventListener('change', () => {
      if (!add.value) return;
      const s = { id: K.uid(), ...K.clone(BLANK[add.value]) };
      if ('photo' in s) s.photo = photos.find((p) => !post.slides.some((x) => x.photo === p)) || photos[0] || '';
      post.slides.splice(sel + 1, 0, s); sel += 1;
      changed(true); drawPanel();
    });
    stripEl.replaceChildren(...post.slides.map((s, i) => {
      const move = (d) => (e) => { e.stopPropagation(); const j = i + d; if (j < 0 || j >= post.slides.length) return; post.slides.splice(j, 0, post.slides.splice(i, 1)[0]); sel = j; changed(true); };
      const row = h('div', { class: 'so-slide' + (i === sel ? ' is-on' : ''), role: 'button', tabindex: '0', 'aria-label': `Slide ${i + 1}, ${typeName(s.type)}`, onclick: () => pick(i), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); } } },
        h('canvas', { width: 120, height: 120 }),
        h('span', { class: 'so-slide-n' }, h('b', {}, i + 1), typeName(s.type)),
        h('span', { class: 'so-slide-tools' },
          h('button', { type: 'button', 'aria-label': 'Move earlier', disabled: i === 0, onclick: move(-1) }, K.svg('up')),
          h('button', { type: 'button', 'aria-label': 'Move later', disabled: i === post.slides.length - 1, onclick: move(1) }, K.svg('down')),
          h('button', { type: 'button', 'aria-label': 'Delete slide', disabled: post.slides.length < 2, onclick: (e) => { e.stopPropagation(); post.slides.splice(i, 1); sel = Math.min(sel, post.slides.length - 1); changed(true); drawPanel(); } }, K.svg('trash'))));
      setTimeout(() => thumb(row.firstChild, post.format, s));
      return row;
    }), h('label', { class: 'pick so-addslide' }, add));
  }

  function slideFields(s) {
    return (FIELDS[s.type] || []).map(([key, label, kind]) => {
      if (kind === 'color') return h('div', { class: 'field' }, h('span', {}, label), swatches(() => s.color, (c) => { s.color = c; changed(); }));
      if (kind === 'area') return field(label, h('textarea', { class: 'textarea', rows: 5, value: s[key] || '', oninput: (e) => { s[key] = e.target.value; changed(); } }));
      if (kind === 'stats') {
        s.items = s.items || [];
        return h('div', { class: 'field' }, h('span', {}, label), [0, 1, 2].map((i) => h('div', { class: 'so-stat-row' },
          h('input', { class: 'input', placeholder: '300+', 'aria-label': `Number ${i + 1}`, value: (s.items[i] || {}).value || '', oninput: (e) => { s.items[i] = { ...(s.items[i] || { label: '' }), value: e.target.value }; changed(); } }),
          h('input', { class: 'input', placeholder: 'Fans', 'aria-label': `Label ${i + 1}`, value: (s.items[i] || {}).label || '', oninput: (e) => { s.items[i] = { ...(s.items[i] || { value: '' }), label: e.target.value }; changed(); } }))),
        cs && (cs.stats || []).length > 3 ? h('small', {}, 'Three to a slide. Add another Numbers slide for more.') : null);
      }
      if (kind === 'photo') {
        const all = s.photo && !photos.includes(s.photo) ? [s.photo, ...photos] : photos;
        const grid = h('div', { class: 'so-photos' }, all.map((src) => h('button', { type: 'button', class: 'so-photo', 'aria-pressed': String(src === s.photo), 'aria-label': 'Use this photo', onclick: () => { s.photo = src; changed(true); drawPanel(); } }, h('img', { src, alt: '', loading: 'lazy' }))),
          h('button', { type: 'button', class: 'so-photo so-upload', onclick: async () => { try { const src = await K.uploadPhoto(post.format === 'story' ? '9:16' : post.format === 'post' ? '4:5' : '1:1'); if (src) { s.photo = src; changed(true); drawPanel(); } } catch (e) { K.toast(e.message, 'err'); } } }, 'Upload'));
        return h('div', { class: 'field' }, h('span', {}, label), grid);
      }
      return field(label, h('input', { class: 'input', value: s[key] || '', oninput: (e) => { s[key] = e.target.value; changed(); } }));
    });
  }
  function captionFields() {
    const area = h('textarea', { class: 'textarea so-caption', rows: 12, value: post.caption || '', 'aria-label': 'Caption', oninput: () => { post.caption = area.value; touch(post); count(); } });
    const counts = h('div', { class: 'so-counts' });
    const count = () => counts.replaceChildren(...PLATFORMS.filter(([k]) => (post.platforms || []).includes(k)).map(([, name, , max]) => h('span', { class: max && area.value.length > max ? 'is-over' : '' }, max ? `${name} ${area.value.length} / ${max}` : `${name} ${area.value.length}`)));
    const takes = cs ? captionsOf(cs) : null;
    const plats = h('div', { class: 'chips' }, PLATFORMS.map(([k, name]) => h('button', { type: 'button', class: 'chip so-plat', 'aria-pressed': String((post.platforms || []).includes(k)), onclick: (e) => {
      post.platforms = (post.platforms || []).includes(k) ? post.platforms.filter((x) => x !== k) : [...(post.platforms || []), k];
      e.currentTarget.setAttribute('aria-pressed', String(post.platforms.includes(k))); touch(post); count();
    } }, name)));
    count();
    return [
      h('div', { class: 'field' }, h('span', {}, 'Going out on'), plats),
      h('div', { class: 'field' }, h('span', {}, 'Caption'), area, counts),
      takes ? h('div', { class: 'field' }, h('span', {}, 'Rewrite from the case study'), h('div', { class: 'so-takes' }, [['recap', 'The recap'], ['numbers', 'Numbers first'], ['short', 'Short, for X']].map(([k, name]) => h('button', { type: 'button', class: 'btn small', onclick: () => { area.value = takes[k]; post.caption = area.value; touch(post); count(); } }, name)))) : null,
      h('button', { type: 'button', class: 'btn', onclick: async () => { try { await navigator.clipboard.writeText(area.value); K.toast('Caption copied.'); } catch (e) { area.select(); K.toast('Select all and copy: your browser blocked the clipboard.', 'err'); } } }, 'Copy caption'),
    ];
  }
  function scheduleFields() {
    return [
      h('div', { class: 'so-when' },
        field('Day', h('input', { class: 'input', type: 'date', value: post.date || '', oninput: (e) => { post.date = e.target.value; touch(post); } })),
        field('Time', h('input', { class: 'input', type: 'time', value: post.time || '', oninput: (e) => { post.time = e.target.value; touch(post); } }))),
      h('div', { class: 'field' }, h('span', {}, 'Where it’s at'), seg(STATUS, () => post.status || 'draft', (k) => { post.status = k; touch(post); })),
      h('p', { class: 'so-note' }, 'The planner keeps track. Posting still happens in each app: download the files, copy the caption, post, then mark it Posted.'),
      h('button', { type: 'button', class: 'btn ghost so-delete', onclick: () => {
        const m = K.modal(h('div', { class: 'modal' }, h('h2', {}, 'Delete this post?'), h('p', {}, 'It comes off the planner. This can’t be undone once you save.'),
          h('div', { class: 'actions' }, h('button', { class: 'btn ghost', onclick: () => m.close() }, 'Keep it'), h('button', { class: 'btn primary', onclick: () => { SO.posts = SO.posts.filter((p) => p !== post); touch(); m.close(); location.hash = '#/social'; } }, 'Delete'))));
      } }, 'Delete post'),
    ];
  }
  function drawPanel() {
    const s = post.slides[sel];
    panel.replaceChildren(
      seg([['slide', 'Slide'], ['caption', 'Caption'], ['when', 'Schedule']], () => tab, (k) => { tab = k; drawPanel(); }),
      h('div', { class: 'so-fields' }, tab === 'slide' ? (s ? slideFields(s) : null) : tab === 'caption' ? captionFields() : scheduleFields()));
  }

  const busy = async (btn, label, job) => {
    const was = btn.textContent; btn.disabled = true; btn.textContent = label;
    try { await job((pct) => { btn.textContent = `${label} ${pct}%`; }); } catch (e) { K.toast(e.message, 'err', 8000); } finally { btn.disabled = false; btn.textContent = was; }
  };
  const imagesBtn = h('button', { type: 'button', class: 'btn', onclick: () => busy(imagesBtn, 'Making images', async () => {
    if (playing) stop();
    for (let i = 0; i < post.slides.length; i++) {
      G.download(await G.toPng(E, (ctx) => G.drawSlide(ctx, post.slides[i], 99, E)), fname('png', post.slides.length > 1 ? i + 1 : 0));
      await new Promise((ok) => setTimeout(ok, 350));
    }
  }) }, 'Download images');
  const videoBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => busy(videoBtn, 'Making video', async (onPct) => {
    if (playing) stop();
    const r = await G.toVideo(E, { dur: G.sequenceLength(post.slides, post.per), draw: (ctx, t) => G.drawSequence(ctx, post.slides, t, E, { per: post.per }), onProgress: onPct });
    G.download(r.blob, fname(r.format));
    if (r.format !== 'mp4') K.toast('This browser made a WebM. Instagram and TikTok want MP4, which Chrome makes.', '', 8000);
  }) }, 'Download video');

  const title = h('input', { class: 'so-title', value: post.title || '', 'aria-label': 'Post name', oninput: () => { post.title = title.value; touch(post); } });
  page.replaceChildren(
    h('div', { class: 'so-edit-head' }, h('a', { class: 'btn small ghost', href: '#/social' }, '‹ Planner'), title, saveButton()),
    h('div', { class: 'so-edit' },
      h('div', { class: 'so-col-strip' }, stripEl),
      h('div', { class: 'so-stage' }, h('div', { class: 'so-canvas-wrap' }, canvas),
        h('div', { class: 'so-transport' }, playBtn,
          h('label', { class: 'pick' }, h('select', { 'aria-label': 'Seconds per slide', onchange: (e) => { post.per = +e.target.value; touch(post); } }, [2, 3, 4, 5, 6].map((n) => h('option', { value: n, selected: n === post.per }, `${n} seconds a slide`)))),
          seg(['story', 'post', 'square'].map((k) => [k, G.FORMATS[k].label]), () => post.format, (k) => { if (playing) stop(); post.format = k; changed(true); }))),
      h('div', { class: 'so-col-panel' }, panel,
        h('div', { class: 'so-export' }, h('h3', {}, 'Export'), h('div', { class: 'so-export-b' }, imagesBtn, videoBtn),
          h('small', {}, 'Images come out one PNG a slide. The video is an MP4 of every slide with the color wipe between them.')))));
  drawPanel();
  await refresh();
}

/* ---------------- motion studio ---------------- */
const MOTION = {
  bubble: { value: '2.5M', label: 'Impressions', color: 'yellow', spot: 'center', size: 0.6, dur: 3 },
  burst: { count: 16, seed: 7, dur: 3 },
  wipe: { look: 0, dur: 1.2 },
  title: { text: 'Sold out', color: 'yellow', dur: 3 },
  lower: { name: 'Name here', sub: 'What they did', color: 'red', dur: 4 },
  logo: { size: 0.42, dur: 2.5 },
};
async function renderMotion(app) {
  const page = shell(app, 'Motion studio');
  try { if (!K.S.index) await K.loadIndex(); await G.ready(); } catch (e) { page.replaceChildren(h('div', { class: 'empty' }, e.message)); return; }
  const saved = K.store.get('ihc-motion') || {};
  const M = { type: saved.type || 'bubble', format: saved.format || 'story', bg: saved.bg || 'clear', opts: { ...K.clone(MOTION), ...(saved.opts || {}) } };
  const keep = () => K.store.set('ihc-motion', M);
  const o = () => M.opts[M.type];
  const canvas = h('canvas', { class: 'so-canvas' }), list = h('div', { class: 'so-els' }), panel = h('div', { class: 'so-panel' });
  let E = null, t0 = performance.now();
  const size = async () => { E = await G.env(M.format); canvas.width = E.W; canvas.height = E.H; canvas.parentNode.classList.toggle('is-clear', M.bg === 'clear'); };
  const frame = (ctx, t) => G.drawElement(ctx, { type: M.type, bg: M.bg, ...o() }, t, E);
  const loop = (now) => {
    if (!canvas.isConnected) return;
    if (E) {
      const ctx = canvas.getContext('2d'), t = ((now - t0) / 1000) % (o().dur + 0.6);
      ctx.clearRect(0, 0, E.W, E.H);
      if (t < o().dur) frame(ctx, t); else if (M.bg !== 'clear') G.drawElement(ctx, { type: 'none-bg', bg: M.bg, dur: 1 }, 99, E);
    }
    requestAnimationFrame(loop);
  };
  const again = () => { t0 = performance.now(); keep(); };
  const text = (key, label) => field(label, h('input', { class: 'input', value: o()[key] || '', oninput: (e) => { o()[key] = e.target.value; keep(); } }));
  const range = (key, label, min, max, stepBy, show) => {
    const outEl = h('b', {}, show(o()[key]));
    return h('label', { class: 'field so-range' }, h('span', {}, label, ' ', outEl), h('input', { type: 'range', min, max, step: stepBy, value: o()[key], oninput: (e) => { o()[key] = +e.target.value; outEl.textContent = show(o()[key]); again(); } }));
  };
  const color = (key = 'color') => h('div', { class: 'field' }, h('span', {}, 'Color'), swatches(() => o()[key], (c) => { o()[key] = c; keep(); }));

  function drawList() {
    list.replaceChildren(...G.ELEMENT_TYPES.map(([k, name, about]) => h('button', { type: 'button', class: 'so-el' + (k === M.type ? ' is-on' : ''), 'aria-pressed': String(k === M.type), onclick: () => { M.type = k; again(); drawList(); drawPanel(); } }, h('b', {}, name), h('small', {}, about))));
  }
  function fromCaseStudy() {
    const sel = h('select', { class: 'select', 'aria-label': 'Case study' }, h('option', { value: '' }, 'Fill from a case study…'), (K.S.index.caseStudies || []).slice().sort((a, b) => a.title.localeCompare(b.title)).map((c) => h('option', { value: c.slug }, c.title)));
    const picks = h('div', { class: 'so-takes' });
    sel.addEventListener('change', async () => {
      picks.replaceChildren();
      if (!sel.value) return;
      try {
        const cs = await loadCs(sel.value);
        if (M.type === 'bubble') {
          const stats = (cs.stats || []).filter((s) => String(s.value || '').trim());
          if (!stats.length) { picks.replaceChildren(h('small', {}, 'That one has no numbers yet.')); return; }
          picks.replaceChildren(...stats.map((s) => h('button', { type: 'button', class: 'btn small', onclick: () => { Object.assign(o(), { value: s.value, label: s.label || '' }); again(); drawPanel(); } }, `${s.value} ${s.label || ''}`)));
        } else if (M.type === 'title') { o().text = cs.title; again(); drawPanel(); }
        else if (M.type === 'lower') { Object.assign(o(), { name: cs.title, sub: cs.client || '' }); again(); drawPanel(); }
      } catch (e) { K.toast(e.message, 'err'); }
    });
    return h('div', { class: 'field' }, h('span', {}, 'Use real numbers and names'), sel, picks);
  }
  function drawPanel() {
    const t = M.type, own = {
      bubble: () => [text('value', 'Number'), text('label', 'Label'), color(),
        h('div', { class: 'field' }, h('span', {}, 'Where'), seg([['center', 'Middle'], ['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Low left'], ['br', 'Low right']], () => o().spot, (k) => { o().spot = k; again(); })),
        range('size', 'Size', 0.25, 0.95, 0.05, (v) => Math.round(v * 100) + '%'), fromCaseStudy()],
      burst: () => [range('count', 'Bubbles', 6, 32, 1, (v) => v), h('button', { type: 'button', class: 'btn', onclick: () => { o().seed = (o().seed || 7) + 1; again(); } }, 'Shuffle them')],
      wipe: () => [h('div', { class: 'field' }, h('span', {}, 'Colors'), seg([[0, 'One'], [1, 'Two'], [2, 'Three'], [3, 'Four']], () => o().look, (k) => { o().look = k; again(); })),
        h('p', { class: 'so-note' }, 'Lay it over a cut. The frame is fully covered halfway through, so put the cut there.')],
      title: () => [text('text', 'Words'), color(), fromCaseStudy()],
      lower: () => [text('name', 'Name'), text('sub', 'Line under it'), color(), fromCaseStudy()],
      logo: () => [range('size', 'Size', 0.2, 0.8, 0.02, (v) => Math.round(v * 100) + '%')],
    }[t]();
    const clipBtn = h('button', { type: 'button', class: 'btn primary', onclick: async () => {
      const was = clipBtn.textContent; clipBtn.disabled = true;
      try {
        const clear = M.bg === 'clear';
        const r = await G.toVideo(E, { dur: o().dur, draw: frame, format: clear ? 'webm' : 'mp4', clear, onProgress: (p) => { clipBtn.textContent = `Making clip ${p}%`; } });
        G.download(r.blob, `ihc-${t}-${M.format}.${r.format}`);
      } catch (e) { K.toast(e.message, 'err', 8000); } finally { clipBtn.disabled = false; clipBtn.textContent = was; }
    } }, 'Download clip');
    panel.replaceChildren(
      h('div', { class: 'so-fields' }, own,
        range('dur', 'Length', t === 'wipe' ? 0.6 : 1.5, t === 'wipe' ? 2.4 : 8, t === 'wipe' ? 0.1 : 0.5, (v) => v + 's'),
        h('div', { class: 'field' }, h('span', {}, 'Shape'), seg(Object.entries(G.FORMATS).map(([k, f]) => [k, f.label]), () => M.format, async (k) => { M.format = k; await size(); again(); })),
        h('div', { class: 'field' }, h('span', {}, 'Background'), seg([['clear', 'Clear'], ['green', 'Green screen'], ['color', 'A color']], () => (M.bg === 'clear' || M.bg === 'green' ? M.bg : 'color'), (k) => { M.bg = k === 'color' ? 'night' : k; size(); keep(); drawPanel(); }),
          M.bg !== 'clear' && M.bg !== 'green' ? swatches(() => M.bg, (c) => { M.bg = c; keep(); }) : null,
          h('small', {}, M.bg === 'clear' ? 'Clear exports a WebM with a see-through background. If your editor shows it on black, use Green screen.' : M.bg === 'green' ? 'Exports an MP4 on pure green. Key the green out in your editor.' : 'Exports an MP4 on that color.'))),
      h('div', { class: 'so-export' }, h('h3', {}, 'Export'), h('div', { class: 'so-export-b' },
        h('button', { type: 'button', class: 'btn', onclick: async () => { try { G.download(await G.toPng(E, (ctx) => frame(ctx, Math.min(o().dur * 0.5, 1.2))), `ihc-${t}-${M.format}.png`); } catch (e) { K.toast(e.message, 'err'); } } }, 'Download still'),
        clipBtn)));
  }
  page.replaceChildren(
    head('social', 'Motion studio', 'IHC bubbles, wipes and type as clips to drop into a video edit.', h('a', { class: 'btn', href: '#/social' }, 'Back to the planner')),
    h('div', { class: 'so-edit so-motion' },
      h('div', { class: 'so-col-strip' }, list),
      h('div', { class: 'so-stage' }, h('div', { class: 'so-canvas-wrap' }, canvas)),
      h('div', { class: 'so-col-panel' }, panel)));
  await size();
  drawList(); drawPanel();
  requestAnimationFrame(loop);
}
