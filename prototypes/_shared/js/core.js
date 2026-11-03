/* Shared helpers for the three RyanLGriffith.com prototypes.
   Reads window.RLG_DATA (site-data.js) and exposes window.RLG.
   Each page sets <html data-root="../../"> so asset paths resolve from the repo root. */
(function () {
  'use strict';
  const D = window.RLG_DATA;
  const root = document.documentElement.dataset.root || '../../';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  const CAT = { program: 'Programming', engineer: 'Engineering', art: 'Art' };
  const CAT_SHORT = { program: 'PRG', engineer: 'ENG', art: 'ART' };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function asset(p) {
    if (!p) return '';
    if (/^(https?:)?\/\//.test(p)) return p;
    return root + p.split('/').map(encodeURIComponent).join('/');
  }

  function parseIso(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return { y, m, d };
  }

  /* style: long "October 11, 2026" | short "Oct 2026" | month "October 2026" | mono "OCT 11 2026" | dot "2026.10.11" | year */
  function date(iso, style = 'long') {
    const { y, m, d } = parseIso(iso);
    const name = MONTHS[m - 1];
    switch (style) {
      case 'short': return `${name.slice(0, 3)} ${y}`;
      case 'month': return `${name} ${y}`;
      case 'mono': return `${name.slice(0, 3).toUpperCase()} ${String(d).padStart(2, '0')} ${y}`;
      case 'monoShort': return `${name.slice(0, 3).toUpperCase()} ${y}`;
      case 'dot': return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
      case 'year': return String(y);
      default: return `${name} ${d}, ${y}`;
    }
  }

  const projects = D.projects;
  const bySlug = new Map(projects.map((p) => [p.slug, p]));
  const chrono = [...projects].sort((a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : a.title.localeCompare(b.title)));

  function project(slug) { return bySlug.get(slug) || null; }
  function id(p) { return 'RLG-' + String(p.no).padStart(3, '0'); }
  function cats(p, short = false) { return p.cats.map((c) => (short ? CAT_SHORT : CAT)[c]); }

  /* filter: all | featured | program | engineer | art | new ; sort: recent | oldest | az | za */
  function filter({ cat = 'all', sort = 'recent', q = '' } = {}) {
    const needle = q.trim().toLowerCase();
    let list = projects.filter((p) => {
      if (cat === 'featured' && !p.featured) return false;
      if (cat === 'new' && !p.isNew) return false;
      if (CAT[cat] && !p.cats.includes(cat)) return false;
      if (!needle) return true;
      const hay = [p.title, p.summary, p.stack.join(' '), cats(p).join(' '), date(p.iso, 'month')].join(' ').toLowerCase();
      return needle.split(/\s+/).every((w) => hay.includes(w));
    });
    const cmp = {
      recent: (a, b) => (a.iso < b.iso ? 1 : a.iso > b.iso ? -1 : a.title.localeCompare(b.title)),
      oldest: (a, b) => (a.iso > b.iso ? 1 : a.iso < b.iso ? -1 : a.title.localeCompare(b.title)),
      az: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
      za: (a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }),
    }[sort] || (() => 0);
    return list.sort(cmp);
  }

  /* previous = older project, next = newer project (wrapping) */
  function neighbors(slug) {
    const i = chrono.findIndex((p) => p.slug === slug);
    if (i < 0) return { prev: null, next: null };
    return { newer: chrono[(i - 1 + chrono.length) % chrono.length], older: chrono[(i + 1) % chrono.length] };
  }

  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function setQs(params) {
    const u = new URL(location.href);
    Object.entries(params).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '' || v === 'all' || (k === 'sort' && v === 'recent')) u.searchParams.delete(k);
      else u.searchParams.set(k, v);
    });
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* <img> markup with intrinsic size to avoid layout shift */
  function img(info, alt, { cls = '', eager = false, sizes = '' } = {}) {
    if (!info) return '';
    const w = info.w ? ` width="${info.w}" height="${info.h}"` : '';
    return `<img class="${cls}" src="${asset(info.src)}" alt="${esc(alt)}"${w}${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async"${sizes ? ` sizes="${sizes}"` : ''}>`;
  }

  /* reveal-on-scroll: adds .is-in to [data-reveal] (immediately with reduced motion) */
  function reveal(scope = document) {
    const els = [...scope.querySelectorAll('[data-reveal]:not(.is-in)')];
    if (reduced.matches || !('IntersectionObserver' in window)) {
      els.forEach((e) => e.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    els.forEach((e) => io.observe(e));
  }

  /* count-up numbers: <span data-count="32">0</span> */
  function countUp(scope = document) {
    const els = [...scope.querySelectorAll('[data-count]')];
    const run = (e) => {
      const to = Number(e.dataset.count);
      if (reduced.matches) { e.textContent = to.toLocaleString(); return; }
      const t0 = performance.now(), dur = 1100;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        e.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString();
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    });
    els.forEach((e) => io.observe(e));
  }

  /* Accessible lightbox. images: [{src,w,h}], captions optional */
  let lb = null;
  function lightbox(images, start = 0, { title = '', captions = [] } = {}) {
    if (!lb) {
      lb = el(`<div class="lb" role="dialog" aria-modal="true" aria-label="Image viewer" hidden>
        <div class="lb__bar"><span class="lb__count"></span><span class="lb__title"></span>
          <button class="lb__close" type="button" aria-label="Close viewer">Close <span aria-hidden="true">×</span></button></div>
        <figure class="lb__stage"><img class="lb__img" alt=""><figcaption class="lb__cap"></figcaption></figure>
        <button class="lb__nav lb__prev" type="button" aria-label="Previous image"><span aria-hidden="true">←</span></button>
        <button class="lb__nav lb__next" type="button" aria-label="Next image"><span aria-hidden="true">→</span></button>
      </div>`);
      document.body.appendChild(lb);
      lb.querySelector('.lb__close').addEventListener('click', close);
      lb.querySelector('.lb__prev').addEventListener('click', () => show(lb._i - 1));
      lb.querySelector('.lb__next').addEventListener('click', () => show(lb._i + 1));
      lb.addEventListener('click', (e) => { if (e.target === lb || e.target.classList.contains('lb__stage')) close(); });
      document.addEventListener('keydown', (e) => {
        if (lb.hidden) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') show(lb._i - 1);
        else if (e.key === 'ArrowRight') show(lb._i + 1);
        else if (e.key === 'Tab') {             // keep focus inside the dialog
          const f = [...lb.querySelectorAll('button:not([hidden])')];
          const i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        }
      });
      let x0 = null;
      lb.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > 50) show(lb._i + (dx < 0 ? 1 : -1));
        x0 = null;
      });
    }
    lb._images = images; lb._captions = captions; lb._title = title;
    lb._return = document.activeElement;
    lb.hidden = false;
    document.documentElement.classList.add('lb-open');
    show(start);
    lb.querySelector('.lb__close').focus();
  }
  function show(i) {
    const n = lb._images.length;
    lb._i = (i + n) % n;
    const im = lb._images[lb._i];
    const node = lb.querySelector('.lb__img');
    node.src = asset(im.src);
    node.alt = `${lb._title} — image ${lb._i + 1} of ${n}`;
    lb.querySelector('.lb__count').textContent = `${String(lb._i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    lb.querySelector('.lb__title').textContent = lb._title;
    lb.querySelector('.lb__cap').textContent = lb._captions[lb._i] || '';
    lb.querySelectorAll('.lb__nav').forEach((b) => { b.hidden = n < 2; });
  }
  function close() {
    lb.hidden = true;
    document.documentElement.classList.remove('lb-open');
    if (lb._return && lb._return.focus) lb._return.focus();
  }

  function year() { document.querySelectorAll('[data-year]').forEach((e) => { e.textContent = new Date().getFullYear(); }); }

  /* group projects into the five "mission areas" used on the home pages */
  const AREAS = [
    { key: 'games', label: 'Games & Graphics', slugs: ['hollowdeep', 'deepwell', 'raycast-fps', 'interloper', 'the-kingdom', 'density', 'gatsby-game', 'perlin-noise', 'dot-matrix-sim', 'rotation-simulator'] },
    { key: 'embedded', label: 'Embedded & PCB', slugs: ['bl4s-2026', 'custom-calc', 'mp3-player', 'custom-keyboard', 'mpy-stocks', 'tcob-code', 'spotify-player'] },
    { key: 'cad', label: 'CAD & Fabrication', slugs: ['jpl-2025', 'jpl-2024', 'disk-launcher', 'cnc-yoyo', 'custom-calc', 'mp3-player'] },
    { key: 'web', label: 'Web, Data & ML', slugs: ['market-dashboard', 'website-v4', 'website-v3', 'ai-image-detector', 'spotify-player', 'tcob-code'] },
    { key: 'art', label: 'Art & Design', slugs: ['skull-2026', 'ryan-logo', 'mitsubishi-design', 'micro', 'untitled-skull', 'typhlosion-mockup', 'wheels'] },
  ];
  const areas = AREAS.map((a) => ({ ...a, projects: a.slugs.map(project).filter(Boolean) }));

  window.RLG = {
    data: D, root, asset, esc, date, project, projects, chrono, id, cats, CAT, CAT_SHORT, filter, neighbors,
    qs, setQs, el, img, reveal, countUp, lightbox, year, areas, reduced,
  };
})();
