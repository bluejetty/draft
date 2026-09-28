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
