// Social studio drawing engine. Everything is drawn on a 2D canvas as a function of time, so the
// same code makes a still (PNG), an animated post (MP4) and overlay clips for video edits (WebM).
// No DOM beyond canvas, images and fonts. Sizes are in "u": 1u = 1px on a 1080 short side.

export const FORMATS = {
  story: { w: 1080, h: 1920, label: 'Story', note: '9:16' },
  post: { w: 1080, h: 1350, label: 'Post', note: '4:5' },
  square: { w: 1080, h: 1080, label: 'Square', note: '1:1' },
  wide: { w: 1920, h: 1080, label: 'Wide', note: '16:9' },
};
export const COLORS = { yellow: '#ffb728', red: '#ff142d', blue: '#004fff', violet: '#4d25c8', night: '#1810a0', pink: '#f40c70', mint: '#95efc9', black: '#0b0717', white: '#ffffff' };
const INK = { yellow: '#ff142d', mint: '#1810a0', white: '#ff142d' };
export const inkOn = (c) => INK[c] || '#ffffff';
// Bubble colors that pop on each background
const POP = {
  blue: ['yellow', 'pink', 'mint'], red: ['yellow', 'night', 'white'], yellow: ['red', 'blue', 'violet'], violet: ['yellow', 'pink', 'mint'],
  night: ['pink', 'yellow', 'mint'], pink: ['yellow', 'night', 'white'], mint: ['night', 'pink', 'blue'], black: ['yellow', 'pink', 'blue'], white: ['red', 'blue', 'yellow'],
};
const WIPES = [['pink', 'blue', 'red', 'yellow'], ['violet', 'yellow', 'pink', 'blue'], ['red', 'mint', 'night', 'pink'], ['blue', 'pink', 'yellow', 'violet']];

/* ---------------- assets ---------------- */
let OVAL = null, LOGO = null;
const images = new Map();
export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (!images.has(src)) {
    images.set(src, new Promise((ok) => {
      const im = new Image();
      if (/^https?:/.test(src)) im.crossOrigin = 'anonymous';
      im.onload = () => ok(im);
      im.onerror = () => ok(null);
      im.src = src;
    }));
  }
  return images.get(src);
}
export async function ready() {
  if (OVAL) return;
  const [svg, logo] = await Promise.all([fetch('/builder/ihc-oval.svg').then((r) => r.text()), loadImage('/builder/ihc-logo.svg')]);
  LOGO = logo;
  await Promise.all(['700 100px "IHC Display"', '500 40px Archivo', '700 40px Archivo'].map((f) => document.fonts.load(f).catch(() => {})));
  OVAL = new Path2D(svg.match(/ d="([^"]+)"/)[1]);
}
// Loads every photo a list of slides uses; returns the lookup the scenes draw from.
export async function env(format, slides = []) {
  await ready();
  const F = FORMATS[format] || FORMATS.story;
  const got = new Map();
  await Promise.all(slides.map((s) => s.photo).filter(Boolean).map(async (src) => got.set(src, await loadImage(src))));
  return { W: F.w, H: F.h, u: Math.min(F.w, F.h) / 1080, img: (src) => got.get(src) || null, dur: 3 };
}

/* ---------------- maths and type ---------------- */
const clamp = (x) => Math.max(0, Math.min(1, x));
const pr = (t, start, dur) => clamp((t - start) / dur);
const out = (x) => 1 - Math.pow(1 - x, 3);
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c = 2.2; return x <= 0 ? 0 : x >= 1 ? 1 : 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const up = (s) => String(s || '').toUpperCase();
const DISPLAY = (px) => `700 ${px}px "IHC Display", "Archivo Black", sans-serif`;
const BODY = (px) => `500 ${px}px Archivo, sans-serif`;
const BOLD = (px) => `700 ${px}px Archivo, sans-serif`;
const spaced = (ctx, on) => { if ('letterSpacing' in ctx) ctx.letterSpacing = on ? '0.06em' : '0px'; };

