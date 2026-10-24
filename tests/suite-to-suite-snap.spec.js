// A SUITE'S CORNERS CLICK ONTO ANOTHER SUITE'S (Movie, 23 Oct).
//
// "when i am putting the suites in, at the corner points with the circle
// nodes, when they come close to another suite circle corner node can they
// 'GLOW' and be 'MAGNETIC SNAP (no matter where the cursor is grabbing or
// placing the SUITE,, if those corners come close, plase magnet snap and
// glock snap within about 4" radius 8" diameter (pretty strong".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const SN = (id, x, z) => ({ id, levelId: 3, view: 'plan', point: { x, y: 0, z } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], superNodes: [] };
// A 20 x 15 suite with a super node on each corner.
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('s1', [0, 0], [20, 0]), W('s2', [20, 0], [20, 15]), W('s3', [20, 15], [0, 15]), W('s4', [0, 15], [0, 0])],
  superNodes: [SN('c1', 0, 0), SN('c2', 20, 0), SN('c3', 20, 15), SN('c4', 0, 15)] };
// h1 at the origin, h2 standing forty across; no house super nodes at all.
const plan = (h2 = {}) => ({
  version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  nextDrawingItemId: 20,
  holograms: [
    { id: 'h1', name: 'suite-a', mode: 'suite', x: 0, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7.5, source: SUITE },
    { id: 'h2', name: 'suite-b', mode: 'suite', x: 40, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7.5, source: SUITE, ...h2 },
  ] });

async function open(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto('/MODEL.html?level=3&left=1');
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
const lockAt = async page => JSON.parse(await page.locator('#plan').getAttribute('data-super-lock') || 'null');
async function grab(page, at, from) {
  await page.locator('[data-mode-hologram]').click();
  // TWO COPIES ON THE CARD: h1's row picked opens its buttons.
  await page.locator('#hologram-ask [data-hologram-row="h1"]').click();
  await page.locator('#hologram-ask [data-hologram-move="h1"]').click();
  await page.mouse.move(...at(...from));
  await page.mouse.down();
}
const to = async (page, at, pt) => { await page.mouse.move(...at(...pt), { steps: 8 }); await page.waitForTimeout(100); };
const drop = async page => { await page.mouse.up(); await page.waitForTimeout(150); };

test('within 4": the suite\'s corner clicks onto the other suite\'s, wherever the hand holds it', async ({ page }) => {
  const { at } = await open(page, plan());
  // Held by its top, well away from the corner: its right corner stops
  // three inches short of the other suite's left corner and is pulled on.
  await grab(page, at, [14, 13]);
  await to(page, at, [14 + 19.75, 13]);
  expect(await lockAt(page), 'the other suite\'s corner holding it').toEqual([40, 0]);
  await drop(page);
  const d = await saved(page);
  expect([r3(d.holograms[0].x), r3(d.holograms[0].z)], 'corner to corner').toEqual([20, 0]);
});

test('six inches short, nothing catches', async ({ page }) => {
  const { at } = await open(page, plan());
  await grab(page, at, [10, 7.5]);
  await to(page, at, [10 + 19.5, 7.5]);
  expect(await lockAt(page)).toBeNull();
  await drop(page);
  const d = await saved(page);
  expect(d.holograms[0].x).toBeCloseTo(19.5, 1);
});

test('once caught it holds through a wobble of six inches, and lets go past eight', async ({ page }) => {
  const { at } = await open(page, plan());
  await grab(page, at, [10, 7.5]);
  await to(page, at, [10 + 19.9, 7.5]);
  expect(await lockAt(page), 'caught').toEqual([40, 0]);
  await to(page, at, [10 + 19.5, 7.5]);
  expect(await lockAt(page), 'still held six inches back').toEqual([40, 0]);
  await to(page, at, [10 + 19.1, 7.5]);
  expect(await lockAt(page), 'let go past eight inches').toBeNull();
  await drop(page);
  const d = await saved(page);
  expect(d.holograms[0].x).toBeCloseTo(19.1, 1);
});

// "all suites attrached and glow for all other suites" -- a blue one too.
test('a blue hologram\'s corner rings are magnetic too', async ({ page }) => {
  const { at } = await open(page, plan({ mode: 'hologram' }));
  await grab(page, at, [10, 7.5]);
  await to(page, at, [10 + 19.9, 7.5]);
  expect(await lockAt(page)).toEqual([40, 0]);
  await drop(page);
});
