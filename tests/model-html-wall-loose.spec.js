// ALT LETS A DRAGGED WALL GO OF ITS CORNERS (Movie, 18 Oct; SHIFT until 27
// Oct, when Shift became ARCHICAD's hold-square and this moved to Alt).
//
// "i'd like to be able to have an option to DISCONNECT the nodes at corners,
// maybe by pressing SHIFT while attempting to move the line, then the nodes
// will disconnect when SHIFT is being depressed but will bouce back to
// connected if SHIFT is released" -- "basically i need to move the inside
// wall over so there is 1/2" space".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
const house = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('wall-1', [0, 0], [20, 0]), W('wall-2', [20, 0], [20, 14]),
    W('wall-3', [20, 14], [0, 14]), W('wall-4', [0, 14], [0, 0])],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'd.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, f: house() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const pt = p => [Math.round(p.x * 100) / 100 + 0, Math.round(p.z * 100) / 100 + 0];
const wallOf = (d, id) => d.walls.find(w => w.id === id);
// Select wall-1, then drag its body 1' down with ALT held for `altFor`
// of the way (1 = the whole drag, 0.5 = let go half way).
async function dragWall(page, at, altFor) {
  await page.mouse.click(...at(10, 0));
  await page.waitForTimeout(100);
  await page.mouse.move(...at(10, 0));
  await page.mouse.down();
  await page.keyboard.down('Alt');
  await page.mouse.move(...at(10, 0.5), { steps: 5 });
  if (altFor < 1) await page.keyboard.up('Alt');
  await page.mouse.move(...at(10, 1), { steps: 5 });
  await page.mouse.up();
  if (altFor >= 1) await page.keyboard.up('Alt');
  await page.waitForTimeout(100);
}

test('ALT held: the wall moves on its own; the walls it met stay where they were; UNDO joins it again', async ({ page }) => {
  const { at } = await open(page);
  await dragWall(page, at, 1);
  let d = await saved(page);
  expect([pt(wallOf(d, 'wall-1').start), pt(wallOf(d, 'wall-1').end)]).toEqual([[0, 1], [20, 1]]);
  expect(pt(wallOf(d, 'wall-2').start), 'the side walls keep their corners').toEqual([20, 0]);
  expect(pt(wallOf(d, 'wall-4').end)).toEqual([0, 0]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect([pt(wallOf(d, 'wall-1').start), pt(wallOf(d, 'wall-1').end)]).toEqual([[0, 0], [20, 0]]);
  // JOINED AGAIN: a plain drag of it now takes the side walls along.
  await dragWall(page, at, 0);
  d = await saved(page);
  expect(pt(wallOf(d, 'wall-2').start), 'the corner is shared again').toEqual([20, 1]);
});

test('ALT let go part way: the corners bounce back and stretch with it', async ({ page }) => {
  const { at } = await open(page);
  await dragWall(page, at, 0.5);
  const d = await saved(page);
  expect([pt(wallOf(d, 'wall-1').start), pt(wallOf(d, 'wall-1').end)]).toEqual([[0, 1], [20, 1]]);
  expect(pt(wallOf(d, 'wall-2').start), 'the side walls came along').toEqual([20, 1]);
  expect(pt(wallOf(d, 'wall-4').end)).toEqual([0, 1]);
});
