// The site's cursor dot field (see 404.html / index.html), redrawn on a 2D canvas so the
// builder login doesn't need three.js. A grid of red dots, 18px apart, swells along the
// cursor's trail and fades back out. Same numbers as the site's shader: 100px glow radius,
// strength from cursor speed, 2% fade per frame, smoothstep(0.1, 0.4) for dot size.

const GAP = 18;
const MAX_DOT = 7; // px across at full strength
const COLOR = '#ff142d';

export function dotField() {
  const canvas = document.createElement('canvas');
  canvas.className = 'login-dots';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, cols = 0, rows = 0, sx = GAP, sy = GAP, v = new Float32Array(0);
  let mouse = null, prev = null, last = 0, live = false;
  const radius = () => (matchMedia('(pointer: coarse)').matches ? 75 : 100);

  function size() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.max(1, Math.floor(w / GAP)); rows = Math.max(1, Math.floor(h / GAP));
    sx = w / cols; sy = h / rows;
    v = new Float32Array((cols + 1) * (rows + 1));
  }

  function move(e) {
    const r = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!prev) prev = { ...mouse };
    wake();
  }

  function wake() {
    if (live || !canvas.isConnected) return;
    live = true; last = performance.now();
    requestAnimationFrame(tick);
  }

  function tick(now) {
    if (!canvas.isConnected) { stop(); return; }
    const dt = Math.min((now - last) / 16.667, 4); last = now;
    // fade everything a little
    const keep = Math.pow(0.98, dt);
    let any = false;
    for (let i = 0; i < v.length; i++) { v[i] *= keep; if (v[i] > 0.1) any = true; }
    // add a glow where the cursor is, stronger the faster it moves
    if (mouse) {
      const dist = Math.hypot(mouse.x - prev.x, mouse.y - prev.y);
      prev = { ...mouse };
      const a = Math.min(dist * 0.05, 1);
      if (a > 0) {
        const R = radius();
        const c0 = Math.max(0, Math.floor((mouse.x - R) / sx)), c1 = Math.min(cols, Math.ceil((mouse.x + R) / sx));
        const r0 = Math.max(0, Math.floor((mouse.y - R) / sy)), r1 = Math.min(rows, Math.ceil((mouse.y + R) / sy));
        for (let j = r0; j <= r1; j++) {
          for (let i = c0; i <= c1; i++) {
            const d = Math.hypot(i * sx - mouse.x, j * sy - mouse.y) / R;
            if (d >= 1) continue;
            const g = 1 - 0.9 * d * d; // the falloff of the site's glow.png
            const k = j * (cols + 1) + i;
            if (g > v[k]) v[k] += a * (g - v[k]);
            if (v[k] > 0.1) any = true;
          }
        }
      }
    }
    ctx.clearRect(0, 0, w, h);
    if (any) {
      ctx.fillStyle = COLOR;
      ctx.beginPath();
      for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= cols; i++) {
          const x = v[j * (cols + 1) + i];
          if (x <= 0.1) continue;
          const t = x >= 0.4 ? 1 : ((x - 0.1) / 0.3) ** 2 * (3 - 2 * ((x - 0.1) / 0.3));
          const r = (MAX_DOT / 2) * t;
          const cx = i * sx, cy = j * sy;
          ctx.moveTo(cx + r, cy);
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      requestAnimationFrame(tick);
    } else {
      live = false; // nothing left to draw; the next pointer move wakes it
    }
  }

  const ro = 'ResizeObserver' in window ? new ResizeObserver(size) : null;
  function stop() {
    live = false;
    window.removeEventListener('pointermove', move);
    if (ro) ro.disconnect(); else window.removeEventListener('resize', size);
  }
  window.addEventListener('pointermove', move, { passive: true });
  if (ro) ro.observe(canvas); else window.addEventListener('resize', size);
  requestAnimationFrame(size);
  return canvas;
}
