// Screenshots each prototype's home page for the chooser page (prototypes/index.html).
// node make_previews.mjs [baseUrl]   (serve the repo first: node serve.mjs 5180)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:5180/prototypes/';
const out = new URL('../_shared/media/previews/', import.meta.url);
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const [name, w, h, mobile] of [['desk', 1440, 900, false], ['phone', 390, 844, true]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference', deviceScaleFactor: 1 });
  for (const proto of ['orbit', 'telemetry', 'spectrum']) {
    const p = await ctx.newPage();
    await p.goto(base + proto + '/index.html', { waitUntil: 'networkidle' });
    await p.evaluate(() => { try { sessionStorage.setItem('rlg-booted', '1'); } catch (e) {} document.querySelector('.boot')?.remove(); });
    await p.waitForTimeout(2600);
    await p.screenshot({ path: new URL(`${proto}-${name}.png`, out).pathname.slice(1) });
    await p.close();
  }
  await ctx.close();
}
await b.close();
console.log('previews written');
