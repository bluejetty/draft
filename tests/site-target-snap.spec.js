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
const house = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [W('a', [0, 0], [40, 0]), W('b', [40, 0], [40, 30]), W('c', [40, 30], [0, 30]), W('d', [0, 30], [0, 0])],
  // A lot line far off on the SITE: the level is not empty, so the first-
  // point bullseye pull (to this same target) is out of the question.
  lines: [{ id: 'l1', levelId: 8, view: 'plan', start: P(100, 100), end: P(140, 100) }], floors: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [],
  stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  roofs: [{ id: 'r1', levelId: 7, follows: 'house', pitch: 6, overhang: 24,
    points: [P(-2, -2), P(42, -2), P(42, 32), P(-2, 32)], edges: ['eave', 'eave', 'eave', 'eave'], edgeOverhang: [24, 24, 24, 24] }],
});

async function open(page, level) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: house() });
  await page.goto(`/MODEL.html?level=${level}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(300);
}
// Where a point an inch and a half (well inside every reach's floor) off
// `p` lands, and the target itself.
const catchNear = (page, which) => page.evaluate(which => {
  const t = which === 'target' ? siteDatumNow() : drawing.roofs[0].points[1];
  const got = drawSnap({ x: t.x + 0.07, z: t.z - 0.05 });
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
  const got = await page.evaluate(() => drawSnap({ x: 20, z: -2 + 0.04 }).pt);
  expect(got.z).toBeCloseTo(-2, 6);
  expect(got.x).toBeCloseTo(20, 1);
});

test('on a floor plan the target is a node too', async ({ page }) => {
  await open(page, 3);
  const nodes = await page.evaluate(() => {
    const t = siteDatumNow();
    return nodeEnds({ faces: false }).some(v => Math.abs(v.x - t.x) < 1e-6 && Math.abs(v.z - t.z) < 1e-6);
  });
  expect(nodes).toBe(true);
});

test('a roof on the ROOF level is no node on the MAIN FL', async ({ page }) => {
  await open(page, 3);
  const has = await page.evaluate(() => nodeEnds({ faces: false })
    .some(v => Math.abs(v.x - 42) < 1e-6 && Math.abs(v.z + 2) < 1e-6));
  expect(has).toBe(false);
});
