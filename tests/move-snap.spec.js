// THE MOVE DRAG CATCHES BY THE HAND, AND LINES UP SQUARE.
//
// Movie, 19 Oct, dragging a WC assembly with MOVE and the T-square lit:
// "i'd also like the cursor in this version of MOVE when i mouse over
// corners / lines etc to creat a SNAPpoint (even to when my mouse is
// perpendicular to the node / my moving edge" -- "stuff should glow when i
// mouse over so i know its magnetic snapable" -- "to lines corners and
// NODE". Before this, only the points the move carried sought the magnet;
// the hand itself caught nothing, nothing glowed before the press, and a
// corner straight across from a node had no reason to stop level with it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
const L = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, levelId: 3, view: 'plan' });
// A two-wall WC assembly, and LINES for targets: a line has nodes at its
// ends and its body for a face, and no face corners an inch off the node
// to muddy which tier caught. H runs along x, V and N run along z.
const drawing = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  nextDrawingItemId: 20, nextGroupId: 2,
  walls: [W('wc1', [0, 0], [8, 0]), W('wc2', [8, 0], [8, 6])],
  lines: [L('H', [20, 14], [32, 14]), L('V', [22, 14], [22, 18]), L('N', [24.4, 14], [24.4, 18])],
  floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [{ id: 'group-1', name: 'WC 1', fixed: true, stretchBehavior: 'rigid',
    members: [{ type: 'wall', id: 'wc1' }, { type: 'wall', id: 'wc2' }] }],
  levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.count() && await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return zoomTo(page, 20);
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
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const wall = (d, id) => d.walls.find(w => w.id === id);
// The press, then the travel in steps, held there for the magnet to read.
async function dragFrom(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.waitForTimeout(80);
}
async function release(page) {
  await page.mouse.up();
  await page.waitForTimeout(150);
}
async function pickAssembly(page, at) {
  await page.mouse.click(...at(4, 0));
  await expect(page.locator('#delete')).toBeVisible();
}
async function armMove(page, at) {
  await pickAssembly(page, at);
  await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
}
async function lightTsquare(page) {
  const chip = page.locator('[data-mode-tsquare]');
  if (!/\blit\b/.test(await chip.getAttribute('class') || '')) await chip.click();
  await expect(chip).toHaveClass(/lit/);
}
async function snapOff(page) {
  const chip = page.locator('[data-mode-snap]');
  if (/\blit\b/.test(await chip.getAttribute('class') || '')) await chip.click();
  await expect(chip).not.toHaveClass(/lit/);
}
// The brightest ink in a 3 x 3 around a world point.
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
    const p = { r: d[i], g: d[i + 1], b: d[i + 2] };
    if (!best || p.r + p.g > best.r + best.g) best = p;
  }
  return best;
}, [x, z]);
const orangeish = ink => ink.r > ink.g + 25 && ink.g > ink.b + 25;

test('MOVE armed, nothing pressed: the node under the hand glows and is named, the nodes near it glow faintly, and a new selection reads a new magnet', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  // Two pixels each way off H's end (an inch and a half at 20 px a foot,
  // inside a node's 2"): the node, before any press.
  await page.mouse.move(at(20, 14)[0] + 2, at(20, 14)[1] + 2);
  await page.waitForTimeout(120);
  expect(await magnet(page), 'the hand over a node, no press').toEqual({ kind: 'node', at: [20, 14] });
  expect(orangeish(await inkAt(page, 20 + 8 / 20, 14)), 'its donut, orange').toBe(true);
  expect(orangeish(await inkAt(page, 22, 14)), 'and V\'s end near it, faint orange').toBe(true);
  // Over nothing: nothing.
  await page.mouse.move(...at(10, 9));
  await page.waitForTimeout(120);
  expect(await magnet(page), 'over nothing').toBeNull();
  // THE WC'S OWN NODE IS NO MAGNET FOR THE WC -- and is one for the line
  // picked next: the magnet is read again for the new selection.
  await page.mouse.move(at(8, 0)[0] + 2, at(8, 0)[1] + 2);
  await page.waitForTimeout(120);
  expect(await magnet(page), 'its own corner pulls nothing').toBeNull();
  await page.keyboard.press('Escape');
  await page.mouse.click(...at(26, 14));
  await expect(page.locator('#model-move')).toBeVisible();
  await page.locator('#model-move').click();
  // (Its far end, from the open side: a wall's end has two face corners an
  // inch or two off the node, and the node has to be the nearer.)
  await page.mouse.move(at(0, 0)[0] + 2, at(0, 0)[1]);
  await page.waitForTimeout(120);
  expect(await magnet(page), 'with H in hand, the WC\'s corner is a node').toEqual({ kind: 'node', at: [0, 0] });
});

