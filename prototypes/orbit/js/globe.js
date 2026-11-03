/* ORBIT hero: a dot globe (land dots from the Market Dashboard project), three project orbits,
   and the Boulder -> DESY route. Drag to spin. Pauses off-screen; static with reduced motion. */
(function () {
  'use strict';
  const host = document.querySelector('[data-globe]');
  if (!host || !window.RLG_GLOBE) return;
  const R = window.RLG;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const DEG = Math.PI / 180;

  const G = window.RLG_GLOBE;
  const N = G.length / 2;
  const P = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const lon = G[2 * i] * DEG, lat = G[2 * i + 1] * DEG;
    P[3 * i] = Math.cos(lat) * Math.sin(lon);
    P[3 * i + 1] = Math.sin(lat);
    P[3 * i + 2] = Math.cos(lat) * Math.cos(lon);
  }
  const vec = (lat, lon) => [Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.cos(lon * DEG)];
  const SITES = [
    { name: 'BOULDER, CO', v: vec(40.015, -105.27), home: true, dx: 12, dy: 4 },
    { name: 'DESY, HAMBURG', v: vec(53.575, 9.88), dx: 12, dy: -8 },
    { name: 'CERN, GENEVA', v: vec(46.234, 6.055), dx: 12, dy: 14 },
  ];
  const c = R.data.counts;
  const ORBITS = [
    { incl: 16 * DEG, node: 24 * DEG, r: 1.17, n: c.program, color: '#aba2d4', speed: 0.11 },
    { incl: -34 * DEG, node: 112 * DEG, r: 1.27, n: c.engineer, color: '#e9ff97', speed: 0.085 },
    { incl: 62 * DEG, node: -42 * DEG, r: 1.37, n: c.art, color: '#e5197f', speed: 0.065 },
  ];
  const LIGHT = (() => { const l = [0.55, 0.45, 0.7]; const m = Math.hypot(...l); return l.map((x) => x / m); })();

  let rot = 112 * DEG;            // facing longitude is -rot: start just west of Boulder
  let tilt = 20 * DEG;
  let vel = 0.045;                // rad / s, auto spin
  let size = 0, dpr = 1, running = false, visible = true, last = 0, t = 0;

  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    size = Math.max(10, Math.floor(r.width));
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    draw();
  }

  function project(x, y, z) {
    const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    const x1 = x * cr + z * sr;
    const z1 = -x * sr + z * cr;
    const y2 = y * ct - z1 * st;
    const z2 = y * st + z1 * ct;
    return [x1, y2, z2];
  }

  function orbitPoint(o, a) {
    // circle in the XZ plane, inclined about X, rotated about Y by the node, then tilted with the view
    let x = Math.cos(a) * o.r, y = 0, z = Math.sin(a) * o.r;
    const ci = Math.cos(o.incl), si = Math.sin(o.incl);
    [y, z] = [y * ci - z * si, y * si + z * ci];
    const cn = Math.cos(o.node), sn = Math.sin(o.node);
    [x, z] = [x * cn + z * sn, -x * sn + z * cn];
    const ct = Math.cos(tilt * 0.6), st = Math.sin(tilt * 0.6);
    return [x, y * ct - z * st, y * st + z * ct];
  }

  function draw() {
    if (!size) return;
    const s = size * dpr, cx = s / 2, cy = s / 2, rad = s * 0.355;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s, s);

    // orbits behind the planet
    drawOrbits(cx, cy, rad, false);

    // atmosphere glow
    let g = ctx.createRadialGradient(cx, cy, rad * 0.96, cx, cy, rad * 1.16);
    g.addColorStop(0, 'rgba(129,115,204,0.42)');
    g.addColorStop(1, 'rgba(129,115,204,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, rad * 1.16, 0, Math.PI * 2); ctx.fill();
    // planet body
    g = ctx.createRadialGradient(cx + rad * 0.35, cy - rad * 0.35, rad * 0.1, cx, cy, rad);
    g.addColorStop(0, '#2d2178');
    g.addColorStop(0.7, '#17123d');
    g.addColorStop(1, '#0f0e19');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();

    // land dots
    const dot = Math.max(1.2, rad / 150);
    ctx.fillStyle = '#d9d4e2';
    for (let i = 0; i < N; i++) {
      const [x, y, z] = project(P[3 * i], P[3 * i + 1], P[3 * i + 2]);
      if (z < -0.05) continue;
      const lam = Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
      const a = Math.max(0.05, (0.18 + 0.82 * lam) * Math.min(1, z * 2.4 + 0.15));
      ctx.globalAlpha = a;
      const sz = dot * (0.7 + 0.5 * z);
      ctx.fillRect(cx + x * rad - sz / 2, cy - y * rad - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;

    // dotted halo ring
    ctx.save();
    ctx.strokeStyle = 'rgba(217,212,226,0.7)';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.setLineDash([dpr, 4 * dpr]);
    ctx.beginPath(); ctx.arc(cx, cy, rad * 1.035, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    drawRoute(cx, cy, rad);
    drawOrbits(cx, cy, rad, true);
    drawSites(cx, cy, rad);
  }

  function drawOrbits(cx, cy, rad, front) {
    ORBITS.forEach((o) => {
      ctx.strokeStyle = o.color;
      ctx.lineWidth = Math.max(1, dpr * 0.8);
      const steps = 160;
      for (let k = 0; k < steps; k++) {
        const a0 = (k / steps) * Math.PI * 2, a1 = ((k + 1) / steps) * Math.PI * 2;
        const p0 = orbitPoint(o, a0), p1 = orbitPoint(o, a1);
        const isFront = (p0[2] + p1[2]) / 2 > 0;
        if (isFront !== front) continue;
        ctx.globalAlpha = front ? 0.55 : 0.18;
        ctx.beginPath();
        ctx.moveTo(cx + p0[0] * rad, cy - p0[1] * rad);
        ctx.lineTo(cx + p1[0] * rad, cy - p1[1] * rad);
        ctx.stroke();
      }
      ctx.fillStyle = o.color;
      const sz = Math.max(3, rad / 55);
      for (let j = 0; j < o.n; j++) {
        const a = (j / o.n) * Math.PI * 2 + t * o.speed;
        const p = orbitPoint(o, a);
        if ((p[2] > 0) !== front) continue;
        ctx.globalAlpha = front ? 1 : 0.35;
        ctx.fillRect(cx + p[0] * rad - sz / 2, cy - p[1] * rad - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    });
  }

  function slerp(a, b, k) {
    const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    const w = Math.acos(d), s = Math.sin(w);
    const ka = Math.sin((1 - k) * w) / s, kb = Math.sin(k * w) / s;
    return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  }

  function drawRoute(cx, cy, rad) {
    const a = SITES[0].v, b = SITES[1].v;
    ctx.save();
    ctx.strokeStyle = '#e9ff97';
    ctx.lineWidth = Math.max(1.2, dpr * 1.3);
    ctx.setLineDash([6 * dpr, 5 * dpr]);
    ctx.lineDashOffset = -t * 18 * dpr;
    ctx.beginPath();
    let pen = false;
    for (let k = 0; k <= 64; k++) {
      const u = k / 64;
      const v = slerp(a, b, u);
      const lift = 1 + 0.22 * Math.sin(Math.PI * u);
      const [x, y, z] = project(v[0] * lift, v[1] * lift, v[2] * lift);
      const hidden = z < 0 && Math.hypot(x, y) < 1;
      if (hidden) { pen = false; continue; }
      const px = cx + x * rad, py = cy - y * rad;
      if (!pen) { ctx.moveTo(px, py); pen = true; } else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSites(cx, cy, rad) {
    ctx.font = `${10 * dpr}px "Geist Mono", Consolas, monospace`;
    ctx.textBaseline = 'middle';
    SITES.forEach((site) => {
      const [x, y, z] = project(...site.v);
      if (z < 0.08) return;
      const px = cx + x * rad, py = cy - y * rad;
      const a = Math.min(1, (z - 0.08) * 4);
      ctx.globalAlpha = a;
      ctx.fillStyle = site.home ? '#e9ff97' : '#e5197f';
      const sz = 5 * dpr;
      ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
      if (site.home) {
        const pulse = (t * 0.8) % 1;
        ctx.strokeStyle = `rgba(233,255,151,${(1 - pulse) * 0.8})`;
        ctx.lineWidth = dpr;
        ctx.beginPath(); ctx.arc(px, py, (4 + pulse * 14) * dpr, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = '#d9d4e2';
      ctx.fillText(site.name, px + site.dx * dpr, py + site.dy * dpr);
    });
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!dragging) {
      rot += vel * dt;
      vel += (0.045 - vel) * Math.min(1, dt * 1.5);   // ease back to the idle spin after a fling
    }
    t += dt;
    draw();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || R.reduced.matches || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  // drag to spin
  let dragging = false, px0 = 0, py0 = 0, lastMoveT = 0;
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();               // no text selection while spinning
    dragging = true; px0 = e.clientX; py0 = e.clientY; lastMoveT = performance.now();
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - px0, dy = e.clientY - py0;
    const now = performance.now();
    const k = 3.2 / Math.max(200, size);
    rot += dx * k;
    tilt = Math.max(-40 * DEG, Math.min(55 * DEG, tilt + dy * k));
    vel = (dx * k) / Math.max(0.016, (now - lastMoveT) / 1000);
    px0 = e.clientX; py0 = e.clientY; lastMoveT = now;
    if (!running) draw();
  });
  const end = () => { dragging = false; vel = Math.max(-1.5, Math.min(1.5, vel)); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible ? start() : stop(); }).observe(host);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  R.reduced.addEventListener?.('change', () => (R.reduced.matches ? stop() : start()));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  resize();
  start();
})();
