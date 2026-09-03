// TIER 2f — MODEL.html draws the DATUM MARKER through drawOrigin2D.
//
// Tier 2d anchored the grid to the datum but never drew the point itself, so
// the drafter got a grid whose origin could only be found by counting squares.
// This is the point Movie described: "that way he always first clicks on 0,0."
//
// The seam this file guards is a colour, and it guards it because wiring this
// painter turned up a defect. drawOrigin2D hardcoded `ctx.strokeStyle =
// '#557a46'` -- the one painter a skinned page could not re-colour. Measured
// against the skins that literal scores 2.94 over the NIGHT floor wash, under
// the 3.0 WCAG non-text floor. And of all the marks on the canvas this is the
// one most likely to be ON a slab: a datum is the drafter's FIRST CLICK, which
// normally lands on the building.
//
// So the painter now reads `env.colors.origin`, and the assertion below is
// that MODEL.html actually supplies it. A page that stopped supplying it would
// still draw a marker -- the old literal is the fallback -- and would look
// completely fine on the day skin. Only night shows the difference.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// palette.js's two draw-origin values, hardcoded. Asking the page which colour
// it used and then checking it used that colour proves nothing.
const NIGHT_GREEN = [0x6a, 0x9a, 0x57];
const DAY_GREEN = [0x55, 0x7a, 0x46];
// Tight enough that the two greens cannot be confused for each other: their
// green channels differ by 32, so a +/-12 window around each is disjoint. Also
// disjoint from draw-shape's greens on both skins, which are the only other
// green ink on the canvas.
const TOL = 12;

const wholeCanvas = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data);
});

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

async function loadWith(page, src, mode = 'night') {
  await page.evaluate(async ({ bucket, src: s }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', s)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src });
  await page.goto(`/MODEL.html?mode=${mode}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
}

// A datum ON the house, which is where a real one is: the drafter's first
// click lands on the building, not out in the empty page.
const AT_DATUM = 'd.drawingOrigin = { x: 0, z: 0 }; return d;';

test.describe('MODEL.html datum marker', () => {
  // THE CROSSOVER, and it needs no threshold. Each skin must paint MORE of its
  // own green than of the other skin's green. One render cannot show that --
  // "some green pixels exist" is true of the broken page too, because the
  // fallback still paints. Two renders and two colours can: if the colour were
  // still hardcoded, BOTH skins would paint #557a46 and the night row below
  // would fail while the day row passed.
  test('the marker is painted in the SKIN\'s green, not the hardcoded one',
    async ({ page }) => {
      await houseOnOldPage(page);

      await loadWith(page, AT_DATUM, 'night');
      await expect(page.locator('#readout')).toContainText('datum 0.00,0.00');
      const night = await wholeCanvas(page);
      const nightOwn = h.countColor(night, NIGHT_GREEN, TOL);
      const nightOther = h.countColor(night, DAY_GREEN, TOL);

      await loadWith(page, AT_DATUM, 'day');
      const day = await wholeCanvas(page);
      const dayOwn = h.countColor(day, DAY_GREEN, TOL);
      const dayOther = h.countColor(day, NIGHT_GREEN, TOL);

      expect(nightOwn,
        'the night skin must paint the marker in the night green -- this is '
        + 'the assertion the hardcoded literal fails')
        .toBeGreaterThan(nightOther);
      expect(dayOwn,
        'and the day skin in the day green. Without this row the test would '
        + 'pass on a page that painted night green unconditionally')
        .toBeGreaterThan(dayOther);
    });

  test('no datum, no marker -- the same three states as the grid',
    async ({ page }) => {
      await houseOnOldPage(page);

      // The generated house is never clicked into place, so it has no datum.
      await loadWith(page, 'return d;', 'night');
      await expect(page.locator('#readout')).toContainText('datum none');
      const without = h.countColor(await wholeCanvas(page), NIGHT_GREEN, TOL);

      await loadWith(page, AT_DATUM, 'night');
      await expect(page.locator('#readout')).toContainText('datum 0.00,0.00');
      const withDatum = h.countColor(await wholeCanvas(page), NIGHT_GREEN, TOL);

      expect(withDatum,
        'a datum puts a marker on the canvas, and an absent datum leaves the '
        + 'page with no green on it at all')
        .toBeGreaterThan(without);
    });
});
