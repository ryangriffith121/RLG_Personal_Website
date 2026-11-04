// In-page layout checks shared by test_layout.mjs (prototypes) and test_final.mjs (the final PHP site).
// Both functions run inside the page through page.evaluate, so they must stay self-contained.

// ---------------------------------------------------------------- in-page layout audit
export function audit(opts = {}) {
  const scope = (opts.scope && document.querySelector(opts.scope)) || document.body;
  // the device width: on emulated phones Chrome widens the layout viewport to fit overflow
  const vw = opts.width || innerWidth;
  const res = { overlaps: [], controls: [], offscreen: [], clipped: [], brokenImages: [], overflow: 0 };
  res.overflow = Math.max(0, document.documentElement.scrollWidth - vw, innerWidth - vw);
  const styleCache = new Map();
  const cs = (e) => { let s = styleCache.get(e); if (!s) { s = getComputedStyle(e); styleCache.set(e, s); } return s; };
  const hiddenByStyle = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const s = cs(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse' || Number(s.opacity) < 0.05 || e.hidden) return true;
    }
    return false;
  };
  const isFixed = (el) => { for (let e = el; e; e = e.parentElement) { const p = cs(e).position; if (p === 'fixed') return true; } return false; };
  const blockOf = (el) => { for (let e = el; e; e = e.parentElement) { const d = cs(e).display; if (!d.startsWith('inline') && d !== 'contents') return e; } return document.body; };
  const clipOf = (el) => {
    let c = { l: -1e9, t: -1e9, r: 1e9, b: 1e9, scroller: false };
    for (let e = el; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const s = cs(e);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        const b = e.getBoundingClientRect();
        c = { l: Math.max(c.l, b.left), t: Math.max(c.t, b.top), r: Math.min(c.r, b.right), b: Math.min(c.b, b.bottom),
          scroller: c.scroller || /(auto|scroll)/.test(s.overflowX + s.overflowY) };
      }
      if (s.position === 'fixed') break;
    }
    return c;
  };
  const label = (el) => {
    const id = el.id ? '#' + el.id : '';
    const cls = el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };
  const sx = scrollX, sy = scrollY;

  // text boxes
  const boxes = [];
  const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim() ? 1 : 3) });
  for (let n; (n = tw.nextNode());) {
    const el = n.parentElement;
    if (!el || el.closest('script,style,noscript,svg,canvas,[aria-hidden="true"],[data-decor],.sr-only,.skip,iframe')) continue;
    if (hiddenByStyle(el)) continue;
    const s = cs(el);
    const fixed = isFixed(el);
    const clip = clipOf(el);
    const range = document.createRange();
    range.selectNodeContents(n);
    const clamp = s.webkitLineClamp && s.webkitLineClamp !== 'none';
    const ellipsis = s.textOverflow === 'ellipsis' || (el.parentElement && cs(el.parentElement).textOverflow === 'ellipsis');
    for (const r of range.getClientRects()) {
      if (r.width < 2 || r.height < 2) continue;
      // glyph body: trim the line-box padding above and below the letters
      const fs = parseFloat(s.fontSize) || 16;
      const padY = Math.max(0, (r.height - fs) / 2) + fs * 0.12;
      const g = { l: r.left + 1, r: r.right - 1, t: r.top + padY, b: r.bottom - padY };
      if (g.b - g.t < 2) continue;
      const vis = { l: Math.max(g.l, clip.l), t: Math.max(g.t, clip.t), r: Math.min(g.r, clip.r), b: Math.min(g.b, clip.b) };
      if (vis.r - vis.l < 1 || vis.b - vis.t < 1) continue;           // fully clipped (e.g. hidden slide)
      const partial = (g.r - vis.r > 3 || vis.l - g.l > 3 || g.b - vis.b > 3 || vis.t - g.t > 3);
      if (partial && !clip.scroller && !clamp && !ellipsis) res.clipped.push({ el: label(el), text: n.nodeValue.trim().slice(0, 50) });
      if (!fixed && (vis.r > vw + 1 || vis.l < -1)) res.offscreen.push({ el: label(el), text: n.nodeValue.trim().slice(0, 50), l: Math.round(vis.l), r: Math.round(vis.r) });
      boxes.push({ el, block: blockOf(el), fixed, text: n.nodeValue.trim().slice(0, 40),
        l: vis.l + sx, r: vis.r + sx, t: vis.t + sy, b: vis.b + sy });
    }
  }
  boxes.sort((a, b) => a.t - b.t);
  const seen = new Set();
  for (let i = 0; i < boxes.length; i++) {
    const A = boxes[i];
    for (let j = i + 1; j < boxes.length && boxes[j].t < A.b; j++) {
      const B = boxes[j];
      if (A.el === B.el || A.block === B.block) continue;
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      const w = Math.min(A.r, B.r) - Math.max(A.l, B.l);
      const h = Math.min(A.b, B.b) - Math.max(A.t, B.t);
      if (w <= 2 || h <= 2) continue;
      const area = w * h, small = Math.min((A.r - A.l) * (A.b - A.t), (B.r - B.l) * (B.b - B.t));
      if (area / small < 0.12) continue;
      const key = A.text + '|' + B.text;
      if (seen.has(key)) continue;
      seen.add(key);
      res.overlaps.push({ a: `${label(A.el)} "${A.text}"`, b: `${label(B.el)} "${B.text}"`, at: [Math.round(Math.max(A.l, B.l)), Math.round(Math.max(A.t, B.t))] });
    }
  }

  // interactive controls overlapping each other
  const ctrls = [...scope.querySelectorAll('a[href],button,input,select,textarea,[role="tab"]')]
    .filter((e) => !hiddenByStyle(e) && !e.closest('[aria-hidden="true"],.sr-only,.skip'))
    .map((e) => ({ e, r: e.getBoundingClientRect(), fixed: isFixed(e) }))
    .filter((c) => c.r.width > 1 && c.r.height > 1);
  for (let i = 0; i < ctrls.length; i++) {
    for (let j = i + 1; j < ctrls.length; j++) {
      const A = ctrls[i], B = ctrls[j];
      if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
      const w = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left);
      const h = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      if (w <= 2 || h <= 2) continue;
      const small = Math.min(A.r.width * A.r.height, B.r.width * B.r.height);
      if ((w * h) / small < 0.1) continue;
      res.controls.push({ a: label(A.e) + ' ' + (A.e.textContent || A.e.getAttribute('aria-label') || '').trim().slice(0, 30),
        b: label(B.e) + ' ' + (B.e.textContent || B.e.getAttribute('aria-label') || '').trim().slice(0, 30) });
    }
  }

  document.querySelectorAll('img').forEach((im) => {
    if (im.complete && im.naturalWidth === 0 && !hiddenByStyle(im)) res.brokenImages.push(im.currentSrc || im.src);
  });
  return res;
}


