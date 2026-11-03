// Full-page screenshots for visual review.
// node snap.mjs <baseUrl> <outDir> <width>x<height>[,...] <path> [path...]
// e.g. node snap.mjs http://localhost:5181/prototypes/orbit/ .cache/shots/orbit 1440x900,390x844 index.html work.html
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [, , base, outDir, sizes, ...paths] = process.argv;
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
for (const size of sizes.split(',')) {
  const [w, h] = size.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  for (const p of paths) {
    const page = await ctx.newPage();
    const problems = [];
    page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
    page.on('requestfailed', (r) => problems.push('failed: ' + r.url()));
    page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()}: ${r.url()}`); });
    await page.goto(base + p, { waitUntil: 'networkidle' });
    // scroll through so lazy images load
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
      scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);
    const name = p.replace(/[^a-z0-9]+/gi, '_').replace(/_html$/, '');
    await page.screenshot({ path: `${outDir}/${name}-${w}.png`, fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(`${p} @${w}: ${problems.length ? problems.join(' | ') : 'ok'}${overflow > 0 ? `  OVERFLOW ${overflow}px` : ''}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
