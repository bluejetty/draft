// A WINDOW SAYS ITS SIZE ON THE PLAN, OUTSIDE THE WALL AND ALONG IT.
//
// Movie, 28 Sep: *"make the windows on the floor plans and on the elevations
// size : \"36 X 42\" width by height in inches"*, *"mark the window on ext side
// of window paralel with the window"*, *"(don't need the letter for the
// window)"*, and *"i want it to match the actual size of the window"*.
//
// THIS PAGE DREW NO TAG AT ALL, and three separate things had to be true
// before one appeared -- each of which failed SILENTLY:
//
//   fen-labels.js was never loaded here. paintWindowSizes guards on
//   DraftFenLabels and returned on every window, throwing nothing.
//
//   ctx, toS and R are locals of the paint pass. A helper written at module
//   level that reached for them found nothing.
//
//   houseOutlineOn hands back `{ points }`, not an array, so an Array.isArray
//   guard rejected every outline and the exterior normal came back null.
//
// A PICTURE PROVED NONE OF IT. The plan looked the same in all four states,
// which is why this counts the text the canvas is actually asked to paint.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));

async function openWithTags(page) {
  await h.suppressEntryCoach(page);
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/MODEL.html');
  // THE TAPE IS TAKEN BEFORE THE FIRST PAINT, so nothing is missed, and a
  // resize forces one more in case the drawing landed first.
  await page.evaluate(() => {
    window.__tags = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      window.__tags.push(String(text));
      return orig.call(this, text, x, y);
    };
  });
  await page.waitForTimeout(2000);
  await page.setViewportSize({ width: 1360, height: 764 });
  await page.waitForTimeout(1000);
}

test('every window on the plan is tagged with its size in inches', async ({ page }) => {
  await openWithTags(page);
  const seen = await page.evaluate(() => ({
    all: window.__tags.length,
    sizes: [...new Set(window.__tags.filter(t => /^\d+ X \d+$/.test(t)))],
  }));
  expect(seen.all, 'the plan painted text at all').toBeGreaterThan(0);
  // THE FIXTURE'S WINDOWS ARE 4 FT WIDE with a 2'-10" sill and a 7'-0" head,
  // so 48 by 50 is the arithmetic done in inches -- and it is the window's
  // OWN size, not a rung of the stock ladder, which carries no 48x50.
  expect(seen.sizes, 'the size reads width X height, in inches, with no letter')
    .toContain('48 X 50');
});

test('the tag is the size, not the old W-ladder name', async ({ page }) => {
  await openWithTags(page);
  const lettered = await page.evaluate(() =>
    window.__tags.filter(t => /^W ?\d+ ?[xX] ?\d+$/.test(t)));
  expect(lettered, 'no window tag carries a W any more').toEqual([]);
});

test('the formatter reads a window off its own record, unsnapped', async ({ page }) => {
  await h.suppressEntryCoach(page);
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => !!window.DraftFenLabels, null, { timeout: 15000 });
  const labels = await page.evaluate(() => {
    const FL = window.DraftFenLabels;
    return {
      // A 37 x 49 is off every rung of the stock ladder. The sheet says what
      // was drawn, not what could have been ordered.
      odd: FL.fenLabelForOpening(
        { type: 'window', width: 37 / 12, sillHeight: 1, headHeight: 1 + 49 / 12 },
        { exteriorWall: true }),
      // A DOOR KEEPS ITS LADDER NAME. Only the window lost its letter.
      door: FL.fenLabelForOpening(
        { type: 'door', width: 3, headHeight: (6 * 12 + 8) / 12 }, { exteriorWall: true }),
    };
  });
  expect(labels.odd).toBe('37 X 49');
  expect(labels.door).toBe('ED36');
});

// ── AND THE DRAFTER CAN TURN THEM OFF ─────────────────────────────────────
//
// Movie, 30 Sep: *"i think i put them on layer A-DIMS-FENS but if i want to
// turn of the outside line dimensions and leave the window sizes on i won't
// be able too"*. The tags moved to A-DIMS-WIN for that, and the elevations
// honoured it the same day -- cut-view-env.js builds the lookup for
// Construction Layout and EXT. FINISH.
//
// THIS PAGE HONOURED NOTHING. The plan tag had no layer gate of any kind, so
// the one place a drafter actually draws was the one place the tick did not
// reach: unticking A-DIMS-WIN hid the size on every printed elevation and
// left it on the plan in front of him.
//
// THE GESTURE IS THE REAL ONE -- the tick in STANDARDS, not a seeded
// localStorage key. What is being checked is that the two pages agree about
// a layer, and a test that writes the storage itself has assumed the half of
// that which can be wrong.
//
// BOTH COUNTS IN ONE TEST, because "no tags" is what an empty drawing says
// too. The baseline is taken first, on the same fixture in the same session,
// so the second reading is a claim about the tick rather than about the
// house.
async function sizeTags(page) {
  return page.evaluate(() => window.__tags.filter(t => /^\d+ X \d+$/.test(t)));
}

