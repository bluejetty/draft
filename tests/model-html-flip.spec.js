// FLIP (Movie, 20 Oct).
//
// "i need another option down there for FLIP beside rotate and move". What is
// selected is mirrored about its own middle, left for right or top for
// bottom, its row over the verbs while it is up like ROTATE's. A mirror
// reverses the hand: a wall drawn by its left line is drawn by its right, a
// fixture crosses to the other face, a door swings the other way, a stair
// that turned left turns right. One UNDO takes it all back.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, refLine = 'center') => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine });
// A house wall, and a two-wall WC starting ON its end: wc1 drawn by its
// LEFT line with a door in it, wc2 with a toilet on its +1 face. And a
// stair that turns right.
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20, nextGroupId: 2,
  walls: [W('house', [-10, 0], [0, 0]), W('wc1', [0, 0], [8, 0], 'left'), W('wc2', [8, 0], [8, 6])],
  lines: [], floors: [], roofs: [], dimensions: [],
  fenestrations: [{ id: 'dr', wallId: 'wc1', levelId: 3, view: 'plan', type: 'door', offset: 3, width: 2.5,
    sillHeight: 0, headHeight: 6.67, swingFlip: false, hingeFlip: false }],
  fixtures: [{ id: 'loo', wallId: 'wc2', levelId: 3, view: 'plan', kind: 'toilet', offset: 3, width: 1.7, depth: 2.4, side: 1 }],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [],
  stairs: [{ id: 7, start: { x: -6, y: 0, z: 3 }, end: { x: 4, y: 0, z: 3 }, levelId: 3,
    view: 'plan', widthFt: 3, riseFt: 9, risers: 14, treadRunIn: 10, shape: 'straight', turn: 'right' }],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [{ id: 'group-1', name: 'WC 1', fixed: true, stretchBehavior: 'rigid',
    members: [{ type: 'wall', id: 'wc1' }, { type: 'wall', id: 'wc2' }] }],
  levelLocks: [], underlays: [],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // The LEVELS panel folded away: it stands over the right of the plan.
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function pickStair(page, at) {
  for (const z of [3.8, 2.2, 3.2, 2.8]) {
    await click(page, at, -1, z);
    if (await page.locator('#delete').isVisible()) return;
  }
  throw new Error('the stair would not pick');
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const r3 = n => Math.round(n * 1000) / 1000 + 0;
const ends = (d, id) => { const w = d.walls.find(x => x.id === id); return [r3(w.start.x), r3(w.start.z), r3(w.end.x), r3(w.end.z)]; };
const flip = async (page, axis) => {
  await page.locator('#model-flip').click();
  await expect(page.locator('#flip-bar')).toBeVisible();
  await page.locator(`[data-flip-axis="${axis}"]`).click();
  await page.waitForTimeout(100);
};

test('a WC selected: FLIP in the foot beside ROTATE, its row over the verbs; left for right mirrors it whole about its middle and swaps every side', async ({ page }) => {
  const { at } = await open(page);
  // ONE WALL OF THE WC PICKED IS THE WC PICKED, clear of its door.
  await click(page, at, 6, 0);
  await expect(page.locator('#delete')).toBeVisible();
  await expect(page.locator('#model-rotate')).toBeVisible();
  await expect(page.locator('#model-flip')).toBeVisible();
  await page.locator('#model-flip').click();
  await expect(page.locator('#flip-bar')).toBeVisible();
  await expect(page.locator('#delete'), 'the row covers the verbs').toBeHidden();
  await expect(page.locator('#model-rotate')).toBeHidden();
  await page.locator('[data-flip-axis="x"]').click();
  await page.waitForTimeout(100);
  await expect(page.locator('#strip-message')).toContainText('Flipped left for right');
  const d = await saved(page);
  expect(ends(d, 'wc1'), 'mirrored about x = 4').toEqual([8, 0, 0, 0]);
  expect(ends(d, 'wc2')).toEqual([0, 0, 0, 6]);
  expect(ends(d, 'house'), 'the house wall it shared a corner with stays').toEqual([-10, 0, 0, 0]);
  expect(d.walls.find(w => w.id === 'wc1').refLine, 'drawn by its right line now').toBe('right');
  expect(d.fenestrations.find(o => o.id === 'dr').swingFlip, 'the door swings the other way').toBe(true);
  expect(d.fenestrations.find(o => o.id === 'dr').hingeFlip, 'and keeps its jamb').toBe(false);
  expect(d.fixtures.find(f => f.id === 'loo').side, 'the toilet on the other face').toBe(-1);
  await page.locator('[data-flip-done]').click();
  await expect(page.locator('#delete'), 'DONE puts the row down').toBeVisible();
});

test('top for bottom, and one UNDO puts the lot back', async ({ page }) => {
  const { at } = await open(page);
  // ONE WALL OF THE WC PICKED IS THE WC PICKED, clear of its door.
  await click(page, at, 6, 0);
  await flip(page, 'z');
  let d = await saved(page);
  expect(ends(d, 'wc1'), 'mirrored about z = 3').toEqual([0, 6, 8, 6]);
  expect(ends(d, 'wc2')).toEqual([8, 6, 8, 0]);
  expect(d.walls.find(w => w.id === 'wc1').refLine).toBe('right');
  expect(d.fixtures.find(f => f.id === 'loo').side).toBe(-1);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(ends(d, 'wc1'), 'back').toEqual([0, 0, 8, 0]);
  expect(ends(d, 'wc2')).toEqual([8, 0, 8, 6]);
  expect(d.walls.find(w => w.id === 'wc1').refLine).toBe('left');
  expect(d.fenestrations.find(o => o.id === 'dr').swingFlip).toBe(false);
  expect(d.fixtures.find(f => f.id === 'loo').side).toBe(1);
  expect(d.walls.find(w => w.id === 'house').end, 'the shared corner joined again')
    .toEqual(expect.objectContaining({ x: 0, z: 0 }));
});

test('a stair flipped end for end turns the other way', async ({ page }) => {
  const { at } = await open(page);
  await pickStair(page, at);
  await flip(page, 'x');
  const d = await saved(page);
  const s = d.stairs.find(x => x.id === 7);
  expect([r3(s.start.x), r3(s.end.x)], 'mirrored about x = -1').toEqual([4, -6]);
  expect(s.turn, 'a right turn is a left turn in the mirror').toBe('left');
});

// CROWDED, THE VERBS DRAW IN. CI's 1280-wide window: six verbs at the full
// padding (UNDO DELETE BREAK MOVE ROTATE FLIP) are 389px against the 301px
// between the pages and the trio, and the centred row landed on the BONE,
// which then took the press meant for it (model-one-building, "Save writes
// the drawing that is being replaced"). seatFootVerbs() puts the row in its
// tight styling when the full one does not fit, and the row stays its margin
// clear of the trio on the right and the pages on the left.
test('crowded, the verbs draw in and leave the BONE clear', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { at } = await open(page);
  await click(page, at, 6, 0);
  await expect(page.locator('#model-flip')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const r = sel => document.querySelector(sel).getBoundingClientRect();
    const box = document.querySelector('#dt-verbs');
    const v = r('#dt-verbs'), t = r('#dt-trio'), p = r('#page-row');
    const shown = [...box.querySelectorAll(':scope > button')].filter(b => !b.hidden).length;
    return { verbs: shown >= 5, tight: !!box.dataset.tight,
      clear: v.right + 10 <= t.left + 0.5 && v.left >= p.right + 10 - 0.5 };
  })).toEqual({ verbs: true, tight: true, clear: true });
  // And the BONE takes its press.
  await page.locator('#bone').click({ timeout: 5000 });
  await expect(page.locator('#drivethru')).not.toHaveAttribute('data-shut', '');
});
