// BREAK (Movie, 18 Oct).
//
// "can you place the BREAK command down near where UNDO COPY DELETE commands
// show up" -- and what it does: "the BREAK can be used for making break in
// line wall, edge o f shape roof floor etc", "adding a new node", and on a
// roof "just ad a node to the edge of the roof, this way a user can ask to
// 'gable between 2 nodes ... and only from the node to next node ... will
// gable".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const EAVE = [[-8, -8], [68, -8], [68, 38], [-8, 38]];
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
const drawing = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1, nextDrawingItemId: 50, nextGroupId: 2,
  walls: [W('a', [0, 0], [6, 0]), W('b', [6, 0], [6, 6]), W('c', [0, 12], [12, 12])],
  lines: [{ id: 40, start: { x: 0, y: 0, z: 20 }, end: { x: 12, y: 0, z: 20 }, levelId: 3, view: 'plan' }], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [{ id: 'group-1', name: 'WC 1', fixed: true, stretchBehavior: 'rigid',
    members: [{ type: 'wall', id: 'a' }, { type: 'wall', id: 'b' }] }],
  levelLocks: [], underlays: [],
  roofs: [{ id: 'roof-1', levelId: 7, pitch: 4, overhang: 8,
    points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges: EAVE.map(() => 'eave'),
    edgeOverhang: EAVE.map(() => 8) }],
});

async function open(page, level = 7) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto(`/MODEL.html?level=${level}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const r2 = n => Math.round(n * 100) / 100 + 0;
const xz = p => [r2(p.x), r2(p.z)];
async function armBreak(page) {
  await expect(page.locator('#model-break')).toHaveText('BREAK');
  await page.locator('#model-break').click();
  await expect(page.locator('#model-break')).toHaveAttribute('aria-pressed', 'true');
}

test('a roof: BREAK adds nodes on the edge clicked, each half keeps its kind and overhang, and the wall line gains them too', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await armBreak(page);
  // Two nodes on the front eave, z = 38.
  await click(page, at, 20, 37.9);
  await click(page, at, 40, 37.9);
  await page.keyboard.press('Enter');
  await expect(page.locator('#model-break')).toHaveAttribute('aria-pressed', 'false');
  const [roof] = (await saved(page)).roofs;
  expect(roof.points.map(xz)).toEqual([[-8, -8], [68, -8], [68, 38], [40, 38], [20, 38], [-8, 38]]);
  expect(roof.edges).toEqual(['eave', 'eave', 'eave', 'eave', 'eave', 'eave']);
  expect(roof.edgeOverhang).toEqual([8, 8, 8, 8, 8, 8]);
  expect(roof.footprint.map(xz), 'square across, on the wall line').toEqual([[0, 0], [60, 0], [60, 30], [40, 30], [20, 30], [0, 30]]);
});

test('GABLE between two nodes gables that stretch only; one UNDO a node', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await armBreak(page);
  await click(page, at, 20, 37.9);
  await click(page, at, 40, 37.9);
  await page.keyboard.press('Escape');
  await click(page, at, 30, 15);
  await click(page, at, 30, 37.9);
  await expect(page.locator('[data-roof-edge-label]')).toHaveText('EDGE 4 OF 6');
  // The panel is on the PROPERTIES tab; pressed through the page.
  await page.locator('[data-prop-row="edge"] [data-prop-value="gable"]').dispatchEvent('click');
  let [roof] = (await saved(page)).roofs;
  expect(roof.edges).toEqual(['eave', 'eave', 'eave', 'gable', 'eave', 'eave']);
  // The gable stands on its stretch: a roof line reaches each of its ends.
  const ends = await page.evaluate(r => window.DraftGeometry2D.roofSkeleton(r)
    .flatMap(s => [s.a, s.b]).map(p => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]), roof);
  expect(ends).toContainEqual([20, 38]);
  expect(ends).toContainEqual([40, 38]);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  [roof] = (await saved(page)).roofs;
  expect(roof.points).toHaveLength(5);
  await page.keyboard.press('Control+z');
  [roof] = (await saved(page)).roofs;
  expect(roof.points.map(xz)).toEqual(EAVE);
});

test('a wall: BREAK makes it two joined at the node, then three; UNDO joins them back', async ({ page }) => {
  const { at } = await open(page, 3);
  await click(page, at, 6, 12);
  await armBreak(page);
  await click(page, at, 4, 12);
  await click(page, at, 8, 12);
  await page.keyboard.press('Enter');
  let d = await saved(page);
  const runs = d.walls.filter(w => w.start.z === 12).map(w => [xz(w.start), xz(w.end)]).sort((p, q) => p[0][0] - q[0][0]);
  expect(runs).toEqual([[[0, 12], [4, 12]], [[4, 12], [8, 12]], [[8, 12], [12, 12]]]);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  d = await saved(page);
  const c = d.walls.filter(w => w.start.z === 12);
  expect(c.map(w => [xz(w.start), xz(w.end)])).toEqual([[[0, 12], [12, 12]]]);
});

test('a line: BREAK makes two lines at the node', async ({ page }) => {
  const { at } = await open(page, 3);
  await click(page, at, 6, 20);
  await armBreak(page);
  await click(page, at, 3, 20);
  await page.keyboard.press('Enter');
  const { lines } = await saved(page);
  expect(lines.map(l => [xz(l.start), xz(l.end)]).sort((p, q) => p[0][0] - q[0][0]))
    .toEqual([[[0, 20], [3, 20]], [[3, 20], [12, 20]]]);
});

test('Esc puts BREAK down with nothing added', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, 30, 15);
  await armBreak(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#model-break')).not.toHaveAttribute('aria-pressed', 'true');
  expect((await saved(page)).roofs[0].points).toHaveLength(4);
});

// ASSEMBLY GROUP / ASSEMBLY BUST (Movie, 18 Oct): "ASSEMBLY BREAK is
// different from ROOF EDGE BREAK" -- the same button says BUST for one.
test('an assembly selected: the foot button says BUST and busts it into its pieces; a roof\'s says BREAK', async ({ page }) => {
  const { at } = await open(page, 3);
  await click(page, at, 3, 0);
  await expect(page.locator('#model-break')).toBeVisible();
  await expect(page.locator('#model-break')).toHaveText('BUST');
  await expect(page.locator('[data-assembly-ungroup]')).toHaveText('ASSEMBLY BUST');
  await page.locator('#model-break').click();
  await expect(page.locator('#strip-message')).toContainText('ASSEMBLY BUST: broken into pieces');
  const d = await saved(page);
  expect(d.groups || []).toHaveLength(0);
  expect(d.walls.map(w => w.id).sort()).toEqual(['a', 'b', 'c']);
});
