// TIER 2 — MODEL.html paints outlines with drawOutlines2D, the real painter.
//
// The last third of the tier-2 order of work, and the one that was blocked
// longest. drawOutlines2D moved into render-2d.js with the other painters, and
// no page but MODEL.dc.html could call it -- not because of the painter, but
// because three of its env keys resolved to `this._` methods on the old page:
// _outlineSegment, _outlineSegmentCount, _lineControlPoint. All three were pure
// and none of them had a single test. They now live in geometry-2d.js, under
// proto/outline-accessors-harness.js, and this page reads them from there.
//
// WHY THE ASSERTION IS ON THE GARAGE COLOUR AND NOT THE ORDINARY ONE. A level
// outline draws in #5980a6, which is also draw-floor-edge -- the exact colour
// the floors spec measures. An ink count on that cannot tell an outline from a
// slab edge, so it would pass with the painter removed on any drawing that has
// a floor. #7d5ba6 is drawn by nothing else in the repo: it is garageLevel, and
// only drawOutlines2D reaches for it. Measured before relying on it, by
// grepping every file for both hexes.
//
// The control matters as much as the assertion. Ink present proves something
// painted purple; ink absent on the same drawing with the outlines removed
// proves it was THIS painter and not the page's furniture. Absence is evidence
// only when presence was demonstrated under identical conditions.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MAIN_FL = 3;
const BUCKET = 'model-drawing';

// garageLevel, from MODEL.dc.html:7444 and now MODEL.html. Hard-coded rather
// than read off the page: asking the page what colour it used and checking it
// used that colour asserts nothing. If the colour moves, this constant has to
// move with it and the failure names this file.
const GARAGE = [0x7d, 0x5b, 0xa6];

const readout = page => page.locator('#readout');

// WAIT FOR THE COUNT YOU ARE ABOUT TO ASSERT ON, not for the word.
//
// The first draft waited for the readout to CONTAIN 'outlines' -- which is
// useless, because this change is what put that word in the readout, so it is
// there on the first render, before the drawing has finished loading and
// before anything is painted. The assertion then read a count off a readout
// that had not settled and agreed with itself. `main` has hit this exact shape
// before (loadOfb / waitForAutoBeams, which waited for what the test asserts
// rather than for the page to go quiet), and the fix that worked there is the
// one used here: the caller names the number it needs, this waits for exactly
// that, and a timeout says what it saw instead of failing on a later line
// that looks like a painter bug.
async function waitForOutlines(page, expected) {
  await expect(readout(page),
    `readout should settle at outlines ${expected}/n`)
    .toContainText(new RegExp(`outlines ${expected}/`), { timeout: 6000 });
}

const outlineCount = async page => Number(
  (await readout(page).textContent()).match(/outlines (\d+)\//)?.[1] ?? -1);

// Whole canvas, not a sample point. Sampling one pixel and assuming nothing
// else is painted there is how an earlier measurement in this suite went wrong.
async function inkShare(page, rgb) {
  return page.evaluate(target => {
    const canvas = document.querySelector('#plan');
    const { data } = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height);
    let hits = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += 1;
      const d = Math.max(Math.abs(data[i] - target[0]),
        Math.abs(data[i + 1] - target[1]), Math.abs(data[i + 2] - target[2]));
      if (d <= 10) hits += 1;
    }
    return hits / total;
  }, rgb);
}