test('dragging with the hand over a node puts the grab point exactly on it', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  // Grabbed at (4, 3), the hand ends an inch and a half off H's end: the
  // grab point goes onto the node and the assembly comes with it.
  await dragFrom(page, at, [4, 3], [20.1, 14.08]);
  expect(await magnet(page)).toEqual({ kind: 'node', at: [20, 14] });
  await release(page);
  const d = await saved(page);
  expect([r3(wall(d, 'wc1').start.x), r3(wall(d, 'wc1').start.z)], 'moved by (16, 11) exactly').toEqual([16, 11]);
  expect([r3(wall(d, 'wc2').end.x), r3(wall(d, 'wc2').end.z)], 'the whole assembly').toEqual([24, 17]);
});

test('and over a line\'s body puts it on the line', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  await dragFrom(page, at, [4, 3], [26, 14.1]);
  const m = await magnet(page);
  expect(m.kind).toBe('face');
  expect(m.at).toEqual([26, 14]);
  await release(page);
  const d = await saved(page);
  expect([r3(wall(d, 'wc1').start.x), r3(wall(d, 'wc1').start.z)], 'the grab point on H').toEqual([22, 11]);
});

test('T-square lit, moving across: a carried corner stops level with a node far below it, and the guide says which', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  await lightTsquare(page);
  // The hand goes 11.9 across (and a little down, dropped by the square):
  // the WC's right-hand corners come to x = 19.9, a tenth short of H's end
  // at x = 20 -- fourteen feet below them. They stop at 20 exactly.
  await dragFrom(page, at, [4, 3], [15.9, 3.5]);
  const m = await magnet(page);
  expect(m.kind, 'a node').toBe('node');
  expect(m.at, 'H\'s end').toEqual([20, 14]);
  expect(m.guide[1], 'the guide runs to it').toEqual([20, 14]);
  expect(m.guide[0][0], 'from the corner that lined up, at x = 20').toBe(20);
  await release(page);
  const d = await saved(page);
  expect([r3(wall(d, 'wc1').end.x), r3(wall(d, 'wc1').end.z)], 'level with the node, and not a hair down').toEqual([20, 0]);
  expect(r3(wall(d, 'wc1').start.x), 'twelve across').toBe(12);
});

test('and the hand\'s own line-up wins over a carried corner\'s nearer one', async ({ page }) => {
  await open(page);
  // ZOOMED OUT TO 10 PX A FOOT, where the 4 px floor reaches 0.4 ft: both
  // the hand and the corner are in reach of a node.
  const { at } = await zoomTo(page, 10);
  await armMove(page, at);
  await lightTsquare(page);
  // The hand at x = 20.3, three tenths off H's end; the WC's corner at
  // 24.3, one tenth off N's. The hand is being aimed: it wins.
  await dragFrom(page, at, [4, 3], [20.3, 3.4]);
  const m = await magnet(page);
  expect(m.at, 'the hand\'s node').toEqual([20, 14]);
  expect(m.guide[0], 'from the grab point, squared').toEqual([20, 3]);
  await release(page);
  const d = await saved(page);
  expect([r3(wall(d, 'wc1').start.x), r3(wall(d, 'wc1').start.z)], 'sixteen across exactly').toEqual([16, 0]);
});

test('SNAP off: no catch, no glow, the hand goes where it went', async ({ page }) => {
  const { at } = await open(page);
  await snapOff(page);
  await armMove(page, at);
  await page.mouse.move(at(20, 14)[0] + 2, at(20, 14)[1] + 2);
  await page.waitForTimeout(120);
  expect(await magnet(page), 'nothing lit on hover').toBeNull();
  await dragFrom(page, at, [4, 3], [20.1, 14.08]);
  expect(await magnet(page), 'nothing lit in the drag').toBeNull();
  await release(page);
  const d = await saved(page);
  expect(wall(d, 'wc1').start.x, 'free').toBeCloseTo(16.1, 1);
  expect(wall(d, 'wc1').start.z).toBeCloseTo(11.08, 1);
});

test('a typed LENGTH after a snapped drag measures from the start along the snapped way', async ({ page }) => {
  const { at } = await open(page);
  await armMove(page, at);
  await lightTsquare(page);
  await dragFrom(page, at, [4, 3], [20.3, 3.4]);
  await release(page);
  const box = page.locator('#frozen-length');
  await expect(box).toBeEnabled();
  await page.keyboard.type("20'");
  await page.keyboard.press('Enter');
  await expect(page.locator('#strip-message')).toContainText('Moved');
  const d = await saved(page);
  expect([r3(wall(d, 'wc1').start.x), r3(wall(d, 'wc1').start.z)], 'twenty across, square').toEqual([20, 0]);
});
