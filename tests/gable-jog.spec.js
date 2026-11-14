// A STEP BETWEEN TWO GABLES IS PART OF THE GABLE WALL (jb, 13 Nov 2026).
//
// "when i change the autoroof to gable it goes nuts": a 2 storey whose end
// wall stepped back a foot for its last ten feet. Both pieces of that end made
// GABLE on the ROOF panel, the foot between them stayed an EAVE, and the
// solver raised a plane off that one-foot eave that ran the length of the
// house -- on E2 a shed slope past the house, a second peak under it, a stray
// wall line. geometry-2d gableJogKinds: an eave of up to 6 ft running square
// between two parallel gables is a gable. The ROOF panel's chips, GABLE END,
// the autoroof and a file opening all ask it; GABLE END also squares across a
// jogged end instead of stopping at the jog.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// A 60 x 30 house, its west end stepped back a foot for its north ten feet;
// the eave ring is the wall ring pushed out 2'.
const WALL = [[-29, 5], [-30, 5], [-30, -15], [30, -15], [30, 15], [-29, 15]];
const EAVE = [[-31, 7], [-32, 7], [-32, -17], [32, -17], [32, 17], [-31, 17]];
const roofWith = edges => ({ id: 'roof-1', levelId: 7, follows: 'house', pitch: 4, overhang: 2,
  points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges,
  edgeOverhang: EAVE.map(() => 2), footprint: WALL.map(([x, z]) => ({ x, y: 0, z })) });
const drawing = edges => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [], lines: [], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  roofs: [roofWith(edges)],
});

async function open(page, edges = EAVE.map(() => 'eave')) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing(edges) });
  await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => {
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(80);
};
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).roofs[0];
}
const ring = roof => roof.points.map(p => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]);
// The roof's planes, read in the page: how many, and where the ridge runs.
// The roof's planes, read in the page: the plan's lines (the skeleton), how
// far the ridge runs, and the area the faces cover against the ring's own.
const planes = (page, roof) => page.evaluate(r => {
  const G = window.DraftGeometry2D;
  const arcs = G.roofSkeleton(r);
  const faces = G.roofFaces(r, arcs);
  const area = pts => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p.x * q.z - q.x * p.z; }, 0)) / 2;
  const ridge = arcs.filter(s => Math.abs(s.a.z - s.b.z) < 1e-6 && Math.abs(s.a.z) < 1e-6);
  const slopes = faces.map(f => Math.round(f.height ? 1 : 1));
  void slopes;
  return {
    lines: arcs.map(s => [s.a.x, s.a.z, s.b.x, s.b.z].map(v => Math.round(v * 100) / 100)),
    ridgeX: ridge.length ? [Math.min(...ridge.flatMap(s => [s.a.x, s.b.x])), Math.max(...ridge.flatMap(s => [s.a.x, s.b.x]))] : null,
    covered: Math.round(faces.reduce((sum, f) => sum + area(f.points), 0) * 100) / 100,
    ring: Math.round(area(r.points) * 100) / 100,
  };
}, roof);

test('GABLE on one piece of a stepped end runs the gable flush across the step and the piece beyond: the ridge runs out to it, no shed off the foot', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 0, 0);
  // The long piece of the west end, x = -32. jb, 14 Nov 2026: one press
  // gables the whole stepped end -- the foot and the short piece at x = -31
  // go with it (geometry-2d gableJogKinds; proto/flush-gable-harness.js).
  await click(page, at, -31.8, -5);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText('EDGE 2 OF 6');
  await page.locator('[data-prop-row="edge"] [data-prop-value="gable"]').click();
  let roof = await saved(page);
  expect(roof.edges, 'one press: the foot and the piece beyond it went gable with it').toEqual(['gable', 'gable', 'eave', 'eave', 'eave', 'gable']);
  expect(roof.follows).toBe('none');
  if (process.env.SHOT) {
    await page.keyboard.press('Escape');
    await page.screenshot({ path: '/tmp/claude-0/repro/4-chips-plan.png' });
    await page.goto('/MODEL.html?level=7&left=1&view=cut%3AE2');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await page.keyboard.press('0'); await page.waitForTimeout(300);
    await page.screenshot({ path: '/tmp/claude-0/repro/5-chips-E2.png' });
    await page.goto('/MODEL.html?level=7&left=1&view=cut%3AE1');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    await page.keyboard.press('0'); await page.waitForTimeout(300);
    await page.screenshot({ path: '/tmp/claude-0/repro/6-chips-E1.png' });
    await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  }
  const got = await planes(page, roof);
  // THE PLAN'S LINES: the ridge out to the gable end and the two hips at the
  // east end -- no line up the step, no plane off the foot.
  expect(got.lines.length, 'ridge and two hips').toBe(3);
  expect(got.ridgeX, 'the ridge runs out to the gable end').toEqual([-32, 15]);
  expect(got.covered, 'the planes cover the ring exactly').toBe(got.ring);
  // ONE UNDO takes all three back.
  await page.keyboard.press('Control+z');
  roof = await saved(page);
  expect(roof.edges).toEqual(['eave', 'eave', 'eave', 'eave', 'eave', 'eave']);
});

test('GABLE END on a stepped end squares across the whole end, not just to the step', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 0, 0);
  await click(page, at, -31.8, -5);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText('EDGE 2 OF 6');
  await page.locator('[data-roof-gable-end]').click();
  const roof = await saved(page);
  expect(roof.points.length, 'the step is swallowed: four corners').toBe(4);
  const gables = roof.edges.map((k, i) => (k === 'gable' ? i : -1)).filter(i => i >= 0);
  expect(gables.length).toBe(1);
  const g = gables[0];
  const a = roof.points[g], b = roof.points[(g + 1) % 4];
  expect([a, b].map(p => [p.x, p.z]).sort((p, q) => p[1] - q[1]), 'one gable, eave to eave, at the end\'s furthest reach')
    .toEqual([[-32, -17], [-32, 17]]);
  expect(ring(roof).some(([x]) => Math.abs(x + 31) < 1e-6), 'nothing left on the step line').toBe(false);
  expect((await planes(page, roof)).lines.length, 'ridge and two hips').toBe(3);
});

test('a file saved with an eave foot between two gables opens healed, and the solver reads it as a gable either way', async ({ page }) => {
  await open(page, ['eave', 'gable', 'eave', 'gable', 'eave', 'gable']);
  const roof = await saved(page);
  expect(roof.edges, 'healed on open').toEqual(['gable', 'gable', 'eave', 'gable', 'eave', 'gable']);
  // The record as it was on disk, straight into the solver.
  const raw = await planes(page, roofWith(['eave', 'gable', 'eave', 'gable', 'eave', 'gable']));
  expect(raw.lines, 'one ridge, end to end, not a shed off the foot').toEqual([[-32, 0, 32, 0]]);
  expect(raw.covered).toBe(raw.ring);
  // A step past the limit is a real wing end and keeps its eave.
  const wide = await page.evaluate(() => window.DraftGeometry2D.gableJogKinds(
    [{ x: -23, z: 7 }, { x: -32, z: 7 }, { x: -32, z: -17 }, { x: 32, z: -17 }, { x: 32, z: 17 }, { x: -23, z: 17 }],
    ['eave', 'gable', 'eave', 'gable', 'eave', 'gable']));
  expect(wide).toEqual(['eave', 'gable', 'eave', 'gable', 'eave', 'gable']);
});