async function rewriteStored(page, mutate) {
  const changed = await page.evaluate(async ({ bucket, fn }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const applied = new Function('d', fn)(drawing) || drawing;
    const blob = new File([JSON.stringify(applied)], 'drawing.json',
      { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(blob, bucket);
    return applied;
  }, { bucket: BUCKET, fn: mutate });
  return changed;
}

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

// A garage outline on MAIN FL. `garage` is normalised to a strict boolean by
// drawing-format.js:774 -- `outline?.garage === true` -- so the string
// 'attached' that the old page's state uses would arrive here as false and
// paint the ordinary blue, which is a silent wrong answer rather than an error.
const GARAGE_OUTLINE = `
  d.outlines = [{
    id: 'spec-garage', masterId: null, levelId: ${MAIN_FL}, garage: true,
    points: [
      { x: -30, y: 0, z: -30 }, { x: -10, y: 0, z: -30 },
      { x: -10, y: 0, z: -10 }, { x: -30, y: 0, z: -10 },
    ],
  }];
  return d;`;

test.describe('MODEL.html outlines', () => {
  test('a garage outline is drawn by drawOutlines2D, in its own colour',
    async ({ page }) => {
      await houseOnOldPage(page);
      const withOutline = await rewriteStored(page, GARAGE_OUTLINE);

      // The fixture first, so a drawing that stopped carrying the outline
      // fails here rather than making the ink assertion vacuously true.
      expect(withOutline.outlines.length,
        'the fixture must put an outline in the drawing').toBe(1);
      expect(withOutline.outlines[0].garage,
        'and it must be a garage, or it draws in the floor-edge colour').toBe(true);

      await page.goto(`/MODEL.html?level=${MAIN_FL}`);
      await waitForOutlines(page, 1);

      // The level filter, before the pixels. `outlines 0/1` would mean the
      // filter dropped it, which is a different bug from a painter that never
      // ran and would otherwise look identical on the canvas.
      expect(await outlineCount(page),
        'the outline must survive the level filter to be measured').toBe(1);

      // MEASURED, not guessed. With the painter: 0.000443 of the canvas.
      // With the outline removed: 0.000000 -- not "less", none. So the
      // question is presence against total absence, and the threshold only
      // has to be unambiguously off zero while staying an order of magnitude
      // clear of the measurement. 0.00005 is ~57 pixels at this viewport:
      // far more than stray antialiasing, ~9x below what the painter draws.
      // The first draft of this line used 0.0002, which is 45% of the
      // measured value -- a number tuned just past one reading, which is how
      // two earlier canvas checks in this suite went flaky within a day.
      //
      // AND THE STATISTIC ONLY ANSWERS "IS IT THERE". Ink share is not
      // scale-free: fit-to-content picks its zoom from whatever else is in the
      // drawing, so the same outline measured 0.000443, 0.000486 and 0.000680
      // across three runs -- a 50% spread with nothing changed but the
      // fixture's neighbours. Harmless for a question whose other answer is
      // exactly 0 and any positive floor separates them; useless for "how much
      // of the outline drew". A later spec wanting that should count the
      // readout's SHOWN/TOTAL, which does not move with the zoom. Tightening
      // this number toward "all of it" would be reading a quantity out of a
      // statistic that does not carry one. (Skipper's point.)
      const ink = await inkShare(page, GARAGE);
      expect(ink, 'the garage outline must be on the canvas in #7d5ba6')
        .toBeGreaterThan(0.00005);
    });

  test('and nothing paints that colour when the outline is gone',
    async ({ page }) => {
      await houseOnOldPage(page);

      // THE CONTROL. Same drawing, same page, same level -- the outline
      // removed and nothing else touched. If purple survives this, the
      // assertion above was measuring something other than this painter.
      await rewriteStored(page, 'd.outlines = []; return d;');
      await page.goto(`/MODEL.html?level=${MAIN_FL}`);
      await waitForOutlines(page, 0);
      expect(await outlineCount(page), 'the drawing must hold no outlines').toBe(0);

      const ink = await inkShare(page, GARAGE);
      expect(ink, 'no other painter may draw in the garage outline colour')
        .toBe(0);
    });

  test('the level filter drops an outline belonging to another level',
    async ({ page }) => {
      await houseOnOldPage(page);

      // Outlines take rule four -- LEVEL ONLY, no view filter. This is the
      // half of that rule a single-level fixture cannot show: the same drawing
      // read from a different level must not paint it. Without this, a filter
      // that ignored levelId entirely would pass both tests above.
      await rewriteStored(page, GARAGE_OUTLINE);
      await page.goto('/MODEL.html?level=1');
      await waitForOutlines(page, 0);
      expect(await outlineCount(page),
        'an outline on MAIN FL is not on FOUNDATION').toBe(0);
      expect(await inkShare(page, GARAGE),
        'and it must not be painted there either').toBe(0);
    });
});
