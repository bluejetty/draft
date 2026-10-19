// A MOVED WALL'S FACES SEEK: ANOTHER WALL'S FACE, A NODE, A CORNER THAT ACTS
// LIKE ONE (Movie, 19 Oct).
//
// "the YELLOW/ GREEN NEON color will be for WALL SURFACES which will also be
// magnetic for other wall surfaces/ nodes/ and 'act like' nodes."
//
// A wall dragged by its body snapped by its ENDS to a corner and by nothing
// else: the two faces it carries felt no pull, so lining a suite wall's face
// up with the shell's was a matter of zooming in and reading the inches. Now
// each face feels the three tiers across the run -- a parallel face in neon
// reach, a node, a corner that acts like one -- and the wall slides across
// its run by the shortfall. Its own face that did the lining up glows with
// what caught it, so the hand sees which of the two it was.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, wallType = 'stud_2x6') => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType, refLine: 'center' });
const HALF6 = 2.75 / 12;
const HALF4 = 1.75 / 12;
const drawing = walls => ({
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  nextDrawingItemId: 50,
  walls, lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function zoomTo(page, target) {
  const box = await page.locator('#plan').boundingBox();
  const { scale } = await h.planFrame(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -Math.log(target / scale) / 0.0015);
  await page.waitForTimeout(120);
  const frame = await h.planFrame(page);
  expect(Math.abs(frame.scale - target)).toBeLessThan(target * 0.05);
  return frame;
}
const magnet = async page => JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet') || 'null');
const r3 = n => Math.round(n * 1000) / 1000;
// SELECT the wall at `grab`, then drag its body by (dx, dz) feet and hold.
async function dragBody(page, at, grab, dx, dz) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.mouse.click(...at(...grab));
  await page.waitForTimeout(60);
  await page.mouse.move(...at(...grab));
  await page.mouse.down();
  await page.mouse.move(...at(grab[0] + dx, grab[1] + dz), { steps: 8 });
  await page.waitForTimeout(80);
}
async function release(page) {
  await page.mouse.up();
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
// A 2x6 standing up x = 10, and a free 2x4 to its right, further along, so
// no end of one is near any end of the other: only the faces can line up.
const STANDING = W('w1', [10, 0], [10, 8]);
const FREE = W('w3', [13, 10], [13, 14], 'stud_2x4');

test('a dragged wall slides across its run until its face lines up with another wall\'s, and both faces glow', async ({ page }) => {
  await open(page, drawing([STANDING, FREE]));
  const { at } = await zoomTo(page, 52);
  // Left by 3.07 ft: the 2x4's left face lands 0.013 ft (under a pixel)
  // right of the 2x6's left face at x = 10 - HALF6 and is pulled onto it.
  await dragBody(page, at, [13, 12], -3.07, 0);
  const lit = await magnet(page);
  expect(lit?.kind).toBe('face');
  expect(lit.own.map(p => r3(p[0]))).toEqual([r3(10 - HALF6), r3(10 - HALF6)]);
  const w3 = (await release(page)).walls.find(w => w.id === 'w3');
  expect([r3(w3.start.x), r3(w3.end.x)]).toEqual([r3(10 - HALF6 + HALF4), r3(10 - HALF6 + HALF4)]);
  expect([w3.start.z, w3.end.z]).toEqual([10, 14]);
});

test('a dragged wall\'s face passes through a node, and takes the orange', async ({ page }) => {
  // A 2x6 L whose inner node (10, 8) stands inside the free wall's length.
  await open(page, drawing([W('w1', [0, 0], [10, 0]), STANDING, W('w3', [6, 11], [12, 11], 'stud_2x4')]));
  const { at } = await zoomTo(page, 52);
  // Up by 2.84 ft: the top face lands at 8.014, a hair under the node.
  await dragBody(page, at, [9, 11], 0, -2.84);
  const lit = await magnet(page);
  expect(lit?.kind).toBe('node');
  expect(lit.at).toEqual([10, 8]);
  const w3 = (await release(page)).walls.find(w => w.id === 'w3');
  expect([r3(w3.start.z), r3(w3.end.z)]).toEqual([r3(8 + HALF4), r3(8 + HALF4)]);
});

test('a face that catches beats the foot light', async ({ page }) => {
  await open(page, drawing([STANDING, FREE]));
  const { at } = await zoomTo(page, 52);
  await page.locator('[data-mode-scale]').click();
  await expect(page.locator('[data-mode-scale]')).toHaveClass(/lit/);
  // The foot alone would make -3.07 a round -3 and leave the face 0.083 ft
  // off; the face catches first and holds.
  await dragBody(page, at, [13, 12], -3.07, 0);
  expect((await magnet(page))?.kind).toBe('face');
  const w3 = (await release(page)).walls.find(w => w.id === 'w3');
  expect(r3(w3.start.x)).toBe(r3(10 - HALF6 + HALF4));
});

test('a wall joined to the moving one offers no face', async ({ page }) => {
  // The free wall's bottom end is joined to a stub running straight on from
  // it; the stub's corner travels with the drag, so its faces -- in line with
  // the moving wall's own where the drag began -- must not be targets. Were
  // they, a nudge of five pixels would be pulled straight back to where it
  // started: a wall that refuses to move, chasing itself.
  const stub = W('w4', [13, 14], [13, 18], 'stud_2x4');
  await open(page, drawing([STANDING, FREE, stub]));
  const { at } = await zoomTo(page, 52);
  await dragBody(page, at, [13, 12], -0.1, 0);
  expect(await magnet(page)).toBeNull();
  const w3 = (await release(page)).walls.find(w => w.id === 'w3');
  expect(r3(w3.start.x)).toBe(12.9);
});
