// C1 end to end in the app: trace a house, place windows, AUTO DIMS, then read
// the dimension records back out of the store and print them the way the sheet
// does. Repeats over several footprints until a string fails to add up.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

const FOOTPRINTS = [
  [[-13.37, -9.11], [14.29, -9.11], [14.29, 8.53], [-13.37, 8.53]],
  [[-12.41, -8.07], [13.63, -8.07], [13.63, 9.29], [-12.41, 9.29]],
  [[-14.13, -9.71], [12.87, -9.71], [12.87, 7.43], [-14.13, 7.43]],
  [[-11.09, -7.33], [15.41, -7.33], [15.41, 8.91], [-11.09, 8.91]],
];

test('R27: a printed dimension string that does not add up, in the app', async ({ page }) => {
  test.setTimeout(300000);
  const misses = [];
  for (const pts of FOOTPRINTS) {
    await h.openModel(page);
    await page.evaluate(() => sessionStorage.removeItem('draft-test-storage-cleared'));
    await h.selectTool(page, 'Outline');
    for (const [x, z] of pts) await h.clickWorld(page, x, z);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    await h.climbTourToMain(page);
    await h.selectTool(page, 'Outline');
    await page.locator('[data-build-house]').click();
    await page.waitForTimeout(600);
    await h.waitForSaved(page);
    const zTop = pts[0][1];
    await h.selectTool(page, 'Fenestration');
    for (const x of [pts[0][0] + 5, (pts[0][0] + pts[1][0]) / 2, pts[1][0] - 5]) {
      await h.clickWorld(page, x, zTop);
      await page.waitForTimeout(200);
    }
    await h.waitForSaved(page);
    await h.selectTool(page, 'Dimension');
    await page.getByRole('button', { name: 'AUTO DIMS' }).click();
    await h.waitForSaved(page);

    const rows = await page.evaluate(async bucket => {
      const f = await window.SharedFileStore.loadSharedFile(bucket);
      const d = JSON.parse(await f.text());
      const fmt = window.DraftFormatters.formatArchitecturalInches;
      const parse = t => window.DraftFormatters.parseArchitecturalLength(t).inches;
      const main = d.levels.find(l => l.name === 'MAIN FL').id;
      const byRow = new Map();
      d.dimensions.filter(x => x.auto && x.levelId === main
        && Math.abs(x.start.z - x.end.z) < 1e-9).forEach(x => {
          const k = x.start.z.toFixed(4);
          byRow.set(k, [...(byRow.get(k) || []), Math.abs(x.end.x - x.start.x)]);
        });
      const rows = [...byRow.values()];
      const overall = rows.find(r => r.length === 1);
      if (!overall) return null;
      const printedOverall = fmt(overall[0] * 12);
      return rows.filter(r => r.length > 1).map(r => ({
        parts: r.map(v => fmt(v * 12)),
        sum: r.reduce((s, v) => s + parse(fmt(v * 12)), 0),
        overall: printedOverall,
        overallIn: parse(printedOverall),
      }));
    }, h.STORAGE_BUCKET);

    (rows || []).forEach(r => {
      const drift = Math.abs(r.sum - r.overallIn);
      const line = `${r.parts.join(' + ')}  =  ${(r.sum / 12 | 0)}'-${(r.sum % 12).toFixed(4)}"   vs overall ${r.overall}`;
      if (drift > 1e-9) { misses.push(line + `   DRIFT ${(drift * 16).toFixed(0)}/16"`); console.log('MISMATCH: ' + line + `   DRIFT ${(drift * 16).toFixed(0)}/16"`); }
      else console.log('adds up : ' + line);
    });
  }
  console.log(`\n${misses.length} strings that do not add up, across ${FOOTPRINTS.length} houses`);
});
