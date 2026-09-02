// Same defect, the common configuration: an ATTACHED garage is slab-on-grade,
// but the MAIN FL framed-floor band is drawn straight across it.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

test('R13: section through a house and its attached garage', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-8, -6], [8, -6], [8, 6], [-8, 6]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
  await page.keyboard.press('Enter');
  for (const [x, z] of [[8, -4], [20, -4], [20, 4], [8, 4]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(500);
  await h.waitForSaved(page);

  await page.keyboard.press('c');
  await h.clickWorld(page, -12, 0);
  await h.clickWorld(page, 26, 0);
  await h.clickWorld(page, 6, -10);
  await page.waitForTimeout(500);
  await page.locator('.cut-row', { hasText: 'S1' }).click();
  await page.waitForTimeout(800);
  await page.locator('[data-model-canvas]').screenshot({ path: '/tmp/fc/section-attached.png' });

  const scan = await page.evaluate(() => {
    const c = document.querySelector('[data-model-overlay]');
    const W = c.width, H = c.height;
    const { data } = c.getContext('2d').getImageData(0, 0, W, H);
    const at = (x, y) => (y * W + x) * 4;
    const band = i => data[i + 3] > 200 && Math.abs(data[i] - 226) < 7
      && Math.abs(data[i + 1] - 232) < 7 && Math.abs(data[i + 2] - 237) < 7;
    const rows = [];
    for (let y = 0; y < H; y++) {
      let run = 0, lo = 0, best = 0, bl = 0, bh = 0;
      for (let x = 0; x < W; x++) {
        if (band(at(x, y))) { if (!run) lo = x; run++; if (run > best) { best = run; bl = lo; bh = x; } }
        else run = 0;
      }
      if (best > 40) rows.push({ y, width: best, lo: bl, hi: bh });
    }
    // Group the rows into bands and report each band's span.
    const bands = [];
    rows.forEach(r => {
      const last = bands[bands.length - 1];
      if (last && r.y - last.y1 <= 2 && Math.abs(r.lo - last.lo) < 6) { last.y1 = r.y; }
      else bands.push({ y0: r.y, y1: r.y, lo: r.lo, hi: r.hi, width: r.width });
    });
    return { W, H, bands };
  });
  console.log('floor assembly bands (y0-y1, x span, px wide):');
  scan.bands.forEach(b => console.log(`   rows ${b.y0}-${b.y1}: x ${b.lo}..${b.hi}  (${b.width} px)`));
  const widths = scan.bands.map(b => b.width);
  // The MAIN FL band must not be wider than the 2ND FL band: the garage has a
  // slab, not a framed floor.
  expect(Math.max(...widths) - Math.min(...widths),
    'the main-floor band runs wider than the storey above it — it is crossing the garage').toBeLessThan(20);
});
