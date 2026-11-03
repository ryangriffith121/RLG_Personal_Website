// Layout + behaviour tests for the prototypes, in headless Chrome.
//   node prototypes/_tools/test_layout.mjs [orbit,telemetry,spectrum] [--all-projects] [--shots]
// Checks every page at several viewports for: overlapping text, overlapping controls, text pushed
// off-screen or clipped, horizontal overflow, broken images, console errors and failed requests.
// Then runs functional checks (filters, search, sort, viewer, lightbox, menus, demos, links).
import { chromium } from 'playwright-core';
import http from 'node:http';
import { createReadStream, statSync, mkdirSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const args = process.argv.slice(2);
const PROTOS = (args.find((a) => !a.startsWith('--')) || 'orbit,telemetry,spectrum').split(',');
const ALL_PROJECTS = args.includes('--all-projects');
const SHOTS = args.includes('--shots');
const OUT = join(ROOT, 'prototypes', '_tools', '.cache', 'test');
mkdirSync(OUT, { recursive: true });

// site data, to know what the pages should contain
const ctx = { window: {} };
vm.runInNewContext(readFileSync(join(ROOT, 'prototypes/_shared/data/site-data.js'), 'utf8'), ctx);
const DATA = ctx.window.RLG_DATA;

const VIEWPORTS = [
  { name: 'phone', width: 375, height: 812, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 820, height: 1180, hasTouch: true },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
];

// ---------------------------------------------------------------- static server
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let file = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return res.writeHead(403).end();
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    statSync(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/prototypes/`;

// ---------------------------------------------------------------- in-page layout audit
function audit(opts = {}) {
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
async function occlusion() {
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

// ---------------------------------------------------------------- runner
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

// --selftest: break pages on purpose and make sure the audit notices.
if (args.includes('--selftest')) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const cases = [
    ['old viewer bug (image spills over the caption)', 'orbit/project.html?id=custom-calc',
      '.viewer__stage{display:grid;place-items:center;overflow:visible!important}.viewer__stage img{position:static!important;width:auto!important;height:auto!important;max-width:none!important}',
      (a, o) => o.length > 0],
    ['card titles pulled up into the images', 'orbit/work.html', '.card__title{margin-top:-60px;position:relative;z-index:2}.card__meta{position:relative;top:40px}',
      (a, o) => a.overlaps.length + o.length > 0],
    ['grid wider than the screen', 'orbit/work.html', 'body{overflow-x:visible!important}html{overflow-x:visible!important}.cards{width:130vw}',
      (a) => a.overflow > 0 || a.offscreen.length > 0],
    ['nav pill on top of the hero headline', 'orbit/index.html', '.hero{padding-top:20px!important}.hero__title{margin-left:340px}',
      (a, o) => a.overlaps.length + o.length > 0],
  ];
  let ok = 0;
  for (const [name, url, css, expect] of cases) {
    const { page } = await openPage(c, BASE + url);
    await page.addStyleTag({ content: css });
    await page.waitForTimeout(150);
    const a = await page.evaluate(audit, { width: 1280 });
    const o = await page.evaluate(occlusion);
    const caught = expect(a, o);
    console.log(`${caught ? 'caught ' : 'MISSED '} ${name}  (overlaps ${a.overlaps.length}, covered ${o.length}, overflow ${a.overflow}, offscreen ${a.offscreen.length})`);
    if (caught) ok++;
    await page.close();
  }
  // phones: Chrome widens the layout viewport to fit overflow, so this needs the device-width check
  const m = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  {
    const { page } = await openPage(m, BASE + 'telemetry/project.html?id=bl4s-2026');
    await page.addStyleTag({ content: '.dossier{grid-template-columns:1fr!important}' });
    await page.waitForTimeout(150);
    const a = await page.evaluate(audit, { width: 375 });
    const caught = a.overflow > 0 || a.offscreen.length > 0;
    console.log(`${caught ? 'caught ' : 'MISSED '} phone: grid track widened by a thumbnail strip  (overflow ${a.overflow}, offscreen ${a.offscreen.length})`);
    if (caught) ok++;
    await page.close();
  }
  await m.close();
  const total = cases.length + 1;
  console.log(`self-test: ${ok}/${total} deliberate defects detected`);
  await browser.close();
  server.close();
  process.exit(ok === total ? 0 : 1);
}

const report = [];
let failures = 0;
const fail = (where, what) => { failures++; report.push(`FAIL ${where}: ${what}`); };
const pass = (where, what) => report.push(`ok   ${where}: ${what}`);

async function openPage(context, url) {
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console ' + m.text()); });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) problems.push('requestfailed ' + r.url()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const H = () => document.documentElement.scrollHeight;
    for (let y = 0; y < H(); y += Math.max(200, innerHeight * 0.7)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); }
    scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 60));
  });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(250);
  return { page, problems };
}

// the chooser page that links the three prototypes
if (args.includes('--chooser') || !args.find((a) => !a.startsWith('--'))) {
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, reducedMotion: 'reduce' });
    const where = `chooser/index.html @${vp.name}`;
    const { page, problems } = await openPage(context, BASE + 'index.html');
    const a = await page.evaluate(audit, { width: vp.width });
    const hidden = await page.evaluate(occlusion);
    problems.forEach((x) => fail(where, x));
    hidden.forEach((o) => fail(where, `text covered: ${o.el} "${o.text}" under ${o.hit}`));
    if (a.overflow > 0) fail(where, `horizontal overflow ${a.overflow}px`);
    a.overlaps.forEach((o) => fail(where, `text overlap ${o.a} × ${o.b}`));
    a.controls.forEach((o) => fail(where, `controls overlap ${o.a} × ${o.b}`));
    a.offscreen.forEach((o) => fail(where, `text off-screen ${o.el} "${o.text}"`));
    a.clipped.forEach((o) => fail(where, `text clipped ${o.el} "${o.text}"`));
    a.brokenImages.forEach((x) => fail(where, `broken image ${x}`));
    if (!hidden.length && !problems.length && !a.overflow && !a.overlaps.length && !a.controls.length && !a.offscreen.length && !a.clipped.length && !a.brokenImages.length) pass(where, 'layout clean');
    await context.close();
  }
}

for (const proto of PROTOS) {
  const pages = ['index.html', 'work.html', 'about.html', 'demos.html'];
  const projSlugs = DATA.projects.map((p) => p.slug);
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile,
      hasTouch: !!vp.hasTouch, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const slugs = ALL_PROJECTS || vp.name === 'laptop' ? projSlugs : ['bl4s-2026', 'custom-calc', 'hollowdeep', 'mp3-player', 'the-kingdom', 'wheels'];
    const list = [...pages, ...slugs.map((s) => `project.html?id=${s}`)];
    for (const p of list) {
      const where = `${proto}/${p} @${vp.name}`;
      const { page, problems } = await openPage(context, BASE + `${proto}/${p}`);
      const a = await page.evaluate(audit, { width: vp.width });
      const hidden = await page.evaluate(occlusion);
      hidden.forEach((o) => fail(where, `text covered: ${o.el} "${o.text}" under ${o.hit}`));
      problems.forEach((x) => fail(where, x));
      if (a.overflow > 0) fail(where, `horizontal overflow ${a.overflow}px`);
      a.overlaps.forEach((o) => fail(where, `text overlap ${o.a} × ${o.b} at ${o.at}`));
      a.controls.forEach((o) => fail(where, `controls overlap ${o.a} × ${o.b}`));
      a.offscreen.forEach((o) => fail(where, `text off-screen ${o.el} "${o.text}" (${o.l}..${o.r})`));
      a.clipped.forEach((o) => fail(where, `text clipped ${o.el} "${o.text}"`));
      a.brokenImages.forEach((s) => fail(where, `broken image ${s}`));
      if (!hidden.length && !problems.length && !a.overflow && !a.overlaps.length && !a.controls.length && !a.offscreen.length && !a.clipped.length && !a.brokenImages.length) pass(where, 'layout clean');
      if (SHOTS && !p.startsWith('project') ) {
        mkdirSync(join(OUT, proto), { recursive: true });
        await page.screenshot({ path: join(OUT, proto, `${p.replace('.html', '')}-${vp.name}.png`), fullPage: true });
      }
      await page.close();
    }
    await context.close();
  }

  // ---------------- behaviour
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const w = `${proto}/behaviour`;
  try {
    // work page: filters, search, sort, view
    const { page } = await openPage(context, BASE + `${proto}/work.html`);
    const count = () => page.evaluate(() => document.querySelectorAll('[data-card], .card, .row, .log-row, .tile').length);
    const expected = { all: DATA.projects.length, featured: DATA.projects.filter((p) => p.featured).length,
      program: DATA.counts.program, engineer: DATA.counts.engineer, art: DATA.counts.art, new: DATA.projects.filter((p) => p.isNew).length };
    for (const [cat, n] of Object.entries(expected)) {
      await page.click(`[data-cat="${cat}"]`);
      await page.waitForTimeout(80);
      const got = await page.evaluate(() => document.querySelectorAll('#results [data-slug]').length);
      got === n ? pass(w, `filter ${cat} = ${n}`) : fail(w, `filter ${cat}: expected ${n}, got ${got}`);
    }
    await page.click('[data-cat="all"]');
    await page.fill('#q', 'pico');
    await page.waitForTimeout(80);
    const pico = await page.evaluate(() => [...document.querySelectorAll('#results [data-slug]')].map((e) => e.dataset.slug));
    const picoExpected = DATA.projects.filter((p) => [p.title, p.summary, p.stack.join(' ')].join(' ').toLowerCase().includes('pico')).length;
    pico.length === picoExpected ? pass(w, `search "pico" = ${picoExpected}`) : fail(w, `search "pico": expected ${picoExpected}, got ${pico.length}`);
    await page.fill('#q', 'zzzz-no-match');
    await page.waitForTimeout(80);
    (await page.$('#reset')) ? pass(w, 'empty state with reset') : fail(w, 'no empty state for a search with no results');
    await page.click('#reset');
    await page.waitForTimeout(80);
    await page.selectOption('#sort', 'az');
    await page.waitForTimeout(80);
    const first = await page.evaluate(() => document.querySelector('#results [data-slug]')?.dataset.slug);
    const azFirst = [...DATA.projects].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))[0].slug;
    first === azFirst ? pass(w, `sort A–Z starts with ${azFirst}`) : fail(w, `sort A–Z: expected ${azFirst}, got ${first}`);
    await page.selectOption('#sort', 'oldest');
    await page.waitForTimeout(80);
    const oldest = await page.evaluate(() => document.querySelector('#results [data-slug]')?.dataset.slug);
    oldest === 'wheels' ? pass(w, 'sort oldest starts with wheels') : fail(w, `sort oldest: got ${oldest}`);
    const toggle = await page.$('[data-view="list"]');
    if (toggle) {
      await toggle.click();
      await page.waitForTimeout(80);
      const rows = await page.evaluate(() => document.querySelectorAll('#results [data-slug]').length);
      rows === DATA.projects.length ? pass(w, 'list view shows every project') : fail(w, `list view rows ${rows}`);
    }
    // query string restores state
    await page.goto(BASE + `${proto}/work.html?cat=engineer&sort=az`, { waitUntil: 'networkidle' });
    const qsCount = await page.evaluate(() => document.querySelectorAll('#results [data-slug]').length);
    qsCount === DATA.counts.engineer ? pass(w, 'work.html?cat=engineer restores the filter') : fail(w, `?cat=engineer gave ${qsCount}`);
    await page.close();

    // project page: viewer + lightbox + neighbours
    const p2 = (await openPage(context, BASE + `${proto}/project.html?id=bl4s-2026`)).page;
    const cap0 = await p2.textContent('#cap');
    await p2.click('#next');
    const cap1 = await p2.textContent('#cap');
    cap0 !== cap1 ? pass(w, 'viewer next changes image') : fail(w, 'viewer next did nothing');
    await p2.click('#stage .zoom');
    await p2.waitForTimeout(100);
    const lbOpen = await p2.evaluate(() => { const l = document.querySelector('.lb'); return !!l && !l.hidden; });
    lbOpen ? pass(w, 'lightbox opens') : fail(w, 'lightbox did not open');
    await p2.keyboard.press('ArrowRight');
    await p2.keyboard.press('Escape');
    const lbClosed = await p2.evaluate(() => document.querySelector('.lb').hidden);
    lbClosed ? pass(w, 'lightbox closes on Escape') : fail(w, 'lightbox stayed open');
    const title = await p2.textContent('#p-title');
    title.includes('Beamline') ? pass(w, 'project title rendered') : fail(w, `project title "${title}"`);
    const bad = (await openPage(context, BASE + `${proto}/project.html?id=does-not-exist`)).page;
    const fallback = await bad.textContent('#p-title');
    fallback && fallback.trim() ? pass(w, 'unknown project id falls back to a project') : fail(w, 'unknown id renders nothing');
    await bad.close();
    await p2.close();

    // demos: poster -> iframe, switching cartridges
    const p3 = (await openPage(context, BASE + `${proto}/demos.html#the-kingdom`)).page;
    await p3.click('.screen__poster, [data-insert]');
    await p3.waitForTimeout(300);
    const src = await p3.evaluate(() => document.querySelector('#screen iframe')?.getAttribute('src') || '');
    src.includes('kingdom.html') ? pass(w, 'demo loads The Kingdom in an iframe') : fail(w, `demo iframe src "${src}"`);
    const frameOk = await p3.evaluate(async (u) => (await fetch(u, { method: 'HEAD' })).status, new URL(src, p3.url()).href);
    frameOk === 200 ? pass(w, 'demo file reachable') : fail(w, `demo file HTTP ${frameOk}`);
    await p3.click('[data-slug="deepwell"]');
    await p3.waitForTimeout(150);
    const hash = await p3.evaluate(() => location.hash);
    hash === '#deepwell' ? pass(w, 'switching cartridge updates the hash') : fail(w, `hash after switch ${hash}`);
    await p3.close();

    // internal links on the main pages all resolve
    const hrefs = new Set();
    for (const p of ['index.html', 'work.html', 'about.html', 'demos.html', 'project.html?id=custom-calc']) {
      const pg = (await openPage(context, BASE + `${proto}/${p}`)).page;
      (await pg.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href))).forEach((h) => hrefs.add(h));
      await pg.close();
    }
    let broken = 0;
    for (const h of hrefs) {
      if (!h.startsWith(BASE.slice(0, BASE.indexOf('/prototypes/')))) continue;
      const u = new URL(h);
      const status = await new Promise((r) => http.request(u.origin + u.pathname, { method: 'HEAD' }, (res) => r(res.statusCode)).end());
      if (status !== 200) { broken++; fail(w, `link ${h} -> ${status}`); }
      if (u.pathname.endsWith('project.html') && u.searchParams.get('id') && !DATA.projects.some((p) => p.slug === u.searchParams.get('id'))) {
        broken++; fail(w, `link to unknown project ${h}`);
      }
    }
    if (!broken) pass(w, `${hrefs.size} links resolve`);
  } catch (e) {
    fail(w, 'behaviour test crashed: ' + e.message.split('\n')[0]);
  }
  await context.close();

  // mobile menu
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  try {
    const { page } = await openPage(mctx, BASE + `${proto}/index.html`);
    const btn = await page.$('[aria-controls="menu"]');
    if (!btn) fail(`${proto}/mobile`, 'no menu button');
    else {
      await btn.click();
      await page.waitForTimeout(150);
      const open = await page.evaluate(() => getComputedStyle(document.getElementById('menu')).visibility === 'visible');
      open ? pass(`${proto}/mobile`, 'menu opens') : fail(`${proto}/mobile`, 'menu did not open');
      const menuAudit = await page.evaluate(audit, { scope: '#menu', width: 375 });
      menuAudit.overlaps.forEach((o) => fail(`${proto}/mobile menu`, `text overlap ${o.a} × ${o.b}`));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      const closed = await page.evaluate(() => getComputedStyle(document.getElementById('menu')).visibility === 'hidden');
      closed ? pass(`${proto}/mobile`, 'menu closes on Escape') : fail(`${proto}/mobile`, 'menu did not close');
    }
    await page.close();
  } catch (e) { fail(`${proto}/mobile`, 'crashed: ' + e.message.split('\n')[0]); }
  await mctx.close();
}

await browser.close();
server.close();
const fails = report.filter((l) => l.startsWith('FAIL'));
console.log(report.filter((l) => l.startsWith('ok')).length + ' checks passed, ' + fails.length + ' failed');
fails.slice(0, 400).forEach((l) => console.log(l));
process.exit(failures ? 1 : 0);
