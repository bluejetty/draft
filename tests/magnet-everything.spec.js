// LINES, AREAS, FLOORS AND ROOFS ALL ACT THIS WAY (Movie, 19 Oct).
//
// "id like the lines / walls / areas / floors/ roofs etc to all act in this
// way." -- the three tiers, said of the walls a message earlier. A loop's
// corners are its nodes (orange), its edges and a line's body are faces
// (neon), a crossing of any two runs is a corner that acts like one
// (yellow); a floor or shape traced by hand reads the magnet as a wall's
// point does; and a floor or roof carried by MOVE seeks by every corner it
// has, its own corners kept out so it never chases itself.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, wallType = 'stud_2x6') => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType, refLine: 'center' });
const L = (id, a, b, view = 'floor') => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, levelId: 3, view });
// A FLOOR IS A FLOOR-VIEW ITEM and a wall a plan one (onActiveLevel: the
// two never share a view), so the loops a floor meets are the level-wide
// ones -- an OUTLINE, a SHAPE -- and the lines drawn on its own view.
const OUTLINE = (id, pts) => ({ id, levelId: 3, points: pts.map(([x, z]) => ({ x, y: 0, z })) });
const FLOOR = (id, pts) => ({ id, levelId: 3, view: 'floor', structure: 'floor', garage: false, slopeInPerFt: 0,
  thickness: 0.75, thickenedEdge: false, assembly: {}, points: pts.map(([x, z]) => ({ x, y: 0, z })) });
const HALF6 = 2.75 / 12;
const drawing = ({ walls = [], lines = [], floors = [], roofs = [], outlines = [], levels, activeLevelIdx = 0 } = {}) => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: levels || [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx,
  nextDrawingItemId: 50,
  walls, lines, floors, roofs, fenestrations: [], dimensions: [],
  outlines, shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, f, url = '/MODEL.html') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
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
async function armLine(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const key = page.locator('[data-tool-key="line"]');
  if (await key.getAttribute('aria-pressed') !== 'true') await page.keyboard.press('l');
  await expect(key).toHaveAttribute('aria-pressed', 'true');
}
const magnet = async page => JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet') || 'null');
const hoverPx = async (page, at, pt, dx, dy) => {
  const [px, py] = at(pt[0], pt[1]);
  await page.mouse.move(px + dx, py + dy);
  await page.waitForTimeout(80);
};
const r3 = n => Math.round(n * 1000) / 1000;
const saved = async page => {
  await page.keyboard.press('Escape');
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const FLOOR_VIEW = '/MODEL.html?level=3&view=floor';
async function dragFrom(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.waitForTimeout(80);
}

test('a floor\'s corner is a node, its edge a face, and a line across its edge crosses at a yellow corner', async ({ page }) => {
  await open(page, drawing({ floors: [FLOOR('f1', [[0, 0], [10, 0], [10, 8], [0, 8]])], lines: [L('l1', [5, -2], [5, 2])] }), FLOOR_VIEW);
  const { at } = await zoomTo(page, 52);
  await armLine(page);
  await hoverPx(page, at, [10, 0], 3, -3);
  expect(await magnet(page)).toEqual({ kind: 'node', at: [10, 0] });
  await hoverPx(page, at, [3, 0], 0, 3);
  expect((await magnet(page))?.kind).toBe('face');
  await hoverPx(page, at, [5, 0], 3, 0);
  expect(await magnet(page)).toEqual({ kind: 'corner', at: [5, 0] });
  // And a line pressed there starts exactly on the crossing.
  await page.mouse.click(...at(5 + 3 / 52, 0));
  await page.mouse.click(...at(8, -3));
  const line = (await saved(page)).lines.find(l => l.id !== 'l1');
  expect([r3(line.start.x), r3(line.start.z)]).toEqual([5, 0]);
});

test('a floor traced by hand lands a corner on the outline\'s, and a shape\'s corner on the floor\'s', async ({ page }) => {
  // The rail up on BUILD: FLOOR has no key anywhere else.
  await open(page, drawing({ outlines: [OUTLINE('o1', [[0, 0], [10, 0], [10, 8], [0, 8]])] }), `${FLOOR_VIEW}&left=1&lpane=build`);
  // ZOOMED OUT so every press lands on the sheet, not under a rail, and
  // proved so (the floor tool's own spec: a press that misses the sheet and
  // a broken tool look the same).
  const { at } = await zoomTo(page, 22);
  const onSheet = async (x, z) => {
    const [px, py] = at(x, z);
    expect(await page.evaluate(([cx, cy]) => document.elementFromPoint(cx, cy)?.id, [px, py]), `(${x}, ${z}) is on the sheet`).toBe('plan');
  };
  for (const [x, z] of [[10, 0], [16, 0], [16, 6], [20, 10]]) await onSheet(x, z);
  await page.locator('[data-tool-key="floor"]').click();
  await expect(page.locator('[data-tool-key="floor"]')).toHaveAttribute('aria-pressed', 'true');
  // 4 px off the outline's corner: on it. Then three free corners and home.
  await page.mouse.click(...at(10 + 4 / 22, 4 / 22));
  await page.mouse.click(...at(16, 0));
  await page.mouse.click(...at(16, 6));
  await page.mouse.click(...at(10, 6));
  await page.mouse.click(...at(10, 0));
  let d = await saved(page);
  const floor = d.floors[0];
  expect(floor).toBeTruthy();
  expect([r3(floor.points[0].x), r3(floor.points[0].z)]).toEqual([10, 0]);
  // A SHAPE's corner finds the floor's corner at (16, 6).
  await h.selectTool(page, 'Shape');
  await page.mouse.click(...at(16 + 4 / 22, 6 + 4 / 22));
  await page.mouse.click(...at(20, 6));
  await page.mouse.click(...at(20, 10));
  await page.mouse.click(...at(16, 10));
  await page.mouse.click(...at(16, 6));
  d = await saved(page);
  expect(d.shapes.length).toBe(1);
  expect([r3(d.shapes[0].points[0].x), r3(d.shapes[0].points[0].z)]).toEqual([16, 6]);
});

test('MOVE carries a floor onto the outline\'s corner by whichever corner comes nearest', async ({ page }) => {
  await open(page, drawing({ outlines: [OUTLINE('o1', [[0, 0], [10, 0], [10, 8], [0, 8]])],
    floors: [FLOOR('f1', [[12, 2], [16, 2], [16, 6], [12, 6]])] }), FLOOR_VIEW);
  const { at } = await zoomTo(page, 40);
  // A floor is picked by its edge.
  await page.keyboard.press('s');
  await page.mouse.click(...at(14, 2));
  await page.waitForTimeout(100);
  await expect(page.locator('#model-move')).toBeVisible();
  await page.locator('#model-move').click();
  // Towards the outline's corner: the floor's first corner stops 5 px short
  // of it and is pulled on; the floor keeps its 4 x 4.
  await dragFrom(page, at, [14, 4], [14 - 2 + 5 / 40, 4 - 2 + 5 / 40]);
  expect(await magnet(page)).toEqual({ kind: 'node', at: [10, 0] });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const f = (await saved(page)).floors[0];
  expect(f.points.map(p => [r3(p.x), r3(p.z)])).toEqual([[10, 0], [14, 0], [14, 4], [10, 4]]);
});

const ROOF = (id, pts) => ({ id, levelId: 7, follows: 'none', pitch: 4, overhang: 8,
  points: pts.map(([x, z]) => ({ x, y: 0, z })), edges: pts.map(() => 'eave'), edgeOverhang: pts.map(() => 8) });
const ROOF_LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];

