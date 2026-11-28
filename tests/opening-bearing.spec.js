// AN OPENING KEEPS ITS BEARING BACK FROM THE END OF ITS WALL.
//
// NBC Table 9.23.12.3.-A note (4): 38 mm bearing for lintel spans up to 3 m,
// 76 mm over — 1½" and 3". Until this landed, _clampOpeningToWall reserved
// 0.01 ft, an eighth of an inch, so a window could sit hard against a corner
// with no wood under the lintel to carry it.
//
// Movie gave 3" from the yard before either of us opened the code book.
//
// Moved from the old page (MODEL.dc.html) to MODEL.html, 28 Nov 2026. The
// rule lives in geometry-2d.js clampOpeningToWall, which both pages call.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const SHORT_BEARING_FT = 1.5 / 12;
const LONG_BEARING_FT = 3 / 12;
const POST_FT = 5.5 / 12;
const STUD_2X6_FT = 5.5 / 12;
const STUD_2X4_FT = 3.5 / 12;
const MAIN_FL = 3;
const V = (x, z) => ({ x, y: 0, z });
const wall = (id, start, end, wallType = 'stud_2x6') => ({ id, start, end, levelId: MAIN_FL,
  view: 'plan', wallType, baseHeight: 0, topHeight: 8, refLine: 'left' });

const base = walls => ({
  version: 1,
  levels: [{ id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  board: 'drafting',
  walls,
  // A FRAME LINE well clear of the walls, so the plan fits wide enough for a
  // press near a wall end to land on the canvas rather than under a pane.
  lines: [{ id: 1, levelId: MAIN_FL, view: 'plan', start: V(-30, -20), end: V(30, -20) }],
  floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

// 20 ft of wall, from x = -10 to x = 10, standing alone.
const lone = () => base([wall('w', V(-10, 0), V(10, 0))]);

async function open(page, file) {
  await h.openEditor(page, { drawing: file, url: '/MODEL.html?left=1&lpane=build&right=1', webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.showLeftPane(page, 'build');
  await page.locator('[data-tool-key="fenestration"]').click();
}

async function setWidth(page, text) {
  const box = page.locator('[data-prop-field="width"]');
  await box.fill(text);
  await box.press('Enter');
  await page.waitForTimeout(150);
}

async function pressAt(page, x, z) {
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(150);
}

async function saved(page) {
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  return h.savedDrawing(page);
}

// A press at the very end of the wall asks for an opening that cannot sit
// there; the clamp slides it in. WHERE it stops is the whole rule.
async function placeAtFarEnd(page) {
  await pressAt(page, 9, 0);
  const drawing = await saved(page);
  expect(drawing.fenestrations).toHaveLength(1);
  return drawing.fenestrations[0];
}

test('a 3\'-0" door keeps 1 1/2" of bearing at the wall end', async ({ page }) => {
  await open(page, lone());
  const opening = await placeAtFarEnd(page);

  expect(opening.width).toBeCloseTo(3, 5);
  // 20 ft wall standing alone, 3 ft opening: nothing meets either end, so a
  // 6x6 post carries it and the centre stops at 20 - 1.5 - (post + bearing).
  expect(opening.offset).toBeCloseTo(20 - 1.5 - (POST_FT + SHORT_BEARING_FT), 4);
  // And not the old 0.01 ft jamb, nor a bearing measured from the endpoint.
  expect(opening.offset).toBeLessThan(20 - 1.5 - 0.01 - 0.05);
  expect(opening.offset).toBeLessThan(20 - 1.5 - SHORT_BEARING_FT - 0.05);
});

test('an opening over 3 m keeps 3" instead, and a narrow one does not', async ({ page }) => {
  await open(page, lone());
  // 12'-0" is past the code's 3 m (9'-10 1/8"), so it takes the long bearing.
  await setWidth(page, String.raw`12'-0"`);
  const wide = await placeAtFarEnd(page);

  expect(wide.width).toBeCloseTo(12, 3);
  expect(wide.offset).toBeCloseTo(20 - 6 - (POST_FT + LONG_BEARING_FT), 4);
  expect(LONG_BEARING_FT).toBeGreaterThan(SHORT_BEARING_FT);
});

test('a wall too short for the opening plus both bearings refuses it', async ({ page }) => {
  await open(page, base([wall('w', V(-2, 0), V(2, 0))]));   // 4 ft of wall
  // Needs 3'-11" plus a post and a bearing at each end: 3'-11" + 14" = 5'-1".
  await setWidth(page, String.raw`3'-11"`);
  await pressAt(page, 0, 0);

  const drawing = await saved(page);
  expect(drawing.fenestrations || []).toHaveLength(0);
});

// THE POINT OF THE RULE: the reserve is read off the wall that MEETS this
// one, not off a constant. A 2x4 partition is 2" thinner than the 6x6 post a
// free end assumes, so an opening may sit 2" closer to it.
test('the reserve comes from the wall at that end, not from the wall itself', async ({ page }) => {
  await open(page, base([
    wall('w', V(-10, 0), V(10, 0)),
    wall('p', V(10, 0), V(10, 8), 'stud_2x4'),
  ]));
  const opening = await placeAtFarEnd(page);

  // 3'-4 1/2" clear of the partition's centreline: its 3 1/2" plus 1 1/2".
  expect(opening.offset).toBeCloseTo(20 - 1.5 - (STUD_2X4_FT + SHORT_BEARING_FT), 4);
  expect(opening.offset).toBeGreaterThan(20 - 1.5 - (POST_FT + SHORT_BEARING_FT) + 0.1);
  expect(POST_FT - STUD_2X4_FT).toBeCloseTo(2 / 12, 6);
  expect(STUD_2X6_FT).toBeCloseTo(POST_FT, 6);
});
