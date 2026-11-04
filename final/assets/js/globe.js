/* The home page globe: Boulder and the three routes behind the biggest builds (DESY in Hamburg,
   CERN in Geneva, JPL in Pasadena), drawn flat and bold in Canvas 2D. No WebGL anywhere. The land
   dots come from the Market Dashboard project, and three orbits carry one satellite per project in
   each discipline. Drag to spin; point at a route in the list to swing round to it. It pauses
   off-screen, and with reduced motion it stays still. */
(function () {
  'use strict';
  const host = document.querySelector('[data-globe]');
  if (!host || !window.RLG_GLOBE) return;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => { a %= TAU; if (a > Math.PI) a -= TAU; if (a <= -Math.PI) a += TAU; return a; };
  const C = { indigo: '#412db5', deep: '#2d2178', violet: '#8173cc', lav: '#aba2d4', lime: '#e9ff97', pink: '#e5197f',
    grey: '#d9d4e2', ink: '#0f0e19', paper: '#fcfff0', jpl: '#b7aef2' };
  const MONO = '"DM Mono", Consolas, monospace';

  /* ---------------------------------------------------------------- data */
  const vec = (lat, lon) => [Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.cos(lon * DEG)];
  const G = window.RLG_GLOBE;
  const N = G.length >> 1;
  const LAND = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = vec(G[2 * i + 1], G[2 * i]);
    LAND[3 * i] = v[0]; LAND[3 * i + 1] = v[1]; LAND[3 * i + 2] = v[2];
  }
  const slerp = (a, b, k) => {
    const d = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1);
    const w = Math.acos(d), s = Math.sin(w) || 1;
    const ka = Math.sin((1 - k) * w) / s, kb = Math.sin(k * w) / s;
    return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
  };
  const HOME = { name: 'BOULDER, CO', short: 'BOULDER', v: vec(40.015, -105.27), color: C.lime, dx: 14, dy: 18, align: 'left' };
  const ROUTES = [
    { key: 'desy', name: 'DESY · HAMBURG', short: 'DESY', v: vec(53.575, 9.88), color: C.lime, dx: 14, dy: -16, align: 'left', phase: 0 },
    { key: 'cern', name: 'CERN · GENEVA', short: 'CERN', v: vec(46.234, 6.055), color: C.pink, dx: 14, dy: 18, align: 'left', phase: 0.33 },
    { key: 'jpl', name: 'JPL · PASADENA', short: 'JPL', v: vec(34.2013, -118.1714), color: C.jpl, dx: -14, dy: 18, align: 'right', phase: 0.66 },
  ];
  ROUTES.forEach((r) => {
    const ang = Math.acos(clamp(HOME.v[0] * r.v[0] + HOME.v[1] * r.v[1] + HOME.v[2] * r.v[2], -1, 1));
    r.lift = 0.05 + 0.2 * (ang / Math.PI) * 2.2;           // longer routes arc higher
    r.km = Math.round(ang * 6371);
    const m = slerp(HOME.v, r.v, 0.5);
    r.goal = { rot: -Math.atan2(m[0], m[2]), tilt: clamp(Math.asin(m[1]) * 0.75, -10 * DEG, 48 * DEG) };
  });

  const counts = { program: 0, engineer: 0, art: 0 };
  try {
    JSON.parse(document.getElementById('rlg-index').textContent).forEach((p) => p.c.forEach((c) => { if (c in counts) counts[c]++; }));
  } catch (err) { counts.program = 16; counts.engineer = 12; counts.art = 10; }
  const ORBITS = [
    { incl: 16 * DEG, node: 24 * DEG, r: 1.2, n: counts.program, color: C.lav, speed: 0.11 },
    { incl: -34 * DEG, node: 112 * DEG, r: 1.29, n: counts.engineer, color: C.lime, speed: 0.085 },
    { incl: 62 * DEG, node: -42 * DEG, r: 1.38, n: counts.art, color: C.pink, speed: 0.065 },
  ];

  /* ---------------------------------------------------------------- state */
  const REST_TILT = 24 * DEG;
  let rot = 58 * DEG;          // the facing longitude is -rot: start over the Atlantic, Boulder on the left
  let tilt = REST_TILT;
  let vel = 0.035;             // rad/s
  let t = 0, size = 0, dpr = 1;
  let dragging = false, focus = null;
  let cr = 1, sr = 0, ct = 1, st = 0;
  const out = [0, 0, 0];
  const proj = (x, y, z) => {
    const x1 = x * cr + z * sr, z1 = -x * sr + z * cr;
    out[0] = x1; out[1] = y * ct - z1 * st; out[2] = y * st + z1 * ct;
    return out;
  };
  const facing = () => wrap(-rot) / DEG;

  function resize() {
    const r = host.getBoundingClientRect();
    const s = Math.max(10, Math.floor(r.width));
    const d = Math.min(2, window.devicePixelRatio || 1);
    if (s === size && d === dpr) return;
    size = s; dpr = d;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    draw();
  }

  /* ---------------------------------------------------------------- drawing */
  function orbitPoint(o, a) {
    let x = Math.cos(a) * o.r, y = 0, z = Math.sin(a) * o.r;
    const ci = Math.cos(o.incl), si = Math.sin(o.incl);
    const y1 = y * ci - z * si, z1 = y * si + z * ci;
    y = y1; z = z1;
    const cn = Math.cos(o.node), sn = Math.sin(o.node);
    const x2 = x * cn + z * sn, z2 = -x * sn + z * cn;
    const t6 = tilt * 0.6, c6 = Math.cos(t6), s6 = Math.sin(t6);
    return [x2, y * c6 - z2 * s6, y * s6 + z2 * c6];
  }

  function drawOrbits(cx, cy, rad, front) {
    ORBITS.forEach((o) => {
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 1.6 * dpr;
      ctx.globalAlpha = front ? 0.6 : 0.2;
      ctx.beginPath();
      const steps = 180;
      let pen = false;
      for (let k = 0; k <= steps; k++) {
        const p = orbitPoint(o, (k / steps) * TAU);
        const vis = (p[2] > 0) === front || (!front && Math.hypot(p[0], p[1]) > 1);
        if (!vis) { pen = false; continue; }
        const X = cx + p[0] * rad, Y = cy - p[1] * rad;
        if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
      }
      ctx.stroke();
      const sz = Math.max(3 * dpr, rad / 52);
      for (let j = 0; j < o.n; j++) {
        const p = orbitPoint(o, (j / o.n) * TAU + t * o.speed);
        if ((p[2] > 0) !== front) continue;
        if (!front && Math.hypot(p[0], p[1]) < 1) continue;       // hidden behind the planet
        ctx.globalAlpha = front ? 1 : 0.45;
        ctx.fillStyle = C.ink;
        ctx.fillRect(cx + p[0] * rad - sz / 2 - dpr, cy - p[1] * rad - sz / 2 - dpr, sz + 2 * dpr, sz + 2 * dpr);
        ctx.fillStyle = o.color;
        ctx.fillRect(cx + p[0] * rad - sz / 2, cy - p[1] * rad - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;
    });
  }

  function graticule(cx, cy, rad) {
    ctx.fillStyle = C.violet;
    const d = Math.max(1, 1.1 * dpr);
    const dotAt = (v) => {
      const p = proj(v[0], v[1], v[2]);
      if (p[2] <= 0.02) return;
      ctx.globalAlpha = 0.25 + 0.5 * p[2];
      ctx.fillRect(cx + p[0] * rad - d / 2, cy - p[1] * rad - d / 2, d, d);
    };
    for (let lat = -60; lat <= 60; lat += 30) for (let lon = -180; lon < 180; lon += 3) dotAt(vec(lat, lon));
    for (let lon = -180; lon < 180; lon += 30) for (let lat = -84; lat <= 84; lat += 3) dotAt(vec(lat, lon));
    ctx.globalAlpha = 1;
  }

  function routePath(r) {
    const pts = [];
    for (let k = 0; k <= 64; k++) {
      const u = k / 64;
      const v = slerp(HOME.v, r.v, u);
      const lift = 1 + r.lift * Math.sin(Math.PI * u);
      const p = proj(v[0] * lift, v[1] * lift, v[2] * lift);
      pts.push([p[0], p[1], p[2] < 0 && Math.hypot(p[0], p[1]) < 1]);
    }
    return pts;
  }

  function strokePath(pts, cx, cy, rad) {
    ctx.beginPath();
    let pen = false;
    pts.forEach((p) => {
      if (p[2]) { pen = false; return; }
      const X = cx + p[0] * rad, Y = cy - p[1] * rad;
      if (pen) ctx.lineTo(X, Y); else { ctx.moveTo(X, Y); pen = true; }
    });
    ctx.stroke();
  }

  function drawRoutes(cx, cy, rad) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ROUTES.forEach((r) => {
      const pts = routePath(r);
      const on = !focus || focus === r.key;
      ctx.globalAlpha = on ? 1 : 0.35;
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = (focus === r.key ? 9 : 7) * dpr;
      strokePath(pts, cx, cy, rad);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = (focus === r.key ? 5 : 3.5) * dpr;
      strokePath(pts, cx, cy, rad);
      if (!reduced.matches && on) {                     // a packet running Boulder -> destination
        const u = (t * 0.3 + r.phase) % 1;
        for (let k = 0; k < 4; k++) {
          const uu = u - k * 0.025;
          if (uu < 0) continue;
          const p = pts[Math.round(uu * 64)];
          if (p[2]) continue;
          const sz = (7 - k * 1.4) * dpr;
          ctx.globalAlpha = 1 - k * 0.22;
          ctx.fillStyle = k ? r.color : C.paper;
          ctx.fillRect(cx + p[0] * rad - sz / 2, cy - p[1] * rad - sz / 2, sz, sz);
        }
      }
    });
    ctx.restore();
  }

  function pill(L) {
    ctx.globalAlpha = L.a;
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    const r = L.h / 2;
    ctx.moveTo(L.x + r, L.y);
    ctx.arcTo(L.x + L.w, L.y, L.x + L.w, L.y + L.h, r);
    ctx.arcTo(L.x + L.w, L.y + L.h, L.x, L.y + L.h, r);
    ctx.arcTo(L.x, L.y + L.h, L.x, L.y, r);
    ctx.arcTo(L.x, L.y, L.x + L.w, L.y, r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = L.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(L.text, L.x + 7 * dpr, L.y + L.h / 2 + 0.5 * dpr);
    ctx.globalAlpha = 1;
  }

  /* markers first, then their labels, each nudged up or down until it covers no other label or marker;
     on a small globe the labels drop to the short names (the list beside it has the details) */
  function drawSites(cx, cy, rad) {
    const small = size < 480;
    const fs = (small ? 9.5 : 11) * dpr;
    ctx.font = `500 ${fs}px ${MONO}`;
    const H = fs + 9 * dpr, pad = 3 * dpr, edge = 4 * dpr;
    const sites = [];
    [HOME].concat(ROUTES).forEach((s) => {
      const p = proj(s.v[0], s.v[1], s.v[2]);
      if (p[2] < 0.05) return;
      const a = Math.min(1, (p[2] - 0.05) * 5) * (!focus || focus === s.key || s === HOME ? 1 : 0.45);
      sites.push({ s, X: cx + p[0] * rad, Y: cy - p[1] * rad, a, sz: (s === HOME ? 11 : 9) * dpr });
    });
    const taken = sites.map((m) => ({ x: m.X - m.sz / 2 - 2 * dpr, y: m.Y - m.sz / 2 - 2 * dpr, w: m.sz + 4 * dpr, h: m.sz + 4 * dpr }));
    const hits = (L) => taken.some((r) => L.x < r.x + r.w + pad && L.x + L.w + pad > r.x && L.y < r.y + r.h + pad && L.y + L.h + pad > r.y);
    const labels = sites.map(({ s, X, Y, a }) => {
      const text = small ? s.short : s === HOME ? s.name : `${s.name} · ${s.km.toLocaleString('en-US')} KM`;
      const w = ctx.measureText(text).width + 14 * dpr;
      const L = { text, w, h: H, a, color: s.color,
        x: clamp(s.align === 'right' ? X + s.dx * dpr - w : X + s.dx * dpr, edge, canvas.width - w - edge),
        y: clamp(Y + s.dy * dpr - H / 2, edge, canvas.height - H - edge) };
      const dir = s.dy < 0 ? -1 : 1;
      for (let k = 0; k < 12 && hits(L); k++) {
        const ny = clamp(L.y + dir * H * 0.55, edge, canvas.height - H - edge);
        if (ny === L.y) break;
        L.y = ny;
      }
      taken.push(L);
      return L;
    });
    sites.forEach(({ s, X, Y, a, sz }) => {
      ctx.globalAlpha = a;
      ctx.fillStyle = C.ink;
      ctx.fillRect(X - sz / 2 - 2 * dpr, Y - sz / 2 - 2 * dpr, sz + 4 * dpr, sz + 4 * dpr);
      ctx.fillStyle = s.color;
      ctx.fillRect(X - sz / 2, Y - sz / 2, sz, sz);
      if (s === HOME && !reduced.matches) {
        const k = (t * 0.7) % 1;
        ctx.strokeStyle = C.lime;
        ctx.lineWidth = 2 * dpr;
        ctx.globalAlpha = a * (1 - k) * 0.9;
        ctx.beginPath();
        ctx.arc(X, Y, (8 + k * 22) * dpr, 0, TAU);
        ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;
    labels.forEach(pill);
  }

  function hud() {
    ctx.font = `500 ${10 * dpr}px ${MONO}`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.fillStyle = C.lav;
    ctx.globalAlpha = 0.85;
    ctx.fillText('FIG. 02 · ROUTES FROM BOULDER', 10 * dpr, 16 * dpr);
    const f = facing();
    ctx.fillText(`FACING ${Math.abs(f).toFixed(1)}°${f < 0 ? 'W' : 'E'} · TILT ${(tilt / DEG).toFixed(0)}°`, 10 * dpr, canvas.height - 10 * dpr);
    ctx.textAlign = 'right';
    ctx.fillText('DRAG TO SPIN', canvas.width - 10 * dpr, canvas.height - 10 * dpr);
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!size) return;
    cr = Math.cos(rot); sr = Math.sin(rot); ct = Math.cos(tilt); st = Math.sin(tilt);
    const s = canvas.width, cx = s / 2, cy = s / 2, rad = s * 0.34;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s, s);
    drawOrbits(cx, cy, rad, false);
    // a hard offset shadow, then the flat planet and its outline: a sticker more than a render
    ctx.fillStyle = C.ink;
    ctx.beginPath(); ctx.arc(cx + rad * 0.055, cy + rad * 0.055, rad, 0, TAU); ctx.fill();
    ctx.fillStyle = C.indigo;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.fill();
    graticule(cx, cy, rad);
    const dot = Math.max(1.4 * dpr, rad / 140);
    ctx.fillStyle = C.grey;
    for (let i = 0; i < N; i++) {
      const p = proj(LAND[3 * i], LAND[3 * i + 1], LAND[3 * i + 2]);
      if (p[2] < 0) continue;
      ctx.globalAlpha = 0.3 + 0.7 * p[2];
      const sz = dot * (0.7 + 0.5 * p[2]);
      ctx.fillRect(cx + p[0] * rad - sz / 2, cy - p[1] * rad - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3 * dpr;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke();
    ctx.save();
    ctx.strokeStyle = C.grey;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(1, dpr);
    ctx.setLineDash([dpr * 1.5, 5 * dpr]);
    ctx.beginPath(); ctx.arc(cx, cy, rad * 1.06, 0, TAU); ctx.stroke();
    ctx.restore();
    drawRoutes(cx, cy, rad);
    drawOrbits(cx, cy, rad, true);
    drawSites(cx, cy, rad);
    hud();
  }

  /* ---------------------------------------------------------------- motion */
  function step(dt) {
    t += dt;
    if (dragging) return;
    if (focus) {
      const r = ROUTES.filter((x) => x.key === focus)[0];
      const k = Math.min(1, dt * 2.4);
      rot += wrap(r.goal.rot - rot) * k;
      tilt += (r.goal.tilt - tilt) * k;
      vel = 0;
      return;
    }
    const f = facing();
    const want = f > -125 && f < 15 ? 0.035 : 0.2;   // linger while the routes face us
    vel += (want - vel) * Math.min(1, dt * 1.2);
    rot += vel * dt;
    tilt += (REST_TILT - tilt) * Math.min(1, dt * 0.3);
  }

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
      timer = setTimeout(loop, 120);           // keeps going where animation frames are throttled
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
  function stop() {
    alive = false;
    cancelAnimationFrame(raf);
    clearTimeout(timer);
  }
  const kick = () => { if (!alive) draw(); };

  /* ---------------------------------------------------------------- input */
  let px0 = 0, py0 = 0, lastMove = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    dragging = true;
    px0 = e.clientX; py0 = e.clientY; lastMove = performance.now();
    vel = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now();
    const k = 3.2 / Math.max(200, size);
    const dx = e.clientX - px0, dy = e.clientY - py0;
    rot += dx * k;
    tilt = clamp(tilt + dy * k, -40 * DEG, 60 * DEG);
    vel = clamp((dx * k) / Math.max(0.016, (now - lastMove) / 1000), -1.5, 1.5);
    px0 = e.clientX; py0 = e.clientY; lastMove = now;
    kick();
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (performance.now() - lastMove > 120) vel = 0;   // a pause before letting go means no fling
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);

  Array.prototype.forEach.call(document.querySelectorAll('.routes [data-route]'), (li) => {
    const key = li.dataset.route;
    if (!ROUTES.some((r) => r.key === key)) return;
    const on = () => {
      focus = key;
      if (reduced.matches) { const r = ROUTES.filter((x) => x.key === key)[0]; rot = r.goal.rot; tilt = r.goal.tilt; }
      kick();
    };
    const off = () => { if (focus === key) { focus = null; kick(); } };
    li.addEventListener('mouseenter', on);
    li.addEventListener('mouseleave', off);
    li.addEventListener('focusin', on);
    li.addEventListener('focusout', off);
  });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  const onMotion = () => { if (reduced.matches) { stop(); draw(); } else start(); };
  if (reduced.addEventListener) reduced.addEventListener('change', onMotion); else if (reduced.addListener) reduced.addListener(onMotion);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw());
  host.classList.add('is-live');
  resize();
  draw();
  start();
})();