function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text || '').split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? line + ' ' + word : word;
      if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = word; } else line = next;
    }
    lines.push(line);
  }
  return lines;
}
// Biggest size (max down to min) at which the text fits the box. Cached: it runs every frame.
const fits = new Map();
function fit(ctx, text, { font, maxW, maxH, max, min = 18, lh = 1, maxLines = 99 }) {
  const key = [font(10), text, Math.round(maxW), Math.round(maxH), Math.round(max), lh, maxLines].join('|');
  if (fits.has(key)) { const f = fits.get(key); ctx.font = font(f.size); return f; }
  let size = max, lines;
  for (;;) {
    ctx.font = font(size);
    lines = wrap(ctx, text, maxW);
    if (size <= min || (lines.length <= maxLines && lines.length * size * lh <= maxH && lines.every((l) => ctx.measureText(l).width <= maxW))) break;
    size = Math.max(min, Math.floor(size * 0.95));
  }
  const f = { size, lines, lh };
  if (fits.size > 600) fits.clear();
  fits.set(key, f);
  return f;
}
// A line of type that rises into place from behind its own baseline
function rise(ctx, text, x, y, size, p) {
  if (p <= 0) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(-1e5, y - size * 0.98, 2e5, size * 1.16); ctx.clip();
  ctx.fillText(text, x, y + (1 - out(p)) * size * 1.15);
  ctx.restore();
}
function coverImg(ctx, img, W, H, zoom = 1) {
  if (!img) { ctx.fillStyle = '#231a3d'; ctx.fillRect(0, 0, W, H); return; }
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}
function pill(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
}
// The IHC speech-bubble oval, centered on (cx, cy), `w` wide
function oval(ctx, cx, cy, w, color, rot = 0) {
  if (w <= 0) return;
  const k = w / 62;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(k, k); ctx.translate(-31, -27.5);
  ctx.fillStyle = color; ctx.fill(OVAL);
  ctx.restore();
}
// A stat bubble: the oval with a big number and a label
function bubble(ctx, cx, cy, w, color, value, label, rot = 0, scale = 1) {
  if (scale <= 0.01) return;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(scale, scale);
  oval(ctx, 0, 0, w, COLORS[color] || color);
  const h = (w * 55) / 62;
  ctx.fillStyle = inkOn(color); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const hasLabel = !!String(label || '').trim();
  const v = fit(ctx, up(value), { font: DISPLAY, maxW: w * 0.7, maxH: h * (hasLabel ? 0.44 : 0.6), max: h * 0.5, lh: 0.86, maxLines: 2 });
  spaced(ctx, true);
  const l = hasLabel ? fit(ctx, up(label), { font: BOLD, maxW: w * 0.6, maxH: h * 0.2, max: h * 0.085, min: 10, lh: 1.08, maxLines: 2 }) : { size: 0, lines: [], lh: 1 };
  spaced(ctx, false);
  const vh = v.lines.length * v.size * v.lh, gap = hasLabel ? h * 0.035 : 0, lhh = l.lines.length * l.size * l.lh;
  let y = -h * 0.04 - (vh + gap + lhh) / 2;
  ctx.font = DISPLAY(v.size);
  v.lines.forEach((line) => { y += v.size * v.lh; ctx.fillText(line, 0, y - v.size * 0.1); });
  y += gap;
  ctx.font = BOLD(l.size); spaced(ctx, true);
  l.lines.forEach((line) => { y += l.size * l.lh; ctx.fillText(line, 0, y - l.size * 0.12); });
  spaced(ctx, false);
  ctx.restore();
}
function logo(ctx, x, y, w, scale = 1) {
  if (!LOGO || scale <= 0.01) return;
  const h = (w * 55) / 62;
  ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(scale, scale);
  ctx.drawImage(LOGO, -w / 2, -h / 2, w, h);
  ctx.restore();
}
// Margins that stay clear of the app chrome on stories
function box(E) {
  const story = E.H / E.W > 1.6, u = E.u;
  return { l: 72 * u, r: E.W - 72 * u, t: (story ? 230 : 84) * u, b: E.H - (story ? 300 : 84) * u };
}