// A FRESH TAPE PER VISIT. The patch is on the context prototype and a
// navigation throws that realm away, so a tape installed before the trip to
// STANDARDS would come back empty and read as "the tags are gone".
async function retape(page, width) {
  await page.evaluate(() => {
    window.__tags = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      window.__tags.push(String(text));
      return orig.call(this, text, x, y);
    };
  });
  await page.waitForTimeout(2000);
  // A DIFFERENT WIDTH FROM THE LAST ONE, deliberately: setting the size it
  // already has fires no resize, and the forced repaint is the whole reason
  // this line is here.
  await page.setViewportSize({ width, height: 764 });
  await page.waitForTimeout(1000);
}

test('unticking A-DIMS-WIN takes every size tag off the plan', async ({ page }) => {
  await openWithTags(page);
  const before = await sizeTags(page);
  expect(before.length,
    'no size tags to begin with, so hiding them would prove nothing')
    .toBeGreaterThan(0);

  await page.goto('/STANDARDS.html');
  await expect(page.locator('#groups .group')).toHaveCount(7);
  await page.locator('[data-layer-visible="A-DIMS-WIN"]').uncheck();
  await expect(page.locator('#status')).toContainText('hidden');

  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  await retape(page, 1362);
  const after = await sizeTags(page);
  expect(after, 'the plan kept its window sizes after the layer was hidden')
    .toEqual([]);
});

test('and the corner-string layer does not take them with it', async ({ page }) => {
  await openWithTags(page);
  const before = await sizeTags(page);
  expect(before.length, 'no size tags to begin with').toBeGreaterThan(0);

  // THE HALF THAT WAS THE BUG. A-DIMS-FENS is the string locating centres
  // from the corners; dropping it must leave the sizes exactly where they
  // were, which is the whole reason the two are different layers.
  await page.goto('/STANDARDS.html');
  await expect(page.locator('#groups .group')).toHaveCount(7);
  await page.locator('[data-layer-visible="A-DIMS-FENS"]').uncheck();
  await expect(page.locator('#status')).toContainText('hidden');

  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  await retape(page, 1362);
  const after = await sizeTags(page);
  expect(after.sort(), 'hiding the corner string took the window sizes with it')
    .toEqual(before.sort());
});

// ── AND THE ELEVATION THIS PAGE DRAWS ITSELF ──────────────────────────────
//
// Not the rail's thumbnails -- a full-size E1 on the main canvas, which is
// what MODEL paints when a cut is the active view (`drawCutView(cutEnv()...)`
// at :3917). It is the SAME painter the Construction Layout uses, and that
// one has honoured the tick since cut-view-env.js built it a lookup. This
// page handed the painter no lookup at all, so the identical elevation
// answered differently depending on which page it was drawn from.
//
// THE RAIL SEATS ARE NOT THE SUBJECT and would not have caught it: cut-view
// drops a tag wider than the glass it names (`wide + 4 <= ow`), so a
// thumbnail an inch across carries none either way.
test('the elevation this page draws honours the same tick', async ({ page }) => {
  await openWithTags(page);
  await page.goto('/MODEL.html?view=cut%3AE1');
  await retape(page, 1362);
  const before = await sizeTags(page);
  expect(before.length,
    'no size tags on E1 to begin with, so hiding them would prove nothing')
    .toBeGreaterThan(0);

  await page.goto('/STANDARDS.html');
  await expect(page.locator('#groups .group')).toHaveCount(7);
  await page.locator('[data-layer-visible="A-DIMS-WIN"]').uncheck();
  await expect(page.locator('#status')).toContainText('hidden');

  await page.goto('/MODEL.html?view=cut%3AE1');
  await retape(page, 1364);
  const after = await sizeTags(page);
  expect(after, 'the elevation kept its window sizes after the layer was hidden')
    .toEqual([]);
});
