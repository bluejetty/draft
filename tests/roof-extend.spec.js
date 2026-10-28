// EXTEND A ROOF EDGE, AND THE T-SQUARE ON A ROOF'S MOVE (Movie, 28 Oct).
//
// "could i make the EXTEND command work (i also tried to select the top of
// wall outline but i can't select it" -- "extend the roof to the edge of the
// wall" -- "the edge of the roof that i select" -- "than i could line up the
// rest of the roof off of that". And "the T isn't engaging for when i move
// the roof".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center' });
const ring = pts => pts.map(([x, z]) => ({ x, y: 0, z }));
// MAIN FL 41' long, 2ND FL 30'. The low roof over the strip stops at x = 38,
// three feet short of the end wall's line at x = 41.
const drawing = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [W('m1', [0, 0], [41, 0], 3), W('m2', [41, 0], [41, 20], 3), W('m3', [41, 20], [0, 20], 3), W('m4', [0, 20], [0, 0], 3),
    W('u1', [0, 0], [30, 0], 5), W('u2', [30, 0], [30, 20], 5), W('u3', [30, 20], [0, 20], 5), W('u4', [0, 20], [0, 0], 5)],
  // A LINE AT x = 40, nearer than the end wall's face: the nearest edge ahead wins.
  lines: [{ id: 'ln', start: { x: 40, y: 0, z: -6 }, end: { x: 40, y: 0, z: 26 }, levelId: 7, view: 'plan', layer: 'draft' }],
  floors: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  roofs: [{ id: 'low', levelId: 7, sourceLevelId: 3, drawnOn: 5, follows: 'none', pitch: 4, overhang: 0,
    points: ring([[30, -2], [38, -2], [38, 22], [30, 22]]), edges: ['eave', 'gable', 'eave', 'gable'],
    edgeOverhang: [2, 0, 2, 0] }],
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
const xs = page => page.evaluate(() => {
  const r = drawing.roofs.find(x => x.id === 'low');
  return r.points.map(p => [Math.round(p.x * 1000) / 1000 + 0, Math.round(p.z * 1000) / 1000 + 0]);
});

test('EXTEND on a roof edge slides it straight out to the line ahead; one UNDO puts it back', async ({ page }) => {
  const { at } = await open(page);
  await h.selectTool(page, 'extend');
  const steps = await page.evaluate(() => undoStack.length);
  await page.mouse.click(...at(38, 10));
  expect(await xs(page)).toEqual([[30, -2], [40, -2], [40, 22], [30, 22]]);
  expect(await page.evaluate(() => undoStack.length), 'one UNDO step').toBe(steps + 1);
  await expect(page.locator('#strip-message')).toContainText('ROOF EDGE EXTENDED');
  await page.keyboard.press('Control+z');
  expect(await xs(page)).toEqual([[30, -2], [38, -2], [38, 22], [30, 22]]);
});

test('EXTEND reaches the wall tops the ROOF plan draws, with no line to aim at', async ({ page }) => {
  const { at } = await open(page);
  await page.evaluate(() => { drawing.lines = []; paint(); });
  await h.selectTool(page, 'extend');
  await page.mouse.click(...at(38, 10));
  const pts = await xs(page);
  // The MAIN FL end wall's nearer face, 2x6 on its centre line at x = 41.
  expect(pts[1][0]).toBeGreaterThan(40.5);
  expect(pts[1][0]).toBeLessThan(41.01);
  expect(pts[1][0]).toBe(pts[2][0]);
});

test('T-square lit: a roof corner dragged with MOVE goes straight across, not on a slant', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(34, 10));
  await page.locator('#model-move').click();
  await page.locator('[data-mode-tsquare]').click();
  await page.mouse.move(...at(38, 22));
  await page.mouse.down();
  await page.mouse.move(...at(39, 23), { steps: 4 });
  await page.mouse.move(...at(39.6, 23.3), { steps: 4 });
  await page.mouse.up();
  const pts = await xs(page);
  expect(pts[2][1], 'still on its own line across').toBe(22);
  expect(pts[2][0]).toBeGreaterThan(39);
});

// "looks like the top ceiling wall doesn't snap": on the ROOF plan a line's
// point lands on the face of a wall top the plan draws.
test('on the ROOF plan a line drawn beside a wall top lands on its face', async ({ page }) => {
  const { at, scale } = await open(page);
  await page.evaluate(() => { drawing.lines = []; paint(); });
  const faces = await page.evaluate(() => wallFaceSegs().map(f => [f.a.x, f.b.x].map(v => Math.round(v * 1000) / 1000)));
  const face = faces.find(([a, b]) => a === b && a > 40.5 && a < 41);
  expect(face, 'the end wall top has a face on the ROOF plan').toBeTruthy();
  await h.selectTool(page, 'line');
  await page.mouse.click(...at(face[0] - 2 / scale, 8));
  const start = await page.evaluate(() => drawStart && Math.round(drawStart.x * 1000) / 1000);
  expect(faces.some(([a, b]) => a === b && a === start), `${start} is on a wall top's face`).toBe(true);
});

test('on the ROOF plan a line crossing a wall top gives a corner to land on where they cross', async ({ page }) => {
  await open(page);
  // The line at x = 40 crosses the wall tops of the front and back walls.
  const hits = await page.evaluate(() => crossingNodes().filter(p => Math.abs(p.x - 40) < 1e-6)
    .map(p => Math.round(p.z * 1000) / 1000).sort((a, b) => a - b));
  expect(hits.length, 'where the line crosses the wall tops').toBeGreaterThanOrEqual(2);
});
