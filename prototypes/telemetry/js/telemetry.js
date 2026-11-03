/* TELEMETRY — chrome (bar, menu, ticker, palette, boot, footer) and page builders. */
(function () {
  'use strict';
  const R = window.RLG;
  const D = R.data;
  const page = document.body.dataset.page;
  const esc = R.esc;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const CORNERS = '<i class="corners" data-decor aria-hidden="true"></i>';
  const CAT_COLOR = { program: '#8173cc', engineer: '#e9ff97', art: '#e5197f' };
  document.documentElement.style.setProperty('--logo', `url("${new URL(R.asset(D.profile.logoMask), location.href).href}")`);

  const statusLed = (p) => (p.status
    ? `<span class="st mono"><i class="led ${/design|schematic/i.test(p.status) ? 'led--alert' : ''}"></i>${esc(p.status)}</span>`
    : `<span class="st mono dim"><i class="led led--dim"></i>Logged</span>`);

  /* ------------------------------------------------------------ chrome */
  function chrome() {
    const nav = [['work', '01', 'Work', 'work.html'], ['about', '02', 'About', 'about.html'], ['demos', '03', 'Demos', 'demos.html'], ['contact', '04', 'Contact', '#contact']];
    document.body.insertAdjacentHTML('afterbegin', `
      <a class="skip" href="#main">Skip to content</a>
      <header class="bar">
        <a class="bar__id" href="index.html" aria-label="Ryan L. Griffith, home"><span class="logo-mask" aria-hidden="true"></span><span class="bar__name">Ryan L. Griffith</span></a>
        <nav class="bar__nav" aria-label="Primary">${nav.map(([k, n, l, h]) => `<a href="${h}"${k === page ? ' aria-current="page"' : ''}><span>${n}</span>${l}</a>`).join('')}</nav>
        <div class="bar__right">
          <span class="clock mono dim" id="clock" aria-label="Local time in Boulder, Colorado"></span>
          <button class="bar__search" type="button" id="open-palette" aria-haspopup="dialog">Search <kbd>/</kbd></button>
          <button class="bar__menu" type="button" aria-expanded="false" aria-controls="menu">Menu</button>
        </div>
      </header>
      <div class="menu" id="menu" data-open="false" aria-hidden="true">
        ${[['index.html', 'Home', '00'], ['work.html', 'Work', '01'], ['about.html', 'About', '02'], ['demos.html', 'Demos', '03'], ['#contact', 'Contact', '04']]
          .map(([h, l, n]) => `<a class="menu__big" href="${h}">${l}<span>${n}</span></a>`).join('')}
        <div class="menu__foot mono">${D.profile.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${l.label} ↗</a>`).join('')}</div>
      </div>
      <i class="frame-ticks corners" data-decor aria-hidden="true"></i>
      <div class="palette" id="palette" role="dialog" aria-modal="true" aria-label="Search projects and pages" hidden>
        <div class="palette__box">${CORNERS}
          <div class="palette__in"><span aria-hidden="true">&gt;</span><input id="palette-q" type="text" placeholder="Search projects, tools, years…" autocomplete="off" spellcheck="false" aria-label="Search" aria-controls="palette-list"></div>
          <ul id="palette-list" role="listbox" aria-label="Results"></ul>
          <div class="palette__foot mono"><span>↑ ↓ select</span><span>↵ open</span><span>esc close</span></div>
        </div>
      </div>`);

    // ticker (visual only: the same links are on the page)
    const feed = R.chrono.slice(0, 14).map((p) => `<a href="project.html?id=${p.slug}" tabindex="-1">${R.id(p)} · ${esc(p.title.toUpperCase())} · ${R.date(p.iso, 'monoShort')}</a>`).join('');
    document.body.insertAdjacentHTML('beforeend', `
      <div class="ticker mono" aria-hidden="true">
        <span class="sig"><i class="led blink" style="margin-right:8px"></i>Feed</span>
        <div class="ticker__track"><div class="ticker__run">${feed}${feed}</div></div>
        <span class="dim">${D.counts.projects} logged</span>
      </div>`);

    // clock
    const clock = $('#clock');
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' });
    const tick = () => { clock.textContent = `Boulder ${fmt.format(new Date())}`; };
    tick();
    setInterval(tick, 1000);

    // menu
    const menu = $('#menu'), btn = $('.bar__menu');
    const setMenu = (open) => {
      menu.dataset.open = String(open);
      menu.setAttribute('aria-hidden', String(!open));
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Close' : 'Menu';
      document.documentElement.classList.toggle('menu-open', open);
    };
    btn.addEventListener('click', () => setMenu(menu.dataset.open !== 'true'));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.dataset.open === 'true') setMenu(false); });

    palette();
    footer();
    if (page === 'home') boot();
  }

  function footer() {
    document.body.insertAdjacentHTML('beforeend', `
      <footer class="foot" id="contact">
        <div class="foot__grid">
          <div><p class="mono sig" style="display:flex;gap:10px;align-items:center"><i class="led blink"></i>Channel open</p>
            <h2 class="h-sec" style="margin-top:16px">Open a channel.</h2></div>
          <div><p class="mono dim">Transmit</p><div class="foot__links">${D.profile.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${l.label} ↗</a>`).join('')}
            ${D.profile.email ? `<a href="mailto:${D.profile.email}">${esc(D.profile.email)}</a>` : ''}</div></div>
          <div><p class="mono dim">Navigate</p><div class="foot__links"><a href="work.html">Work (${D.counts.projects})</a><a href="demos.html">Demos (${D.counts.demos})</a><a href="about.html">About</a></div></div>
        </div>
        <div class="foot__mark">${R.wordmark({ cls: 'wm', title: 'Griffith', stroke: 2 })}</div>
        <div class="foot__bottom mono"><span>© <span data-year></span> Ryan L. Griffith · Boulder, Colorado</span>
          <nav aria-label="Footer"><a href="index.html">Home</a><a href="#main">Top ↑</a></nav></div>
      </footer>`);
  }

  function boot() {
    if (R.reduced.matches) return;
    try { if (sessionStorage.getItem('rlg-booted')) return; sessionStorage.setItem('rlg-booted', '1'); } catch (e) { return; }
    const lines = ['> RLG/OS v5.0 — BOULDER, CO', `> MOUNTING /work ........... ${D.counts.projects} PROJECTS`, `> MOUNTING /demos .......... ${D.counts.demos} CARTRIDGES`,
      '> CALIBRATING SiPM ARRAY ... OK', '> LINK  GITHUB ✓  LINKEDIN ✓', '> READY'];
    const el = R.el(`<div class="boot" aria-hidden="true"><pre></pre><button class="btn boot__skip" type="button" tabindex="-1">Skip</button></div>`);
    document.body.appendChild(el);
    const pre = $('pre', el);
    let i = 0, j = 0, timer = null;
    const finish = () => { clearTimeout(timer); el.classList.add('done'); setTimeout(() => el.remove(), 600); window.removeEventListener('keydown', finish); };
    const type = () => {
      if (i >= lines.length) { timer = setTimeout(finish, 280); return; }
      j += 3;
      pre.textContent = lines.slice(0, i).join('\n') + (i ? '\n' : '') + lines[i].slice(0, j);
      if (j >= lines[i].length) { i++; j = 0; }
      timer = setTimeout(type, 16);
    };
    el.addEventListener('click', finish);
    window.addEventListener('keydown', finish);
    type();
  }

  function palette() {
    const pal = $('#palette'), input = $('#palette-q'), list = $('#palette-list');
    const pages = [['Home', 'index.html', 'Page'], ['Work — every project', 'work.html', 'Page'], ['About Ryan', 'about.html', 'Page'], ['Demos — play in the browser', 'demos.html', 'Page']];
    let sel = 0, items = [], ret = null;
    const render = () => {
      const q = input.value.trim().toLowerCase();
      const words = q.split(/\s+/).filter(Boolean);
      const match = (s) => words.every((w) => s.toLowerCase().includes(w));
      const pageHits = pages.filter(([l]) => match(l)).map(([l, h, k]) => ({ label: l, href: h, kind: k, id: '—' }));
      const projHits = D.projects.filter((p) => match([p.title, p.summary, p.stack.join(' '), R.cats(p).join(' '), p.iso.slice(0, 4)].join(' ')))
        .map((p) => ({ label: p.title, href: `project.html?id=${p.slug}`, kind: R.cats(p, true).join('·'), id: R.id(p) }));
      items = [...(q ? projHits : []), ...pageHits, ...(q ? [] : projHits)].slice(0, 12);
      sel = Math.min(sel, Math.max(0, items.length - 1));
      list.innerHTML = items.length ? items.map((it, k) => `<li><a href="${it.href}" role="option" id="pal-${k}" aria-selected="${k === sel}">
          <span class="mono">${esc(it.id)}</span><strong>${esc(it.label)}</strong><span class="mono">${esc(it.kind)}</span></a></li>`).join('')
        : '<li class="mono dim" style="padding:14px">No signal. Try “pcb”, “pico” or “2025”.</li>';
      input.setAttribute('aria-activedescendant', items.length ? `pal-${sel}` : '');
    };
    const open = () => {
      ret = document.activeElement;
      pal.hidden = false;
      document.documentElement.classList.add('cmd-open');
      input.value = '';
      sel = 0;
      render();
      input.focus();
    };
    const close = () => {
      pal.hidden = true;
      document.documentElement.classList.remove('cmd-open');
      if (ret && ret.focus) ret.focus();
    };
    $('#open-palette').addEventListener('click', open);
    input.addEventListener('input', () => { sel = 0; render(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length);
        render();
        $(`#pal-${sel}`)?.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && items[sel]) {
        location.href = items[sel].href;
      }
    });
    pal.addEventListener('click', (e) => { if (e.target === pal) close(); });
    document.addEventListener('keydown', (e) => {
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '');
      if (!pal.hidden && e.key === 'Escape') { close(); return; }
      if (pal.hidden && ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) { e.preventDefault(); open(); }
    });
  }

  /* ------------------------------------------------------------ shared bits */
  function logRows(list) {
    return `<div class="log-head mono" aria-hidden="true"><span class="c-id">ID</span><span>Mission</span><span class="c-date">Logged</span><span class="c-stack">Class</span><span class="c-status">Status</span></div>
      <div class="log" role="list">${list.map((p) => `<div class="log-row" role="listitem" data-slug="${p.slug}" data-thumb="${R.asset(p.thumb.src)}">
        <span class="mono dim c-id">${R.id(p)}</span>
        <span class="log-row__title"><a href="project.html?id=${p.slug}" data-stretch>${esc(p.title)}</a></span>
        <span class="mono c-date">${R.date(p.iso, 'dot')}</span>
        <span class="mono dim c-stack">${R.cats(p, true).join(' · ')}</span>
        <span class="c-status">${statusLed(p)}</span></div>`).join('')}</div>`;
  }
  function payload(p) {
    return `<article class="pcard" data-slug="${p.slug}">${CORNERS}
      <div class="pcard__top mono"><span class="sig">${R.id(p)}</span><span class="dim">${R.date(p.iso, 'monoShort')}</span></div>
      <div class="pcard__img${p.thumb.alpha ? ' pcard__img--cut' : ''}">${R.img(p.thumb, p.title)}</div>
      <h3><a href="project.html?id=${p.slug}" data-stretch>${esc(p.title)}</a></h3>
      <p>${esc(p.summary)}</p>
      <dl class="mono"><dt>Class</dt><dd>${R.cats(p, true).join(' · ')}</dd><dt>Stack</dt><dd>${esc(p.stack.slice(0, 3).join(' · ') || '—')}</dd></dl>
    </article>`;
  }
  function hoverPreview(scope) {
    if (!window.matchMedia('(hover: hover)').matches) return;
    let pv = $('.preview');
    if (!pv) { pv = R.el('<div class="preview" aria-hidden="true"><img alt=""></div>'); document.body.appendChild(pv); }
    const im = $('img', pv);
    scope.addEventListener('mouseover', (e) => {
      const row = e.target.closest('.log-row');
      if (!row) return;
      im.src = row.dataset.thumb;
      pv.classList.add('on');
    });
    scope.addEventListener('mousemove', (e) => {
      const x = Math.min(innerWidth - 160, e.clientX + 190), y = Math.min(innerHeight - 120, Math.max(120, e.clientY));
      pv.style.left = x + 'px';
      pv.style.top = y + 'px';
    });
    scope.addEventListener('mouseleave', () => pv.classList.remove('on'));
    scope.addEventListener('mouseout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest('.log-row')) pv.classList.remove('on'); });
  }

  /* ------------------------------------------------------------ home */
  function home() {
    // typed roles
    const typed = $('#typed');
    const roles = D.profile.roles.map((r) => r.toUpperCase());
    if (R.reduced.matches) typed.textContent = roles.join(' / ');
    else {
      let r = 0, n = 0, dir = 1;
      const step = () => {
        const word = roles[r];
        n += dir;
        typed.textContent = word.slice(0, n);
        if (dir > 0 && n >= word.length) { dir = -1; setTimeout(step, 1600); return; }
        if (dir < 0 && n <= 0) { dir = 1; r = (r + 1) % roles.length; }
        setTimeout(step, dir > 0 ? 70 : 35);
      };
      step();
    }
    $$('[data-count-key]').forEach((e) => { e.dataset.count = e.dataset.countKey === 'years' ? D.counts.years.length : D.counts[e.dataset.countKey]; });

    // latest log
    const log = $('#log');
    log.innerHTML = logRows(R.chrono.slice(0, 8));
    hoverPreview(log);

    // payload bay
    const rail = $('#rail');
    const featured = R.chrono.filter((p) => p.featured);
    rail.innerHTML = featured.map(payload).join('');
    $$('[data-rail]').forEach((b) => b.addEventListener('click', () => {
      rail.scrollBy({ left: (b.dataset.rail === 'next' ? 1 : -1) * rail.clientWidth * 0.8, behavior: R.reduced.matches ? 'auto' : 'smooth' });
    }));

    // trajectory: one square per project, stacked when dates collide
    const traj = $('#traj'), tip = $('#traj-tip');
    const t0 = Date.UTC(2023, 0, 1), t1 = Date.UTC(2027, 0, 1);
    const draw = () => {
      const w = traj.clientWidth;
      if (!w) return;
      const step = 13;
      const buckets = new Map();
      const sorted = [...D.projects].sort((a, b) => (a.iso < b.iso ? -1 : 1));
      const html = sorted.map((p) => {
        const [y, m, d] = p.iso.split('-').map(Number);
        const x = ((Date.UTC(y, m - 1, d) - t0) / (t1 - t0)) * w;
        const b = Math.max(0, Math.min(Math.floor(w / step) - 1, Math.round(x / step)));
        const k = buckets.get(b) || 0;
        buckets.set(b, k + 1);
        const c = CAT_COLOR[p.cats[0]];
        return `<button class="traj__tick" type="button" style="left:${b * step + step / 2}px;bottom:${35 + k * 15}px;height:12px;color:${c}" data-slug="${p.slug}" aria-label="${esc(p.title)}, ${R.date(p.iso)}"><i></i></button>`;
      }).join('');
      const years = [2023, 2024, 2025, 2026, 2027].map((yy) => `<span class="traj__year mono" style="left:${((Date.UTC(yy, 0, 1) - t0) / (t1 - t0)) * w}px">${yy}</span>`).join('');
      $('#traj-marks').innerHTML = html + years;
      const maxStack = Math.max(...buckets.values());
      traj.style.height = `${Math.max(150, 35 + maxStack * 15 + 56)}px`;
    };
    draw();
    new ResizeObserver(draw).observe(traj);
    const showTip = (btn) => {
      const p = R.project(btn.dataset.slug);
      tip.innerHTML = `<span class="mono">${R.id(p)} · ${R.date(p.iso, 'monoShort')}</span><br><strong>${esc(p.title)}</strong>`;
      tip.classList.add('on');
      const half = tip.offsetWidth / 2, left = btn.offsetLeft + btn.offsetWidth / 2;
      tip.style.left = `${Math.max(half, Math.min(traj.clientWidth - half, left))}px`;
      tip.style.top = `${Math.max(0, btn.offsetTop - tip.offsetHeight - 10)}px`;
    };
    traj.addEventListener('mouseover', (e) => { const b = e.target.closest('.traj__tick'); if (b) showTip(b); });
    traj.addEventListener('focusin', (e) => { const b = e.target.closest('.traj__tick'); if (b) showTip(b); });
    traj.addEventListener('mouseleave', () => tip.classList.remove('on'));
    traj.addEventListener('focusout', () => tip.classList.remove('on'));
    traj.addEventListener('click', (e) => { const b = e.target.closest('.traj__tick'); if (b) location.href = `project.html?id=${b.dataset.slug}`; });
    const per = {};
    D.projects.forEach((p) => { const y = p.iso.slice(0, 4); per[y] = (per[y] || 0) + 1; });
    $('#traj-years').innerHTML = Object.keys(per).sort().map((y) => `<div><span class="mono dim">${y}</span><b>${per[y]}</b><span class="mono dim">projects</span></div>`).join('');

    // personnel teaser
    $('#person-img').innerHTML = `<img src="${R.asset(D.profile.portraitSignal)}" alt="Ryan L. Griffith above Boulder, Colorado" width="1000" height="1000" loading="lazy">`;
  }

  /* ------------------------------------------------------------ work */
  function work() {
    const state = { cat: R.qs('cat') || 'all', sort: R.qs('sort') || 'recent', q: R.qs('q') || '', view: R.qs('view') || 'log' };
    const cats = [['all', 'All', D.projects.length], ['featured', 'Featured', D.projects.filter((p) => p.featured).length], ['program', 'PRG', D.counts.program],
      ['engineer', 'ENG', D.counts.engineer], ['art', 'ART', D.counts.art], ['new', 'New', D.projects.filter((p) => p.isNew).length]];
    $('#chips').innerHTML = cats.map(([k, l, n]) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${state.cat === k}" ${k === 'program' ? 'title="Programming"' : k === 'engineer' ? 'title="Engineering"' : ''}>${l}<sup>${n}</sup></button>`).join('');
    const q = $('#q'), sort = $('#sort');
    q.value = state.q;
    sort.value = state.sort;
    const out = $('#results');
    hoverPreview(out);
    const render = () => {
      const list = R.filter(state);
      $$('#chips .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat)));
      $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
      $('#result').textContent = `> ${list.length} of ${D.projects.length} missions match`;
      if (!list.length) {
        out.innerHTML = `<div class="empty"><p class="h-sec" style="font-size:clamp(22px,3vw,34px)">No signal for “${esc(state.q)}”.</p><button class="btn" type="button" id="reset">Reset filters</button></div>`;
        $('#reset').addEventListener('click', () => { Object.assign(state, { cat: 'all', q: '', sort: 'recent' }); q.value = ''; sort.value = 'recent'; render(); });
      } else out.innerHTML = state.view === 'grid' ? `<div class="grid">${list.map(payload).join('')}</div>` : logRows(list);
      R.setQs({ cat: state.cat, sort: state.sort, q: state.q, view: state.view === 'log' ? '' : state.view });
    };
    $('#chips').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) { state.cat = b.dataset.cat; render(); } });
    q.addEventListener('input', () => { state.q = q.value; render(); });
    sort.addEventListener('change', () => { state.sort = sort.value; render(); });
    $$('[data-view]').forEach((b) => b.addEventListener('click', () => { state.view = b.dataset.view; render(); }));
    render();

    $('#certs').innerHTML = D.certs.map((c, i) => `<div class="cert">${CORNERS}
      <div class="mono" style="display:flex;justify-content:space-between;gap:8px"><span class="sig">CRT-0${i + 1}</span><span class="dim">${R.date(c.iso, 'dot')}</span></div>
      <button type="button" data-cert="${i}" aria-label="View ${esc(c.title)} certificate">${R.img({ src: c.img, w: c.w, h: c.h }, c.title)}</button>
      <h3>${esc(c.short)}</h3><p class="mono dim">${esc(c.issuer)}</p></div>`).join('');
    $$('[data-cert]').forEach((b) => b.addEventListener('click', () => R.lightbox(D.certs.map((c) => ({ src: c.img })), Number(b.dataset.cert),
      { title: 'Certifications', captions: D.certs.map((c) => `${c.title} — ${c.issuer}, ${R.date(c.iso)}`) })));
  }

  /* ------------------------------------------------------------ project */
  function projectPage() {
    const p = R.project(R.qs('id')) || R.chrono[0];
    document.title = `${R.id(p)} ${p.title} — Ryan L. Griffith`;
    const pixel = /the-kingdom|density|gatsby|rotation|typhlosion|deepwell|hollowdeep|interloper/.test(p.slug);
    $('#crumb-id').textContent = R.id(p);
    $('#p-title').textContent = p.title;
    $('#p-status').innerHTML = statusLed(p);
    $('#telem').innerHTML = `<dl class="mono">
      <div><dt>Mission</dt><dd>${R.id(p)}</dd></div>
      <div><dt>Logged</dt><dd>${R.date(p.iso, 'mono')}</dd></div>
      <div><dt>Class</dt><dd>${R.cats(p).join(' · ')}${p.featured ? ' · Featured' : ''}</dd></div>
      <div><dt>Stack</dt><dd>${esc(p.stack.join(' · ') || '—')}</dd></div>
      <div><dt>Assets</dt><dd>${p.images.length} image${p.images.length === 1 ? '' : 's'}</dd></div>
      ${p.status ? `<div><dt>Status</dt><dd>${esc(p.status)}</dd></div>` : ''}</dl>
      <div class="actions">${p.demo ? `<a class="btn btn--sig" href="demos.html#${p.demo}">Run simulation <span aria-hidden="true">▶</span></a>` : ''}
      ${p.repo ? `<a class="btn" href="${p.repo}" target="_blank" rel="noopener">Source code <span aria-hidden="true">↗</span></a>` : ''}
      <a class="btn" href="work.html">Mission log <span aria-hidden="true">→</span></a></div>`;

    const imgs = p.images;
    const caps = imgs.map((im, i) => D.bl4s.captions[im.src] || `${p.title} — asset ${i + 1}`);
    let cur = 0;
    const stage = $('#stage'), thumbs = $('#thumbs');
    const show = (i) => {
      cur = (i + imgs.length) % imgs.length;
      stage.innerHTML = `${R.img(imgs[cur], `${p.title} — image ${cur + 1} of ${imgs.length}`, { cls: pixel ? 'pixel' : '', eager: true })}
        <button class="zoom" type="button" aria-label="Open image ${cur + 1} full screen"></button>`;
      $('.zoom', stage).addEventListener('click', () => R.lightbox(imgs, cur, { title: p.title, captions: caps }));
      $('#hud-l').textContent = `IMG ${String(cur + 1).padStart(2, '0')}/${String(imgs.length).padStart(2, '0')}`;
      $('#cap').textContent = caps[cur];
      $$('button', thumbs).forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
      const a = $$('button', thumbs)[cur];
      if (a) thumbs.scrollTo({ left: a.offsetLeft - thumbs.clientWidth / 2 + a.clientWidth / 2, behavior: R.reduced.matches ? 'auto' : 'smooth' });
    };
    $('#hud-r').textContent = `${R.id(p)} · ${R.date(p.iso, 'dot')}`;
    thumbs.innerHTML = imgs.map((im, i) => `<button type="button" aria-label="Show image ${i + 1}">${R.img(im, '')}</button>`).join('');
    $$('button', thumbs).forEach((b, i) => b.addEventListener('click', () => show(i)));
    $('#prev').addEventListener('click', () => show(cur - 1));
    $('#next').addEventListener('click', () => show(cur + 1));
    if (imgs.length < 2) { $('.viewer__bar .arrows').hidden = true; thumbs.hidden = true; }
    show(0);

    const blocks = [['01', 'Brief', p.description ? `<div class="prose"><p>${p.description}</p></div>` : `<div class="prose"><p>${esc(p.summary)}</p></div>`]];
    if (p.learned) blocks.push(['02', 'Log · What I learned', `<div class="prose"><p>${p.learned}</p></div>`]);
    if (p.takeaway) blocks.push([String(blocks.length + 1).padStart(2, '0'), 'Debrief · Takeaway', `<div class="prose"><p>${p.takeaway}</p></div>`]);
    if (p.highlights.length) blocks.push([String(blocks.length + 1).padStart(2, '0'), 'Specs', `<ul class="hl">${p.highlights.map((h, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span>${esc(h)}</li>`).join('')}</ul>`]);
    $('#brief').innerHTML = blocks.map(([n, h, body], i) => `<div class="${blocks.length === 2 && i === 0 ? 'span2' : ''}">${CORNERS.replace('corners', 'corners corners--dim')}
      <h2 class="mono"><span>${n}</span>${h}</h2>${body}${i === 0 && p.note ? `<p class="note mono">${esc(p.note)}</p>` : ''}</div>`).join('');

    const { older, newer } = R.neighbors(p.slug);
    $('#pn').innerHTML = [[older, '◀ Previous mission'], [newer, 'Next mission ▶']].map(([q, l]) => `<a href="project.html?id=${q.slug}">${R.img(q.thumb, '')}
      <div><span class="mono dim">${l} · ${R.id(q)}</span><h3>${esc(q.title)}</h3></div></a>`).join('');
  }

  /* ------------------------------------------------------------ about */
  function about() {
    const pr = D.profile;
    $('#scan').innerHTML = `<img src="${R.asset(pr.portraitSignal)}" alt="Ryan L. Griffith sitting on a rock above Boulder, Colorado" width="1000" height="1000">`;
    $('#bio-lede').textContent = pr.about[0];
    $('#bio').innerHTML = pr.about.slice(1).map((t) => `<p>${esc(t)}</p>`).join('');
    $('#clear').innerHTML = D.certs.map((c) => `<div><dt class="mono">${R.date(c.iso, 'dot')}</dt><dd>${esc(c.short)}</dd></div>`).join('');
  }

  /* ------------------------------------------------------------ demos */
  function demos() {
    const list = $('#carts');
    list.innerHTML = D.demos.map((d, i) => `<li><button class="cart" type="button" data-slug="${d.slug}">${R.img({ src: d.thumb }, '')}
      <span><span class="mono dim">Cart 0${i + 1} · ${R.date(d.iso, 'year')}</span><strong>${esc(d.title)}</strong></span></button></li>`).join('');
    const load = (slug, play = false) => {
      const d = D.demos.find((x) => x.slug === slug) || D.demos[0];
      $$('.cart', list).forEach((b) => b.setAttribute('aria-current', String(b.dataset.slug === d.slug)));
      $('#crt-title').textContent = `SIM // ${d.title.toUpperCase()} // PICO-8`;
      $('#crt-open').href = R.asset(d.src);
      $('#bay-blurb').textContent = d.blurb;
      $('#bay-link').href = `project.html?id=${d.slug}`;
      const screen = $('#screen');
      if (play) screen.innerHTML = `<iframe src="${R.asset(d.src)}" title="${esc(d.title)} — playable PICO-8 cartridge" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>`;
      else {
        screen.innerHTML = `<button class="screen__poster" type="button" aria-label="Run ${esc(d.title)}">${R.img({ src: d.thumb }, '')}<span class="btn btn--sig">Run simulation ▶</span></button>`;
        $('.screen__poster', screen).addEventListener('click', () => load(d.slug, true));
      }
      if (location.hash !== `#${d.slug}`) history.replaceState(null, '', `#${d.slug}`);
    };
    list.addEventListener('click', (e) => { const b = e.target.closest('.cart'); if (b) load(b.dataset.slug); });
    $('#crt-full').addEventListener('click', () => { const f = $('#screen iframe') || $('#screen'); (f.requestFullscreen || f.webkitRequestFullscreen || (() => {})).call(f); });
    window.addEventListener('hashchange', () => load(location.hash.slice(1)));
    load(location.hash.slice(1));
  }

  chrome();
  ({ home, work, project: projectPage, about, demos }[page] || (() => {}))();
  R.reveal();
  R.countUp();
  R.year();
})();
