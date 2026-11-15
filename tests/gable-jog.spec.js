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

// TWO GABLES (jb, 15 Nov 2026: "can you make it 2 seperate gables ?"): the
// press splits the roof into the big gable across the house on the stepped-
// back line (x = -31) and a small lower gable over the long piece that
// sticks out (x = -32 .. -31), peaking at its own middle. ONE FLUSH GABLE
// puts the one gable across back (14 Nov's flush rule, unchanged); TWO
// GABLES splits it again; UNDO steps back through each.
const allRoofs = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).roofs;
};
test('GABLE on one piece of a stepped end changes that piece only; both pieces make two gables', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 0, 0);
  await click(page, at, -31.8, -5);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText('EDGE 2 OF 6');
  // ONE PIECE AT A TIME (jb, 15 Nov 2026: "sometimes i'd like only one to
  // be hip and the other to be gable"; "othe way around needs a valley").
  // The long piece that sticks out made GABLE alone: the end stays hipped
  // across the stepped-back line, and a small gable over the long piece runs
  // back into it, its two JOINTs meeting half its width (12 ft) in.
  await page.locator('[data-prop-row="edge"] [data-prop-value="gable"]').click();
  await expect(page.locator('#strip-message')).toContainText('valleys');
  let roofs = await allRoofs(page);
  expect(roofs.length, 'the hipped roof and the small gable').toBe(2);
  let bigOne = roofs.find(r => r.id === 'roof-1');
  let smallOne = roofs.find(r => r.id !== 'roof-1');
  expect(ring(bigOne).sort(), 'the end hipped on the stepped-back line').toEqual([[-31, -17], [-31, 17], [32, -17], [32, 17]].sort());
  expect(bigOne.edges.includes('gable'), 'no gable on the hipped roof').toBe(false);
  expect(ring(smallOne).sort(), 'the small gable: the long piece, run back to where its valleys meet')
    .toEqual([[-32, -17], [-32, 7], [-31, 7], [-19, -5], [-31, -17]].sort());
  expect(smallOne.edges.slice().sort()).toEqual(['eave', 'eave', 'gable', 'joint', 'joint']);
  expect(smallOne.jogOf).toBe('roof-1');
  // Then the stepped-back line pressed too (the hipped roof's end edge):
  // both pieces gable is TWO GABLES, as before.
  await page.evaluate(() => {
    const big = drawing.roofs.find(r => r.id === 'roof-1');
    const i = big.points.findIndex((p, k) => {
      const q = big.points[(k + 1) % big.points.length];
      return Math.abs(p.x + 31) < 1e-6 && Math.abs(q.x + 31) < 1e-6;
    });
    jogEndPress(big, i, 'gable');
  });
  roofs = await allRoofs(page);
  expect(roofs.length, 'two records: the big gable and the small one').toBe(2);
  const big = roofs.find(r => r.id === 'roof-1');
  const small = roofs.find(r => r.id !== 'roof-1');
  expect(ring(big).sort(), 'the big roof stops on the stepped-back line').toEqual([[-31, -17], [-31, 17], [32, -17], [32, 17]].sort());
  expect(big.edges.filter(k => k === 'gable').length, 'one gable, across the whole house').toBe(1);
  // The piece that sticks out, and from its peak (z -5) to the step side it
  // runs on back over the jog-out to the big gable's wall (x -29), under the
  // big roof's overhang (jb, 15 Nov: "should cover overtop of the jog out
  // and go to the larger gable wall").
  expect(ring(small).sort(), 'the small one: the piece that sticks out, tucked back to the big gable wall past its peak')
    .toEqual([[-32, -17], [-32, 7], [-29, 7], [-29, -5], [-31, -5], [-31, -17]].sort());
  expect(small.edges.slice().sort(), 'its front a gable, its sides eaves, its back JOINTs').toEqual(['eave', 'eave', 'gable', 'joint', 'joint', 'joint']);
  expect(small.jogOf).toBe('roof-1');
  expect(big.flushOf && big.flushOf.points.length, 'the flush roof kept for ONE FLUSH GABLE').toBe(6);
  const groups = (await h.savedDrawing(page)).groups;
  expect(groups.some(g => g.members.length === 2 && g.members.every(m => m.type === 'roof')), 'held as one assembly').toBe(true);
  // The small gable peaks at its own middle (z -5), lower than the big one's.
  const peaks = await page.evaluate(() => {
    const G = window.DraftGeometry2D;
    const [b, s] = drawing.roofs;
    return { big: G.roofRiseAt(b, { x: -30.9, z: 0 }), small: G.roofRiseAt(s, { x: -31.5, z: -5 }) };
  });
  expect(peaks.small, 'the small peak is under the big one').toBeLessThan(peaks.big - 1);
  // ONE FLUSH GABLE: one roof, gabled flush across the step (the 14 Nov
  // rule): the ridge runs out to the end, no plane off the foot.
  await page.locator('[data-roof-jog-gable="flush"]').click();
  roofs = await allRoofs(page);
  expect(roofs.length).toBe(1);
  expect(roofs[0].edges, 'the foot and the piece beyond gable with it').toEqual(['gable', 'gable', 'eave', 'eave', 'eave', 'gable']);
  const got = await planes(page, roofs[0]);
  expect(got.lines.length, 'ridge and two hips').toBe(3);
  expect(got.ridgeX, 'the ridge runs out to the gable end').toEqual([-32, 15]);
  expect(got.covered, 'the planes cover the ring exactly').toBe(got.ring);
  // TWO GABLES splits it again.
  await page.locator('[data-roof-jog-gable="two"]').click();
  expect((await allRoofs(page)).length).toBe(2);
  // UNDO, UNDO, UNDO, UNDO: back to two, one, the small gable, and the
  // plain eaves.
  await page.keyboard.press('Control+z');
  roofs = await allRoofs(page);
  expect(roofs.length).toBe(1);
  await page.keyboard.press('Control+z');
  expect((await allRoofs(page)).length).toBe(2);
  await page.keyboard.press('Control+z');
  roofs = await allRoofs(page);
  expect(roofs.length).toBe(2);
  expect(roofs.find(r => r.id === 'roof-1').edges.includes('gable'), 'the hipped end and its small gable again').toBe(false);
  await page.keyboard.press('Control+z');
  roofs = await allRoofs(page);
  expect(roofs.length).toBe(1);
  expect(roofs[0].edges).toEqual(['eave', 'eave', 'eave', 'eave', 'eave', 'eave']);
});

