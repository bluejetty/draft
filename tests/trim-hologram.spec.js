// TRIM AND EXTEND AT A HOLOGRAM'S WALL (Movie, 25 Oct: "looks like the TRIM
// won't work against a HOLOGRAM wall"). A hologram's walls on the level are
// cutting edges like the drawing's own -- edges only: the hologram is locked,
// so it is never trimmed, moved or cornered with.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
// A 20 x 15 SUITE drawn from (0,0); two of it in a 60 x 30 shell, side by
// side along the bottom wall, the second 30' along.
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('s1', [0, 0], [20, 0]), W('s2', [20, 0], [20, 15]), W('s3', [20, 15], [0, 15]), W('s4', [0, 15], [0, 0])] };
const holo = (id, x) => ({ id, name: 'suite-a', mode: 'suite', x, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7.5, source: SUITE });
const shell = () => ({ version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('a', [0, 0], [60, 0]), W('b', [60, 0], [60, 30]), W('c', [60, 30], [0, 30]), W('d', [0, 30], [0, 0])],
  holograms: [holo('h1', 0), holo('h2', 30)] });

async function open(page, f = shell()) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function drag(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const r2 = n => Math.round(n * 100) / 100 + 0;
// THE DRAWING'S OWN WALL, running through the first suite's right wall (x 20).
const withRun = (p) => ({ ...shell(), walls: [...shell().walls, p] });
const P = W('p', [10, 7.5], [26, 7.5]);
const strip = page => page.locator('#strip-message');

test('TRIM with nothing picked cuts a wall at a hologram\'s wall, to its face, and leaves the hologram as it was', async ({ page }) => {
  const { at } = await open(page, withRun(P));
  await page.keyboard.press('q');
  await page.waitForTimeout(100);
  await click(page, at, 23, 7.5);
  await expect(strip(page)).toContainText('Trimmed.');
  const d = await saved(page);
  const p = d.walls.find(w => w.id === 'p');
  expect(r2(p.start.x)).toBe(10);
  // TO THE SUITE WALL'S FACE: short of its centre line at 20 by half a 2x6.
  expect(p.end.x).toBeGreaterThan(19.5);
  expect(p.end.x).toBeLessThan(20);
  expect(d.holograms.map(holo => [holo.id, holo.x, holo.z]), 'the holograms untouched').toEqual([['h1', 0, 0], ['h2', 30, 0]]);
});

test('EXTEND runs a wall on to a hologram\'s wall', async ({ page }) => {
  const { at } = await open(page, withRun(W('q', [24, 7.5], [28, 7.5])));
  await page.keyboard.press('q');
  await page.waitForTimeout(100);
  await page.keyboard.down('Shift');
  await click(page, at, 24.5, 7.5);
  await page.keyboard.up('Shift');
  await expect(strip(page)).toContainText('Extended');
  const q = (await saved(page)).walls.find(w => w.id === 'q');
  expect(q.start.x, 'run on to the suite wall at x 20, stopping at its face').toBeGreaterThan(20);
  expect(q.start.x).toBeLessThan(20.5);
});

test('near a hologram wall\'s end, EXTEND still stops at its face: no corner, the hologram\'s wall untouched', async ({ page }) => {
  const { at } = await open(page, withRun(W('q', [24, 14.2], [28, 14.2])));
  await page.keyboard.press('q');
  await page.waitForTimeout(100);
  await page.keyboard.down('Shift');
  await click(page, at, 24.5, 14.2);
  await page.keyboard.up('Shift');
  await expect(strip(page)).toContainText('Extended.');
  const d = await saved(page);
  const q = d.walls.find(w => w.id === 'q');
  expect(r2(q.start.z), 'along its own line').toBe(14.2);
  expect(q.start.x).toBeGreaterThan(20);
  expect(d.holograms[0].source.walls.map(w => [w.start.x, w.start.z, w.end.x, w.end.z]))
    .toEqual([[0, 0, 20, 0], [20, 0, 20, 15], [20, 15, 0, 15], [0, 15, 0, 0]]);
});
