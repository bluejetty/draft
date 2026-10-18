// A SELECTED ROOF SHOWS ITS EDGES (Movie, 18 Oct, North Point).
//
// "main roof overhang at 8ft except at the front jog out, the side overhangs
// are only 2ft and at the left edge its no overhang, diag edge 2-5.5"" --
// and, on the elevation he marked up, "there shouldnt be a bump on top at
// the front and shouldn't be the extra lines". So: click a roof, then click
// one of its edges; the panel says which edge, whether it is an EAVE or a
// GABLE, and its overhang. Every overhang is worked from the wall line, so
// the jog-out's front brought onto the main eave line leaves one straight
// eave with no hips across it -- and can be taken back out again.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// A 60 x 30 house with a 6' jog-out on its front (z = 30) from x = 20 to 40,
// roofed at 8' all round: the eave ring is the wall ring pushed out 8'.
const WALL = [[0, 0], [60, 0], [60, 30], [40, 30], [40, 36], [20, 36], [20, 30], [0, 30]];
const EAVE = [[-8, -8], [68, -8], [68, 38], [48, 38], [48, 44], [12, 44], [12, 38], [-8, 38]];
const JOG_FRONT = 4;   // (48,44) -> (12,44)
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [], lines: [], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  roofs: [{ id: 'roof-1', levelId: 7, follows: 'house', pitch: 4, overhang: 8,
    points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges: EAVE.map(() => 'eave'),
    edgeOverhang: EAVE.map(() => 8) }],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
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
const field = (page, name) => page.locator(`[data-prop-field="${name}"]`);
async function type(page, name, value) {
  await field(page, name).fill(value);
  await field(page, name).press('Enter');
  await page.waitForTimeout(80);
}
const hips = roof => page => page.evaluate(r => window.DraftGeometry2D.roofSkeleton(r).length, roof);

test('a roof clicked shows ROOF in PROPERTIES; an edge clicked says which, its kind and overhang', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText('CLICK AN EDGE OF THE ROOF');
  await expect(field(page, 'overhang, all edges')).toHaveValue("8'-0\"");
  // The jog-out's front eave, a hair inside it.
  await click(page, at, 30, 43.8);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText(`EDGE ${JOG_FRONT + 1} OF 8`);
  await expect(field(page, 'overhang, this edge')).toHaveValue("8'-0\"");
  await expect(page.locator('[data-prop-row="edge"] [data-prop-value="eave"]')).toHaveAttribute('aria-pressed', 'true');
  // The arrows step round the ring.
  await page.locator('[data-roof-edge-step="next"]').click();
  await expect(page.locator('[data-roof-edge-label]')).toHaveText(`EDGE ${JOG_FRONT + 2} OF 8`);
});

test('the jog-out front at 2\' lands on the main eave line: one straight eave, no hips across it, and back out again', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await click(page, at, 30, 43.8);
  await type(page, 'overhang, this edge', '2');
  let roof = await saved(page);
  expect(ring(roof)).toEqual([[-8, -8], [68, -8], [68, 38], [48, 38], [48, 38], [12, 38], [12, 38], [-8, 38]]);
  expect(roof.edgeOverhang[JOG_FRONT]).toBe(2);
  expect(roof.follows, 'a roof shaped by hand stops following PROJECT').toBe('none');
  expect(roof.footprint.map(p => [p.x, p.z]), 'and keeps the wall line it hangs from').toEqual(WALL);
  // A hip roof on one rectangle of eave: four hips and a ridge, nothing at the jog.
  expect(await hips(roof)(page)).toBe(5);
  // Taken back to 8', the jog's sides get their length back.
  await type(page, 'overhang, this edge', "8'");
  roof = await saved(page);
  expect(ring(roof)).toEqual(EAVE);
});

test('ALL EDGES moves every eave from the wall line; GABLE flips the picked edge; 10\' is the cap; one UNDO each', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await type(page, 'overhang, all edges', '0');
  let roof = await saved(page);
  expect(ring(roof), 'flush all round is the wall line itself').toEqual(WALL);
  await type(page, 'overhang, all edges', '11');
  await expect(page.locator('#strip-message')).toContainText("0 to 10'");
  expect(ring(await saved(page)), 'refused, nothing moved').toEqual(WALL);
  await click(page, at, 59.9, 15);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText('EDGE 2 OF 8');
  await page.locator('[data-prop-row="edge"] [data-prop-value="gable"]').click();
  roof = await saved(page);
  expect(roof.edges[1]).toBe('gable');
  await page.keyboard.press('Control+z');
  expect((await saved(page)).edges[1]).toBe('eave');
  await page.keyboard.press('Control+z');
  expect(ring(await saved(page)), 'and the 8\' eaves come back').toEqual(EAVE);
});

test('PITCH on the selected roof', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await page.locator('[data-roof-field="pitch"]').fill('3');
  await page.locator('[data-roof-field="pitch"]').press('Enter');
  expect((await saved(page)).pitch).toBe(3);
});

