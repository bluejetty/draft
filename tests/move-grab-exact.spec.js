// MOVE TAKES HOLD OF AN EXACT CORNER AND PUTS IT ON AN EXACT CORNER (Movie,
// 25 Oct).
//
// "when i put in a bathroom or kitchen i'd like to snap the inside corner of
// the WC and move it to the inside corner where the 2x6 wall meets the 2x4
// wall, but something doesn't allow this to happen and i get it off a little
// each time" -- and "i'd like to pick the point where i scroll over, the
// 'node or intersection' is given a CIRCLE, if there is a CIRCLE and i click
// the circle it click on the exact intersection or node and allow me to
// place that node EXACTLY onto another intersection or node in the same way".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const W = (id, a, b, type) => ({ id, start: P(...a), end: P(...b), levelId: 3, view: 'plan',
  wallType: type, refLine: 'center', baseHeight: 0, topHeight: 8 });
// The house's corner: a 2x6 down the west, a 2x4 along the north, meeting at
// the origin. The WC: two 2x4s in an L, off to the south-east.
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [W('x6', [0, 0], [0, 20], 'stud_2x6'), W('x4', [0, 0], [15, 0], 'stud_2x4'),
    W('wa', [20, 20], [26, 20], 'stud_2x4'), W('wb', [20, 20], [20, 26], 'stud_2x4')],
  lines: [], fixtures: [], fenestrations: [], dimensions: [], floors: [], roofs: [], outlines: [], shapes: [],
  surfaceOpenings: [], notes: [], stairs: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
// The inside face corner of a pair of walls: the face corner on the inside
// of their L, worked out by the page's own geometry.
const insideCorner = (page, ids, quadrant) => page.evaluate(({ ids, quadrant }) => {
  const ws = drawing.walls.filter(w => ids.includes(w.id));
  const cs = window.DraftGeometry2D.wallFaceCorners(ws, openingThicknessFt());
  const [qx, qz, ox, oz] = quadrant;
  return cs.filter(c => Math.sign(c.x - ox) === qx && Math.sign(c.z - oz) === qz)
    .sort((a, b) => Math.hypot(a.x - ox, a.z - oz) - Math.hypot(b.x - ox, b.z - oz))[0];
}, { ids, quadrant });

test('the WC taken by its inside corner lands exactly on the inside corner of a 2x6 meeting a 2x4', async ({ page }) => {
  const { at } = await open(page);
  const wc = await insideCorner(page, ['wa', 'wb'], [1, 1, 20, 20]);
  const target = await insideCorner(page, ['x6', 'x4'], [1, 1, 0, 0]);
  expect(wc && target).toBeTruthy();
  await page.evaluate(() => setSelection(drawing.walls.filter(w => w.id === 'wa' || w.id === 'wb')
    .map(item => ({ type: 'wall', item }))));
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('m');
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
  // Two pixels each way off the corner (inside a node's reach, floored at
  // 4 px): the circle sits on the corner exactly.
  const off = 2 / (await h.planFrame(page)).scale;
  await page.mouse.move(...at(wc.x + off, wc.z + off), { steps: 3 });
  await page.waitForTimeout(100);
  const grab = JSON.parse(await page.locator('#plan').getAttribute('data-move-grab') || 'null');
  expect(grab, 'the circle is on the WC\'s inside corner').toEqual([Number(wc.x.toFixed(4)), Number(wc.z.toFixed(4))]);
  await page.mouse.down();
  // Dropped between the house's inside corner and the 2x6's centre node,
  // nearer the corner -- where the magnet's node-first rule would take the
  // node (its reach is the longer).
  const drop = { x: target.x + 0.47 * (0 - target.x), z: target.z + 0.47 * (0 - target.z) };
  await page.mouse.move(...at(drop.x, drop.z), { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(150);
  // The WC's inside corner now: its face corner nearest where it was sent.
  const landed = await page.evaluate(t => {
    const ws = drawing.walls.filter(w => w.id === 'wa' || w.id === 'wb');
    return window.DraftGeometry2D.wallFaceCorners(ws, openingThicknessFt())
      .sort((a, b) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(b.x - t.x, b.z - t.z))[0];
  }, target);
  expect(landed.x, 'exactly on, across').toBeCloseTo(target.x, 6);
  expect(landed.z, 'exactly on, down').toBeCloseTo(target.z, 6);
});

test('off any corner, no circle, and the press takes hold where it falls', async ({ page }) => {
  const { at } = await open(page);
  await page.evaluate(() => setSelection(drawing.walls.filter(w => w.id === 'wa' || w.id === 'wb')
    .map(item => ({ type: 'wall', item }))));
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('m');
  await page.mouse.move(...at(23, 20), { steps: 3 });
  await page.waitForTimeout(100);
  await expect(page.locator('#plan')).not.toHaveAttribute('data-move-grab', /./);
});

// THE FLOORING'S CORNER TOO (Movie, 25 Oct: "i had a hard time getting the
// flooring area shape to locate exactly onto the inside corner, if we could
// make it similar too"): a room tag's corner dropped by the inside corner of
// a 2x6 meeting a 2x4 lands on that corner, not on the wall's centre node.
test('a flooring corner dropped by the inside corner of a 2x6 and a 2x4 lands on it exactly', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const f = { ...drawing(), roomTags: [{ id: 1, at: { x: 6, z: 6 }, levelId: 3, view: 'plan', name: 'WC',
    areaSqFt: 0, stamped: true, points: [{ x: 4, z: 4 }, { x: 8, z: 4 }, { x: 8, z: 8 }, { x: 4, z: 8 }] }],
  nextRoomTagId: 2 };
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // Close in on the corner, so a few pixels is a fraction of the 2x6.
  await page.evaluate(() => { view.cx = 2; view.cz = 2; view.scale = 60; paint(); });
  const { at, scale } = await h.planFrame(page);
  const target = await insideCorner(page, ['x6', 'x4'], [1, 1, 0, 0]);
  const off = 5 / scale;
  // Picked first, so the press on its corner takes the corner.
  await page.mouse.click(...at(6, 6));
  await page.waitForTimeout(100);
  const [x0, y0] = at(4, 4), [x1, y1] = at(target.x - off, target.z - off);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 - 6, y0 - 6);
  await page.mouse.move(x1, y1, { steps: 8 });
  // The circle shows where it will land before the hand lets go.
  const lit = JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet') || 'null');
  expect(lit?.at).toEqual([Number(target.x.toFixed(4)), Number(target.z.toFixed(4))]);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const p = await page.evaluate(() => drawing.roomTags[0].points[0]);
  expect(p.x).toBeCloseTo(target.x, 6);
  expect(p.z).toBeCloseTo(target.z, 6);
});

