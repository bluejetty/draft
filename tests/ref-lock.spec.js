// A HOVERED NODE, AND SHIFT TO LINE UP ON IT (Movie, 23 Oct).
//
// "on ARCHICAD, i can SCROLL OVER a node/ or corner and i can use that 'node'
// or corner (the one o most recently scrolled over become the point if i
// press SHIFT and hold the T SQUARE will line up with that previously
// scrolled over node and i can enter a length and the length will be measured
// from that node" -- "if protractor is on at angle use that angle or T use
// 90"; let go, "the SHIFT will return the cursor to free moving"; all the
// drawing tools.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('a', [0, 0], [12, 0]), W('b', [12, 0], [12, 10])],
  lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.count() && await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const r3 = n => Math.round(n * 1000) / 1000;
const move = async (page, at, x, z) => { await page.mouse.move(...at(x, z), { steps: 4 }); await page.waitForTimeout(60); };
const press = async (page, at, x, z) => { await move(page, at, x, z); await page.mouse.click(...at(x, z)); await page.waitForTimeout(80); };
const lockAt = async page => JSON.parse(await page.locator('#plan').getAttribute('data-ref-lock') || 'null');
async function tsquare(page, on) {
  const chip = page.locator('[data-mode-tsquare]');
  const lit = /\blit\b/.test(await chip.getAttribute('class') || '');
  if (lit !== on) await chip.click();
}
const newWall = d => d.walls.find(w => !['a', 'b'].includes(w.id));

test('hovered, then SHIFT: the next point of a wall lies straight across from the node', async ({ page }) => {
  const { at } = await open(page);
  await tsquare(page, false);
  await h.armFromRail(page, 'wall');
  await press(page, at, 3, 4);
  await move(page, at, 12, 10);                 // over the node
  await move(page, at, 7, 8);                   // away from it
  await page.keyboard.down('Shift');
  await move(page, at, 6, 10.6);                // aiming across from it, a bit off
  expect(await lockAt(page), 'lined up on the node').toEqual([12, 10]);
  await page.mouse.click(...at(6, 10.6));
  await page.waitForTimeout(80);
  await page.keyboard.up('Shift');
  await page.keyboard.press('Escape');
  const w = newWall(await saved(page));
  expect(r3(w.end.z), 'straight across from the node').toBe(10);
  expect(w.end.x, 'where the hand is along it').toBeCloseTo(6, 1);
});

test('a length typed while lined up is measured from the node', async ({ page }) => {
  const { at } = await open(page);
  await tsquare(page, false);
  await h.armFromRail(page, 'wall');
  await press(page, at, 3, 4);
  await move(page, at, 12, 10);
  await page.keyboard.down('Shift');
  await move(page, at, 7, 10.4);
  await page.keyboard.up('Shift');
  await page.keyboard.type('3');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  const w = newWall(await saved(page));
  expect([r3(w.start.x), r3(w.start.z)]).toEqual([3, 4]);
  expect([r3(w.end.x), r3(w.end.z)], 'three feet from the node, toward the hand').toEqual([9, 10]);
});

test('let go of SHIFT and move: the cursor is free and the node forgotten', async ({ page }) => {
  const { at } = await open(page);
  await h.armFromRail(page, 'wall');
  await press(page, at, 3, 4);
  await move(page, at, 12, 10);
  await page.keyboard.down('Shift');
  await move(page, at, 7, 10.4);
  expect(await lockAt(page)).toEqual([12, 10]);
  await page.keyboard.up('Shift');
  await move(page, at, 6, 7);
  expect(await lockAt(page), 'free again').toBeNull();
});

test('a floor\'s corner lines up on a hovered node too', async ({ page }) => {
  const { at } = await open(page);
  await tsquare(page, false);
  await h.armFromRail(page, 'floor');
  // THE FIRST CORNER, lined up: it has no corner before it to run from.
  await move(page, at, 12, 0);
  await page.keyboard.down('Shift');
  await press(page, at, 12.3, 6);
  await page.keyboard.up('Shift');
  await move(page, at, 7, 7);
  await press(page, at, 6, 6);
  await press(page, at, 6, 9);
  await press(page, at, 12, 6);
  const d = await saved(page);
  expect(d.floors, 'one floor').toHaveLength(1);
  expect(d.floors[0].points.some(p => r3(p.x) === 12 && r3(p.z) === 6), 'a corner straight up from the node').toBe(true);
});
