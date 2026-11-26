// THE WIREFRAME 3D AT TRUE HEIGHTS (jb, 26 Nov 2026).
//
//   "can we make the 'valley/ridge' peak lines of the roof look like they are
//   in the proper location 3D wise (not flat on the orange layer)"
//   "can you also show where the pad footings would be located and their
//   sizes, show all the edge lines of the footing"
//   "also the Stair Opening (it isn't showing or is it ?)"
//   "would it be possible to show a 50% opaque stair outline ?"
//
// Looked at from the side (the tilt ladder's 0°, every plan loop a flat line)
// a roof whose ridge is still at the plate is one line; a ridge at its height
// stands above the eave by the roof's rise.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function boneyard(page, change = d => d) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, empty());
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator('#dt-tiles [data-build-entry="bungalow"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const drawing = change(await h.savedDrawing(page));
  await page.evaluate(async f => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, drawing);
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
  return drawing;
}

const attr = async (page, name) => JSON.parse(await page.locator('#bones3d').getAttribute(name) || 'null');
const flatOnTheSide = async page => {
  for (let i = 0; i < 4 && Number(await page.locator('#bones3d').getAttribute('data-tilt')) > 0; i += 1) {
    await page.locator('#tip-down').click();
  }
  await expect(page.locator('#bones3d')).toHaveAttribute('data-tilt', '0');
};

test('a hip roof\'s ridge stands above its eave in the 3D, and its hips climb to it', async ({ page }) => {
  await boneyard(page);
  await flatOnTheSide(page);
  const lines = await attr(page, 'data-thin');
  const eaveYs = lines.filter(l => l.kind === 'eave').flatMap(l => l.points.map(p => p[1]));
  const boneYs = lines.filter(l => l.kind === 'skeleton').flatMap(l => l.points.map(p => p[1]));
  expect(Math.max(...eaveYs) - Math.min(...eaveYs), 'a hip roof\'s eave is level').toBeLessThan(1);
  // Screen y grows downward: the peak is the smallest.
  expect(Math.min(...eaveYs) - Math.min(...boneYs), 'the ridge is up off the eave').toBeGreaterThan(10);
  // A hip runs from an eave corner (on the eave line) up to the ridge.
  const hips = lines.filter(l => l.kind === 'skeleton'
    && Math.abs(l.points[0][1] - l.points[1][1]) > 10);
  expect(hips.length, 'hips slope').toBeGreaterThan(0);
});

test('a gable end\'s rakes climb to the ridge on the eave line', async ({ page }) => {
  await boneyard(page, d => {
    d.roofs[0].edges = d.roofs[0].points.map((_, i) => (i % 2 ? 'eave' : 'gable'));
    return d;
  });
  await flatOnTheSide(page);
  const lines = await attr(page, 'data-thin');
  const eave = lines.find(l => l.kind === 'eave');
  const ys = eave.points.map(p => p[1]);
  expect(eave.points.length, 'a peak put into each gable edge').toBe(6);
  expect(Math.max(...ys) - Math.min(...ys), 'and it stands up').toBeGreaterThan(10);
});

test('pad footings, the strip footing, the stair opening and the stair are drawn', async ({ page }) => {
  const d = await boneyard(page);
  const footings = await attr(page, 'data-footings');
  expect(footings.strip, 'the strip footing under the concrete').toBeGreaterThan(0);
  const pads = d.columns.filter(c => Number(c.levelId) === 1 && /^pad/.test(c.footing));
  expect(footings.pads.length, 'a pad under every pad column').toBe(pads.length);
  expect(footings.pads.every(p => p.sizeIn === 36 && p.deepIn === 8)).toBe(true);
  const holes = await attr(page, 'data-floor-openings');
  expect(holes.length, 'the stair opening').toBe(d.surfaceOpenings.filter(o => o.hostType === 'floor').length);
  const stairs = await attr(page, 'data-stairs');
  expect(stairs.length, 'the stair').toBe(d.stairs.length);
  expect(stairs[0].top).toBeGreaterThan(stairs[0].bottom);
});

// jb, 26 Nov 2026: "the extra roof i drew 'special' at the front of the gable
// with different fascia doesn't show ... maybe we should show it in a
// different linetype or weight". Every piece of the house's roof is drawn
// now, and a SPECIAL CASE piece (one with its own settings) comes dashed.
test('a second roof piece is drawn, and a special-case one is marked special', async ({ page }) => {
  await boneyard(page, d => {
    const main = d.roofs[0];
    const xs = main.points.map(p => p.x), zs = main.points.map(p => p.z);
    const x1 = Math.max(...xs), z0 = Math.min(...zs);
    const piece = { ...main, id: `${main.id}-front`, own: ['fascia'], fascia: 12,
      points: [{ x: x1, y: 0, z: z0 + 2 }, { x: x1 + 6, y: 0, z: z0 + 2 },
        { x: x1 + 6, y: 0, z: z0 + 10 }, { x: x1, y: 0, z: z0 + 10 }] };
    piece.edges = piece.points.map(() => 'eave');
    delete piece.edgeOverhang; delete piece.edgeHeelIn;
    d.roofs.push(piece);
    return d;
  });
  const lines = await attr(page, 'data-thin');
  const eaves = lines.filter(l => l.kind === 'eave');
  expect(eaves.length, 'both pieces\' eaves').toBe(2);
  expect(eaves.filter(l => l.special).length, 'one of them the special case').toBe(1);
  expect(lines.filter(l => l.kind === 'skeleton' && l.special).length,
    'with its own hips and ridge').toBeGreaterThan(0);
});
