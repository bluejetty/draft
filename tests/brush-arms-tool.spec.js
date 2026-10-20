// THE BRUSH ARMS THE TOOL ITS LOAD BELONGS TO (Movie, 20 Oct).
//
// "when i use the 'DRAFTING BRUSH' after i grab the properties of a DOOR i
// would like to make a new door for this closer and trying to make a door,
// once the user uses the BRUSH to get PROPERTIES can you also change the
// user to the TOOL necessary to use the properties / item, in this case
// into the BUILD DOOR command with those properties so the user can click
// on a wall or additionally to paste the properties of that door to another
// existing door which the user would like to change". An opening lifted
// arms FENESTRATION wearing it: bare wall takes a new one, an opening
// pressed takes the properties. A wall lifted keeps the brush up, as before.
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
  walls: [W('a', [-12, 0], [12, 0], { topHeight: 9 }), W('b', [-12, -10], [12, -10]), W('g', [-12, 10], [12, 10])],
  fenestrations: [
    { id: 'win', wallId: 'b', levelId: 3, view: 'plan', type: 'window', layer: 'A-GLAZ', offset: 12, width: 3,
      sillHeight: 2.5, headHeight: 6.667 },
    { id: 'dr', wallId: 'g', levelId: 3, view: 'plan', type: 'door', layer: 'A-DOOR', offset: 12, width: 3,
      sillHeight: 0, headHeight: 6.667, doorStyle: 'single', hingeFlip: false, swingFlip: true }],
  lines: [], floors: [], roofs: [], dimensions: [], fixtures: [],
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
const toolKey = (page, id) => page.locator(`[data-tool-key="${id}"]`);
const brushUp = async page => {
  await page.locator('#strip-brush').click();
  await expect(page.locator('#strip-brush')).toHaveClass(/armed/);
};

test('a door lifted arms FENESTRATION wearing it, and a press on bare wall puts one there', async ({ page }) => {
  const { at } = await open(page);
  await brushUp(page);
  await press(page, at, 0, 10);
  await expect(page.locator('#strip-brush-load')).toHaveText('DOOR 3\'-0"');
  await expect(toolKey(page, 'fenestration'), 'the tool came up').toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#strip-brush'), 'the brush\'s press went down, its load stays').not.toHaveClass(/armed/);
  await expect(page.locator('[data-prop-row="opening"] [data-prop-value="door"]'), 'the panel says DOOR').toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#strip-message')).toContainText('FENESTRATION is armed');
  await press(page, at, -6, 0);
  const d = await saved(page);
  const made = d.fenestrations.filter(o => o.wallId === 'a');
  expect(made, 'a new one on wall a').toHaveLength(1);
  expect([made[0].type, made[0].width, made[0].doorStyle, made[0].swingFlip]).toEqual(['door', 3, 'single', true]);
  expect(d.fenestrations, 'nothing else changed').toHaveLength(3);
});

test('and a press on an existing window gives it the door\'s properties instead of placing beside it', async ({ page }) => {
  const { at } = await open(page);
  await brushUp(page);
  await press(page, at, 0, 10);
  await expect(toolKey(page, 'fenestration')).toHaveAttribute('aria-pressed', 'true');
  await press(page, at, 0, -10);
  const d = await saved(page);
  expect(d.fenestrations, 'no new opening').toHaveLength(2);
  const win = d.fenestrations.find(o => o.id === 'win');
  expect([win.type, win.width, win.doorStyle, win.offset, win.wallId], 'the window is that door now, where it was')
    .toEqual(['door', 3, 'single', 12, 'b']);
});

test('a wall lifted keeps the brush up: the next wall pressed takes its properties, nothing is drawn', async ({ page }) => {
  const { at } = await open(page);
  await brushUp(page);
  await press(page, at, -6, 0);
  await expect(page.locator('#strip-brush-load')).toHaveText('WALL 9\'-0"');
  await expect(toolKey(page, 'select'), 'no tool came up').toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#strip-brush')).toHaveClass(/armed/);
  await press(page, at, -6, -10);
  const d = await saved(page);
  expect(d.walls.find(w => w.id === 'b').topHeight, 'b took a\'s height').toBe(9);
  expect(d.walls, 'and nothing was drawn').toHaveLength(3);
});
