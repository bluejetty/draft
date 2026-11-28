// A STAIR'S CORNERS AND EDGES SNAP (jb, 15 Nov 2026: "can you make the stair
// corners NODE snapable so i can position the corner or edge to a edge wall"
// -- "or t wall corner"). An L or U flight had no corners at all (only a
// straight one did), so it could not be held by one; now every corner of its
// outline is a grab handle and lands on a node or a wall's face corner (a T
// included), and an outside edge brought beside a wall face lies on it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
// Two MAIN FL walls, 8" concrete on their lines: one along z = -12, and a T
// run into its south side down x = 16. Their face corners at the T are the
// targets. An L flight starts at (-2, -4) heading east and turns right.
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: MAIN_FL, view: 'plan', wallType: 'concrete_8', refLine: 'center', baseHeight: 0, topHeight: 8 });
const base = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [W('wa', [-14, -12], [24, -12]), W('wt', [16, -12], [16, 6])],
  roofs: [], fenestrations: [], dimensions: [], floors: [], lines: [],
  outlines: [], shapes: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [], surfaceOpenings: [],
  stairs: [{ id: 7401, levelId: MAIN_FL, view: 'plan', layer: 'A-STR', start: { x: -2, z: -4 }, end: { x: 4, z: -4 },
    widthFt: 3, riseFt: 9, rail: 'left', shape: 'L', turn: 'right', winders: 0, auto: false }],
});

