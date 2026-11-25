// FLUSH / DROPPED ON EACH SPAN, AND THE BEAM POCKETS.
//
// jb, 19 Nov 2026: "make the beam dash-dot, and put flush or dropped on each
// section between columns and allow user to click on flush or dropped to
// change it, and for bungalow (not for bilevel) we need BEAM POCKETS at each
// end where it sits in the conc wall. make them 4" "in" the conc and 8" wide
// on the plan."
const { test, expect } = require('@playwright/test');
const H = require('../proto/harness-env.js');

const W = (id, a, b, wallType = 'concrete_8') => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 1, view: 'foundation', wallType, baseHeight: 0, topHeight: 8, refLine: 'left' });
// A 30 x 24 basement, wound so 'left' puts the 8" concrete inside its lines.
const ring = (type = 'concrete_8') => [
  W('a', [0, 0], [0, -24], type), W('b', [0, -24], [30, -24], type),
  W('c', [30, -24], [30, 0], type), W('d', [30, 0], [0, 0], type)];
const IN = 8 / 12;
// The beam down the middle, inside face to inside face, on two posts.
const beam = (extra = {}) => ({ id: 1, start: { x: IN, y: 0, z: -12 }, end: { x: 30 - IN, y: 0, z: -12 },
  levelId: 1, view: 'foundation', mode: 'flush', auto: true, ...extra });
const posts = () => [10, 20].map((x, i) => ({ id: i + 1, point: { x, y: 0, z: -12 }, levelId: 1, view: 'foundation', footing: 'pad36', auto: true }));

const pockets = (win, { walls = ring(), beams = [beam()], buildType = 'bungalow' } = {}) => {
  const WT = win.DraftWallTypes;
  return win.DraftBeamPockets.beamPockets({
    walls, beams, levelId: 1, buildType,
    thicknessFt: wall => (WT.isCustomWall(wall) ? WT.wallThicknessFt(wall)
      : WT.WALL_TYPES.find(t => t.id === wall.wallType).totalIn / 12),
    faceOffsets: win.DraftGeometry2D.wallFaceOffsets,
  });
};

test('a pocket at each end: 4" into the concrete from the inside face, 8" wide', () => {
  const win = H.loadDraftModules();
  const list = pockets(win);
  expect(list.length).toBe(2);
  const start = list.find(p => p.end === 'start');
  const end = list.find(p => p.end === 'end');
  // Start end in wall a (x 0 to 8"): open at x 8", back at x 4".
  const xs = c => c.corners.map(p => +p.x.toFixed(3)).sort((a, b) => a - b);
  const zs = c => c.corners.map(p => +p.z.toFixed(3)).sort((a, b) => a - b);
  expect(xs(start)).toEqual([0.333, 0.333, 0.667, 0.667]);
  expect(zs(start)).toEqual([-12.333, -12.333, -11.667, -11.667]);
  expect(xs(end)).toEqual([29.333, 29.333, 29.667, 29.667]);
  expect(zs(end)).toEqual([-12.333, -12.333, -11.667, -11.667]);
});

test('an end that stops on the wall line, or short of the face, still gets its pocket', () => {
  const win = H.loadDraftModules();
  expect(pockets(win, { beams: [beam({ start: { x: 0, y: 0, z: -12 }, end: { x: 30, y: 0, z: -12 } })] }).length).toBe(2);
  expect(pockets(win, { beams: [beam({ start: { x: 1.2, y: 0, z: -12 } })] }).length).toBe(2);
  // Ending on a post in the middle of the room: no wall, no pocket.
  expect(pockets(win, { beams: [beam({ end: { x: 20, y: 0, z: -12 } })] }).length).toBe(1);
});

test('no pockets on a bilevel, a modified bilevel, or stud walls', () => {
  const win = H.loadDraftModules();
  expect(pockets(win, { buildType: 'bilevel' })).toEqual([]);
  expect(pockets(win, { buildType: 'modifiedBilevel' })).toEqual([]);
  expect(pockets(win, { walls: ring('stud_2x6') })).toEqual([]);
  expect(pockets(win, { buildType: 'twoStorey' }).length).toBe(2);
});

test('spans run column to column', () => {
  const win = H.loadDraftModules();
  const spans = win.DraftRender2D.beamSpans([beam()], posts());
  expect(spans.map(s => [+s.start.x.toFixed(3), +s.end.x.toFixed(3), s.mode]))
    .toEqual([[0.667, 10, 'flush'], [10, 20, 'flush'], [20, 29.333, 'flush']]);
});

