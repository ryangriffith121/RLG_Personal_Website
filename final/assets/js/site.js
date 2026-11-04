/* RyanLGriffith.com: behaviour layered on top of what PHP already rendered, so every page still
   reads without it. Shared: the menu, the search palette (/ or Ctrl+K), stretch-to-fit type,
   reveals, counters and the lightbox. Per page: the work index filters, the project gallery, the
   arcade, the about desk and certificates. */
(function () {
  'use strict';
  const doc = document.documentElement;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.prototype.slice.call((el || document).querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const page = document.body.dataset.page || '';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const typing = (el) => !!el && (/^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable);
  const readJSON = (id) => {
    const node = document.getElementById(id);
    if (!node) return null;
    try { return JSON.parse(node.textContent); } catch (err) { return null; }
  };
  const CATS = { program: 'Programming', engineer: 'Engineering', art: 'Art' };
  const SHORT = { program: 'PRG', engineer: 'ENG', art: 'ART' };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const INDEX = readJSON('rlg-index') || [];
  /* the <head> adds .js, and takes it away again if this file has not run after a few seconds (so
     nothing stays hidden). If that happened, show everything at once and turn .js back on. */
  const motion = doc.classList.contains('js');
  if (!motion) {
    $$('[data-reveal], [data-drop]').forEach((el) => el.classList.add('is-in'));
    doc.classList.add('js');
  }
  window.RLG = { index: INDEX, cats: CATS, short: SHORT };

  /* runs fn(k) with k going 0 to 1 over ms; a timer backs up requestAnimationFrame so it always finishes */
  function tween(ms, fn) {
    const t0 = performance.now();
    let raf = 0, timer = 0, done = false;
    const step = () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      if (done) return;
      const k = Math.min(1, (performance.now() - t0) / ms);
      fn(k);
      if (k >= 1) { done = true; return; }
      raf = requestAnimationFrame(step);
      timer = setTimeout(step, 100);
    };
    step();
  }

  /* calls fn when any of els comes within the viewport; plain scroll checks, no observers needed */
  function whenSeen(els, margin, fn) {
    let pending = els.slice();
    if (!pending.length) return;
    let timer = 0;
    const check = () => {
      timer = 0;
      const h = window.innerHeight || doc.clientHeight;
      pending = pending.filter((el) => {
        const r = el.getBoundingClientRect();
        if ((r.width || r.height) && r.top < h * margin) { fn(el); return false; }
        return true;
      });
      if (!pending.length) {
        window.removeEventListener('scroll', soon);
        window.removeEventListener('resize', soon);
      }
    };
    const soon = () => { if (!timer) timer = setTimeout(check, 60); };
    window.addEventListener('scroll', soon, { passive: true });
    window.addEventListener('resize', soon);
    check();
  }

  /* ------------------------------------------------------------ stretch-to-fit type
     <span class="fit" data-fit data-max="380" data-fit-h="0.74">WORD</span> fills its parent's width by
     moving along Anybody's width axis (50–150%), then by letter-spacing if it is still short. */
  function fit() {
    $$('[data-fit]').forEach((el) => {
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
    });
  }
  /* headings that must not break inside a word shrink until the longest word fits */
  const FITDOWN = '.slide h3, .p-title, .tile h3, .pn h3, .num b, .h2, .story h2, .tools3 h3, .cart strong, .sticker h3, .empty p, .tl__label b';
  function fitDown(scope) {
    $$(FITDOWN, scope).forEach((el) => {
      el.style.fontSize = '';
      let fs = parseFloat(getComputedStyle(el).fontSize);
      for (let i = 0; i < 40 && el.scrollWidth > el.clientWidth + 1 && fs > 14; i++) {
        fs *= 0.94;
        el.style.fontSize = `${fs}px`;
      }
    });
  }
  let fitTimer = 0;
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(() => {
      const w = window.innerWidth;
      const widthChanged = w !== lastW;
      lastW = w;
      fit();                       // the bands follow the height too, so always refit those
      if (widthChanged) fitDown();
    }, 90);
  });

  /* one span per letter in the hero bands; the link around them carries the name */
  function split(el) {
    el.innerHTML = Array.from(el.textContent).map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('');
  }
  /* the letters stretch upwards as the pointer comes close (transforms only, so nothing reflows) */
  function proximity(zone) {
    if (reduced.matches || !window.matchMedia('(hover: hover)').matches) return;
    const letters = $$('.ch', zone);
    let px = -1e4, py = -1e4, queued = false;
    const paint = () => {
      queued = false;
      letters.forEach((l) => {
        const r = l.getBoundingClientRect();
        const d = Math.hypot(r.left + r.width / 2 - px, r.top + r.height * 0.6 - py);
        const k = Math.max(0, 1 - d / 260);
        l.style.transform = k ? `scaleY(${(1 + 0.3 * k * k).toFixed(3)})` : '';
      });
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(paint); } };
    zone.addEventListener('pointermove', (e) => { px = e.clientX; py = e.clientY; queue(); });
    zone.addEventListener('pointerleave', () => { px = py = -1e4; queue(); });
  }

  /* ------------------------------------------------------------ reveals and counters */
  function reveal() {
    const els = $$('[data-reveal], [data-drop]');
    if (!motion || reduced.matches) { els.forEach((el) => el.classList.add('is-in')); return; }
    whenSeen(els, 0.92, (el) => el.classList.add('is-in'));
  }
  function counters() {
    if (reduced.matches) return;
    whenSeen($$('[data-count]'), 0.9, (el) => {
      const to = Number(el.dataset.count);
      if (!isFinite(to) || to < 2) return;
      tween(1100, (k) => { el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US'); });
    });
  }

  /* ------------------------------------------------------------ dialogs share one focus trap
     keeps Tab inside the open layer; boxes is one element or a list of them */
  function trap(boxes, e) {
    const f = [].concat(boxes).filter(Boolean)
      .reduce((all, box) => all.concat($$('a[href], button:not([disabled]), input, select, [tabindex]', box)), [])
      .filter((x) => x.tabIndex >= 0 && !x.hidden && x.getClientRects().length > 0);
    if (!f.length) { e.preventDefault(); return; }
    const i = f.indexOf(document.activeElement);
    if (i === -1) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
    else if (e.shiftKey && i === 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }

  /* ------------------------------------------------------------ menu (phones and tablets) */
  function menu() {
    const m = $('#menu'), btn = $('.nav__menu');
    if (!m || !btn) return;
    const isOpen = () => m.dataset.open === 'true';
    const set = (open, refocus) => {
      m.dataset.open = String(open);
      m.setAttribute('aria-hidden', String(!open));
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Close' : 'Menu';
      doc.classList.toggle('menu-open', open);
      if (open) { const a = $('a', m); if (a) setTimeout(() => a.focus(), 30); }
      else if (refocus) btn.focus();
    };
    btn.addEventListener('click', () => set(!isOpen(), true));
    $$('a', m).forEach((a) => a.addEventListener('click', () => set(false)));
    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;
      if (e.key === 'Escape') set(false, true);
      else if (e.key === 'Tab') trap([$('.nav'), m], e);
    });
    const wide = window.matchMedia('(min-width: 901px)');
    const onWide = () => { if (wide.matches && isOpen()) set(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
  }

  /* ------------------------------------------------------------ search palette */
  function palette() {
    const pal = $('#palette'), input = $('#palette-q'), list = $('#palette-list'), btn = $('#open-palette');
    if (!pal || !input || !list) return;
    const PAGES = [
      { t: 'Home', h: './', w: 'home start front' },
      { t: 'Work — every project', h: 'portfolio.php', w: 'work index portfolio projects all timeline' },
      { t: 'About Ryan', h: 'about.php', w: 'about bio toolbox tools certifications certificates desk' },
      { t: 'Demos — play in the browser', h: 'demos.php', w: 'demos arcade games pico-8 pico8 play' },
      { t: 'Contact', h: '#contact', w: 'contact github linkedin email hello' },
    ];
    const hay = INDEX.map((p) => [p.t, p.m, p.k, p.n, p.d.slice(0, 4), MONTHS[Number(p.d.slice(5, 7)) - 1] || '',
      p.c.map((c) => `${CATS[c]} ${SHORT[c]}`).join(' '), p.f ? 'featured' : ''].join(' ').toLowerCase());
    let sel = 0, items = [], ret = null;
    const render = () => {
      const q = input.value.trim().toLowerCase();
      const words = q.split(/\s+/).filter(Boolean);
      const has = (s) => words.every((w) => s.indexOf(w) > -1);
      const pages = PAGES.filter((pg) => has(`${pg.t} ${pg.w}`.toLowerCase()))
        .map((pg) => ({ id: '—', label: pg.t, href: pg.h, kind: 'Page', cat: '' }));
      let projs = INDEX.map((p, i) => ({ p, i })).filter((x) => has(hay[x.i]));
      if (q) {
        const score = (p) => { const t = p.t.toLowerCase(); return (t.indexOf(q) === 0 ? 4 : 0) + (has(t) ? 2 : 0); };
        projs = projs.map((x) => ({ x, s: score(x.p) })).sort((a, b) => b.s - a.s || a.x.i - b.x.i).map((y) => y.x);
      }
      const hits = projs.map(({ p }) => ({ id: p.n, label: p.t, href: `project.php?id=${encodeURIComponent(p.s)}`,
        kind: p.c.map((c) => SHORT[c]).join(' · '), cat: p.c[0] }));
      items = (q ? hits.concat(pages) : pages.concat(hits)).slice(0, q ? 14 : 12);
      sel = Math.min(sel, Math.max(0, items.length - 1));
      list.innerHTML = items.length ? items.map((it, k) => `<li role="presentation"><a href="${esc(it.href)}" role="option" id="pal-${k}" aria-selected="${k === sel}" tabindex="-1">
          <span class="mono">${esc(it.id)}</span><strong>${esc(it.label)}</strong><span class="mono pal-kind">${it.cat ? `<i class="dot dot--${it.cat}"></i>` : ''}${esc(it.kind)}</span></a></li>`).join('')
        : '<li class="mono empty-hit" role="presentation">Nothing matches. Try “pcb”, “pico” or “2025”.</li>';
      if (items.length) input.setAttribute('aria-activedescendant', `pal-${sel}`); else input.removeAttribute('aria-activedescendant');
    };
    const mark = () => {
      $$('[role="option"]', list).forEach((a, k) => a.setAttribute('aria-selected', String(k === sel)));
      if (items.length) input.setAttribute('aria-activedescendant', `pal-${sel}`);
      const a = $(`#pal-${sel}`);
      if (a) a.scrollIntoView({ block: 'nearest' });
    };
    const open = () => {
      if (!pal.hidden) return;
      ret = document.activeElement;
      pal.hidden = false;
      doc.classList.add('cmd-open');
      input.value = '';
      sel = 0;
      render();
      input.focus();
    };
    const close = () => {
      if (pal.hidden) return;
      pal.hidden = true;
      doc.classList.remove('cmd-open');
      if (ret && ret.focus) ret.focus();
    };
    if (btn) btn.addEventListener('click', open);
    input.addEventListener('input', () => { sel = 0; render(); });
    input.addEventListener('keydown', (e) => {
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && items.length) {
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        mark();
      } else if (e.key === 'Enter' && items[sel]) {
        e.preventDefault();
        const href = items[sel].href;
        close();
        location.href = href;
      }
    });
    list.addEventListener('mousemove', (e) => {
      const a = e.target.closest('[role="option"]');
      const k = a ? Number(a.id.slice(4)) : -1;
      if (k > -1 && k !== sel) { sel = k; mark(); }
    });
    list.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
    pal.addEventListener('click', (e) => { if (e.target === pal) close(); });
    document.addEventListener('keydown', (e) => {
      if (!pal.hidden) {
        if (e.key === 'Escape') { e.preventDefault(); close(); }
        else if (e.key === 'Tab') trap(pal, e);
        return;
      }
      if ($('#lightbox:not([hidden])')) return;
      const k = (e.key || '').toLowerCase();
      if ((e.key === '/' && !typing(document.activeElement) && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && k === 'k')) {
        e.preventDefault();
        open();
      }
    });
  }

  /* ------------------------------------------------------------ lightbox */
  let lb = null;
  function lightbox(images, start, opts) {
    opts = opts || {};
    if (!lb) {
      document.body.insertAdjacentHTML('beforeend', `<div class="lb" id="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" hidden>
        <div class="lb__bar"><span class="lb__count"></span><span class="lb__title"></span>
          <button class="lb__close" type="button">Close <span aria-hidden="true">×</span></button></div>
        <figure class="lb__stage"><img class="lb__img" alt="" decoding="async"><figcaption class="lb__cap"></figcaption></figure>
        <button class="lb__nav lb__prev" type="button" aria-label="Previous image"><span aria-hidden="true">←</span></button>
        <button class="lb__nav lb__next" type="button" aria-label="Next image"><span aria-hidden="true">→</span></button>
      </div>`);
      lb = $('#lightbox');
      $('.lb__close', lb).addEventListener('click', lbClose);
      $('.lb__prev', lb).addEventListener('click', () => lbShow(lb._i - 1));
      $('.lb__next', lb).addEventListener('click', () => lbShow(lb._i + 1));
      lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb__stage')) lbClose(); });
      document.addEventListener('keydown', (e) => {
        if (lb.hidden) return;
        if (e.key === 'Escape') { e.preventDefault(); lbClose(); }
        else if (e.key === 'ArrowLeft') lbShow(lb._i - 1);
        else if (e.key === 'ArrowRight') lbShow(lb._i + 1);
        else if (e.key === 'Tab') trap(lb, e);
      });
      let x0 = null;
      lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 50) lbShow(lb._i + (dx < 0 ? 1 : -1));
        x0 = null;
      });
    }
    lb._images = images;
    lb._title = opts.title || '';
    lb._return = document.activeElement;
    lb.classList.toggle('is-pixel', !!opts.pixel);
    lb.hidden = false;
    doc.classList.add('lb-open');
    lbShow(start || 0);
    $('.lb__close', lb).focus();
  }
  function lbShow(i) {
    const n = lb._images.length;
    lb._i = ((i % n) + n) % n;
    const im = lb._images[lb._i];
    const node = $('.lb__img', lb);
    node.src = im.src;
    node.alt = im.alt || `${lb._title} — image ${lb._i + 1} of ${n}`;
    $('.lb__count', lb).textContent = `${pad(lb._i + 1)} / ${pad(n)}`;
    $('.lb__title', lb).textContent = lb._title;
    $('.lb__cap', lb).textContent = im.cap || '';
    $$('.lb__nav', lb).forEach((b) => { b.hidden = n < 2; });
  }
  function lbClose() {
    lb.hidden = true;
    doc.classList.remove('lb-open');
    $('.lb__img', lb).removeAttribute('src');
    if (lb._return && lb._return.focus) lb._return.focus();
  }

  /* ------------------------------------------------------------ work index */
  function work() {
    const mosaic = $('#mosaic'), out = $('#results');
    if (!mosaic || !out) return;
    const tiles = $$('.tile', mosaic);
    const total = tiles.length;
    const chips = $$('#chips .pill-btn');
    const q = $('#q'), sort = $('#sort'), result = $('#result'), empty = $('#empty'), emptyMsg = $('#empty-msg');
    const catInput = $('#cat-input'), viewInput = $('#view-input'), form = $('#tools'), reset = $('#reset');
    const views = $$('.seg [data-view]');
    const params = new URLSearchParams(location.search);
    const LEGACY = { recent: 'recent', oldest: 'oldest', alphabetical: 'az', reverse_alphabetical: 'za' };
    const SORTS = ['recent', 'oldest', 'az', 'za'];
    const CHIP_KEYS = chips.map((b) => b.dataset.cat);
    const LABELS = {};
    chips.forEach((b) => { LABELS[b.dataset.cat] = b.firstChild ? b.firstChild.textContent.trim() : b.dataset.cat; });
    const state = {
      cat: CHIP_KEYS.indexOf(params.get('cat')) > -1 ? params.get('cat') : 'all',
      sort: SORTS.indexOf(params.get('sort')) > -1 ? params.get('sort') : (LEGACY[params.get('filter')] || 'recent'),
      q: (params.get('q') || '').trim(),
      view: params.get('view') === 'list' ? 'list' : 'grid',
    };
    const low = (t) => t.dataset.title.toLowerCase();
    const byTitle = (a, b) => (low(a) < low(b) ? -1 : low(a) > low(b) ? 1 : 0);
    const byDate = (a, b) => (a.dataset.iso < b.dataset.iso ? 1 : a.dataset.iso > b.dataset.iso ? -1 : byTitle(a, b));
    const ORDER = {
      recent: tiles.slice().sort(byDate),
      oldest: tiles.slice().sort(byDate).reverse(),
      az: tiles.slice().sort(byTitle),
      za: tiles.slice().sort(byTitle).reverse(),
    };
    const matches = (t, words) => {
      const c = state.cat;
      if (c === 'featured' && t.dataset.featured !== '1') return false;
      if (c === 'new' && t.dataset.new !== '1') return false;
      if (CATS[c] && (` ${t.dataset.cats} `).indexOf(` ${c} `) < 0) return false;
      return words.every((w) => t.dataset.hay.indexOf(w) > -1);
    };
    const render = () => {
      const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      const list = ORDER[state.sort].filter((t) => matches(t, words));
      const big = state.cat === 'all' && !words.length && state.sort === 'recent';
      mosaic.textContent = '';
      list.forEach((t) => {
        t.hidden = false;
        t.classList.toggle('tile--big', big && t.dataset.featured === '1');
        mosaic.appendChild(t);
      });
      chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === state.cat)));
      views.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
      out.dataset.view = state.view;
      if (catInput) catInput.value = state.cat;
      if (viewInput) viewInput.value = state.view;
      let line = `${list.length} of ${total} projects`;
      if (state.cat !== 'all') line += ` · ${LABELS[state.cat]}`;
      if (state.q) line += ` · “${state.q}”`;
      if (result) result.textContent = line;
      if (empty) {
        empty.hidden = list.length > 0;
        if (!list.length && emptyMsg) emptyMsg.textContent = state.q ? `Nothing for “${state.q}”.` : 'Nothing in this drawer yet.';
      }
      const u = new URL(location.href);
      ['filter', 'cat', 'sort', 'q', 'view'].forEach((k) => u.searchParams.delete(k));
      if (state.cat !== 'all') u.searchParams.set('cat', state.cat);
      if (state.sort !== 'recent') u.searchParams.set('sort', state.sort);
      if (state.q) u.searchParams.set('q', state.q);
      if (state.view !== 'grid') u.searchParams.set('view', state.view);
      const next = u.pathname + u.search + u.hash;
      if (next !== location.pathname + location.search + location.hash) history.replaceState(null, '', next);
      fitDown(out);
    };
    if (q) {
      q.value = state.q;
      q.addEventListener('input', () => { state.q = q.value.trim(); render(); });
      q.addEventListener('search', () => { state.q = q.value.trim(); render(); });
    }
    if (sort) {
      sort.value = state.sort;
      sort.addEventListener('change', () => { state.sort = SORTS.indexOf(sort.value) > -1 ? sort.value : 'recent'; render(); });
    }
    chips.forEach((b) => b.addEventListener('click', () => { state.cat = b.dataset.cat; render(); }));
    views.forEach((b) => b.addEventListener('click', () => { state.view = b.dataset.view === 'list' ? 'list' : 'grid'; render(); }));
    if (form) form.addEventListener('submit', (e) => { e.preventDefault(); if (q) q.blur(); });
    if (reset) reset.addEventListener('click', (e) => {
      e.preventDefault();
      Object.assign(state, { cat: 'all', q: '', sort: 'recent' });
      if (q) q.value = '';
      if (sort) sort.value = 'recent';
      render();
      if (q) q.focus();
    });
    render();
  }

  /* ------------------------------------------------------------ project gallery */
  function gallery() {
    const data = readJSON('gallery-data'), stage = $('#stage');
    if (!data || !stage || !data.images || !data.images.length) return;
    const imgs = data.images, n = imgs.length;
    const main = $('img', stage), zoom = $('.zoom', stage), counter = $('#counter'), cap = $('#cap'), thumbs = $('#thumbs');
    const tb = thumbs ? $$('button', thumbs) : [];
    let cur = 0, swiped = false, x0 = null;
    const show = (i) => {
      cur = ((i % n) + n) % n;
      const im = imgs[cur];
      if (main.getAttribute('src') !== im.src) {
        if (im.w) { main.setAttribute('width', im.w); main.setAttribute('height', im.h); }
        main.src = im.src;
      }
      main.alt = `${data.title} — image ${cur + 1} of ${n}`;
      if (zoom) zoom.setAttribute('aria-label', `Open image ${cur + 1} full screen`);
      if (counter) counter.textContent = `${pad(cur + 1)}/${pad(n)}`;
      if (cap) cap.textContent = im.cap;
      tb.forEach((b, k) => b.setAttribute('aria-current', String(k === cur)));
      const a = tb[cur];
      if (a && thumbs.scrollWidth > thumbs.clientWidth + 1) {
        const tr = thumbs.getBoundingClientRect(), ar = a.getBoundingClientRect();
        thumbs.scrollBy({ left: ar.left + ar.width / 2 - (tr.left + tr.width / 2), behavior: reduced.matches ? 'auto' : 'smooth' });
      }
      if (n > 1) { const next = new Image(); next.src = imgs[(cur + 1) % n].src; }
    };
    tb.forEach((b, i) => b.addEventListener('click', () => show(i)));
    const prev = $('#prev'), next = $('#next');
    if (prev) prev.addEventListener('click', () => show(cur - 1));
    if (next) next.addEventListener('click', () => show(cur + 1));
    stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { x0 = e.clientX; swiped = false; } });
    stage.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40 && n > 1) { swiped = true; show(cur + (dx < 0 ? 1 : -1)); }
    });
    stage.addEventListener('pointercancel', () => { x0 = null; });
    if (zoom) zoom.addEventListener('click', () => {
      if (swiped) { swiped = false; return; }
      lightbox(imgs.map((im) => ({ src: im.src, cap: im.cap })), cur, { title: data.title, pixel: data.pixel });
    });
    const section = stage.closest('.gallery');
    if (section) section.addEventListener('keydown', (e) => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || typing(e.target) || n < 2) return;
      e.preventDefault();
      show(cur + (e.key === 'ArrowRight' ? 1 : -1));
      if (tb.indexOf(document.activeElement) > -1) tb[cur].focus();
    });
  }

  /* ------------------------------------------------------------ arcade */
  function arcade() {
    const data = readJSON('demos-data'), carts = $('#carts'), screen = $('#screen');
    if (!data || !data.length || !carts || !screen) return;
    const title = $('#bz-title'), openLink = $('#bz-open'), blurb = $('#arcade-blurb'), link = $('#arcade-link'), full = $('#bz-full');
    let current = data[0];
    const find = (slug) => data.filter((d) => d.slug === slug)[0];
    const poster = (d) => `<button class="screen__poster" type="button" aria-label="Play ${esc(d.title)}"><img src="${esc(d.poster)}" alt=""><span class="btn">Press start ▶</span></button>`;
    const load = (d, play) => {
      current = d;
      $$('.cart', carts).forEach((b) => b.setAttribute('aria-current', String(b.dataset.slug === d.slug)));
      if (title) title.textContent = `${d.title} · PICO-8`;
      if (openLink) openLink.href = d.src;
      if (blurb) blurb.textContent = d.blurb;
      if (link) link.href = `project.php?id=${encodeURIComponent(d.slug)}`;
      if (play) {
        screen.innerHTML = `<iframe src="${esc(d.src)}" title="${esc(d.title)}, a playable PICO-8 cartridge" allow="autoplay; fullscreen; gamepad" allowfullscreen></iframe>`;
        const f = $('iframe', screen);
        setTimeout(() => { try { f.focus(); } catch (err) { /* cross-frame focus can fail; the click still lands */ } }, 60);
      } else {
        screen.innerHTML = poster(d);
      }
    };
    screen.addEventListener('click', (e) => { if (e.target.closest('.screen__poster')) load(current, true); });
    carts.addEventListener('click', (e) => {
      const b = e.target.closest('.cart');
      if (!b) return;
      const d = find(b.dataset.slug);
      if (!d) return;
      load(d, false);
      history.replaceState(null, '', `#${d.slug}`);
      const r = screen.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight) screen.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' });
    });
    if (full) full.addEventListener('click', () => {
      if (!$('iframe', screen)) load(current, true);
      const f = $('iframe', screen) || screen;
      const req = f.requestFullscreen || f.webkitRequestFullscreen;
      if (req) { try { const p = req.call(f); if (p && p.catch) p.catch(() => {}); } catch (err) { /* not allowed here */ } }
    });
    const fromHash = () => {
      let slug = '';
      try { slug = decodeURIComponent(location.hash.slice(1)); } catch (err) { slug = ''; }
      const d = find(slug);
      if (d) load(d, false);
    };
    window.addEventListener('hashchange', fromHash);
    if (location.hash.length > 1) fromHash();
  }

  /* ------------------------------------------------------------ about: certificates and the desk */
  function certificates() {
    const btns = $$('[data-cert]');
    if (!btns.length) return;
    const list = btns.map((b) => ({ src: b.dataset.src, cap: b.dataset.cap, alt: b.dataset.cap }));
    btns.forEach((b, i) => b.addEventListener('click', () => lightbox(list, i, { title: 'Certifications' })));
  }
  function desk() {
    const area = $('#desk');
    if (!area) return;
    let z = 10;
    $$('.flair', area).forEach((el) => {
      let sx = 0, sy = 0, ox = 0, oy = 0, id = null, moved = false, lim = null;
      el.addEventListener('dragstart', (e) => e.preventDefault());
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || id !== null) return;
        id = e.pointerId;
        moved = false;
        sx = e.clientX;
        sy = e.clientY;
        ox = parseFloat(el.style.getPropertyValue('--x')) || 0;
        oy = parseFloat(el.style.getPropertyValue('--y')) || 0;
        const w = el.offsetWidth, h = el.offsetHeight;
        lim = { x0: -el.offsetLeft, x1: area.clientWidth - el.offsetLeft - w, y0: -el.offsetTop, y1: area.clientHeight - el.offsetTop - h };
        try { el.setPointerCapture(id); } catch (err) { /* capture is a nicety */ }
      });
      el.addEventListener('pointermove', (e) => {
        if (e.pointerId !== id) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (!moved && Math.hypot(dx, dy) < 6) return;
        if (!moved) { moved = true; el.classList.add('is-drag'); el.style.zIndex = String(++z); }
        const x = Math.max(lim.x0, Math.min(lim.x1, ox + dx)), y = Math.max(lim.y0, Math.min(lim.y1, oy + dy));
        el.style.setProperty('--x', `${Math.round(x)}px`);
        el.style.setProperty('--y', `${Math.round(y)}px`);
      });
      const end = (e) => {
        if (e.pointerId !== id) return;
        id = null;
        el.classList.remove('is-drag');
        if (moved) setTimeout(() => { moved = false; }, 0);
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('click', (e) => { if (moved) { e.preventDefault(); moved = false; } });
    });
  }

  /* ------------------------------------------------------------ start */
  menu();
  palette();
  if (page === 'portfolio') work();
  if (page === 'project') gallery();
  if (page === 'demos') arcade();
  if (page === 'about') { certificates(); desk(); }
  $$('.band__word').forEach(split);
  fit();
  fitDown();
  reveal();
  counters();
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fonts.then(() => {
    fit();
    fitDown();
    $$('.hero .band').forEach(proximity);
  });
})();
