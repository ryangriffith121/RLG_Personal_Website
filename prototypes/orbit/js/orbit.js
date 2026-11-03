/* ORBIT — page chrome (nav, status pill, menu, footer) and the page builders. */
(function () {
  'use strict';
  const R = window.RLG;
  const D = R.data;
  const page = document.body.dataset.page;
  const esc = R.esc;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const ARROW = '<span class="arr" aria-hidden="true">→</span>';
  // absolute URL: a url() inside a custom property resolves against the stylesheet that uses it
  document.documentElement.style.setProperty('--logo', `url("${new URL(R.asset(D.profile.logoMask), location.href).href}")`);

  /* ------------------------------------------------------------ chrome */
  function chrome() {
    const links = [['work', 'Work', 'work.html'], ['about', 'About', 'about.html'], ['demos', 'Demos', 'demos.html'], ['contact', 'Contact', '#contact']];
    const navLinks = links.map(([k, label, href]) => `<a href="${href}"${k === page ? ' aria-current="page"' : ''}>${label}</a>`).join('');
    const status = ['hollowdeep', 'deepwell', 'mp3-player'].map(R.project).filter(Boolean);
    document.body.insertAdjacentHTML('afterbegin', `
      <a class="skip" href="#main">Skip to content</a>
      <header class="nav">
        <div class="nav__pill">
          <a class="nav__logo" href="index.html" aria-label="Ryan L. Griffith, home"><span class="logo-mask" aria-hidden="true"></span></a>
          <nav class="nav__links" aria-label="Primary">${navLinks}</nav>
          <button class="nav__menu" type="button" aria-expanded="false" aria-controls="menu"><i aria-hidden="true"></i>Menu</button>
        </div>
        <div class="status" data-open="false">
          <div class="status__bar">
            <span class="status__name mono"></span>
            <span class="status__date mono"></span>
            <button class="status__toggle" type="button" aria-expanded="false" aria-label="Show latest project">
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" aria-hidden="true"><path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9"/></svg>
            </button>
          </div>
          <div class="status__panel"><div class="status__inner">
            <a class="status__card" href="#"><img alt="" width="112" height="84"><div><p></p><span class="mono">Open project →</span></div></a>
            <div class="status__dots" role="group" aria-label="Latest projects">${status.map((p, i) => `<button type="button" aria-label="${esc(p.title)}" aria-current="${i === 0}"></button>`).join('')}</div>
          </div></div>
        </div>
      </header>
      <div class="menu" id="menu" data-open="false" aria-hidden="true">
        ${[['index.html', 'Home', '00'], ['work.html', 'Work', String(D.counts.projects)], ['about.html', 'About', '—'], ['demos.html', 'Demos', String(D.counts.demos).padStart(2, '0')], ['#contact', 'Contact', '↘']]
          .map(([h, l, n]) => `<a class="menu__big" href="${h}">${l}<span>${n}</span></a>`).join('')}
        <div class="menu__foot mono">${D.profile.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${l.label} ↗</a>`).join('')}</div>
      </div>`);

    // status pill
    const st = $('.status');
    let si = 0;
    const setStatus = (i) => {
      si = (i + status.length) % status.length;
      const p = status[si];
      $('.status__name', st).textContent = p.title;
      $('.status__date', st).textContent = R.date(p.iso, 'monoShort');
      const card = $('.status__card', st);
      card.href = `project.html?id=${p.slug}`;
      const im = $('img', card);
      im.src = R.asset(p.thumb.src);
      im.alt = p.title;
      $('p', card).textContent = p.summary;
      $$('.status__dots button', st).forEach((b, k) => b.setAttribute('aria-current', String(k === si)));
    };
    setStatus(0);
    $('.status__toggle', st).addEventListener('click', (e) => {
      const open = st.dataset.open !== 'true';
      st.dataset.open = String(open);
      e.currentTarget.setAttribute('aria-expanded', String(open));
      e.currentTarget.setAttribute('aria-label', open ? 'Hide latest project' : 'Show latest project');
    });
    $$('.status__dots button', st).forEach((b, k) => b.addEventListener('click', () => setStatus(k)));
    if (!R.reduced.matches) setInterval(() => { if (st.dataset.open !== 'true') setStatus(si + 1); }, 6000);

    // mobile menu
    const menu = $('#menu'), btn = $('.nav__menu');
    const setMenu = (open) => {
      menu.dataset.open = String(open);
      menu.setAttribute('aria-hidden', String(!open));
      btn.setAttribute('aria-expanded', String(open));
      btn.lastChild.textContent = open ? 'Close' : 'Menu';
      document.documentElement.classList.toggle('menu-open', open);
    };
    btn.addEventListener('click', () => setMenu(menu.dataset.open !== 'true'));
    $$('#menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && menu.dataset.open === 'true') setMenu(false); });

    // footer
    const latest = R.project('hollowdeep') || R.chrono[0];
    document.body.insertAdjacentHTML('beforeend', `
      <footer class="foot on-indigo ruled" id="contact">
        <svg class="foot__orbit" viewBox="0 0 640 200" fill="none" aria-hidden="true">
          <path d="M-20 4C90 40 150 140 260 150C360 160 430 70 520 20" stroke="currentColor" stroke-width="1.2" opacity=".85"/>
          <circle cx="260" cy="150" r="17" stroke="currentColor" stroke-dasharray="1.5 3"/>
          <rect x="257" y="147" width="6" height="6" fill="#e5197f"/>
        </svg>
        <div class="wrap">
          <div class="cols">
            <div class="cell"><h2 class="h2 foot__title" data-reveal>Stay in orbit.<br>Let's build something.</h2></div>
          </div>
          <div class="cols foot__grid">
            <div class="cell">
              <p class="label label--lime">Get in touch</p>
              <div class="foot__links">${D.profile.links.map((l) => `<a class="big" href="${l.href}" target="_blank" rel="noopener">${l.label} ↗</a>`).join('')}
              ${D.profile.email ? `<a class="big" href="mailto:${D.profile.email}">${esc(D.profile.email)}</a>` : ''}</div>
            </div>
            <div class="cell">
              <p class="label label--lime">Explore</p>
              <div class="foot__links"><a class="big" href="work.html">Work (${D.counts.projects})</a><a class="big" href="demos.html">Playable demos</a><a class="big" href="about.html">About Ryan</a></div>
            </div>
            <div class="cell">
              <p class="label label--lime">Latest build</p>
              <div class="foot__links"><a class="big" href="project.html?id=${latest.slug}">${esc(latest.title)} →</a></div>
            </div>
          </div>
        </div>
        <div class="wrap"><div class="foot__mark" data-reveal>${R.wordmark({ cls: 'wm', title: 'Griffith' })}</div></div>
        <div class="wrap"><div class="foot__bottom mono">
          <span>© <span data-year></span> Ryan L. Griffith</span>
          <nav aria-label="Footer">${D.profile.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join('')}<a href="#main">Back to top ↑</a></nav>
        </div></div>
      </footer>`);
  }

  /* ------------------------------------------------------------ shared bits */
  function card(p) {
    const tags = R.cats(p).map((c) => `<span class="tag">${c}</span>`).join('') + (p.isNew ? '<span class="tag tag--new">New</span>' : '');
    return `<article class="card" data-slug="${p.slug}" data-reveal>
      <div class="card__meta mono"><span>${R.id(p)}</span><span>${R.date(p.iso, 'monoShort')}</span></div>
      <div class="card__img${p.thumb.alpha ? ' card__img--cut' : ''}" style="background:${p.thumb.tone}">${R.img(p.thumb, p.title)}</div>
      <h3 class="card__title"><a class="card__link" data-stretch href="project.html?id=${p.slug}">${esc(p.title)}</a></h3>
      <p class="card__sum">${esc(p.summary)}</p>
      <div class="card__tags">${tags}</div>
    </article>`;
  }

  /* ------------------------------------------------------------ home */
  function home() {
    const c = D.counts;
    $('[data-stat="projects"]').textContent = c.projects;
    $('#globe-legend').innerHTML = [['#aba2d4', 'Programming', c.program], ['#e9ff97', 'Engineering', c.engineer], ['#e5197f', 'Art', c.art]]
      .map(([col, l, n]) => `<span><i style="background:${col}"></i>${l} ${n}</span>`).join('');
    $$('[data-count-key]').forEach((e) => { e.dataset.count = c[e.dataset.countKey]; });

    // proven: BL4S imagery
    const bl = R.project('bl4s-2026');
    const caps = D.bl4s.captions;
    const pick = (name) => bl.images.find((i) => i.src.endsWith(name));
    const ring = pick('ring.gif');
    $('#proven-main').classList.add('figure--plot');
    $('#proven-main').innerHTML = `${R.img(ring, 'Cherenkov ring reconstructed from detector scans')}<figcaption class="mono">${esc(caps[ring.src])}</figcaption>`;
    $('#proven-strips').innerHTML = `<div class="strips">${['data.jpg', 'sim.jpg', 'pcb.png', 'setup.png'].map((n) => R.img(pick(n), caps[pick(n).src])).join('')}</div>
      <figcaption class="mono">Imagery captured by Centauri Stars, DESY &amp; CERN, 2026</figcaption>`;

    // principles: the second image cell uses the newest render
    const calc = R.project('custom-calc');
    $('#v-img-2').classList.add('vcell--render');
    $('#v-img-2').innerHTML = R.img(calc.images[0], 'Custom Calculator render');

    // mission areas
    const tabs = $('#area-tabs'), panel = $('#area-panel');
    tabs.innerHTML = R.areas.map((a, i) => `<button class="areas__tab" role="tab" id="tab-${a.key}" aria-controls="area-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">
        <span class="mono">${String(i + 1).padStart(2, '0')}</span><span>${a.label}</span><span class="mono">${a.projects.length}</span></button>`).join('');
    const showArea = (i) => {
      const a = R.areas[i];
      $$('.areas__tab', tabs).forEach((b, k) => { b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      panel.setAttribute('aria-labelledby', `tab-${a.key}`);
      const f = a.projects[0];
      panel.innerHTML = `<a class="areas__feature" href="project.html?id=${f.slug}">${R.img(f.images[0] && f.images[0].w > 300 ? f.images[0] : f.thumb, f.title)}
          <span class="mono">${esc(f.title)} — ${R.date(f.iso, 'monoShort')}</span></a>
        <ul class="areas__list">${a.projects.map((p) => `<li><a href="project.html?id=${p.slug}"><span>${esc(p.title)}</span><span>${R.date(p.iso, 'year')}</span></a></li>`).join('')}</ul>`;
    };
    $$('.areas__tab', tabs).forEach((b, i) => {
      b.addEventListener('click', () => showArea(i));
      b.addEventListener('keydown', (e) => {
        const n = R.areas.length;
        const k = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
        if (!k) return;
        e.preventDefault();
        const j = (i + k + n) % n;
        showArea(j);
        $$('.areas__tab', tabs)[j].focus();
      });
    });
    showArea(0);

    // latest launches
    const latest = ['hollowdeep', 'deepwell', 'mp3-player'].map(R.project).filter(Boolean);
    $('#latest').innerHTML = latest.map(card).join('');
  }

  /* ------------------------------------------------------------ work */
  function work() {
    const state = { cat: R.qs('cat') || 'all', sort: R.qs('sort') || 'recent', q: R.qs('q') || '', view: R.qs('view') || 'grid' };
    const cats = [['all', 'All', D.projects.length], ['featured', 'Featured', D.projects.filter((p) => p.featured).length],
      ['program', 'Programming', D.counts.program], ['engineer', 'Engineering', D.counts.engineer], ['art', 'Art', D.counts.art],
      ['new', 'New', D.projects.filter((p) => p.isNew).length]];
    $('#count').textContent = D.counts.projects;
    $('#chips').innerHTML = cats.map(([k, l, n]) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${state.cat === k}">${l}<sup>${n}</sup></button>`).join('');
    const sortSel = $('#sort'), q = $('#q');
    sortSel.value = state.sort;
    q.value = state.q;
    const render = () => {
      const list = R.filter(state);
      $$('#chips .chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat)));
      $$('.view-toggle button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
      $('#result').textContent = `${list.length} of ${D.projects.length} projects`;
      const out = $('#results');
      if (!list.length) {
        out.innerHTML = `<div class="empty"><p class="h3">No projects match “${esc(state.q)}”.</p><button class="btn btn--line" type="button" id="reset">Reset filters</button></div>`;
        $('#reset').addEventListener('click', () => { Object.assign(state, { cat: 'all', q: '', sort: 'recent' }); q.value = ''; sortSel.value = 'recent'; render(); });
      } else if (state.view === 'list') {
        out.innerHTML = `<table class="table"><thead><tr><th>No.</th><th>Project</th><th class="hide-sm">Date</th><th class="hide-md">Disciplines</th><th class="hide-sm hide-md">Built with</th></tr></thead><tbody>
          ${list.map((p) => `<tr class="row" data-slug="${p.slug}" data-href="project.html?id=${p.slug}"><td class="t-mono t-dim">${String(p.no).padStart(3, '0')}</td>
            <td><a class="t-title" href="project.html?id=${p.slug}">${esc(p.title)}</a></td><td class="t-mono hide-sm">${R.date(p.iso, 'monoShort')}</td>
            <td class="t-mono hide-md">${R.cats(p).join(' · ')}</td><td class="t-mono t-dim hide-sm hide-md">${esc(p.stack.slice(0, 3).join(' · '))}</td></tr>`).join('')}
          </tbody></table>`;
        $$('tr.row', out).forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('a')) location.href = tr.dataset.href; }));
      } else {
        out.innerHTML = `<div class="cards">${list.map(card).join('')}</div>`;
      }
      R.reveal(out);
      R.setQs({ cat: state.cat, sort: state.sort, q: state.q, view: state.view === 'grid' ? '' : state.view });
    };
    $('#chips').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) { state.cat = b.dataset.cat; render(); } });
    sortSel.addEventListener('change', () => { state.sort = sortSel.value; render(); });
    q.addEventListener('input', () => { state.q = q.value; render(); });
    $$('.view-toggle button').forEach((b) => b.addEventListener('click', () => { state.view = b.dataset.view; render(); }));
    render();

    $('#certs').innerHTML = D.certs.map((c, i) => `<div class="cert" data-reveal>
        <div class="mono" style="display:flex;justify-content:space-between;gap:10px"><span>${String(i + 1).padStart(2, '0')}</span><span>${R.date(c.iso, 'monoShort')}</span></div>
        <button type="button" data-cert="${i}" aria-label="View ${esc(c.title)} certificate">${R.img({ src: c.img, w: c.w, h: c.h }, c.title)}</button>
        <h3 class="h3">${esc(c.short)}</h3><p class="mono" style="color:var(--indigo-300)">${esc(c.issuer)}</p></div>`).join('');
    $$('[data-cert]').forEach((b) => b.addEventListener('click', () => R.lightbox(D.certs.map((c) => ({ src: c.img })), Number(b.dataset.cert),
      { title: 'Certifications', captions: D.certs.map((c) => `${c.title} — ${c.issuer}, ${R.date(c.iso)}`) })));
  }

  /* ------------------------------------------------------------ project */
  function projectPage() {
    const p = R.project(R.qs('id')) || R.chrono[0];
    document.title = `${p.title} — Ryan L. Griffith`;
    const pixel = /the-kingdom|density|gatsby|rotation|typhlosion|deepwell|hollowdeep|interloper/.test(p.slug);
    $('#crumb-id').textContent = R.id(p);
    $('#p-title').textContent = p.title;
    $('#p-meta').innerHTML = `
      <div><dt class="mono">Date</dt><dd>${R.date(p.iso)}</dd></div>
      <div><dt class="mono">Disciplines</dt><dd>${R.cats(p).join(', ')}${p.featured ? ' · Featured' : ''}</dd></div>
      <div><dt class="mono">Built with</dt><dd>${esc(p.stack.join(', ') || '—')}</dd></div>
      <div><dt class="mono">${p.status ? 'Status' : 'Images'}</dt><dd>${esc(p.status || String(p.images.length))}</dd></div>`;

    // viewer
    const imgs = p.images;
    const captions = imgs.map((im, i) => (D.bl4s.captions[im.src] || `${p.title}, image ${i + 1}`));
    let cur = 0;
    const stage = $('#stage'), thumbs = $('#thumbs');
    const show = (i) => {
      cur = (i + imgs.length) % imgs.length;
      const im = imgs[cur];
      stage.innerHTML = `${R.img(im, `${p.title} — image ${cur + 1} of ${imgs.length}`, { cls: pixel ? 'pixel' : '', eager: true })}
        <button class="zoom" type="button" aria-label="Open image ${cur + 1} full screen"></button>`;
      $('.zoom', stage).addEventListener('click', () => R.lightbox(imgs, cur, { title: p.title, captions }));
      $('#cap').textContent = `${String(cur + 1).padStart(2, '0')} / ${String(imgs.length).padStart(2, '0')} — ${captions[cur]}`;
      $$('button', thumbs).forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
      const active = $$('button', thumbs)[cur];
      if (active) thumbs.scrollTo({ left: active.offsetLeft - thumbs.clientWidth / 2 + active.clientWidth / 2, behavior: R.reduced.matches ? 'auto' : 'smooth' });
    };
    thumbs.innerHTML = imgs.map((im, i) => `<button type="button" aria-label="Show image ${i + 1}">${R.img(im, '')}</button>`).join('');
    $$('button', thumbs).forEach((b, i) => b.addEventListener('click', () => show(i)));
    $('#prev').addEventListener('click', () => show(cur - 1));
    $('#next').addEventListener('click', () => show(cur + 1));
    if (imgs.length < 2) { $('.viewer__arrows').hidden = true; thumbs.hidden = true; }
    show(0);

    // text
    const blocks = [];
    blocks.push(['Description', `<div class="prose">${p.description ? `<p>${p.description}</p>` : `<p>${esc(p.summary)}</p>`}</div>`]);
    if (p.learned) blocks.push(['What I learned', `<div class="prose"><p>${p.learned}</p></div>`]);
    if (p.takeaway) blocks.push(['Takeaway', `<div class="prose"><p>${p.takeaway}</p></div>`]);
    if (p.highlights.length) blocks.push(['Highlights', `<ul class="hl">${p.highlights.map((h, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span>${esc(h)}</li>`).join('')}</ul>`]);
    const actions = [];
    if (p.demo) actions.push(`<a class="btn btn--lime" href="demos.html#${p.demo}">Play the demo ${ARROW}</a>`);
    if (p.repo) actions.push(`<a class="btn btn--line" href="${p.repo}" target="_blank" rel="noopener">Source on GitHub ↗</a>`);
    $('#p-body').innerHTML = blocks.map(([h, body], i) => `<div class="cell${blocks.length === 1 ? ' span-2' : ''}" data-reveal>
        <p class="label label--lime">${String(i + 1).padStart(2, '0')} / ${h}</p><div style="margin-top:18px">${body}</div>
        ${i === 0 && p.note ? `<p class="note mono">${esc(p.note)}</p>` : ''}
        ${i === 0 && actions.length ? `<div class="p-actions">${actions.join('')}</div>` : ''}</div>`).join('');

    // neighbours
    const { older, newer } = R.neighbors(p.slug);
    $('#pn').innerHTML = [[older, '← Older'], [newer, 'Newer →']].map(([q, l]) => `<a href="project.html?id=${q.slug}">
      ${R.img(q.thumb, '')}<div><span class="mono">${l} · ${R.id(q)}</span><p class="h3">${esc(q.title)}</p></div></a>`).join('');
  }

  /* ------------------------------------------------------------ about */
  function about() {
    const pr = D.profile;
    $('#portrait').innerHTML = `<img src="${R.asset(pr.portraitDuo)}" alt="Ryan L. Griffith sitting on a rock above Boulder, Colorado" width="1000" height="1000">
      <img class="color" src="${R.asset(pr.portrait)}" alt="" width="1000" height="1000" loading="lazy">`;
    $('#bio-lede').textContent = pr.about[0];
    $('#bio-rest').innerHTML = pr.about.slice(1).map((t) => `<p>${esc(t)}</p>`).join('');
    $('#certs').innerHTML = D.certs.map((c, i) => `<div class="vcell" data-reveal tabindex="0">
        <h3>${esc(c.title)}</h3><p>${esc(c.issuer)} · earned ${R.date(c.iso)}</p><span class="num">${i + 1}</span></div>`).join('');
  }

  /* ------------------------------------------------------------ demos */
  function demos() {
    const list = $('#demo-list');
    list.innerHTML = D.demos.map((d, i) => `<li><button class="demo-btn" type="button" data-slug="${d.slug}">
      <span class="mono">${String(i + 1).padStart(2, '0')}</span>${R.img({ src: d.thumb }, '')}<span class="h3">${esc(d.title)}</span></button></li>`).join('');
    const load = (slug, play = false) => {
      const d = D.demos.find((x) => x.slug === slug) || D.demos[0];
      $$('.demo-btn', list).forEach((b) => b.setAttribute('aria-current', String(b.dataset.slug === d.slug)));
      $('#win-title').textContent = `${d.title.toUpperCase().replace(/\s+/g, '_')}.P8 — PICO-8`;
      $('#win-open').href = R.asset(d.src);
      $('#demo-blurb').textContent = d.blurb;
      $('#demo-link').href = `project.html?id=${d.slug}`;
      const screen = $('#screen');
      if (play) {
        screen.innerHTML = `<iframe src="${R.asset(d.src)}" title="${esc(d.title)} — playable PICO-8 cartridge" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>`;
      } else {
        screen.innerHTML = `<button class="screen__poster" type="button" aria-label="Load ${esc(d.title)}">${R.img({ src: d.thumb }, '')}<span class="btn btn--lime">Insert cartridge ▶</span></button>`;
        $('.screen__poster', screen).addEventListener('click', () => load(d.slug, true));
      }
      if (location.hash !== `#${d.slug}`) history.replaceState(null, '', `#${d.slug}`);
    };
    list.addEventListener('click', (e) => { const b = e.target.closest('.demo-btn'); if (b) load(b.dataset.slug); });
    $('#win-full').addEventListener('click', () => {
      const f = $('#screen iframe') || $('#screen');
      (f.requestFullscreen || f.webkitRequestFullscreen || (() => {})).call(f);
    });
    window.addEventListener('hashchange', () => load(location.hash.slice(1)));
    load(location.hash.slice(1));
  }

  chrome();
  ({ home, work, project: projectPage, about, demos }[page] || (() => {}))();
  R.reveal();
  R.countUp();
  R.year();
})();
