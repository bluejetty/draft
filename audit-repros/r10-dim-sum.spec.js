// The plan examiner's first check: do the partial dimensions add up to the
// overall? Every dim is printed independently rounded to 1/16".
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R10: auto-dim partials vs the overall, as printed', async ({ page }) => {
  await h.openModel(page);
  // A hand-traced house: corners land where the finger lands, like a real one.
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-13.37, -9.11], [14.29, -9.11], [14.29, 8.53], [-13.37, 8.53], [-13.37, -9.11]])
    await h.clickWorld(page, x, z);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  // Openings so the closest string has partials.
  await h.selectTool(page, 'Fenestration');
  for (const [x, z] of [[-6, -9.11], [2, -9.11], [9, -9.11]]) { await h.clickWorld(page, x, z); await page.waitForTimeout(200); }
  await h.waitForSaved(page);
  await h.selectTool(page, 'Dimension');
  await page.getByRole('button', { name: 'AUTO DIMS' }).click();
  await h.waitForSaved(page);

  const report = await page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    const d = JSON.parse(await f.text());
    const fmt = window.DraftFormatters.formatArchitecturalInches;
    const parse = window.DraftFormatters.parseArchitecturalLength;
    const main = d.levels.find(l => l.name === 'MAIN FL').id;
    const dims = d.dimensions.filter(x => x.auto && x.levelId === main);
    // Group the horizontal strings by the z they are drawn at.
    const byRow = new Map();
    dims.forEach(x => {
      if (Math.abs(x.start.z - x.end.z) > 0.001) return;      // horizontal only
      const key = x.start.z.toFixed(3);
      if (!byRow.has(key)) byRow.set(key, []);
      byRow.get(key).push(x);
    });
    const rows = [];
    byRow.forEach((segs, z) => {
      const total = segs.reduce((s, x) => s + Math.abs(x.end.x - x.start.x), 0);
      const printed = segs.map(x => fmt(Math.abs(x.end.x - x.start.x) * 12));
      const printedSumIn = printed.reduce((s, t) => s + parse(t).inches, 0);
      rows.push({ z, n: segs.length, printed, trueIn: +(total * 12).toFixed(4), printedSumIn });
    });
    return rows.sort((a, b) => a.z - b.z);
  }, h.STORAGE_BUCKET);

  report.forEach(r => console.log(
    `row z=${r.z}  ${r.n} seg  printed [${r.printed.join(' + ')}]  = ${r.printedSumIn}"  (true span ${r.trueIn}")`));
  const overall = report.find(r => r.n === 1);
  const stringed = report.filter(r => r.n > 1);
  stringed.forEach(r => {
    const drift = Math.abs(r.printedSumIn - overall.printedSumIn);
    console.log(`  string of ${r.n} reads ${r.printedSumIn}" vs the overall's ${overall.printedSumIn}" — drift ${drift.toFixed(4)}" (${(drift * 16).toFixed(2)}/16)`);
  });
});