/* ---------------- slides ---------------- */
// Each scene draws one slide at `t` seconds since it appeared. A big t gives the settled still.
const SCENES = {
  cover(ctx, s, t, E) {
    const { W, H, u } = E, B = box(E);
    coverImg(ctx, E.img(s.photo), W, H, 1.03 + 0.05 * clamp(t / 6));
    let g = ctx.createLinearGradient(0, H * 0.3, 0, H);
    g.addColorStop(0, 'rgba(11,7,23,0)'); g.addColorStop(1, 'rgba(11,7,23,.9)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createLinearGradient(0, 0, 0, B.t + 220 * u);
    g.addColorStop(0, 'rgba(11,7,23,.5)'); g.addColorStop(1, 'rgba(11,7,23,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, B.t + 220 * u);
    logo(ctx, B.l, B.t, 140 * u, back(pr(t, 0.1, 0.5)));
    if (String(s.badge || '').trim()) {
      const p = out(pr(t, 0.5, 0.45)), size = 30 * u;
      ctx.font = BOLD(size); spaced(ctx, true);
      const tw = ctx.measureText(up(s.badge)).width, bw = tw + 56 * u, bh = 68 * u;
      ctx.save(); ctx.globalAlpha = p;
      pill(ctx, B.r - bw + (1 - p) * 40 * u, B.t + 28 * u, bw, bh, COLORS.yellow);
      ctx.fillStyle = '#16053a'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(up(s.badge), B.r - bw + 28 * u + (1 - p) * 40 * u, B.t + 28 * u + bh / 2 + size * 0.06);
      ctx.restore(); spaced(ctx, false);
    }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const f = fit(ctx, up(s.title), { font: DISPLAY, maxW: B.r - B.l, maxH: H * 0.36, max: 520 * u, lh: 0.86, maxLines: 4 });
    const n = f.lines.length;
    f.lines.forEach((line, i) => rise(ctx, line, B.l, B.b - (n - 1 - i) * f.size * 0.86, f.size, pr(t, 0.25 + i * 0.1, 0.6)));
    if (String(s.kicker || '').trim()) {
      const size = 32 * u, p = out(pr(t, 0.15, 0.5));
      ctx.font = BOLD(size); spaced(ctx, true); ctx.globalAlpha = p;
      ctx.fillText(up(s.kicker), B.l, B.b - (n - 1) * f.size * 0.86 - f.size * 0.78 - 26 * u, B.r - B.l);
      ctx.globalAlpha = 1; spaced(ctx, false);
    }
  },

  stats(ctx, s, t, E) {
    const { W, H, u } = E, B = box(E), bg = s.color || 'blue', ink = inkOn(bg);
    ctx.fillStyle = COLORS[bg]; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    let top = B.t;
    if (String(s.heading || '').trim()) {
      const f = fit(ctx, up(s.heading), { font: DISPLAY, maxW: B.r - B.l, maxH: 130 * u, max: 130 * u, lh: 0.86, maxLines: 1 });
      rise(ctx, f.lines[0], B.l, B.t + f.size * 0.8, f.size, pr(t, 0.1, 0.5));
      top += f.size * 0.8 + 36 * u;
    }
    let bottom = B.b;
    if (String(s.footer || '').trim()) {
      ctx.font = BOLD(30 * u); spaced(ctx, true); ctx.globalAlpha = out(pr(t, 0.6, 0.5));
      ctx.fillText(up(s.footer), B.l, B.b, B.r - B.l); ctx.globalAlpha = 1; spaced(ctx, false);
      bottom -= 70 * u;
    }
    const items = (s.items || []).filter((x) => String(x.value || '').trim()).slice(0, 3), n = items.length;
    const aw = B.r - B.l, ah = bottom - top, row = aw / ah > 1.15, pops = POP[bg] || POP.blue;
    items.forEach((it, i) => {
      let cx, cy, w;
      if (row) {
        w = Math.min((aw / n) * 1.02, ah * 0.92 * (62 / 55));
        cx = B.l + (aw * (i + 0.5)) / n; cy = top + ah / 2 + (n > 1 ? (i % 2 ? 1 : -1) * ah * 0.05 : 0);
      } else {
        const slots = { 1: [[0.5, 0.5, 0.96]], 2: [[0.42, 0.27, 0.8], [0.58, 0.73, 0.8]], 3: [[0.37, 0.19, 0.7], [0.63, 0.5, 0.7], [0.38, 0.81, 0.7]] }[n][i];
        w = Math.min(aw * slots[2], (ah / (n === 1 ? 1 : n === 2 ? 1.75 : 2.3)) * (62 / 55));
        cx = B.l + aw * slots[0]; cy = top + ah * slots[1];
      }
      const p = back(pr(t, 0.3 + i * 0.16, 0.55));
      bubble(ctx, cx, cy + Math.sin(t * 1.5 + i * 2.1) * 9 * u, w, pops[i % pops.length], it.value, it.label, (i % 2 ? 1 : -1) * 0.05 + Math.sin(t * 1.1 + i) * 0.012, p);
    });
  },

  photo(ctx, s, t, E) {
    const { W, H, u } = E, B = box(E);
    coverImg(ctx, E.img(s.photo), W, H, 1.03 + 0.05 * clamp(t / 6));
    const text = up(s.caption).trim();
    if (!text) return;
    const g = ctx.createLinearGradient(0, H * 0.6, 0, H);
    g.addColorStop(0, 'rgba(11,7,23,0)'); g.addColorStop(1, 'rgba(11,7,23,.75)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const f = fit(ctx, text, { font: DISPLAY, maxW: B.r - B.l, maxH: H * 0.2, max: 120 * u, lh: 0.88, maxLines: 3 });
    const n = f.lines.length;
    f.lines.forEach((line, i) => rise(ctx, line, B.l, B.b - (n - 1 - i) * f.size * 0.88, f.size, pr(t, 0.3 + i * 0.1, 0.55)));
  },

  text(ctx, s, t, E) {
    const { W, H, u } = E, B = box(E), bg = s.color || 'violet';
    ctx.fillStyle = COLORS[bg]; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = inkOn(bg); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const aw = B.r - B.l, ah = B.b - B.t;
    const hd = String(s.heading || '').trim() ? fit(ctx, up(s.heading), { font: DISPLAY, maxW: aw, maxH: ah * 0.36, max: 210 * u, lh: 0.86, maxLines: 4 }) : null;
    const hh = hd ? hd.lines.length * hd.size * 0.86 : 0, gap = hd ? 44 * u : 0;
    const bd = String(s.body || '').trim() ? fit(ctx, s.body, { font: BODY, maxW: aw, maxH: ah - hh - gap, max: 52 * u, min: 24 * u, lh: 1.34 }) : null;
    const bh = bd ? bd.lines.length * bd.size * 1.34 : 0;
    let y = B.t + Math.max(0, (ah - hh - gap - bh) / 2);
    if (hd) { ctx.font = DISPLAY(hd.size); hd.lines.forEach((line, i) => { y += hd.size * 0.86; rise(ctx, line, B.l, y - hd.size * 0.06, hd.size, pr(t, 0.15 + i * 0.1, 0.55)); }); }
    y += gap;
    if (bd) {
      const p = out(pr(t, 0.45, 0.6));
      ctx.font = BODY(bd.size); ctx.globalAlpha = p;
      bd.lines.forEach((line) => { y += bd.size * 1.34; ctx.fillText(line, B.l, y - bd.size * 0.36 + (1 - p) * 30 * u); });
      ctx.globalAlpha = 1;
    }
  },

  quote(ctx, s, t, E) {
    const { W, H, u } = E, B = box(E), bg = s.color || 'pink', pops = POP[bg] || POP.pink;
    ctx.fillStyle = COLORS[bg]; ctx.fillRect(0, 0, W, H);
    oval(ctx, B.l + 110 * u, B.t + 100 * u, 220 * u * back(pr(t, 0.1, 0.5)), COLORS[pops[0]], -0.08);
    ctx.fillStyle = inkOn(pops[0]); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (pr(t, 0.3, 0.2) > 0) { ctx.font = DISPLAY(230 * u); ctx.fillText('“', B.l + 112 * u, B.t + 232 * u); }
    ctx.fillStyle = inkOn(bg); ctx.textAlign = 'left';
    const top = B.t + 250 * u, by = String(s.by || '').trim();
    const f = fit(ctx, up(s.quote), { font: DISPLAY, maxW: B.r - B.l, maxH: B.b - top - (by ? 90 * u : 0), max: 170 * u, min: 44 * u, lh: 0.9 });
    let y = top;
    f.lines.forEach((line, i) => { y += f.size * 0.9; rise(ctx, line, B.l, y, f.size, pr(t, 0.25 + i * 0.06, 0.5)); });
    if (by) {
      ctx.font = BOLD(32 * u); spaced(ctx, true); ctx.globalAlpha = out(pr(t, 0.7, 0.5));
      ctx.fillText(up(by), B.l, y + 74 * u, B.r - B.l); ctx.globalAlpha = 1; spaced(ctx, false);
    }
  },

  outro(ctx, s, t, E) {
    const { W, H, u } = E, B = box(E), bg = s.color || 'yellow', ink = inkOn(bg);
    ctx.fillStyle = COLORS[bg]; ctx.fillRect(0, 0, W, H);
    const aw = B.r - B.l, lw = 300 * u, lh = (lw * 55) / 62;
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const f = fit(ctx, up(s.line), { font: DISPLAY, maxW: aw, maxH: (B.b - B.t) * 0.42, max: 250 * u, lh: 0.86, maxLines: 4 });
    const th = f.lines.length * f.size * 0.86, url = String(s.url || '').trim(), uh = url ? 84 * u : 0;
    let y = B.t + Math.max(0, (B.b - B.t - lh - 56 * u - th - (url ? 50 * u + uh : 0)) / 2);
    logo(ctx, W / 2 - lw / 2, y, lw, back(pr(t, 0.1, 0.55)));
    y += lh + 56 * u;
    ctx.font = DISPLAY(f.size); ctx.fillStyle = ink;
    f.lines.forEach((line, i) => { y += f.size * 0.86; rise(ctx, line, W / 2, y - f.size * 0.06, f.size, pr(t, 0.3 + i * 0.1, 0.55)); });
    if (url) {
      const p = back(pr(t, 0.75, 0.5));
      ctx.font = BOLD(34 * u);
      const tw = Math.min(aw - 80 * u, ctx.measureText(url).width), pw = tw + 80 * u;
      ctx.save(); ctx.translate(W / 2, y + 50 * u + uh / 2); ctx.scale(p, p);
      if (p > 0.01) {
        pill(ctx, -pw / 2, -uh / 2, pw, uh, ink);
        ctx.fillStyle = COLORS[bg]; ctx.textBaseline = 'middle'; ctx.fillText(url, 0, 34 * u * 0.08, tw);
      }
      ctx.restore();
    }
  },
};
export const SLIDE_TYPES = [['cover', 'Cover'], ['text', 'Words'], ['photo', 'Photo'], ['stats', 'Numbers'], ['quote', 'Quote'], ['outro', 'Sign-off']];
export function drawSlide(ctx, slide, t, E) {
  ctx.save();
  (SCENES[slide.type] || SCENES.text)(ctx, slide, t, E);
  ctx.restore();
}

// The site's page wipe: blocks of color sweep in from the right, then clear off to the left.
// p runs 0 to 1 and the frame is fully covered at 0.5.
export function drawWipe(ctx, p, E, colors = WIPES[0]) {
  const { W, H } = E, n = colors.length;
  for (let i = 0; i < n; i++) {
    const a = out(pr(p, i * 0.07, 0.28)), b = inOut(pr(p, 0.5 + (n - 1 - i) * 0.07, 0.28));
    const x0 = W * (1 - a), x1 = W * (1 - b);
    if (x1 > x0) { ctx.fillStyle = COLORS[colors[i]] || colors[i]; ctx.fillRect(x0, 0, x1 - x0 + 1, H); }
  }
}
// A whole post as one timeline: each slide holds for `per` seconds, with a wipe over every cut.
export const sequenceLength = (slides, per = 3) => Math.max(1, slides.length) * per;
export function drawSequence(ctx, slides, T, E, { per = 3, trans = 0.9 } = {}) {
  const n = slides.length;
  if (!n) return;
  const i = Math.min(n - 1, Math.floor(T / per));
  drawSlide(ctx, slides[i], Math.max(0, T - i * per - 0.12), E);
  for (let k = 1; k < n; k++) {
    const p = (T - (k * per - trans / 2)) / trans;
    if (p > 0 && p < 1) {
      if (p < 0.5) { ctx.save(); drawSlide(ctx, slides[k - 1], per, E); ctx.restore(); }
      drawWipe(ctx, p, E, WIPES[k % WIPES.length]);
    }
  }
}

/* ---------------- motion elements (overlays for video edits) ---------------- */
// Each draws on a clear frame at `t` of `o.dur` seconds: in, hold, out.
const SPOTS = { center: [0.5, 0.5], tl: [0.3, 0.26], tr: [0.7, 0.26], bl: [0.3, 0.74], br: [0.7, 0.74] };
const ELEMENTS = {
  bubble(ctx, o, t, E) {
    const { W, H } = E, d = o.dur, [fx, fy] = SPOTS[o.spot] || SPOTS.center;
    const w = Math.min(W, H) * (o.size || 0.6), s = back(pr(t, 0.05, 0.5)) * (1 - inOut(pr(t, d - 0.35, 0.3)));
    bubble(ctx, W * fx, H * fy + Math.sin(t * 1.6) * 10 * E.u, w, o.color || 'yellow', o.value, o.label, -0.05 + Math.sin(t * 1.2) * 0.015, s);
  },
  burst(ctx, o, t, E) {
    const { W, H } = E, d = o.dur, r = rng(o.seed || 7), n = o.count || 16, names = Object.keys(COLORS).filter((c) => c !== 'black' && c !== 'white');
    for (let i = 0; i < n; i++) {
      const x = r(), y = r(), size = 0.1 + r() * 0.2, delay = r() * d * 0.45, drift = 0.06 + r() * 0.12, color = names[Math.floor(r() * names.length)], rot = (r() - 0.5) * 0.5;
      const s = back(pr(t, delay, 0.45)) * (1 - inOut(pr(t, d - 0.3 - r() * 0.3, 0.28)));
      oval(ctx, W * x, H * (0.15 + y * 0.9) - H * drift * (t / d), Math.min(W, H) * size * s, COLORS[color], rot + Math.sin(t + i) * 0.04);
    }
  },
  wipe(ctx, o, t, E) { drawWipe(ctx, clamp(t / o.dur), E, WIPES[(o.look || 0) % WIPES.length]); },
  title(ctx, o, t, E) {
    const { W, H, u } = E, d = o.dur, color = COLORS[o.color] || COLORS.yellow, text = up(o.text) || 'TITLE';
    const leave = inOut(pr(t, d - 0.35, 0.32));
    const f = fit(ctx, text, { font: DISPLAY, maxW: W * 0.9, maxH: H * 0.3, max: 420 * u, lh: 0.86, maxLines: 2 });
    const th = f.lines.length * f.size * 0.86, cy = H / 2;
    // outlined echoes sliding past, above and below
    ctx.font = DISPLAY(f.size); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, 4 * u); ctx.lineJoin = 'round';
    const line = f.lines.join(' '), lw = ctx.measureText(line + '   ').width, a = out(pr(t, 0.25, 0.5)) * (1 - leave);
    ctx.globalAlpha = a;
    [-1, 1].forEach((dir) => {
      const y = cy + dir * (th / 2 + f.size * 0.62) + f.size * 0.36;
      let x = ((dir * t * 160 * u) % lw) - lw;
      for (; x < W; x += lw) ctx.strokeText(line + '   ', x, y);
    });
    ctx.globalAlpha = 1;
    const s = (1.6 - 0.6 * back(pr(t, 0, 0.42))) * (1 + leave * 0.4);
    ctx.save(); ctx.translate(W / 2, cy); ctx.scale(s, s); ctx.globalAlpha = pr(t, 0, 0.12) * (1 - leave);
    ctx.fillStyle = color; ctx.textAlign = 'center';
    f.lines.forEach((ln, i) => ctx.fillText(ln, 0, -th / 2 + (i + 1) * f.size * 0.86 - f.size * 0.08));
    ctx.restore();
  },
  lower(ctx, o, t, E) {
    const { W, H, u } = E, d = o.dur, B = box(E), color = o.color || 'red';
    const open = out(pr(t, 0.05, 0.5)) * (1 - inOut(pr(t, d - 0.4, 0.35))), open2 = out(pr(t, 0.22, 0.5)) * (1 - inOut(pr(t, d - 0.5, 0.35)));
    const name = up(o.name) || 'NAME', sub = up(o.sub);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = DISPLAY(104 * u);
    const nw = Math.min(W - B.l * 2 - 80 * u, ctx.measureText(name).width), bw = nw + 88 * u, bh = 150 * u, y = B.b - bh - (sub ? 52 * u : 0);
    ctx.save(); ctx.beginPath(); ctx.rect(B.l, y - 10, bw * open, bh + 20); ctx.clip();
    pill(ctx, B.l, y, bw, bh, COLORS[color]);
    ctx.fillStyle = inkOn(color); ctx.fillText(name, B.l + 44 * u, y + bh / 2 + 104 * u * 0.05, nw);
    ctx.restore();
    if (sub) {
      ctx.font = BOLD(30 * u); spaced(ctx, true);
      const sw = Math.min(W - B.l * 2 - 110 * u, ctx.measureText(sub).width), pw = sw + 56 * u, ph = 66 * u, px = B.l + 36 * u, py = y + bh - 14 * u;
      ctx.save(); ctx.beginPath(); ctx.rect(px, py - 10, pw * open2, ph + 20); ctx.clip();
      pill(ctx, px, py, pw, ph, '#fff');
      ctx.fillStyle = '#16053a'; ctx.fillText(sub, px + 28 * u, py + ph / 2 + 2 * u, sw);
      ctx.restore(); spaced(ctx, false);
    }
  },
  logo(ctx, o, t, E) {
    const { W, H } = E, d = o.dur, m = Math.min(W, H), leave = inOut(pr(t, d - 0.35, 0.3));
    const names = ['yellow', 'pink', 'blue', 'mint', 'violet', 'red'], ring = out(pr(t, 0.15, 0.7));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.3, dist = m * (0.16 + 0.26 * ring), size = m * 0.07 * (1 - leave) * back(pr(t, 0.12 + (i % 4) * 0.04, 0.4));
      oval(ctx, W / 2 + Math.cos(a) * dist, H / 2 + Math.sin(a) * dist, size * (i % 2 ? 1 : 1.5), COLORS[names[i % names.length]], a);
    }
    const w = m * (o.size || 0.42);
    logo(ctx, W / 2 - w / 2, H / 2 - (w * 55) / 124, w, back(pr(t, 0, 0.5)) * (1 - leave));
  },
};
export const ELEMENT_TYPES = [
  ['bubble', 'Stat bubble', 'A number in the IHC bubble'],
  ['burst', 'Bubble burst', 'A flurry of bubbles drifting up'],
  ['wipe', 'Color wipe', 'The site’s page wipe, for cuts'],
  ['title', 'Title slam', 'Big type with outlined echoes'],
  ['lower', 'Lower third', 'A name and a line under it'],
  ['logo', 'Logo pop', 'The IHC bubble with a burst'],
];
// bg: 'clear' (transparent), 'green' (key it out in any editor) or a color name
export function drawElement(ctx, o, t, E) {
  if (o.bg && o.bg !== 'clear') { ctx.fillStyle = o.bg === 'green' ? '#00ff00' : COLORS[o.bg] || o.bg; ctx.fillRect(0, 0, E.W, E.H); }
  ctx.save();
  if (ELEMENTS[o.type]) ELEMENTS[o.type](ctx, o, t, E);
  ctx.restore();
}

/* ---------------- export ---------------- */
export function canvasFor(E, scale = 1) {
  const c = document.createElement('canvas');
  c.width = Math.round(E.W * scale); c.height = Math.round(E.H * scale);
  const ctx = c.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  return { canvas: c, ctx };
}
export async function toPng(E, draw) {
  const { canvas, ctx } = canvasFor(E);
  draw(ctx);
  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('Couldn’t make that image. A photo from another site may be blocking it.'))), 'image/png'));
}
// Renders draw(ctx, t) frame by frame into a video. format 'mp4' (H.264, for posting) or
// 'webm' (VP9; with clear: true it keeps transparency for overlays).
export async function toVideo(E, { dur, fps = 30, draw, format = 'mp4', clear = false, onProgress }) {
  const M = await import('/builder/vendor/mediabunny.1.65.2.min.js');
  const { canvas, ctx } = canvasFor(E);
  const size = { width: E.W, height: E.H };
  let codec = format === 'mp4' ? 'avc' : 'vp9';
  if (!(await M.canEncodeVideo(codec, size))) {
    if (format === 'mp4' && !clear && (await M.canEncodeVideo('vp9', size))) { format = 'webm'; codec = 'vp9'; }
    else if (await M.canEncodeVideo('vp8', size)) { format = 'webm'; codec = 'vp8'; }
    else throw new Error('This browser can’t make video. Chrome or Edge can.');
  }
  const output = new M.Output({ format: format === 'mp4' ? new M.Mp4OutputFormat() : new M.WebMOutputFormat(), target: new M.BufferTarget() });
  const source = new M.CanvasSource(canvas, { codec, bitrate: Math.round(E.W * E.H * fps * (clear ? 0.16 : 0.11)), alpha: clear ? 'keep' : 'discard' });
  output.addVideoTrack(source, { frameRate: fps });
  await output.start();
  const frames = Math.max(1, Math.round(dur * fps));
  for (let f = 0; f < frames; f++) {
    ctx.clearRect(0, 0, E.W, E.H);
    draw(ctx, f / fps);
    await source.add(f / fps, 1 / fps);
    if (onProgress) onProgress(Math.round(((f + 1) / frames) * 100));
  }
  await output.finalize();
  return { blob: new Blob([output.target.buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' }), format };
}
export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
