// A PICKUP BECOMES THE TOOL'S DEFAULTS (Movie, 20 Oct): "when the user picks
// up the PROPERTIES - also change the PROPERTIES to match in the 'item' FENS
// / WALL / LINE area to match most recent BRUSH pickup of properties for
// each type, so when the user goes back to use that item, it will be the
// type they 'picked up' with the brush".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, extra = {}) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8, ...extra });
const drawing = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('a', [-12, 0], [12, 0]),
    W('b', [-12, -10], [12, -10]),
    W('g', [-12, 10], [12, 10]),
    W('icf', [-12, 16], [12, 16], { wallType: 'icf', refLine: 'left', topHeight: 9 })],
  fenestrations: [
    { id: 'dr', wallId: 'g', levelId: 3, view: 'plan', type: 'door', layer: 'A-DOOR', offset: 12, width: 4.75,
      sillHeight: 0, headHeight: 7, doorType: 'ext', doorStyle: 'single', hingeFlip: false, swingFlip: true }],
  lines: [{ id: 'ln', start: { x: -12, y: 0, z: -16 }, end: { x: 12, y: 0, z: -16 }, levelId: 3, view: 'plan',
    layer: 'draft', weight: 4, style: 'dashed' }],
  floors: [], roofs: [], dimensions: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?left=1&lpane=build&level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.count() && await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const press = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const brushUp = async page => {
  await page.locator('#strip-brush').click();
  await expect(page.locator('#strip-brush')).toHaveClass(/armed/);
};
// THE BRUSH PUT DOWN, its load dropped: what the tool draws next is its own.
const brushDown = async page => {
  await page.keyboard.press('Escape');
  await expect(page.locator('#strip-brush-load')).toBeHidden();
};
const r2 = n => Math.round(n * 100) / 100;

test('a door lifted becomes the FENESTRATION panel and the next door drawn without the brush', async ({ page }) => {
  const { at } = await open(page);
  await brushUp(page);
  await press(page, at, 0, 10);
  await expect(page.locator('#strip-brush-load')).toHaveText('DOOR 4\'-9"');
  // THE PANEL SAYS WHAT WAS PICKED UP.
  await expect(page.locator('[data-prop-field="width"]')).toHaveValue('4\'-9"');
  await expect(page.locator('[data-prop-field="head"]')).toHaveValue('7\'-0"');
  await brushDown(page);
  await expect(page.locator('[data-tool-key="fenestration"]')).toHaveAttribute('aria-pressed', 'true');
  await press(page, at, -6, 0);
  const d = await saved(page);
  const made = d.fenestrations.find(f => f.wallId === 'a');
  expect(made, 'a door went in').toBeTruthy();
  expect([made.type, r2(made.width), r2(made.headHeight), made.swingFlip]).toEqual(['door', 4.75, 7, true]);
});

test('a wall lifted becomes the WALL panel and the next wall drawn', async ({ page }) => {
  const { at } = await open(page);
  await brushUp(page);
  await press(page, at, 0, 16);
  await expect(page.locator('#strip-brush-load')).toContainText(/ICF|WALL/);
  await brushDown(page);
  await h.armFromRail(page, 'wall');
  await expect(page.locator('[data-prop-row="wall type"] [data-prop-value="icf"]')).toHaveAttribute('aria-pressed', 'true');
  await press(page, at, -6, 5);
  await press(page, at, 6, 5);
  await page.keyboard.press('Escape');
  const d = await saved(page);
  const made = d.walls.find(w => !['a', 'b', 'g', 'icf'].includes(w.id));
  expect(made, 'a wall was drawn').toBeTruthy();
  expect([made.wallType, made.refLine, r2(made.topHeight)]).toEqual(['icf', 'left', 9]);
});

test('a line lifted becomes the LINE tool\'s weight and style', async ({ page }) => {
  const { at } = await open(page);
  await brushUp(page);
  await press(page, at, 0, -16);
  await expect(page.locator('#strip-brush-load')).toContainText(/LINE/);
  await brushDown(page);
  await h.armFromRail(page, 'line');
  await press(page, at, -6, -5);
  await press(page, at, 6, -5);
  await page.keyboard.press('Escape');
  const d = await saved(page);
  const made = d.lines.find(l => l.id !== 'ln');
  expect(made, 'a line was drawn').toBeTruthy();
  expect([made.weight, made.style]).toEqual([4, 'dashed']);
});
