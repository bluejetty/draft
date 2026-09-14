// THE FIXTURE IS proto/perf-bungalow.draft, which arrives with #393 --
// Skipper committed it there, byte-identical to the file measured here (same
// md5, 37069 bytes), under the name this order's acceptance already used. It
// is a TEST FIXTURE ONLY on Movie's own condition: never shown on the site,
// never offered as a sample plan. See proto/README.md. Results are recorded
// in RD-DOCUMENTS/MEASURE-perf-bungalow-paint.md and the sibling .json.
//
// IS THE 33 ms PIXELS OR ENTITIES?
//
// proto/perf-bungalow-paint.js measured Movie's own file at paint 1.90 ms on a
// 1600x900 headless Chromium — against the 33 ms his screenshot shows. The
// bytes are identical, so the difference is not in the drawing. Subtracting
// collections one at a time (that script) showed no collection worth more
// than 0.6 ms, which rules out the "50 dimensions is what makes it 122"
// hypothesis on these bytes and leaves the frame itself.
//
// The two candidates left that this box CAN vary are canvas AREA and device
// pixel ratio. Movie runs Firefox at 60% browser zoom, which makes the layout
// viewport ~1.7x wider in CSS pixels than the window, so his plan canvas is
// far larger than any fixture has been timed at. If the paint is fill-bound it
// tracks area; if it is entity-bound it stays flat and the remaining variable
// is the engine, which cannot be tested here (no Firefox on this box).
//
// Reported as a sweep, not a verdict: each row is the median of RELOADS loads
// with the spread, and the scale px/ft is carried so a row that re-fit the
// view to a different zoom is visible rather than averaged in.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'perf-bungalow.draft'), 'utf8'));
const RELOADS = 3;
const BASE = process.env.BASE_URL || 'http://localhost:4173';

const SIZES = [
  { w: 1366, h: 768, dpr: 1 },
  { w: 1600, h: 900, dpr: 1 },
  { w: 2277, h: 1280, dpr: 1 },   // 1366 at Movie's 60% browser zoom
  { w: 2277, h: 1280, dpr: 2 },
  { w: 3200, h: 1800, dpr: 1 },
  { w: 3200, h: 1800, dpr: 2 },
];

const median = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

(async () => {
  const browser = await chromium.launch();
  const rows = [];
  for (const s of SIZES) {
    const page = await browser.newPage({
      viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr });
    const runs = [];
    for (let i = 0; i < RELOADS; i += 1) {
      await page.goto(`${BASE}/MODEL.html?mode=night`);
      await page.evaluate(async file => {
        await window.SharedFileStore.saveSharedFile(
          new File([JSON.stringify(file)], 'drawing.json',
            { type: 'application/json' }), 'model-drawing');
      }, HOUSE);
      await page.goto(`${BASE}/MODEL.html?mode=night`);
      await page.locator('#readout').filter({ hasText: 'paint' })
        .waitFor({ timeout: 15000 });
      await page.waitForFunction(() => {
        const m = /rail ([\d.]+) ms/.exec(
          document.getElementById('readout').textContent);
        return m && Number(m[1]) > 0;
      }, null, { timeout: 15000 }).catch(() => {});
      runs.push(await page.evaluate(() => {
        const t = document.getElementById('readout').textContent;
        const n = re => { const m = re.exec(t); return m ? Number(m[1]) : null; };
        const c = document.getElementById('plan');
        return { paint: n(/paint ([\d.]+) ms/), rail: n(/rail ([\d.]+) ms/),
          scale: n(/scale ([\d.]+) px\/ft/), cw: c.width, ch: c.height };
      }));
    }
    await page.close();
    const p = runs.map(r => r.paint), r2 = runs.map(r => r.rail).filter(Boolean);
    const px = runs[0].cw * runs[0].ch;
    rows.push({ ...s, canvas: `${runs[0].cw}x${runs[0].ch}`, megapx: px / 1e6,
      paint: median(p), rail: r2.length ? median(r2) : null, scale: runs[0].scale });
    console.log(`${s.w}x${s.h} dpr${s.dpr}`.padEnd(20)
      + `canvas ${runs[0].cw}x${runs[0].ch}`.padEnd(20)
      + `${(px / 1e6).toFixed(2)} Mpx  `
      + `paint ${median(p).toFixed(2)} ms (${Math.min(...p).toFixed(2)}-${Math.max(...p).toFixed(2)})  `
      + `rail ${r2.length ? median(r2).toFixed(2) : 'n/a'} ms  `
      + `scale ${runs[0].scale}`);
  }
  await browser.close();
  const first = rows[0], last = rows[rows.length - 1];
  console.log(`\nAREA RANGE ${(last.megapx / first.megapx).toFixed(1)}x  ->  `
    + `PAINT RANGE ${(last.paint / first.paint).toFixed(1)}x`);
  console.log(rows.every(r => r.paint < 10)
    ? 'NO ROW REACHES 33 ms. Canvas area does not explain Movie\'s number on '
      + 'this box; what is left is the browser engine (Firefox, untestable here).'
    : 'A row reaches Movie\'s number: the cost is fill-bound, not entity-bound.');
  fs.writeFileSync(path.join(__dirname, 'perf-bungalow-canvas-sweep.json'),
    JSON.stringify(rows, null, 2));
})();
