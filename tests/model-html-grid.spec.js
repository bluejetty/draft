// TIER 2d — MODEL.html draws the grid with drawGrid2D, anchored to the DATUM.
//
// Tier 1 hand-rolled a grid that drew ALWAYS, aligned to world 0,0. That was a
// divergence from the product, not a feature. The datum is the drafter's zero:
// MODEL.dc.html sets state.drawingOrigin from their first click, so the point
// they start on reads as 0,0 from then on. Movie, 3 Sep: "that way he always
// first clicks on 0,0."
//
// No click, no datum, and NO GRID -- already asserted for the old page by
// tests/registration-grid.spec.js ("an untouched model space draws no grid,
// and the first node sets the datum"). This file asserts the same of the new
// one, plus the case neither fixture can reach:
//
//   ABSENT and NULL mean different things (MODEL.dc.html:5160). A drawing made
//   before the datum existed has no `drawingOrigin` key at all; it was drawn on
//   the world grid, so 0,0 leaves every coordinate where it is. An explicit
//   null means "no origin yet". Collapsing them with `|| null` strips the grid
//   from every old drawing, and no fixture would catch it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// palette.js's three night grid weights, hardcoded: asking the page which
// colours it used and then checking it used them proves nothing.
const NIGHT_GRID = [[0x26, 0x29, 0x2a], [0x34, 0x38, 0x3a], [0x45, 0x4a, 0x4c]];

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

const gridPixels = page => page.evaluate(list => {
  const c = document.getElementById('plan');
  const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (list.some(t => Math.max(Math.abs(data[i] - t[0]), Math.abs(data[i + 1] - t[1]),
      Math.abs(data[i + 2] - t[2])) <= 2)) n += 1;
  }
  return n;
}, NIGHT_GRID);

// Rewrite the stored drawing, then reload. MODEL.html only reads, so this goes
// through the store directly.
async function rewriteStored(page, fn) {
  await page.evaluate(async ({ bucket, src }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', src)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src: fn });
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
}

test.describe('MODEL.html grid', () => {
  // ONE test, self-controlled: the SAME page, the same walls, the same fit,
  // measured with and without a datum. That matters because an absolute pixel
  // count is not stable here -- night ink anti-aliasing onto the night ground
  // passes THROUGH the grid greys, so the no-grid render scored 1 px in one
  // house and 306 in another. Counting colours cannot tell a manufactured
  // grey from a painted one; a ratio against the same scene can.
  test('no datum means no grid, and a datum brings one', async ({ page }) => {
    const saved = await houseOnOldPage(page);
    // Control: only meaningful while the fixture really has no datum.
    expect(saved.drawingOrigin,
      'the generated house is never clicked into place, so its datum is null')
      .toBeNull();

    await page.goto('/MODEL.html?mode=night');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
    await expect(page.locator('#readout'),
      'the readout says why, so an absent grid is not a mystery')
      .toContainText('datum none');
    const without = await gridPixels(page);

    await rewriteStored(page, "d.drawingOrigin = { x: 4, z: -7 }; return d;");
    await expect(page.locator('#readout')).toContainText('datum 4.00,-7.00');
    const withDatum = await gridPixels(page);

    // MEASURED: 6,418 with a datum against 1-306 without, so the ratio runs
    // 21x at worst and 6,000x at best. Ten is clear of the bad end.
    expect(withDatum, "the grid is painted in the skin's own three greys")
      .toBeGreaterThan(2000);
    expect(withDatum, 'and a datum must change the picture by an order of '
      + 'magnitude, not by a handful of anti-aliased pixels')
      .toBeGreaterThan(without * 10);
  });

  test('a drawing with no drawingOrigin KEY is back-filled to the world origin',
    async ({ page }) => {
      await houseOnOldPage(page);
      await page.goto('/MODEL.html?mode=night');
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
      await rewriteStored(page, "delete d.drawingOrigin; return d;");
      await expect(page.locator('#readout'),
        'absent is not null: an old drawing was made on the world grid')
        .toContainText('0.00,0.00 (world, back-filled)');
      expect(await gridPixels(page),
        'and it gets a grid -- collapsing absent into null with `|| null` '
        + 'would strip the grid from every drawing made before the datum '
        + 'existed, which no fixture can catch')
        .toBeGreaterThan(2000);
    });
});