test('GABLE on the stepped-back piece alone: the big gable across, the part that sticks out hipped back to its wall', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 0, 0);
  await click(page, at, -31, 12);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText('EDGE 6 OF 6');
  // jb, 15 Nov 2026: "the hip should end at the 'gable wall' that goes
  // across for the large gable".
  await page.locator('[data-prop-row="edge"] [data-prop-value="gable"]').click();
  await expect(page.locator('#strip-message')).toContainText('HIPPED');
  let roofs = await allRoofs(page);
  expect(roofs.length).toBe(2);
  const big = roofs.find(r => r.id === 'roof-1');
  const small = roofs.find(r => r.id !== 'roof-1');
  expect(ring(big).sort(), 'the big gable across, on the stepped-back line').toEqual([[-31, -17], [-31, 17], [32, -17], [32, 17]].sort());
  expect(big.edges.filter(k => k === 'gable').length).toBe(1);
  expect(ring(small).sort(), 'the part that sticks out, back to the big gable wall (x -29)')
    .toEqual([[-32, -17], [-32, 7], [-29, 7], [-29, -17]].sort());
  expect(small.edges.slice().sort(), 'hipped: eaves front and sides, a JOINT on the wall').toEqual(['eave', 'eave', 'eave', 'joint']);
  // Its front pressed GABLE too: TWO GABLES.
  await page.evaluate(() => {
    const piece = drawing.roofs.find(r => r.jogOf === 'roof-1');
    const i = piece.points.findIndex((p, k) => {
      const q = piece.points[(k + 1) % piece.points.length];
      return Math.abs(p.x + 32) < 1e-6 && Math.abs(q.x + 32) < 1e-6;
    });
    jogEndPress(piece, i, 'gable');
  });
  roofs = await allRoofs(page);
  expect(roofs.length).toBe(2);
  expect(roofs.find(r => r.id !== 'roof-1').edges.filter(k => k === 'gable').length, 'the small one a gable now').toBe(1);
  await expect(page.locator('[data-roof-jog-gable="flush"]')).toBeVisible();
  // And the big one's gable pressed back to an eave, then the small one's:
  // the stepped end hipped, one roof.
  await page.evaluate(() => {
    const big = drawing.roofs.find(r => r.id === 'roof-1');
    const i = big.edges.indexOf('gable');
    jogEndPress(big, i, 'eave');
  });
  roofs = await allRoofs(page);
  expect(roofs.length, 'the small gable on a hipped end').toBe(2);
  await page.evaluate(() => {
    const piece = drawing.roofs.find(r => r.jogOf === 'roof-1');
    jogEndPress(piece, piece.edges.indexOf('gable'), 'eave');
  });
  roofs = await allRoofs(page);
  expect(roofs.length).toBe(1);
  expect(roofs[0].edges).toEqual(['eave', 'eave', 'eave', 'eave', 'eave', 'eave']);
  await page.keyboard.press('Control+z');
  expect((await allRoofs(page)).length, 'UNDO cuts it again').toBe(2);
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
