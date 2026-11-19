// Media helpers for the builder: the crop step for photos, in-browser WebM compression for
// video, and size readouts. Plain DOM so it doesn't depend on builder.js internals.
// The video encoder (mediabunny, MPL-2.0) only loads the first time someone drops in a video.

const MB_URL = '/builder/vendor/mediabunny.1.65.2.min.js';
let mbPromise = null;
const loadMB = () => (mbPromise ||= import(MB_URL));

/* ---------------- sizes ---------------- */
export function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n >= 1048576) return (n / 1048576).toFixed(n >= 10 * 1048576 ? 0 : 1) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}
// "38.2 MB → 4.1 MB, 89% smaller"
export function savedLine(before, after) {
  if (!before || !after) return '';
  const pct = Math.round((1 - after / before) * 100);
  return `${fmtBytes(before)} → ${fmtBytes(after)}` + (pct > 0 ? `, ${pct}% smaller` : '');
}

/* ---------------- video ---------------- */
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

// Can this browser make WebM? (Chrome, Edge and Firefox can; some Safari versions can't.)
export async function videoCodec(w = 1920, h = 1080) {
  try {
    const M = await loadMB();
    for (const c of ['vp9', 'vp8']) if (await M.canEncodeVideo(c, { width: w, height: h })) return c;
  } catch (e) { /* encoder failed to load */ }
  return null;
}

// Converts any video the browser can read (MP4, MOV, WebM) to WebM.
// mode: 'loop' (muted, medium quality), 'background' (muted, high quality) or 'clip' (keeps sound, high quality).
// Long side capped at maxLong (1920), short side at maxShort (1080), frame rate at 30.
export async function compressVideo(file, { mode = 'loop', maxLong = 1920, maxShort = 1080, onProgress, signal } = {}) {
  const M = await loadMB();
  const input = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS });
  let vt;
  try { vt = await input.getPrimaryVideoTrack(); } catch (e) { throw new Error(`Couldn’t read ${file.name}. Try exporting it as an MP4.`); }
  if (!vt) throw new Error(`${file.name} doesn’t have any video in it.`);
  const dw = vt.displayWidth, dh = vt.displayHeight;
  const scale = Math.min(1, maxLong / Math.max(dw, dh), maxShort / Math.min(dw, dh));
  const w = even(dw * scale), h = even(dh * scale);
  let codec = null;
  for (const c of ['vp9', 'vp8']) if (await M.canEncodeVideo(c, { width: w, height: h })) { codec = c; break; }
  if (!codec) { const e = new Error('This browser can’t make WebM video.'); e.code = 'unsupported'; throw e; }
  let fps = 30;
  try { const st = await vt.computePacketStats(90); if (st && st.averagePacketRate) fps = st.averagePacketRate; } catch (e) { /* keep 30 */ }
  // bitrate: a per-mode target for this size and frame rate, and never more than 70% of the original's
  let duration = 0;
  try { duration = await input.computeDuration(); } catch (e) { /* unknown */ }
  const BPP = { loop: 0.045, background: 0.06, clip: 0.07 };
  const target = w * h * Math.min(fps, 30) * (BPP[mode] || 0.05);
  const inBps = duration ? (file.size * 8) / duration : Infinity;
  const bitrate = Math.round(Math.max(500000, Math.min(target, inBps * 0.7)));
  const at = mode === 'clip' ? await input.getPrimaryAudioTrack().catch(() => null) : null;
  const keepAudio = !!at && await M.canEncodeAudio('opus').catch(() => false);
  const output = new M.Output({ format: new M.WebMOutputFormat(), target: new M.BufferTarget() });
  const conv = await M.Conversion.init({
    input, output, tracks: 'primary',
    video: { width: w, height: h, fit: 'fill', codec, bitrate, ...(fps > 31 ? { frameRate: 30 } : {}) },
    audio: keepAudio ? { codec: 'opus', bitrate: 112000 } : { discard: true },
  });
  if (!conv.isValid) throw new Error(`Couldn’t convert ${file.name}. Try exporting it as an MP4.`);
  if (onProgress) conv.onProgress = (p) => onProgress(Math.min(100, Math.round(p * 100)));
  const stop = () => conv.cancel().catch(() => {});
  if (signal) { if (signal.aborted) stop(); signal.addEventListener('abort', stop, { once: true }); }
  await conv.execute();
  const blob = new Blob([output.target.buffer], { type: 'video/webm' });
  return { blob, w, h, codec, audio: keepAudio, duration, bitrate };
}

// First frame of a video as a WebP still, for posters and thumbnails.
export async function videoStill(blob, max = 1600) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.src = URL.createObjectURL(blob);
  try {
    await new Promise((ok, no) => { v.onloadeddata = ok; v.onerror = () => no(new Error('Couldn’t read that video.')); });
    await new Promise((ok) => { v.onseeked = ok; v.currentTime = Math.min(0.1, (v.duration || 1) / 2); });
    const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
    const out = await new Promise((ok) => c.toBlob(ok, 'image/webp', 0.8));
    return { blob: out, w: c.width, h: c.height, vw: v.videoWidth, vh: v.videoHeight };
  } finally { URL.revokeObjectURL(v.src); }
}