// A WALL RUN INTO THE SIDE OF ANOTHER -- a T (Movie, 28 Oct: "the inside
// corner node where i want to attach the kitchen isn't node snapping or
// showing the circle" -- a 2x6 run into the middle of an ICF wall, "i'm
// pointing a blue line at the corner that i want to attach the inside corner
// of the kitchen wall").
test('a 2x6 run into the side of an ICF wall makes its inside corner a node: the kitchen\'s inside corner lands on it exactly', async ({ page }) => {
  const d = drawing();
  d.walls = [W('icf', [0, -10], [0, 20], 'icf'), W('t6', [-12, 0], [0, 0], 'stud_2x6'),
    W('wa', [20, 20], [26, 20], 'stud_2x4'), W('wb', [20, 20], [20, 26], 'stud_2x4')];
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: d });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at, scale } = await h.planFrame(page);
  // The T's inside corner on the south side: the ICF's west face, the 2x6's
  // south face.
  const target = { x: -11.25 / 24, z: 5.5 / 24 };
  const nodes = await page.evaluate(() => wallFaceNodes());
  expect(nodes.some(n => Math.hypot(n.x - target.x, n.z - target.z) < 1e-6), 'the T makes its inside corner').toBe(true);
  const wc = await insideCorner(page, ['wa', 'wb'], [1, 1, 20, 20]);
  await page.evaluate(() => setSelection(drawing.walls.filter(w => w.id === 'wa' || w.id === 'wb')
    .map(item => ({ type: 'wall', item }))));
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('m');
  const off = 2 / scale;
  await page.mouse.move(...at(wc.x + off, wc.z + off), { steps: 3 });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.mouse.move(...at(target.x - off, target.z + off), { steps: 10 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const landed = await page.evaluate(t => {
    const ws = drawing.walls.filter(w => w.id === 'wa' || w.id === 'wb');
    return window.DraftGeometry2D.wallFaceCorners(ws, openingThicknessFt())
      .sort((a, b) => Math.hypot(a.x - t.x, a.z - t.z) - Math.hypot(b.x - t.x, b.z - t.z))[0];
  }, target);
  expect(landed.x, 'on the T\'s corner, across').toBeCloseTo(target.x, 6);
  expect(landed.z, 'and down').toBeCloseTo(target.z, 6);
});