const file = (extra = {}) => ({
  version: 1, board: 'drafting', planTurn: 0, buildType: 'bungalow', autoRoof: false,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 3, nextDrawingItemId: 50, walls: ring(),
  lines: [], floors: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: posts(), beams: [beam()], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], roofs: [],
  ...extra,
});
async function open(page, f = file(), tags = '1') {
  await page.goto('/MODEL.html?left=1');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async d => {
    await window.SharedFileStore.saveSharedFile(new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, f);
  await page.goto('/MODEL.html?level=1&view=foundation&left=1');
  await expect.poll(() => page.locator('#plan').getAttribute('data-beam-span-tags'), { timeout: 15000 }).toBe(tags);
}
// The tag over world x.
const tagAt = async (page, wx) => {
  const hit = await page.evaluate(x => {
    const t = beamSpanTagHits.find(h => Math.min(h.span.start.x, h.span.end.x) < x && Math.max(h.span.start.x, h.span.end.x) > x);
    return { x: t.cx - Math.sin(t.angle) * (t.y0 + t.y1) / 2, y: t.cy + Math.cos(t.angle) * (t.y0 + t.y1) / 2, text: t.text };
  }, wx);
  const box = await page.locator('#plan').boundingBox();
  return { x: box.x + hit.x, y: box.y + hit.y, text: hit.text };
};
const rows = page => page.evaluate(() => drawing.beams.map(b => [+b.start.x.toFixed(3), +b.end.x.toFixed(3), b.mode, b.auto])
  .sort((a, b) => a[0] - b[0]));

// jb, 25 Nov 2026: "only needs FLUSH / DROPPED once per beam".
test('runs: touching spans of one mode on one line share one tag', () => {
  const win = H.loadDraftModules();
  const R = win.DraftRender2D;
  const one = R.beamSpanRuns(R.beamSpans([beam()], posts()));
  expect(one.length).toBe(1);
  expect([+one[0].start.x.toFixed(3), +one[0].end.x.toFixed(3), one[0].mode, one[0].spans.length]).toEqual([0.667, 29.333, 'flush', 3]);
  const mixed = R.beamSpanRuns(R.beamSpans([
    beam({ id: 1, end: { x: 10, y: 0, z: -12 } }),
    beam({ id: 2, start: { x: 10, y: 0, z: -12 }, end: { x: 20, y: 0, z: -12 }, mode: 'dropped' }),
    beam({ id: 3, start: { x: 20, y: 0, z: -12 } })], posts()));
  expect(mixed.map(r => r.mode)).toEqual(['flush', 'dropped', 'flush']);
  // Two beams on separate lines keep a tag each.
  const two = R.beamSpanRuns(R.beamSpans([beam(), beam({ id: 2, start: { x: IN, y: 0, z: -6 }, end: { x: 30 - IN, y: 0, z: -6 } })], posts()));
  expect(two.length).toBe(2);
});

test('MODEL: one tag per beam, pockets on the FOUNDATION view, a click flips the beam', async ({ page }) => {
  await open(page);
  await expect(page.locator('#plan')).toHaveAttribute('data-beam-pockets', '2');
  await page.keyboard.press('s');
  const tag = await tagAt(page, 15);
  expect(tag.text).toBe('FLUSH');
  await page.mouse.click(tag.x, tag.y);
  expect(await rows(page)).toEqual([[0.667, 29.333, 'dropped', false]]);
  // Posts handed over too, so AUTO BEAM leaves the line alone.
  expect(await page.evaluate(() => drawing.columns.every(c => c.auto === false))).toBe(true);
  await expect(page.locator('#plan')).toHaveAttribute('data-beam-span-tags', '1');
  await page.keyboard.press('Control+z');
  expect(await rows(page)).toEqual([[0.667, 29.333, 'flush', true]]);
});

test('MODEL: a beam with a dropped span keeps a tag per mode; flipping it back joins the line', async ({ page }) => {
  const split = [
    beam({ id: 1, end: { x: 10, y: 0, z: -12 }, auto: false }),
    beam({ id: 2, start: { x: 10, y: 0, z: -12 }, end: { x: 20, y: 0, z: -12 }, mode: 'dropped', auto: false }),
    beam({ id: 3, start: { x: 20, y: 0, z: -12 }, auto: false })];
  await open(page, file({ beams: split }), '3');
  await page.keyboard.press('s');
  const middle = await tagAt(page, 15);
  expect(middle.text).toBe('DROPPED');
  await page.mouse.click(middle.x, middle.y);
  expect(await rows(page)).toEqual([[0.667, 29.333, 'flush', false]]);
  await expect(page.locator('#plan')).toHaveAttribute('data-beam-span-tags', '1');
  await page.keyboard.press('Control+z');
  expect(await rows(page)).toEqual([[0.667, 10, 'flush', false], [10, 20, 'dropped', false], [20, 29.333, 'flush', false]]);
});

test('MODEL: a bilevel draws no pockets', async ({ page }) => {
  await open(page, file({ buildType: 'bilevel' }));
  await expect(page.locator('#plan')).toHaveAttribute('data-beam-pockets', '0');
});