// Is every visible text the top-most element at its own position? Catches images, panels or
// overlays drawn on top of text. Stretched card links ([data-stretch]) count as transparent.
export async function occlusion() {
  const tag = document.createElement('style');
  tag.textContent = '*,*::before,*::after{pointer-events:auto!important}';
  document.head.appendChild(tag);
  const cs = (e) => getComputedStyle(e);
  const hidden = (el) => { for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = cs(e); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.05 || e.hidden) return true; } return false; };
  const isFixed = (el) => { for (let e = el; e; e = e.parentElement) if (cs(e).position === 'fixed') return true; return false; };
  const label = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '');
  const items = [];
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.trim().length > 1 ? 1 : 3) });
  for (let n; (n = tw.nextNode());) {
    const el = n.parentElement;
    // [data-stack]: sticky cards that cover each other on purpose while scrolling (checked at rest instead)
    if (!el || el.closest('script,style,noscript,svg,canvas,[aria-hidden="true"],[data-decor],[data-stack],.sr-only,.skip,iframe,.lb') || hidden(el) || isFixed(el)) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    const q = [...r.getClientRects()].find((x) => x.width > 4 && x.height > 4);
    if (!q) continue;
    items.push({ el, x: q.left + Math.min(q.width / 2, 24), yDoc: q.top + scrollY + q.height / 2, text: n.nodeValue.trim().slice(0, 40) });
  }
  const out = [];
  const test = (it) => {
    const cy = it.yDoc - scrollY;
    if (it.x < 0 || it.x >= innerWidth || cy < 0 || cy >= innerHeight) return false;
    // top-most element that is not purely decorative (corner brackets, scanlines, stretched links)
    const hit = document.elementsFromPoint(it.x, cy).find((e) => !e.closest('[data-decor],[aria-hidden="true"],[data-stretch]'));
    if (hit && !(hit === it.el || it.el.contains(hit) || hit.contains(it.el) || isFixed(hit))) {
      out.push({ text: it.text, el: label(it.el), hit: label(hit) });
    }
    return true;
  };
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const vh = innerHeight, H = document.documentElement.scrollHeight;
  for (let y = 0; y < H; y += vh * 0.5) {
    scrollTo(0, y);
    await frame();
    for (const it of items) {
      if (it.done) continue;
      const cy = it.yDoc - scrollY;
      if (cy >= vh * 0.25 && cy <= vh * 0.75) it.done = test(it);
    }
  }
  for (const top of [true, false]) {          // leftovers at the very top / bottom of the page
    scrollTo(0, top ? 0 : H);
    await frame();
    items.filter((it) => !it.done).forEach((it) => { if (test(it)) it.done = true; });
  }
  tag.remove();
  scrollTo(0, 0);
  return out;
}