test('a roof node dragged lands on another roof\'s corner, and never on itself', async ({ page }) => {
  await open(page, drawing({ levels: ROOF_LEVELS, activeLevelIdx: 1,
    roofs: [ROOF('ra', [[0, 0], [20, 0], [20, 12], [0, 12]]), ROOF('rb', [[26, 0], [40, 0], [40, 12], [26, 12]])] }),
    '/MODEL.html?level=7');
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at, scale } = await h.planFrame(page);
  // Pick roof B and arm MOVE.
  await page.mouse.click(...at(33, 6));
  await page.waitForTimeout(100);
  await expect(page.locator('#model-move')).toBeVisible();
  await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
  // Its top-left node to 4 px off roof A's top-right corner: on it.
  await dragFrom(page, at, [26, 0], [20 + 4 / scale, 4 / scale]);
  expect(await magnet(page)).toEqual({ kind: 'node', at: [20, 0] });
  await page.mouse.up();
  await page.waitForTimeout(100);
  let rb = (await saved(page)).roofs.find(r => r.id === 'rb');
  expect([r3(rb.points[0].x), r3(rb.points[0].z)]).toEqual([20, 0]);
  // A NUDGE OF 6 PX with nothing near moves it 6 px: the node is not its own
  // magnet, so it does not snap straight back to where it was. (The save's
  // Escape put MOVE down and let the roof go: pick it again.)
  await page.mouse.click(...at(33, 6));
  await page.waitForTimeout(100);
  await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
  await dragFrom(page, at, [40, 12], [40 + 6 / scale, 12 + 6 / scale]);
  expect(await magnet(page)).toBeNull();
  await page.mouse.up();
  await page.waitForTimeout(100);
  rb = (await saved(page)).roofs.find(r => r.id === 'rb');
  expect([r3(rb.points[2].x), r3(rb.points[2].z)]).toEqual([r3(40 + 6 / scale), r3(12 + 6 / scale)]);
});