// GABLE END (Movie, 18 Oct: "change bother hips to GABLE on the left end of
// the plan i made"). His left end is the end wall AND the 45° chamfer at its
// corner; the roof PDF runs the gable square across all of it.
const CHAMFER_WALL = [[0, 0], [60, 0], [60, 30], [40, 30], [40, 36], [20, 36], [20, 30], [10, 30], [0, 20]];
const CHAMFER_EAVE = [[-8, -8], [68, -8], [68, 38], [48, 38], [48, 44], [12, 44], [12, 38],
  [6.6863, 38], [-8, 23.3137]];
async function openChamfer(page) {
  await h.openModel(page, { webgl: false });
  const f = drawing();
  f.roofs[0] = { ...f.roofs[0], points: CHAMFER_EAVE.map(([x, z]) => ({ x, y: 0, z })),
    edges: CHAMFER_EAVE.map(() => 'eave'), edgeOverhang: CHAMFER_EAVE.map(() => 8) };
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}

test('GABLE END squares the chamfered end across and makes it one gable; the ridge runs out to it', async ({ page }) => {
  const { at } = await openChamfer(page);
  await click(page, at, 30, 15);
  // The end edge, x = -8, a hair inside.
  await click(page, at, -7.8, 5);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText('EDGE 9 OF 9');
  await page.locator('[data-roof-gable-end]').click();
  let roof = await saved(page);
  const gables = roof.edges.map((k, i) => (k === 'gable' ? i : -1)).filter(i => i >= 0);
  expect(gables.length, 'one gable').toBe(1);
  const g = gables[0];
  const a = roof.points[g], b = roof.points[(g + 1) % roof.points.length];
  expect([a, b].map(p => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]).sort((p, q) => p[1] - q[1]),
    'square across the end, eave to eave').toEqual([[-8, -8], [-8, 38]]);
  expect(roof.points.length, 'the chamfer is gone: 9 corners less one').toBe(8);
  expect(roof.footprint.map(p => [p.x, p.z]).filter(([x]) => x === 0).length,
    'the wall line under it is square too').toBe(2);
  // NO HIPS AT THAT END: the ridge runs all the way out to the gable.
  const westmost = await page.evaluate(r => Math.min(...window.DraftGeometry2D.roofSkeleton(r)
    .flatMap(s => [s.a.x, s.b.x])), roof);
  expect(westmost).toBeCloseTo(-8, 6);
  // Flush, as on North Point's left end.
  await expect(page.locator('[data-roof-edge-label]')).toHaveText(`EDGE ${g + 1} OF 8`);
  await type(page, 'overhang, this edge', '0');
  roof = await saved(page);
  expect(roof.points.filter(p => Math.abs(p.x) < 1e-6).length).toBe(2);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect(ring(await saved(page)), 'two UNDOs and the hipped, chamfered end is back').toEqual(CHAMFER_EAVE.map(([x, z]) => [Math.round(x * 100) / 100, Math.round(z * 100) / 100]));
});

// CROSS GABLE (Movie, 18 Oct): "put in the GABLE where they are located.
// its a full gable that extend down to meet the roof in the valley (no dormer
// sidewall/ only a front wall that is aligned with the ext perimter wall
// below". The roof PDF's: 20' + 20' across at 12/4.
test('CROSS GABLE on an eave: centred where clicked on the wall line, its ridge and valleys in plan, its faces standing on the roof', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await click(page, at, 30, 43.8);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText(`EDGE ${JOG_FRONT + 1} OF 8`);
  // 40' is the default, and the jog's wall is only 20' long.
  await page.locator('[data-roof-cross-gable]').click();
  await expect(page.locator('#strip-message')).toContainText('wider than the wall');
  await type(page, 'cross gable width', '16');
  await page.locator('[data-roof-field="cross gable pitch"]').fill('6');
  await page.locator('[data-roof-field="cross gable pitch"]').press('Enter');
  await page.locator('[data-roof-cross-gable]').click();
  let roof = await saved(page);
  expect(roof.crossGables).toEqual([{ at: { x: 30, z: 36 }, widthFt: 16, pitch: 6 }]);
  const shape = await page.evaluate(r => {
    const G = window.DraftGeometry2D;
    const [g] = G.crossGableShapes(r);
    const faces = G.roofFaces(r, G.roofSkeleton(r));
    const own = faces.filter(f => f.crossGable);
    return { P: [g.P.x, g.P.z], lines: G.crossGableLines(r).length, own: own.length,
      ridge: G.roofFaceRise(own[0], g.M, r.pitch), meet: G.roofFaceRise(own[0], g.P, r.pitch) };
  }, roof);
  // 8' half-width x 6/4 = 12' in from the wall line at z = 36.
  expect(shape.P).toEqual([30, 24]);
  expect(shape.lines, 'front wall, ridge and two valleys').toBe(4);
  expect(shape.own, 'two faces of its own').toBe(2);
  // Its ridge stands level from the wall to where it meets the main roof:
  // 8' over the eave at 4/12 is 2'-8", plus 8' x 6/12.
  expect(shape.ridge).toBeCloseTo(8 * 4 / 12 + 8 * 6 / 12, 6);
  expect(shape.meet).toBeCloseTo(shape.ridge, 6);
  await page.locator('[data-roof-cross-gable-remove="0"]').click();
  expect('crossGables' in await saved(page)).toBe(false);
  await page.keyboard.press('Control+z');
  roof = await saved(page);
  expect(roof.crossGables).toHaveLength(1);
});
