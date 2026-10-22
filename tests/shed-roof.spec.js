// A SINGLE SLOPE ROOF, DRAWN BY HAND ON A STOREY.
//
// Movie, 21 Oct: "when i click on the ROOF command now, nothing really
// happens, instead, lets make a POPUP ... option 1 - simple 1 slope roof",
// then three steps -- the wall line it sits on ("line 1 shows where the wall
// under the roof is located"), the EAVE side ("the DIRECTION OF SLOPE"), and
// the outline from above ("the user will need to draw their eave overhang,
// shape of the roof (looking down from above)"); the PROJECT's pitch to start
// ("they can change it"); drawn on the 2nd floor, shown there and on the ROOF
// plan, and sitting on the main floor under it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const box = (p, x0, x1, z0, z1, lv) => [W(`${p}1`, [x0, z0], [x1, z0], lv), W(`${p}2`, [x1, z0], [x1, z1], lv),
  W(`${p}3`, [x1, z1], [x0, z1], lv), W(`${p}4`, [x0, z1], [x0, z0], lv)];
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
// MAIN FL 30 x 20; 2ND FL set back 10 ft off its z = 0 side -- his PHASE 2.
const drawing = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50,
  roofPitch: 3,
  walls: [...box('m', 0, 30, 0, 20, 3), ...box('u', 0, 30, 10, 20, 5)],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], fixtures: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page, level = 5) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto(`/MODEL.html?level=${level}&lpane=build&left=1`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const strip = page => page.locator('#strip-message');
async function press(page, at, x, z) {
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(80);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
// THE THREE STEPS, the roof 2 ft out past the main wall at z = 0, its ends a
// foot past the end walls, its top edge on the 2nd floor's wall at z = 10.
async function drawShed(page, at) {
  await page.locator('[data-tool-key="roof"]').click();
  await expect(page.locator('#roof-pick')).toBeVisible();
  await page.locator('[data-roof-kind="shed"]').click();
  await expect(strip(page)).toContainText('1/3');
  await press(page, at, 0.3, 0.2);
  await press(page, at, 29.7, -0.2);
  await expect(strip(page)).toContainText('2/3');
  await press(page, at, 15, -1.2);
  await expect(strip(page)).toContainText('3/3');
  for (const [x, z] of [[-1, -2], [31, -2], [31, 10], [-1, 10]]) await press(page, at, x, z);
  await press(page, at, -1, -2);
}

test('ROOF on the 2nd floor asks which roof; CANCEL puts the popup away', async ({ page }) => {
  await open(page);
  await page.locator('[data-tool-key="roof"]').click();
  await expect(page.locator('#roof-pick')).toBeVisible();
  await expect(page.locator('[data-roof-kind="shed"]')).toHaveText(/SINGLE SLOPE ROOF/);
  await page.locator('[data-roof-pick-cancel]').click();
  await expect(page.locator('#roof-pick')).toBeHidden();
});

test('a press on the plan instead puts the popup away -- it is the ROOF tool\'s edge flip', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-tool-key="roof"]').click();
  await expect(page.locator('#roof-pick')).toBeVisible();
  await press(page, at, 15, 5);
  await expect(page.locator('#roof-pick')).toBeHidden();
});

test('the three steps make a single slope roof: eave out from the wall, flush at the taller wall, rakes at the ends', async ({ page }) => {
  const { at } = await open(page);
  await drawShed(page, at);
  await expect(strip(page)).toContainText('SINGLE SLOPE ROOF made at 3/12');
  const roof = (await saved(page)).roofs[0];
  expect(roof.levelId, 'filed on the ROOF plan').toBe(7);
  expect(roof.drawnOn, 'drawn on the 2nd floor').toBe(5);
  expect(roof.sourceLevelId, 'bearing on the main floor under it').toBe(3);
  expect(roof.pitch, 'the PROJECT pitch to start').toBe(3);
  expect(roof.edges).toEqual(['eave', 'gable', 'gable', 'gable']);
  expect(roof.edgeOverhang.map(v => Number(v.toFixed(3))), 'eave 2 ft out, rakes 1 ft past the end walls, flush at the 2nd floor wall')
    .toEqual([2, 1, 0, 1]);
  expect(roof.follows).toBe('none');
});

test('it shows on the 2nd floor and the ROOF plan, and stands on the MAIN FL plate in the elevations', async ({ page }) => {
  const { at } = await open(page);
  await drawShed(page, at);
  const d = await saved(page);
  const heights = await page.evaluate(d => {
    const F = window.DraftDrawingFormat, CE = window.DraftCutViewEnv, CV = window.DraftCutView;
    const env = CE.buildCutViewEnv(d, F.levels(d.levels));
    const stack = CV.sectionLevelStack(env);
    const roof = env.roofs()[0];
    return { base: CV.roofBaseElev(roof, stack, env), main: stack.floors[0].wallTop, bearing: stack.bearing };
  }, d);
  expect(heights.base, 'on the main floor walls').toBeCloseTo(heights.main, 6);
  expect(heights.base, 'not up on the 2nd floor plate').toBeLessThan(heights.bearing - 1);
  // PICKED ON THE 2ND FLOOR, where it was drawn.
  const shown = async level => {
    await page.goto(`/MODEL.html?level=${level}`);
    await expect(page.locator('#readout')).not.toHaveText('', { timeout: 10000 });
    return page.evaluate(() => (document.getElementById('readout').textContent.match(/roofs\s+(\d+)/) || [])[1] || '0');
  };
  expect(await shown(5), 'on the 2nd floor, where it was drawn').toBe('1');
  expect(await shown(7), 'and on the ROOF plan').toBe('1');
  expect(await shown(3), 'not on the main floor it sits on').toBe('0');
});

