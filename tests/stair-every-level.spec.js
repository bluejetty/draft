// A STAIR ON EVERY LEVEL, AND PICKED FROM EITHER END (jb, 22 Nov 2026).
//
// "when i create a set of stairs can you create it for all levels and once
// its created the user can delete the level they don't need", and "can you
// allow the user to move the stairs on multiple levels (the basement as well
// as main floor for this stair". The STAIR popup's ALL LEVELS (lit by
// default) stacks the same stair on every other floor; THIS LEVEL ONLY
// places the one. DELETE takes only the flight picked. A flight is filed on
// the floor it comes DOWN from, and the floor it lands on (the basement for
// MAIN's) now picks and moves it too.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const FOUNDATION = 1, MAIN_FL = 3, SECOND_FL = 5;

const rect = (wide = 40, deep = 32) => [
  { x: -wide / 2, y: 0, z: -deep / 2 }, { x: wide / 2, y: 0, z: -deep / 2 },
  { x: wide / 2, y: 0, z: deep / 2 }, { x: -wide / 2, y: 0, z: deep / 2 },
];
const house = (extra = {}) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: SECOND_FL, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: FOUNDATION, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], roofs: [], fenestrations: [], dimensions: [], shapes: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [], surfaceOpenings: [], stairs: [],
  outlines: [
    { id: 'o-main', levelId: MAIN_FL, garage: false, points: rect() },
    { id: 'o-2nd', levelId: SECOND_FL, garage: false, points: rect() },
  ],
  floors: [MAIN_FL, SECOND_FL].map(levelId => ({
    id: `f-${levelId}`, levelId, view: 'plan', structure: 'floor', garage: false,
    slopeInPerFt: 0, thickness: 0.9583333333333334, thickenedEdge: false, points: rect(),
  })),
  ...extra,
});

async function open(page, file = house(), level = MAIN_FL, view = '') {
  await h.openEditor(page, { drawing: file, bucket: BUCKET, url: `/MODEL.html?left=1&lpane=build&right=1&level=${level}${view ? `&view=${view}` : ''}`, webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(200);
}
async function saveNow(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}
const savedFile = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);
const card = page => page.locator('[data-stair-pick]');
const strip = page => page.locator('#strip-message');
async function armStair(page) {
  await page.locator('[data-tool-key="stair"]').click();
  await page.waitForTimeout(150);
  await expect(card(page)).toBeVisible();
}
async function press(page, at, x, z) {
  await page.mouse.move(...at(x, z));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(100);
}
const on = (file, levelId) => file.stairs.filter(s => Number(s.levelId) === levelId);

test('ALL LEVELS is lit by default: one stair placed stacks on every floor, wells cut, one UNDO takes all', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await armStair(page);
  await expect(card(page).locator('[data-stair-levels="all"]')).toHaveAttribute('aria-pressed', 'true');
  await press(page, at, 0, -8);
  await press(page, at, 0, 4);
  await expect(strip(page)).toContainText(/stacked on .*2ND FL/);
  await saveNow(page);
  const d = await savedFile(page);
  const [main] = on(d, MAIN_FL), [upper] = on(d, SECOND_FL);
  expect(main && upper, 'a flight on MAIN FL and one on 2ND FL').toBeTruthy();
  expect([upper.start.x, upper.start.z], 'stacked over MAIN\'s').toEqual([main.start.x, main.start.z]);
  expect(upper.widthFt, 'the width the hand chose').toBe(main.widthFt);
  expect(upper.auto, 'the drafter\'s, not AUTO STAIR\'s').toBeUndefined();
  expect(d.surfaceOpenings.filter(o => o.stairId === upper.id), '2ND FL\'s well').toHaveLength(1);

  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  await saveNow(page);
  const undone = await savedFile(page);
  expect(undone.stairs).toHaveLength(0);
  expect(undone.surfaceOpenings.filter(o => o.stairId != null)).toHaveLength(0);
});

