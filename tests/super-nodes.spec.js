// SUPER NODES: a suite hologram clicks onto the house by its own magnetic
// corners (Movie, 20 Oct).
//
// "can i make special 'NODES' -- make a NODE command in the drafting menu,
// and those will be super high power nodes very SNAP Magnetic. and my plan is
// to place them on the corners of the suites where they will attach to the
// other SUPER NODES that i will place on the corners of all the suites and
// the outside corner will be the outside ext wall line, the inside corner
// will be the inside int wall line." -- SUPERNODE; "think 1ft is good";
// "super nodes will attach to other super nodes" -- "and also to other nodes
// but secondarily (to place the first one)"; "corner SUPER nodes GREEN /
// BLUE / TURQOISE BRIGHT".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, extra = {}) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, ...extra });
const WIN = (id, wallId, offset, width = 4) => ({ id, wallId, levelId: 3, view: 'plan', type: 'window',
  offset, width, sillHeight: 3, headHeight: 6.67 });
const SN = (id, x, z) => ({ id, levelId: 3, view: 'plan', point: { x, y: 0, z } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], superNodes: [] };
// A 20 x 15 suite with a super node on its bottom-left corner and a window
// on its bottom wall, in the corner of a 60 x 30 shell. The shell carries a
// super node thirty feet along its bottom wall, where the suite should go.
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('s1', [0, 0], [20, 0]), W('s2', [20, 0], [20, 15]), W('s3', [20, 15], [0, 15]), W('s4', [0, 15], [0, 0])],
  fenestrations: [WIN('w1', 's1', 8)], superNodes: [SN('sn1', 0, 0)] };
const shell = ({ holo = {}, superNodes = [SN('hn1', 30, 0)], holograms = true } = {}) => ({
  version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  nextDrawingItemId: 20,
  walls: [W('a', [0, 0], [60, 0]), W('b', [60, 0], [60, 30]), W('c', [60, 30], [0, 30]), W('d', [0, 30], [0, 0])],
  superNodes,
  holograms: holograms ? [{ id: 'h1', name: 'suite-a', mode: 'suite', x: 0, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7.5,
    source: SUITE, ...holo }] : [] });

async function open(page, drawing, url = '/MODEL.html?level=3&left=1') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.count() && await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const r3 = n => Math.round(n * 1000) / 1000;
const lockAt = async page => JSON.parse(await page.locator('#plan').getAttribute('data-super-lock') || 'null');
// MOVE on the HOLOGRAM card, then the suite dragged from inside it.
async function dragSuite(page, at, from, to, { release = true } = {}) {
  await page.locator('[data-mode-hologram]').click();
  await page.locator('#hologram-ask [data-hologram-move="h1"]').click();
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.waitForTimeout(100);
  if (release) { await page.mouse.up(); await page.waitForTimeout(150); }
}
async function lightTsquare(page) {
  const chip = page.locator('[data-mode-tsquare]');
  if (!/\blit\b/.test(await chip.getAttribute('class') || '')) await chip.click();
  await expect(chip).toHaveClass(/lit/);
}
const hostOpenings = (page, d) => page.evaluate(d => window.DraftHologram.hostOpenings(d)
  .map(o => [o.wallId, Math.round(o.offset * 100) / 100, o.width, o.id]), d);

test('SUPERNODE armed: a press by a corner lands the node on it exactly, and a reload keeps it', async ({ page }) => {
  const { at } = await open(page, shell({ superNodes: [], holograms: false }));
  await page.locator('[data-tool-key="node"]').click();
  await expect(page.locator('[data-tool-key="node"]')).toHaveAttribute('aria-pressed', 'true');
  // Two pixels off the shell's corner node: the node.
  const [nx, ny] = at(60, 0);
  await page.mouse.click(nx + 2, ny - 1);
  await page.waitForTimeout(100);
  // And two pixels off the outside face corner of that same corner, 2 3/4"
  // out each way: the face corner, which is the exterior wall line.
  const [fx, fy] = at(60 + 2.75 / 12, -2.75 / 12);
  await page.mouse.click(fx + 2, fy - 1);
  await page.waitForTimeout(100);
  let d = await saved(page);
  expect(d.superNodes.map(n => [r3(n.point.x), r3(n.point.z)])).toEqual([[60, 0], [60.229, -0.229]]);
  expect(d.superNodes.map(n => n.levelId)).toEqual([3, 3]);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  d = await saved(page);
  expect(d.superNodes, 'kept through a reload').toHaveLength(2);
});

