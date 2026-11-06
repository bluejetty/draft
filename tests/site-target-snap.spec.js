// THE REGISTRATION TARGET IS A NODE, and the SITE's roof has nodes (Movie,
// 26 Oct: "the roof plan doesn't seem to have NODE SNAPS working - i really
// would like the REGISTRATION TARGET to have a node snap so i can position
// the property site plan properly").
//
// Asked of the page's own catch (drawSnap, what every drawn point and MOVE
// destination answers to) at a point a hair off each target.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const P = (x, z) => ({ x, y: 0, z });
// `walls: false` is a SITE drawn before the house: no wall to work the
// target out from, so the gold target painted is the file's own
// drawingOrigin -- put off 0,0 so a catch there is the file's point and not
// a default.
const house = ({ walls: withWalls = true } = {}) => ({
  version: 1, board: 'drafting', planTurn: 0, drawingOrigin: { x: 12, z: 8 },
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: withWalls ? [W('a', [0, 0], [40, 0]), W('b', [40, 0], [40, 30]), W('c', [40, 30], [0, 30]), W('d', [0, 30], [0, 0])] : [],
  // A lot line far off on the SITE: the level is not empty, so the first-
  // point bullseye pull (to this same target) is out of the question.
  // (And one on the MAIN FL, for the same reason there.)
  lines: [{ id: 'l1', levelId: 8, view: 'plan', start: P(100, 100), end: P(140, 100) },
    { id: 'l2', levelId: 3, view: 'plan', start: P(100, 100), end: P(140, 100) }], floors: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [],
  stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  roofs: withWalls ? [{ id: 'r1', levelId: 7, follows: 'house', pitch: 6, overhang: 24,
    points: [P(-2, -2), P(42, -2), P(42, 32), P(-2, 32)], edges: ['eave', 'eave', 'eave', 'eave'], edgeOverhang: [24, 24, 24, 24] }] : [],
});

