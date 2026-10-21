// A HOLOGRAM STANDING IN FRONT IS PAINTED OVER THE BUILDING ON AN ELEVATION.
//
// Movie, 21 Oct: "the left and right elevations aren't working property (the
// PHASE 1 hologram roof is on the 1st ceiling but doesn't show in the E1 top
// layer position" -- from E1 PHASE 1 is the nearer building, and the PHASE 2
// gable painted over it. Asked to weigh each hologram whole, in front or
// behind from where the elevation stands: "yes".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId = 3) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const box = (p, x0, x1, z0, z1) => [W(`${p}1`, [x0, z0], [x1, z0]), W(`${p}2`, [x1, z0], [x1, z1]),
  W(`${p}3`, [x1, z1], [x0, z1]), W(`${p}4`, [x0, z1], [x0, z0])];
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [], fixtures: [] };
// THIS DRAWING: a 20 x 20 house at x 0..20. THE HOLOGRAM: the same house,
// end on to it at x 20..40, sharing the end wall line as PHASE 1 and PHASE 2 do.
const BESIDE = { id: 'hologram-1', name: 'PHASE 1', x: 20, z: 0, angleDeg: 0, pivotX: 0, pivotZ: 0,
  source: { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY, walls: box('p', 0, 20, 0, 20) } };
// AND A SUITE INSIDE THE HOUSE, which is never wholly in front of it.
const INSIDE = { id: 'hologram-2', name: 'SUITE', mode: 'suite', x: 4, z: 4, angleDeg: 0, pivotX: 0, pivotZ: 0,
  source: { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY, suiteKind: 'residential',
    walls: box('s', 0, 8, 0, 8) } };
const drawing = holograms => ({ version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: box('h', 0, 20, 0, 20), holograms });

async function open(page, holograms) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing(holograms) });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
// THE ELEVATION THAT STANDS ON THE +x SIDE, and the one on the -x side.
const elevationIds = page => page.evaluate(() => {
  const P = (x, z) => ({ x, y: 0, z });
  const walls = [[0, 0, 42, 0], [42, 0, 42, 20], [42, 20, 0, 20], [0, 20, 0, 0]]
    .map(([a, b, c, d], i) => ({ id: `w${i}`, levelId: 3, start: P(a, b), end: P(c, d) }));
  const cuts = window.DraftCutMarks.autoElevationCuts({ walls, dimensions: [], autoElevations: true, planTurn: 0 });
  return { east: cuts.find(c => c.dirVec.x > 0).id, west: cuts.find(c => c.dirVec.x < 0).id, cuts };
});
// THE HOLOGRAM'S BLUE, counted off the sheet.
const blue = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 2] > d[i] + 25 && d[i + 2] > d[i + 1] + 10) n += 1;
  return n;
});
async function blueOn(page, id) {
  await page.goto(`/MODEL.html?view=cut%3A${id}`);
  await expect(page.locator('#readout')).not.toHaveText('', { timeout: 10000 });
  await page.waitForTimeout(500);
  return blue(page);
}

test('the hologram beside the house is in front from its own side and behind from the other', async ({ page }) => {
  await open(page, [BESIDE]);
  const { east, west, cuts } = await elevationIds(page);
  const front = await page.evaluate(({ holo, d, cuts }) => cuts.map(cut => [cut.id,
    window.DraftHologram.standsInFront(holo, d, cut)]), { holo: BESIDE, d: drawing([BESIDE]), cuts });
  const said = Object.fromEntries(front);
  expect(said[east], 'from the east it is the nearer building').toBe(true);
  expect(said[west], 'from the west the house hides it').toBe(false);
});

test('a suite inside the house is never in front of it', async ({ page }) => {
  await open(page, [INSIDE]);
  const { cuts } = await elevationIds(page);
  const front = await page.evaluate(({ holo, d, cuts }) => cuts.map(cut =>
    window.DraftHologram.standsInFront(holo, d, cut)), { holo: INSIDE, d: drawing([INSIDE]), cuts });
  expect(front).toEqual([false, false, false, false]);
});

test('on the elevation it stands in front on, the hologram is painted over the house', async ({ page }) => {
  await open(page, [BESIDE]);
  const { east, west } = await elevationIds(page);
  // THE SAME SIZE AS THE HOUSE: behind it, it is hidden; in front, it covers it.
  const fromEast = await blueOn(page, east);
  const fromWest = await blueOn(page, west);
  expect(fromEast, 'in front: its whole face shows').toBeGreaterThan(2000);
  expect(fromEast, 'many times what shows from behind').toBeGreaterThan(fromWest * 4);
});
