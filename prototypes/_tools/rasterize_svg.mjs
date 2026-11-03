// Rasterizes an SVG to PNG with headless Chrome: node rasterize_svg.mjs in.svg out.png width [css-filter] [bg]
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const [, , inp, out, width = '2000', filter = 'none', bg = 'transparent'] = process.argv;
const svg = readFileSync(inp, 'utf8');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: Number(width), height: 800 } });
await page.setContent(`<html><body style="margin:0;background:${bg}"><div id="w" style="width:${width}px;filter:${filter}">${svg}</div></body></html>`);
await page.evaluate(() => { const s = document.querySelector('svg'); s.removeAttribute('height'); s.setAttribute('width', '100%'); });
const box = await (await page.$('#w')).boundingBox();
await page.setViewportSize({ width: Number(width), height: Math.ceil(box.height) });
await page.screenshot({ path: out, omitBackground: bg === 'transparent', clip: { x: 0, y: 0, width: Number(width), height: Math.ceil(box.height) } });
console.log('wrote', out, Math.round(box.width), 'x', Math.round(box.height));
await browser.close();