/* ---------------- crop ---------------- */
// Shapes offered in the crop step. 'original' is the whole photo; 'free' is any shape.
const RATIOS = [['original', 'Original'], ['free', 'Free'], ['1:1', 'Square'], ['4:5', '4:5'], ['3:2', '3:2'], ['16:9', '16:9'], ['9:16', '9:16']];

const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k);
  return n;
};

// Shows the crop step for each photo. Resolves to [{ file, crop }] in order, where crop is
// { x, y, w, h } in the photo's own pixels or null for the whole photo. Photos the person
// cancels on are left out. `ratio` picks the starting shape, e.g. '1:1' for a bubble.
export async function cropPhotos(files, { ratio = 'original', maxW = 2400 } = {}) {
  const out = [];
  let rest = false;
  for (let i = 0; i < files.length; i++) {
    if (rest) { out.push({ file: files[i], crop: null }); continue; }
    const r = await cropOne(files[i], { ratio, index: i, total: files.length, maxW });
    if (r.action === 'cancel') break;
    if (r.action === 'rest') { rest = true; out.push({ file: files[i], crop: null }); continue; }
    if (r.ratio) ratio = r.ratio; // keep the chosen shape for the next photo
    out.push({ file: files[i], crop: r.crop });
  }
  return out;
}

