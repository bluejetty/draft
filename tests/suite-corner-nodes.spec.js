// A SUITE'S CORNERS ARE ITS SUPER NODES until he places his own.
//
// Movie, 20 Oct: "for the SUPERNODES - can you auto place those on the SUITES
// at the furthest corners of the 'SUITE how the user draws it make a RECTAGLE
// shape that contains it and place the SUPERNOEDS automatically for SUITES -
// but we wil maybe need the to be placed manually or moved too afterwards by
// the user for unique suite situations" -- "in the photo those top 2 nodes
// should be SUPERNODES", the outer corners where two suites meet.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
  { id: 1, name: 'FOUNDATION', elev: -8 }];
const drawing = extra => ({
  version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});
// 2x4 centred walls: 3.5" thick, so each outside face stands 1.75" off the line.
const W = (id, a, b) => ({ id, start: P(...a), end: P(...b), levelId: 3, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const BOX = [W('n', [0, 0], [20, 0]), W('e', [20, 0], [20, 12]), W('s', [20, 12], [0, 12]),
  W('w', [0, 12], [0, 0]), W('mid', [10, 0], [10, 12])];
const holo = (extra, source) => ({ id: 'h1', name: 'unit', x: 100, z: 50, angleDeg: 0, pivotX: 0, pivotZ: 0,
  layer: 'HOLOGRAM', source, ...extra });

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const nodes = (page, hg) => page.evaluate(hg => window.DraftHologram.suiteSuperNodes(hg, 3)
  .map(n => [Math.round(n.point.x * 1000) / 1000, Math.round(n.point.z * 1000) / 1000]), hg);
const F = 1.75 / 12;
const r = v => Math.round(v * 1000) / 1000;

test('a SUITE with no super nodes of its own gets the four corners of the rectangle that holds it, out to the outside faces', async ({ page }) => {
  await open(page);
  const got = await nodes(page, holo({ mode: 'suite' }, drawing({ walls: BOX })));
  // Placed: the hologram stands at (100, 50).
  expect(got).toEqual([[r(100 - F), r(50 - F)], [r(120 + F), r(50 - F)],
    [r(120 + F), r(62 + F)], [r(100 - F), r(62 + F)]]);
});

test('a suite FILE still blue gets them too; a plain hologram gets none', async ({ page }) => {
  await open(page);
  expect(await nodes(page, holo({}, drawing({ walls: BOX, suiteKind: 'residential' })))).toHaveLength(4);
  expect(await nodes(page, holo({}, drawing({ walls: BOX })))).toEqual([]);
});

test('super nodes drawn in the suite\'s own file replace all four corners', async ({ page }) => {
  await open(page);
  const own = [{ id: 'sn1', levelId: 3, view: 'plan', point: P(5, 0) }];
  const got = await nodes(page, holo({ mode: 'suite' }, drawing({ walls: BOX, superNodes: own })));
  expect(got).toEqual([[105, 50]]);
});

test('turned with the hologram, the corners turn with it', async ({ page }) => {
  await open(page);
  const got = await nodes(page, holo({ mode: 'suite', x: 0, z: 0, angleDeg: 90 }, drawing({ walls: BOX })));
  expect(got).toHaveLength(4);
  // A quarter turn puts the 20 ft side along z: the spread in z is now the long one.
  const zs = got.map(p => p[1]), xs = got.map(p => p[0]);
  expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(20 + 2 * F, 3);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(12 + 2 * F, 3);
});
