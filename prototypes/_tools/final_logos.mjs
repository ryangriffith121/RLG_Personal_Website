// Logos and icons for the final site, from Ryan's own SVGs (Adobe_Design_Work/logo2.svg, logo3.svg).
//   node prototypes/_tools/final_logos.mjs
// Writes final/assets/img/logo-mark.svg (square RY/AN) and logo-word.svg (horizontal RYAN, one <g>
// per letter so the footer can colour them), PNG renders for the icon set and Open Graph cards
// (.cache/final/logos), and the favicons in final/.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = resolve(fileURLToPath(new URL('.', import.meta.url)));
const FINAL = join(TOOLS, '..', '..', 'final');
const CACHE = join(TOOLS, '.cache', 'final', 'logos');
const SRC = join(process.env.USERPROFILE, 'Desktop', 'Ryan_Griffith_Project_Resources', '03_Art', 'Adobe_Design_Work');
mkdirSync(join(FINAL, 'assets', 'img'), { recursive: true });
mkdirSync(CACHE, { recursive: true });

const paths = (file) => [...readFileSync(join(SRC, file), 'utf8').matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1].replace(/\s+/g, ' ').trim());
const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await b.newPage();

// measure every path, so the viewBox hugs the artwork and the word mark splits into letters
async function measure(ds) {
  return page.evaluate((list) => {
    document.body.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="4000">${list.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
    return [...document.querySelectorAll('path')].map((p) => { const r = p.getBBox(); return [r.x, r.y, r.width, r.height]; });
  }, ds);
}
const r2 = (n) => Math.round(n * 100) / 100;
function box(boxes) {
  const x0 = Math.min(...boxes.map((q) => q[0])), y0 = Math.min(...boxes.map((q) => q[1]));
  const x1 = Math.max(...boxes.map((q) => q[0] + q[2])), y1 = Math.max(...boxes.map((q) => q[1] + q[3]));
  return [x0, y0, x1 - x0, y1 - y0];
}

const mark = paths('logo3.svg');
const word = paths('logo2.svg');
const mb = box(await measure(mark));
const wboxes = await measure(word);
const wb = box(wboxes);

// letters: cluster the word mark's paths by horizontal centre (4 letters, R Y A N)
const order = wboxes.map((q, i) => ({ i, cx: q[0] + q[2] / 2 })).sort((a, z) => a.cx - z.cx);
const letters = [[], [], [], []];
order.forEach(({ i, cx }) => { const k = Math.min(3, Math.floor(((cx - wb[0]) / wb[2]) * 4)); letters[k].push(i); });

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mb.map(r2).join(' ')}" fill="currentColor">${mark.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
const wordSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${wb.map(r2).join(' ')}" fill="currentColor">${letters.map((ix, k) =>
  `<g class="ltr ltr-${k + 1}">${ix.map((i) => `<path d="${word[i]}"/>`).join('')}</g>`).join('')}</svg>`;
writeFileSync(join(FINAL, 'assets', 'img', 'logo-mark.svg'), markSvg);
writeFileSync(join(FINAL, 'assets', 'img', 'logo-word.svg'), wordSvg);
console.log('logo-mark', mb.map(Math.round), 'logo-word', wb.map(Math.round), 'letters', letters.map((l) => l.length));

// raster renders: transparent PNGs in the palette
async function shot(svg, w, h, bg, name, pad = 0) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:${bg};width:${w}px;height:${h}px;display:grid;place-items:center">
    <div style="width:${w - pad * 2}px;height:${h - pad * 2}px;display:grid;place-items:center">${svg.replace('<svg ', '<svg style="width:100%;height:100%" ')}</div></body></html>`);
  await page.screenshot({ path: join(CACHE, name), omitBackground: bg === 'transparent' });
}
const color = (svg, c) => svg.replace('fill="currentColor"', `fill="${c}"`);
// favicon tile: lime mark on an indigo rounded square
const tile = (s) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}"><rect width="${s}" height="${s}" rx="${s * 0.22}" fill="#412db5"/>
  <svg x="${s * 0.17}" y="${s * 0.17}" width="${s * 0.66}" height="${s * 0.66}" viewBox="${mb.map(r2).join(' ')}" fill="#e9ff97">${mark.map((d) => `<path d="${d}"/>`).join('')}</svg></svg>`;
writeFileSync(join(FINAL, 'favicon.svg'), tile(512));
for (const s of [512, 192, 180, 48, 32, 16]) await shot(tile(512), s, s, 'transparent', `icon-${s}.png`);
await shot(color(markSvg, '#412db5'), 1000, 1000, 'transparent', 'mark-indigo.png', 40);
await shot(color(wordSvg, '#e9ff97'), 1600, Math.round(1600 * wb[3] / wb[2]), 'transparent', 'word-lime.png');
await shot(color(wordSvg, '#0f0e19'), 1600, Math.round(1600 * wb[3] / wb[2]), 'transparent', 'word-ink.png');
await b.close();
console.log('renders ->', CACHE);