function cropOne(file, { ratio, index, total, maxW }) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = el('img', { alt: '', draggable: 'false' });
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((d) => el('i', { 'data-h': d }));
    const box = el('div', { class: 'crop-box', tabindex: '0', role: 'group', 'aria-label': 'Crop area. Drag to move, drag the corners to resize. Arrow keys move it.' }, handles);
    const frame = el('div', { class: 'crop-frame' }, img, box);
    const sizeOut = el('span', { class: 'crop-size' });
    const shapeBtns = RATIOS.map(([k, label]) => el('button', { type: 'button', class: 'chip', 'data-r': k, onclick: () => setRatio(k) }, label));
    const done = (res) => { document.removeEventListener('keydown', onKey, true); wrap.remove(); URL.revokeObjectURL(url); resolve(res); };
    const cropBtn = el('button', { type: 'button', class: 'btn primary', onclick: () => done({ action: 'crop', crop: toPixels(), ratio: cur }) }, 'Crop');
    const fullBtn = el('button', { type: 'button', class: 'btn ghost', onclick: () => done({ action: 'crop', crop: null, ratio: cur }) }, 'Use full photo');
    const wrap = el('div', { class: 'modal-wrap crop-wrap', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Crop photo' },
      el('div', { class: 'modal crop-modal' },
        el('div', { class: 'crop-head' }, el('h2', {}, 'Crop photo'), total > 1 ? el('span', { class: 'crop-count' }, `${index + 1} of ${total}`) : null, el('span', { class: 'crop-name' }, file.name)),
        el('div', { class: 'crop-stage' }, frame),
        el('div', { class: 'crop-bar' }, el('div', { class: 'chips crop-shapes', role: 'group', 'aria-label': 'Shape' }, shapeBtns), sizeOut),
        el('div', { class: 'actions' },
          el('button', { type: 'button', class: 'btn ghost', onclick: () => done({ action: 'cancel' }) }, total - index > 1 ? 'Cancel the rest' : 'Cancel'),
          total - index > 1 ? el('button', { type: 'button', class: 'btn ghost', onclick: () => done({ action: 'rest' }) }, 'Use full photos for the rest') : null,
          el('span', { class: 'grow' }),
          fullBtn,
          cropBtn)));

    // rect in fractions of the photo: x, y, w, h (0..1)
    let NW = 1, NH = 1, R = { x: 0, y: 0, w: 1, h: 1 }, cur = 'original';
    const aspect = (k) => {
      if (k === 'original') return NW / NH;
      if (k === 'free') return 0;
      const [a, b] = k.split(':').map(Number);
      return a / b;
    };
    const fitRect = (A) => { // biggest centered rect with pixel aspect A
      let w = 1, h = (NW / A) / NH;
      if (h > 1) { h = 1; w = (NH * A) / NW; }
      return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
    };
    function setRatio(k) {
      cur = k;
      const A = aspect(k);
      if (k === 'original') R = { x: 0, y: 0, w: 1, h: 1 };
      else if (A) R = fitRect(A);
      shapeBtns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.r === k ? 'true' : 'false'));
      box.classList.toggle('free', !A);
      paint();
    }
    const toPixels = () => {
      const c = { x: Math.round(R.x * NW), y: Math.round(R.y * NH), w: Math.round(R.w * NW), h: Math.round(R.h * NH) };
      return c.w >= NW - 1 && c.h >= NH - 1 ? null : c;
    };
    function paint() {
      box.style.left = R.x * 100 + '%'; box.style.top = R.y * 100 + '%';
      box.style.width = R.w * 100 + '%'; box.style.height = R.h * 100 + '%';
      const pw = R.w * NW, ph = R.h * NH, s = Math.min(1, maxW / pw);
      sizeOut.textContent = `${Math.round(pw * s)} × ${Math.round(ph * s)} px`;
      cropBtn.textContent = toPixels() ? 'Crop' : 'Use full photo';
      fullBtn.hidden = !toPixels();
    }

    // dragging
    let drag = null;
    box.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const fr = frame.getBoundingClientRect();
      drag = { h: e.target.dataset.h || 'move', sx: e.clientX, sy: e.clientY, r0: { ...R }, fw: fr.width, fh: fr.height };
      box.setPointerCapture(e.pointerId);
      box.classList.add('dragging');
    });
    box.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = (e.clientX - drag.sx) / drag.fw, dy = (e.clientY - drag.sy) / drag.fh;
      const r0 = drag.r0, A = aspect(cur);
      const MIN = 32 / Math.min(drag.fw, drag.fh);
      if (drag.h === 'move') {
        R = { ...r0, x: Math.min(1 - r0.w, Math.max(0, r0.x + dx)), y: Math.min(1 - r0.h, Math.max(0, r0.y + dy)) };
      } else if (!A) {
        let { x, y, w, h } = r0;
        if (drag.h.includes('w')) { const nx = Math.min(r0.x + r0.w - MIN, Math.max(0, r0.x + dx)); w = r0.x + r0.w - nx; x = nx; }
        if (drag.h.includes('e')) w = Math.min(1 - r0.x, Math.max(MIN, r0.w + dx));
        if (drag.h.includes('n')) { const ny = Math.min(r0.y + r0.h - MIN, Math.max(0, r0.y + dy)); h = r0.y + r0.h - ny; y = ny; }
        if (drag.h.includes('s')) h = Math.min(1 - r0.y, Math.max(MIN, r0.h + dy));
        R = { x, y, w, h };
      } else {
        // locked shape: corners scale from the opposite corner, edges from the opposite edge's middle
        const k = (NW / NH) / A; // h-fraction per w-fraction
        const hz = drag.h.includes('e') ? 1 : drag.h.includes('w') ? -1 : 0;
        const vt = drag.h.includes('s') ? 1 : drag.h.includes('n') ? -1 : 0;
        let w;
        if (hz && vt) w = Math.max(r0.w + hz * dx, (r0.h + vt * dy) / k);
        else if (hz) w = r0.w + hz * dx;
        else w = (r0.h + vt * dy) / k;
        const ax = hz > 0 ? r0.x : hz < 0 ? r0.x + r0.w : r0.x + r0.w / 2;
        const ay = vt > 0 ? r0.y : vt < 0 ? r0.y + r0.h : r0.y + r0.h / 2;
        const roomW = hz > 0 ? 1 - ax : hz < 0 ? ax : 2 * Math.min(ax, 1 - ax);
        const roomH = vt > 0 ? 1 - ay : vt < 0 ? ay : 2 * Math.min(ay, 1 - ay);
        w = Math.max(MIN, Math.min(w, roomW, roomH / k));
        const h = w * k;
        R = { w, h, x: hz > 0 ? ax : hz < 0 ? ax - w : ax - w / 2, y: vt > 0 ? ay : vt < 0 ? ay - h : ay - h / 2 };
      }
      paint();
    });
    const end = () => { drag = null; box.classList.remove('dragging'); };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done({ action: 'cancel' }); return; }
      if (e.key === 'Enter' && document.activeElement && document.activeElement.tagName !== 'BUTTON') { e.preventDefault(); cropBtn.click(); return; }
      if (document.activeElement !== box) return;
      const step = e.shiftKey ? 0.05 : 0.01;
      const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!mv) return;
      e.preventDefault();
      R = { ...R, x: Math.min(1 - R.w, Math.max(0, R.x + mv[0])), y: Math.min(1 - R.h, Math.max(0, R.y + mv[1])) };
      paint();
    }
    document.addEventListener('keydown', onKey, true);

    img.onload = () => {
      NW = img.naturalWidth; NH = img.naturalHeight;
      setRatio(start);
      box.focus();
    };
    img.onerror = () => done({ action: 'crop', crop: null }); // can't show it (HEIC on Chrome, say); let the upload step explain
    const start = RATIOS.some(([k]) => k === ratio) ? ratio : 'original';
    shapeBtns.forEach((b) => b.setAttribute('aria-pressed', b.dataset.r === start ? 'true' : 'false'));
    img.src = url;
    document.body.append(wrap);
  });
}
