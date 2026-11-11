/* IHC case study builder. Plain ES module, no build step.
   Data: content/case-studies/<slug>.json  ->  page: case-study/<slug>.html (rendered by render.js) */

const R = window.IHCRender;
const Sortable = window.Sortable;

/* ---------------- tiny helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
let uidN = 0;
const uid = () => 'k' + Date.now().toString(36) + (uidN++).toString(36);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
    }
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const svg = (name) => {
  const s = document.createElement('span');
  s.innerHTML = ICON[name] || '';
  return s.firstChild;
};
// The IHC speech bubble from the site header (letters are cut out, so the background shows through)
const logo = (cls = '') => h('img', { class: ('logo ' + cls).trim(), src: '/builder/ihc-logo.svg', alt: 'IHC', width: 62, height: 55, draggable: 'false' });
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const clone = (o) => JSON.parse(JSON.stringify(o));
const decodeHtml = (s) => { const t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; };

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
const session = {
  get() { try { return sessionStorage.getItem('ihc-builder-key') || ''; } catch (e) { return ''; } },
  set(v) { try { if (v) sessionStorage.setItem('ihc-builder-key', v); else sessionStorage.removeItem('ihc-builder-key'); } catch (e) { /* ignore */ } },
};

function toast(msg, kind = '', ms = 4200) {
  const t = h('div', { class: 'toast ' + kind });
  if (typeof msg === 'string') t.textContent = msg; else t.append(msg);
  $('#toasts').append(t);
  if (ms) setTimeout(() => t.remove(), ms);
  return t;
}

