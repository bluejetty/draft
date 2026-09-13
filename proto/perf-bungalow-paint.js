// THE FIXTURE IS proto/perf-bungalow.draft, which arrives with #393 --
// Skipper committed it there, byte-identical to the file measured here (same
// md5, 37069 bytes), under the name this order's acceptance already used. It
// is a TEST FIXTURE ONLY on Movie's own condition: never shown on the site,
// never offered as a sample plan. See proto/README.md. Results are recorded
// in RD-DOCUMENTS/MEASURE-perf-bungalow-paint.md and the sibling .json.
//
// WHERE THE 33 ms GOES, on Movie's own house.
//
// The offer this answers: the frame numbers everyone has been tuning against
// came from proto/repro-garage-house.draft, and Movie's screenshot of his real
// drawing read paint 33 ms / rail 122 ms. A budget argued from a fixture an
// order of magnitude smaller than the drawing is a budget argued from nothing,
// so this measures the real bytes.
//
// SUBTRACTIVE, NOT INSTRUMENTED. Every arm opens the SHIPPING MODEL.html and
// reads its own `paint N ms` readout. The arms differ only in the file handed
// to the page: one collection emptied per arm. The difference between an arm
// and the full house is that collection's share. Nothing inside the page is
// patched, so what is measured is the page Movie runs, not a copy of it.
//
// TWO THINGS THAT WOULD MAKE THIS LIE, AND WHAT IS DONE ABOUT THEM:
//   - Emptying a collection can change the model's extent, and a different
//     extent is a different zoom, and a different zoom is a different amount
//     of ink for reasons that have nothing to do with the collection. So every
//     arm reports `scale px/ft` alongside its paint, and an arm whose scale
//     moved is called out rather than quietly averaged in.
//   - One sample is not a measurement on a machine with other work on it.
//     Each arm is loaded RELOADS times from scratch and reported at the
//     median, with the spread, so a number that is mostly noise looks like
//     one.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'perf-bungalow.draft'), 'utf8'));
const RELOADS = 5;
const BUCKET = 'model-drawing';
const BASE = process.env.BASE_URL || 'http://localhost:4173';

// Arms. `empty` names the collections zeroed for that arm; `level` optionally
// switches the saved active level so a view other than the one Movie left the
// file on can be timed.
const ARMS = [
  { name: 'full house (as Movie saved it, MAIN FL)', empty: [] },
  { name: '  minus dimensions', empty: ['dimensions'] },
  { name: '  minus walls', empty: ['walls'] },
  { name: '  minus fenestrations', empty: ['fenestrations'] },
  { name: '  minus lines', empty: ['lines'] },
  { name: '  minus floors', empty: ['floors'] },
  { name: '  minus stairs', empty: ['stairs'] },
  { name: 'empty shell (every drawn collection zeroed)',
    empty: ['dimensions', 'walls', 'fenestrations', 'lines', 'floors',
            'stairs', 'roofs', 'surfaceOpenings', 'beams', 'columns'] },
  { name: 'FOUNDATION level (where the 4 beams + 3 columns live)',
    empty: [], level: 4 },
];

const median = xs => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function sample(page, saved) {
  await page.goto(`${BASE}/MODEL.html?mode=night`);
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: saved });
  await page.goto(`${BASE}/MODEL.html?mode=night`);
  await page.locator('#readout').filter({ hasText: 'paint' })
    .waitFor({ timeout: 15000 });
  // The rail repaint is scheduled on a requestAnimationFrame, so its number is
  // still its initial 0 the instant the plan lands. Wait for it to be written
  // before reading, or every rail figure here is a zero that means "not yet".
  await page.waitForFunction(() => {
    const t = document.getElementById('readout').textContent;
    const m = /rail ([\d.]+) ms/.exec(t);
    return m && Number(m[1]) > 0;
  }, null, { timeout: 15000 }).catch(() => {});
  return page.evaluate(() => {
    const t = document.getElementById('readout').textContent;
    const num = re => { const m = re.exec(t); return m ? Number(m[1]) : null; };
    return {
      paint: num(/paint ([\d.]+) ms/),
      rail: num(/rail ([\d.]+) ms/),
      scale: num(/scale ([\d.]+) px\/ft/),
      readout: t.replace(/\s+/g, ' ').trim(),
    };
  });
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const rows = [];
  for (const arm of ARMS) {
    const saved = JSON.parse(JSON.stringify(HOUSE));
    for (const key of arm.empty) saved[key] = [];
    if (arm.level != null) saved.activeLevelIdx = arm.level;
    const runs = [];
    for (let i = 0; i < RELOADS; i += 1) runs.push(await sample(page, saved));
    const paints = runs.map(r => r.paint).filter(x => x != null);
    const rails = runs.map(r => r.rail).filter(x => x != null);
    const scales = [...new Set(runs.map(r => r.scale))];
    rows.push({
      name: arm.name,
      paint: median(paints), paintLo: Math.min(...paints), paintHi: Math.max(...paints),
      rail: rails.length ? median(rails) : null,
      scale: scales.join('/'),
      readout: runs[0].readout,
    });
    console.log(`${arm.name.padEnd(52)} paint ${median(paints).toFixed(2)} ms `
      + `(${Math.min(...paints).toFixed(2)}-${Math.max(...paints).toFixed(2)})  `
      + `rail ${rails.length ? median(rails).toFixed(2) : 'n/a'} ms  `
      + `scale ${scales.join('/')}`);
  }
  await browser.close();

  const full = rows[0];
  console.log('\nSHARE OF THE PLAN PAINT, by subtraction from the full house:');
  for (const r of rows.slice(1, 8)) {
    const share = full.paint - r.paint;
    const flag = r.scale !== full.scale
      ? '   <-- SCALE MOVED, this arm is not comparable' : '';
    console.log(`  ${r.name.trim().replace('minus ', '').padEnd(16)}`
      + `${share >= 0 ? '+' : ''}${share.toFixed(2)} ms${flag}`);
  }
  fs.writeFileSync(path.join(__dirname, 'perf-bungalow-paint.json'),
    JSON.stringify(rows, null, 2));
  console.log('\nwrote proto/perf-bungalow-paint.json');
})();
