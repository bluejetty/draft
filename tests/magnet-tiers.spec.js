// THREE TIERS OF MAGNET: ORANGE NODES, YELLOW CORNERS THAT ACT LIKE NODES,
// NEON FACES (Movie, 19 Oct).
//
// "id also like all the ext CORNERS to become NODES, or to ACT like nodes
// (the ACT LIKE nodes , also on all interior corners will be YELLOW glow and
// will be slightly less magnetic than the ORANGE NODES and then the YELLOW/
// GREEN NEON color will be for WALL SURFACES which will also be magnetic for
// other wall surfances/ nodes/ and 'act like' nodes."
//
// #807 gave the faces and their corners a pull and lit both in the cross
// lines' neon, and a face corner pulled HARDER than a wall's own end (14 px
// to 6). This turns that round the way he asked: the orange node reaches
// furthest, the yellow corner a little less, the neon face least -- and a
// crossing of two runs with no node there is a yellow corner too.
//
// "SLIGHTLY LESS MAGNETIC" IS A SHORTER REACH (Movie, 26 Oct, the one snap
// rule): a node 2", a corner 1 1/2", a face 1", and of those in reach the
// nearest wins.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, wallType = 'stud_2x6') => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType, refLine: 'center' });
const L = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan' });
const HALF = 2.75 / 12;
const drawing = (walls, lines = []) => ({
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  nextDrawingItemId: 50,
  walls, lines, floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
// AN L OF 2x6 WALLS, a LINE crossing the bottom wall at (5, 0) with no node
// there, and a short line whose end -- a node -- stands 0.35 ft from that
// crossing, on the wall's own line.
const GAP = 0.35;
const CROSS = { x: 5, z: 0 };
const NODE = { x: 5 + GAP, z: 0 };
const FIXTURE = drawing([W('w1', [0, 0], [10, 0]), W('w2', [10, 0], [10, 8])],
  [L('l1', [5, -3], [5, 3]), L('l2', [NODE.x, 0], [NODE.x, 3])]);

async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
// ZOOM TO A KNOWN SCALE in one wheel turn: the page zooms by
// exp(-deltaY * 0.0015), so one deltaY lands exactly on `target` px/ft.
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
  const [px, py] = at(pt.x, pt.z);
  await page.mouse.move(px + dx, py + dy);
  await page.waitForTimeout(80);
};
const r3 = n => Math.round(n * 1000) / 1000;
// THE DONUT'S DOT, read off the sheet at a world point: the 2.5 px fill in
// the tier's own ink. Orange is (255,154,31), yellow (255,230,0), neon
// (200,255,58); the three are told apart by green and blue alone.
const inkAt = (page, x, z) => page.evaluate(([wx, wz]) => {
  const c = document.getElementById('plan');
  const [cx, cz, scale] = c.getAttribute('data-view').trim().split(/\s+/).map(Number);
  const r = c.getBoundingClientRect();
  const dpr = c.width / r.width;
  const px = Math.round(((wx - cx) * scale + r.width / 2) * dpr);
  const py = Math.round(((wz - cz) * scale + r.height / 2) * dpr);
  const d = c.getContext('2d').getImageData(px - 1, py - 1, 3, 3).data;
  let best = null;
  for (let i = 0; i < d.length; i += 4) {
    const px3 = { r: d[i], g: d[i + 1], b: d[i + 2] };
    if (!best || px3.r + px3.g > best.r + best.g) best = px3;
  }
  return best;
}, [x, z]);
const tierOf = ink => (ink.b > 120 ? 'none'
  : ink.g < 200 ? 'orange' : ink.r > 235 && ink.b < 60 ? 'yellow' : 'neon');

// THE ONE SNAP RULE (Movie, 26 Oct): each catches from its own reach in
// inches on the plan -- a node 2", a corner that acts like one 1 1/2" -- and
// of those in reach the nearest wins. At 52 px a foot that is 8.7 px for the
// node and 6.5 for the crossing, and the two here stand 18 px apart.
test('a node reaches 2", a crossing that acts like one 1 1/2"; a press lands on the one it is in reach of', async ({ page }) => {
  await open(page, FIXTURE);
  const { at } = await zoomTo(page, 52);
  await armLine(page);
  // 4 px from the crossing (an inch), 14 from the node: the crossing.
  await hoverPx(page, at, CROSS, 4, 0);
  expect(await magnet(page)).toEqual({ kind: 'corner', at: [CROSS.x, CROSS.z] });
  // 7.5 px from the crossing (1.7"), 10.5 from the node (2.4"): past both.
  await hoverPx(page, at, CROSS, 7.5, 0);
  expect(await magnet(page)).toBeNull();
  // 10 px from the crossing, 8 from the node (1.85"): the node.
  await hoverPx(page, at, CROSS, 10, 0);
  expect(await magnet(page)).toEqual({ kind: 'node', at: [r3(NODE.x), 0] });
  // Back to an inch off the crossing, and a press lands a line's start
  // exactly on it.
  await hoverPx(page, at, CROSS, 4, 0);
  await page.mouse.click(...at(CROSS.x + 4 / 52, CROSS.z));
  await page.mouse.click(...at(5, -2));
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const line = (await h.savedDrawing(page)).lines.find(l => !['l1', 'l2'].includes(l.id));
  expect([r3(line.start.x), r3(line.start.z)]).toEqual([5, 0]);
});

test('the node glows orange, the corner yellow, the face neon', async ({ page }) => {
  await open(page, FIXTURE);
  const { at } = await zoomTo(page, 52);
  await armLine(page);
  await hoverPx(page, at, NODE, 2, 0);
  expect(await magnet(page)).toMatchObject({ kind: 'node' });
  expect(tierOf(await inkAt(page, NODE.x, NODE.z))).toBe('orange');
  // The outside corner of the L, a face corner: yellow.
  const OUT = { x: 10 + HALF, z: -HALF };
  await hoverPx(page, at, OUT, 2, -2);
  expect(await magnet(page)).toMatchObject({ kind: 'corner' });
  expect(tierOf(await inkAt(page, OUT.x, OUT.z))).toBe('yellow');
  // The crossing: yellow too.
  await hoverPx(page, at, CROSS, 3, 0);
  expect(await magnet(page)).toMatchObject({ kind: 'corner' });
  expect(tierOf(await inkAt(page, CROSS.x, CROSS.z))).toBe('yellow');
  // AND NO YELLOW WHERE TWO WALLS MEET END TO END: that is their node, not
  // a crossing. Hovered 20 px off it the magnets in reach are painted, and
  // nothing yellow may stand on (10, 0).
  const JOIN = { x: 10, z: 0 };
  await hoverPx(page, at, JOIN, -20, 0);
  expect(tierOf(await inkAt(page, JOIN.x, JOIN.z))).not.toBe('yellow');
  // The bottom wall's lower face, well away from every point: neon.
  const FACE = { x: 2.5, z: HALF };
  await hoverPx(page, at, FACE, 0, 3);
  expect(await magnet(page)).toMatchObject({ kind: 'face' });
  expect(tierOf(await inkAt(page, FACE.x, FACE.z))).toBe('neon');
});

test('a dragged node lands on a crossing, and takes the yellow', async ({ page }) => {
  // A free 2x4 to the right; its left end is dragged onto the crossing.
  await open(page, drawing([W('w1', [0, 0], [10, 0]), W('w3', [7, 4], [9, 4], 'stud_2x4')],
    [L('l1', [5, -3], [5, 3])]));
  const { at } = await zoomTo(page, 52);
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.mouse.click(...at(8, 4));
  await page.waitForTimeout(60);
  await page.mouse.move(...at(7, 4));
  await page.mouse.down();
  const [px, py] = at(CROSS.x, CROSS.z);
  await page.mouse.move(px + 5, py - 3, { steps: 8 });
  await page.waitForTimeout(80);
  expect(await magnet(page)).toEqual({ kind: 'corner', at: [CROSS.x, CROSS.z] });
  expect(tierOf(await inkAt(page, CROSS.x, CROSS.z))).toBe('yellow');
  await page.mouse.up();
  await page.waitForTimeout(100);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const w3 = (await h.savedDrawing(page)).walls.find(w => w.id === 'w3');
  expect([r3(w3.start.x), r3(w3.start.z)]).toEqual([5, 0]);
});