async function gitSha(text) {
  const body = new TextEncoder().encode(text);
  const head = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(head.length + body.length);
  all.set(head); all.set(body, head.length);
  const d = await crypto.subtle.digest('SHA-1', all);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------- icons ---------------- */
const I = (p, vb = '0 0 24 24') => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const ICON = {
  grip: `<svg viewBox="0 0 12 20" fill="currentColor" aria-hidden="true"><circle cx="3" cy="4" r="1.6"/><circle cx="9" cy="4" r="1.6"/><circle cx="3" cy="10" r="1.6"/><circle cx="9" cy="10" r="1.6"/><circle cx="3" cy="16" r="1.6"/><circle cx="9" cy="16" r="1.6"/></svg>`,
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  up: I('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  down: I('<path d="M12 5v14M5 12l7 7 7-7"/>'),
  fold: I('<path d="M6 9l6 6 6-6"/>'),
  x: I('<path d="M6 6l12 12M18 6L6 18"/>'),
  undo: I('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  redo: I('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
  refresh: I('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
  open: I('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
  text: I('<path d="M4 6h16M4 11h16M4 16h10"/>'),
  cols: I('<path d="M3 6h7M3 10h7M3 14h7M3 18h5M14 6h7M14 10h7M14 14h7M14 18h5"/>'),
  gallery: I('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M5 20h3M10.5 20h3M16 20h3"/>'),
  wide: I('<rect x="1.5" y="5" width="21" height="14" rx="2"/><path d="M8 12h8M13 9l3 3-3 3"/>'),
  play: I('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>'),
  image: I('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>'),
  duo: I('<rect x="3" y="5" width="8" height="14" rx="2"/><rect x="13" y="5" width="8" height="14" rx="2"/>'),
  stats: I('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  quote: I('<path d="M7 7c-2 1-3 3-3 6v4h5v-5H6c0-2 1-3 2-4zM17 7c-2 1-3 3-3 6v4h5v-5h-3c0-2 1-3 2-4z"/>'),
  intro: I('<rect x="3" y="5" width="11" height="10" rx="2"/><path d="M17 7h4M17 11h4M17 15h4M3 19h8"/>'),
  section: I('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h6"/>'),
  code: I('<path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  eye: I('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  send: I('<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'),
  grid: I('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>'),
  split: I('<rect x="3" y="5" width="9" height="14" rx="2"/><path d="M15 8h6M15 12h6M15 16h4"/>'),
  compare: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 3v18M8.5 10l-2 2 2 2M15.5 10l2 2-2 2"/>'),
  social: I('<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="16" rx="1.5"/><rect x="16" y="4" width="5" height="16" rx="1.5"/>'),
  marquee: I('<path d="M3 5h18M3 19h18M4 12h12M13 9l3 3-3 3"/>'),
  steps: I('<path d="M3 20h5v-5h5v-5h5V5h3"/>'),
  credits: I('<circle cx="8" cy="8" r="3"/><path d="M3 19c0-3 2.2-5 5-5s5 2 5 5M15 8h6M15 12h6M15 16h4"/>'),
  logos: I('<circle cx="6" cy="12" r="3"/><rect x="10.5" y="9" width="5" height="6" rx="1"/><path d="M19.5 9l2.5 6h-5z"/>'),
  palette: I('<path d="M12 3a9 9 0 1 0 0 18c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.6-9-7.6z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7.5" r="1.2" fill="currentColor"/>'),
};

/* ---------------- piece types ---------------- */
// Bricks are colored by family so the bin reads at a glance: words red, pictures blue, proof violet.
const WORDS = '#ff463d';
const PICS = '#004fff';
const PROOF = '#4d25c8';
const TYPES = {
  text: { name: 'Text', hint: 'A paragraph or two', blurb: 'A paragraph or two of story. Bold, italics and links.', color: WORDS, icon: 'text', make: () => ({ type: 'text', html: '' }) },
  text2: { name: 'Two columns', hint: 'Text side by side', blurb: 'Two short blocks of text side by side.', color: WORDS, icon: 'cols', make: () => ({ type: 'text2', left: '', right: '' }) },
  split: { name: 'Photo + text', hint: 'A photo next to words', blurb: 'A photo or loop next to a headline and text. Flip it left or right.', color: WORDS, icon: 'split', make: () => ({ type: 'split', media: null, title: '', html: '', side: 'left', caption: '' }) },
  quote: { name: 'Quote', hint: 'Words worth repeating', blurb: 'A big pull quote from a client, a fan or the press.', color: WORDS, icon: 'quote', make: () => ({ type: 'quote', text: '', who: '' }) },
  marquee: { name: 'Marquee', hint: 'Giant scrolling words', blurb: 'Giant scrolling words across the section, solid or outline.', color: WORDS, icon: 'marquee', make: () => ({ type: 'marquee', text: '', style: 'outline', speed: 'normal' }) },
  steps: { name: 'Steps', hint: 'How it came together', blurb: 'How it came together, in numbered steps.', color: WORDS, icon: 'steps', make: () => ({ type: 'steps', items: [{ title: '', text: '' }, { title: '', text: '' }, { title: '', text: '' }] }) },
  gallery: { name: 'Gallery', hint: 'Slider with thumbnails', blurb: 'Photos and Vimeo clips one at a time, with thumbnails.', color: PICS, icon: 'gallery', make: () => ({ type: 'gallery', media: [] }) },
  fullGallery: { name: 'Wide gallery', hint: 'Big edge-to-edge slider', blurb: 'A big edge-to-edge slider. Best with landscape photos.', color: PICS, icon: 'wide', make: () => ({ type: 'fullGallery', media: [] }) },
  image: { name: 'Big image', hint: 'One photo or a loop', blurb: 'One big photo or a looping MP4, framed or full bleed.', color: PICS, icon: 'image', make: () => ({ type: 'image', media: null, size: 'contained', caption: '' }) },
  duo: { name: 'Two-up', hint: 'Two photos side by side', blurb: 'Two photos side by side.', color: PICS, icon: 'duo', make: () => ({ type: 'duo', items: [null, null], ratio: 'natural' }) },
  grid: { name: 'Photo grid', hint: 'Three, four or a mosaic', blurb: 'Three or four across, or a mosaic with a big hero photo.', color: PICS, icon: 'grid', make: () => ({ type: 'grid', media: [], layout: 'three' }) },
  social: { name: 'Social row', hint: 'Vertical clips in a row', blurb: 'Vertical clips and photos in a row, like Reels and TikToks.', color: PICS, icon: 'social', make: () => ({ type: 'social', media: [] }) },
  compare: { name: 'Before + after', hint: 'Drag to compare', blurb: 'Drag to compare the render with what got built.', color: PICS, icon: 'compare', make: () => ({ type: 'compare', before: null, after: null, beforeLabel: 'Render', afterLabel: 'Built' }) },
  video: { name: 'Video', hint: 'A Vimeo player', blurb: 'A Vimeo player.', color: PICS, icon: 'play', make: () => ({ type: 'video' }) },
  stats: { name: 'Stats', hint: 'Up to four big numbers', blurb: 'Up to four big numbers.', color: PROOF, icon: 'stats', make: () => ({ type: 'stats', items: [{ value: '', label: '' }, { value: '', label: '' }] }) },
  logos: { name: 'Logos', hint: 'Press and partners', blurb: 'Press, partner or award logos in a row.', color: PROOF, icon: 'logos', make: () => ({ type: 'logos', media: [], title: '', tint: 'mono' }) },
  credits: { name: 'Credits', hint: 'Who did what', blurb: 'Who did what: client, partners, crew.', color: PROOF, icon: 'credits', make: () => ({ type: 'credits', items: [{ role: '', name: '' }, { role: '', name: '' }, { role: '', name: '' }] }) },
  introGallery: { name: 'Intro photos', hint: 'Slider by the intro', blurb: 'The slider that sits next to the intro text.', color: '#ffb728', ink: true, icon: 'intro', introOnly: true, make: () => ({ type: 'introGallery', media: [], html: '' }) },
  raw: { name: 'Custom HTML', hint: '', color: '#6f6488', icon: 'code', make: () => ({ type: 'raw', html: '' }) },
};
const FAMILIES = [
  ['Words', ['text', 'text2', 'split', 'quote', 'marquee', 'steps']],
  ['Photos and video', ['gallery', 'fullGallery', 'image', 'duo', 'grid', 'social', 'compare', 'video']],
  ['Results and credits', ['stats', 'logos', 'credits']],
];
const PALETTE = FAMILIES.flatMap(([, list]) => list);
const SECTION_COLORS = ['#ff463d', '#004fff', '#4d25c8', '#1810a0', '#16053a'];
// Section colors. Matches the [data-tone] rules in cs-blocks.css; light ones get dark text.
const TONES = [
  ['red', 'Red', '#ff463d'], ['blue', 'Blue', '#004fff'], ['violet', 'Violet', '#4d25c8'], ['purple', 'Purple', '#1810a0'], ['night', 'Night', '#16053a'],
  ['black', 'Black', '#000'], ['yellow', 'Yellow', '#ffb728', true], ['pink', 'Pink', '#fcd9eb', true], ['sky', 'Sky', '#c2e9f5', true], ['white', 'White', '#fff', true],
];
const toneOf = (s, i) => TONES.find((t) => t[0] === s.tone) || [null, 'Auto', SECTION_COLORS[i % SECTION_COLORS.length]];
// Phones and small tablets get the dock + add sheet layout (matches the CSS breakpoint)
const compact = () => window.matchMedia('(max-width: 900px)').matches;
const previewSrc = (type) => `/builder/previews/${type}.webp`;

/* ---------------- app state ---------------- */
const S = {
  key: session.get(),
  local: false,
  index: null,
  template: '',
  cs: null,
  slug: '',
  isNew: false,
  loadedSha: null,
  publishedSnap: '',
  lastSnap: '',
  history: [],
  future: [],
  activeSection: 0,
  uploads: 0,
  preview: window.innerWidth > 1180,
  device: 'desktop',
  collapsed: new Set(),
};

/* ---------------- API ---------------- */
async function api(path, opts = {}) {
  const r = await fetch('/api/builder/' + path, {
    method: opts.method || 'GET',
    headers: { 'x-builder-key': S.key, ...(opts.body ? { 'content-type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({ error: `The server answered ${r.status}.` }));
  if (r.status === 401) { session.set(''); S.key = ''; route(); throw new Error('Signed out. Enter the password again.'); }
  if (!r.ok) throw Object.assign(new Error(data.error || `Request failed (${r.status})`), { status: r.status, data });
  return data;
}
async function readFiles(paths) {
  return api('files?' + paths.map((p) => 'path=' + encodeURIComponent(p)).join('&'));
}

/* ---------------- routing ---------------- */
window.addEventListener('hashchange', () => route());
function route() {
  const app = $('#app');
  if (!S.key) return renderLogin(app);
  const m = location.hash.match(/^#\/cs\/([a-z0-9-]+)/);
  if (m) return openCaseStudy(m[1]);
  if (location.hash === '#/new') return renderLibrary(app).then(() => newCaseStudyModal());
  return renderLibrary(app);
}

/* ---------------- login ---------------- */
// A different hello on every load. First-timers get a welcome, everyone after gets a welcome back.
const HELLO = [
  'Oh good, a new person. Try not to break anything on day one.',
  'Welcome. Yes, you need the password. No, it’s not “password.”',
  'New here? Cute. Blocks are on the left, panic is optional.',
  'Welcome. Someone trusted you with this. Bold move on their part.',
];
const HELLO_AGAIN = [
  'Oh. It’s you again.',
  'Took you long enough.',
  'Back already? The case studies were enjoying the quiet.',
  'Welcome back. Try to actually publish something this time.',
  'Look who remembered the password. Proud of you. Kind of.',
  'Welcome back. The pages didn’t build themselves while you were gone. We checked.',
  'Previously, on Case Study Builder: you said you’d finish this.',
  'The line is shorter than Hall H. So is our patience.',
  'Ah, the creative genius returns. Allegedly.',
  'Welcome back. Please don’t make it another gallery.',
  'You again? Fine. Type the password and we’ll pretend we’re excited.',
  'Badge check. Ugh, fine. Go on in.',
  'Welcome back. Your drafts have been judging you.',
  'Oh hey. Did you bring snacks? No? Typical.',
  'Welcome back. Somewhere a client is typing “is it live yet?”',
  'Welcome back. The fog machine has seen things. Don’t ask.',
  'Make it pop. Kidding. We hate that phrase too.',
];
function hello() {
  const seen = store.get('ihc-builder-seen');
  const pool = seen ? HELLO_AGAIN : HELLO;
  const last = store.get('ihc-builder-hello');
  let line = pool[Math.floor(Math.random() * pool.length)];
  // never the same line twice in a row
  if (line === last) line = pool[(pool.indexOf(line) + 1) % pool.length];
  store.set('ihc-builder-hello', line);
  return line;
}

function renderLogin(app) {
  document.title = 'Case Study Builder · IHC';
  const err = h('div', { class: 'err', role: 'alert' });
  const pw = h('input', { class: 'input', type: 'password', autocomplete: 'current-password', required: true, 'aria-label': 'Password' });
  const btn = h('button', { class: 'btn primary', type: 'submit' }, 'Sign in');
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      btn.disabled = true; err.textContent = '';
      try {
        const r = await fetch('/api/builder/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw.value }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Something went wrong.');
        S.key = pw.value; session.set(pw.value); S.local = !!d.local; S.bigUploads = !!d.bigUploads;
        store.set('ihc-builder-seen', true);
        if (d.missing && d.missing.length) toast('Heads up: ' + d.missing.join(' and ') + ' still need to be set in Vercel.', 'err', 9000);
        route();
      } catch (e2) {
        err.textContent = e2.message;
        btn.disabled = false; pw.select();
      }
    },
  },
  logo('login-logo'),
  h('h1', {}, 'Case study builder'),
  h('p', { class: 'hello' }, hello()),
  h('label', { class: 'field' }, h('span', {}, 'Password'), pw),
  err, btn);
  app.replaceChildren(h('div', { class: 'login' }, form));
  pw.focus();
}

/* ---------------- library ---------------- */
async function loadIndex() {
  const r = await readFiles(['content/index.json']);
  S.index = JSON.parse(r.files['content/index.json'].text);
  return S.index;
}

async function renderLibrary(app) {
  document.title = 'Case Study Builder · IHC';
  S.cs = null;
  document.body.classList.remove('preview-open');
  app.replaceChildren(topbarLibrary(), h('div', { class: 'library' }, h('div', { class: 'boot' }, 'Loading case studies…')));
  let idx;
  try { idx = await loadIndex(); } catch (e) {
    $('.library', app).replaceChildren(h('div', { class: 'empty' }, e.message));
    return;
  }
  let q = '';
  let filter = 'all';
  const grid = h('div', { class: 'grid' });
  const draw = () => {
    const list = idx.caseStudies
      .filter((c) => filter === 'all' || (filter === 'listed' ? c.listed : !c.listed))
      .filter((c) => !q || (c.title + ' ' + c.client + ' ' + c.slug).toLowerCase().includes(q))
      .sort((a, b) => R.sortKey(a.title).localeCompare(R.sortKey(b.title)));
    grid.replaceChildren(
      h('button', { class: 'cs-card new-card', onclick: () => newCaseStudyModal() }, h('span', {}, h('span', { class: 'plus' }, '+'), 'New case study')),
      ...list.map((c) => h('button', { class: 'cs-card', onclick: () => { location.hash = '#/cs/' + c.slug; } },
        h('div', { class: 'thumb', style: { backgroundImage: c.thumb ? `url("${c.thumb}")` : '' } }),
        h('span', { class: 'tag' + (c.listed ? '' : ' hidden') }, c.listed ? (c.homepage ? 'Work + homepage' : 'On Work page') : 'Hidden'),
        h('div', { class: 'meta' }, h('b', {}, c.title || c.slug), h('span', {}, c.client || ' ')))),
    );
    if (!list.length && q) grid.append(h('div', { class: 'empty' }, `Nothing matches “${q}”.`));
  };
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Find a case study', 'aria-label': 'Find a case study', oninput: (e) => { q = e.target.value.trim().toLowerCase(); draw(); } });
  const filters = h('div', { class: 'filters', role: 'group', 'aria-label': 'Show' });
  [['all', 'All'], ['listed', 'On the Work page'], ['hidden', 'Hidden']].forEach(([k, label]) => {
    filters.append(h('button', { class: filter === k ? 'is-on' : '', 'aria-pressed': filter === k ? 'true' : 'false', onclick: (e) => { filter = k; $$('button', filters).forEach((b) => { b.classList.toggle('is-on', b === e.currentTarget); b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'); }); draw(); } }, label));
  });
  $('.library', app).replaceChildren(
    h('div', { class: 'library-head' },
      h('div', {}, h('h1', {}, 'Case studies'), h('p', {}, `${idx.caseStudies.length} pages. Open one to rearrange it, or start a new one.`)),
      h('div', { class: 'library-tools' }, search, h('button', { class: 'btn primary', onclick: () => newCaseStudyModal() }, 'New case study'))),
    filters, grid);
  draw();
}

function topbarLibrary() {
  return h('header', { class: 'topbar' },
    h('a', { class: 'logo-link', href: '/', target: '_blank', rel: 'noopener', title: 'Open the IHC site' }, logo()),
    h('div', { class: 'crumb' }, h('b', {}, 'Case study builder')),
    h('div', { class: 'spacer' }),
    h('a', { class: 'btn on-dark small desk-only', href: '/work', target: '_blank', rel: 'noopener' }, 'View the Work page'),
    h('button', { class: 'btn on-dark small', onclick: () => { session.set(''); S.key = ''; route(); } }, 'Sign out'));
}

/* ---------------- new case study ---------------- */
function blankCaseStudy(slug, title, client) {
  return {
    slug, pageId: R.newPageId(), title, seoTitle: title, description: '', noindex: false,
    client, subtitle: '', heroImage: null, heroVimeo: '', stats: [], services: [],
    headline: '', intro: '',
    introPieces: [TYPES.introGallery.make()],
    sections: [{ title: 'The idea', pieces: [TYPES.text.make(), TYPES.gallery.make()] }],
    listing: { listed: false, work: { summary: '', href: '/case-study/' + slug, month: '', year: '', bg: null }, home: defaultHome() },
  };
}
function defaultHome() {
  return { showHomepage: false, category: '', image: '', gif: '', vimeo: '', ip: '', award: false, awardTitle: '', awardLogo1: '', awardLogo2: '', video: '' };
}

async function newCaseStudyModal() {
  if (!S.index) await loadIndex();
  const taken = new Set(S.index.caseStudies.map((c) => c.slug));
  let slugEdited = false;
  const title = h('input', { class: 'input', required: true, placeholder: 'Deadpool & Wolverine', oninput: () => { if (!slugEdited) slug.value = R.slugify(title.value); check(); } });
  const client = h('input', { class: 'input', placeholder: 'Disney • Marvel Studios' });
  const slug = h('input', { class: 'input', required: true, pattern: '[a-z0-9]+(-[a-z0-9]+)*', oninput: () => { slugEdited = true; slug.value = R.slugify(slug.value); check(); } });
  const from = h('select', { class: 'select' }, h('option', { value: '' }, 'A blank page'),
    ...S.index.caseStudies.slice().sort((a, b) => a.title.localeCompare(b.title)).map((c) => h('option', { value: c.slug }, 'A copy of ' + c.title)));
  const note = h('small', {});
  const go = h('button', { class: 'btn primary', type: 'submit' }, 'Start building');
  function check() {
    const s = slug.value;
    const bad = !s ? 'Pick a link for the page.' : taken.has(s) ? 'That link is taken. Try another.' : '';
    note.textContent = bad || `Lives at /case-study/${s}`;
    note.style.color = bad ? 'var(--warn)' : '';
    go.disabled = !!bad || !title.value.trim();
  }
  const m = modal(h('form', {
    class: 'modal',
    onsubmit: async (e) => {
      e.preventDefault();
      go.disabled = true;
      let cs = blankCaseStudy(slug.value, title.value.trim(), client.value.trim());
      if (from.value) {
        try {
          const r = await readFiles([`content/case-studies/${from.value}.json`]);
          const src = JSON.parse(r.files[`content/case-studies/${from.value}.json`].text);
          cs = { ...cs, subtitle: '', stats: clone(src.stats || []), services: clone(src.services || []), headline: src.headline || '', intro: src.intro || '', introPieces: clone(src.introPieces || []), sections: clone(src.sections || []), heroImage: src.heroImage ? clone(src.heroImage) : null };
          cs.listing.home.category = (src.listing && src.listing.home && src.listing.home.category) || '';
        } catch (e2) { toast(e2.message, 'err'); }
      }
      m.close();
      startEditor(cs, { isNew: true, sha: null });
      location.hash = '#/cs/' + cs.slug;
    },
  },
  h('h2', {}, 'New case study'),
  h('label', { class: 'field' }, h('span', {}, 'Project name'), title),
  h('label', { class: 'field' }, h('span', {}, 'Client'), client),
  h('label', { class: 'field' }, h('span', {}, 'Page link'), slug, note),
  h('label', { class: 'field' }, h('span', {}, 'Start from'), from, h('small', {}, 'A copy keeps the sections, text and photos so you can swap in the new project.')),
  h('div', { class: 'actions' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => m.close() }, 'Cancel'), go)));
  check();
  title.focus();
}

function modal(content, { onClose } = {}) {
  const wrap = h('div', { class: 'modal-wrap', role: 'dialog', 'aria-modal': 'true' }, content);
  const close = () => { wrap.remove(); document.removeEventListener('keydown', esc); if (onClose) onClose(); };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', esc);
  document.body.append(wrap);
  return { el: wrap, close };
}

/* ---------------- open + editor ---------------- */
async function openCaseStudy(slug) {
  if (S.cs && S.slug === slug) return renderEditor();
  const app = $('#app');
  app.replaceChildren(topbarLibrary(), h('div', { class: 'library' }, h('div', { class: 'boot' }, 'Opening…')));
  try {
    const p = `content/case-studies/${slug}.json`;
    const r = await readFiles([p]);
    if (!r.files[p]) {
      const draft = store.get('ihc-draft:' + slug);
      if (draft && draft.data) return startEditor(draft.data, { isNew: true, sha: null });
      throw new Error(`There's no case study at /case-study/${slug}.`);
    }
    startEditor(JSON.parse(r.files[p].text), { isNew: false, sha: r.files[p].sha });
  } catch (e) {
    $('.library', app).replaceChildren(h('div', { class: 'empty' }, e.message, ' ', h('a', { href: '#/' }, 'Back to all case studies')));
  }
}

function normalize(cs) {
  cs.stats = cs.stats || [];
  cs.services = cs.services || [];
  cs.introPieces = cs.introPieces || [];
  cs.sections = cs.sections || [];
  cs.listing = cs.listing || { listed: false };
  cs.listing.work = cs.listing.work || { summary: '', href: '/case-study/' + cs.slug, month: '', year: '', bg: null };
  cs.listing.home = Object.assign(defaultHome(), cs.listing.home || {});
  const tag = (p) => {
    if (!p._id) p._id = uid();
    if (Array.isArray(p.media)) p.media.forEach((m) => { if (m && !m._id) m._id = uid(); });
  };
  cs.introPieces.forEach(tag);
  cs.sections.forEach((s) => { if (!s._id) s._id = uid(); (s.pieces = s.pieces || []).forEach(tag); });
  return cs;
}

function cleanForSave(cs) {
  const out = JSON.parse(JSON.stringify(cs, (k, v) => (k === '_id' || k === '_up' ? undefined : v)));
  // uploads still in flight only exist in this browser, so they never get saved
  const pending = (m) => m && typeof m.src === 'string' && m.src.startsWith('blob:');
  const tidy = (p) => {
    if (Array.isArray(p.media)) p.media = p.media.filter((m) => m && !pending(m));
    else if (pending(p.media)) p.media = null;
    if (Array.isArray(p.items)) p.items = p.items.map((m) => (pending(m) ? null : m));
  };
  out.introPieces.forEach(tidy);
  out.sections.forEach((s) => s.pieces.forEach(tidy));
  return out;
}

function startEditor(cs, { isNew, sha }) {
  S.cs = normalize(cs);
  S.slug = cs.slug;
  S.isNew = isNew;
  S.loadedSha = sha;
  S.history = []; S.future = [];
  S.publishedSnap = isNew ? '' : JSON.stringify(cleanForSave(S.cs));
  S.activeSection = 0;
  // a draft saved in this browser wins, so nothing typed is ever lost
  const draft = store.get('ihc-draft:' + cs.slug);
  S.draftNote = null;
  if (draft && draft.data && JSON.stringify(draft.data) !== S.publishedSnap) {
    S.cs = normalize(draft.data);
    S.isNew = isNew && !sha;
    S.draftNote = { savedAt: draft.savedAt, stale: !isNew && draft.baseSha && draft.baseSha !== sha };
  }
  S.lastSnap = JSON.stringify(S.cs);
  // sections start folded so the page reads as an outline; open the one you're working on
  S.collapsed = new Set(S.cs.sections.map((sec) => sec._id));
  renderEditor();
}

function isDirty() {
  return S.isNew || JSON.stringify(cleanForSave(S.cs)) !== S.publishedSnap;
}

let previewTimer = null;
function afterChange({ preview = true } = {}) {
  updateBar();
  saveDraft();
  if (preview) schedulePreview();
}
const saveDraft = debounce(() => {
  if (!S.cs) return;
  if (!isDirty()) { store.del('ihc-draft:' + S.slug); return; }
  store.set('ihc-draft:' + S.slug, { savedAt: new Date().toISOString(), baseSha: S.loadedSha, data: cleanForSave(S.cs) });
}, 600);

// structural change: snapshot for undo, then redraw
function commit({ redraw = true } = {}) {
  const now = JSON.stringify(S.cs);
  if (now !== S.lastSnap) {
    S.history.push(S.lastSnap);
    if (S.history.length > 120) S.history.shift();
    S.future = [];
    S.lastSnap = now;
  }
  if (redraw) renderCanvas();
  afterChange();
}
// typing: snapshot after a pause
const commitTyping = debounce(() => commit({ redraw: false }), 700);
function typed() {
  updateBar();
  saveDraft();
  schedulePreview();
  commitTyping();
}

function undo() {
  if (!S.history.length) return;
  S.future.push(JSON.stringify(S.cs));
  S.cs = normalize(JSON.parse(S.history.pop()));
  S.lastSnap = JSON.stringify(S.cs);
  renderCanvas(); afterChange();
}
function redo() {
  if (!S.future.length) return;
  S.history.push(JSON.stringify(S.cs));
  S.cs = normalize(JSON.parse(S.future.pop()));
  S.lastSnap = JSON.stringify(S.cs);
  renderCanvas(); afterChange();
}
document.addEventListener('keydown', (e) => {
  if (!S.cs || !(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
  if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return; // let fields undo their own typing
  e.preventDefault();
  if (e.shiftKey) redo(); else undo();
});
window.addEventListener('beforeunload', (e) => { if (S.uploads > 0) { e.preventDefault(); e.returnValue = ''; } });

/* ---------------- editor layout ---------------- */
async function renderEditor() {
  const app = $('#app');
  document.title = (S.cs.title || 'New case study') + ' · Builder';
  if (!S.template) {
    try { S.template = await (await fetch('/builder/case-study.template', { cache: 'no-cache' })).text(); } catch (e) { toast('Couldn’t load the page template, so the preview is off.', 'err'); }
  }
  if (!S.index) loadIndex().then(() => { if (S.cs) renderCanvas(); }).catch(() => {});
  const bar = h('header', { class: 'topbar' },
    h('a', { class: 'logo-link', href: '#/', title: 'All case studies', 'aria-label': 'All case studies' }, logo()),
    h('div', { class: 'crumb' }, h('b', { id: 'bar-title' }), h('span', { id: 'bar-link' })),
    h('div', { class: 'spacer' }),
    h('span', { class: 'state', id: 'bar-state' }),
    h('button', { class: 'icon-btn', id: 'bar-undo', title: 'Undo', 'aria-label': 'Undo', onclick: undo }, svg('undo')),
    h('button', { class: 'icon-btn', id: 'bar-redo', title: 'Redo', 'aria-label': 'Redo', onclick: redo }, svg('redo')),
    h('button', { class: 'btn on-dark small desk-only', onclick: openSettings }, 'Page settings'),
    h('button', { class: 'btn on-dark small desk-only' + (S.preview ? ' is-on' : ''), id: 'bar-preview', 'aria-pressed': S.preview ? 'true' : 'false', onclick: togglePreview }, 'Preview'),
    h('button', { class: 'btn primary small desk-only', id: 'bar-publish', onclick: publishFlow }, 'Publish'));
  const editor = h('div', { class: 'editor' + (S.preview ? ' with-preview' : '') },
    renderBin(),
    h('main', { class: 'canvas', id: 'canvas' }, h('div', { class: 'canvas-inner', id: 'canvas-inner' })),
    renderPreviewPane());
  // phones: everything you do a lot sits under your thumb
  const dock = h('nav', { class: 'dock', 'aria-label': 'Editor actions' },
    h('button', { class: 'dock-add', type: 'button', onclick: openAddSheet }, svg('plus'), h('span', {}, 'Add')),
    h('button', { type: 'button', onclick: togglePreview }, svg('eye'), h('span', {}, 'Preview')),
    h('button', { type: 'button', onclick: openSettings }, svg('gear'), h('span', {}, 'Settings')),
    h('button', { class: 'dock-publish', type: 'button', id: 'dock-publish', onclick: publishFlow }, svg('send'), h('span', {}, 'Publish')));
  app.replaceChildren(bar, editor, dock);
  renderCanvas();
  updateBar();
  if (S.preview) refreshPreview();
}

function updateBar() {
  if (!$('#bar-title')) return;
  $('#bar-title').textContent = S.cs.title || 'Untitled';
  $('#bar-link').textContent = '/case-study/' + S.cs.slug;
  const st = $('#bar-state');
  const dirty = isDirty();
  st.textContent = S.uploads ? `Uploading ${S.uploads}…` : S.isNew ? 'Not published yet' : dirty ? 'Unpublished changes' : 'Matches the live page';
  st.classList.toggle('dirty', dirty || S.uploads > 0);
  $('#bar-undo').disabled = !S.history.length;
  $('#bar-redo').disabled = !S.future.length;
  $('#bar-publish').disabled = S.uploads > 0;
  const dp = $('#dock-publish');
  if (dp) { dp.disabled = S.uploads > 0; dp.classList.toggle('has-changes', dirty); }
}

/* ---------------- parts bin ---------------- */
function brick(type) {
  const t = TYPES[type];
  return h('button', {
    class: 'brick', type: 'button', 'data-new-type': type,
    style: { '--c': t.color, '--t': t.ink ? '#16053a' : '#fff' },
  }, svg(t.icon), h('span', {}, h('b', {}, t.name), h('small', {}, t.hint)));
}

// Desktop: hovering or focusing a block in the bin shows a real render of it beside the bin
let peekEl = null;
function peek(b) {
  const type = b && b.dataset.newType;
  const t = TYPES[type];
  if (!t || !t.blurb || compact()) { unpeek(); return; }
  if (!peekEl) {
    peekEl = h('div', { class: 'peek', 'aria-hidden': 'true' }, h('div', { class: 'peek-img' }, h('img', { alt: '' })), h('b', {}), h('p', {}));
    document.body.append(peekEl);
  }
  const img = $('img', peekEl);
  if (img.dataset.type !== type) { img.dataset.type = type; img.src = previewSrc(type); }
  $('b', peekEl).textContent = t.name;
  $('p', peekEl).textContent = t.blurb;
  peekEl.style.setProperty('--c', t.color);
  const r = b.getBoundingClientRect();
  const bin = b.closest('.bin').getBoundingClientRect();
  const ph = 300;
  peekEl.style.left = Math.round(bin.right + 14) + 'px';
  peekEl.style.top = Math.round(Math.max(72, Math.min(window.innerHeight - ph - 12, r.top + r.height / 2 - 110))) + 'px';
  peekEl.classList.add('is-on');
}
function unpeek() { if (peekEl) peekEl.classList.remove('is-on'); }
let previewsWarm = false;
function warmPreviews() {
  if (previewsWarm) return;
  previewsWarm = true;
  PALETTE.concat('introGallery').forEach((t) => { const im = new Image(); im.decoding = 'async'; im.src = previewSrc(t); });
}

function renderBin() {
  const secBricks = h('div', { class: 'bricks', id: 'bin-sections' },
    h('button', { class: 'brick section-brick', type: 'button', 'data-new-type': 'section' },
      svg('section'), h('span', {}, h('b', {}, 'Section'), h('small', {}, 'A colored panel with a title'))));
  const lists = FAMILIES.map(([, types]) => h('div', { class: 'bricks' }, types.map(brick)));
  const introBricks = h('div', { class: 'bricks', id: 'bin-intro' }, brick('introGallery'));
  const bin = h('aside', { class: 'bin', 'aria-label': 'Blocks' },
    h('h2', {}, 'Blocks'),
    h('p', { class: 'hint' }, 'Drag a block onto the page, or click one to add it to the selected section. Hover to see what it looks like.'),
    h('h3', {}, 'Structure'), secBricks,
    FAMILIES.map(([label], i) => [h('h3', {}, label), lists[i]]),
    h('h3', {}, 'Intro only'), introBricks);
  bin.addEventListener('click', (e) => {
    const b = e.target.closest('.brick');
    if (!b) return;
    unpeek();
    if (b.dataset.newType === 'section') addSection(); else addPiece(b.dataset.newType);
  });
  bin.addEventListener('mouseover', (e) => { warmPreviews(); const b = e.target.closest('.brick'); if (b && !S.dragging) peek(b); });
  bin.addEventListener('mouseleave', unpeek);
  bin.addEventListener('focusin', (e) => { const b = e.target.closest('.brick'); if (b && b.matches(':focus-visible')) peek(b); });
  bin.addEventListener('focusout', unpeek);
  bin.addEventListener('scroll', unpeek, { passive: true });
  const opts = {
    sort: false, animation: 150, fallbackOnBody: true,
    onStart: () => { S.dragging = true; unpeek(); },
    onEnd: () => { S.dragging = false; syncFromDom(); },
  };
  Sortable.create(secBricks, { ...opts, group: { name: 'sections', pull: 'clone', put: false } });
  lists.concat(introBricks).forEach((el) => Sortable.create(el, { ...opts, group: { name: 'pieces', pull: 'clone', put: false } }));
  return bin;
}

function addPiece(type, target) {
  const p = TYPES[type].make();
  p._id = uid();
  let where;
  if (target === 'intro' && !TYPES[type].introOnly) {
    S.cs.introPieces.push(p); where = 'intro';
  } else if (typeof target === 'number' && S.cs.sections[target] && !TYPES[type].introOnly) {
    S.cs.sections[target].pieces.push(p);
    S.collapsed.delete(S.cs.sections[target]._id);
    S.activeSection = target; where = target;
  } else if (TYPES[type].introOnly || !S.cs.sections.length) {
    if (TYPES[type].introOnly) { S.cs.introPieces.push(p); where = 'intro'; } else { S.cs.sections.push({ _id: uid(), title: '', pieces: [p] }); where = 0; }
  } else {
    const i = Math.min(S.activeSection, S.cs.sections.length - 1);
    S.cs.sections[i].pieces.push(p);
    S.collapsed.delete(S.cs.sections[i]._id);
    where = i;
  }
  commit();
  flash(p._id);
  focusPreview(where);
}
// Phones: a sheet of blocks. Pick where it goes, tap a block.
function openAddSheet() {
  const opts = [['intro', 'The intro']].concat(S.cs.sections.map((sec, i) => [String(i), String(i + 1).padStart(2, '0') + ' ' + (sec.title || 'Untitled section')]));
  const active = String(Math.min(S.activeSection, Math.max(0, S.cs.sections.length - 1)));
  const where = h('select', { class: 'select', 'aria-label': 'Add it to' }, opts.map(([v, l]) => h('option', { value: v, selected: v === active }, l)));
  const card = (type) => {
    const t = TYPES[type];
    return h('button', { class: 'add-card', type: 'button', 'data-new-type': type, style: { '--c': t.color } },
      h('span', { class: 'add-card-img' }, h('img', { src: previewSrc(type), alt: '', loading: 'lazy', decoding: 'async', width: 640, height: 360 })),
      h('b', {}, svg(t.icon), t.name), h('small', {}, t.hint));
  };
  const group = (label, kids) => [h('h3', { class: 'sheet-h' }, label), h('div', { class: 'sheet-cards' }, kids)];
  const bricks = h('div', { class: 'sheet-bricks' },
    h('button', { class: 'brick section-brick', type: 'button', 'data-new-type': 'section' }, svg('section'), h('span', {}, h('b', {}, 'New section'), h('small', {}, 'A colored panel with a title'))),
    FAMILIES.map(([label, types]) => group(label, types.map(card))),
    group('Intro only', [card('introGallery')]));
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Add a block' },
    h('div', { class: 'sheet-grab', 'aria-hidden': 'true' }),
    h('div', { class: 'sheet-head' }, h('h2', {}, 'Add a block'), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close() }, svg('x'))),
    h('label', { class: 'field' }, h('span', {}, 'Add it to'), where),
    bricks);
  const scrim = h('div', { class: 'sheet-scrim' }, sheet);
  const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  bricks.addEventListener('click', (e) => {
    const b = e.target.closest('.brick, .add-card');
    if (!b) return;
    close();
    if (b.dataset.newType === 'section') addSection();
    else addPiece(b.dataset.newType, where.value === 'intro' ? 'intro' : +where.value);
  });
  document.addEventListener('keydown', onKey);
  document.body.append(scrim);
}

function addSection() {
  S.cs.sections.push({ _id: uid(), title: '', pieces: [] });
  S.activeSection = S.cs.sections.length - 1;
  commit();
  const card = $(`[data-sid="${S.cs.sections[S.activeSection]._id}"]`);
  if (card) { card.scrollIntoView({ block: 'center' }); $('.sec-title', card).focus(); }
}
function flash(pid) {
  const el = $(`[data-pid="${pid}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.animate([{ boxShadow: '0 0 0 4px #ffb728' }, { boxShadow: '0 0 0 0 #ffb728' }], { duration: 900 });
}

/* rebuild state order from the DOM after a drag */
function syncFromDom() {
  const pieces = new Map();
  S.cs.introPieces.forEach((p) => pieces.set(p._id, p));
  S.cs.sections.forEach((s) => s.pieces.forEach((p) => pieces.set(p._id, p)));
  const toPiece = (el) => {
    if (el.dataset.newType && TYPES[el.dataset.newType]) { const p = TYPES[el.dataset.newType].make(); p._id = uid(); return p; }
    return pieces.get(el.dataset.pid);
  };
  if ($$('.pieces > .section-card, .pieces > [data-new-type=section]').length) { renderCanvas(); return; }
  const intro = $('#intro-pieces');
  if (intro) S.cs.introPieces = [...intro.children].map(toPiece).filter(Boolean);
  const secs = new Map(S.cs.sections.map((s) => [s._id, s]));
  const list = $('#sections');
  if (list) {
    S.cs.sections = [...list.children].map((card) => {
      if (card.dataset.newType === 'section') return { _id: uid(), title: '', pieces: [] };
      const s = secs.get(card.dataset.sid);
      if (!s) return null;
      const pl = $('.pieces', card);
      s.pieces = pl ? [...pl.children].map(toPiece).filter(Boolean) : s.pieces;
      return s;
    }).filter(Boolean);
  }
  commit();
}

/* ---------------- canvas ---------------- */
function renderCanvas() {
  const inner = $('#canvas-inner');
  if (!inner) return;
  const canvas = $('#canvas');
  const top = canvas.scrollTop;
  const cs = S.cs;
  const kids = [];
  if (S.draftNote) {
    const when = new Date(S.draftNote.savedAt).toLocaleString();
    kids.push(h('div', { class: 'banner' },
      h('span', {}, S.draftNote.stale
        ? `You're looking at unpublished changes saved in this browser (${when}). Someone published this page after that, so publishing will replace their version.`
        : `You're looking at unpublished changes saved in this browser (${when}).`),
      S.isNew ? null : h('button', { class: 'btn small', onclick: discardDraft }, 'Discard them')));
  }
  kids.push(heroCard(cs), introCard(cs));
  const anyOpen = cs.sections.some((sec) => !S.collapsed.has(sec._id));
  kids.push(h('div', { class: 'zone-label' }, h('h2', {}, 'Sections'),
    h('p', {}, 'Each one opens and closes on the page. Drag the dots to reorder.'),
    cs.sections.length ? h('button', {
      class: 'btn small fold-all' + (anyOpen ? ' is-open' : ''), type: 'button', 'aria-label': anyOpen ? 'Collapse all sections' : 'Expand all sections',
      onclick: () => { cs.sections.forEach((sec) => { if (anyOpen) S.collapsed.add(sec._id); else S.collapsed.delete(sec._id); }); renderCanvas(); },
    }, svg('fold'), anyOpen ? 'Collapse all' : 'Expand all') : null));
  const secList = h('div', { class: 'sections', id: 'sections' }, cs.sections.map((s, i) => sectionCard(s, i)));
  kids.push(secList, h('button', { class: 'add-section', onclick: addSection }, '+ Add a section'));
  inner.replaceChildren(...kids);
  // drag and drop
  // sections fold flat while one is dragged, so reordering long pages stays easy
  Sortable.create(secList, {
    group: { name: 'sections' }, handle: '.sec-grip', animation: 160,
    onStart: () => secList.classList.add('is-sorting'),
    onEnd: () => { secList.classList.remove('is-sorting'); syncFromDom(); },
  });
  $$('.pieces', inner).forEach((el) => {
    const isIntro = el.id === 'intro-pieces';
    Sortable.create(el, {
      group: {
        name: 'pieces',
        // only pieces go in here (a put function would otherwise accept sections too); intro photos stay in the intro
        put: (to, from, drag) => from.options.group.name === 'pieces' && (isIntro || (drag.dataset.newType !== 'introGallery' && drag.dataset.type !== 'introGallery')),
      },
      handle: '.piece-grip, .brick', animation: 160, onEnd: syncFromDom,
    });
  });
  // photos move between galleries, grids and social rows; Vimeo clips stay in galleries, loops stay out of them, logos stay with logos
  const fits = (toGroup, drag) => {
    const k = drag.dataset.kind;
    if (toGroup === 'logos') return false;
    if (toGroup === 'photos') return k !== 'vimeo';
    return k !== 'loop';
  };
  $$('.tray', inner).forEach((el) => {
    const g = el.dataset.group || 'media';
    Sortable.create(el, {
      group: { name: g, pull: true, put: (to, from, drag) => { const fg = from.options.group.name; return fg === g || (fg !== 'pieces' && fg !== 'sections' && fits(g, drag)); } },
      filter: '.add', preventOnFilter: false, animation: 140, delay: 220, delayOnTouchOnly: true, onEnd: syncMedia,
      // the Add tile stays last: anything dropped on or past it goes just before it
      onMove: (e) => (e.related.classList.contains('add') ? -1 : true),
    });
  });
  canvas.scrollTop = top;
}

function syncMedia() {
  const owners = new Map();
  const all = new Map();
  const visit = (p) => { owners.set(p._id, p); if (Array.isArray(p.media)) p.media.forEach((m) => all.set(m._id, m)); };
  S.cs.introPieces.forEach(visit);
  S.cs.sections.forEach((s) => s.pieces.forEach(visit));
  $$('.tray').forEach((tray) => {
    const p = owners.get(tray.dataset.owner);
    if (p) p.media = $$('.tile[data-mid]', tray).map((t) => all.get(t.dataset.mid)).filter(Boolean);
  });
  commit();
}

function discardDraft() {
  store.del('ihc-draft:' + S.slug);
  S.draftNote = null;
  S.cs = null;
  openCaseStudy(S.slug);
}

/* ---- hero ---- */
function heroCard(cs) {
  const title = autoTitle(cs.title, 'Project name', 'Project name', (v) => { cs.title = v; typed(); }, 'title-input');
  const statsBox = h('div', { class: 'stats-edit' });
  const bubbleColors = ['#ff142d', '#004fff', '#4d25c8', '#1810a0'];
  for (let i = 0; i < 4; i++) {
    const s = cs.stats[i] || { value: '', label: '' };
    const set = (k) => (e) => {
      while (cs.stats.length <= i) cs.stats.push({ value: '', label: '' });
      cs.stats[i][k] = e.target.value;
      while (cs.stats.length && !cs.stats[cs.stats.length - 1].value && !cs.stats[cs.stats.length - 1].label) cs.stats.pop();
      typed();
    };
    statsBox.append(h('div', { class: 'stat-row' },
      h('input', { class: 'input', value: s.value, placeholder: ['300+', '12.2M', '78', '50'][i], 'aria-label': `Bubble ${i + 1} number`, oninput: set('value'), style: { borderColor: bubbleColors[i] } }),
      h('input', { class: 'input', value: s.label, placeholder: ['Fans', 'Social impressions', 'Videos', 'Talent'][i], 'aria-label': `Bubble ${i + 1} label`, oninput: set('label') })));
  }
  const vimeo = h('input', {
    class: 'input', value: cs.heroVimeo ? 'https://vimeo.com/' + cs.heroVimeo.replace('?h=', '/') : '', placeholder: 'https://vimeo.com/…',
    onchange: (e) => {
      const v = parseVimeo(e.target.value);
      cs.heroVimeo = v ? v.id + (v.hash ? '?h=' + v.hash : '') : '';
      if (e.target.value && !v) toast('That doesn’t look like a Vimeo link.', 'err');
      commit({ redraw: false });
    },
  });
  return h('section', { class: 'hero-card', 'aria-label': 'Hero', onfocusin: () => focusPreview('hero') },
    title,
    h('div', { class: 'row' },
      h('label', { class: 'field' }, h('span', {}, 'Client'), h('input', { class: 'input', value: cs.client, placeholder: 'Disney • Marvel Studios', oninput: (e) => { cs.client = e.target.value; typed(); } })),
      h('label', { class: 'field' }, h('span', {}, 'Line under the client (optional)'), h('input', { class: 'input', value: cs.subtitle, placeholder: 'Taste of Wakanda', oninput: (e) => { cs.subtitle = e.target.value; typed(); } }))),
    h('div', { class: 'hero-grid' },
      h('div', { class: 'field' }, h('span', {}, 'Hero photo'),
        mediaSlot({
          get: () => (cs.heroImage && cs.heroImage.src ? { type: 'image', src: cs.heroImage.src } : null),
          set: (m) => { cs.heroImage = m ? { src: m.src, srcset: m.srcset || '', sizes: m.srcset ? '100vw' : '' } : null; },
          kind: 'hero', label: 'Drop the hero photo', note: 'Landscape, at least 2000px wide',
        }),
        h('label', { class: 'field', style: { marginTop: '10px' } }, h('span', {}, 'Background video (optional)'), vimeo, h('small', {}, 'A Vimeo link plays behind the title instead of the photo.'))),
      h('div', { class: 'field' }, h('span', {}, 'Bubbles over the hero'), statsBox,
        h('span', { style: { marginTop: '8px' } }, 'Services'), servicesPicker(cs))));
}

// A one-line title field that wraps instead of cutting long titles off
function autoTitle(value, placeholder, label, onChange, cls) {
  const el = h('textarea', { class: cls, rows: 1, placeholder, 'aria-label': label, spellcheck: 'true' });
  el.value = value || '';
  const grow = () => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; };
  el.addEventListener('input', () => { el.value = el.value.replace(/\n/g, ' '); grow(); onChange(el.value); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.blur(); } });
  requestAnimationFrame(grow);
  new ResizeObserver(grow).observe(el);
  return el;
}

function servicesPicker(cs) {
  const box = h('div', { class: 'chips' });
  const known = () => {
    const k = (S.index ? S.index.services : []).slice();
    cs.services.forEach((s) => { if (!k.some((x) => x.slug === s.slug)) k.push(s); });
    return k;
  };
  const draw = () => {
    const unused = known().filter((s) => !cs.services.some((x) => x.slug === s.slug)).sort((a, b) => a.name.localeCompare(b.name));
    const pick = h('select', { class: 'chip add', 'aria-label': 'Add a service' },
      h('option', { value: '' }, '+ Add a service'),
      unused.map((s) => h('option', { value: s.slug }, s.name)),
      h('option', { value: '__new' }, 'Something new…'));
    pick.addEventListener('change', () => {
      if (pick.value === '__new') {
        const input = h('input', { class: 'input', placeholder: 'Service name', style: { width: '170px', minHeight: '28px', padding: '2px 10px' } });
        const done = () => {
          const name = input.value.trim();
          if (name && !cs.services.some((x) => x.slug === R.slugify(name))) { cs.services.push({ name, slug: R.slugify(name) }); commit({ redraw: false }); }
          draw();
        };
        input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); done(); } if (ev.key === 'Escape') draw(); });
        input.addEventListener('blur', done);
        pick.replaceWith(input); input.focus();
        return;
      }
      const s = unused.find((x) => x.slug === pick.value);
      if (s) { cs.services.push({ name: s.name, slug: s.slug }); draw(); commit({ redraw: false }); }
    });
    box.replaceChildren(...cs.services.map((s, i) => h('button', {
      type: 'button', class: 'chip is-on', title: 'Remove ' + s.name, 'aria-label': 'Remove ' + s.name,
      onclick: () => { cs.services.splice(i, 1); draw(); commit({ redraw: false }); },
    }, s.name, ' ×')), pick);
  };
  draw();
  return box;
}

/* ---- intro ---- */
function introCard(cs) {
  const list = h('div', { class: 'pieces', id: 'intro-pieces', 'data-empty': 'Drop intro photos or text here' }, cs.introPieces.map((p) => pieceCard(p, { intro: true })));
  return h('section', { class: 'intro-card', 'aria-label': 'Intro', onfocusin: () => focusPreview('intro') },
    h('div', { class: 'zone-label', style: { margin: 0 } }, h('h2', {}, 'Intro'), h('p', {}, 'The first thing under the hero.')),
    h('div', { class: 'field pill' }, h('span', {}, 'Quote pill (optional)'), rte(cs.headline, (v) => { cs.headline = v; typed(); }, { inline: true, bare: true, placeholder: 'A short quote in a blue pill' })),
    h('div', { class: 'field statement' }, h('span', {}, 'Big intro line'), rte(cs.intro, (v) => { cs.intro = v; typed(); }, { inline: true, bare: true, placeholder: 'What IHC made happen, in one or two lines' })),
    list);
}

/* ---- sections ---- */
function sectionCard(s, i) {
  const collapsed = S.collapsed.has(s._id);
  const tone = toneOf(s, i);
  const tones = h('div', { class: 'tone-row', role: 'group', 'aria-label': 'Section color', hidden: !S.toneOpen || S.toneOpen !== s._id },
    [[null, 'Auto', SECTION_COLORS[i % SECTION_COLORS.length]]].concat(TONES).map(([v, label, hex, light]) => h('button', {
      type: 'button', class: 'swatch' + (v ? '' : ' auto') + (light ? ' is-light' : ''), style: { '--sw': hex }, 'data-v': v || '',
      title: v ? label : 'Auto: follows the page’s color order', 'aria-label': v ? label : 'Auto color', 'aria-pressed': (s.tone || null) === v ? 'true' : 'false',
      onclick: () => {
        if (v) s.tone = v; else delete s.tone;
        const t = toneOf(s, i);
        card.style.setProperty('--sc', t[2]);
        card.classList.toggle('is-light', !!t[3]);
        if (s.tone) card.dataset.tone = s.tone; else delete card.dataset.tone;
        $$('.swatch', tones).forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === (v || '') ? 'true' : 'false'));
        commit({ redraw: false });
      },
    }, v ? null : 'A')));
  const toneBtn = h('button', {
    class: 'icon-btn', title: 'Section color', 'aria-label': 'Section color', 'aria-expanded': tones.hidden ? 'false' : 'true',
    onclick: () => { tones.hidden = !tones.hidden; toneBtn.setAttribute('aria-expanded', tones.hidden ? 'false' : 'true'); S.toneOpen = tones.hidden ? null : s._id; },
  }, svg('palette'));
  const card = h('section', {
    class: 'section-card' + (i === S.activeSection ? ' is-active' : '') + (collapsed ? ' is-collapsed' : '') + (tone[3] ? ' is-light' : ''),
    'data-sid': s._id, 'data-tone': s.tone || null, style: { '--sc': tone[2] },
    onfocusin: () => setActive(i), onmousedown: () => setActive(i),
  },
  h('div', { class: 'section-head' },
    h('span', { class: 'grip sec-grip', title: 'Drag to reorder', 'aria-hidden': 'true' }, svg('grip')),
    h('span', { class: 'num', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
    autoTitle(s.title, 'Section title', `Section ${i + 1} title`, (v) => { s.title = v; typed(); }, 'sec-title'),
    h('div', { class: 'tools' },
      collapsed ? h('span', { class: 'sec-count' }, s.pieces.length ? `${s.pieces.length} block${s.pieces.length === 1 ? '' : 's'}` : 'Empty') : null,
      toneBtn,
      h('button', { class: 'icon-btn', title: 'Move up', 'aria-label': 'Move section up', disabled: i === 0, onclick: () => moveSection(i, -1) }, svg('up')),
      h('button', { class: 'icon-btn', title: 'Move down', 'aria-label': 'Move section down', disabled: i === S.cs.sections.length - 1, onclick: () => moveSection(i, 1) }, svg('down')),
      h('button', { class: 'icon-btn', title: 'Duplicate', 'aria-label': 'Duplicate section', onclick: () => duplicateSection(i) }, svg('copy')),
      h('button', { class: 'icon-btn danger', title: 'Delete section', 'aria-label': 'Delete section', onclick: () => deleteSection(i) }, svg('trash')),
      h('button', { class: 'icon-btn', title: collapsed ? 'Expand' : 'Collapse', 'aria-label': collapsed ? 'Expand section' : 'Collapse section', 'aria-expanded': collapsed ? 'false' : 'true', onclick: () => { if (collapsed) S.collapsed.delete(s._id); else S.collapsed.add(s._id); renderCanvas(); } }, svg('fold')))),
  tones,
  h('div', { class: 'section-body' },
    h('div', { class: 'pieces', 'data-empty': 'Drag blocks in here' }, s.pieces.map((p) => pieceCard(p, { intro: false })))));
  return card;
}
function setActive(i) {
  if (S.activeSection === i) return;
  S.activeSection = i;
  $$('.section-card').forEach((c, j) => c.classList.toggle('is-active', j === i));
  focusPreview(i);
}
function moveSection(i, d) {
  const a = S.cs.sections;
  const j = i + d;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  S.activeSection = j;
  commit();
}
function duplicateSection(i) {
  const copy = reId(clone(S.cs.sections[i]));
  S.cs.sections.splice(i + 1, 0, copy);
  S.activeSection = i + 1;
  commit();
}
function deleteSection(i) {
  const s = S.cs.sections[i];
  S.cs.sections.splice(i, 1);
  S.activeSection = Math.max(0, Math.min(S.activeSection, S.cs.sections.length - 1));
  commit();
  undoToast(`Deleted “${s.title || 'Untitled section'}”.`);
}
function reId(o) {
  if (Array.isArray(o)) return o.map(reId);
  if (o && typeof o === 'object') { for (const k of Object.keys(o)) { if (k === '_id') o._id = uid(); else reId(o[k]); } }
  return o;
}
function undoToast(msg) {
  const t = toast(h('span', {}, msg, ' ', h('button', { class: 'btn small on-dark', onclick: () => { undo(); t.remove(); } }, 'Undo')), '', 6000);
}

/* ---- pieces ---- */
function locate(pid) {
  let at = S.cs.introPieces.findIndex((p) => p._id === pid);
  if (at >= 0) return { list: S.cs.introPieces, at };
  for (const s of S.cs.sections) { at = s.pieces.findIndex((p) => p._id === pid); if (at >= 0) return { list: s.pieces, at }; }
  return null;
}
function summary(p) {
  const strip = (x) => decodeHtml(String(x || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  switch (p.type) {
    case 'text': return strip(p.html);
    case 'text2': return strip(p.left);
    case 'gallery': case 'fullGallery': case 'introGallery': { const n = (p.media || []).length; return n ? `${n} item${n === 1 ? '' : 's'}` : 'Empty'; }
    case 'video': return p.title || (p.vimeo ? 'vimeo.com/' + p.vimeo : p.embed ? embedInfo(p.embed).title : 'No video yet');
    case 'stats': return (p.items || []).map((s) => s.value).filter(Boolean).join(' · ');
    case 'quote': return p.text;
    case 'grid': case 'social': { const n = (p.media || []).length; return n ? `${n} photo${n === 1 ? '' : 's'}` : 'Empty'; }
    case 'logos': { const n = (p.media || []).length; return p.title || (n ? `${n} logo${n === 1 ? '' : 's'}` : 'Empty'); }
    case 'image': return p.media && p.media.src ? (p.caption || (p.media.video ? 'Loop' : 'Photo')) : 'Empty';
    case 'duo': { const n = (p.items || []).filter((m) => m && m.src).length; return n === 2 ? '' : n ? 'One photo so far' : 'Empty'; }
    case 'split': return p.title || strip(p.html) || (p.media && p.media.src ? 'Photo, no text yet' : 'Empty');
    case 'compare': return [p.before, p.after].filter((m) => m && m.src).length === 2 ? `${p.beforeLabel || 'Before'} / ${p.afterLabel || 'After'}` : 'Needs two photos';
    case 'marquee': return p.text;
    case 'steps': { const n = (p.items || []).filter((x) => x.title || x.text).length; return n ? `${n} step${n === 1 ? '' : 's'}` : 'Empty'; }
    case 'credits': return (p.items || []).map((c) => c.name).filter(Boolean).join(', ');
    default: return '';
  }
}

function pieceCard(p, ctx) {
  const t = TYPES[p.type] || TYPES.raw;
  const collapsed = S.collapsed.has(p._id);
  const loc = () => locate(p._id);
  const move = (d) => {
    const l = loc(); if (!l) return;
    const j = l.at + d;
    if (j < 0 || j >= l.list.length) return;
    [l.list[l.at], l.list[j]] = [l.list[j], l.list[l.at]];
    commit(); flash(p._id);
  };
  const card = h('article', { class: 'piece' + (collapsed ? ' is-collapsed' : ''), 'data-pid': p._id, 'data-type': p.type, style: { '--pc': t.color } },
    h('div', { class: 'piece-head' },
      h('span', { class: 'grip piece-grip', title: 'Drag to move', 'aria-hidden': 'true' }, svg('grip')),
      h('div', { class: 'what' }, svg(t.icon), h('span', {}, t.name), h('em', {}, summary(p))),
      h('button', { class: 'icon-btn', title: 'Move up', 'aria-label': 'Move up', onclick: () => move(-1) }, svg('up')),
      h('button', { class: 'icon-btn', title: 'Move down', 'aria-label': 'Move down', onclick: () => move(1) }, svg('down')),
      h('button', { class: 'icon-btn', title: 'Duplicate', 'aria-label': 'Duplicate', onclick: () => { const l = loc(); l.list.splice(l.at + 1, 0, reId(clone(p))); commit(); } }, svg('copy')),
      h('button', { class: 'icon-btn danger', title: 'Delete', 'aria-label': 'Delete', onclick: () => { const l = loc(); l.list.splice(l.at, 1); commit(); undoToast(`Deleted the ${t.name.toLowerCase()} block.`); } }, svg('trash')),
      h('button', { class: 'icon-btn', title: collapsed ? 'Expand' : 'Collapse', 'aria-label': collapsed ? 'Expand' : 'Collapse', 'aria-expanded': collapsed ? 'false' : 'true', onclick: () => { if (collapsed) S.collapsed.delete(p._id); else S.collapsed.add(p._id); renderCanvas(); } }, svg('fold'))),
    h('div', { class: 'piece-body' }, collapsed ? null : (EDIT[p.type] || EDIT.raw)(p, ctx)));
  return card;
}

const EDIT = {
  text: (p) => rte(p.html, (v) => { p.html = v; typed(); }, { placeholder: 'Write about this part of the project' }),
  text2: (p) => h('div', { class: 'row' },
    rte(p.left, (v) => { p.left = v; typed(); }, { placeholder: 'Left column' }),
    rte(p.right, (v) => { p.right = v; typed(); }, { placeholder: 'Right column' })),
  gallery: (p) => mediaTray(p, { note: 'Photos and Vimeo clips, shown one at a time with thumbnails underneath.' }),
  fullGallery: (p) => mediaTray(p, { note: 'Shown big and edge to edge. Landscape photos work best.' }),
  introGallery: (p) => h('div', { class: 'row' },
    mediaTray(p, { note: 'Sits on the left, next to the text.' }),
    rte(p.html, (v) => { p.html = v; typed(); }, { placeholder: 'The short story of the project' })),
  video: (p) => videoEditor(p),
  image: (p) => h('div', { class: 'piece-fields', style: { display: 'grid', gap: '12px' } },
    mediaSlot({ get: () => p.media, set: (m) => { p.media = m; }, kind: 'big', video: true, label: 'Drop a photo or a short MP4 loop', note: 'Photos are resized and compressed for you. Keep loops short and under 20 MB.' }),
    h('div', { class: 'row' },
      h('div', { class: 'field' }, h('span', {}, 'Width'), seg([['contained', 'Same as the text'], ['full', 'Edge to edge']], p.size || 'contained', (v) => { p.size = v; commit({ redraw: false }); })),
      h('label', { class: 'field' }, h('span', {}, 'Caption (optional)'), h('input', { class: 'input', value: p.caption || '', oninput: (e) => { p.caption = e.target.value; typed(); } })))),
  duo: (p) => {
    p.items = p.items || [null, null];
    const slot = (i) => h('div', { class: 'field' },
      mediaSlot({ get: () => p.items[i], set: (m) => { p.items[i] = m ? Object.assign(m, { caption: (p.items[i] && p.items[i].caption) || '' }) : null; }, kind: 'duo', video: true, label: i ? 'Right photo' : 'Left photo' }),
      h('input', { class: 'input', placeholder: 'Caption (optional)', value: (p.items[i] && p.items[i].caption) || '', oninput: (e) => { if (p.items[i]) { p.items[i].caption = e.target.value; typed(); } } }));
    return h('div', { style: { display: 'grid', gap: '12px' } },
      h('div', { class: 'duo-slots' }, slot(0), slot(1)),
      h('div', { class: 'field' }, h('span', {}, 'Shape'), seg([['natural', 'As shot'], ['portrait', 'Tall'], ['square', 'Square'], ['landscape', 'Wide']], p.ratio || 'natural', (v) => { p.ratio = v; commit({ redraw: false }); })));
  },
  stats: (p) => {
    p.items = p.items || [];
    const box = h('div', { style: { display: 'grid', gap: '8px' } });
    const draw = () => {
      box.replaceChildren(...p.items.map((s, i) => h('div', { class: 'stat-edit-row' },
        h('input', { class: 'input', value: s.value, placeholder: '12.2M', 'aria-label': `Stat ${i + 1} number`, oninput: (e) => { s.value = e.target.value; typed(); } }),
        h('input', { class: 'input', value: s.label, placeholder: 'Social impressions', 'aria-label': `Stat ${i + 1} label`, oninput: (e) => { s.label = e.target.value; typed(); } }),
        h('button', { class: 'icon-btn danger', title: 'Remove', 'aria-label': 'Remove stat', onclick: () => { p.items.splice(i, 1); draw(); commit({ redraw: false }); } }, svg('x')))),
      p.items.length < 4 ? h('div', {}, h('button', { class: 'btn small', onclick: () => { p.items.push({ value: '', label: '' }); draw(); commit({ redraw: false }); } }, '+ Add a number')) : null);
    };
    draw();
    return box;
  },
  quote: (p) => h('div', { style: { display: 'grid', gap: '10px' } },
    h('label', { class: 'field' }, h('span', {}, 'Quote'), h('textarea', { class: 'textarea', rows: 3, placeholder: 'I think Black Panther would be satisfied…', oninput: (e) => { p.text = e.target.value; typed(); } }, p.text || '')),
    h('label', { class: 'field' }, h('span', {}, 'Who said it'), h('input', { class: 'input', value: p.who || '', placeholder: 'Name, role', oninput: (e) => { p.who = e.target.value; typed(); } }))),
  grid: (p) => h('div', { class: 'stack' },
    mediaTray(p, { group: 'photos', video: true, vimeo: false, max: 12, note: 'Photos and short MP4 loops, up to 12.' }),
    h('div', { class: 'field' }, h('span', {}, 'Layout'),
      seg([['three', 'Three across'], ['four', 'Four across'], ['mosaic', 'Mosaic']], p.layout || 'three', (v) => { p.layout = v; commit({ redraw: false }); }),
      h('small', {}, 'Mosaic makes one photo in every five big, so it fills up neatly with 5 or 10.'))),
  split: (p) => {
    const box = h('div', { class: 'split-edit' + (p.side === 'right' ? ' v--right' : '') },
      mediaSlot({ get: () => p.media, set: (m) => { p.media = m; }, kind: 'duo', video: true, label: 'Drop a photo or a short MP4 loop' }),
      h('div', { class: 'stack' },
        h('label', { class: 'field' }, h('span', {}, 'Headline (optional)'), h('input', { class: 'input', value: p.title || '', placeholder: 'Built in six weeks', oninput: (e) => { p.title = e.target.value; typed(); } })),
        rte(p.html, (v) => { p.html = v; typed(); }, { placeholder: 'What happened here' })));
    return h('div', { class: 'stack' }, box,
      h('div', { class: 'row' },
        h('div', { class: 'field' }, h('span', {}, 'Photo goes on the'), seg([['left', 'Left'], ['right', 'Right']], p.side || 'left', (v) => { p.side = v; box.classList.toggle('v--right', v === 'right'); commit({ redraw: false }); })),
        h('label', { class: 'field' }, h('span', {}, 'Caption (optional)'), h('input', { class: 'input', value: p.caption || '', oninput: (e) => { p.caption = e.target.value; typed(); } }))));
  },
  compare: (p) => {
    const side = (key, labelKey, label, ph) => h('div', { class: 'field' },
      mediaSlot({ get: () => p[key], set: (m) => { p[key] = m; }, kind: 'big', label }),
      h('input', { class: 'input', value: p[labelKey] || '', placeholder: ph, 'aria-label': label + ' label', oninput: (e) => { p[labelKey] = e.target.value; typed(); } }));
    return h('div', { class: 'stack' },
      h('div', { class: 'duo-slots' }, side('before', 'beforeLabel', 'Before photo', 'Render'), side('after', 'afterLabel', 'After photo', 'Built')),
      h('small', { class: 'note' }, 'Shoot both from the same spot at the same size so the slider lines up. The after photo sets the shape.'));
  },
  social: (p) => mediaTray(p, { group: 'photos', video: true, vimeo: false, max: 8, note: 'Vertical photos and MP4 loops, up to 8. Saved Reels and TikToks work.' }),
  marquee: (p) => h('div', { class: 'stack' },
    h('label', { class: 'field' }, h('span', {}, 'Words'), h('input', { class: 'input', value: p.text || '', maxlength: 80, placeholder: 'Sold out in four hours', oninput: (e) => { p.text = e.target.value; typed(); } }), h('small', {}, 'Short is better. It repeats across the screen.')),
    h('div', { class: 'row' },
      h('div', { class: 'field' }, h('span', {}, 'Style'), seg([['outline', 'Outline'], ['solid', 'Solid']], p.style || 'outline', (v) => { p.style = v; commit({ redraw: false }); })),
      h('div', { class: 'field' }, h('span', {}, 'Speed'), seg([['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']], p.speed || 'normal', (v) => { p.speed = v; commit({ redraw: false }); })))),
  steps: (p) => rows(p, {
    max: 8, blank: () => ({ title: '', text: '' }), add: '+ Add a step',
    row: (x, i) => h('div', { class: 'step-edit-row' },
      h('span', { class: 'n', 'aria-hidden': 'true' }, String(i + 1).padStart(2, '0')),
      h('div', { class: 'stack tight' },
        h('input', { class: 'input', value: x.title, placeholder: ['Scout the space', 'Build the set', 'Open the doors'][i] || 'Step title', 'aria-label': `Step ${i + 1} title`, oninput: (e) => { x.title = e.target.value; typed(); } }),
        h('textarea', { class: 'textarea', rows: 2, placeholder: 'A sentence or two', 'aria-label': `Step ${i + 1} text`, oninput: (e) => { x.text = e.target.value; typed(); } }, x.text || ''))),
  }),
  credits: (p) => rows(p, {
    max: 24, blank: () => ({ role: '', name: '' }), add: '+ Add a credit',
    row: (x, i) => h('div', { class: 'credit-edit-row' },
      h('input', { class: 'input', value: x.role, placeholder: ['Client', 'Agency', 'Fabrication', 'Photography'][i % 4], 'aria-label': `Credit ${i + 1} role`, oninput: (e) => { x.role = e.target.value; typed(); } }),
      h('input', { class: 'input', value: x.name, placeholder: 'Name', 'aria-label': `Credit ${i + 1} name`, oninput: (e) => { x.name = e.target.value; typed(); } })),
  }),
  logos: (p) => h('div', { class: 'stack' },
    h('label', { class: 'field' }, h('span', {}, 'Heading (optional)'), h('input', { class: 'input', value: p.title || '', placeholder: 'As seen in', oninput: (e) => { p.title = e.target.value; typed(); } })),
    mediaTray(p, { group: 'logos', kind: 'logo', vimeo: false, add: 'Add logos', max: 24, note: 'SVG, or PNG with a see-through background.' }),
    h('div', { class: 'field' }, h('span', {}, 'Color'),
      seg([['mono', 'All white'], ['original', 'Original colors']], p.tint || 'mono', (v) => { p.tint = v; commit({ redraw: false }); }),
      h('small', {}, 'All white makes a mixed set look tidy. On light section colors they turn dark instead.'))),
  raw: (p) => h('label', { class: 'field' }, h('span', {}, 'HTML'), h('textarea', { class: 'textarea', rows: 6, oninput: (e) => { p.html = e.target.value; typed(); } }, p.html || '')),
};

// a list of small rows (steps, credits) with add and remove
function rows(p, { max, blank, add, row }) {
  p.items = p.items || [];
  const box = h('div', { class: 'stack tight' });
  const draw = () => {
    box.replaceChildren(...p.items.map((x, i) => h('div', { class: 'rows-row' }, row(x, i),
      h('button', { class: 'icon-btn danger', title: 'Remove', 'aria-label': 'Remove row', onclick: () => { p.items.splice(i, 1); draw(); commit({ redraw: false }); } }, svg('x')))),
    p.items.length < max ? h('div', {}, h('button', { class: 'btn small', onclick: () => { p.items.push(blank()); draw(); commit({ redraw: false }); const last = $$('.rows-row', box).pop(); if (last) $('input', last).focus(); } }, add)) : null);
  };
  draw();
  return box;
}

function seg(options, value, onPick) {
  const box = h('div', { class: 'seg', role: 'group' });
  options.forEach(([v, label]) => box.append(h('button', {
    type: 'button', class: v === value ? 'is-on' : '', 'aria-pressed': v === value ? 'true' : 'false',
    onclick: (e) => { $$('button', box).forEach((b) => { b.classList.toggle('is-on', b === e.currentTarget); b.setAttribute('aria-pressed', b === e.currentTarget ? 'true' : 'false'); }); onPick(v); },
  }, label)));
  return box;
}

/* ---------------- rich text ---------------- */
const KEEP = new Set(['P', 'BR', 'STRONG', 'EM', 'A', 'UL', 'OL', 'LI', 'SUP', 'SUB', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'FIGURE', 'FIGCAPTION', 'IMG', 'DIV']);
const STRICT = new Set(['P', 'BR', 'STRONG', 'EM', 'A', 'UL', 'OL', 'LI']);
const INLINE = new Set(['BR', 'STRONG', 'EM', 'A', 'SUP', 'SUB']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'META', 'LINK', 'TITLE', 'SVG', 'NOSCRIPT', 'TEMPLATE', 'FORM', 'INPUT', 'BUTTON']);
const RENAME = { B: 'STRONG', I: 'EM' };
function sanitize(html, { inline = false, strict = false } = {}) {
  const doc = new DOMParser().parseFromString('<body>' + (html || ''), 'text/html');
  const out = document.createElement('div');
  const walk = (node, into) => {
    for (const c of [...node.childNodes]) {
      if (c.nodeType === 3) { into.append(c.textContent); continue; }
      if (c.nodeType !== 1) continue;
      const tag = RENAME[c.tagName] || c.tagName;
      if (DROP.has(tag)) continue;
      const style = c.getAttribute('style') || '';
      const ok = KEEP.has(tag) && (!strict || STRICT.has(tag)) && (!inline || INLINE.has(tag)) && !(tag === 'STRONG' && /font-weight:\s*(normal|[1-4]00)/.test(style));
      if (!ok) {
        walk(c, into);
        if (inline && /^(P|DIV|LI|H\d)$/.test(tag) && c.nextElementSibling) into.append(document.createElement('br'));
        continue;
      }
      const el = document.createElement(tag);
      if (tag === 'A') {
        const href = c.getAttribute('href') || '';
        if (/^(https?:|mailto:|\/|#)/i.test(href)) el.setAttribute('href', href);
        if (c.getAttribute('target') === '_blank') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
      } else if (tag === 'IMG') {
        const src = c.getAttribute('src') || '';
        if (!/^(https?:|\/)/i.test(src)) continue;
        el.setAttribute('src', src); el.setAttribute('alt', c.getAttribute('alt') || ''); el.setAttribute('loading', 'lazy');
      } else if ((tag === 'FIGURE' || tag === 'DIV') && c.className) {
        const cls = String(c.className).split(/\s+/).filter((x) => /^w-richtext/.test(x)).join(' ');
        if (cls) el.className = cls;
      }
      walk(c, el);
      into.append(el);
    }
  };
  walk(doc.body, out);
  let s = out.innerHTML.replace(/<p>(\s|&nbsp;|<br>)*<\/p>/g, '').trim();
  if (!out.textContent.trim() && !out.querySelector('img')) s = '';
  return s;
}

function rte(html, onChange, { inline = false, placeholder = '', bare = false } = {}) {
  const area = h('div', { class: 'rte-area', contenteditable: 'true', role: 'textbox', 'aria-multiline': inline ? 'false' : 'true', 'aria-label': placeholder, 'data-placeholder': placeholder, spellcheck: 'true' });
  area.innerHTML = html || '';
  let touched = false;
  const emit = () => { touched = true; onChange(sanitize(area.innerHTML, { inline })); };
  const cmd = (c, v) => { area.focus(); document.execCommand(c, false, v); emit(); };
  const linkRow = h('div', { class: 'vimeo-add', style: { padding: '6px', display: 'none' } });
  const btn = (label, title, fn) => h('button', { type: 'button', title, 'aria-label': title, onmousedown: (e) => e.preventDefault(), onclick: fn }, label);
  let saved = null;
  const linkInput = h('input', { class: 'input', placeholder: 'https://…', 'aria-label': 'Link address' });
  const applyLink = () => {
    const url = linkInput.value.trim();
    linkRow.style.display = 'none';
    if (saved) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(saved); }
    if (url) cmd('createLink', /^(https?:|mailto:|\/)/.test(url) ? url : 'https://' + url); else cmd('unlink');
  };
  linkInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } if (e.key === 'Escape') { linkRow.style.display = 'none'; area.focus(); } });
  linkRow.append(linkInput, h('button', { type: 'button', class: 'btn small', onclick: applyLink }, 'Link'));
  const bar = h('div', { class: 'rte-bar' },
    btn(h('b', {}, 'B'), 'Bold', () => cmd('bold')),
    btn(h('i', {}, 'I'), 'Italic', () => cmd('italic')),
    btn('Link', 'Add a link', () => {
      const sel = getSelection();
      saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
      const a = sel.anchorNode && sel.anchorNode.parentElement && sel.anchorNode.parentElement.closest('a');
      linkInput.value = a ? a.getAttribute('href') : '';
      linkRow.style.display = 'flex'; linkInput.focus();
    }),
    inline ? null : btn('• List', 'Bulleted list', () => cmd('insertUnorderedList')),
    btn('Clear', 'Remove formatting', () => { cmd('removeFormat'); cmd('unlink'); }));
  area.addEventListener('input', emit);
  area.addEventListener('keydown', (e) => {
    if (inline && e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); emit(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $$('button', bar)[2].click(); }
  });
  area.addEventListener('paste', (e) => {
    e.preventDefault();
    const htmlData = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    let ins;
    if (htmlData) ins = sanitize(htmlData, { inline, strict: true });
    else ins = inline ? R.esc(text).replace(/\n/g, '<br>') : text.split(/\n{2,}/).map((t) => '<p>' + R.esc(t).replace(/\n/g, '<br>') + '</p>').join('');
    document.execCommand('insertHTML', false, ins);
    emit();
  });
  area.addEventListener('blur', () => {
    if (!touched) return;
    if (!area.textContent.trim() && !area.querySelector('img')) area.innerHTML = '';
  });
  return h('div', { class: 'rte' + (inline ? ' inline' : '') + (bare ? ' bare' : '') }, bar, linkRow, area);
}

/* ---------------- media ---------------- */
function parseVimeo(s) {
  s = String(s || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{5,})(?:[/?](?:h=)?([0-9a-f]{6,}))?$/i);
  if (!m) m = s.match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/|showcase\/\d+\/video\/)?(\d{5,})(?:\/([0-9a-f]{6,}))?/i);
  if (!m) return null;
  const h2 = (s.match(/[?&]h=([0-9a-f]+)/i) || [])[1];
  return { id: m[1], hash: m[2] || h2 || '' };
}
async function vimeoInfo(v) {
  const url = 'https://vimeo.com/' + v.id + (v.hash ? '/' + v.hash : '');
  try {
    const r = await fetch('https://vimeo.com/api/oembed.json?width=1280&url=' + encodeURIComponent(url));
    if (!r.ok) throw new Error();
    const j = await r.json();
    return { type: 'video', vimeo: v.id, hash: v.hash, w: j.width || 1920, h: j.height || 1080, title: j.title || '', thumb: j.thumbnail_url || '' };
  } catch (e) {
    toast('Vimeo didn’t share details for that video. It will still play if embedding is allowed.', '', 6000);
    return { type: 'video', vimeo: v.id, hash: v.hash, w: 1920, h: 1080, title: '', thumb: '' };
  }
}
function embedInfo(embed) {
  const src = (String(embed).match(/src="([^"]+)"/) || [])[1] || '';
  const u = src.replace(/&amp;/g, '&');
  const q = u.includes('?') ? new URLSearchParams(u.split('?')[1]) : new URLSearchParams();
  const title = decodeHtml((String(embed).match(/title="([^"]*)"/) || [])[1] || '');
  const link = q.get('url') || (u.includes('player.vimeo.com') ? u : '');
  const v = parseVimeo(link || q.get('src') || '');
  return { thumb: q.get('image') || '', title: title || (v ? 'vimeo.com/' + v.id : 'Video'), link: v ? 'https://vimeo.com/' + v.id + (v.hash ? '/' + v.hash : '') : '' };
}
function mediaThumb(m) {
  if (!m) return '';
  if (m.type === 'video') return m.thumb || (m.embed ? embedInfo(m.embed).thumb : '');
  return m.poster || m.src;
}

async function compressImage(file, maxW, quality = 0.82) {
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {
    src = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('Couldn’t read ' + file.name)); im.src = URL.createObjectURL(file); });
  }
  const sw = src.width || src.naturalWidth;
  const sh = src.height || src.naturalHeight;
  const scale = Math.min(1, maxW / sw);
  const w = Math.round(sw * scale);
  const hh = Math.round(sh * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = hh;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, hh);
  let blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', quality));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
  return { blob, w, h: hh };
}
async function videoPoster(file) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.src = URL.createObjectURL(file);
  await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('Couldn’t read that video.')); });
  await new Promise((ok) => { v.onseeked = ok; v.currentTime = Math.min(0.1, (v.duration || 1) / 2); });
  const scale = Math.min(1, 1600 / v.videoWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.8));
  URL.revokeObjectURL(v.src);
  return { blob, w: c.width, h: c.height };
}
function baseName(name, ext) {
  return (R.slugify(String(name).replace(/\.[a-z0-9]+$/i, '')) || 'file').slice(0, 60) + '.' + ext;
}
let blobClient = null;
const DIRECT_MAX = 4.3 * 1024 * 1024;
// Small files (every compressed photo) go through /api/builder/upload. Bigger ones, like video
// loops, go straight to Blob storage from the browser when the store's read-write token is set.
function uploadDirect(path, blob, onProgress) {
  return new Promise((ok, no) => {
    const x = new XMLHttpRequest();
    x.open('POST', '/api/builder/upload?name=' + encodeURIComponent(path));
    x.setRequestHeader('x-builder-key', S.key);
    x.setRequestHeader('x-content-type', blob.type);
    x.setRequestHeader('content-type', 'application/octet-stream');
    x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => {
      let d = {};
      try { d = JSON.parse(x.responseText); } catch (e) { /* ignore */ }
      if (x.status >= 200 && x.status < 300 && d.url) ok(d.url);
      else no(new Error(d.error || `Upload failed (${x.status}).`));
    };
    x.onerror = () => no(new Error('Upload failed. Check your connection and try again.'));
    x.send(blob);
  });
}
async function uploadBlob(blob, name, onProgress) {
  const path = `case-studies/${S.cs.slug}/${name}`;
  if (S.local) {
    const r = await fetch('/api/builder/dev-upload?name=' + encodeURIComponent(path), { method: 'POST', headers: { 'x-builder-key': S.key, 'content-type': blob.type }, body: blob });
    if (!r.ok) throw new Error('Upload failed');
    onProgress && onProgress(100);
    return (await r.json()).url;
  }
  if (blob.size <= DIRECT_MAX) return uploadDirect(path, blob, onProgress);
  if (!S.bigUploads) throw new Error(`That file is ${(blob.size / 1048576).toFixed(1)} MB. Files over 4 MB need the Blob read-write token set in Vercel (see the README), or put the clip on Vimeo.`);
  if (!blobClient) blobClient = await import('/builder/vendor/blob-client.2.8.2.js');
  const r = await blobClient.upload(path, blob, {
    access: 'public', handleUploadUrl: '/api/builder/upload', clientPayload: JSON.stringify({ key: S.key }),
    contentType: blob.type, multipart: blob.size > 8 * 1024 * 1024,
    onUploadProgress: (e) => onProgress && onProgress(e.percentage),
  });
  return r.url;
}

