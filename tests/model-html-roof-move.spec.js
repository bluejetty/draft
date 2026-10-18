// MOVE, FOR A ROOF (Movie, 18 Oct).
//
// "grab the edge of a roof, and then have opion down below with BREAK COPY
// etc that says MOVE ... pushed it over all the way to the left so there is
// no roof left it would just smooth out the roof to the main eave" -- "grab
// the ... ROOF EDGE and then drag it down to where the main roof edge is and
// line them up" -- "SELECT just the NODE and i could either DELETE it or MOVE
// it".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// A 60 x 30 house with a 6' jog-out on its front from x = 20 to 40, roofed
// at 8': the eave ring is the wall ring pushed out 8'.
const WALL = [[0, 0], [60, 0], [60, 30], [40, 30], [40, 36], [20, 36], [20, 30], [0, 30]];
const EAVE = [[-8, -8], [68, -8], [68, 38], [48, 38], [48, 44], [12, 44], [12, 38], [-8, 38]];
const drawing = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [], lines: [], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  roofs: [{ id: 'roof-1', levelId: 7, follows: 'none', pitch: 4, overhang: 8,
    points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges: EAVE.map(() => 'eave'),
    edgeOverhang: EAVE.map(() => 8), footprint: WALL.map(([x, z]) => ({ x, y: 0, z })) }],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?level=7');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function drag(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).roofs[0];
}
const ring = pts => pts.map(p => [Math.round(p.x * 100) / 100 + 0, Math.round(p.z * 100) / 100 + 0]);
async function armMove(page, at) {
  await click(page, at, 30, 15);
  await expect(page.locator('#model-move')).toBeVisible();
  await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
}

test('option 1: the jog\'s side pushed all the way across smooths it into the main eave; one UNDO', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  // The jog's right side, x = 48, pushed left to x = 12.
  await drag(page, at, [48, 41], [12, 41]);
  let roof = await saved(page);
  expect(ring(roof.points)).toEqual([[-8, -8], [68, -8], [68, 38], [-8, 38]]);
  expect(ring(roof.footprint), 'the wall line it hangs from goes with it').toEqual([[0, 0], [60, 0], [60, 30], [0, 30]]);
  expect(roof.edgeOverhang).toEqual([8, 8, 8, 8]);
  await page.keyboard.press('Control+z');
  roof = await saved(page);
  expect(ring(roof.points)).toEqual(EAVE);
});

test('option 2: the jog\'s front dragged down onto the main eave line -- no node left over', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  await drag(page, at, [30, 44], [30, 38]);
  const roof = await saved(page);
  expect(ring(roof.points)).toEqual([[-8, -8], [68, -8], [68, 38], [-8, 38]]);
});

test('a node dragged moves alone; a node clicked is picked and DELETE takes it out', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  // The top-left corner pulled out 2'.
  await drag(page, at, [-8, -8], [-10, -10]);
  let roof = await saved(page);
  expect(ring(roof.points)[0]).toEqual([-10, -10]);
  expect(roof.points).toHaveLength(8);
  // Pick the jog's front-left corner (12, 44) and DELETE it.
  await click(page, at, 12, 44);
  await page.keyboard.press('Delete');
  roof = await saved(page);
  expect(roof.points).toHaveLength(7);
  expect(ring(roof.points)).not.toContainEqual([12, 44]);
  expect(roof.edges).toHaveLength(7);
  expect(roof.footprint).toHaveLength(7);
});

test('a drag inside the roof moves the whole roof', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  await drag(page, at, [30, 15], [35, 15]);
  const roof = await saved(page);
  expect(ring(roof.points)).toEqual(EAVE.map(([x, z]) => [x + 5, z]));
  expect(ring(roof.footprint)[0]).toEqual([5, 0]);
});

test('Esc puts MOVE down', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  await page.keyboard.press('Escape');
  await expect(page.locator('#model-move')).not.toHaveAttribute('aria-pressed', 'true');
});
