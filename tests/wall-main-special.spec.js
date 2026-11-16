// MAIN WALLS / SPECIAL CASE and the CUSTOM WIDTH wall type (jb, 15 Nov 2026).
//
// "for the WALL - OBJ / PROP can we add a MAIN, and SPECIAL CASES, same idea
// as the roof. so i can change the wall height, type, without the others
// changing. or if i go back to default it will take main properties" -- per
// assembly, jb's pick. And "add one more selection that allows the user to
// enter the WIDTH of the wall and just make a basic wall that width".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, extra) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8, ...extra });
const drawing = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('n', [0, 0], [12, 0]), W('e', [12, 0], [12, 10]), W('s', [12, 10], [0, 10]), W('w', [0, 10], [0, 0]),
    W('loose', [18, 0], [18, 10])],
  groups: [{ id: 'group-1', name: 'WALLS 1', fixed: false, stretchBehavior: 'item-geometry',
    members: ['n', 'e', 's', 'w'].map(id => ({ type: 'wall', id })),
    wallSettings: { wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'center' } }],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?left=1&right=1&level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const wall = (d, id) => d.walls.find(w => w.id === id);
const slot = '#props-slot';
const typeIn = async (page, selector, text) => {
  const box = page.locator(selector);
  await box.fill(text);
  await box.press('Enter');
  await page.waitForTimeout(100);
};

test('CUSTOM WIDTH: a lone wall takes a typed width, keeps it through a save and reopen, and UNDO puts the 2x6 back', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(18, 5));
  await page.locator(`${slot} [data-prop-row="type"] [data-prop-value="custom"]`).click();
  await expect(page.locator(`${slot} [data-wall-width-field]`), 'starts at the width the wall was').toHaveValue('5 1/2"');
  await typeIn(page, `${slot} [data-wall-width-field]`, '4 1/2');
  let d = await saved(page);
  expect(wall(d, 'loose')).toMatchObject({ wallType: 'custom', widthIn: 4.5 });
  expect(wall(d, 'n').wallType, 'nothing else moved').toBe('stud_2x6');
  // A metric width reads too.
  await typeIn(page, `${slot} [data-wall-width-field]`, '150mm');
  d = await saved(page);
  expect(wall(d, 'loose').widthIn).toBeCloseTo(150 / 25.4, 1);
  // Reopened, it is still that wall.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const thick = await page.evaluate(() => {
    const w = drawing.walls.find(x => x.id === 'loose');
    return { type: w.wallType, ft: window.DraftWallTypes.wallThicknessFt(w) };
  });
  expect(thick.type).toBe('custom');
  expect(thick.ft * 12).toBeCloseTo(150 / 25.4, 1);
});

test('CUSTOM WIDTH refuses a width no wall is', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(18, 5));
  await page.locator(`${slot} [data-prop-row="type"] [data-prop-value="custom"]`).click();
  await typeIn(page, `${slot} [data-wall-width-field]`, '0');
  const d = await saved(page);
  expect(wall(d, 'loose').widthIn, 'still the width it started at').toBe(5.5);
});

test('MAIN WALLS reaches every wall that follows it; THIS WALL keeps its own; x puts it back to MAIN; one UNDO each', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(6, 0));
  await expect(page.locator(`${slot} [data-wall-section="main"]`)).toContainText('MAIN WALLS');
  await expect(page.locator(`${slot} [data-wall-section="special"]`)).toContainText('THIS WALL (SPECIAL CASE)');
  // MAIN TOP 10: all four.
  await typeIn(page, `${slot} [data-wall-main] [data-prop-field="top"]`, '10');
  let d = await saved(page);
  expect(['n', 'e', 's', 'w'].map(id => wall(d, id).topHeight)).toEqual([10, 10, 10, 10]);
  expect(wall(d, 'loose').topHeight, 'not in the assembly').toBe(8);
  // THIS WALL TOP 12: only the north wall.
  await typeIn(page, `${slot} [data-wall-own-field="topHeight"]`, '12');
  d = await saved(page);
  expect(['n', 'e', 's', 'w'].map(id => wall(d, id).topHeight)).toEqual([12, 10, 10, 10]);
  expect(wall(d, 'n').own).toEqual(['topHeight']);
  // MAIN TOP 9: the other three; the special one stays.
  await typeIn(page, `${slot} [data-wall-main] [data-prop-field="top"]`, '9');
  d = await saved(page);
  expect(['n', 'e', 's', 'w'].map(id => wall(d, id).topHeight)).toEqual([12, 9, 9, 9]);
  expect(d.groups[0].wallSettings.topHeight).toBe(9);
  await expect(page.locator(`${slot} [data-wall-main]`)).toContainText('TOP (1 SPECIAL)');
  // x: back to MAIN.
  await page.locator(`${slot} [data-wall-own-clear="topHeight"]`).click();
  await page.waitForTimeout(100);
  d = await saved(page);
  expect(['n', 'e', 's', 'w'].map(id => wall(d, id).topHeight)).toEqual([9, 9, 9, 9]);
  expect(wall(d, 'n').own).toBeUndefined();
  // UNDO: the north wall is special at 12 again.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect(wall(d, 'n')).toMatchObject({ topHeight: 12, own: ['topHeight'] });
});

test('a special TYPE (custom width) is left alone by a MAIN type change; MAIN puts it back', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(12, 5));
  await page.locator(`${slot} [data-prop-row="special type"] [data-prop-value="custom"]`).click();
  await typeIn(page, `${slot} [data-prop-row="special width"] input`, '10');
  let d = await saved(page);
  expect(wall(d, 'e')).toMatchObject({ wallType: 'custom', widthIn: 10, own: ['wallType'] });
  await page.locator(`${slot} [data-wall-main] [data-prop-row="type"] [data-prop-value="stud_2x4"]`).click();
  await page.waitForTimeout(100);
  d = await saved(page);
  expect(['n', 's', 'w'].map(id => wall(d, id).wallType)).toEqual(['stud_2x4', 'stud_2x4', 'stud_2x4']);
  expect(wall(d, 'e')).toMatchObject({ wallType: 'custom', widthIn: 10 });
  await page.locator(`${slot} [data-prop-row="special type"] [data-prop-value="main"]`).click();
  await page.waitForTimeout(100);
  d = await saved(page);
  expect(wall(d, 'e').wallType).toBe('stud_2x4');
  expect(wall(d, 'e').widthIn).toBeUndefined();
  expect(wall(d, 'e').own).toBeUndefined();
});

test('a wall already a different height when Y\'d is SPECIAL without being touched, and MAIN does not flatten it', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const f = drawing();
  f.walls.find(w => w.id === 's').topHeight = 4;
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?left=1&right=1&level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(6, 0));
  await expect(page.locator(`${slot} [data-wall-main]`)).toContainText('TOP (1 SPECIAL)');
  await typeIn(page, `${slot} [data-wall-main] [data-prop-field="top"]`, '9');
  const d = await saved(page);
  expect(['n', 'e', 's', 'w'].map(id => wall(d, id).topHeight)).toEqual([9, 9, 4, 9]);
});
