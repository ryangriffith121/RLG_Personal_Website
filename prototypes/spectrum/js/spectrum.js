/* SPECTRUM — chrome (nav, menu, footer), stretch-to-fit type, proximity letters and page builders. */
(function () {
  'use strict';
  const R = window.RLG;
  const D = R.data;
  const page = document.body.dataset.page;
  const esc = R.esc;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const THEME = { program: 't-indigo', engineer: 't-lime', art: 't-pink' };
  const ARR = '<span class="arr" aria-hidden="true">→</span>';
  const theme = (p) => THEME[p.cats[0]] || 't-ink';
  document.documentElement.style.setProperty('--logo', `url("${new URL(R.asset(D.profile.logoMask), location.href).href}")`);

  /* ------------------------------------------------------------ stretch-to-fit
     <span class="fit" data-fit data-fit-h="0.8">WORD</span> fills its parent's content width by
     moving along the font's width axis (50–150%), then letter-spacing if it is still short. */
  function fit(scope = document) {
    $$('[data-fit]', scope).forEach((el) => {
      const box = el.parentElement;
      const cs = getComputedStyle(box);
      const W = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (W <= 0) return;
      const n = Math.max(1, el.textContent.length);
      const maxH = el.dataset.fitH ? box.clientHeight * Number(el.dataset.fitH) : Infinity;
      let fs = Math.min(maxH, Number(el.dataset.max || 900), W);
      el.style.letterSpacing = '0px';
      el.style.fontSize = `${fs}px`;
      const at = (wd) => { el.style.fontStretch = `${wd}%`; return el.getBoundingClientRect().width; };
      let narrow = at(50);
      if (narrow > W) { fs *= W / narrow; el.style.fontSize = `${fs}px`; narrow = at(50); }
      const wide = at(150);
      if (wide <= W) {
        el.style.letterSpacing = `${Math.max(0, (W - wide) / n)}px`;
      } else {
        let lo = 50, hi = 150;
        for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (at(mid) > W) hi = mid; else lo = mid; }
        at(lo);
      }
      el.dataset.fitted = '1';
    });
  }
  /* one span per letter; the enclosing link carries the accessible name */
  function split(el) {
    el.innerHTML = [...el.textContent].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
  }
  /* letters swell vertically as the pointer gets close (transforms only: layout never moves) */
  function proximity(zone) {
    if (R.reduced.matches || !window.matchMedia('(hover: hover)').matches) return;
    const letters = $$('.ch', zone);
    let px = -1e4, py = -1e4, raf = 0;
    const paint = () => {
      raf = 0;
      letters.forEach((l) => {
        const r = l.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - px, r.top + r.height * 0.6 - py);
        const k = Math.max(0, 1 - d / 260);
        l.style.transform = k ? `scaleY(${(1 + 0.3 * k * k).toFixed(3)})` : '';
      });
    };
    zone.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(paint); });
    zone.addEventListener('pointerleave', () => { px = py = -1e4; if (!raf) raf = requestAnimationFrame(paint); });
  }
  /* big headings: shrink until the longest word fits the column (no breaks inside words) */
  const FITDOWN = '.slide h3, .p-title, .tile h3, .pn h3, .list-row h3, .num b';
  function fitDown(scope = document) {
    $$(FITDOWN, scope).forEach((el) => {
      el.style.fontSize = '';
      let fs = parseFloat(getComputedStyle(el).fontSize);
      for (let i = 0; i < 40 && el.scrollWidth > el.clientWidth + 1 && fs > 16; i++) {
        fs *= 0.94;
        el.style.fontSize = `${fs}px`;
      }
    });
  }
  let fitTimer = 0;
  const refit = () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { fit(); fitDown(); }, 80); };
  window.addEventListener('resize', refit);

  /* ------------------------------------------------------------ chrome */
  function chrome() {
    const links = [['work', 'Work', 'work.html'], ['about', 'About', 'about.html'], ['demos', 'Demos', 'demos.html'], ['contact', 'Contact', '#contact']];
    document.body.insertAdjacentHTML('afterbegin', `
      <a class="skip" href="#main">Skip to content</a>
      <header class="nav">
        <a class="nav__brand" href="index.html" aria-label="Ryan L. Griffith, home"><span class="logo-mask" aria-hidden="true"></span>Ryan L. Griffith</a>
        <nav class="nav__links" aria-label="Primary">${links.map(([k, l, h]) => `<a href="${h}"${k === page ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
        <button class="nav__menu" type="button" aria-expanded="false" aria-controls="menu">Menu</button>
      </header>
      <div class="menu" id="menu" data-open="false" aria-hidden="true">
        ${[['index.html', 'Home', 't-grey'], ['work.html', 'Work', 't-indigo'], ['about.html', 'About', 't-lime'], ['demos.html', 'Demos', 't-pink'], ['#contact', 'Contact', 't-ink']]
          .map(([h, l, t], i) => `<a class="${t}" href="${h}">${l}<span>0${i}</span></a>`).join('')}
      </div>`);
    const menu = $('#menu'), btn = $('.nav__menu');
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

    document.body.insertAdjacentHTML('beforeend', `
      <footer id="contact">
        <div class="foot__cta t-lime">
          <h2 class="h2" data-reveal>Let's make something bold.</h2>
          <div class="foot__links">
            ${D.profile.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener"><span>${l.label}</span><span class="arr" aria-hidden="true">↗</span></a>`).join('')}
            ${D.profile.email ? `<a href="mailto:${D.profile.email}"><span>${esc(D.profile.email)}</span>${ARR}</a>` : ''}
            <a href="work.html"><span>All ${D.counts.projects} projects</span>${ARR}</a>
            <a href="demos.html"><span>Play the demos</span>${ARR}</a>
          </div>
        </div>
        <div class="t-ink">
          <div class="foot__mark"><span class="fit" data-fit data-max="520">Ryan L. Griffith</span></div>
          <div class="foot__bottom mono"><span>© <span data-year></span> Ryan L. Griffith · Boulder, Colorado</span>
            <nav aria-label="Footer"><a href="index.html">Home</a><a href="work.html">Work</a><a href="#main">Top ↑</a></nav></div>
        </div>
      </footer>`);
  }

  /* ------------------------------------------------------------ shared */
  function tile(p, big = false) {
    const cut = p.thumb.alpha ? ' tile__img--cut' : '';
    return `<article class="tile ${theme(p)}${big ? ' tile--big' : ''}" data-slug="${p.slug}">
      <div class="tile__top mono"><span>${R.id(p)}</span><span>${R.date(p.iso, 'monoShort')}</span></div>
      <div class="tile__img${cut}">${R.img(p.thumb, p.title)}</div>
      <h3><a href="project.html?id=${p.slug}" data-stretch>${esc(p.title)}</a></h3>
      <p class="sum">${esc(p.summary)}</p>
    </article>`;
  }

  /* ------------------------------------------------------------ home */
  function home() {
    $$('.band__word').forEach(split);
    $$('[data-count-key]').forEach((e) => { e.textContent = D.counts[e.dataset.countKey]; });
    const pills = { prg: R.project('hollowdeep'), eng: R.project('custom-calc'), art: R.project('skull-2026') };
    Object.entries(pills).forEach(([k, p]) => { const s = $(`[data-pill="${k}"]`); if (s) s.style.backgroundImage = `url("${R.asset(p.thumb.src)}")`; });

    // featured deck
    const picks = ['bl4s-2026', 'hollowdeep', 'deepwell', 'custom-calc', 'skull-2026', 'raycast-fps'].map(R.project).filter(Boolean);
    const themes = ['t-indigo', 't-lime', 't-pink', 't-ink', 't-paper', 't-deep'];
    const pixel = (p) => /deepwell|hollowdeep|raycast|kingdom|density|gatsby/.test(p.slug);
    $('#deck').innerHTML = picks.map((p, i) => {
      const im = p.images[0] && p.images[0].w >= 600 ? p.images[0] : p.thumb;
      const cut = p.thumb.alpha || /\.webp$/.test(im.src) && /generated/.test(im.src);
      return `<article class="slide ${themes[i % themes.length]}" style="--i:${i}" data-slug="${p.slug}">
        <div class="slide__text">
          <div class="slide__no mono"><span>${String(i + 1).padStart(2, '0')} / ${String(picks.length).padStart(2, '0')}</span><span>${R.date(p.iso, 'month')}</span></div>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.summary)}</p>
          <div class="tags">${R.cats(p).map((c) => `<span class="tag">${c}</span>`).join('')}</div>
          <a class="btn btn--solid" href="project.html?id=${p.slug}">Open project ${ARR}</a>
        </div>
        <div class="slide__img${cut ? ' slide__img--cut' : ''}${pixel(p) ? ' slide__img--pixel' : ''}">${R.img(im, p.title)}</div>
      </article>`;
    }).join('');

    // latest mosaic
    const latest = R.chrono.slice(0, 9);
    $('#latest').innerHTML = latest.map((p, i) => tile(p, i === 0)).join('');
  }

  /* ------------------------------------------------------------ work */
  function work() {
    const state = { cat: R.qs('cat') || 'all', sort: R.qs('sort') || 'recent', q: R.qs('q') || '', view: R.qs('view') || 'grid' };
    const cats = [['all', 'Everything', D.projects.length], ['featured', 'Featured', D.projects.filter((p) => p.featured).length],
      ['program', 'Programming', D.counts.program], ['engineer', 'Engineering', D.counts.engineer], ['art', 'Art', D.counts.art],
      ['new', 'New', D.projects.filter((p) => p.isNew).length]];
    $('#chips').innerHTML = cats.map(([k, l, n]) => `<button class="pill-btn" type="button" data-cat="${k}" aria-pressed="${state.cat === k}">${l}<sup>${n}</sup></button>`).join('');
    const q = $('#q'), sort = $('#sort');
    q.value = state.q;
    sort.value = state.sort;
    const out = $('#results');
    const render = () => {
      const list = R.filter(state);
      $$('#chips .pill-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat)));
      $$('[data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
      $('#result').textContent = `${list.length} of ${D.projects.length} projects`;
      if (!list.length) {
        out.innerHTML = `<div class="empty"><p class="h2" style="font-size:clamp(28px,4vw,56px)">Nothing for “${esc(state.q)}”.</p><button class="btn" type="button" id="reset">Reset filters ${ARR}</button></div>`;
        $('#reset').addEventListener('click', () => { Object.assign(state, { cat: 'all', q: '', sort: 'recent' }); q.value = ''; sort.value = 'recent'; render(); });
      } else if (state.view === 'list') {
        out.innerHTML = `<div style="border-top:2px solid var(--ink)">${list.map((p) => `<div class="list-row c-${p.cats[0]}" data-slug="${p.slug}">
          <span class="mono l-no">${String(p.no).padStart(3, '0')}</span><h3><a href="project.html?id=${p.slug}" data-stretch>${esc(p.title)}</a></h3>
          <span class="mono">${R.date(p.iso, 'year')}</span>
          <span class="dots" aria-label="${R.cats(p).join(', ')}">${['program', 'engineer', 'art'].map((c) => `<i style="background:${p.cats.includes(c) ? { program: 'var(--indigo)', engineer: 'var(--lime)', art: 'var(--pink)' }[c] : 'transparent'}"></i>`).join('')}</span>
        </div>`).join('')}</div>`;
      } else {
        out.innerHTML = `<div class="mosaic">${list.map((p) => tile(p, p.featured && state.sort === 'recent' && state.cat === 'all' && !state.q)).join('')}</div>`;
      }
      R.setQs({ cat: state.cat, sort: state.sort, q: state.q, view: state.view === 'grid' ? '' : state.view });
      fitDown(out);
    };
    $('#chips').addEventListener('click', (e) => { const b = e.target.closest('.pill-btn'); if (b) { state.cat = b.dataset.cat; render(); } });
    q.addEventListener('input', () => { state.q = q.value; render(); });
    sort.addEventListener('change', () => { state.sort = sort.value; render(); });
    $$('[data-view]').forEach((b) => b.addEventListener('click', () => { state.view = b.dataset.view; render(); }));
    render();

    const tilt = ['-2deg', '1.5deg', '-1deg', '2deg'];
    const tthemes = ['t-indigo', 't-lime', 't-pink', 't-deep'];
    $('#certs').innerHTML = D.certs.map((c, i) => `<div class="sticker ${tthemes[i]}" style="--r:${tilt[i]}">
      <div class="mono" style="display:flex;justify-content:space-between;gap:8px"><span>${String(i + 1).padStart(2, '0')}</span><span>${R.date(c.iso, 'short')}</span></div>
      <button type="button" data-cert="${i}" aria-label="View ${esc(c.title)} certificate">${R.img({ src: c.img, w: c.w, h: c.h }, c.title)}</button>
      <h3>${esc(c.short)}</h3><p class="mono">${esc(c.issuer)}</p></div>`).join('');
    $$('[data-cert]').forEach((b) => b.addEventListener('click', () => R.lightbox(D.certs.map((c) => ({ src: c.img })), Number(b.dataset.cert),
      { title: 'Certifications', captions: D.certs.map((c) => `${c.title} — ${c.issuer}, ${R.date(c.iso)}`) })));
  }

  /* ------------------------------------------------------------ project */
  function projectPage() {
    const p = R.project(R.qs('id')) || R.chrono[0];
    document.title = `${p.title} — Ryan L. Griffith`;
    const head = $('#phead');
    head.classList.add(theme(p));
    const pixel = /the-kingdom|density|gatsby|rotation|typhlosion|deepwell|hollowdeep|interloper/.test(p.slug);
    $('#crumb-id').textContent = `${R.id(p)} · ${R.date(p.iso)}`;
    $('#p-title').textContent = p.title;
    $('#p-sum').textContent = p.summary;
    $('#p-meta').innerHTML = [...R.cats(p), ...(p.featured ? ['Featured'] : []), ...(p.status ? [p.status] : []), ...p.stack.slice(0, 4)]
      .map((t) => `<span class="tag">${esc(t)}</span>`).join('');

    const imgs = p.images;
    const caps = imgs.map((im, i) => D.bl4s.captions[im.src] || `${p.title} — image ${i + 1}`);
    let cur = 0;
    const stage = $('#stage'), thumbs = $('#thumbs');
    const show = (i) => {
      cur = (i + imgs.length) % imgs.length;
      stage.innerHTML = `${R.img(imgs[cur], `${p.title} — image ${cur + 1} of ${imgs.length}`, { cls: pixel ? 'pixel' : '', eager: true })}
        <button class="zoom" type="button" aria-label="Open image ${cur + 1} full screen"></button>`;
      $('.zoom', stage).addEventListener('click', () => R.lightbox(imgs, cur, { title: p.title, captions: caps }));
      $('#counter').textContent = `${String(cur + 1).padStart(2, '0')}/${String(imgs.length).padStart(2, '0')}`;
      $('#cap').textContent = caps[cur];
      $$('button', thumbs).forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
      const a = $$('button', thumbs)[cur];
      if (a) thumbs.scrollTo({ left: a.offsetLeft - thumbs.clientWidth / 2 + a.clientWidth / 2, behavior: R.reduced.matches ? 'auto' : 'smooth' });
    };
    thumbs.innerHTML = imgs.map((im, i) => `<button type="button" aria-label="Show image ${i + 1}">${R.img(im, '')}</button>`).join('');
    $$('button', thumbs).forEach((b, i) => b.addEventListener('click', () => show(i)));
    $('#prev').addEventListener('click', () => show(cur - 1));
    $('#next').addEventListener('click', () => show(cur + 1));
    if (imgs.length < 2) { $('.arrows').hidden = true; thumbs.hidden = true; }
    show(0);

    const acts = [];
    if (p.demo) acts.push(`<a class="btn btn--solid" href="demos.html#${p.demo}">Play it ${ARR}</a>`);
    if (p.repo) acts.push(`<a class="btn" href="${p.repo}" target="_blank" rel="noopener">GitHub ↗</a>`);
    const blocks = [['The project', `<div class="prose"><p>${p.description || esc(p.summary)}</p></div>${p.note ? `<p class="note mono">${esc(p.note)}</p>` : ''}${acts.length ? `<div class="acts">${acts.join('')}</div>` : ''}`, 't-paper']];
    if (p.learned) blocks.push(['What I learned', `<div class="prose"><p>${p.learned}</p></div>`, theme(p)]);
    if (p.takeaway) blocks.push(['Takeaway', `<div class="prose"><p>${p.takeaway}</p></div>`, 't-deep']);
    if (p.highlights.length) blocks.push(['Highlights', `<ul class="hl">${p.highlights.map((h, i) => `<li><span>${i + 1}</span>${esc(h)}</li>`).join('')}</ul>`, p.learned ? 't-ink' : theme(p)]);
    $('#story').innerHTML = blocks.map(([h, body, t], i) => `<div class="${t}${blocks.length === 2 && i === 0 ? ' span-2' : ''}" data-reveal><h2>${h}</h2>${body}</div>`).join('');

    const { older, newer } = R.neighbors(p.slug);
    $('#pn').innerHTML = [[older, '← Older'], [newer, 'Newer →']].map(([o, l]) => `<a class="${theme(o)}" href="project.html?id=${o.slug}">
      <span class="mono">${l} · ${R.id(o)}</span><h3>${esc(o.title)}</h3></a>`).join('');
  }

  /* ------------------------------------------------------------ about */
  function about() {
    const pr = D.profile;
    $('#portrait').innerHTML = `<img src="${R.asset(pr.portraitDuo)}" alt="Ryan L. Griffith sitting on a rock above Boulder, Colorado" width="1000" height="1000">
      <img class="color" src="${R.asset(pr.portrait)}" alt="" width="1000" height="1000" loading="lazy">`;
    $('#bio-lede').textContent = pr.about[0];
    $('#bio').innerHTML = pr.about.slice(1).map((t) => `<p>${esc(t)}</p>`).join('');
    const tilt = ['-2deg', '1.5deg', '-1deg', '2deg'];
    const tthemes = ['t-indigo', 't-lime', 't-pink', 't-deep'];
    $('#certs').innerHTML = D.certs.map((c, i) => `<div class="sticker ${tthemes[i]}" style="--r:${tilt[i]}">
      <div class="mono" style="display:flex;justify-content:space-between;gap:8px"><span>${String(i + 1).padStart(2, '0')}</span><span>${R.date(c.iso, 'short')}</span></div>
      <h3>${esc(c.title)}</h3><p class="mono">${esc(c.issuer)}</p></div>`).join('');
  }

  /* ------------------------------------------------------------ demos */
  function demos() {
    const list = $('#carts');
    const themes = ['t-lime', 't-pink', 't-indigo', 't-paper', 't-deep'];
    list.innerHTML = D.demos.map((d, i) => `<li><button class="cart ${themes[i % themes.length]}" type="button" data-slug="${d.slug}">${R.img({ src: d.thumb }, '')}
      <span><span class="mono">Cartridge ${String(i + 1).padStart(2, '0')} · ${R.date(d.iso, 'year')}</span><strong>${esc(d.title)}</strong></span></button></li>`).join('');
    const load = (slug, play = false) => {
      const d = D.demos.find((x) => x.slug === slug) || D.demos[0];
      $$('.cart', list).forEach((b) => b.setAttribute('aria-current', String(b.dataset.slug === d.slug)));
      $('#bz-title').textContent = `${d.title} · PICO-8`;
      $('#bz-open').href = R.asset(d.src);
      $('#arcade-blurb').textContent = d.blurb;
      $('#arcade-link').href = `project.html?id=${d.slug}`;
      const screen = $('#screen');
      if (play) screen.innerHTML = `<iframe src="${R.asset(d.src)}" title="${esc(d.title)} — playable PICO-8 cartridge" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>`;
      else {
        screen.innerHTML = `<button class="screen__poster" type="button" aria-label="Play ${esc(d.title)}">${R.img({ src: d.thumb }, '')}<span class="btn">Press start ▶</span></button>`;
        $('.screen__poster', screen).addEventListener('click', () => load(d.slug, true));
      }
      if (location.hash !== `#${d.slug}`) history.replaceState(null, '', `#${d.slug}`);
    };
    list.addEventListener('click', (e) => { const b = e.target.closest('.cart'); if (b) load(b.dataset.slug); });
    $('#bz-full').addEventListener('click', () => { const f = $('#screen iframe') || $('#screen'); (f.requestFullscreen || f.webkitRequestFullscreen || (() => {})).call(f); });
    window.addEventListener('hashchange', () => load(location.hash.slice(1)));
    load(location.hash.slice(1));
  }

  chrome();
  ({ home, work, project: projectPage, about, demos }[page] || (() => {}))();
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fitDown();
  ready.then(() => {
    fit();
    fitDown();
    $$('.hero .band').forEach(proximity);
    document.documentElement.classList.add('fitted');
  });
  R.reveal();
  R.countUp();
  R.year();
})();
