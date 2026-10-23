// ANCHOR NODES ON AN ASSEMBLY (Movie, 22 Oct).
//
// "once more than 2 items are 'Y'ed, i'd like to specify a point on the
// assembly and also sharing a node with a non - assebly node ... if that point
// moves the 'Y' object will moves according to how that point moves" -- AQUA;
// and for a closet bumped into an outside wall, "make the top an bottom of the
// walls STRETCH where the nodes are connected so it allows the Y object to
// move back and forth within the other walls ... as if it was a window
// moving back and forth in the wall" -- "would only work if 2 nodes alone a
// similar walls that are aligned".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
// The outside wall on x = 0, broken at z = 8 and z = 12 by a three-wall
// closet bumped out to x = -3.
const CLOSET = { id: 'group-1', name: 'CLOSET', fixed: true, stretchBehavior: 'rigid',
  members: [{ type: 'wall', id: 'c1' }, { type: 'wall', id: 'c2' }, { type: 'wall', id: 'c3' }] };
const BOTH = [{ wallId: 'c1', end: 'start' }, { wallId: 'c3', end: 'end' }];
const drawing = (anchors, bot = W('bot', [0, 12], [0, 20])) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20, nextGroupId: 2,
  walls: [W('top', [0, 0], [0, 8]), W('c1', [0, 8], [-3, 8]), W('c2', [-3, 8], [-3, 12]),
    W('c3', [-3, 12], [0, 12]), bot],
  lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [{ ...CLOSET, ...(anchors ? { anchors } : {}) }], levelLocks: [], underlays: [],
});
async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.getAttribute('aria-expanded') === 'true') await levels.click();
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
  return h.savedDrawing(page);
}
const ends = (d, id) => { const w = d.walls.find(x => x.id === id); return [w.start.x, w.start.z, w.end.x, w.end.z]; };
const near = (got, want, label) => got.forEach((v, i) => expect(Math.abs(v - want[i]), `${label}: ${got} vs ${want}`).toBeLessThan(0.1));

test('two anchors on a lined-up wall: dragged, the closet slides along it and the wall stretches to stay joined', async ({ page }) => {
  const { at } = await open(page, drawing(BOTH));
  await expect(page.locator('#plan')).toHaveAttribute('data-anchors', '2');
  await click(page, at, -3, 10);
  // Pulled down AND out as far: only the run along the wall is taken.
  await drag(page, at, [-3, 10], [0, 13]);
  const d = await saved(page);
  near(ends(d, 'c1'), [0, 11, -3, 11], 'c1 slid down');
  near(ends(d, 'c2'), [-3, 11, -3, 15], 'c2 slid down');
  near(ends(d, 'top'), [0, 0, 0, 11], 'the wall above stretched');
  near(ends(d, 'bot'), [0, 15, 0, 20], 'the wall below shrank');
});

test('MOVE slides it too, and stops before the outside wall shrinks away; one UNDO puts it back', async ({ page }) => {
  const { at } = await open(page, drawing(BOTH));
  await click(page, at, -3, 10);
  await page.locator('#model-move').click();
  await drag(page, at, [-6, 10], [-6, 30]);
  let d = await saved(page);
  near(ends(d, 'c3'), [-3, 19.5, 0, 19.5], 'stopped half a foot short');
  near(ends(d, 'bot'), [0, 19.5, 0, 20], 'the wall below kept half a foot');
  near(ends(d, 'top'), [0, 0, 0, 15.5], 'the wall above stretched');
  await page.keyboard.press('Escape');
  await page.locator('#model-undo').click();
  d = await saved(page);
  near(ends(d, 'c3'), [-3, 12, 0, 12], 'back');
  near(ends(d, 'bot'), [0, 12, 0, 20], 'back');
});

test('one anchor: the closet follows its corner when the wall it stands on moves', async ({ page }) => {
  const { at } = await open(page, drawing([{ wallId: 'c3', end: 'end' }]));
  await click(page, at, 0, 16);
  await drag(page, at, [0, 16], [2, 16]);
  const d = await saved(page);
  near(ends(d, 'bot'), [2, 12, 2, 20], 'the wall moved');
  near(ends(d, 'c2'), [-1, 8, -1, 12], 'the closet came with it, whole');
  near(ends(d, 'c3'), [-1, 12, 2, 12], 'still on the corner');
});

test('ANCHOR picks a shared corner of the held assembly, and refuses one no outside wall shares', async ({ page }) => {
  const { at } = await open(page, drawing(null));
  await click(page, at, -3, 10);
  await page.getByRole('button', { name: 'DRAFTING', exact: true }).click();
  await page.locator('[data-assembly-anchor]').click();
  await expect(page.locator('[data-assembly-anchor]')).toHaveAttribute('aria-pressed', 'true');
  await click(page, at, -3, 8);
  await expect(page.locator('#strip-message')).toContainText('not shared');
  await click(page, at, 0, 8);
  await expect(page.locator('#strip-message')).toContainText('follows');
  await click(page, at, 0, 12);
  await expect(page.locator('#strip-message')).toContainText('slides');
  await expect(page.locator('#plan')).toHaveAttribute('data-anchors', '2');
  await page.keyboard.press('Escape');
  const d = await saved(page);
  expect(d.groups[0].anchors).toEqual([{ wallId: 'c1', end: 'start' }, { wallId: 'c3', end: 'end' }]);
});

test('two anchors on walls that do not line up: no track, the closet moves as any assembly does', async ({ page }) => {
  const { at } = await open(page, drawing(BOTH, W('bot', [0, 12], [6, 12])));
  await click(page, at, -3, 10);
  await drag(page, at, [-3, 10], [0, 11]);
  const d = await saved(page);
  expect(Math.abs(ends(d, 'c2')[0]), 'moved out across the wall line, as no window would').toBeLessThan(0.1);
});