async function open(page) {
  await h.openEditor(page, { drawing: base(), bucket: BUCKET, url: `/MODEL.html?level=${MAIN_FL}`, webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.evaluate(() => { view.cx = 6; view.cz = -4; view.scale = 24; paint(); });
  await page.waitForTimeout(150);
  const frame = await h.planFrame(page);
  const facts = await page.evaluate(() => {
    const st = drawing.stairs[0];
    const o = stairOutlineOf(st);
    const corners = window.DraftGeometry2D.wallFaceCorners(walls(), openingThicknessFt());
    return { corners: o.corners, edges: o.edges, faceCorners: corners };
  });
  // Picked by a press on the first flight.
  await page.mouse.click(...frame.at(0, -4));
  await page.waitForTimeout(120);
  return { frame, facts };
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).stairs[0];
};
const attr = async (page, name) => JSON.parse(await page.locator('#plan').getAttribute(name) || 'null');
const r3 = n => Math.round(n * 1000) / 1000 + 0;
const r4 = n => Number(n.toFixed(4)) + 0;

test('an L flight has a corner a press takes: it rings cyan under the hand', async ({ page }) => {
  const { frame, facts } = await open(page);
  expect(facts.corners.length, 'an L is more than four corners').toBeGreaterThan(4);
  const c = facts.corners.reduce((a, b) => (b.x > a.x || (b.x === a.x && b.z > a.z) ? b : a));
  const [cx, cy] = frame.at(c.x, c.z);
  await page.mouse.move(cx + 1, cy + 1);
  await page.waitForTimeout(150);
  expect(await attr(page, 'data-move-grab')).toEqual([r4(c.x), r4(c.z)]);
});

test('held by a corner, an L lands it exactly on a T wall\'s inside corner', async ({ page }) => {
  const { frame, facts } = await open(page);
  // The T's corner west of the stem, south of the long wall.
  const t = facts.faceCorners.filter(p => p.x < 16 && p.z > -12).sort((a, b) => b.x - a.x || a.z - b.z)[0];
  expect(t, 'the T makes an inside corner').toBeTruthy();
  // The flight's north-east-most corner.
  const c = facts.corners.slice().sort((a, b) => (b.x - b.z) - (a.x - a.z))[0];
  const [cx, cy] = frame.at(c.x, c.z);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(...frame.at(t.x - 0.04, t.z + 0.04), { steps: 8 });
  await page.waitForTimeout(100);
  const lit = await attr(page, 'data-snap-magnet');
  expect(lit?.kind, 'a face corner holds it').toBe('corner');
  expect(lit.at).toEqual([r4(t.x), r4(t.z)]);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const s = await saved(page);
  expect([r3(s.start.x - (-2)), r3(s.start.z - (-4))], 'moved by the corner\'s exact travel')
    .toEqual([r3(t.x - c.x), r3(t.z - c.z)]);
});

test('dragged by its body, any corner of an L lands on a T\'s corner it comes to', async ({ page }) => {
  const { frame, facts } = await open(page);
  const t = facts.faceCorners.filter(p => p.x < 16 && p.z > -12).sort((a, b) => b.x - a.x || a.z - b.z)[0];
  const c = facts.corners.slice().sort((a, b) => (b.x - b.z) - (a.x - a.z))[0];
  // Pressed on the first flight, well away from any corner.
  await page.mouse.move(...frame.at(0, -4));
  await page.mouse.down();
  await page.mouse.move(...frame.at(t.x - c.x - 0.04, -4 + t.z - c.z + 0.04), { steps: 8 });
  await page.waitForTimeout(100);
  const lit = await attr(page, 'data-snap-magnet');
  expect(lit?.kind, 'a face corner holds it').toBe('corner');
  expect(lit.at).toEqual([r4(t.x), r4(t.z)]);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const s = await saved(page);
  expect([r3(s.start.x - (-2)), r3(s.start.z - (-4))]).toEqual([r3(t.x - c.x), r3(t.z - c.z)]);
});

test('dragged by its body, an L\'s edge lies on a wall face it comes beside', async ({ page }) => {
  const { frame, facts } = await open(page);
  // North edge of the flight; the wall's south face is at z = -12 + 4/12.
  const north = Math.min(...facts.corners.map(p => p.z));
  const face = -12 + 4 / 12;
  await page.mouse.move(...frame.at(0, -4));
  await page.mouse.down();
  // Bring the north edge to 4" short of the face: within 14 px at 24 px/ft.
  const want = face - north + 4 / 12;
  await page.mouse.move(...frame.at(0, -4 + want), { steps: 8 });
  await page.waitForTimeout(100);
  const lit = await attr(page, 'data-snap-magnet');
  expect(lit?.kind, 'the face holds it').toBe('face');
  await page.mouse.up();
  await page.waitForTimeout(150);
  const s = await saved(page);
  expect(r3(s.start.z - (-4)), 'its north edge on the face').toBe(r3(face - north));
});

test('MOVE: an L taken by its corner lands on the T\'s corner too', async ({ page }) => {
  const { frame, facts } = await open(page);
  const t = facts.faceCorners.filter(p => p.x < 16 && p.z > -12).sort((a, b) => b.x - a.x || a.z - b.z)[0];
  const c = facts.corners.slice().sort((a, b) => (b.x - b.z) - (a.x - a.z))[0];
  await page.keyboard.press('m');
  await page.waitForTimeout(100);
  const [cx, cy] = frame.at(c.x, c.z);
  await page.mouse.move(cx + 1, cy);
  await page.waitForTimeout(100);
  expect(await attr(page, 'data-move-grab'), 'the corner is a grab').toEqual([r4(c.x), r4(c.z)]);
  await page.mouse.down();
  await page.mouse.move(...frame.at(t.x - 0.04, t.z + 0.04), { steps: 8 });
  await page.waitForTimeout(100);
  const lit = await attr(page, 'data-snap-magnet');
  expect(lit?.at).toEqual([r4(t.x), r4(t.z)]);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const s = await saved(page);
  expect([r3(s.start.x - (-2)), r3(s.start.z - (-4))]).toEqual([r3(t.x - c.x), r3(t.z - c.z)]);
});

// ROTATE (and MIRROR) CATCH A STAIR'S CORNERS (jb, 20 Nov 2026: "can we make
// the node snap work on the corner of the stairs when i'm using the ROTATE
// command"): every outline corner of an L, landing included, is a node while
// the turn's centre and arm are picked -- and only then.
test('ROTATE\'s picks catch an L flight\'s corners, landing included', async ({ page }) => {
  const { frame, facts } = await open(page);
  const key = c => [r4(c.x), r4(c.z)];
  expect(await page.evaluate(() => stairSnapNodes().length), 'no stair nodes under SELECT').toBe(0);
  await page.keyboard.press('z');
  expect(await page.evaluate(() => activeTool)).toBe('rotate');
  const nodes = await page.evaluate(() => stairSnapNodes().map(n => [n.x, n.z]));
  // Every outline corner (and the inside ones besides, 25 Nov).
  facts.corners.forEach(c => expect(nodes.some(([x, z]) => Math.abs(x - c.x) < 1e-6 && Math.abs(z - c.z) < 1e-6)).toBe(true));
  // The flight's south-most corner, out on the turned flight's foot.
  const c = facts.corners.slice().sort((a, b) => b.z - a.z || b.x - a.x)[0];
  const [cx, cy] = frame.at(c.x, c.z);
  await page.mouse.move(cx + 2, cy + 2);
  await page.waitForTimeout(150);
  expect(await attr(page, 'data-snap-node')).toEqual(key(c));
  await page.mouse.click(cx + 2, cy + 2);
  await page.waitForTimeout(120);
  const base = await page.evaluate(() => [draftCmd.turn.base.x, draftCmd.turn.base.z]);
  expect(base.map(r4)).toEqual(key(c));
  // The arm takes another corner the same way: the landing's outer corner
  // (the north-east-most).
  const d = facts.corners.slice().sort((a, b) => (b.x - b.z) - (a.x - a.z))[0];
  const [dx, dy] = frame.at(d.x, d.z);
  await page.mouse.move(dx - 2, dy + 2);
  await page.waitForTimeout(150);
  expect(await attr(page, 'data-snap-node')).toEqual(key(d));
  await page.keyboard.press('Escape');
});

// AND LINE (jb, 24 Nov 2026: "i'm trying to draw a line and use a node on
// the stairs to start the line but not making nodes for the line"): the
// same corners are nodes for the drawing tools.
test('LINE catches an L flight\'s corners: a line starts on one', async ({ page }) => {
  const { frame, facts } = await open(page);
  await page.keyboard.press('l');
  expect(await page.evaluate(() => activeTool)).toBe('line');
  // Every outline corner is a node (and, since 25 Nov, the inside ones too:
  // tests/stair-inside-corners.spec.js).
  const nodes = await page.evaluate(() => stairSnapNodes());
  facts.corners.forEach(c => expect(nodes.some(n => Math.abs(n.x - c.x) < 1e-6 && Math.abs(n.z - c.z) < 1e-6)).toBe(true));
  const c = facts.corners.slice().sort((a, b) => b.z - a.z || b.x - a.x)[0];
  const [cx, cy] = frame.at(c.x, c.z);
  await page.mouse.move(cx + 2, cy + 2);
  await page.waitForTimeout(150);
  expect(await attr(page, 'data-snap-node')).toEqual([r4(c.x), r4(c.z)]);
  await page.keyboard.press('Escape');
});
