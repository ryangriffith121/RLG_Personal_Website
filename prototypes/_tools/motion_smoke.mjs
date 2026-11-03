// Runs every prototype page with animations ON (the layout suite uses reduced motion) and
// reports script errors; moves the pointer over the heroes to exercise the interactive bits.
import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://localhost:5181/prototypes/';
const out = process.argv[3] || '.cache/motion';
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
let bad = 0;
for (const proto of ['orbit', 'telemetry', 'spectrum']) {
  for (const pg of ['index.html', 'work.html', 'project.html?id=hollowdeep', 'about.html', 'demos.html']) {
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(base + proto + '/' + pg, { waitUntil: 'networkidle' });
    if (pg === 'index.html') {
      await p.waitForTimeout(300);
      if (proto === 'telemetry') await p.screenshot({ path: `${out}-${proto}-boot.png` });
      for (let i = 0; i < 12; i++) { await p.mouse.move(300 + i * 80, 300 + (i % 3) * 120); await p.waitForTimeout(60); }
      // drag the globe / steer the beam
      await p.mouse.move(720, 520); await p.mouse.down(); await p.mouse.move(900, 560, { steps: 8 }); await p.mouse.up();
      await p.waitForTimeout(2600);
      await p.screenshot({ path: `${out}-${proto}-home.png` });
      const boot = await p.evaluate(() => !!document.querySelector('.boot'));
      if (proto === 'telemetry' && boot) { errs.push('boot overlay still present after 3s'); }
    } else {
      await p.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } });
      await p.waitForTimeout(800);
    }
    const hidden = await p.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter((e) => !e.classList.contains('is-in')).length);
    console.log(`${proto}/${pg}: ${errs.length ? 'ERRORS ' + errs.join(' | ') : 'ok'}${pg !== 'index.html' && hidden ? ` (${hidden} reveal blocks still hidden)` : ''}`);
    if (errs.length) bad++;
    await p.close();
  }
}
// palette (telemetry) with real key presses
const p = await ctx.newPage();
await p.goto(base + 'telemetry/work.html', { waitUntil: 'networkidle' });
await p.keyboard.press('/');
await p.keyboard.type('pcb');
await p.waitForTimeout(150);
const items = await p.evaluate(() => [...document.querySelectorAll('#palette-list [role=option]')].map((a) => a.textContent.replace(/\s+/g, ' ').trim()));
console.log('palette "pcb":', items.length, 'results ->', items.slice(0, 4).join(' / '));
await p.keyboard.press('ArrowDown');
await p.keyboard.press('Enter');
await p.waitForLoadState('networkidle');
console.log('palette Enter navigated to', new URL(p.url()).search);
await b.close();
process.exit(bad ? 1 : 0);
