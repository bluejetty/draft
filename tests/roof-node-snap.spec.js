// A BUSTED ROOF'S CORNER, DRAGGED ON THE ROOF PLAN, TAKES THE INSTRUMENTS.
//
// jb, 13 Nov 2026, adjusting the pieces of a busted hip: "the node snaps
// don't seem to work when i adjust the roof", then "need to make it easy to
// line up on the outside of the gable wall too, make that intersection like
// a node", and, after deleting the front slope: "it appears something is
// still left behind".
//
// THE CLAIMS:
//   A WALL TOP'S CORNER CATCHES THE ROOF CORNER   the ROOF plan draws the top
//                                                 storey's wall tops; a drag's
//                                                 magnet reads them (model/07)
//   A ROOF EDGE CROSSING A WALL'S FACE IS A NODE   the crossing is a corner
//                                                 the drag lands on
//   1 FT LANDS THE CORNER ON THE FOOT              with nothing caught
//   A DELETED PIECE LEAVES NOTHING BEHIND          off the assembly, and the
//                                                 JOINT edges beside it are
//                                                 GABLE; one UNDO puts it back
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center' });
const BOX = [W('w1', [0, 0], [20, 0]), W('w2', [20, 0], [20, 12]), W('w3', [20, 12], [0, 12]), W('w4', [0, 12], [0, 0])];
const ROOF = (id, pts, edges) => ({ id, levelId: 7, follows: 'none', pitch: 4, overhang: 2,
  points: pts.map(([x, z]) => ({ x, y: 0, z })), edges: edges || pts.map(() => 'eave'),
  edgeOverhang: (edges || pts.map(() => 'eave')).map(e => (e === 'joint' ? 0 : 2)) });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
// Two pieces over the box: A on the left, B on the right, sharing x = 10.
const RA = () => ROOF('ra', [[-2, -2], [10, -2], [10, 14], [-2, 14]], ['eave', 'joint', 'eave', 'eave']);
const RB = () => ROOF('rb', [[10, -2], [22, -2], [22, 14], [10, 14]], ['eave', 'eave', 'eave', 'joint']);
// A third piece east of B, sharing x = 22 with it: B's right edge is a JOINT
// with C, not with A, and a deleted A must leave that one alone.
const RB_C = () => ROOF('rb', [[10, -2], [22, -2], [22, 14], [10, 14]], ['eave', 'joint', 'eave', 'joint']);
const RC = () => ROOF('rc', [[22, -2], [30, -2], [30, 14], [22, 14]], ['eave', 'eave', 'eave', 'joint']);
const drawing = ({ roofs, groups = [] } = {}) => ({
  version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 1, nextDrawingItemId: 50,
  walls: BOX, lines: [], floors: [], roofs, fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups, nextGroupId: groups.length + 1, levelLocks: [], underlays: [],
});

