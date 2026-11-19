// THE FOUNDATION WALLS ON THE BASEMENT PLAN CATCH, AND A WALL'S FACE
// CORNERS WEAR TEAL (jb, 19 Nov 2026).
//
// Drawing a basement wall along the foundation's inside face: "can we make
// the interior wall corners NODES the orange type maybe or maybe make a
// special color for the interior nodes" -- "interior wall line corners" --
// "for lines area etc too floor" -- "and room tags".
//
// The BASEMENT plan paints the house's foundation walls faded under its own
// (paintBasementFoundationGhost, model/01) but they were paint only: no end,
// face corner or face of theirs caught any tool. Now they pull as the BG
// layers' walls do (basementGhostWalls), for WALL, LINE, SHAPE, FLOOR and a
// dragged corner of a SHAPE or ROOM TAG. And every corner of a wall's face
// lines rings TEAL (model/10, DONUT.teal), the yellow kept for a crossing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SHOTS = process.env.FACE_CORNER_SHOTS || '';
const W = (id, a, b, extra) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8, ...extra });
// A foundation loop, its line on the OUTSIDE face, 8" of concrete inside.
const F = (id, a, b) => W(id, a, b, { levelId: 1, view: 'foundation', wallType: 'concrete_8',
  refLine: 'left', baseHeight: -8, topHeight: 0 });
const T = 8 / 12;
const IN_SW = { x: T, z: T };
const IN_SE = { x: 20 - T, z: T };
const square = (x, z, s) => [{ x, z }, { x: x + s, z }, { x: x + s, z: z + s }, { x, z: z + s }];
const drawing = (extra = {}) => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 40, nextRoomTagId: 2,
  walls: [W('n', [0, 0], [12, 0]),
    ...[['fn', [0, 0], [20, 0]], ['fe', [20, 0], [20, 16]], ['fs', [20, 16], [0, 16]], ['fw', [0, 16], [0, 0]]]
      .map(([id, a, b]) => F(id, a, b)),
    W('bp', [10, 4], [10, 12], { levelId: 1, wallType: 'stud_2x4' })],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], fixtures: [],
  outlines: [], shapes: [{ id: 'sh', points: square(3, 3, 3), levelId: 1, layer: 'SHAPE' }],
  surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [{ id: 1, at: { x: 15, z: 5 }, levelId: 1, view: 'plan', name: 'REC', areaSqFt: 0,
    underMin: false, stamped: true, points: square(14, 3, 3) }],
  columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  ...extra,
});
async function open(page, url, skin = { tsquare: false, footLight: false }) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f, skin }) => {
    try { localStorage.setItem('draft-skin', JSON.stringify(skin)); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing(), skin });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const frame = await h.planFrame(page);
  expect(frame.scale).toBeGreaterThan(24);
  return frame;
}
const BASEMENT = '/MODEL.html?left=1&level=1&view=plan';
const magnet = async page => JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet') || 'null');
const hover = async (page, at, pt, dx = 2, dy = -1) => {
  const [px, py] = at(pt.x, pt.z);
  await page.mouse.move(px + dx, py + dy);
  await page.waitForTimeout(80);
};
const r3 = n => Math.round(n * 1000) / 1000;
const r4 = n => Number(n.toFixed(4));
const ring = pts => pts.map(p => [r3(p.x), r3(p.z)]);
// The donut's dot, read off the sheet at a world point.
const inkAt = (page, x, z) => page.evaluate(([wx, wz]) => {
  const c = document.getElementById('plan');
  const [cx, cz, scale] = c.getAttribute('data-view').trim().split(/\s+/).map(Number);
  const r = c.getBoundingClientRect();
  const dpr = c.width / r.width;
  const px = Math.round(((wx - cx) * scale + r.width / 2) * dpr);
  const py = Math.round(((wz - cz) * scale + r.height / 2) * dpr);
  const d = c.getContext('2d').getImageData(px - 1, py - 1, 3, 3).data;
  const out = [];
  for (let i = 0; i < d.length; i += 4) out.push({ r: d[i], g: d[i + 1], b: d[i + 2] });
  return out;
}, [x, z]);
const isTeal = px => px.some(p => p.r < 60 && p.g > 150 && p.b > 120 && p.g > p.b);
const isYellow = px => px.some(p => p.r > 235 && p.g > 200 && p.b < 60);
async function arm(page, key) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const btn = page.locator(`[data-tool-key="${key}"]`).first();
  if (await btn.getAttribute('aria-pressed') !== 'true') await btn.evaluate(b => b.click());
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
}