const SIZES = { gallery: 2000, big: 2400, duo: 1600, hero: 2400, bubble: 800, bg: 1600, logo: 400 };
// Turns a dropped file into a media item: { type: 'image', src, w, h } or a loop { type:'image', src: poster, video, w, h }
async function processFile(file, kind, { video = false, raw = false } = {}, onProgress) {
  const isVideo = /^video\/(mp4|webm|quicktime)$/.test(file.type);
  const isImage = /^image\//.test(file.type);
  if (isVideo && !video) throw new Error(`${file.name}: videos go in as Vimeo links here, or use a Big image or Two-up block for a short loop.`);
  if (!isVideo && !isImage) throw new Error(`${file.name} isn’t a photo or video.`);
  if (isVideo) {
    if (file.type === 'video/quicktime') throw new Error(`${file.name} is a .mov. Export it as MP4 first.`);
    if (file.size > 40 * 1024 * 1024) throw new Error(`${file.name} is ${(file.size / 1048576).toFixed(0)} MB. Compress it under 40 MB first (HandBrake does this well).`);
    const poster = await videoPoster(file);
    const [pUrl, vUrl] = await Promise.all([
      uploadBlob(poster.blob, baseName(file.name, 'webp'), null),
      uploadBlob(file, baseName(file.name, file.type === 'video/webm' ? 'webm' : 'mp4'), onProgress),
    ]);
    if (file.size > 20 * 1024 * 1024) toast(`${file.name} is over 20 MB. It’ll work, but a smaller file loads faster.`, '', 7000);
    return { type: 'image', src: pUrl, video: vUrl, w: poster.w, h: poster.h, alt: '' };
  }
  if (raw || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    if (file.size > 6 * 1024 * 1024) toast(`${file.name} is ${(file.size / 1048576).toFixed(1)} MB, which is heavy for the homepage.`, '', 7000);
    const ext = file.type === 'image/gif' ? 'gif' : file.type === 'image/svg+xml' ? 'svg' : file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg';
    return { type: 'image', src: await uploadBlob(file, baseName(file.name, ext), onProgress), alt: '' };
  }
  const max = SIZES[kind] || 2000;
  const big = await compressImage(file, max);
  const ext = big.blob.type === 'image/webp' ? 'webp' : 'jpg';
  if (kind === 'hero' && big.w > 1300) {
    const small = await compressImage(file, 1200);
    const [bigUrl, smallUrl] = await Promise.all([uploadBlob(big.blob, baseName(file.name, ext), onProgress), uploadBlob(small.blob, baseName(file.name + '-1200', ext), null)]);
    return { type: 'image', src: bigUrl, srcset: `${smallUrl} 1200w, ${bigUrl} ${big.w}w`, w: big.w, h: big.h, alt: '' };
  }
  return { type: 'image', src: await uploadBlob(big.blob, baseName(file.name, ext), onProgress), w: big.w, h: big.h, alt: '' };
}