async function open(page, f, { footLight = false, level = 7 } = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f, footLight }) => {
    try { localStorage.setItem('draft-skin', JSON.stringify({ tsquare: false, footLight })); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f, footLight });
  await page.goto(`/MODEL.html?level=${level}`);
  await expect(page.locator('#readout')).toContainText(level === 7 ? 'walls' : 'line', { timeout: 10000 });
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.count() && await levels.getAttribute('aria-expanded') === 'true') await levels.click();
}
async function zoomTo(page, target) {
  const box = await page.locator('#plan').boundingBox();
  const { scale } = await h.planFrame(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -Math.log(target / scale) / 0.0015);
  await page.waitForTimeout(120);
  const frame = await h.planFrame(page);
  expect(Math.abs(frame.scale - target)).toBeLessThan(target * 0.05);
  return frame;
}
const magnet = async page => JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet') || 'null');
const r3 = n => Math.round(n * 1000) / 1000;
const saved = async page => {
  await page.keyboard.press('Escape');
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
async function dragFrom(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.waitForTimeout(80);
}
// THE SHEET'S REACH FIRST: a press off the plan is a press on the foot lane,
// and a drag that never started reads exactly like a snap that never caught.
const onSheet = async (page, at, ...pts) => {
  for (const [x, z] of pts) {
    const [px, py] = at(x, z);
    expect(await page.evaluate(([cx, cy]) => document.elementFromPoint(cx, cy)?.id, [px, py]), `(${x}, ${z}) is on the sheet`).toBe('plan');
  }
};
const armMoveOn = async (page, at, x, z) => {
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(100);
  await expect(page.locator('#model-move')).toBeVisible();
  await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
};

test('a roof corner dragged on the ROOF plan lands on a wall top\'s corner', async ({ page }) => {
  await open(page, drawing({ roofs: [RA(), RB()] }));
  const { at } = await zoomTo(page, 22);
  await onSheet(page, at, [16, 6], [22, -2], [20.08, 0.08]);
  await armMoveOn(page, at, 16, 6);
  // B's front corner (22, -2) to 1.4" off the box's corner (20, 0), and on it.
  await dragFrom(page, at, [22, -2], [20.08, 0.08]);
  const lit = await magnet(page);
  expect(lit?.kind, 'the wall top\'s corner lit as a node').toBe('node');
  expect(lit.at).toEqual([20, 0]);
  await page.mouse.up();
  await page.waitForTimeout(100);
  await expect(page.locator('#strip-message')).toContainText('Node moved');
  const rb = (await saved(page)).roofs.find(r => r.id === 'rb');
  expect([r3(rb.points[1].x), r3(rb.points[1].z)]).toEqual([20, 0]);
});

test('where a roof edge crosses a wall\'s face is a node the corner lands on', async ({ page }) => {
  // A stub wall out of the box's right side, z = 4, under a third piece
  // whose left eave (x = 24) crosses its two faces at z = 4 -/+ 2 3/4".
  const f = drawing({ roofs: [RA(), RB(), ROOF('rc', [[24, 2], [30, 2], [30, 8], [24, 8]])] });
  f.walls = [...BOX, W('w5', [20, 4], [28, 4])];
  await open(page, f);
  const { at } = await zoomTo(page, 22);
  await onSheet(page, at, [16, 6], [22, -2], [24.1, 3.85]);
  await armMoveOn(page, at, 16, 6);
  await dragFrom(page, at, [22, -2], [24.1, 3.85]);
  const lit = await magnet(page);
  expect(lit?.kind, 'the crossing lit as a corner').toBe('corner');
  expect(lit.at[0]).toBe(24);
  expect(Math.abs(lit.at[1] - 3.77)).toBeLessThan(0.05);   // the near face of a 2x6 wall
  await page.mouse.up();
  await page.waitForTimeout(100);
  const rb = (await saved(page)).roofs.find(r => r.id === 'rb');
  expect(r3(rb.points[1].x)).toBe(24);
  expect(Math.abs(rb.points[1].z - lit.at[1])).toBeLessThan(0.001);
});

test('with 1 FT lit and nothing caught, the corner lands a whole foot out', async ({ page }) => {
  await open(page, drawing({ roofs: [RA(), RB()] }), { footLight: true });
  const { at } = await zoomTo(page, 22);
  await onSheet(page, at, [16, 6], [22, -2], [25.4, -3.2]);
  await armMoveOn(page, at, 16, 6);
  await dragFrom(page, at, [22, -2], [25.4, -3.2]);
  expect(await magnet(page)).toBeNull();
  await page.mouse.up();
  await page.waitForTimeout(100);
  const rb = (await saved(page)).roofs.find(r => r.id === 'rb');
  const len = Math.hypot(rb.points[1].x - 22, rb.points[1].z + 2);
  expect(Math.abs(len - 4), `moved ${len.toFixed(3)} ft: 3.6 rounds to 4`).toBeLessThan(0.01);
});

test('a deleted piece leaves the assembly and turns the JOINT edges beside it to GABLE; UNDO puts it all back', async ({ page }) => {
  await open(page, drawing({ roofs: [RA(), RB_C(), RC()],
    groups: [{ id: 'group-1', name: 'ROOF PIECES 1', fixed: false, stretchBehavior: 'item-geometry',
      members: [{ type: 'roof', id: 'ra' }, { type: 'roof', id: 'rb' }, { type: 'roof', id: 'rc' }], wallSettings: null }] }));
  const { at } = await zoomTo(page, 22);
  await onSheet(page, at, [4, 6]);
  await page.keyboard.press('s');
  // THE ASSEMBLY IS BUSTED FIRST (Y), so one piece picks alone; then A goes.
  await page.mouse.click(...at(4, 6));
  await page.waitForTimeout(100);
  await page.keyboard.press('y');
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await page.mouse.click(...at(4, 6));
  await page.waitForTimeout(100);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(100);
  await expect(page.locator('#strip-message')).toContainText('GABLE now');
  let d = await saved(page);
  expect(d.roofs.map(r => r.id)).toEqual(['rb', 'rc']);
  // B's edge beside A is GABLE now; its JOINT with C, and C's with it, stay.
  expect(d.roofs[0].edges).toEqual(['eave', 'joint', 'eave', 'gable']);
  expect(d.roofs[1].edges).toEqual(['eave', 'eave', 'eave', 'joint']);
  expect((d.groups || []).every(g => !g.members.some(m => m.id === 'ra')), 'no group holds the dead piece').toBe(true);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  d = await saved(page);
  expect(d.roofs.map(r => r.id).sort()).toEqual(['ra', 'rb', 'rc']);
  expect(d.roofs.find(r => r.id === 'rb').edges).toEqual(['eave', 'joint', 'eave', 'joint']);
});

test('a piece deleted from inside its unbusted assembly (a click picks one piece) leaves the group; a group of one goes', async ({ page }) => {
  // jb's own case: the ROOF PIECES assembly is NOT FIXED, so a click picks
  // one piece and DELETE takes it alone -- and the assembly still listed it.
  await open(page, drawing({ roofs: [RA(), RB()],
    groups: [{ id: 'group-1', name: 'ROOF PIECES 1', fixed: false, stretchBehavior: 'item-geometry',
      members: [{ type: 'roof', id: 'ra' }, { type: 'roof', id: 'rb' }], wallSettings: null }] }));
  const { at } = await zoomTo(page, 22);
  await onSheet(page, at, [4, 6]);
  await page.keyboard.press('s');
  await page.mouse.click(...at(4, 6));
  await page.waitForTimeout(100);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(100);
  let d = await saved(page);
  expect(d.roofs.map(r => r.id)).toEqual(['rb']);
  expect((d.groups || []).filter(g => g.members.some(m => m.type === 'roof')), 'no group lists a dead piece, and a group of one is no group').toEqual([]);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  d = await saved(page);
  expect(d.roofs.map(r => r.id).sort()).toEqual(['ra', 'rb']);
  expect((d.groups || []).some(g => g.members.some(m => m.id === 'ra') && g.members.some(m => m.id === 'rb')), 'the assembly is back').toBe(true);
});

test('off the ROOF plan the wall tops are no magnet: a line\'s end on SITE passes the box\'s corner', async ({ page }) => {
  const f = drawing({ roofs: [RA(), RB()] });
  f.lines = [{ id: 'l1', start: { x: 30, y: 0, z: -6 }, end: { x: 22, y: 0, z: -2 }, levelId: 8, view: 'plan', layer: 'draft', bulge: 0 }];
  await open(page, f, { level: 8 });
  const { at } = await zoomTo(page, 22);
  await onSheet(page, at, [26, -4], [22, -2], [20.08, 0.08]);
  await armMoveOn(page, at, 26, -4);
  await dragFrom(page, at, [22, -2], [20.08, 0.08]);
  const lit = await magnet(page);
  expect(lit?.kind === 'node' && lit.at[0] === 20 && lit.at[1] === 0, 'the storey\'s wall corner is not lit on SITE').toBe(false);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const l1 = (await saved(page)).lines.find(l => l.id === 'l1');
  expect(Math.abs(l1.end.x - 20.08)).toBeLessThan(0.05);
  expect(Math.abs(l1.end.z - 0.08)).toBeLessThan(0.05);
});