test('on the BASEMENT plan the foundation walls\' inside corners catch WALL, LINE, SHAPE and FLOOR, in teal', async ({ page }) => {
  const { at } = await open(page, BASEMENT);
  for (const key of ['wall', 'line', 'shape', 'floor']) {
    await arm(page, key);
    await hover(page, at, IN_SW, 20, 20);
    await hover(page, at, IN_SW);
    expect(await magnet(page), `${key}: the inside corner`).toEqual({ kind: 'corner', at: [r4(IN_SW.x), r4(IN_SW.z)], wall: true });
    expect(isTeal(await inkAt(page, IN_SW.x, IN_SW.z)), `${key}: teal ring`).toBe(true);
    // And the inside face itself, between the corners: neon, as a wall's.
    await hover(page, at, { x: 5, z: T }, 0, 2);
    expect(await magnet(page), `${key}: the inside face`).toEqual({ kind: 'face', at: [5, r4(T)] });
    await page.keyboard.press('Escape');
  }
  await arm(page, 'wall');
  await hover(page, at, IN_SE);
  if (SHOTS) {
    const [px, py] = at(IN_SE.x, IN_SE.z);
    await page.screenshot({ path: `${SHOTS}/basement-inside-corner.png`, clip: { x: px - 240, y: py - 150, width: 480, height: 300 } });
  }
  // A WALL PRESSED THERE STARTS EXACTLY ON THE INSIDE CORNER.
  await page.mouse.click(...at(IN_SE.x, IN_SE.z).map((v, i) => v + (i ? -1 : 2)));
  await page.mouse.click(...at(IN_SE.x, 8));
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const made = (await h.savedDrawing(page)).walls.filter(w => !['n', 'fn', 'fe', 'fs', 'fw', 'bp'].includes(w.id));
  expect(made).toHaveLength(1);
  expect([r3(made[0].start.x), r3(made[0].start.z)]).toEqual([r3(IN_SE.x), r3(IN_SE.z)]);
});

async function pick(page, at, pt) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.mouse.click(...at(pt.x, pt.z));
  await page.waitForTimeout(150);
}
async function drag(page, at, from, to, dx = 2, dy = -1) {
  const [sx, sy] = at(from.x, from.z);
  const [ex, ey] = at(to.x, to.z);
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 10, sy + 10);
  await page.mouse.move(ex + dx, ey + dy, { steps: 8 });
  await page.waitForTimeout(80);
  const lit = await magnet(page);
  const teal = isTeal(await inkAt(page, to.x, to.z));
  await page.mouse.up();
  await page.waitForTimeout(120);
  return { lit, teal };
}

test('on the BASEMENT plan a SHAPE\'s and a ROOM TAG\'s corner dragged near an inside corner lands on it', async ({ page }) => {
  const { at } = await open(page, BASEMENT);
  await pick(page, at, { x: 4.5, z: 4.5 });
  expect(await page.evaluate(() => selection.map(s => s.type))).toEqual(['shape']);
  const shape = await drag(page, at, { x: 3, z: 3 }, IN_SW);
  expect(shape.lit).toMatchObject({ kind: 'corner', at: [r4(IN_SW.x), r4(IN_SW.z)], wall: true });
  expect(shape.teal).toBe(true);
  expect(ring(await page.evaluate(() => drawing.shapes[0].points))[0]).toEqual([r3(IN_SW.x), r3(IN_SW.z)]);

  await pick(page, at, { x: 15.5, z: 4.5 });
  expect(await page.evaluate(() => selection.map(s => s.type))).toEqual(['roomtag']);
  const tag = await drag(page, at, { x: 17, z: 3 }, IN_SE);
  expect(tag.lit).toMatchObject({ kind: 'corner', at: [r4(IN_SE.x), r4(IN_SE.z)], wall: true });
  expect(ring(await page.evaluate(() => drawing.roomTags[0].points))[1]).toEqual([r3(IN_SE.x), r3(IN_SE.z)]);
});

test('on the FOUNDATION plan the same corner is teal; a crossing of two runs stays yellow', async ({ page }) => {
  const { at } = await open(page, '/MODEL.html?left=1&level=1&view=foundation');
  await arm(page, 'line');
  await hover(page, at, IN_SW);
  expect(await magnet(page)).toEqual({ kind: 'corner', at: [r4(IN_SW.x), r4(IN_SW.z)], wall: true });
  expect(isTeal(await inkAt(page, IN_SW.x, IN_SW.z))).toBe(true);
  // A line across the north wall, then hover where it crosses the other line.
  await page.mouse.click(...at(4, -2));
  await page.mouse.click(...at(4, 3));
  await page.keyboard.press('Escape');
  await page.mouse.click(...at(2, 2));
  await page.mouse.click(...at(6, 2));
  await page.keyboard.press('Escape');
  await hover(page, at, { x: 4, z: 2 }, 2, 0);
  expect(await magnet(page)).toEqual({ kind: 'corner', at: [4, 2] });
  expect(isYellow(await inkAt(page, 4, 2))).toBe(true);
});

// SCREENSHOTS for the PR (FACE_CORNER_SHOTS=dir): ROUGH / DAY, zoomed in on
// the inside corner, the WALL tool's hand on it.
test('shots: the teal ring on the basement plan, DAY', async ({ page }) => {
  test.skip(!SHOTS, 'screenshots only');
  await page.setViewportSize({ width: 1366, height: 768 });
  const frame = await open(page, BASEMENT, { tsquare: false, footLight: false, theme: 'rough', mode: 'day' });
  expect(frame.scale).toBeGreaterThan(0);
  await page.evaluate(([x, z]) => { view.cx = x; view.cz = z; view.scale = 90; paint(); }, [IN_SE.x - 1, IN_SE.z + 0.6]);
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  for (const [key, name] of [['wall', 'wall'], ['line', 'line'], ['floor', 'floor']]) {
    await arm(page, key);
    await hover(page, at, IN_SE, 30, 30);
    await hover(page, at, IN_SE, 3, 2);
    const [px, py] = at(IN_SE.x, IN_SE.z);
    await page.screenshot({ path: `${SHOTS}/day-${name}.png`, clip: { x: px - 360, y: py - 200, width: 560, height: 360 } });
    await page.keyboard.press('Escape');
  }
});
