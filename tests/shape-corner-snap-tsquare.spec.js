// A SHAPE'S CORNER DRAGGED READS THE INSTRUMENTS AS A WALL'S DOES (jb, 10 Nov
// 2026: "when placing the AREA / SHAPE i'd like to be able to use the node
// snap and T Square functions, they don't seem to work for placing or
// changing the nodes in AREA / SHAPE" -- "the snap just worked when i first
// placed the AREA / SHAPE but didn't when tried to change the shape of it
// later"). Placing went through drawPoint already; a corner or midpoint
// dragged caught a wall's node and nothing else, and ignored the T-square.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const L = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, levelId: 3, view: 'plan', layer: 'LINE' });
const box = [{ x: 20, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 12 }, { x: 20, z: 12 }];
const other = [{ x: 40, z: 0 }, { x: 50, z: 0 }, { x: 50, z: 12 }, { x: 40, z: 12 }];
const drawing = (extra = {}) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('n', [0, 0], [16, 0]), W('e', [16, 0], [16, 12]), W('s', [16, 12], [0, 12]), W('w', [0, 12], [0, 0])],
  lines: [L('l1', [20, -6], [30, -6])], floors: [], roofs: [], dimensions: [], fenestrations: [], fixtures: [],
  outlines: [], shapes: [{ id: 'sh', points: box, levelId: 3, layer: 'SHAPE' }, { id: 'o', points: other, levelId: 3, layer: 'SHAPE' }],
  surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  ...extra,
});
async function open(page, skin, f = drawing()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f, skin }) => {
    try { localStorage.setItem('draft-skin', JSON.stringify(skin)); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f, skin });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.count() && await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const frame = await h.planFrame(page);
  // The one snap rule: a node catches from 2" on the plan, never under 4 px.
  expect(frame.scale).toBeGreaterThan(24);
  // PICK THE 20 x 12 SHAPE by pressing inside it.
  await page.keyboard.press('s');
  await page.mouse.click(...frame.at(25, 6));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => selection.map(s => `${s.type}:${s.item.id}`))).toEqual(['shape:sh']);
  return frame;
}
const r3 = n => Math.round(n * 1000) / 1000;
const ring = pts => pts.map(p => [r3(p.x), r3(p.z)]);
const shapePts = page => page.evaluate(() => drawing.shapes.find(s => s.id === 'sh').points);
// DRAG a handle from a world point to a screen spot `dx, dy` px off a world
// point, reading the magnet mark mid-drag.
async function drag(page, at, from, to, dx = 0, dy = 0) {
  const [sx, sy] = at(...from);
  const [ex, ey] = at(...to);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 10, sy + 10);
  await page.mouse.move(ex + dx, ey + dy, { steps: 8 });
  await page.waitForTimeout(80);
  const magnet = await page.evaluate(() => document.getElementById('plan').getAttribute('data-snap-magnet'));
  await page.mouse.up();
  await page.waitForTimeout(120);
  return magnet ? JSON.parse(magnet) : null;
}

test('T-SQUARE and 1 FT lit: a corner dragged 4 px off a wall node lands on it, and a free drag is held square on the foot', async ({ page }) => {
  const { at } = await open(page, { tsquare: true, footLight: true });
  // THE CORNER (20,12) TO THE WALL'S NODE (16,12), the hand 4 px right and
  // 3 px down of it: the square holds z, the node catches along the axis.
  const lit = await drag(page, at, [20, 12], [16, 12], 4, 3);
  expect(lit, 'the ring was on the node mid-drag').toMatchObject({ kind: 'node', at: [16, 12] });
  expect(ring(await shapePts(page))).toEqual([[20, 0], [30, 0], [30, 12], [16, 12]]);
  await expect(page.locator('#strip-message')).toContainText('The shape is');
  // THE CORNER (30,0) PULLED TO (32.4, 1.1): the longer leg wins, the foot
  // rounds the travel.
  await drag(page, at, [30, 0], [32.4, 1.1]);
  expect(ring(await shapePts(page))).toEqual([[20, 0], [32, 0], [30, 12], [16, 12]]);
  // UNDO twice puts the shape back as it was.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
  expect(ring(await shapePts(page))).toEqual(ring(box));
});

test('instruments off: a corner catches a LINE\'s end and another SHAPE\'s corner, not only a wall\'s node', async ({ page }) => {
  const { at } = await open(page, { tsquare: false, footLight: false });
  const onLine = await drag(page, at, [30, 0], [30, -6], -3, 3);
  expect(onLine).toMatchObject({ kind: 'node', at: [30, -6] });
  expect(ring(await shapePts(page))).toEqual([[20, 0], [30, -6], [30, 12], [20, 12]]);
  const onShape = await drag(page, at, [30, 12], [40, 12], 3, -3);
  expect(onShape).toMatchObject({ kind: 'node', at: [40, 12] });
  expect(ring(await shapePts(page))).toEqual([[20, 0], [30, -6], [40, 12], [20, 12]]);
  // AND A FREE DRAG LANDS WHERE THE HAND IS, nothing rounding it.
  await drag(page, at, [20, 0], [19.3, 2.2]);
  const p = (await shapePts(page))[0];
  expect(Math.abs(p.x - 19.3)).toBeLessThan(0.05);
  expect(Math.abs(p.z - 2.2)).toBeLessThan(0.05);
});

test('T-SQUARE lit: an edge midpoint pulled out grows a corner held square to where it started', async ({ page }) => {
  const { at } = await open(page, { tsquare: true, footLight: false });
  // The right edge's midpoint (30, 6) pulled to (33.3, 6.9): held level.
  await drag(page, at, [30, 6], [33.3, 6.9]);
  const pts = ring(await shapePts(page));
  expect(pts).toHaveLength(5);
  expect(pts[2][1], 'held on the midpoint\'s own z').toBe(6);
  expect(Math.abs(pts[2][0] - 33.3)).toBeLessThan(0.05);
});

test('on the SITE: a lot shape\'s corner dragged near a lot line\'s end lands on it, held square', async ({ page }) => {
  const site = drawing({
    activeLevelIdx: 0,
    walls: [],
    lines: [{ ...L('lot', [0, 0], [60, 0]), levelId: 8 }],
    shapes: [{ id: 'sh', points: box, levelId: 8, layer: 'SHAPE' }],
  });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.setItem('draft-skin', JSON.stringify({ tsquare: true, footLight: true })); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: site });
  await page.goto('/MODEL.html?level=8');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.count() && await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at, scale } = await h.planFrame(page);
  expect(scale).toBeGreaterThan(10);
  await page.keyboard.press('s');
  await page.mouse.click(...at(25, 6));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => selection.map(s => `${s.type}:${s.item.id}`))).toEqual(['shape:sh']);
  // THE CORNER (30,0) TO THE LOT LINE'S END (60,0), the hand 3 px short and
  // 2 px low: level by the square, on the node by the snap.
  const lit = await drag(page, at, [30, 0], [60, 0], -3, 2);
  expect(lit).toMatchObject({ kind: 'node', at: [60, 0] });
  expect(ring(await shapePts(page))).toEqual([[20, 0], [60, 0], [30, 12], [20, 12]]);
});
