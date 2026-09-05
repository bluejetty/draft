// AN OPENING KEEPS ITS BEARING BACK FROM THE END OF ITS WALL.
//
// NBC Table 9.23.12.3.-A note (4): 38 mm bearing for lintel spans up to 3 m,
// 76 mm over — 1½" and 3". Until this landed, _clampOpeningToWall reserved
// 0.01 ft, an eighth of an inch, so a window could sit hard against a corner
// with no wood under the lintel to carry it.
//
// Movie gave 3" from the yard before either of us opened the code book.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const SHORT_BEARING_FT = 1.5 / 12;
const LONG_BEARING_FT = 3 / 12;

// 20 ft of wall, drawn from x = -10 to x = 10.
async function drawWall(page) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function setWidth(page, text) {
  const box = page.getByLabel('Opening width');
  await box.fill(text);
  await box.blur();
  await page.waitForTimeout(200);
}

// Clicking past the end of the wall asks for an opening that cannot sit there;
// the clamp slides it in. WHERE it stops is the whole rule.
async function placeAtFarEnd(page) {
  await h.clickWorld(page, 10, 0);
  await h.waitForSaved(page);
  const drawing = await h.savedDrawing(page);
  expect(drawing.fenestrations).toHaveLength(1);
  return drawing.fenestrations[0];
}

test('a 3\'-0" door keeps 1 1/2" of bearing at the wall end', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  const opening = await placeAtFarEnd(page);

  expect(opening.width).toBeCloseTo(3, 5);
  // 20 ft wall, 3 ft opening: centre stops at 20 − 1.5 − bearing.
  expect(opening.offset).toBeCloseTo(20 - 1.5 - SHORT_BEARING_FT, 4);

  // AND NOT WHERE IT USED TO STOP. Without this the assertion above passes on
  // the old 0.01 ft jamb too — the two land 1 3/8" apart, which is well inside
  // what a "close enough" tolerance would swallow.
  expect(opening.offset).toBeLessThan(20 - 1.5 - 0.01 - 0.05);
});

test('an opening over 3 m keeps 3" instead, and a narrow one does not', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  // 12'-0" is past the code's 3 m (9'-10 1/8"), so it takes the long bearing.
  await setWidth(page, String.raw`12'-0"`);
  const wide = await placeAtFarEnd(page);

  expect(wide.width).toBeCloseTo(12, 3);
  expect(wide.offset).toBeCloseTo(20 - 6 - LONG_BEARING_FT, 4);
  // The inequality that makes it mean something: the wide opening is held
  // further back than the narrow one, not merely held back.
  expect(LONG_BEARING_FT).toBeGreaterThan(SHORT_BEARING_FT);
});

test('a wall too short for the opening plus both bearings refuses it', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -2, 0);   // 4 ft of wall
  await h.clickWorld(page, 2, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Fenestration');
  await setWidth(page, String.raw`3'-11"`);   // needs 3'-11" + 3" of bearing = 4'-2"
  await h.clickWorld(page, 0, 0);
  await page.waitForTimeout(400);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fenestrations || []).toHaveLength(0);
});
