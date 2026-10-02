// THE GOLD TARGET IS THE SITE POINT: where the front and the left outside
// foundation faces meet.
//
// Movie, 1 Oct: "that GOLD TARGET should always be in the position where it is
// inline with both the FRONT and LEFT side of the house", on the "face of
// foundation", "front of garage grade beam if garage", and "the house
// shouldn't move ... the gold target should move to align itself".
//
// READ OFF THE STATUS READOUT, which prints the datum the grid and the marker
// both use -- the number, not a picture of a crosshair.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const FDN = 1, MAIN_FL = 3;
// concrete_8 is 8" thick; drawn on its CENTRE line, each face is 4" off it.
const HALF = 4 / 12;

const wall = (id, levelId, view, wallType, x0, z0, x1, z1, extra = {}) => ({
  id, levelId, view, wallType, refLine: 'center', baseHeight: 0, topHeight: 8,
  start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 }, ...extra,
});
const box = (prefix, levelId, view, wallType, x0, z0, x1, z1, extra) => [
  wall(`${prefix}-n`, levelId, view, wallType, x0, z0, x1, z0, extra),
  wall(`${prefix}-e`, levelId, view, wallType, x1, z0, x1, z1, extra),
  wall(`${prefix}-s`, levelId, view, wallType, x1, z1, x0, z1, extra),
  wall(`${prefix}-w`, levelId, view, wallType, x0, z1, x0, z0, extra),
];
const drawingWith = (walls, extra = {}) => ({
  format: 'draft-drawing', version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: FDN, name: 'FOUNDATION', elev: -10 },
  ],
  walls, board: 'drafting', ...extra,
});

async function datumOf(page, saved) {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved });
  await page.goto(`/MODEL.html?mode=night&level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('datum', { timeout: 10000 });
  const text = await page.locator('#readout').textContent();
  const m = text.match(/datum (-?[\d.]+),(-?[\d.]+) \(front-left of foundation\)/);
  expect(m, `the readout names the site point: ${text}`).toBeTruthy();
  return { x: Number(m[1]), z: Number(m[2]) };
}

const FOUNDATION = box('f', FDN, 'foundation', 'concrete_8', -10, -8, 10, 8);

test('the front (E1, south) and left (E2, west) outside foundation faces cross at the target', async ({ page }) => {
  const d = await datumOf(page, drawingWith(FOUNDATION));
  expect(d.x).toBeCloseTo(-10 - HALF, 2);
  expect(d.z).toBeCloseTo(8 + HALF, 2);
});

test('the house stays put and the target follows a front pushed out', async ({ page }) => {
  const pushed = box('f', FDN, 'foundation', 'concrete_8', -10, -8, 10, 12);
  const d = await datumOf(page, drawingWith(pushed));
  expect(d.x).toBeCloseTo(-10 - HALF, 2);
  expect(d.z, 'the front moved 4 ft and the target with it').toBeCloseTo(12 + HALF, 2);
});

test('a garage grade beam in front of the house is the front', async ({ page }) => {
  const garage = box('g', FDN, 'foundation', 'concrete_8', 10, 2, 22, 14, { body: 'garage' });
  const d = await datumOf(page, drawingWith([...FOUNDATION, ...garage]));
  expect(d.z, 'the garage stands 6 ft proud of the house front').toBeCloseTo(14 + HALF, 2);
  expect(d.x, 'and the house is still the left side').toBeCloseTo(-10 - HALF, 2);
});

test('a turned house takes its target with it: E1 west, E2 north', async ({ page }) => {
  const d = await datumOf(page, drawingWith(FOUNDATION, { planTurn: 1 }));
  expect(d.x).toBeCloseTo(-10 - HALF, 2);
  expect(d.z).toBeCloseTo(-8 - HALF, 2);
});

test('with no foundation yet, the main floor walls stand in', async ({ page }) => {
  const main = box('m', MAIN_FL, 'plan', 'concrete_8', -6, -5, 6, 5);
  const d = await datumOf(page, drawingWith(main));
  expect(d.x).toBeCloseTo(-6 - HALF, 2);
  expect(d.z).toBeCloseTo(5 + HALF, 2);
});
