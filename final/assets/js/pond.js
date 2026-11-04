/* The pond: one pixel koi for every project. Colour is the discipline (lavender for programming,
   chartreuse for engineering, pink for art), length grows with the number of images, and the
   featured projects swim in gold. Point at a fish to see its project and click to open it (on a
   touch screen, tap once to see it and again to open). Click open water to drop food.
   Drawn into a small pixel buffer with Canvas 2D and scaled up with hard edges. It pauses
   off-screen, and with reduced motion it holds one still frame. */
(function () {
  'use strict';
  const host = document.querySelector('[data-pond]');
  const src = document.getElementById('rlg-index');
  if (!host || !src) return;
  let projects = [];
  try { projects = JSON.parse(src.textContent) || []; } catch (err) { return; }
  if (!projects.length) return;
  const tip = document.getElementById('pond-tip');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.insertBefore(canvas, host.firstChild);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  const TAU = Math.PI * 2;
  const SEGS = 8;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a <= -Math.PI) a += TAU; return a; };
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const pack = (c) => ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
  const col = (h) => pack(hex(h));
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  const SKIN = {
    program: { body: '#aba2d4', patch: '#412db5', fin: '#8173cc' },
    engineer: { body: '#e9ff97', patch: '#2d2178', fin: '#c5dc5f' },
    art: { body: '#e5197f', patch: '#fcfff0', fin: '#ff6fb0' },
  };
  const GOLD = { body: '#ffc94a', fin: '#ffe08a', patch: { program: '#412db5', engineer: '#7f9a2e', art: '#e5197f' } };
  const K = {
    shadow: col('#100c30'), eye: col('#0f0e19'), pad: col('#b9d454'), padEdge: col('#86a131'), padVein: col('#dcf38a'),
    padShadow: col('#110d33'), petal: col('#e5197f'), petalLight: col('#ff8fc4'), seed: col('#ffc94a'),
    food: col('#ffc94a'), foodDark: col('#b8801a'),
  };
  const LAV = hex('#aba2d4'), PAPER = hex('#fcfff0'), RIPPLE = hex('#c9c2f0');

  /* ---------------------------------------------------------------- buffer */
  let W = 0, H = 0, S = 4, img = null, buf = null, bg = null;
  let A = null, B = null, Cs = null, Ds = null;
  let padPx = [], padSh = [];
  function mix(i, c, a) {
    const v = buf[i];
    const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255;
    buf[i] = ((255 << 24) | ((b + (c[2] - b) * a) << 16) | ((g + (c[1] - g) * a) << 8) | (r + (c[0] - r) * a)) >>> 0;
  }
  function hline(x0, x1, y, c) {
    if (y < 0 || y >= H) return;
    if (x0 < 0) x0 = 0;
    if (x1 > W - 1) x1 = W - 1;
    const row = y * W;
    for (let x = x0; x <= x1; x++) buf[row + x] = c;
  }
  /* pixels whose centres fall inside the circle */
  function disc(cx, cy, r, c) {
    const R = r + 0.3;
    const y0 = Math.ceil(cy - R - 0.5), y1 = Math.floor(cy + R - 0.5);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      const h = R * R - dy * dy;
      if (h < 0) continue;
      const w = Math.sqrt(h);
      hline(Math.ceil(cx - w - 0.5), Math.floor(cx + w - 0.5), y, c);
    }
  }
  function tri(ax, ay, bx, by, cx, cy, c) {
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx, cx)));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by, cy)));
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 0.05) return;
    const sgn = area > 0 ? 1 : -1;
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        const e0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) * sgn;
        const e1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) * sgn;
        const e2 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) * sgn;
        if (e0 >= 0 && e1 >= 0 && e2 >= 0) buf[y * W + x] = c;
      }
    }
  }
  function ring(cx, cy, r, c, a, dashed) {
    const n = Math.max(10, Math.ceil(r * 7));
    let prev = -1;
    for (let k = 0; k < n; k++) {
      if (dashed && (k % 4) > 1) continue;
      const ang = (k / n) * TAU;
      const x = Math.floor(cx + Math.cos(ang) * r), y = Math.floor(cy + Math.sin(ang) * r);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (i === prev) continue;
      prev = i;
      mix(i, c, a);
    }
  }

  /* the water floor: a gradient, scattered pebbles and darker edges, made once per size */
  function buildBg() {
    bg = new Uint32Array(W * H);
    const top = hex('#2a2066'), bot = hex('#140f38'), dark = hex('#0d0a28'), peb = hex('#33287a');
    const r = rng(99);
    for (let y = 0; y < H; y++) {
      const k = H > 1 ? y / (H - 1) : 0;
      const base = [0, 1, 2].map((j) => top[j] + (bot[j] - top[j]) * k);
      for (let x = 0; x < W; x++) {
        let c = base;
        const n = r();
        if (n < 0.016) c = base.map((v, j) => v + (dark[j] - v) * 0.6);
        else if (n < 0.024) c = base.map((v, j) => v + (peb[j] - v) * 0.7);
        const d = Math.min(x, y, W - 1 - x, H - 1 - y);
        if (d < 4) c = c.map((v, j) => v + (dark[j] - v) * ((4 - d) / 6));
        bg[y * W + x] = pack(c.map(Math.round));
      }
    }
  }

  /* lily pads with a notch and veins, a few with a lotus; stored as pixel lists */
  function buildPads() {
    padPx = []; padSh = [];
    const r = rng(7);
    const R0 = clamp(Math.min(W, H) * 0.085, 5, 13);
    const spots = [[0.09, 0.2], [0.91, 0.24], [0.83, 0.87], [0.2, 0.85], [0.6, 0.11]];
    const seen = new Set();
    spots.forEach(([fx, fy], k) => {
      const R = R0 * (0.8 + r() * 0.45);
      const cx = fx * W, cy = fy * H, notch = r() * TAU;
      for (let y = Math.floor(cy - R - 1); y <= Math.ceil(cy + R + 1); y++) {
        for (let x = Math.floor(cx - R - 1); x <= Math.ceil(cx + R + 1); x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
          if (d > R) continue;
          const ang = Math.atan2(dy, dx);
          if (Math.abs(wrap(ang - notch)) < 0.34 && d > R * 0.12) continue;
          const i = y * W + x;
          if (seen.has(i)) continue;
          seen.add(i);
          let c = K.pad;
          if (d > R - 1.1) c = K.padEdge;
          else if (d > R * 0.2 && Math.abs(wrap((ang - notch) * 7) ) < 0.45) c = K.padVein;
          padPx.push(i, c);
          const sx = x + 1, sy = y + 2;
          if (sx < W && sy < H) padSh.push(sy * W + sx);
        }
      }
      if (k === 1 || k === 3) {           // a lotus sits on two of them
        const fx2 = Math.round(cx + Math.cos(notch + Math.PI) * R * 0.3), fy2 = Math.round(cy + Math.sin(notch + Math.PI) * R * 0.3);
        const put = (dx, dy, c) => { const x = fx2 + dx, y = fy2 + dy; if (x >= 0 && y >= 0 && x < W && y < H) padPx.push(y * W + x, c); };
        [[0, -2], [-2, 0], [2, 0], [0, 2]].forEach(([dx, dy]) => put(dx, dy, K.petal));
        [[0, -1], [-1, 0], [1, 0], [0, 1]].forEach(([dx, dy]) => put(dx, dy, K.petalLight));
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => put(dx, dy, K.petal));
        put(0, 0, K.seed);
      }
    });
  }

  /* ---------------------------------------------------------------- fish */
  const fish = projects.map((p) => {
    const r = rng(hash(p.s));
    const cat = SKIN[p.c && p.c[0]] ? p.c[0] : 'program';
    const skin = SKIN[cat];
    const len = clamp(9 + 3 * Math.sqrt(Math.max(1, p.i || 1)), 11, 22);
    const patches = [];
    const np = 1 + Math.floor(r() * 3);
    for (let k = 0; k < np; k++) { const u0 = 0.06 + r() * 0.55; patches.push([u0, u0 + 0.14 + r() * 0.2, Math.floor(r() * 3) - 1]); }
    return {
      p, len, half: len * 0.2, seg: len / (SEGS - 1), patches,
      body: col(p.f ? GOLD.body : skin.body), fin: col(p.f ? GOLD.fin : skin.fin), patch: col(p.f ? GOLD.patch[cat] : skin.patch),
      x: 0, y: 0, a: r() * TAU, v: 0, base: 3 + r() * 3.4, wob: r() * TAU, wander: r() * 100, spine: [],
    };
  });
  const prof = (u) => (u < 0.3 ? 0.72 + u : 1 - ((u - 0.3) / 0.7) * 0.82);
  function place(f) {
    f.x = 6 + Math.random() * Math.max(1, W - 12);
    f.y = 6 + Math.random() * Math.max(1, H - 12);
    f.spine = [];
    for (let i = 0; i < SEGS; i++) f.spine.push([f.x - Math.cos(f.a) * f.seg * i, f.y - Math.sin(f.a) * f.seg * i]);
  }

  function drawFish(f, shadow) {
    const sp = f.spine;
    const ox = shadow ? 2 : 0, oy = shadow ? 3 : 0;
    const body = shadow ? K.shadow : f.body, fin = shadow ? K.shadow : f.fin;
    let hx = sp[0][0] - sp[1][0], hy = sp[0][1] - sp[1][1];
    let hl = Math.hypot(hx, hy) || 1; hx /= hl; hy /= hl;
    let tx = sp[SEGS - 1][0] - sp[SEGS - 2][0], ty = sp[SEGS - 1][1] - sp[SEGS - 2][1];
    let tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    // tail fin: a forked fan that wags
    const T = sp[SEGS - 1], Lf = f.len * 0.3, wag = Math.sin(f.wob * 1.1) * 0.35;
    const fan = (s) => { const ang = Math.atan2(ty, tx) + s * 0.55 + wag; return [T[0] + Math.cos(ang) * Lf + ox, T[1] + Math.sin(ang) * Lf + oy]; };
    const l = fan(-1), r = fan(1);
    const mid = [T[0] + Math.cos(Math.atan2(ty, tx) + wag) * Lf * 0.55 + ox, T[1] + Math.sin(Math.atan2(ty, tx) + wag) * Lf * 0.55 + oy];
    tri(T[0] + ox, T[1] + oy, l[0], l[1], mid[0], mid[1], fin);
    tri(T[0] + ox, T[1] + oy, mid[0], mid[1], r[0], r[1], fin);
    // pectoral fins
    const P = sp[1], pr = f.half * prof(1 / (SEGS - 1)), nx = -hy, ny = hx, flap = 0.75 + Math.sin(f.wob * 1.4) * 0.3, fl = f.half * 1.5;
    [1, -1].forEach((s) => {
      const bx = P[0] + nx * s * pr * 0.6 + ox, by = P[1] + ny * s * pr * 0.6 + oy;
      const tipx = bx + (nx * s * Math.cos(flap) - hx * Math.sin(flap)) * fl, tipy = by + (ny * s * Math.cos(flap) - hy * Math.sin(flap)) * fl;
      tri(bx, by, bx - hx * 2, by - hy * 2, tipx, tipy, fin);
    });
    // body: discs stamped along the spine
    for (let i = 0; i < SEGS - 1; i++) {
      const a = sp[i], b = sp[i + 1];
      for (let s = 0; s < 1; s += 0.34) {
        const u = (i + s) / (SEGS - 1);
        disc(a[0] + (b[0] - a[0]) * s + ox, a[1] + (b[1] - a[1]) * s + oy, f.half * prof(u), body);
      }
    }
    if (shadow) return;
    // patches
    f.patches.forEach(([u0, u1, side]) => {
      for (let u = u0; u < Math.min(0.95, u1); u += 0.05) {
        const fi = u * (SEGS - 1), i = Math.min(SEGS - 2, Math.floor(fi)), s = fi - i;
        const a = sp[i], b = sp[i + 1];
        const dx = b[0] - a[0], dy = b[1] - a[1], dl = Math.hypot(dx, dy) || 1;
        const rr = f.half * prof(u);
        const px = a[0] + dx * s + (-dy / dl) * side * rr * 0.35, py = a[1] + dy * s + (dx / dl) * side * rr * 0.35;
        disc(px, py, rr * 0.62, f.patch);
      }
    });
    // eyes
    const r0 = f.half * prof(0);
    const ex = sp[0][0] + hx * r0 * 0.25, ey = sp[0][1] + hy * r0 * 0.25;
    [1, -1].forEach((s) => {
      const x = Math.floor(ex + nx * s * r0 * 0.62), y = Math.floor(ey + ny * s * r0 * 0.62);
      if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = K.eye;
    });
  }

  /* ---------------------------------------------------------------- simulation */
  const food = [], ripples = [];
  const pointer = { in: false, x: 0, y: 0, still: 0, rx: -99, ry: -99, rt: 0 };
  let hover = null, picked = null, t = 0;
  function feed(x, y) {
    for (let k = 0; k < 3 && food.length < 14; k++) food.push({ x: clamp(x + (Math.random() - 0.5) * 4, 1, W - 2), y: clamp(y + (Math.random() - 0.5) * 4, 1, H - 2), age: 0 });
    ripples.push({ x, y, r: 0.5, max: 10, life: 1 });
    kick();
  }
  function step(dt) {
    t += dt;
    for (let i = food.length - 1; i >= 0; i--) { food[i].age += dt; if (food[i].age > 14) food.splice(i, 1); }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.r += dt * 9;
      rp.life = 1 - rp.r / rp.max;
      if (rp.life <= 0) ripples.splice(i, 1);
    }
    if (pointer.in) pointer.still += dt;
    fish.forEach((f) => {
      const steer = (ang, k) => { f.a += wrap(ang - f.a) * Math.min(1, k * dt); };
      f.wander += dt;
      f.a += (Math.sin(f.wander * 1.3 + f.base) * 0.7 + Math.sin(f.wander * 0.41) * 0.5) * dt;
      let speed = f.base;
      const m = 9;
      if (f.x < m || f.x > W - m || f.y < m || f.y > H - m) steer(Math.atan2(H / 2 - f.y, W / 2 - f.x), 2.6);
      for (let j = 0; j < fish.length; j++) {
        const g = fish[j];
        if (g === f) continue;
        const dx = f.x - g.x, dy = f.y - g.y, d2 = dx * dx + dy * dy;
        if (d2 < 30 && d2 > 0.01) steer(Math.atan2(dy, dx), 0.9);
      }
      let target = null, best = 72 * 72;
      food.forEach((fd) => { const dx = fd.x - f.x, dy = fd.y - f.y, d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; target = fd; } });
      if (target) {
        steer(Math.atan2(target.y - f.y, target.x - f.x), 4.2);
        speed = f.base * 2.6;
        if (best < 5) {
          food.splice(food.indexOf(target), 1);
          ripples.push({ x: target.x, y: target.y, r: 0.5, max: 5, life: 1 });
        }
      } else if (pointer.in && pointer.still > 0.7) {
        const dx = pointer.x - f.x, dy = pointer.y - f.y;
        if (dx * dx + dy * dy < 34 * 34) { steer(Math.atan2(dy, dx), 0.8); speed *= 0.7; }
      }
      if (f === hover || f === picked) speed *= 0.12;
      f.v += (speed - f.v) * Math.min(1, dt * 2);
      f.wob += dt * (2.2 + f.v * 0.9);
      const swim = f.a + Math.sin(f.wob) * 0.2;
      f.x = clamp(f.x + Math.cos(swim) * f.v * dt, 1, W - 1);
      f.y = clamp(f.y + Math.sin(swim) * f.v * dt, 1, H - 1);
      const sp = f.spine;
      sp[0][0] = f.x; sp[0][1] = f.y;
      for (let i = 1; i < SEGS; i++) {
        const a = sp[i - 1], b = sp[i];
        const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
        b[0] = a[0] + (dx / d) * f.seg; b[1] = a[1] + (dy / d) * f.seg;
      }
    });
  }

  function caustics() {
    for (let x = 0; x < W; x++) A[x] = Math.sin(x * 0.29 + t * 0.9);
    for (let y = 0; y < H; y++) B[y] = Math.sin(y * 0.41 - t * 0.7);
    for (let k = 0; k < W + H; k++) { Cs[k] = Math.sin(k * 0.17 + t * 0.45); Ds[k] = Math.sin(k * 0.23 - t * 0.6); }
    for (let y = 0; y < H; y++) {
      const row = y * W, b = B[y];
      for (let x = 0; x < W; x++) {
        const v = A[x] + b + Cs[x + y] + Ds[x - y + H];
        if (v > 2.6) mix(row + x, LAV, 0.16);
        else if (v > 2.15) mix(row + x, LAV, 0.07);
      }
    }
  }

  function draw() {
    if (!buf) return;
    buf.set(bg);
    caustics();
    for (let i = 0; i < padSh.length; i++) buf[padSh[i]] = K.padShadow;
    fish.forEach((f) => drawFish(f, true));
    fish.forEach((f) => drawFish(f, false));
    ripples.forEach((rp) => ring(rp.x, rp.y, rp.r, RIPPLE, 0.55 * rp.life, false));
    for (let i = 0; i < padPx.length; i += 2) buf[padPx[i]] = padPx[i + 1];
    food.forEach((fd) => {
      const x = Math.floor(fd.x), y = Math.floor(fd.y);
      const c = fd.age > 11 ? K.foodDark : K.food;
      hline(x, x + 1, y, c);
      hline(x, x, y + 1, c);
      hline(x + 1, x + 1, y + 1, K.foodDark);
    });
    [hover, picked].forEach((f) => {
      if (!f) return;
      const m = f.spine[Math.floor(SEGS / 2)];
      ring(m[0], m[1], f.len * 0.62 + 1, PAPER, 0.95, true);
    });
    ctx.putImageData(img, 0, 0);
  }

  /* ---------------------------------------------------------------- size */
  function resize() {
    const cw = host.clientWidth, ch = host.clientHeight;
    if (!cw || !ch) return;
    const s = cw < 600 ? 2 : Math.max(3, Math.round(cw / 300));   // finer pixels on narrow ponds, so 32 koi still have room
    const w = Math.ceil(cw / s), h = Math.ceil(ch / s);
    if (w === W && h === H && s === S && buf) return;
    const first = !buf;
    const sx = W ? w / W : 1, sy = H ? h / H : 1;
    W = w; H = h; S = s;
    canvas.width = W; canvas.height = H;
    canvas.style.width = `${W * S}px`;
    canvas.style.height = `${H * S}px`;
    img = ctx.createImageData(W, H);
    buf = new Uint32Array(img.data.buffer);
    A = new Float32Array(W); B = new Float32Array(H); Cs = new Float32Array(W + H + 1); Ds = new Float32Array(W + H + 1);
    buildBg();
    buildPads();
    if (first) fish.forEach(place);
    else fish.forEach((f) => { f.spine.forEach((p) => { p[0] = clamp(p[0] * sx, 1, W - 1); p[1] = clamp(p[1] * sy, 1, H - 1); }); f.x = f.spine[0][0]; f.y = f.spine[0][1]; });
    food.length = 0;
    ripples.length = 0;
    if (reduced.matches && first) for (let i = 0; i < 40; i++) step(0.05);   // settle into a natural pose
    draw();
  }

  /* ---------------------------------------------------------------- input */
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S }; };
  function hit(x, y) {
    let best = null, bd = Infinity;
    fish.forEach((f) => {
      f.spine.forEach((p, i) => {
        const d = Math.hypot(p[0] - x, p[1] - y) - (f.half * prof(i / (SEGS - 1)) + 1.6);
        if (d < 0 && d < bd) { bd = d; best = f; }
      });
    });
    return best;
  }
  const CAT = { program: 'PRG', engineer: 'ENG', art: 'ART' };
  function setTip(f, touch) {
    if (!tip) return;
    if (!f) { tip.classList.add('is-idle'); return; }
    const p = f.p;
    tip.textContent = `${p.n} · ${p.t.toUpperCase()} · ${(p.c || []).map((c) => CAT[c] || c).join(' · ')} · ${p.d.slice(0, 4)}${p.f ? ' · FEATURED' : ''} — ${touch ? 'tap again to open' : 'click to open'}`;
    tip.classList.remove('is-idle');
  }
  let downType = 'mouse';
  canvas.addEventListener('pointerdown', (e) => { downType = e.pointerType || 'mouse'; });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const p = local(e);
    if (Math.hypot(p.x - pointer.x, p.y - pointer.y) > 0.6) pointer.still = 0;
    pointer.in = true; pointer.x = p.x; pointer.y = p.y;
    const now = performance.now();
    if (!reduced.matches && Math.hypot(p.x - pointer.rx, p.y - pointer.ry) > 6 && now - pointer.rt > 140 && ripples.length < 24) {
      ripples.push({ x: p.x, y: p.y, r: 0.5, max: 4, life: 1 });
      pointer.rx = p.x; pointer.ry = p.y; pointer.rt = now;
    }
    const f = hit(p.x, p.y);
    if (f !== hover) { hover = f; setTip(f, false); host.style.cursor = f ? 'pointer' : ''; kick(); }
  });
  canvas.addEventListener('pointerleave', () => {
    pointer.in = false;
    if (hover) { hover = null; host.style.cursor = ''; if (!picked) setTip(null); kick(); }
  });
  canvas.addEventListener('click', (e) => {
    const p = local(e);
    const f = hit(p.x, p.y);
    if (f) {
      if (downType !== 'mouse' && picked !== f) { picked = f; setTip(f, true); kick(); return; }
      location.href = `project.php?id=${encodeURIComponent(f.p.s)}`;
      return;
    }
    if (picked) { picked = null; setTip(null); }
    if (!reduced.matches) feed(p.x, p.y);
    else kick();
  });

  /* ---------------------------------------------------------------- loop */
  let alive = false, last = 0, raf = 0, timer = 0;
  const onScreen = () => {
    const r = host.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight);
  };
  function loop() {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    raf = timer = 0;
    if (!alive) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (onScreen()) {
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
      timer = setTimeout(loop, 120);
    } else {
      timer = setTimeout(loop, 400);
    }
  }
  function start() {
    if (alive || reduced.matches || document.hidden) return;
    alive = true;
    last = performance.now();
    loop();
  }
  function stop() { alive = false; cancelAnimationFrame(raf); clearTimeout(timer); }
  const kick = () => { if (!alive) draw(); };

  if ('ResizeObserver' in window) new ResizeObserver(() => resize()).observe(host);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  const onMotion = () => { if (reduced.matches) stop(); else start(); };
  if (reduced.addEventListener) reduced.addEventListener('change', onMotion); else if (reduced.addListener) reduced.addListener(onMotion);
  if (tip) tip.classList.add('is-idle');
  host.classList.add('is-live');
  resize();
  start();
})();