function pickFiles({ multiple = false, accept = 'image/*' } = {}) {
  return new Promise((ok) => {
    const inp = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    inp.addEventListener('change', () => { ok([...inp.files]); inp.remove(); });
    document.body.append(inp);
    inp.click();
  });
}
function dropTarget(el, onFiles) {
  el.addEventListener('dragover', (e) => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); el.classList.add('drop-ok'); } });
  el.addEventListener('dragleave', () => el.classList.remove('drop-ok'));
  el.addEventListener('drop', (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault(); el.classList.remove('drop-ok');
    onFiles([...e.dataTransfer.files]);
  });
}

function startUpload() { S.uploads++; updateBar(); }
function endUpload() { S.uploads = Math.max(0, S.uploads - 1); updateBar(); }

// gallery tray: many images and Vimeo clips, sortable, shared between galleries
// group: 'media' (galleries: photos + Vimeo), 'photos' (grid, social: photos + MP4 loops), 'logos'
function mediaTray(p, { note, group = 'media', kind = 'gallery', video = false, vimeo = true, add = 'Add photos', max = 0 } = {}) {
  p.media = p.media || [];
  const tray = h('div', { class: 'tray', 'data-owner': p._id, 'data-group': group });
  const full = () => max && p.media.length >= max;
  const tile = (m) => {
    const thumb = mediaThumb(m);
    const what = m.type === 'video' ? 'vimeo' : m.video ? 'loop' : 'photo';
    const t = h('div', { class: 'tile' + (m._up ? ' uploading' : ''), 'data-mid': m._id, 'data-kind': what, title: m.type === 'video' ? (m.title || (m.embed ? embedInfo(m.embed).title : 'Vimeo')) : (m.alt || 'Drag to reorder') },
      thumb ? h('img', { src: thumb, alt: m.alt || '', loading: 'lazy', draggable: 'false' }) : null,
      what === 'loop' ? h('span', { class: 'badge' }, '▶ Loop') : null,
      m.type === 'video' ? h('span', { class: 'badge' }, '▶ Vimeo') : h('button', {
        type: 'button', class: 'alt' + (m.alt ? ' has' : ''), title: m.alt ? 'Alt text: ' + m.alt : 'Describe this photo for screen readers',
        onclick: () => altModal(m, () => { t.querySelector('.alt').classList.toggle('has', !!m.alt); typed(); }),
      }, 'Alt'),
      h('button', { type: 'button', class: 'x', title: 'Remove', 'aria-label': 'Remove', onclick: () => { p.media = p.media.filter((x) => x !== m); commit(); } }, svg('x')));
    return t;
  };
  const addFiles = async (files) => {
    if (max && p.media.length + files.length > max) {
      toast(`This block holds up to ${max}. The extra ${p.media.length + files.length - max === 1 ? 'one was' : 'ones were'} left out.`, '', 6000);
      files = files.slice(0, Math.max(0, max - p.media.length));
    }
    for (const f of files) {
      const temp = { _id: uid(), type: 'image', src: URL.createObjectURL(f), alt: '', _up: true };
      p.media.push(temp);
      const t = tile(temp);
      tray.insertBefore(t, $('.add', tray));
      try {
        startUpload();
        const m = await processFile(f, kind, { video }, (pct) => t.style.setProperty('--p', pct + '%'));
        URL.revokeObjectURL(temp.src);
        Object.assign(temp, m); delete temp._up;
        t.classList.remove('uploading');
        $('img', t).src = temp.src;
        commit({ redraw: false });
      } catch (e) {
        p.media = p.media.filter((x) => x !== temp); t.remove();
        toast(e.message, 'err', 7000);
      } finally { endUpload(); }
    }
  };
  const accept = group === 'logos' ? 'image/svg+xml,image/png,image/webp' : video ? 'image/*,video/mp4,video/webm' : 'image/*';
  tray.append(...p.media.map(tile),
    h('button', { type: 'button', class: 'tile add', onclick: async () => { if (full()) { toast(`This block holds up to ${max}.`); return; } addFiles(await pickFiles({ multiple: true, accept })); } }, add));
  dropTarget(tray, addFiles);
  const moveNote = group === 'logos' ? ' Drag to reorder.' : group === 'photos' ? ' Drag tiles to reorder, or move them to another grid or row.' : ' Drag tiles to reorder or move them to another gallery.';
  if (!vimeo) {
    return h('div', { class: 'stack tight' }, tray, note ? h('small', { class: 'note' }, note + moveNote) : null);
  }
  const vimeoInput = h('input', { class: 'input', placeholder: 'Paste a Vimeo link to add a clip', 'aria-label': 'Vimeo link' });
  const addVimeo = async () => {
    const v = parseVimeo(vimeoInput.value);
    if (!v) { toast('That doesn’t look like a Vimeo link.', 'err'); return; }
    vimeoInput.value = '';
    const m = await vimeoInfo(v);
    m._id = uid();
    p.media.push(m);
    commit();
  };
  vimeoInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addVimeo(); } });
  return h('div', { style: { display: 'grid', gap: '10px' } },
    tray,
    h('div', { class: 'vimeo-add' }, vimeoInput, h('button', { type: 'button', class: 'btn small', onclick: addVimeo }, 'Add clip')),
    note ? h('small', { class: 'note' }, note + moveNote) : null);
}

