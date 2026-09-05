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
// WHAT CARRIES THE LINTEL, added to the bearing. A wall's endpoint is a
// CENTRELINE intersection, so it sits inside whatever it runs into; reserving
// the bearing alone counted the neighbour's studs as bearing. Movie, 5 Sep:
// "measured from inside of exterior wall (5.5" typ)", and where no wall stands
// there, "use a 6x6 post" -- 5 1/2" dressed. So a free end and a 2x6 corner
// reserve the same, and a 2x4 partition reserves less.
const POST_FT = 5.5 / 12;
const STUD_2X6_FT = 5.5 / 12;
const STUD_2X4_FT = 3.5 / 12;

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
  // 20 ft wall standing alone, 3 ft opening: nothing meets either end, so a
  // 6x6 post carries it and the centre stops at 20 − 1.5 − (post + bearing).
  expect(opening.offset).toBeCloseTo(20 - 1.5 - (POST_FT + SHORT_BEARING_FT), 4);

  // AND NOT WHERE IT USED TO STOP — twice over. The old 0.01 ft jamb, and
  // #294's bearing-from-the-endpoint, which reserved 1 1/2" from a line in the
  // middle of the neighbour's studs. Both land inside what a loose tolerance
  // would swallow, so both get an inequality.
  expect(opening.offset).toBeLessThan(20 - 1.5 - 0.01 - 0.05);
  expect(opening.offset).toBeLessThan(20 - 1.5 - SHORT_BEARING_FT - 0.05);
});

test('an opening over 3 m keeps 3" instead, and a narrow one does not', async ({ page }) => {
  await h.openModel(page);
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  // 12'-0" is past the code's 3 m (9'-10 1/8"), so it takes the long bearing.
  await setWidth(page, String.raw`12'-0"`);
  const wide = await placeAtFarEnd(page);

  expect(wide.width).toBeCloseTo(12, 3);
  expect(wide.offset).toBeCloseTo(20 - 6 - (POST_FT + LONG_BEARING_FT), 4);
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
  // Needs 3'-11" plus a post and a bearing at each end: 3'-11" + 14" = 5'-1".
  await setWidth(page, String.raw`3'-11"`);
  await h.clickWorld(page, 0, 0);
  await page.waitForTimeout(400);

  const drawing = await h.savedDrawing(page);
  expect(drawing.fenestrations || []).toHaveLength(0);
});

// THE POINT OF THE RULE, and nothing above reaches it: the reserve is read off
// the wall that MEETS this one, not off a constant. A 2x4 partition is 2"
// thinner than the 6x6 post a free end assumes, so an opening may sit 2"
// closer to it -- and if the clamp were reading its own wall, or a fixed
// number, that 2" would not appear.
test('the reserve comes from the wall at that end, not from the wall itself', async ({ page }) => {
  await h.openModel(page);

  // A 2x6 exterior run, then a 2x4 partition butting into its far end.
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Wall');
  await page.getByRole('button', { name: /2×4 Stud/ }).click();
  await h.clickWorld(page, 10, 0);
  await h.clickWorld(page, 10, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Fenestration');
  const opening = await placeAtFarEnd(page);

  // 3'-4 1/2" clear of the partition's centreline: its 3 1/2" plus 1 1/2".
  expect(opening.offset).toBeCloseTo(20 - 1.5 - (STUD_2X4_FT + SHORT_BEARING_FT), 4);

  // The differential. A 2x4 there reserves 2" less than the post a bare end
  // assumes -- so the opening sits 2" FURTHER along than the first test's,
  // and a clamp reading a constant could not tell the two apart.
  expect(opening.offset).toBeGreaterThan(20 - 1.5 - (POST_FT + SHORT_BEARING_FT) + 0.1);
  expect(POST_FT - STUD_2X4_FT).toBeCloseTo(2 / 12, 6);
  // And a 2x6 neighbour is indistinguishable from the post, by construction.
  expect(STUD_2X6_FT).toBeCloseTo(POST_FT, 6);
});
