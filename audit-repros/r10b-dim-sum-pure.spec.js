// Same question, driven straight through the production string builder
// (auto-dims.js) and the production formatter, over many footprints.
const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R10b: how often do printed partials fail to add to the printed overall', async ({ page }) => {
  await h.openModel(page);
  const out = await page.evaluate(() => {
    const fmt = window.DraftFormatters.formatArchitecturalInches;
    const parse = t => window.DraftFormatters.parseArchitecturalLength(t).inches;
    const offsetOutline = (pts, d) => window.DraftGeometry2D.offsetOutline(pts, d);
    let cases = 0, bad = 0, worst = 0, sample = null;
    for (let trial = 0; trial < 400; trial++) {
      // A hand-traced rectangle: corners anywhere, like a fingertip leaves them.
      const w = 20 + Math.random() * 20, d = 14 + Math.random() * 14;
      const pts = [{ x: 0, z: 0 }, { x: w, z: 0 }, { x: w, z: d }, { x: 0, z: d }];
      const wall = { start: { x: 0, z: 0 }, end: { x: w, z: 0 } };
      const openings = [0.2, 0.45, 0.72].map(t => ({
        center: { x: w * t, z: 0 }, wall,
      }));
      const segs = window.DraftAutoDims.computeAutoDimStrings({
        walls: [], outlines: [{ points: pts, garage: false }], roofs: [], openings,
        offsetOutline, firstOffset: 1.5, jogMergeFt: 2 / 12, stringSpacingFt: 1.5,
      }) || [];
      // The north strings: same z row, more than one segment = a string.
      const rows = new Map();
      segs.filter(s => Math.abs(s.start.z - s.end.z) < 1e-9).forEach(s => {
        const k = s.start.z.toFixed(4);
        rows.set(k, [...(rows.get(k) || []), Math.abs(s.end.x - s.start.x)]);
      });
      const overallRow = [...rows.values()].find(r => r.length === 1);
      const stringRow = [...rows.values()].find(r => r.length > 1);
      if (!overallRow || !stringRow) continue;
      cases++;
      const printedOverall = parse(fmt(overallRow[0] * 12));
      const printedSum = stringRow.reduce((s, v) => s + parse(fmt(v * 12)), 0);
      const drift = Math.abs(printedSum - printedOverall);
      if (drift > 1e-9) {
        bad++;
        if (drift > worst) {
          worst = drift;
          sample = { overall: fmt(overallRow[0] * 12), parts: stringRow.map(v => fmt(v * 12)) };
        }
      }
    }
    return { cases, bad, worst, sample };
  });
  console.log(`${out.bad} of ${out.cases} auto-dim strings print partials that do not add to the printed overall `
    + `(${(out.bad / out.cases * 100).toFixed(1)}%)`);
  console.log(`worst drift ${(out.worst * 16).toFixed(0)}/16" = ${out.worst.toFixed(4)}"`);
  console.log('worst case: overall', out.sample.overall, '| partials', out.sample.parts.join(' + '));
});