function altModal(m, done) {
  const input = h('textarea', { class: 'textarea', rows: 3, placeholder: 'Fans posing in the Predator forest set at Comic-Con' }, m.alt || '');
  const md = modal(h('form', { class: 'modal', onsubmit: (e) => { e.preventDefault(); m.alt = input.value.trim(); md.close(); done(); } },
    h('h2', {}, 'Describe the photo'),
    h('p', {}, 'Screen readers read this out, and search engines use it. One plain sentence is plenty.'),
    input,
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn ghost', onclick: () => md.close() }, 'Cancel'), h('button', { class: 'btn primary' }, 'Save'))));
  input.focus();
}

// a single photo (or loop) slot
function mediaSlot({ get, set, kind, video = false, raw = false, label = 'Drop a photo', note = '', accept }) {
  const slot = h('div', { class: 'slot', tabindex: '0', role: 'button' });
  const draw = () => {
    const m = get();
    slot.replaceChildren();
    slot.classList.toggle('filled', !!(m && m.src));
    slot.setAttribute('aria-label', m && m.src ? 'Replace ' + label.toLowerCase() : label);
    if (m && m.src) {
      slot.append(m.video
        ? h('video', { src: m.video, poster: m.src, muted: true, loop: true, autoplay: true, playsinline: true })
        : h('img', { src: m.src, alt: m.alt || '' }),
      h('div', { class: 'slot-tools' },
        h('button', { type: 'button', onclick: (e) => { e.stopPropagation(); choose(); } }, 'Replace'),
        h('button', { type: 'button', onclick: (e) => { e.stopPropagation(); set(null); draw(); commit({ redraw: false }); } }, 'Remove')));
    } else {
      slot.append(h('span', {}, label, note ? h('small', {}, note) : null));
    }
  };
  const handle = async (files) => {
    const f = files[0];
    if (!f) return;
    const bar = h('div', { class: 'bar' });
    slot.append(bar);
    try {
      startUpload();
      const m = await processFile(f, kind, { video, raw }, (pct) => bar.style.setProperty('--p', pct + '%'));
      set(m);
      draw();
      commit({ redraw: false });
    } catch (e) {
      toast(e.message, 'err', 7000);
      bar.remove();
    } finally { endUpload(); }
  };
  const choose = async () => handle(await pickFiles({ accept: accept || (video ? 'image/*,video/mp4,video/webm' : 'image/*') }));
  slot.addEventListener('click', () => { if (!slot.classList.contains('filled')) choose(); });
  slot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
  dropTarget(slot, handle);
  draw();
  return slot;
}

function videoEditor(p) {
  const box = h('div', { style: { display: 'grid', gap: '10px' } });
  const draw = () => {
    const info = p.embed ? embedInfo(p.embed) : p.vimeo ? { thumb: p.thumb, title: p.title || 'Vimeo video', link: 'https://vimeo.com/' + p.vimeo + (p.hash ? '/' + p.hash : '') } : null;
    const input = h('input', { class: 'input', value: info ? info.link : '', placeholder: 'https://vimeo.com/123456789', 'aria-label': 'Vimeo link' });
    const apply = async () => {
      const v = parseVimeo(input.value);
      if (!v) { toast('That doesn’t look like a Vimeo link.', 'err'); return; }
      const m = await vimeoInfo(v);
      delete p.embed;
      Object.assign(p, { vimeo: m.vimeo, hash: m.hash, w: m.w, h: m.h, title: m.title, thumb: m.thumb });
      draw(); commit({ redraw: false });
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
    box.replaceChildren(
      info ? h('div', { class: 'vid-card' }, h('div', { class: 'thumb', style: { backgroundImage: info.thumb ? `url("${info.thumb}")` : '' } }), h('div', {}, h('div', { class: 't' }, info.title), h('div', { class: 's' }, info.link))) : null,
      h('div', { class: 'vimeo-add' }, input, h('button', { type: 'button', class: 'btn small', onclick: apply }, info ? 'Swap video' : 'Add video')));
  };
  draw();
  return box;
}

/* ---------------- settings drawer ---------------- */
function openSettings() {
  const cs = S.cs;
  const L = cs.listing;
  const set = (fn) => (e) => { fn(e.target.type === 'checkbox' ? e.target.checked : e.target.value); typed(); };
  const workBits = h('div', { style: { display: 'grid', gap: '14px' } });
  const homeBits = h('div', { style: { display: 'grid', gap: '14px' } });
  const showWork = () => { workBits.hidden = !L.listed; homeSec.hidden = !L.listed; };
  const homeSec = h('section', {},
    h('h3', {}, 'Homepage'),
    h('label', { class: 'switch' }, h('span', {}, h('b', {}, 'Show a bubble on the homepage'), h('small', {}, 'It floats in the project field on the front page.')),
      h('input', { type: 'checkbox', checked: L.home.showHomepage, onchange: set((v) => { L.home.showHomepage = v; homeBits.hidden = !v; }) })),
    homeBits);
  const cats = (S.index ? S.index.categories : ['Events', 'Film', 'Music', 'Television']).slice();
  if (L.home.category && !cats.includes(L.home.category)) cats.push(L.home.category);
  const cat = h('select', { class: 'select', onchange: set((v) => { L.home.category = v; }) }, h('option', { value: '' }, 'None'), cats.map((c) => h('option', { value: c, selected: c === L.home.category }, c)));
  homeBits.append(
    h('label', { class: 'field' }, h('span', {}, 'Category'), cat),
    h('div', { class: 'row' },
      h('div', { class: 'field' }, h('span', {}, 'Bubble photo'), mediaSlot({ get: () => (L.home.image ? { src: L.home.image } : null), set: (m) => { L.home.image = m ? m.src : ''; }, kind: 'bubble', label: 'Drop a photo', note: 'Square-ish crops best' })),
      h('div', { class: 'field' }, h('span', {}, 'Hover clip'), mediaSlot({ get: () => (L.home.gif ? { src: L.home.gif } : null), set: (m) => { L.home.gif = m ? m.src : ''; }, kind: 'gif', raw: true, accept: 'image/gif,image/webp', label: 'Drop a GIF or animated WebP', note: 'Plays when someone hovers the bubble' }))),
    h('label', { class: 'switch' }, h('span', {}, h('b', {}, 'Award badge'), h('small', {}, 'Adds a badge with up to two logos.')), h('input', { type: 'checkbox', checked: L.home.award, onchange: set((v) => { L.home.award = v; awardBits.hidden = !v; }) })));
  const awardBits = h('div', { style: { display: 'grid', gap: '14px' } },
    h('label', { class: 'field' }, h('span', {}, 'Badge text'), h('input', { class: 'input', value: L.home.awardTitle, placeholder: 'Featured work', oninput: set((v) => { L.home.awardTitle = v; }) })),
    h('div', { class: 'row' },
      mediaSlot({ get: () => (L.home.awardLogo1 ? { src: L.home.awardLogo1 } : null), set: (m) => { L.home.awardLogo1 = m ? m.src : ''; }, kind: 'logo', label: 'First logo' }),
      mediaSlot({ get: () => (L.home.awardLogo2 ? { src: L.home.awardLogo2 } : null), set: (m) => { L.home.awardLogo2 = m ? m.src : ''; }, kind: 'logo', label: 'Second logo' })));
  awardBits.hidden = !L.home.award;
  homeBits.append(awardBits);
  homeBits.hidden = !L.home.showHomepage;

  workBits.append(
    h('label', { class: 'field' }, h('span', {}, 'Summary'), h('textarea', { class: 'textarea', rows: 3, placeholder: 'One line that shows when someone hovers the row', oninput: set((v) => { L.work.summary = R.esc(v); }) }, decodeHtml(L.work.summary)), h('small', {}, 'Shown next to the title on the Work page.')),
    h('div', { class: 'field' }, h('span', {}, 'Hover photo'), mediaSlot({
      get: () => (L.work.bg && L.work.bg.src ? { src: L.work.bg.src } : null),
      set: (m) => { L.work.bg = m ? { src: m.src, 'data-bg': m.src, alt: '' } : null; },
      kind: 'bg', label: 'Drop a photo', note: 'Fills the screen behind the list on hover',
    })),
    h('div', { class: 'row' },
      h('label', { class: 'field' }, h('span', {}, 'Month'), h('select', { class: 'select', onchange: set((v) => { L.work.month = v; }) }, h('option', { value: '' }, 'None'), ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((mo) => h('option', { value: mo, selected: mo === L.work.month }, mo)))),
      h('label', { class: 'field' }, h('span', {}, 'Year'), h('input', { class: 'input', inputmode: 'numeric', value: L.work.year, placeholder: String(new Date().getFullYear()), oninput: set((v) => { L.work.year = v.replace(/\D/g, '').slice(0, 4); }) }))));

  const slugField = S.isNew
    ? h('input', { class: 'input', value: cs.slug, oninput: (e) => { e.target.value = R.slugify(e.target.value); } , onchange: (e) => renameNew(e.target.value) })
    : h('input', { class: 'input', value: cs.slug, readonly: true, title: 'Published pages keep their link so nothing breaks' });
  const drawer = h('div', { class: 'drawer', role: 'dialog', 'aria-label': 'Page settings' },
    h('div', { class: 'drawer-head' }, h('h2', {}, 'Page settings'), h('button', { class: 'icon-btn', 'aria-label': 'Close', onclick: () => close() }, svg('x'))),
    h('section', {},
      h('h3', {}, 'The page'),
      h('label', { class: 'field' }, h('span', {}, 'Link'), slugField, h('small', {}, S.isNew ? 'You can change this until the first publish.' : 'Published pages keep their link so nothing breaks.')),
      h('label', { class: 'field' }, h('span', {}, 'Browser tab and share title'), h('input', { class: 'input', value: cs.seoTitle || '', placeholder: cs.title, oninput: set((v) => { cs.seoTitle = v; }) })),
      h('label', { class: 'field' }, h('span', {}, 'Description'), h('textarea', { class: 'textarea', rows: 3, placeholder: 'Shows up in Google and in link previews. About two sentences.', oninput: set((v) => { cs.description = v; }) }, cs.description || '')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: cs.noindex, onchange: set((v) => { cs.noindex = v; }) }), 'Keep this page out of Google')),
    h('section', {},
      h('h3', {}, 'Work page'),
      h('label', { class: 'switch' }, h('span', {}, h('b', {}, 'Show on the Work page'), h('small', {}, 'Off keeps the page live at its link but out of the list.')),
        h('input', { type: 'checkbox', checked: L.listed, onchange: set((v) => { L.listed = v; showWork(); }) })),
      workBits),
    homeSec);
  showWork();
  const scrim = h('div', { class: 'scrim' }, drawer);
  const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); commit({ redraw: false }); renderCanvas(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  scrim.addEventListener('mousedown', (e) => { if (e.target === scrim) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(scrim);
  $('input, textarea, select', drawer).focus();
}

function renameNew(slug) {
  slug = R.slugify(slug);
  if (!slug || slug === S.cs.slug) return;
  if (S.index && S.index.caseStudies.some((c) => c.slug === slug)) { toast('That link is taken. Try another.', 'err'); return; }
  store.del('ihc-draft:' + S.cs.slug);
  S.cs.slug = slug; S.slug = slug;
  S.cs.listing.work.href = '/case-study/' + slug;
  history.replaceState(null, '', '#/cs/' + slug);
  typed();
}

/* ---------------- preview ---------------- */
function renderPreviewPane() {
  const stage = h('div', { class: 'preview-stage' + (S.device === 'phone' ? ' phone' : ''), id: 'pv-stage' },
    h('iframe', { id: 'pv-frame', title: 'Live preview', loading: 'eager' }));
  const pane = h('aside', { class: 'preview', id: 'preview', 'aria-label': 'Live preview', hidden: !S.preview },
    h('div', { class: 'preview-bar' },
      h('button', { class: 'btn small on-dark mob-only', type: 'button', onclick: togglePreview }, 'Done'),
      h('span', { class: 'desk-only' }, seg([['desktop', 'Desktop'], ['phone', 'Phone']], S.device, (v) => { S.device = v; stage.classList.toggle('phone', v === 'phone'); fitPreview(); refreshPreview(); })),
      h('span', { class: 'grow' }, 'Updates as you build'),
      h('button', { class: 'icon-btn', title: 'Refresh', 'aria-label': 'Refresh preview', onclick: () => refreshPreview() }, svg('refresh')),
      h('button', { class: 'icon-btn', title: 'Open in a new tab', 'aria-label': 'Open preview in a new tab', onclick: openPreviewTab }, svg('open'))),
    stage);
  new ResizeObserver(() => fitPreview()).observe(stage);
  return pane;
}
function togglePreview() {
  S.preview = !S.preview;
  if (compact()) {
    // full-screen phone render; the page behind stays put
    S.device = 'phone';
    $('#pv-stage').classList.add('phone');
    document.body.classList.toggle('preview-open', S.preview);
  }
  const ed = $('.editor');
  ed.classList.toggle('with-preview', S.preview);
  $('#preview').hidden = !S.preview;
  const b = $('#bar-preview');
  b.classList.toggle('is-on', S.preview); b.setAttribute('aria-pressed', S.preview ? 'true' : 'false');
  if (S.preview) refreshPreview();
}
function fitPreview() {
  const stage = $('#pv-stage');
  const f = $('#pv-frame');
  if (!stage || !f) return;
  if (S.device === 'phone' || compact()) { f.style.transform = ''; f.style.width = ''; f.style.height = ''; return; }
  const scale = stage.clientWidth / 1440;
  f.style.width = '1440px';
  f.style.height = Math.ceil(stage.clientHeight / scale) + 'px';
  f.style.transform = `scale(${scale})`;
}
const PREVIEW_HELPER = `<script>(function(){
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a');if(a){e.preventDefault();e.stopPropagation();}},true);
  function go(m){var el=null;
    if(m.target==='intro')el=document.querySelector('.p-cs__intro');
    else if(typeof m.target==='number'){var b=document.querySelectorAll('.p-cs__block')[m.target];if(b){b.dataset.open='t';b.querySelectorAll('[data-line-anim]').forEach(function(x){x.dataset.visible='t'});el=b;}}
    var y=el?el.getBoundingClientRect().top+window.scrollY-60:0;
    if(window.cLenis&&window.cLenis.scrollTo)window.cLenis.scrollTo(y,{immediate:true});else window.scrollTo(0,y);
  }
  window.addEventListener('message',function(e){if(e.data&&e.data.type==='ihc-focus')go(e.data);});
})();</` + `script>`;
// The page's scripts build some fetch URLs from location.origin and location.pathname,
// which are 'null' and 'srcdoc' in a preview frame. Point those back at the site.
const fetchShim = (slug) => `<script>(function(){var f=window.fetch;window.fetch=function(u,o){if(typeof u==='string'){if(/srcdoc$|[0-9a-f-]{36}$/.test(u))u='/case-studies-items/${slug}';else if(u.indexOf('null/')===0)u=u.slice(4);}return f.call(this,u,o);};})();</` + `script>`;
function previewHtml() {
  const d = cleanForSave(S.cs);
  d.introPieces = S.cs.introPieces.map((p) => JSON.parse(JSON.stringify(p, (k, v) => (k === '_id' || k === '_up' ? undefined : v))));
  d.sections = S.cs.sections.map((s) => JSON.parse(JSON.stringify(s, (k, v) => (k === '_id' || k === '_up' ? undefined : v))));
  return R.page(S.template, d).replace('<head>', '<head>' + fetchShim(d.slug)).replace('</body>', PREVIEW_HELPER + '\n</body>');
}
let lastFocus = 'hero';
let previewReadyAt = 0;
function refreshPreview() {
  const f = $('#pv-frame');
  if (!f || !S.template || !S.preview) return;
  const stage = $('#pv-stage');
  let badge = $('.loading', stage);
  if (!badge) { badge = h('span', { class: 'loading' }, 'Updating'); stage.append(badge); }
  fitPreview();
  f.onload = () => {
    previewReadyAt = Date.now() + 2300; // the page plays its opening wipe first
    setTimeout(() => { badge.remove(); focusPreview(lastFocus, true); }, 2300);
  };
  f.srcdoc = previewHtml();
}
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 1200);
}
function focusPreview(target, force) {
  lastFocus = target;
  const f = $('#pv-frame');
  if (!f || !f.contentWindow || (!force && Date.now() < previewReadyAt)) return;
  f.contentWindow.postMessage({ type: 'ihc-focus', target }, '*');
}
function openPreviewTab() {
  const html = previewHtml().replace('<head>', `<head><base href="${location.origin}/">`);
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------------- publish ---------------- */
function problems(cs) {
  const stop = [];
  const warn = [];
  if (!cs.title.trim()) stop.push('Give the project a name.');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cs.slug)) stop.push('The page link can only use lowercase letters, numbers and dashes.');
  if (S.uploads) stop.push('Wait for uploads to finish.');
  if (!cs.heroImage && !cs.heroVimeo) warn.push('There’s no hero photo or video yet.');
  if (!cs.intro) warn.push('The big intro line is empty.');
  if (!cs.description) warn.push('There’s no description for Google and link previews (Page settings).');
  const L = cs.listing;
  if (L.listed && !L.work.summary) warn.push('It’s on the Work page without a summary.');
  if (L.listed && L.home.showHomepage && !L.home.image) warn.push('It has a homepage bubble but no bubble photo.');
  const all = [...cs.introPieces, ...cs.sections.flatMap((s) => s.pieces)];
  const emptyGal = all.filter((p) => Array.isArray(p.media) && !p.media.length).length;
  if (emptyGal) warn.push(`${emptyGal} photo block${emptyGal === 1 ? ' is' : 's are'} still empty. Galleries show as blank space; grids, rows and logos are left off.`);
  const halfCompare = all.filter((p) => p.type === 'compare' && !(p.before && p.before.src && p.after && p.after.src)).length;
  if (halfCompare) warn.push(`${halfCompare === 1 ? 'A before and after needs' : halfCompare + ' before and afters need'} both photos to show up.`);
  const untitled = cs.sections.filter((s) => !s.title.trim()).length;
  if (untitled) warn.push(`${untitled} section${untitled === 1 ? ' has' : 's have'} no title.`);
  return { stop, warn };
}

