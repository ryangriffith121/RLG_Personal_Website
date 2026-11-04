/* The pond: one koi for every project. Colour is the discipline (lavender for programming,
   chartreuse for engineering, pink for art), and the featured projects swim in gold. Size follows
   the number of images: the koi with the most is about two and a half times as long as the one with
   the fewest. Point at a fish to see its project and click to open it (on a touch screen, tap once
   to see it and again to open). Click open water to drop food.
   Everything is drawn as smooth vector shapes with Canvas 2D at the screen's own pixel density, in
   "pond units" so the swimming feels the same at every size. It pauses off-screen, and with
   reduced motion it holds one still frame. */
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
  const floor = document.createElement('canvas');          // the pond floor, drawn once per size
  const fctx = floor.getContext('2d');

  const TAU = Math.PI * 2;
  const SEGS = 10;                                           // points along each koi's spine
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a <= -Math.PI) a += TAU; return a; };
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
  const C = {
    top: '#2a2066', bottom: '#140f38', stoneDark: 'rgba(13, 10, 40, 0.5)', stoneLight: 'rgba(58, 46, 138, 0.5)',
    glint: '#c9c2f0', shadow: 'rgba(9, 6, 30, 0.5)', eye: '#0f0e19',
    pad: '#b9d454', padEdge: '#86a131', padVein: '#dcf38a', padShadow: 'rgba(9, 6, 30, 0.45)',
    petal: '#e5197f', petalLight: '#ff8fc4', seed: '#ffc94a', food: '#ffc94a', foodDark: '#b8801a', ripple: '#c9c2f0', ring: '#fcfff0',
  };

  /* ---------------------------------------------------------------- size */
  // the pond is measured in units of `U` CSS pixels: 2 on a phone, a 300-unit-wide pond from 900px up
  let W = 0, H = 0, U = 4, D = 4, cw0 = 0, ch0 = 0, dpr0 = 0;

  /* ---------------------------------------------------------------- fish */
  // length follows the number of images on a log scale, stretched over the range in the data
  const LEN_MIN = 10, LEN_MAX = 24;
  const imgs = projects.map((p) => Math.max(1, p.i || 1));
  const lo = Math.log(Math.min(...imgs)), hi = Math.log(Math.max(...imgs));
  const fish = projects.map((p, n) => {
    const r = rng(hash(p.s));
    const cat = SKIN[p.c && p.c[0]] ? p.c[0] : 'program';
    const skin = SKIN[cat];
    const k = hi > lo ? (Math.log(imgs[n]) - lo) / (hi - lo) : 0.5;
    const len = LEN_MIN + (LEN_MAX - LEN_MIN) * k;
    const patches = [];
    const np = 1 + Math.floor(r() * 3);
    for (let j = 0; j < np; j++) { const u0 = 0.08 + r() * 0.5; patches.push([u0, u0 + 0.14 + r() * 0.22, Math.floor(r() * 3) - 1, r() * TAU]); }
    return {
      p, k, len, half: len * (0.14 + 0.02 * k), seg: len / (SEGS - 1), sh: 1.4 + len * 0.03, patches,
      body: p.f ? GOLD.body : skin.body, fin: p.f ? GOLD.fin : skin.fin, patch: p.f ? GOLD.patch[cat] : skin.patch,
      x: 0, y: 0, a: r() * TAU, v: 0, base: (2.6 + r() * 3) * (0.8 + 0.45 * k), wob: r() * TAU, wander: r() * 100, spine: [],
    };
  });
  fish.sort((a, b) => b.len - a.len);      // the big koi swim deeper, so the small ones stay in sight

  // half-width along the body (0 = nose, 1 = tail root): a round head, widest a third of the way back
  const prof = (u) => (u < 0.32 ? 0.66 + 0.34 * Math.sin((u / 0.32) * Math.PI / 2) : 0.16 + 0.84 * Math.cos(((u - 0.32) / 0.68) * Math.PI / 2));
  // a point on the spine with the heading (fx, fy), the sideways normal (nx, ny) and the half-width
  function at(f, u) {
    const sp = f.spine, fi = clamp(u, 0, 1) * (SEGS - 1), i = Math.min(SEGS - 2, Math.floor(fi)), s = fi - i;
    const a = sp[i], b = sp[i + 1];
    let fx = a[0] - b[0], fy = a[1] - b[1];
    const d = Math.hypot(fx, fy) || 1; fx /= d; fy /= d;
    return { x: a[0] + (b[0] - a[0]) * s, y: a[1] + (b[1] - a[1]) * s, fx, fy, nx: -fy, ny: fx, w: f.half * prof(u) };
  }
  function place(f) {
    const m = Math.min(W, H) * 0.12;
    f.x = m + Math.random() * Math.max(1, W - 2 * m);
    f.y = m + Math.random() * Math.max(1, H - 2 * m);
    f.spine = [];
    for (let i = 0; i < SEGS; i++) f.spine.push([f.x - Math.cos(f.a) * f.seg * i, f.y - Math.sin(f.a) * f.seg * i]);
  }

  /* Each shape below adds clockwise sub-paths to the current path, so a whole koi can be filled in
     one go (for its shadow) without the overlaps cancelling out. */
  function bodyPath(f, ox, oy) {
    const sp = f.spine, n = SEGS, Ls = [], Rs = [];
    let hx = 1, hy = 0, w0 = 1, bx = -1, by = 0, wt = 1;
    for (let i = 0; i < n; i++) {
      const a = sp[i > 0 ? i - 1 : 0], b = sp[i < n - 1 ? i + 1 : n - 1];
      let fx = a[0] - b[0], fy = a[1] - b[1];
      const d = Math.hypot(fx, fy) || 1; fx /= d; fy /= d;
      const w = f.half * prof(i / (n - 1)), x = sp[i][0] + ox, y = sp[i][1] + oy;
      Ls.push([x - fy * w, y + fx * w]);
      Rs.push([x + fy * w, y - fx * w]);
      if (i === 0) { hx = fx; hy = fy; w0 = w; }
      if (i === n - 1) { bx = -fx; by = -fy; wt = w; }
    }
    const k = w0 * 1.35, T = sp[n - 1];
    ctx.moveTo(Rs[0][0], Rs[0][1]);
    ctx.bezierCurveTo(Rs[0][0] + hx * k, Rs[0][1] + hy * k, Ls[0][0] + hx * k, Ls[0][1] + hy * k, Ls[0][0], Ls[0][1]);   // the nose
    for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(Ls[i][0], Ls[i][1], (Ls[i][0] + Ls[i + 1][0]) / 2, (Ls[i][1] + Ls[i + 1][1]) / 2);
    ctx.lineTo(Ls[n - 1][0], Ls[n - 1][1]);
    ctx.quadraticCurveTo(T[0] + ox + bx * wt * 1.6, T[1] + oy + by * wt * 1.6, Rs[n - 1][0], Rs[n - 1][1]);
    for (let i = n - 2; i > 0; i--) ctx.quadraticCurveTo(Rs[i][0], Rs[i][1], (Rs[i][0] + Rs[i - 1][0]) / 2, (Rs[i][1] + Rs[i - 1][1]) / 2);
    ctx.lineTo(Rs[0][0], Rs[0][1]);
    ctx.closePath();
  }
  // the tail: a forked fan that wags a beat behind the body
  function tailPath(f, ox, oy) {
    const sp = f.spine, T = sp[SEGS - 1], P = sp[SEGS - 2];
    let bx = T[0] - P[0], by = T[1] - P[1];
    const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
    const ang = Math.atan2(by, bx) + Math.sin(f.wob * 1.1 - 0.8) * 0.3;
    const L = f.len * 0.34, s = 0.5;
    const rx = T[0] + ox - bx * f.seg * 0.35, ry = T[1] + oy - by * f.seg * 0.35;
    const pt = (a, r) => [rx + Math.cos(ang + a) * r, ry + Math.sin(ang + a) * r];
    const tipR = pt(-s, L), notch = pt(0, L * 0.6), tipL = pt(s, L);
    const outR = pt(-s * 1.25, L * 0.55), inR = pt(-s * 0.6, L * 0.66), inL = pt(s * 0.6, L * 0.66), outL = pt(s * 1.25, L * 0.55);
    ctx.moveTo(rx, ry);
    ctx.quadraticCurveTo(outR[0], outR[1], tipR[0], tipR[1]);
    ctx.quadraticCurveTo(inR[0], inR[1], notch[0], notch[1]);
    ctx.quadraticCurveTo(inL[0], inL[1], tipL[0], tipL[1]);
    ctx.quadraticCurveTo(outL[0], outL[1], rx, ry);
    ctx.closePath();
  }
  // pectoral fins behind the head and smaller pelvic fins halfway down, paddling
  function finsPath(f, ox, oy) {
    const flap = Math.sin(f.wob * 1.3);
    [[0.2, 0.23, 0.1, 2.2 + flap * 0.25], [0.57, 0.13, 0.055, 2.5 + flap * 0.12]].forEach(([u, fl, fw, spread]) => {
      const q = at(f, u), h = Math.atan2(q.fy, q.fx), L = f.len * fl, Wd = f.len * fw;
      [1, -1].forEach((s) => {
        const a = h + s * spread;
        const cx = q.x + q.nx * s * q.w * 0.7 + Math.cos(a) * L * 0.5 + ox, cy = q.y + q.ny * s * q.w * 0.7 + Math.sin(a) * L * 0.5 + oy;
        ctx.moveTo(cx + Math.cos(a) * L * 0.5, cy + Math.sin(a) * L * 0.5);
        ctx.ellipse(cx, cy, L * 0.5, Wd * 0.5, a, 0, TAU);
      });
    });
  }
  function patchesPath(f) {
    f.patches.forEach(([u0, u1, side, ph]) => {
      for (let u = u0; u <= u1; u += 0.045) {
        const q = at(f, u), r = q.w * (0.56 + 0.16 * Math.sin(u * 21 + ph));
        const x = q.x + q.nx * side * q.w * 0.38, y = q.y + q.ny * side * q.w * 0.38;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
    });
  }
  function drawKoi(f) {
    // its shadow on the floor (and on any bigger koi below it), as one translucent shape
    ctx.fillStyle = C.shadow;
    ctx.beginPath();
    tailPath(f, f.sh, f.sh * 1.4); finsPath(f, f.sh, f.sh * 1.4); bodyPath(f, f.sh, f.sh * 1.4);
    ctx.fill();
    ctx.fillStyle = f.fin;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); tailPath(f, 0, 0); ctx.fill();
    ctx.beginPath(); finsPath(f, 0, 0); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = f.body;
    ctx.beginPath(); bodyPath(f, 0, 0); ctx.fill();
    ctx.save();
    ctx.clip();                                              // the markings stay inside the body
    ctx.fillStyle = f.patch;
    ctx.beginPath(); patchesPath(f); ctx.fill();
    ctx.restore();
    const e = at(f, 0.06), er = Math.max(0.42, f.len * 0.026);
    ctx.fillStyle = C.eye;
    ctx.beginPath();
    [1, -1].forEach((s) => { const x = e.x + e.nx * s * e.w * 0.6, y = e.y + e.ny * s * e.w * 0.6; ctx.moveTo(x + er, y); ctx.arc(x, y, er, 0, TAU); });
    ctx.fill();
  }

  /* ---------------------------------------------------------------- scenery */
  // the floor: a deep gradient with scattered stones
  function buildFloor() {
    floor.width = canvas.width; floor.height = canvas.height;
    fctx.setTransform(D, 0, 0, D, 0, 0);
    const g = fctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.top); g.addColorStop(1, C.bottom);
    fctx.fillStyle = g;
    fctx.fillRect(-1, -1, W + 2, H + 2);
    const r = rng(99), n = Math.round(W * H / 320);
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, s = 0.45 + r() * r() * 2, rot = r() * Math.PI;
      fctx.fillStyle = r() < 0.55 ? C.stoneDark : C.stoneLight;
      fctx.beginPath(); fctx.ellipse(x, y, s * 1.35, s, rot, 0, TAU); fctx.fill();
    }
  }
  // lily pads with a notch and veins, two of them with a lotus; they drift a little
  let pads = [];
  function buildPads() {
    const r = rng(7);
    const R0 = clamp(Math.min(W, H) * 0.085, 5, 13);
    pads = [[0.09, 0.2], [0.91, 0.24], [0.83, 0.87], [0.2, 0.85], [0.6, 0.11]].map(([fx, fy], k) => ({
      x: fx * W, y: fy * H, R: R0 * (0.8 + r() * 0.45), notch: r() * TAU, ph: r() * TAU, lotus: k === 1 || k === 3,
    }));
  }
  function padPath(p, ox, oy, R) {
    const a = p.notch + Math.sin(t * 0.35 + p.ph) * 0.05;
    const x = p.x + Math.sin(t * 0.3 + p.ph) * 0.25 + ox, y = p.y + Math.cos(t * 0.27 + p.ph) * 0.25 + oy;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, R, a + 0.28, a - 0.28 + TAU);
    ctx.closePath();
    return [x, y, a];
  }
  function drawPad(p) {
    ctx.fillStyle = C.padEdge;
    padPath(p, 0, 0, p.R); ctx.fill();
    ctx.fillStyle = C.pad;
    const [x, y, a] = padPath(p, 0, 0, p.R - 0.75); ctx.fill();
    ctx.strokeStyle = C.padVein;
    ctx.lineWidth = 0.32;
    ctx.beginPath();
    for (let j = 1; j < 8; j++) {
      const v = a + 0.28 + j * ((TAU - 0.56) / 8);
      ctx.moveTo(x + Math.cos(v) * p.R * 0.16, y + Math.sin(v) * p.R * 0.16);
      ctx.lineTo(x + Math.cos(v) * p.R * 0.8, y + Math.sin(v) * p.R * 0.8);
    }
    ctx.stroke();
    if (!p.lotus) return;
    const lx = x + Math.cos(a + Math.PI) * p.R * 0.3, ly = y + Math.sin(a + Math.PI) * p.R * 0.3, s = p.R;
    const petals = (n, dist, rl, rw, rot, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let j = 0; j < n; j++) {
        const v = rot + (j / n) * TAU, cx = lx + Math.cos(v) * dist, cy = ly + Math.sin(v) * dist;
        ctx.moveTo(cx + Math.cos(v) * rl, cy + Math.sin(v) * rl);
        ctx.ellipse(cx, cy, rl, rw, v, 0, TAU);
      }
      ctx.fill();
    };
    petals(8, s * 0.2, s * 0.2, s * 0.085, p.ph, C.petal);
    petals(6, s * 0.1, s * 0.13, s * 0.065, p.ph + 0.3, C.petalLight);
    ctx.fillStyle = C.seed;
    ctx.beginPath(); ctx.arc(lx, ly, s * 0.075, 0, TAU); ctx.fill();
  }
  // glints of light on the floor that drift with the current and fade in and out
  let glints = [];
  function buildGlints() {
    const r = rng(31), n = Math.round(clamp(W * H / 1300, 14, 60));
    glints = Array.from({ length: n }, () => ({ x: r() * W, y: r() * H, l: 2.5 + r() * 4.5, ph: r() * TAU, sp: 0.4 + r() * 0.5 }));
  }
  function drawGlints() {
    ctx.strokeStyle = C.glint;
    ctx.lineWidth = 0.42;
    glints.forEach((g) => {
      const x = ((g.x + t * g.sp) % (W + 10)) - 5, y = g.y + Math.sin(t * 0.5 + g.ph) * 0.6;
      ctx.globalAlpha = 0.05 + 0.11 * (0.5 + 0.5 * Math.sin(t * 0.9 + g.ph));
      ctx.beginPath(); ctx.moveTo(x - g.l / 2, y); ctx.quadraticCurveTo(x, y - g.l * 0.28, x + g.l / 2, y); ctx.stroke();
    });
    ctx.globalAlpha = 1;
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
      const m = 6 + f.len * 0.35;
      if (f.x < m || f.x > W - m || f.y < m || f.y > H - m) steer(Math.atan2(H / 2 - f.y, W / 2 - f.x), 2.6);
      for (let j = 0; j < fish.length; j++) {
        const g = fish[j];
        if (g === f) continue;
        const dx = f.x - g.x, dy = f.y - g.y, d2 = dx * dx + dy * dy, R = 2 + (f.half + g.half) * 1.3;
        if (d2 < R * R && d2 > 0.01) steer(Math.atan2(dy, dx), 0.9);
      }
      let target = null, best = 72 * 72;
      food.forEach((fd) => { const dx = fd.x - f.x, dy = fd.y - f.y, d2 = dx * dx + dy * dy; if (d2 < best) { best = d2; target = fd; } });
      if (target) {
        steer(Math.atan2(target.y - f.y, target.x - f.x), 4.2);
        speed = f.base * 2.6;
        const reach = 1.5 + f.half * 0.6;
        if (best < reach * reach) {
          food.splice(food.indexOf(target), 1);
          ripples.push({ x: target.x, y: target.y, r: 0.5, max: 5, life: 1 });
        }
      } else if (pointer.in && pointer.still > 0.7) {
        const dx = pointer.x - f.x, dy = pointer.y - f.y;
        if (dx * dx + dy * dy < 34 * 34) { steer(Math.atan2(dy, dx), 0.8); speed *= 0.7; }
      }
      if (f === hover || f === picked) speed *= 0.12;
      f.v += (speed - f.v) * Math.min(1, dt * 2);
      f.wob += dt * (2.2 + f.v * 0.9) * (1.15 - 0.35 * f.k);     // small koi beat their tails faster
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

  function draw() {
    if (!W) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(floor, 0, 0);
    ctx.setTransform(D, 0, 0, D, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawGlints();
    fish.forEach(drawKoi);
    ctx.strokeStyle = C.ripple;
    ctx.lineWidth = 0.45;
    ripples.forEach((rp) => { ctx.globalAlpha = 0.55 * rp.life; ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, TAU); ctx.stroke(); });
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.padShadow;
    pads.forEach((p) => { padPath(p, 1, 2, p.R); ctx.fill(); });
    pads.forEach(drawPad);
    ctx.strokeStyle = C.foodDark;
    ctx.lineWidth = 0.25;
    food.forEach((fd) => {
      ctx.fillStyle = fd.age > 11 ? C.foodDark : C.food;
      ctx.beginPath(); ctx.arc(fd.x, fd.y, 0.7, 0, TAU); ctx.fill(); ctx.stroke();
    });
    ctx.strokeStyle = C.ring;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([1.6, 1.4]);
    ctx.lineDashOffset = -t * 3;
    [hover, picked].forEach((f, j) => {
      if (!f || (j === 1 && f === hover)) return;
      const m = at(f, 0.42);
      ctx.beginPath(); ctx.arc(m.x, m.y, f.len * 0.62 + 1.2, 0, TAU); ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  function resize() {
    const cw = host.clientWidth, ch = host.clientHeight;
    if (!cw || !ch) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cw === cw0 && ch === ch0 && dpr === dpr0) return;
    const first = !W;
    const u = cw < 600 ? 2 : Math.max(3, cw / 300);       // finer units on narrow ponds, so 32 koi still have room
    const w = cw / u, h = ch / u;
    const sx = W ? w / W : 1, sy = H ? h / H : 1;
    cw0 = cw; ch0 = ch; dpr0 = dpr;
    W = w; H = h; U = u; D = dpr * u;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    buildFloor();
    buildPads();
    buildGlints();
    if (first) fish.forEach(place);
    else fish.forEach((f) => { f.spine.forEach((p) => { p[0] = clamp(p[0] * sx, 1, W - 1); p[1] = clamp(p[1] * sy, 1, H - 1); }); f.x = f.spine[0][0]; f.y = f.spine[0][1]; });
    food.length = 0;
    ripples.length = 0;
    if (reduced.matches && first) for (let i = 0; i < 40; i++) step(0.05);   // settle into a natural pose
    draw();
  }

  /* ---------------------------------------------------------------- input */
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / U, y: (e.clientY - r.top) / U }; };
  // the topmost koi under the pointer, or failing that the nearest one within 8 CSS pixels
  function hit(x, y) {
    let best = null, bd = 8 / U;
    for (let j = fish.length - 1; j >= 0; j--) {
      const f = fish[j];
      let d = Infinity;
      for (let i = 0; i < SEGS; i++) { const p = f.spine[i]; d = Math.min(d, Math.hypot(p[0] - x, p[1] - y) - f.half * prof(i / (SEGS - 1))); }
      if (d <= 0) return f;
      if (d < bd) { bd = d; best = f; }
    }
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
    // a mouse opens the koi the tip is showing: clicks report whole pixels while pointer moves don't,
    // and the koi may have drifted a little since the pointer last moved
    const f = downType === 'mouse' && hover ? hover : hit(p.x, p.y);
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
