// ALT-DRAG LETS A CORNER GO (Movie, 22 Oct): "sometimes there is a corner
// where a node is connected, sometimes i'd like to disconnect them and extend
// one of the corner lines/walls". A corner is one pooled point every wall
// meeting there owns, so a plain drag moves them all. With ALT (or CTRL)
// held on the press, the selected wall's end lets go of the corner and moves
// alone; the other wall keeps the corner where it is; one UNDO joins them
// again. A free end has nothing to let go of, and drags as it always did.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const NE = { x: 10, z: -10 };
const base = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
    ['stub', V(4, 4), V(4, 8)],
  ].map(([id, start, end]) => ({
    id, start, end, levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [], nextDrawingItemId: 20,
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const saved = async page => {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
};
const wall = (d, id) => d.walls.find(w => w.id === id);
const r2 = n => Math.round(n * 100) / 100;
// Select a wall by a press on its body, then grab one of its ends, with or
// without ALT held on the press, and pull it.
async function dragEnd(page, at, bodyAt, from, to, { alt = false } = {}) {
  await page.mouse.click(...at(...bodyAt));
  await page.waitForTimeout(80);
  await page.mouse.move(...at(...from));
  if (alt) await page.keyboard.down('Alt');
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  if (alt) await page.keyboard.up('Alt');
  await page.waitForTimeout(120);
}

test('ALT held on the press: the selected wall\'s end lets go of the corner and moves alone; UNDO joins them again', async ({ page }) => {
  const { at } = await open(page);
  await dragEnd(page, at, [0, -10], [NE.x, NE.z], [14, -10], { alt: true });
  await expect(page.locator('#strip-message')).toContainText('let go');
  let d = await saved(page);
  expect([r2(wall(d, 'n').end.x), r2(wall(d, 'n').end.z)], 'the north wall\'s end went with the hand').toEqual([14, -10]);
  expect([r2(wall(d, 'e').start.x), r2(wall(d, 'e').start.z)], 'the east wall kept the corner').toEqual([10, -10]);
  // ONE UNDO: the end is back on the corner, and the corner is one point
  // again -- a plain drag after it moves both walls.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
  d = await saved(page);
  expect([r2(wall(d, 'n').end.x), r2(wall(d, 'n').end.z)]).toEqual([10, -10]);
  await dragEnd(page, at, [0, -10], [NE.x, NE.z], [13, -10]);
  d = await saved(page);
  expect([r2(wall(d, 'n').end.x), r2(wall(d, 'n').end.z)], 'joined again: both moved').toEqual([13, -10]);
  expect([r2(wall(d, 'e').start.x), r2(wall(d, 'e').start.z)]).toEqual([13, -10]);
});

test('without ALT the corner moves whole, as it always has', async ({ page }) => {
  const { at } = await open(page);
  await dragEnd(page, at, [0, -10], [NE.x, NE.z], [14, -10]);
  const d = await saved(page);
  expect([r2(wall(d, 'n').end.x), r2(wall(d, 'n').end.z)]).toEqual([14, -10]);
  expect([r2(wall(d, 'e').start.x), r2(wall(d, 'e').start.z)], 'the east wall came too').toEqual([14, -10]);
});

test('ALT on a free end has nothing to let go of: the end drags as it always did', async ({ page }) => {
  const { at } = await open(page);
  await dragEnd(page, at, [4, 6], [4, 8], [4, 9], { alt: true });
  await expect(page.locator('#strip-message')).not.toContainText('let go');
  const d = await saved(page);
  expect([r2(wall(d, 'stub').end.x), r2(wall(d, 'stub').end.z)]).toEqual([4, 9]);
});
