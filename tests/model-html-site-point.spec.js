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

// ── ON A BONEYARD SHELF, THE SUITE'S OWN CORNER (Movie, 22 Oct) ───────────
// On his 1BDEN suite: "also in the SHELF can the registration lower right
// corner auto place itself like it does for a house". The shelf reads its
// own walls the same way: the target on the suite's front-and-left corner,
// following the suite when it moves -- and the house's target stays the
// house's on the house's floors.
async function shelfDatum(page, saved) {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved });
  await page.goto(`/MODEL.html?mode=night&level=${MAIN_FL}&right=1`);
  await expect(page.locator('#readout')).toContainText('datum', { timeout: 10000 });
  await page.locator('[data-boneyard]').click();
  await page.waitForTimeout(300);
  const text = await page.locator('#readout').textContent();
  const m = text.match(/datum (-?[\d.]+),(-?[\d.]+) \(front-left of the shelf\)/);
  expect(m, `the readout names the shelf's point: ${text}`).toBeTruthy();
  return { x: Number(m[1]), z: Number(m[2]) };
}
const SHELF_SUITE = (x0, z0) => box('s', -1, 'plan', 'stud_2x6', x0, z0, x0 + 20, z0 + 14);
const SHELVES = { boneyardShelves: [{ id: 1, name: '1BDEN' }], activeBoneyardShelfId: 1, nextBoneyardShelfId: 2 };
const STUD_HALF = 5.5 / 24;

test('on a shelf the target stands on the suite\'s front-and-left corner', async ({ page }) => {
  const d = await shelfDatum(page, drawingWith([...FOUNDATION, ...SHELF_SUITE(100, 0)], SHELVES));
  expect(d.x, 'the suite\'s left face, not the house\'s').toBeCloseTo(100 - STUD_HALF, 2);
  expect(d.z, 'the suite\'s front face').toBeCloseTo(14 + STUD_HALF, 2);
});

test('the shelf target follows the suite moved', async ({ page }) => {
  const d = await shelfDatum(page, drawingWith(SHELF_SUITE(130, 20), SHELVES));
  expect(d.x).toBeCloseTo(130 - STUD_HALF, 2);
  expect(d.z).toBeCloseTo(34 + STUD_HALF, 2);
});

// THE SUPER NODE ON THAT CORNER IS GOLD (Movie, 22 Oct: "make that SUPERNODE
// corner gold to match"); the others keep their own ink.
test('the shelf\'s super node on the target\'s corner is the gold one', async ({ page }) => {
  const node = (id, x, z) => ({ id, levelId: -1, view: 'plan', point: { x, y: 0, z } });
  await shelfDatum(page, drawingWith(SHELF_SUITE(100, 0), { ...SHELVES,
    superNodes: [node('sn1', 100, 14), node('sn2', 120, 14), node('sn3', 120, 0)] }));
  await page.waitForTimeout(200);
  await expect(page.locator('#plan')).toHaveAttribute('data-gold-super-nodes', '1');
});

test('a suite hologram\'s corner ring on its own target is gold', async ({ page }) => {
  const suite = { format: 'draft-drawing', version: 1, suiteKind: 'residential',
    levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
    walls: box('s', MAIN_FL, 'plan', 'stud_2x6', 0, 0, 20, 14) };
  await datumOf(page, drawingWith(FOUNDATION, { holograms: [{ id: 'h1', name: '1BDEN', mode: 'suite',
    x: 30, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7, source: suite }] }));
  await page.waitForTimeout(200);
  await expect(page.locator('#plan')).toHaveAttribute('data-gold-super-nodes', '1');
});
