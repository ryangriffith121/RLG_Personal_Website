/* TELEMETRY hero: a SiPM-style cell grid that fills with simulated Cherenkov photon hits.
   As the beam angle sweeps 0–45°, the ring closes toward a single spot (as in the BL4S results).
   The pointer steers the beam. Static ring with reduced motion; paused off-screen. */
(function () {
  'use strict';
  const host = document.querySelector('[data-detector]');
  if (!host) return;
  const R = window.RLG;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const ro = (k) => document.querySelector(`[data-ro="${k}"]`);
  const out = { angle: ro('angle'), hits: ro('hits'), ring: ro('ring'), beam: ro('beam') };

  // colour map: empty -> indigo -> violet -> razzmatazz -> chartreuse -> white
  const STOPS = [[0, [65, 45, 181, 0]], [0.12, [45, 33, 120, 0.55]], [0.3, [65, 45, 181, 0.9]], [0.5, [129, 115, 204, 1]],
    [0.7, [229, 25, 127, 1]], [0.9, [233, 255, 151, 1]], [1.15, [255, 255, 255, 1]]];
  const LUT = [];
  for (let i = 0; i < 256; i++) {
    const v = (i / 255) * 1.15;
    let k = 0;
    while (k < STOPS.length - 2 && v > STOPS[k + 1][0]) k++;
    const [v0, c0] = STOPS[k], [v1, c1] = STOPS[k + 1];
    const f = Math.min(1, Math.max(0, (v - v0) / (v1 - v0)));
    const c = c0.map((x, j) => x + (c1[j] - x) * f);
    LUT.push(`rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3].toFixed(3)})`);
  }

  let W = 0, H = 0, dpr = 1, cols = 0, rows = 0, cell = 0, I = new Float32Array(0);
  const st = { t: 0, angle: 0, cx: 0.6, cy: 0.5, tx: 0.6, ty: 0.5, hits: 0, radius: 0 };
  let running = false, visible = true, last = 0, frameNo = 0;

  function resize() {
    const r = host.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    cell = Math.max(16, Math.min(W, H) / 17);
    cols = Math.max(8, Math.floor(W / cell));
    rows = Math.max(8, Math.floor(H / cell));
    I = new Float32Array(cols * rows);
    if (R.reduced.matches) {            // one still frame: accumulate a ring, then normalise it
      st.hits = 0;
      for (let k = 0; k < 40; k++) emit(220);
      const max = I.reduce((m, v) => Math.max(m, v), 0) || 1;
      for (let i = 0; i < I.length; i++) I[i] = (I[i] / max) * 0.95;
      readouts();
    }
    draw();
  }

  function gauss() {
    let u = 0, v = 0;
    while (!u) u = Math.random();
    while (!v) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function emit(n, count = true) {
    const k = st.angle / 45;
    const base = Math.min(cols, rows) * 0.33;
    const r = base * (1 - 0.9 * k);
    st.radius = r;
    const cx = st.cx * cols + base * 0.45 * k, cy = st.cy * rows;
    for (let i = 0; i < n; i++) {
      const phi = Math.random() * Math.PI * 2;
      const rr = r + gauss() * (0.42 + 0.7 * k);
      const ix = Math.round(cx + Math.cos(phi) * rr), iy = Math.round(cy + Math.sin(phi) * rr * 0.86);
      if (ix >= 0 && ix < cols && iy >= 0 && iy < rows) {
        I[iy * cols + ix] += 0.016;
        if (count) st.hits++;
      }
    }
  }

  function draw() {
    if (!cols) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const ox = (W - cols * cell) / 2, oy = (H - rows * cell) / 2, gap = Math.max(1.5, cell * 0.09), s = cell - gap * 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = I[y * cols + x];
        const px = ox + x * cell + gap, py = oy + y * cell + gap;
        if (v < 0.015) {
          ctx.strokeStyle = 'rgba(231,229,239,0.07)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, s - 1, s - 1);
        } else {
          ctx.fillStyle = LUT[Math.min(255, (v / 1.15) * 255) | 0];
          ctx.fillRect(px, py, s, s);
        }
      }
    }
    // beam crosshair
    const k = st.angle / 45, base = Math.min(cols, rows) * 0.33;
    const bx = ox + (st.cx * cols + base * 0.45 * k + 0.5) * cell, by = oy + (st.cy * rows + 0.5) * cell;
    ctx.strokeStyle = 'rgba(233,255,151,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx - 14, by); ctx.lineTo(bx - 5, by); ctx.moveTo(bx + 5, by); ctx.lineTo(bx + 14, by);
    ctx.moveTo(bx, by - 14); ctx.lineTo(bx, by - 5); ctx.moveTo(bx, by + 5); ctx.lineTo(bx, by + 14);
    ctx.stroke();
  }

  function readouts() {
    if (out.angle) out.angle.textContent = `${st.angle.toFixed(1).padStart(4, '0')}°`;
    if (out.hits) out.hits.textContent = st.hits.toLocaleString('en-US');
    if (out.ring) out.ring.textContent = `${(st.radius * 2).toFixed(1)} cells`;
    if (out.beam) out.beam.textContent = `${(st.cx * 100).toFixed(0).padStart(2, '0')}, ${(st.cy * 100).toFixed(0).padStart(2, '0')}`;
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    st.t += dt;
    st.angle = 22.5 - 22.5 * Math.cos(st.t * 0.26);
    st.cx += (st.tx - st.cx) * Math.min(1, dt * 2.5);
    st.cy += (st.ty - st.cy) * Math.min(1, dt * 2.5);
    emit(170);
    const decay = Math.pow(0.955, dt * 60);
    for (let i = 0; i < I.length; i++) I[i] *= decay;
    draw();
    if (++frameNo % 6 === 0) readouts();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || R.reduced.matches || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  const zone = host.closest('.hero') || host;
  zone.addEventListener('pointermove', (e) => {
    const r = host.getBoundingClientRect();
    // keep the ring clear of the name on the left
    st.tx = Math.min(0.78, Math.max(0.52, (e.clientX - r.left) / r.width));
    st.ty = Math.min(0.7, Math.max(0.3, (e.clientY - r.top) / r.height));
  });
  zone.addEventListener('pointerleave', () => { st.tx = 0.6; st.ty = 0.5; });

  new ResizeObserver(resize).observe(host);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; visible ? start() : stop(); }).observe(host);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  resize();
  readouts();
  start();
})();