function publishFlow() {
  const cs = S.cs;
  const { stop, warn } = problems(cs);
  const L = cs.listing;
  const what = [
    `${S.isNew ? 'Creates' : 'Updates'} the page at /case-study/${cs.slug}`,
    L.listed ? 'Lists it on the Work page' : 'Keeps it off the Work page',
    L.listed && L.home.showHomepage ? 'Shows its bubble on the homepage' : 'No homepage bubble',
  ];
  const go = h('button', { class: 'btn primary', disabled: stop.length > 0 }, 'Publish');
  const body = h('div', { style: { display: 'grid', gap: '14px' } },
    h('ul', {}, what.map((w) => h('li', {}, w))),
    stop.length ? h('div', {}, h('p', { class: 'problem' }, 'Fix these first:'), h('ul', {}, stop.map((s) => h('li', { class: 'problem' }, s)))) : null,
    warn.length ? h('div', {}, h('p', {}, 'Worth a look, but it can go out as is:'), h('ul', {}, warn.map((s) => h('li', {}, s)))) : null,
    h('p', {}, 'The site rebuilds in about a minute after you publish.'));
  const md = modal(h('div', { class: 'modal' },
    h('h2', {}, S.isNew ? 'Publish the page?' : 'Publish changes?'),
    body,
    h('div', { class: 'actions' }, h('button', { class: 'btn ghost', onclick: () => md.close() }, 'Cancel'), go)));
  go.addEventListener('click', async () => {
    go.disabled = true; go.textContent = 'Publishing…';
    try {
      const r = await publish();
      md.close();
      published(r);
    } catch (e) {
      go.disabled = false; go.textContent = 'Publish';
      body.append(h('p', { class: 'problem', role: 'alert' }, e.message));
    }
  });
}