// FOUR INCHES, not the foot it was (Movie, 23 Oct: "switch both to 4"").
test('a suite dragged to within 4" of a house super node clicks onto it exactly, and its window cuts the shell', async ({ page }) => {
  const { at } = await open(page, shell());
  // The hand carries the suite 29.75 ft across: its corner node stops three
  // inches short of the house's at (30, 0), and is pulled on.
  await dragSuite(page, at, [10, 7.5], [39.75, 7.5], { release: false });
  expect(await lockAt(page), 'the house node holding it').toEqual([30, 0]);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const d = await saved(page);
  expect([r3(d.holograms[0].x), r3(d.holograms[0].z)], 'the suite exactly thirty across').toEqual([30, 0]);
  // ITS WINDOW CUTS THE SHELL WALL it now lies in: eight along the suite's
  // bottom wall, thirty-eight along the shell's.
  expect(await hostOpenings(page, d)).toEqual([['a', 38, 4, 'h1:w1']]);
});

test('six inches short, no catch: the suite stays where the hand left it', async ({ page }) => {
  const { at } = await open(page, shell());
  await dragSuite(page, at, [10, 7.5], [39.5, 7.5], { release: false });
  expect(await lockAt(page), 'nothing holding it').toBeNull();
  await page.mouse.up();
  await page.waitForTimeout(150);
  const d = await saved(page);
  expect(d.holograms[0].x).toBeCloseTo(29.5, 1);
});

test('T-square lit: the catch moves the suite along the hand\'s axis only', async ({ page }) => {
  // The house node a little below the line: the catch would pull the suite
  // a few inches across and down; the square keeps the down.
  const { at } = await open(page, shell({ superNodes: [SN('hn1', 30, 0.2)] }));
  await lightTsquare(page);
  await dragSuite(page, at, [10, 7.5], [39.8, 7.6]);
  const d = await saved(page);
  expect([r3(d.holograms[0].x), r3(d.holograms[0].z)], 'thirty across, not an inch down').toEqual([30, 0]);
});

// A BLUE ONE CATCHES TOO (Movie, 23 Oct: "all suites attrached and glow").
test('a blue hologram\'s corners click on too', async ({ page }) => {
  const { at } = await open(page, shell({ holo: { mode: 'hologram' } }));
  await dragSuite(page, at, [10, 7.5], [39.75, 7.5], { release: false });
  expect(await lockAt(page), 'the house node holding it').toEqual([30, 0]);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const d = await saved(page);
  expect([r3(d.holograms[0].x), r3(d.holograms[0].z)]).toEqual([30, 0]);
});

test('a super node never prints: the LAYOUT sheet draws no turquoise', async ({ page }) => {
  const d = { ...shell({ holograms: false }), layout: { auto: false, nextViewportId: 2, sheets: [{ title: '' }],
    viewports: [{ id: 1, kind: 'plan', levelId: 3, pif: 0.25, xIn: 8, yIn: 5, sheet: 1 }] } };
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: d });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForTimeout(400);
  const turquoise = await page.evaluate(() => {
    const canvas = document.querySelector('[data-layout-canvas]');
    const px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (px[i] < 120 && px[i + 1] > 200 && px[i + 2] > 200) n += 1;
    return n;
  });
  expect(turquoise, 'no super node on the sheet').toBe(0);
});

test('DELETE takes a super node out and UNDO puts it back', async ({ page }) => {
  const { at } = await open(page, shell({ holograms: false }));
  await page.mouse.click(...at(30, 0));
  await page.waitForTimeout(100);
  await expect(page.locator('#delete')).toBeVisible();
  await page.locator('#delete').click();
  await page.waitForTimeout(100);
  expect((await saved(page)).superNodes).toHaveLength(0);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  expect((await saved(page)).superNodes.map(n => n.id)).toEqual(['hn1']);
});
