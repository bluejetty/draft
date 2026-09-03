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

// A fingerprint of the WHOLE canvas. Not a colour count: counting pixels at
// the grid's greys measures anti-aliasing as much as it measures the grid,
// and the stray count is environment-dependent -- 1 px locally, 306 in
// another local house, 902 on a CI runner. Two renders that differ only in
// the datum differ only in the grid, so comparing them needs no threshold
// at all.
const canvasHash = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i += 4) {
    h ^= data[i] | (data[i + 1] << 8) | (data[i + 2] << 16);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16)}:${c.width}x${c.height}`;
});

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
  // THREE RENDERS THAT DIFFER ONLY IN THE DATUM, compared to each other.
  //
  // The first version of this counted pixels at the grid's greys and asked for
  // a ratio. It failed on CI and the reason is worth keeping: the no-grid
  // render is not empty, it is anti-aliased wall ink, some of which lands on a
  // grid grey by coincidence. That stray count measured 1 locally, 306 in a
  // different local house and 902 on a runner, so both an absolute threshold
  // and a ratio against it are measuring the environment.
  //
  // These three renders have the same walls, the same fit and the same
  // anti-aliasing. The ONLY thing that can differ between them is the grid.
  // So the assertion is inequality, with no number in it.
  test('the grid appears with a datum and moves with it', async ({ page }) => {
    const saved = await houseOnOldPage(page);
    expect(saved.drawingOrigin,
      'the generated house is never clicked into place, so its datum is null')
      .toBeNull();

    await page.goto('/MODEL.html?mode=night');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
    await expect(page.locator('#readout'),
      'the readout says why, so an absent grid is not a mystery')
      .toContainText('datum none');
    const noDatum = await canvasHash(page);

    // CONTROL, and the test is worthless without it: reloading the same state
    // must repaint the same pixels. If the render were not deterministic,
    // every inequality below would pass for the wrong reason.
    await page.reload();
    await expect(page.locator('#readout')).toContainText('datum none', { timeout: 6000 });
    expect(await canvasHash(page),
      'the same drawing must paint the same pixels twice, or nothing below '
      + 'means anything')
      .toBe(noDatum);

    await rewriteStored(page, "d.drawingOrigin = { x: 0, z: 0 }; return d;");
    await expect(page.locator('#readout')).toContainText('datum 0.00,0.00');
    const atOrigin = await canvasHash(page);
    expect(atOrigin, 'a datum must put a grid on the canvas')
      .not.toBe(noDatum);

    await rewriteStored(page, "d.drawingOrigin = { x: 4, z: -7 }; return d;");
    await expect(page.locator('#readout')).toContainText('datum 4.00,-7.00');
    expect(await canvasHash(page),
      'and the grid must be ANCHORED to the datum -- moving it moves the '
      + 'lines, which is the whole reason the datum exists')
      .not.toBe(atOrigin);
  });

  test('a drawing with no drawingOrigin KEY is back-filled to the world origin',
    async ({ page }) => {
      await houseOnOldPage(page);
      await page.goto('/MODEL.html?mode=night');
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
      const noDatum = await canvasHash(page);

      await rewriteStored(page, "delete d.drawingOrigin; return d;");
      await expect(page.locator('#readout'),
        'absent is not null: an old drawing was made on the world grid')
        .toContainText('0.00,0.00 (world, back-filled)');
      expect(await canvasHash(page),
        'and it gets a grid -- collapsing absent into null with `|| null` '
        + 'would strip the grid from every drawing made before the datum '
        + 'existed, which no fixture can catch')
        .not.toBe(noDatum);
    });
});