async function publish() {
  const d = cleanForSave(S.cs);
  d.updatedAt = new Date().toISOString();
  if (!d.pageId) d.pageId = R.newPageId();
  if (!d.listing.work.href) d.listing.work.href = '/case-study/' + d.slug;
  const jsonPath = `content/case-studies/${d.slug}.json`;
  const shared = ['content/index.json', 'work.html', 'cms/cs.html', 'sitemap.xml'];
  const tpl = await (await fetch('/builder/case-study.template', { cache: 'no-cache' })).text();
  const latest = await readFiles([jsonPath, ...shared]);
  const F = latest.files;
  if (S.isNew && F[jsonPath]) throw new Error(`Another case study already uses /case-study/${d.slug}. Change the link in Page settings.`);
  for (const p of shared) if (!F[p]) throw new Error(`Couldn’t read ${p} from the site.`);
  const json = JSON.stringify(d, null, 1) + '\n';
  const files = [
    { path: jsonPath, content: json },
    { path: `case-study/${d.slug}.html`, content: R.page(tpl, d) },
    { path: 'content/index.json', content: R.spliceIndex(F['content/index.json'].text, d) },
  ];
  const work = R.spliceWork(F['work.html'].text, d);
  if (work !== F['work.html'].text) files.push({ path: 'work.html', content: work });
  const cms = R.spliceCms(F['cms/cs.html'].text, d);
  if (cms !== F['cms/cs.html'].text) files.push({ path: 'cms/cs.html', content: cms });
  const map = R.spliceSitemap(F['sitemap.xml'].text, d);
  if (map !== F['sitemap.xml'].text) files.push({ path: 'sitemap.xml', content: map });
  const expect = { [jsonPath]: S.isNew ? null : S.loadedSha };
  for (const f of files) if (shared.includes(f.path)) expect[f.path] = F[f.path].sha;
  try {
    const r = await api('publish', { method: 'POST', body: { message: `${S.isNew ? 'Add' : 'Update'} case study: ${d.title}`, files, expect } });
    S.loadedSha = await gitSha(json);
    return { ...r, data: d };
  } catch (e) {
    if (e.status === 409) {
      const mine = e.data && e.data.conflicts && e.data.conflicts.includes(jsonPath);
      throw new Error(mine
        ? 'Someone published this case study after you opened it. Your changes are saved in this browser. Reload to see their version first, or discard yours.'
        : 'The site changed while publishing. Hit Publish again.');
    }
    throw e;
  }
}

