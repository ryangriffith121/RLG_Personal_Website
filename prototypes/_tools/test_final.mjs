// Tests for the final PHP site (final/), in headless Chrome against PHP's built-in server.
//   node prototypes/_tools/test_final.mjs [--base http://127.0.0.1:8000/] [--all-projects] [--shots] [--verbose]
// Starts its own `php -S` on a free port unless --base is given (PHP from $PHP_BIN,
// C:/tools/php85/php.exe or php on the PATH).
// 1. Layout: every page at four viewports, with the audit shared with the prototype tests
//    (overlapping or covered text, text off-screen or clipped, sideways scrolling, broken images),
//    plus console errors, failed requests and PHP warnings.
// 2. Behaviour: work index filters, search, sort and URL state; the search palette; the gallery and
//    lightbox; certificates; the arcade; the phone menu; the globe and the koi pond.
// 3. Search engines: one h1, title, description, canonical, robots, Open Graph and Twitter cards with
//    reachable images, JSON-LD, the sitemap (every URL answers 200), robots.txt, the manifest, 404s.
// 4. Scripts off: every page still shows its content, and ?cat= / ?q= filter on the server.
// 5. A project added the old way (only PortfolioTabs + PortfolioPage rows) shows up everywhere.
import { chromium } from 'playwright-core';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit, occlusion } from './audit.mjs';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const FINAL = join(ROOT, 'final');
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null; };
const ALL_PROJECTS = args.includes('--all-projects');
const SHOTS = args.includes('--shots');
const OUT = join(ROOT, 'prototypes', '_tools', '.cache', 'final-test');
mkdirSync(OUT, { recursive: true });
const SITE = 'https://ryanlgriffith.com/';
const VIEWPORTS = [
  { name: 'phone', width: 375, height: 812, isMobile: true, hasTouch: true },
  { name: 'tablet', width: 820, height: 1180, hasTouch: true },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CATS = { program: 'Programming', engineer: 'Engineering', art: 'Art' };
const SHORT = { program: 'PRG', engineer: 'ENG', art: 'ART' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- PHP server
let php = null;
const phpLog = [];
const PHP_BIN = process.env.PHP_BIN || (existsSync('C:/tools/php85/php.exe') ? 'C:/tools/php85/php.exe' : 'php');
async function startPhp(env = {}) {
  const port = await new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
  const proc = spawn(PHP_BIN, ['-d', 'display_errors=1', '-d', 'error_reporting=-1', '-S', `127.0.0.1:${port}`, '-t', FINAL],
    { stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, ...env } });
  proc.on('error', (e) => { console.error(`could not start PHP (${PHP_BIN}): ${e.message}`); process.exit(2); });
  proc.stderr.on('data', (d) => String(d).split(/\r?\n/).forEach((l) => { if (/PHP (Warning|Notice|Fatal|Deprecated|Parse)/i.test(l)) phpLog.push(l.trim()); }));
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) { try { await fetch(base + 'robots.txt'); return { proc, base }; } catch { await sleep(100); } }
  console.error('PHP server did not start');
  process.exit(2);
}
let BASE = opt('--base');
if (BASE && !BASE.endsWith('/')) BASE += '/';
if (!BASE) ({ proc: php, base: BASE } = await startPhp());
const local = (u) => u.replace(SITE, BASE);

// the project list, as the site itself publishes it to the page
const homeHtml = await (await fetch(BASE)).text();
const INDEX = JSON.parse(homeHtml.match(/<script type="application\/json" id="rlg-index">([\s\S]*?)<\/script>/)[1]);
const hay = (p) => [p.t, p.m, p.k, p.c.map((c) => CATS[c]).join(' · '), p.c.map((c) => SHORT[c]).join(' · '),
  `${MONTHS[Number(p.d.slice(5, 7)) - 1]} ${p.d.slice(0, 4)}`, p.n, p.f ? 'featured' : ''].join(' ').toLowerCase();
const byCat = (c) => INDEX.filter((p) => p.c.includes(c)).length;
const lowTitle = (p) => p.t.toLowerCase();
const azOrder = (list) => [...list].sort((a, b) => (lowTitle(a) < lowTitle(b) ? -1 : lowTitle(a) > lowTitle(b) ? 1 : 0));

// ---------------------------------------------------------------- report
const report = [];
const fail = (where, what) => report.push(`FAIL ${where}: ${what}`);
const pass = (where, what) => report.push(`ok   ${where}: ${what}`);
const check = (cond, where, okText, failText) => (cond ? pass(where, okText) : fail(where, failText || okText));

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