test('UP FROM HERE stacks down as well: the MAIN FL flight under the 2ND FL one', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await armStair(page);
  await card(page).locator('[data-stair-dir="up"]').click();
  await press(page, at, -10, 0);
  await press(page, at, 5, 0);
  await saveNow(page);
  const d = await savedFile(page);
  const [upper] = on(d, SECOND_FL), [main] = on(d, MAIN_FL);
  expect(upper && main).toBeTruthy();
  expect([main.start.x, main.start.z]).toEqual([upper.start.x, upper.start.z]);
});

test('THIS LEVEL ONLY places the one flight', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await armStair(page);
  await card(page).locator('[data-stair-levels="one"]').click();
  await expect(card(page).locator('[data-stair-levels="one"]')).toHaveAttribute('aria-pressed', 'true');
  await press(page, at, 0, -8);
  await press(page, at, 0, 4);
  await saveNow(page);
  const d = await savedFile(page);
  expect(d.stairs).toHaveLength(1);
  expect(d.stairs[0].levelId).toBe(MAIN_FL);
});

test('a floor that already has a stair there keeps it; none is stacked on top', async ({ page }) => {
  const mine = { id: 40, levelId: SECOND_FL, view: 'plan', start: { x: 0, y: 0, z: -7 }, end: { x: 0, y: 0, z: 3 },
    widthFt: 3, riseFt: 9, rail: 'left', shape: 'straight', turn: 'right', winders: 0 };
  await open(page, house({ stairs: [mine] }));
  const { at } = await h.planFrame(page);
  await armStair(page);
  await press(page, at, 0, -8);
  await press(page, at, 0, 4);
  await expect(strip(page)).toContainText(/2ND FL already had a stair there/);
  await saveNow(page);
  const d = await savedFile(page);
  expect(on(d, SECOND_FL)).toHaveLength(1);
  expect(on(d, SECOND_FL)[0].id).toBe(40);
  expect(on(d, MAIN_FL)).toHaveLength(1);
});

test('DELETE takes the one flight picked; the other floor\'s stays', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await armStair(page);
  await press(page, at, 0, -8);
  await press(page, at, 0, 4);
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.waitForTimeout(100);
  await press(page, at, 0, -4);
  await expect.poll(() => page.evaluate(() => selection.map(e => [e.type, Number(e.item.levelId)])))
    .toEqual([['stair', MAIN_FL]]);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
  await saveNow(page);
  const d = await savedFile(page);
  expect(on(d, MAIN_FL)).toHaveLength(0);
  expect(on(d, SECOND_FL)).toHaveLength(1);
});

test('the basement plan picks and drags MAIN FL\'s flight (it lands there), its stack riding along', async ({ page }) => {
  const flight = (id, levelId) => ({ id, levelId, view: 'plan', start: { x: -2, y: 0, z: -4 }, end: { x: 8, y: 0, z: -4 },
    widthFt: 3, riseFt: 9, rail: 'left', shape: 'straight', turn: 'right', winders: 0 });
  await open(page, house({ stairs: [flight(71, MAIN_FL), flight(72, SECOND_FL)] }), FOUNDATION, 'plan');
  // BASEMENT (WALLS), the plan jb moves it on; the FOUNDATION set shows no stair.
  const { at, scale } = await h.planFrame(page);
  const [x, y] = at(1, -4);
  await page.mouse.move(x, y);
  await expect(page.locator('#hover-name'), 'the flight coming UP to the basement').toHaveText('STAIR', { timeout: 4000 });
  await page.mouse.click(x, y);
  await expect.poll(() => page.evaluate(() => selection.map(e => Number(e.item.id)))).toEqual([71]);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 4 * scale, y, { steps: 6 });
  await page.mouse.up();
  await saveNow(page);
  const d = await savedFile(page);
  const byId = id => d.stairs.find(s => Number(s.id) === id);
  expect(byId(71).start.x, 'MAIN FL\'s flight moved from the basement').toBeCloseTo(2, 2);
  expect(byId(72).start.x, 'the 2ND FL flight stacked over it went too').toBeCloseTo(2, 2);
});
