// A HOLOGRAM'S CORNERS ARE NODES TO DRAW FROM (Movie, 25 Oct: "i'd like to
// snap the startpoint of my line to the corner of the hologram (if i go
// withing the purple ring, and click to set a new node i'd like it to be
// placed exactly where the node circled by the purple ring"). Its coloured
// corner rings and its walls' own ends catch a wall's or a line's point.
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
const r3 = n => Math.round(n * 1000) / 1000 + 0;
async function drawWall(page, at, from, to) {
  await page.keyboard.press('w');
  await page.waitForTimeout(80);
  await page.mouse.move(...at(...from));
  await page.waitForTimeout(80);
  await page.mouse.click(...at(...from));
  await page.waitForTimeout(80);
  await page.mouse.move(...at(...to));
  await page.waitForTimeout(80);
  await page.mouse.click(...at(...to));
  await page.waitForTimeout(80);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
}

test('a wall started a hair off a hologram wall\'s end starts exactly on it', async ({ page }) => {
  const { at } = await open(page);
  // THE FIRST SUITE'S CORNER at (20, 15): no wall of the drawing's own is there.
  await drawWall(page, at, [20.05, 15.04], [28, 15.04]);
  const d = await saved(page);
  const made = d.walls.filter(w => !['a', 'b', 'c', 'd'].includes(w.id));
  expect(made.length, 'one wall drawn').toBeGreaterThan(0);
  expect([r3(made[0].start.x), r3(made[0].start.z)]).toEqual([20, 15]);
});

test('a wall started inside a hologram\'s coloured corner ring starts exactly on the ring\'s point', async ({ page }) => {
  const { at } = await open(page);
  const ring = await page.evaluate(async () => {
    const saved = JSON.parse(await (await window.SharedFileStore.loadSharedFile('model-drawing')).text());
    const holo = saved.holograms[0];
    const nodes = window.DraftHologram.suiteSuperNodes(holo, 3);
    // THE ONE AT THE SUITE'S BOTTOM RIGHT, nearest (20, 15).
    return nodes.map(n => n.point).sort((a, b) => Math.hypot(a.x - 20, a.z - 15) - Math.hypot(b.x - 20, b.z - 15))[0];
  });
  expect(ring, 'the suite has corner rings').toBeTruthy();
  await drawWall(page, at, [ring.x + 0.04, ring.z + 0.03], [ring.x + 8, ring.z + 0.03]);
  const d = await saved(page);
  const made = d.walls.filter(w => !['a', 'b', 'c', 'd'].includes(w.id));
  expect([r3(made[0].start.x), r3(made[0].start.z)]).toEqual([r3(ring.x), r3(ring.z)]);
});