test('Escape puts a half-drawn roof down; a fresh ROOF asks again', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-tool-key="roof"]').click();
  await page.locator('[data-roof-kind="shed"]').click();
  await press(page, at, 0, 0);
  await page.keyboard.press('Escape');
  await expect(strip(page)).toContainText('put down');
  // THE NEXT PRESS IS NOT THE OLD ROOF'S SECOND POINT.
  await press(page, at, 30, 0);
  await expect(strip(page)).not.toContainText('2/3');
  expect((await saved(page)).roofs || []).toEqual([]);
});

test('an outline with no edge along the eave side is refused, and nothing is made', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-tool-key="roof"]').click();
  await page.locator('[data-roof-kind="shed"]').click();
  await press(page, at, 0.3, 0.2);
  await press(page, at, 29.7, -0.2);
  await press(page, at, 15, -1.2);
  // A TRIANGLE POINTING DOWNHILL: no edge runs along the wall line.
  for (const [x, z] of [[0, 10], [30, 10], [15, -1.5]]) await press(page, at, x, z);
  for (let i = 0; i < 2; i += 1) await page.keyboard.press('Enter'); // twice, quickly: once is a point at the cursor
  await expect(strip(page)).toContainText('No edge of that outline runs along the eave side');
  expect((await saved(page)).roofs || []).toEqual([]);
});

test('the T-square holds for the wall line and the outline\'s corners', async ({ page }) => {
  const { at } = await open(page);
  const chip = page.locator('[data-mode-tsquare]');
  if (!/\blit\b/.test(await chip.getAttribute('class') || '')) await chip.click();
  await expect(chip).toHaveClass(/lit/);
  await page.locator('[data-tool-key="roof"]').click();
  await page.locator('[data-roof-kind="shed"]').click();
  // THE FAR END A FOOT AND A HALF OFF LEVEL, out of the walls' reach.
  await press(page, at, 0.3, 0.2);
  await press(page, at, 29.7, 1.5);
  await press(page, at, 15, -1.2);
  // EACH CORNER A LITTLE OFF SQUARE TO THE ONE BEFORE.
  for (const [x, z] of [[-1, -2], [31, -1.6], [30.6, 12], [-1, 12.3]]) await press(page, at, x, z);
  for (let i = 0; i < 2; i += 1) await page.keyboard.press('Enter'); // twice, quickly: once is a point at the cursor
  await expect(strip(page)).toContainText('SINGLE SLOPE ROOF made');
  const roof = (await saved(page)).roofs[0];
  expect(roof.points.map(p => [Number(p.x.toFixed(3)), Number(p.z.toFixed(3))]), 'every corner square to the one before')
    .toEqual([[-1, -2], [31, -2], [31, 12], [-1, 12]]);
  expect(Number(roof.edgeOverhang[0].toFixed(3)), 'the eave 2 ft out from a level wall line').toBe(2);
});

test('Escape typed in the LENGTH box lets the box go and leaves the roof in hand', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-tool-key="roof"]').click();
  await page.locator('[data-roof-kind="shed"]').click();
  const box = page.locator('#frozen-length');
  await press(page, at, 0.3, 0.2);
  await page.mouse.move(...at(12, 0.4));
  await page.waitForTimeout(80);
  await page.keyboard.press('r');
  await expect(box).toBeFocused();
  await page.keyboard.type("20'");
  // ESCAPE IN THE BOX IS THE BOX'S: it lets the typing go, not the roof.
  await page.keyboard.press('Escape');
  await expect(box).not.toBeFocused();
  await expect(strip(page)).not.toContainText('put down');
  await press(page, at, 29.7, -0.2);
  await expect(strip(page), 'the wall line still being drawn').toContainText('2/3');
});

test('the LENGTH box types the wall line and each edge of the outline: R opens it, a digit too', async ({ page }) => {
  const { at } = await open(page);
  await page.locator('[data-tool-key="roof"]').click();
  await page.locator('[data-roof-kind="shed"]').click();
  const box = page.locator('#frozen-length');
  await press(page, at, 0.3, 0.2);
  // THE WALL LINE: 20 ft along the way the cursor points, by R then the number.
  await page.mouse.move(...at(12, 0.4));
  await page.waitForTimeout(80);
  await expect(box).toBeEnabled();
  await page.keyboard.press('r');
  await expect(box).toBeFocused();
  await page.keyboard.type("20'");
  for (let i = 0; i < 2; i += 1) await page.keyboard.press('Enter'); // twice, quickly: once is a point at the cursor
  await expect(strip(page)).toContainText('2/3');
  await press(page, at, 10, -1.2);
  // THE OUTLINE: the first corner pressed, then each edge typed by a digit.
  await press(page, at, -1, -2);
  for (const [toward, len] of [[[20, -2], "32'"], [[31, 8], "14'"], [[10, 12], "32'"]]) {
    await page.mouse.move(...at(...toward));
    await page.waitForTimeout(80);
    await page.keyboard.type(len);
    await page.keyboard.press('Enter');
  }
  // CLOSED ON THE FIRST CORNER: the cursor taken there, one ENTER is a press on it.
  await page.mouse.move(...at(-1, -2));
  await page.waitForTimeout(80);
  await page.keyboard.press('Enter');
  await expect(strip(page)).toContainText('SINGLE SLOPE ROOF made');
  const roof = (await saved(page)).roofs[0];
  expect(roof.points.map(p => [Number(p.x.toFixed(2)), Number(p.z.toFixed(2))]))
    .toEqual([[-1, -2], [31, -2], [31, 12], [-1, 12]]);
});
