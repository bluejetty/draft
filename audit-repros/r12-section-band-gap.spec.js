// The section path bands each floor level from the leftmost to the rightmost
// wall CROSSED BY THE CUT, on that level — with no regard for which building
// the wall belongs to (MODEL.dc.html:8709-8712, :8789-8800). A section that
// cuts through both the house and a DETACHED garage should show two separate
// floor assemblies with open air between them.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R12: a section through a house and a detached garage', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-8, -6], [8, -6], [8, 6], [-8, 6]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(400);
  await h.waitForSaved(page);

  // A detached garage 6 ft east of the house, on the same levels.
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /DETACHED GARAGE/ }).click();
  for (const [x, z] of [[14, -5], [26, -5], [26, 5], [14, 5], [14, -5]]) await h.clickWorld(page, x, z);
  await expect(page.locator('[data-detached-foundation-prompt]')).toBeVisible();
  await page.locator('[data-detached-grade-beam]').click();
  await h.waitForSaved(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(400);
  await h.waitForSaved(page);

  // A cut straight THROUGH both buildings, viewer to the south.
  await page.keyboard.press('c');
  await h.clickWorld(page, -12, 0);
  await h.clickWorld(page, 30, 0);
  await h.clickWorld(page, 9, -10);
  await page.waitForTimeout(500);
  await page.locator('.cut-row', { hasText: 'S1' }).click();
  await page.waitForTimeout(800);

  await page.locator('[data-model-canvas]').screenshot({ path: '/tmp/fc/section-house-garage.png' });
  const scan = await page.evaluate(() => {
    const canvas = document.querySelector('[data-model-overlay]');
    const W = canvas.width, H = canvas.height;
    const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
    const at = (x, y) => (y * W + x) * 4;
    // The floor assembly band: rgba(89,128,166,0.15) over the #fafafa sheet.
    const band = i => data[i + 3] > 200
      && Math.abs(data[i] - 226) < 7 && Math.abs(data[i + 1] - 232) < 7 && Math.abs(data[i + 2] - 237) < 7;
    const dark = i => data[i + 3] > 150 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
    // Rows that carry band pixels, and how wide the widest band run is.
    let bestRow = -1, bestRun = 0, bestLo = 0, bestHi = 0;
    for (let y = 0; y < H; y++) {
      let run = 0, lo = 0;
      for (let x = 0; x < W; x++) {
        if (band(at(x, y))) { if (run === 0) lo = x; run++; if (run > bestRun) { bestRun = run; bestRow = y; bestLo = lo; bestHi = x; } }
        else run = 0;
      }
    }
    // Where are the two buildings? Columns carrying dark ink high on the sheet.
    const cols = [];
    for (let x = 0; x < W; x++) {
      for (let y = 24; y < H * 0.6; y++) if (dark(at(x, y))) { cols.push(x); break; }
    }
    let gapLo = 0, gapHi = 0;
    for (let k = 1; k < cols.length; k++) {
      if (cols[k] - cols[k - 1] > gapHi - gapLo) { gapLo = cols[k - 1]; gapHi = cols[k]; }
    }
    // Band pixels strictly inside the gap between the two buildings.
    let bandInGap = 0;
    for (let y = 0; y < H; y++) {
      for (let x = gapLo + 6; x < gapHi - 6; x++) if (band(at(x, y))) bandInGap++;
    }
    // Every band run on the widest band row, and every dark (wall) run.
    const runsOn = (y, pred) => {
      const out = []; let run = 0, lo = 0;
      for (let x = 0; x < W; x++) {
        if (pred(at(x, y))) { if (run === 0) lo = x; run++; }
        else { if (run > 2) out.push([lo, x - 1]); run = 0; }
      }
      if (run > 2) out.push([lo, W - 1]);
      return out;
    };
    const bandRuns = bestRow >= 0 ? runsOn(bestRow, band) : [];
    const inked = i => data[i + 3] > 0 && data[i] < 215 && data[i + 1] < 215 && data[i + 2] < 215;
    // 40 px above the band row is inside the storey: the cut walls stand there.
    const wallRuns = bestRow >= 0 ? runsOn(bestRow - 40, inked) : [];
    return { W, H, bestRow, bestRun, bestLo, bestHi, gapLo, gapHi, bandInGap, bandRuns, wallRuns };
  });
  console.log('canvas', scan.W + 'x' + scan.H);
  console.log('widest floor-band run:', scan.bestRun, 'px at row', scan.bestRow, `(x ${scan.bestLo}..${scan.bestHi})`);
  console.log('gap between the buildings: x', scan.gapLo, '..', scan.gapHi, `(${scan.gapHi - scan.gapLo} px)`);
  console.log('floor-band pixels inside that gap:', scan.bandInGap);
  console.log('band runs on that row:', JSON.stringify(scan.bandRuns));
  console.log('wall runs on that row:', JSON.stringify(scan.wallRuns));
  expect(scan.gapHi - scan.gapLo, 'the two buildings are separated on the sheet').toBeGreaterThan(20);
  expect(scan.bandInGap, 'no floor assembly may span the open ground between two buildings').toBeLessThan(20);
});