function published(r) {
  const d = r.data;
  store.del('ihc-draft:' + d.slug);
  S.isNew = false;
  S.draftNote = null;
  S.cs.updatedAt = d.updatedAt;
  S.publishedSnap = JSON.stringify(cleanForSave(S.cs));
  if (S.index) {
    const i = S.index.caseStudies.findIndex((c) => c.slug === d.slug);
    const e = R.indexEntry(d);
    if (i >= 0) S.index.caseStudies[i] = e; else S.index.caseStudies.push(e);
  }
  renderCanvas(); updateBar();
  const live = '/case-study/' + d.slug;
  const t = toast(h('span', {}, 'Published. The site is rebuilding, usually about a minute.'), 'ok', 0);
  if (S.local) { t.replaceChildren(h('span', {}, 'Published (local). '), h('a', { href: live, target: '_blank' }, 'Open the page')); setTimeout(() => t.remove(), 8000); return; }
  const started = Date.now();
  const poll = async () => {
    try {
      const j = await (await fetch(`/content/case-studies/${d.slug}.json?t=${Date.now()}`, { cache: 'no-store' })).json();
      if (j.updatedAt === d.updatedAt) {
        t.replaceChildren(h('span', {}, 'It’s live. '), h('a', { href: live, target: '_blank', rel: 'noopener' }, 'Open the page'));
        setTimeout(() => t.remove(), 15000);
        return;
      }
    } catch (e) { /* not there yet */ }
    if (Date.now() - started > 5 * 60 * 1000) {
      t.replaceChildren(h('span', {}, 'Still rebuilding. Check Vercel if it doesn’t show up soon. '), h('a', { href: live, target: '_blank', rel: 'noopener' }, 'Open the page'));
      setTimeout(() => t.remove(), 15000);
      return;
    }
    setTimeout(poll, 6000);
  };
  setTimeout(poll, 20000);
}

/* ---------------- boot ---------------- */
route();