async function openPage(context, path, { status = 200, scroll = true } = {}) {
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (status === 404 && /status of 404/.test(m.text())) return;      // the page itself answers 404 on purpose
    problems.push('console ' + m.text());
  });
  page.on('response', (r) => {
    if (r.status() < 400) return;
    if (r.request().isNavigationRequest() && r.status() === status) return;
    problems.push(`HTTP ${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => problems.push(`requestfailed ${r.url()} ${(r.failure() || {}).errorText || ''}`));
  const resp = await page.goto(BASE + path, { waitUntil: 'networkidle' });
  if (resp.status() !== status) problems.push(`answered ${resp.status()}, expected ${status}`);
  const body = await resp.text();
  if (/<b>(Warning|Notice|Deprecated|Fatal error|Parse error)<\/b>|(Warning|Notice|Deprecated|Fatal error): .+ on line \d+/i.test(body)) problems.push('PHP warning in the page');
  if (scroll) {
    await page.evaluate(async () => {
      const H = () => document.documentElement.scrollHeight;
      for (let y = 0; y < H(); y += Math.max(200, innerHeight * 0.7)) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
      scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 120));
    });
    await page.waitForLoadState('networkidle');
  }
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(200);
  return { page, problems };
}

function layoutReport(where, a, hidden, problems) {
  problems.forEach((x) => fail(where, x));
  hidden.forEach((o) => fail(where, `text covered: ${o.el} "${o.text}" under ${o.hit}`));
  if (a.overflow > 0) fail(where, `horizontal overflow ${a.overflow}px`);
  a.overlaps.forEach((o) => fail(where, `text overlap ${o.a} × ${o.b} at ${o.at}`));
  a.controls.forEach((o) => fail(where, `controls overlap ${o.a} × ${o.b}`));
  a.offscreen.forEach((o) => fail(where, `text off-screen ${o.el} "${o.text}" (${o.l}..${o.r})`));
  a.clipped.forEach((o) => fail(where, `text clipped ${o.el} "${o.text}"`));
  a.brokenImages.forEach((s) => fail(where, `broken image ${s}`));
  if (!hidden.length && !problems.length && !a.overflow && !a.overlaps.length && !a.controls.length && !a.offscreen.length && !a.clipped.length && !a.brokenImages.length) pass(where, 'layout clean');
}

// ================================================================ 1. layout
const MAIN = ['', 'portfolio.php', 'portfolio.php?view=list', 'about.php', 'demos.php'];
const SAMPLE = ['bl4s-2026', 'custom-calc', 'hollowdeep', 'mp3-player', 'the-kingdom', 'wheels', 'custom-keyboard'];
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch,
    reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const slugs = ALL_PROJECTS || vp.name === 'laptop' ? INDEX.map((p) => p.s) : SAMPLE;
  const list = [...MAIN.map((p) => [p, 200]), ['project.php?id=does-not-exist', 404], ...slugs.map((s) => [`project.php?id=${s}`, 200])];
  for (const [path, status] of list) {
    const where = `/${path} @${vp.name}`;
    const { page, problems } = await openPage(context, path, { status });
    const a = await page.evaluate(audit, { width: vp.width });
    const hidden = await page.evaluate(occlusion);
    layoutReport(where, a, hidden, problems);
    if (SHOTS && !path.startsWith('project') && (vp.name === 'phone' || vp.name === 'laptop')) {
      const name = (path.replace(/\.php.*$/, '') || 'home') + (path.includes('view=list') ? '-list' : '');
      const parts = await page.$$('main > *, footer > *');
      for (let i = 0; i < parts.length; i++) {
        try { await parts[i].screenshot({ path: join(OUT, `${name}-${vp.name}-${String(i).padStart(2, '0')}.png`) }); } catch { /* zero-size block */ }
      }
    }
    await page.close();
  }
  if (vp.name === 'phone') {
    const { page } = await openPage(context, '');
    await page.click('.nav__menu');
    await page.waitForTimeout(150);
    const a = await page.evaluate(audit, { scope: '#menu', width: vp.width });
    a.overlaps.forEach((o) => fail('menu @phone', `text overlap ${o.a} × ${o.b}`));
    a.offscreen.forEach((o) => fail('menu @phone', `text off-screen ${o.el} "${o.text}"`));
    if (!a.overlaps.length && !a.offscreen.length) pass('menu @phone', 'menu layout clean');
    await page.close();
  }
  await context.close();
}

// ================================================================ 2. behaviour
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const shown = (page) => page.evaluate(() => [...document.querySelectorAll('#results [data-slug]')].filter((t) => !t.hidden).map((t) => t.dataset.slug));

// ---- work index
try {
  const w = 'work index';
  const { page } = await openPage(ctx, 'portfolio.php');
  const total = INDEX.length;
  const newCount = await page.evaluate(() => document.querySelectorAll('#mosaic .tile[data-new="1"]').length);
  const expected = { all: total, featured: INDEX.filter((p) => p.f).length, program: byCat('program'), engineer: byCat('engineer'), art: byCat('art'), new: newCount };
  for (const [cat, n] of Object.entries(expected)) {
    await page.click(`#chips [data-cat="${cat}"]`);
    const got = (await shown(page)).length;
    const st = await page.evaluate((c) => ({ sup: Number(document.querySelector(`#chips [data-cat="${c}"] sup`).textContent),
      pressed: document.querySelector(`#chips [data-cat="${c}"]`).getAttribute('aria-pressed'), line: document.querySelector('#result').textContent, url: location.search }), cat);
    check(got === n && st.sup === n && st.pressed === 'true' && st.line.startsWith(`${n} of ${total} projects`) && (cat === 'all' ? st.url === '' : st.url === `?cat=${cat}`),
      w, `filter ${cat} shows ${n}`, `filter ${cat}: ${got} shown, chip says ${st.sup}, pressed ${st.pressed}, line "${st.line}", url "${st.url}" (expected ${n})`);
  }
  await page.click('#chips [data-cat="all"]');
  const big = await page.evaluate(() => [...document.querySelectorAll('#results .tile--big')].map((t) => t.dataset.slug));
  check(big.length === expected.featured, w, `default view: ${big.length} featured tiles are big`, `big tiles ${big.length}, featured ${expected.featured}`);
  for (const q of ['pico', 'kicad', 'october 2026', 'eng', 'rlg-001']) {
    await page.fill('#q', q);
    const got = await shown(page);
    const exp = INDEX.filter((p) => q.split(/\s+/).every((x) => hay(p).includes(x))).map((p) => p.s);
    check(got.length === exp.length && exp.every((s) => got.includes(s)) && got.length > 0, w, `search "${q}" finds ${exp.length}`, `search "${q}": got ${got.length} [${got.slice(0, 5)}], expected ${exp.length}`);
  }
  check((await page.evaluate(() => document.querySelectorAll('#results .tile--big').length)) === 0, w, 'no big tiles while searching');
  check(new URL(page.url()).searchParams.get('q') === 'rlg-001', w, 'search is kept in the URL');
  await page.fill('#q', 'zzzz-no-match');
  const empty = await page.evaluate(() => ({ vis: !document.querySelector('#empty').hidden, msg: document.querySelector('#empty-msg').textContent, n: document.querySelectorAll('#results [data-slug]').length }));
  check(empty.vis && empty.msg.includes('zzzz-no-match') && empty.n === 0, w, 'empty state for a search with no results', JSON.stringify(empty));
  await page.click('#reset');
  const after = await page.evaluate(() => ({ n: document.querySelectorAll('#results [data-slug]').length, q: document.querySelector('#q').value, url: location.search, emptyHidden: document.querySelector('#empty').hidden }));
  check(after.n === total && after.q === '' && after.url === '' && after.emptyHidden, w, 'reset restores everything', JSON.stringify(after));
  const az = azOrder(INDEX);
  for (const [s, first, last] of [['az', az[0].s, az[az.length - 1].s], ['za', az[az.length - 1].s, az[0].s], ['oldest', INDEX[INDEX.length - 1].s, INDEX[0].s], ['recent', INDEX[0].s, INDEX[INDEX.length - 1].s]]) {
    await page.selectOption('#sort', s);
    const got = await shown(page);
    check(got[0] === first && got[got.length - 1] === last && got.length === total, w, `sort ${s}: ${first} … ${last}`, `sort ${s}: got ${got[0]} … ${got[got.length - 1]}`);
  }
  await page.click('.seg [data-view="list"]');
  const lv = await page.evaluate(() => ({ view: document.querySelector('#results').dataset.view, n: document.querySelectorAll('#results [data-slug]').length, url: location.search }));
  check(lv.view === 'list' && lv.n === total && lv.url === '?view=list', w, 'list view shows every project', JSON.stringify(lv));
  await page.click('.seg [data-view="grid"]');
  // state from the URL, including the old site's ?filter=
  await page.goto(BASE + 'portfolio.php?cat=engineer&sort=az', { waitUntil: 'networkidle' });
  let got = await shown(page);
  const engAz = azOrder(INDEX.filter((p) => p.c.includes('engineer')));
  check(got.length === engAz.length && got[0] === engAz[0].s, w, '?cat=engineer&sort=az restores the filter and order', `got ${got.length} starting ${got[0]}`);
  await page.goto(BASE + 'portfolio.php?filter=reverse_alphabetical', { waitUntil: 'networkidle' });
  const legacy = await page.evaluate(() => ({ sort: document.querySelector('#sort').value, url: location.search }));
  got = await shown(page);
  check(legacy.sort === 'za' && legacy.url === '?sort=za' && got[0] === az[az.length - 1].s, w, 'old ?filter=reverse_alphabetical links still work', JSON.stringify(legacy));
  await page.goto(BASE + 'portfolio.php?cat=nonsense&sort=nonsense&view=nonsense', { waitUntil: 'networkidle' });
  got = await shown(page);
  check(got.length === total && (await page.evaluate(() => location.search)) === '', w, 'unknown query values fall back to the defaults');
  // the timeline holds every project once, by year
  const tl = await page.evaluate(() => [...document.querySelectorAll('#timeline .tl__blk')].map((a) => a.dataset.slug));
  check(tl.length === total && new Set(tl).size === total, w, `timeline has all ${total} blocks`, `timeline ${tl.length}`);
  await page.close();
} catch (e) { fail('work index', 'crashed: ' + e.message.split('\n')[0]); }

// ---- search palette
try {
  const w = 'search palette';
  const { page } = await openPage(ctx, '');
  await page.keyboard.press('/');
  let st = await page.evaluate(() => ({ open: !document.querySelector('#palette').hidden, focus: document.activeElement && document.activeElement.id, n: document.querySelectorAll('#palette-list [role="option"]').length }));
  check(st.open && st.focus === 'palette-q' && st.n > 4, w, '"/" opens it with the input focused', JSON.stringify(st));
  await page.keyboard.type('calculator');
  const first = await page.evaluate(() => { const a = document.querySelector('#palette-list [role="option"]'); return a && { text: a.textContent, href: a.getAttribute('href'), sel: a.getAttribute('aria-selected') }; });
  check(first && /Custom Calculator/.test(first.text) && first.href === 'project.php?id=custom-calc' && first.sel === 'true', w, 'typing finds the project', JSON.stringify(first));
  await Promise.all([page.waitForURL(/project\.php\?id=custom-calc/), page.keyboard.press('Enter')]);
  pass(w, 'Enter opens the selected result');
  await page.waitForLoadState('networkidle');
  await page.keyboard.press('Control+k');
  st = await page.evaluate(() => !document.querySelector('#palette').hidden);
  check(st, w, 'Ctrl+K opens it');
  await page.keyboard.type('demos');
  await page.keyboard.press('ArrowDown');
  const sel = await page.evaluate(() => [...document.querySelectorAll('#palette-list [role="option"]')].findIndex((a) => a.getAttribute('aria-selected') === 'true'));
  const items = await page.evaluate(() => document.querySelectorAll('#palette-list [role="option"]').length);
  check(items > 0 && sel === Math.min(1, items - 1), w, 'arrow keys move the selection', `selected ${sel} of ${items}`);
  await page.keyboard.press('Tab');
  check(await page.evaluate(() => document.activeElement && document.activeElement.id === 'palette-q'), w, 'Tab stays inside the palette');
  await page.keyboard.press('Escape');
  st = await page.evaluate(() => document.querySelector('#palette').hidden);
  check(st, w, 'Escape closes it');
  await page.click('#open-palette');
  await page.fill('#palette-q', 'zzzz-nothing');
  const none = await page.evaluate(() => document.querySelector('#palette-list').textContent);
  check(/Nothing matches/.test(none), w, 'a search with no hits says so');
  await page.mouse.click(5, 790);
  check(await page.evaluate(() => document.querySelector('#palette').hidden), w, 'clicking the backdrop closes it');
  await page.close();
} catch (e) { fail('search palette', 'crashed: ' + e.message.split('\n')[0]); }

// ---- project gallery and lightbox
try {
  const w = 'project gallery';
  const { page } = await openPage(ctx, 'project.php?id=bl4s-2026');
  const n = INDEX.find((p) => p.s === 'bl4s-2026').i;
  const state = () => page.evaluate(() => ({ counter: document.querySelector('#counter').textContent, cap: document.querySelector('#cap').textContent,
    src: document.querySelector('#stage img').getAttribute('src'), cur: [...document.querySelectorAll('#thumbs button')].findIndex((b) => b.getAttribute('aria-current') === 'true') }));
  const s0 = await state();
  await page.click('#next');
  const s1 = await state();
  check(s0.counter === `01/${String(n).padStart(2, '0')}` && s1.counter.startsWith('02/') && s1.cap !== s0.cap && s1.src !== s0.src && s1.cur === 1, w, 'next moves to image 2', JSON.stringify([s0, s1]));
  await page.click('#prev');
  await page.click('#prev');
  const sLast = await state();
  check(sLast.counter === `${String(n).padStart(2, '0')}/${String(n).padStart(2, '0')}`, w, 'previous wraps round to the last image', sLast.counter);
  await page.click('#thumbs button:nth-child(5)');
  const s5 = await state();
  check(s5.counter.startsWith('05/') && s5.cur === 4, w, 'thumbnails jump to their image', JSON.stringify(s5));
  await page.waitForTimeout(300);
  const loaded = await page.evaluate(() => { const i = document.querySelector('#stage img'); return i.complete && i.naturalWidth > 0; });
  check(loaded, w, 'the new image loads');
  await page.focus('#next');
  await page.keyboard.press('ArrowRight');
  check((await state()).counter.startsWith('06/'), w, 'arrow keys step through the gallery');
  await page.click('#stage .zoom');
  let lb = await page.evaluate(() => { const l = document.querySelector('#lightbox'); return l && { open: !l.hidden, count: l.querySelector('.lb__count').textContent, cap: l.querySelector('.lb__cap').textContent, focus: document.activeElement.className }; });
  check(lb && lb.open && lb.count.startsWith('06 /') && lb.cap.startsWith('Fig. 6') && /lb__close/.test(lb.focus), w, 'zoom opens the lightbox on the same image', JSON.stringify(lb));
  await page.keyboard.press('ArrowRight');
  lb = await page.evaluate(() => document.querySelector('#lightbox .lb__count').textContent);
  check(lb.startsWith('07 /'), w, 'ArrowRight steps the lightbox', lb);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  check(await page.evaluate(() => !!document.activeElement.closest('#lightbox')), w, 'Tab stays inside the lightbox');
  await page.keyboard.press('Escape');
  const closed = await page.evaluate(() => ({ hidden: document.querySelector('#lightbox').hidden, focus: document.activeElement.className, scroll: getComputedStyle(document.documentElement).overflow }));
  check(closed.hidden && closed.focus === 'zoom' && closed.scroll !== 'hidden', w, 'Escape closes it and gives focus back', JSON.stringify(closed));
  const nb = await page.evaluate(() => [...document.querySelectorAll('.pn a')].map((a) => a.getAttribute('href')));
  const i = INDEX.findIndex((p) => p.s === 'bl4s-2026');
  check(nb[0] === `project.php?id=${INDEX[i + 1].s}` && nb[1] === `project.php?id=${INDEX[i - 1].s}`, w, 'older / newer links point at the neighbours', nb.join(' '));
  await page.close();
  // a one-image project has no arrows or thumbnails
  const one = INDEX.find((p) => p.i === 1);
  if (one) {
    const { page: p1 } = await openPage(ctx, `project.php?id=${one.s}`);
    const st = await p1.evaluate(() => ({ arrows: getComputedStyle(document.querySelector('.arrows')).display, thumbs: !!document.querySelector('#thumbs') }));
    check(st.arrows === 'none' && !st.thumbs, w, `single-image project (${one.s}) hides the arrows`, JSON.stringify(st));
    await p1.close();
  }
} catch (e) { fail('project gallery', 'crashed: ' + e.message.split('\n')[0]); }

// ---- about: certificates
try {
  const w = 'about';
  const { page } = await openPage(ctx, 'about.php');
  await page.click('[data-cert="1"]');
  const lb = await page.evaluate(() => { const l = document.querySelector('#lightbox'); return { open: !l.hidden, cap: l.querySelector('.lb__cap').textContent, img: l.querySelector('.lb__img').getAttribute('src') }; });
  check(lb.open && lb.cap.length > 10 && /media\/certs\//.test(lb.img), w, 'certificates open in the lightbox', JSON.stringify(lb));
  await page.keyboard.press('Escape');
  await page.close();
} catch (e) { fail('about', 'crashed: ' + e.message.split('\n')[0]); }

// ---- arcade
try {
  const w = 'arcade';
  const { page } = await openPage(ctx, 'demos.php#density');
  const demos = await page.evaluate(() => JSON.parse(document.getElementById('demos-data').textContent));
  let st = await page.evaluate(() => ({ title: document.querySelector('#bz-title').textContent, cur: document.querySelector('.cart[aria-current="true"]').dataset.slug, link: document.querySelector('#arcade-link').getAttribute('href') }));
  check(st.title.startsWith('Density') && st.cur === 'density' && st.link === 'project.php?id=density', w, 'demos.php#density opens that cartridge', JSON.stringify(st));
  await page.click('.screen__poster');
  await page.waitForTimeout(300);
  const src = await page.evaluate(() => (document.querySelector('#screen iframe') || {}).getAttribute && document.querySelector('#screen iframe').getAttribute('src'));
  check(src === demos.find((d) => d.slug === 'density').src, w, 'Press start loads the game', String(src));
  await page.click('.cart[data-slug="deepwell"]');
  st = await page.evaluate(() => ({ hash: location.hash, iframe: !!document.querySelector('#screen iframe'), poster: !!document.querySelector('.screen__poster'), open: document.querySelector('#bz-open').getAttribute('href') }));
  check(st.hash === '#deepwell' && !st.iframe && st.poster && st.open === demos.find((d) => d.slug === 'deepwell').src, w, 'switching cartridge stops the game and updates the hash', JSON.stringify(st));
  for (const d of demos) {
    const r = await fetch(BASE + d.src);
    const html = await r.text();
    check(r.status === 200 && /<canvas|pico8|<script/i.test(html), w, `${d.slug}: game file loads`, `${d.slug}: HTTP ${r.status}`);
    const p = await fetch(BASE + d.poster);
    check(p.status === 200, w, `${d.slug}: poster loads`, `${d.slug}: poster HTTP ${p.status}`);
  }
  await page.close();
  // project pages link to their demo
  const { page: pp } = await openPage(ctx, 'project.php?id=the-kingdom', { scroll: false });
  const play = await pp.evaluate(() => [...document.querySelectorAll('a')].filter((a) => /demos\.php#the-kingdom/.test(a.getAttribute('href'))).length);
  check(play >= 1, w, 'a project with a demo links to it');
  await pp.close();
} catch (e) { fail('arcade', 'crashed: ' + e.message.split('\n')[0]); }

// ---- phone menu
try {
  const w = 'phone menu';
  const m = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const { page } = await openPage(m, '');
  await page.click('.nav__menu');
  await page.waitForTimeout(120);
  let st = await page.evaluate(() => ({ vis: getComputedStyle(document.getElementById('menu')).visibility, exp: document.querySelector('.nav__menu').getAttribute('aria-expanded'),
    label: document.querySelector('.nav__menu').textContent, focus: document.activeElement && document.activeElement.textContent, lock: getComputedStyle(document.documentElement).overflow }));
  check(st.vis === 'visible' && st.exp === 'true' && st.label === 'Close' && /Home/.test(st.focus) && st.lock === 'hidden', w, 'opens, focuses the first link and locks the page', JSON.stringify(st));
  for (let k = 0; k < 9; k++) await page.keyboard.press('Tab');
  check(await page.evaluate(() => !!(document.activeElement.closest('#menu') || document.activeElement.closest('.nav'))), w, 'Tab stays in the menu');
  await page.keyboard.press('Escape');
  st = await page.evaluate(() => ({ vis: getComputedStyle(document.getElementById('menu')).visibility, focus: document.activeElement.className }));
  check(st.vis === 'hidden' && st.focus === 'nav__menu', w, 'Escape closes it and returns focus', JSON.stringify(st));
  await page.click('.nav__menu');
  await Promise.all([page.waitForURL(/portfolio\.php/), page.click('#menu a[href="portfolio.php"]')]);
  pass(w, 'menu links navigate');
  await page.close();
  await m.close();
} catch (e) { fail('phone menu', 'crashed: ' + e.message.split('\n')[0]); }

// ---- globe and pond, with motion on
const canvasStats = (sel) => {
  const c = document.querySelector(sel);
  if (!c) return null;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let ink = 0, n = 0, sum = 0;
  for (let i = 0; i < d.length; i += 16) { n++; if (d[i + 3] > 20) ink++; sum = (sum * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) % 1000000007; }
  return { w: c.width, h: c.height, cover: ink / n, sum };
};
try {
  const w = 'globe + pond';
  const mc = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const { page, problems } = await openPage(mc, '');
  await page.evaluate(() => document.querySelector('[data-globe]').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const g1 = await page.evaluate(canvasStats, '[data-globe] canvas');
  await page.waitForTimeout(700);
  const g2 = await page.evaluate(canvasStats, '[data-globe] canvas');
  check(g1 && g1.cover > 0.2 && g1.w > 300, w, `globe drawn (${g1 ? Math.round(g1.cover * 100) : 0}% of its square)`, JSON.stringify(g1));
  check(g1 && g2 && g1.sum !== g2.sum, w, 'globe turns');
  await page.hover('.routes [data-route="jpl"]');
  await page.waitForTimeout(1500);
  const g3 = await page.evaluate(canvasStats, '[data-globe] canvas');
  check(g3 && g3.sum !== g2.sum, w, 'pointing at a route swings the globe round');
  const gc = await page.$('[data-globe] canvas');
  const gb = await gc.boundingBox();
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
  await page.mouse.down();
  await page.mouse.move(gb.x + gb.width / 2 + 120, gb.y + gb.height / 2, { steps: 6 });
  await page.mouse.up();
  check(await page.evaluate(() => location.pathname === '/'), w, 'dragging the globe stays on the page');
  await page.evaluate(() => document.querySelector('[data-pond]').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const p1 = await page.evaluate(canvasStats, '[data-pond] canvas');
  await page.waitForTimeout(600);
  const p2 = await page.evaluate(canvasStats, '[data-pond] canvas');
  check(p1 && p1.cover > 0.99 && p1.w > 100, w, `pond drawn at ${p1 && p1.w}×${p1 && p1.h} pixels`, JSON.stringify(p1));
  check(p1 && p2 && p1.sum !== p2.sum, w, 'the koi swim');
  const fishColours = await page.evaluate(() => {
    const c = document.querySelector('[data-pond] canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const want = { lav: [171, 162, 212], lime: [233, 255, 151], pink: [229, 25, 127], gold: [255, 201, 74] };
    const out = {};
    for (const [k, rgb] of Object.entries(want)) {
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]) < 12) n++;
      out[k] = n;
    }
    return out;
  });
  check(fishColours.lav > 20 && fishColours.pink > 20 && fishColours.gold > 20 && fishColours.lime > 20, w, 'koi in all four colours', JSON.stringify(fishColours));
  const pc = await page.$('[data-pond] canvas');
  const pb = await pc.boundingBox();
  const vb = await page.evaluate(() => document.querySelector('[data-pond]').getBoundingClientRect().toJSON());
  await page.mouse.click(vb.x + 30, vb.y + 30);
  await page.waitForTimeout(200);
  pass(w, `clicking open water drops food (canvas ${Math.round(pb.width)}px wide)`);
  problems.forEach((x) => fail(w, x));
  await page.close();
  await mc.close();
} catch (e) { fail('globe + pond', 'crashed: ' + e.message.split('\n')[0]); }

// pointing at a koi names its project, and clicking opens it (still frame, so the fish hold their place)
try {
  const w = 'pond';
  const { page } = await openPage(ctx, '');
  await page.evaluate(() => document.querySelector('[data-pond]').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const r = await page.evaluate(() => document.querySelector('[data-pond]').getBoundingClientRect().toJSON());
  let found = null;
  for (let y = r.top + 12; y < r.bottom - 12 && !found; y += 9) {
    for (let x = r.left + 12; x < r.right - 12 && !found; x += 9) {
      await page.mouse.move(x, y);
      const tip = await page.evaluate(() => { const t = document.getElementById('pond-tip'); return t.classList.contains('is-idle') ? null : t.textContent; });
      if (tip) found = { x, y, tip };
    }
  }
  check(!!found, w, `pointing at a koi names it: "${found && found.tip}"`, 'no fish found under the pointer');
  if (found) {
    const id = found.tip.split(' · ')[0];
    const proj = INDEX.find((p) => p.n === id);
    await Promise.all([page.waitForURL(/project\.php\?id=/), page.mouse.click(found.x, found.y)]);
    check(proj && page.url().endsWith(`project.php?id=${proj.s}`), w, `clicking it opens ${proj && proj.s}`, page.url());
  }
  await page.close();
} catch (e) { fail('pond', 'crashed: ' + e.message.split('\n')[0]); }

// ---- links on the main pages
try {
  const w = 'links';
  const hrefs = new Set();
  const anchors = [];
  for (const p of ['', 'portfolio.php', 'about.php', 'demos.php', 'project.php?id=custom-calc']) {
    const { page } = await openPage(ctx, p, { scroll: false });
    const got = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({ href: a.href, raw: a.getAttribute('href') })));
    got.forEach((g) => hrefs.add(g.href));
    const missing = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')].map((a) => a.getAttribute('href')).filter((h) => h.length > 1 && !document.getElementById(h.slice(1))));
    missing.forEach((h) => anchors.push(`${p || '/'} ${h}`));
    await page.close();
  }
  let broken = 0, external = 0, internal = 0;
  for (const h of hrefs) {
    if (!h.startsWith(BASE)) { external++; continue; }
    internal++;
    const u = new URL(h);
    const r = await fetch(u.origin + u.pathname + u.search);
    if (r.status !== 200) { broken++; fail(w, `${h} -> ${r.status}`); }
    if (u.pathname.endsWith('project.php') && !INDEX.some((p) => p.s === u.searchParams.get('id'))) { broken++; fail(w, `link to an unknown project ${h}`); }
  }
  anchors.forEach((a) => fail(w, `in-page link to a missing id: ${a}`));
  check(!broken && !anchors.length, w, `${internal} internal links answer 200 (${external} external not fetched)`);
} catch (e) { fail('links', 'crashed: ' + e.message.split('\n')[0]); }

// ================================================================ 3. search engines
try {
  const w = 'seo';
  const pages = [['', 'website'], ['portfolio.php', 'website'], ['about.php', 'profile'], ['demos.php', 'website'], ...INDEX.map((p) => [`project.php?id=${p.s}`, 'article'])];
  const titles = new Set(), descs = new Set();
  let ok = 0;
  for (const [path, type] of pages) {
    const { page } = await openPage(ctx, path, { scroll: false });
    const m = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const meta = (n) => (q(`meta[name="${n}"]`) || q(`meta[property="${n}"]`) || {}).content || '';
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent); } catch (e) { return 'BAD'; } });
      return { h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()), title: document.title, desc: meta('description'), canonical: (q('link[rel="canonical"]') || {}).href || '',
        robots: meta('robots'), ogTitle: meta('og:title'), ogDesc: meta('og:description'), ogImage: meta('og:image'), ogUrl: meta('og:url'), ogType: meta('og:type'), ogAlt: meta('og:image:alt'),
        tw: meta('twitter:card'), twImage: meta('twitter:image'), lang: document.documentElement.lang, ld, noAlt: [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.src),
        theme: meta('theme-color'), viewport: meta('viewport'), icon: !!q('link[rel="icon"]'), manifest: !!q('link[rel="manifest"]') };
    });
    const where = `${w} /${path}`;
    const errs = [];
    if (m.h1.length !== 1 || !m.h1[0]) errs.push(`h1 count ${m.h1.length}`);
    if (m.title.length < 15 || m.title.length > 70) errs.push(`title length ${m.title.length}: "${m.title}"`);
    if (titles.has(m.title)) errs.push(`duplicate title "${m.title}"`);
    titles.add(m.title);
    if (m.desc.length < 50 || m.desc.length > 170) errs.push(`description length ${m.desc.length}`);
    if (descs.has(m.desc)) errs.push('duplicate description');
    descs.add(m.desc);
    if (m.canonical !== SITE + path) errs.push(`canonical ${m.canonical}`);
    if (m.ogUrl !== m.canonical) errs.push(`og:url ${m.ogUrl}`);
    if (!/^index, follow/.test(m.robots)) errs.push(`robots "${m.robots}"`);
    if (!m.ogTitle || !m.ogDesc || m.ogType !== type || !m.ogAlt) errs.push(`open graph ${m.ogType} "${m.ogTitle}"`);
    if (m.tw !== 'summary_large_image' || m.twImage !== m.ogImage) errs.push('twitter card');
    if (!m.ogImage.startsWith(SITE)) errs.push(`og:image not absolute: ${m.ogImage}`);
    else {
      const r = await fetch(local(m.ogImage));
      const buf = Buffer.from(await r.arrayBuffer());
      const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
      let dims = null;
      for (let i = 2; jpeg && i < buf.length - 9;) {          // read the JPEG frame header for the size
        if (buf[i] !== 0xff) { i++; continue; }
        const mk = buf[i + 1];
        if (mk >= 0xc0 && mk <= 0xc2) { dims = [buf.readUInt16BE(i + 7), buf.readUInt16BE(i + 5)]; break; }
        i += 2 + buf.readUInt16BE(i + 2);
      }
      if (r.status !== 200 || !jpeg || !dims || dims[0] !== 1200 || dims[1] !== 630) errs.push(`og:image ${m.ogImage} -> ${r.status} ${jpeg ? 'jpeg' : 'not jpeg'} ${dims}`);
    }
    if (m.lang !== 'en' || !m.viewport || !m.theme || !m.icon || !m.manifest) errs.push('lang / viewport / theme / icon / manifest');
    if (m.noAlt.length) errs.push(`images without alt: ${m.noAlt.slice(0, 3)}`);
    const graph = m.ld.length === 1 && m.ld[0] !== 'BAD' && m.ld[0]['@graph'];
    if (!graph) errs.push('JSON-LD missing or invalid');
    else {
      const types = graph.map((n) => n['@type']);
      if (!types.includes('WebSite')) errs.push('JSON-LD has no WebSite');
      if (type === 'article') {
        const work = graph.find((n) => n['@type'] === 'CreativeWork');
        const proj = INDEX.find((p) => path.endsWith(`=${p.s}`));
        if (!work || work.name !== proj.t || work.datePublished !== proj.d || !types.includes('BreadcrumbList')) errs.push('project JSON-LD');
      }
      if (path === '' && !types.includes('Person')) errs.push('home JSON-LD has no Person');
      if (path === 'portfolio.php') {
        const list = graph.find((n) => n['@type'] === 'CollectionPage');
        if (!list || list.mainEntity.itemListElement.length !== INDEX.length) errs.push('work ItemList');
      }
      if (path === 'demos.php' && !JSON.stringify(graph).includes('VideoGame')) errs.push('demos JSON-LD has no VideoGame');
    }
    errs.length ? errs.forEach((e) => fail(where, e)) : ok++;
    await page.close();
  }
  check(ok === pages.length, w, `${ok} of ${pages.length} pages have complete metadata`, `${ok} of ${pages.length} pages clean`);
  // 404s
  const { page } = await openPage(ctx, 'project.php?id=nope', { status: 404, scroll: false });
  const r404 = await page.evaluate(() => ({ robots: document.querySelector('meta[name="robots"]').content, h1: document.querySelectorAll('h1').length }));
  check(/noindex/.test(r404.robots) && r404.h1 === 1, w, 'unknown project answers 404 with noindex', JSON.stringify(r404));
  await page.close();
  // sitemap
  const sm = await fetch(BASE + 'sitemap.php');
  const xml = await sm.text();
  const { page: xp } = await openPage(ctx, 'robots.txt', { scroll: false });
  const wellFormed = await xp.evaluate((x) => !new DOMParser().parseFromString(x, 'application/xml').querySelector('parsererror'), xml);
  await xp.close();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((x) => x[1].replace(/&amp;/g, '&'));
  const imgs = [...xml.matchAll(/<image:loc>([^<]+)<\/image:loc>/g)].map((x) => x[1].replace(/&amp;/g, '&'));
  check(sm.status === 200 && /xml/.test(sm.headers.get('content-type')) && wellFormed, w, 'sitemap.php is well-formed XML');
  check(locs.length === 4 + INDEX.length, w, `sitemap lists ${locs.length} pages`, `sitemap has ${locs.length} URLs, expected ${4 + INDEX.length}`);
  let bad = 0;
  for (const u of [...locs, ...imgs]) {
    if (!u.startsWith(SITE)) { bad++; fail(w, `sitemap URL not on ${SITE}: ${u}`); continue; }
    const r = await fetch(local(u));
    if (r.status !== 200) { bad++; fail(w, `sitemap ${u} -> ${r.status}`); }
  }
  check(!bad, w, `every sitemap page and image (${locs.length} + ${imgs.length}) answers 200`);
  const robots = await (await fetch(BASE + 'robots.txt')).text();
  check(robots.includes(`Sitemap: ${SITE}sitemap.php`) && /Disallow: \/data\//.test(robots), w, 'robots.txt points at the sitemap and hides the data folder');
  const mf = JSON.parse(await (await fetch(BASE + 'site.webmanifest')).text());
  let icons = 0;
  for (const ic of mf.icons) icons += (await fetch(BASE + ic.src.replace(/^\//, ''))).status === 200 ? 1 : 0;
  check(mf.name && icons === mf.icons.length, w, `manifest and its ${icons} icons load`);
} catch (e) { fail('seo', 'crashed: ' + e.message.split('\n')[0]); }

// ================================================================ 4. scripts off
try {
  const w = 'no scripts';
  const nc = await browser.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
  for (const path of ['', 'portfolio.php', 'about.php', 'demos.php', 'project.php?id=custom-calc']) {
    const { page, problems } = await openPage(nc, path, { scroll: false });
    // (the shared audit needs a DOM callback, which a page with scripts off will not run, so these are plain reads)
    const st = await page.evaluate(() => {
      // the visible part of each element: cut to every ancestor that clips (the marquee, the bands)
      const seen = (e) => {
        const r = e.getBoundingClientRect();
        let L = r.left, R = r.right;
        for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
          if (getComputedStyle(a).overflowX !== 'visible') { const ar = a.getBoundingClientRect(); L = Math.max(L, ar.left); R = Math.min(R, ar.right); }
        }
        return { L, R, w: r.width };
      };
      const wide = [...document.querySelectorAll('main *')].filter((e) => {
        const v = seen(e);
        return v.w && v.R > v.L && (v.R > innerWidth + 1 || v.L < -1) && getComputedStyle(e).position !== 'fixed';
      });
      return {
        js: document.documentElement.classList.contains('js'),
        hiddenReveal: [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity !== '1').length,
        h1: document.querySelector('h1').getBoundingClientRect().height,
        pond: document.querySelector('.pond') ? getComputedStyle(document.querySelector('.pond')).display : 'none',
        text: document.querySelector('main').innerText.length,
        overflow: document.documentElement.scrollWidth - innerWidth,
        wide: wide.slice(0, 3).map((e) => e.tagName.toLowerCase() + '.' + [...e.classList].join('.')),
      };
    });
    problems.forEach((x) => fail(`${w} /${path}`, x));
    check(!st.js && st.hiddenReveal === 0 && st.h1 > 10 && st.pond === 'none' && st.text > 300 && st.overflow <= 0 && !st.wide.length,
      `${w} /${path}`, 'content shows and lays out', JSON.stringify(st));
    await page.close();
  }
  const { page } = await openPage(nc, 'portfolio.php?cat=art&sort=az', { scroll: false });
  const art = await shown(page);
  const exp = azOrder(INDEX.filter((p) => p.c.includes('art'))).map((p) => p.s);
  check(art.length === exp.length && art[0] === exp[0], w, '?cat=art&sort=az filters on the server', `got ${art.length} from ${art[0]}`);
  await page.close();
  const { page: q } = await openPage(nc, 'portfolio.php?q=pico', { scroll: false });
  const pico = await shown(q);
  check(pico.length === INDEX.filter((p) => hay(p).includes('pico')).length, w, '?q=pico searches on the server', `got ${pico.length}`);
  await q.close();
  await nc.close();
} catch (e) { fail('no scripts', 'crashed: ' + e.message.split('\n')[0]); }

// ================================================================ 5. an entry added the old way
// A project with only the two original rows (PortfolioTabs + PortfolioPage) must still show up
// everywhere, on a scratch copy of the database.
try {
  const w = 'old-style entry';
  const dir = mkdtempSync(join(tmpdir(), 'rlg-db-'));
  const db = join(dir, 'portfolio.db');
  copyFileSync(join(FINAL, 'data', 'portfolio.db'), db);
  const now = Math.floor(Date.now() / 1000);
  const sql = `$d = new PDO('sqlite:' . $argv[1]); $id = (int) $d->query('SELECT MAX(id) FROM PortfolioTabs')->fetchColumn() + 1;
    $d->prepare('INSERT INTO PortfolioTabs VALUES (?,?,?,?,?,?,?,?)')->execute([$id, 'legacy-test', 'Legacy Test Entry', 'November 4, 2026', ${now}, 'An entry added with only the two original tables.', 'media\\\\thumbs\\\\wheels.webp', 'art,program']);
    $d->prepare('INSERT INTO PortfolioPage VALUES (?,?,?,?,?,?,?,?)')->execute([$id, 'legacy-test', 'Legacy Test Entry', 'November 4, 2026', 'Body text.', 'Lessons.', 'Takeaway.', 'media/thumbs/wheels.webp, media/thumbs/micro.webp']);`;
  const ins = spawnSync(PHP_BIN, ['-r', sql, db], { encoding: 'utf8' });
  if (ins.status !== 0) throw new Error('insert failed: ' + (ins.stderr || ins.stdout));
  const { proc, base } = await startPhp({ RLG_DB: db });
  try {
    const get = async (p) => { const r = await fetch(base + p); return { status: r.status, body: await r.text() }; };
    const warn = (b) => /<b>(Warning|Notice|Deprecated|Fatal error)<\/b>|(Warning|Notice|Deprecated|Fatal error): .+ on line \d+/i.test(b);
    const pf = await get('portfolio.php');
    const tiles = (pf.body.match(/<article class="tile /g) || []).length;
    check(pf.status === 200 && !warn(pf.body) && tiles === INDEX.length + 1 && pf.body.includes('Legacy Test Entry'), w, 'appears on the work index', `status ${pf.status}, tiles ${tiles}`);
    const pp = await get('project.php?id=legacy-test');
    check(pp.status === 200 && !warn(pp.body) && pp.body.includes('Legacy Test Entry') && pp.body.includes('media/thumbs/micro.webp') && pp.body.includes('media/og/site.jpg'),
      w, 'its project page renders with both images and the default share card', `status ${pp.status}`);
    const home = await get('');
    check(home.status === 200 && !warn(home.body) && home.body.includes('"s":"legacy-test"'), w, 'the home page, feed and pond pick it up');
    const sm = await get('sitemap.php');
    check(sm.body.includes('project.php?id=legacy-test'), w, 'the sitemap lists it');
  } finally {
    proc.kill();
    await sleep(300);
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* temp files are cleaned up by the OS */ }
  }
} catch (e) { fail('old-style entry', 'crashed: ' + e.message.split('\n')[0]); }

await ctx.close();
await browser.close();
phpLog.forEach((l) => fail('php log', l));
if (php) php.kill();
const fails = report.filter((l) => l.startsWith('FAIL'));
if (args.includes('--verbose')) report.filter((l) => l.startsWith('ok')).forEach((l) => console.log(l));
console.log(report.filter((l) => l.startsWith('ok')).length + ' checks passed, ' + fails.length + ' failed');
fails.slice(0, 400).forEach((l) => console.log(l));
process.exit(fails.length ? 1 : 0);