async function open(page, level, file = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: house(file) });
  await page.goto(`/MODEL.html?level=${level}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // A SITE with no house asks how big the lot is; the question is not the
  // subject here.
  const notNow = page.getByRole('button', { name: 'NOT NOW' });
  if (await notNow.count() && await notNow.isVisible()) await notNow.click();
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.count() && await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(300);
}
// Where a point an inch or so off the target lands -- inside the roof's
// corner, so the nearest point of either edge is not the corner itself.
const catchNear = (page, which) => page.evaluate(which => {
  const t = which === 'target' ? siteDatumNow() : drawing.roofs[0].points[1];
  const got = drawSnap(which === 'target' ? { x: t.x + 0.07, z: t.z - 0.05 } : { x: t.x - 0.07, z: t.z + 0.05 });
  return { t: [t.x, t.z], got: got.pt ? [got.pt.x, got.pt.z] : null };
}, which);
const close = (a, b) => a && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6;

test('on the SITE the registration target catches a point exactly', async ({ page }) => {
  await open(page, 8);
  const { t, got } = await catchNear(page, 'target');
  expect(close(got, t), JSON.stringify({ t, got })).toBe(true);
});

test('on the SITE the roof\'s corners catch a point exactly', async ({ page }) => {
  await open(page, 8);
  const { t, got } = await catchNear(page, 'roof');
  expect(close(got, t), JSON.stringify({ t, got })).toBe(true);
});

test('on the SITE the roof\'s edges are lines to land on', async ({ page }) => {
  await open(page, 8);
  // The edge's own catch, not the tracking ray from its corners that
  // happens to run along it.
  const got = await page.evaluate(() => {
    const s = drawSnap({ x: 20, z: -2 + 0.04 });
    return { ...s.pt, face: Boolean(s.face) };
  });
  expect(got.face, 'caught by the edge').toBe(true);
  expect(got.z).toBeCloseTo(-2, 6);
  expect(got.x).toBeCloseTo(20, 1);
});

// ON A FLOOR PLAN THE TARGET IS THE HOUSE'S OWN OUTSIDE CORNER, worked out
// from the walls: a face corner catches there already, and a node of its own
// would catch a wall dragged by that very corner.
test('on a floor plan the target is no node of its own', async ({ page }) => {
  await open(page, 3);
  const nodes = await page.evaluate(() => {
    const t = siteDatumNow();
    return nodeEnds({ faces: false }).some(v => Math.abs(v.x - t.x) < 1e-6 && Math.abs(v.z - t.z) < 1e-6);
  });
  expect(nodes).toBe(false);
});

test('a roof on the ROOF level is no node on the MAIN FL', async ({ page }) => {
  await open(page, 3);
  const has = await page.evaluate(() => nodeEnds({ faces: false })
    .some(v => Math.abs(v.x - 42) < 1e-6 && Math.abs(v.z + 2) < 1e-6));
  expect(has).toBe(false);
});

// ── THE TARGET THAT IS PAINTED IS THE ONE THAT CATCHES ───────────────────
//
// Movie, 6 Nov, a lot line's end held on the gold target of a SITE with no
// house on it: "i thought the gold node target had SNAP with orange pulse
// earlier but not snapping now?". The painter draws gridDatum() -- the
// house's corner when there are walls to work it out from, else the file's
// own drawingOrigin -- and the node was read from the house's corner alone,
// so a target with no house behind it was drawn and caught nothing.
const where = (page, which) => page.evaluate(which => {
  const t = gridDatum();
  const got = drawSnap({ x: t.x + 0.07, z: t.z - 0.05 });
  return { t: [t.x, t.z], got: got.pt ? [got.pt.x, got.pt.z] : null, node: Boolean(got.node), bullseye: Boolean(got.bullseye) };
}, which);

test('on a SITE with no house the painted target catches a point exactly', async ({ page }) => {
  await open(page, 8, { walls: false });
  const { t, got, node } = await where(page);
  expect(t, 'the painted target is the file\'s own origin').toEqual([12, 8]);
  expect(close(got, t), JSON.stringify({ t, got })).toBe(true);
  expect(node, 'as a node, not the empty level\'s bullseye pull').toBe(true);
});

// AND THE DRAG HE MADE: MOVE, a lot line held by its end, the hand brought
// to the target, let go. The end is on the target, exactly.
test('on a SITE with no house MOVE lands a line\'s end on the target', async ({ page }) => {
  await open(page, 8, { walls: false });
  const at = (x, z) => page.evaluate(([wx, wz]) => {
    const c = document.getElementById('plan');
    const [cx, cz, scale] = c.getAttribute('data-view').trim().split(/\s+/).map(Number);
    const r = c.getBoundingClientRect();
    return [(wx - cx) * scale + r.width / 2 + r.left, (wz - cz) * scale + r.height / 2 + r.top];
  }, [x, z]);
  await page.mouse.click(...await at(120, 100));
  await expect(page.locator('#model-move')).toBeVisible();
  await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(...await at(100, 100));
  await page.mouse.down();
  // A hair off the target: within a node's two inches at any zoom the fit
  // gives this file, and not on it, so a landing there is the catch.
  await page.mouse.move(...await at(12.08, 7.92), { steps: 8 });
  await page.waitForTimeout(150);
  const lit = JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet') || 'null');
  expect(lit, 'the target lit as a node under the hand').toEqual({ kind: 'node', at: [12, 8] });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const line = await page.evaluate(() => drawing.lines.find(l => l.id === 'l1'));
  expect(line.start.x).toBeCloseTo(12, 6);
  expect(line.start.z).toBeCloseTo(8, 6);
});

// ON A FLOOR PLAN THE SAME: a target that is no wall's corner has no corner
// catching there already, so it is a node of its own. (With a house it
// stays what it was, above: the house's corner, no node.)
test('on a floor plan with no house the painted target is a node', async ({ page }) => {
  await open(page, 3, { walls: false });
  const { t, got, node } = await where(page);
  expect(t).toEqual([12, 8]);
  expect(close(got, t), JSON.stringify({ t, got })).toBe(true);
  expect(node).toBe(true);
});
