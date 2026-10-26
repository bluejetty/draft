// A SUITE IS HELD BY ITS CORNER (Movie, 26 Oct, the one snapping rule:
// "whole-thing drags grab the nearest own corner within reach"). SUPERNODE
// is gone ("maybe we can get rid of that, it didn't work that good"): a
// press within a node's reach of one of the suite's four outside corners
// takes that corner exactly, cyan before the press; brought within reach of
// a house node or face corner, the corner lands on it exactly -- a point
// beats a line -- and its windows cut the shell where it lies.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, extra = {}) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, ...extra });
const WIN = (id, wallId, offset, width = 4) => ({ id, wallId, levelId: 3, view: 'plan', type: 'window',
  offset, width, sillHeight: 3, headHeight: 6.67 });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], superNodes: [] };
// A 20 x 15 suite with a window on its bottom wall, standing twenty feet
// along the bottom wall of a 60 x 30 shell. It belongs in the shell's corner.
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('s1', [0, 0], [20, 0]), W('s2', [20, 0], [20, 15]), W('s3', [20, 15], [0, 15]), W('s4', [0, 15], [0, 0])],
  fenestrations: [WIN('w1', 's1', 8)] };
const shell = ({ holo = {}, superNodes = [], holograms = true, drop = 0 } = {}) => ({
  version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  nextDrawingItemId: 20,
  walls: [W('a', [0, drop], [60, drop]), W('b', [60, drop], [60, 30]), W('c', [60, 30], [0, 30]), W('d', [0, 30], [0, drop])],
  superNodes,
  holograms: holograms ? [{ id: 'h1', name: 'suite-a', mode: 'suite', x: 20, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7.5,
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
const r3 = n => Math.round(n * 1000) / 1000 + 0;
const magnetAt = async page => JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet') || 'null');
const grabAt = async page => JSON.parse(await page.locator('#plan').getAttribute('data-move-grab') || 'null');
// The suite's outside corner: a 2x6 on its centre line, 2 3/4" out each way.
const OUT = 2.75 / 12;
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

test('a press by the suite\'s corner takes that corner exactly: cyan before the press, held under the hand', async ({ page }) => {
  const { at } = await open(page, shell());
  await page.locator('[data-mode-hologram]').click();
  await page.locator('#hologram-ask [data-hologram-move="h1"]').click();
  // A pixel or two off the bottom-left outside corner, (20 - 2 3/4", -2 3/4").
  const [cx, cy] = at(20 - OUT, -OUT);
  await page.mouse.move(cx + 1, cy - 1);
  await page.waitForTimeout(150);
  expect((await grabAt(page)).map(r3), 'the corner a press would take').toEqual([r3(20 - OUT), r3(-OUT)]);
  await page.mouse.down();
  // Straight down from the corner itself: the corner, not the pixel the
  // press was off it, is what rides the hand, so the suite goes nowhere across.
  await page.mouse.move(cx, cy + 40, { steps: 6 });
  await page.waitForTimeout(100);
  const held = await grabAt(page);
  expect(held, 'the corner rides the hand').toBeTruthy();
  await page.mouse.up();
  await page.waitForTimeout(150);
  const s = await saved(page);
  expect(r3(s.holograms[0].x), 'not a pixel across').toBe(20);
});

test('brought within an inch of the shell\'s outside corner, the suite\'s corner lands on it exactly and its window cuts the shell', async ({ page }) => {
  const { at } = await open(page, shell());
  await dragSuite(page, at, [20 - OUT, -OUT], [-OUT + 1 / 12, -OUT], { release: false });
  const lit = await magnetAt(page);
  expect(lit?.at, 'the shell corner holding it').toEqual([-OUT, -OUT].map(n => Number(n.toFixed(4))));
  await page.mouse.up();
  await page.waitForTimeout(150);
  const d = await saved(page);
  expect([r3(d.holograms[0].x), r3(d.holograms[0].z)], 'the suite exactly in the corner').toEqual([0, 0]);
  expect(await hostOpenings(page, d)).toEqual([['a', 8, 4, 'h1:w1']]);
});

test('a press away from the corners holds the suite loosely, as before', async ({ page }) => {
  const { at } = await open(page, shell());
  await dragSuite(page, at, [30, 7.5], [25, 9.5]);
  const d = await saved(page);
  expect(d.holograms[0].x).toBeCloseTo(15, 1);
  expect(d.holograms[0].z).toBeCloseTo(2, 1);
});

test('T-square lit: the corner\'s catch moves the suite along the hand\'s axis only', async ({ page }) => {
  // The shell an inch lower: its corner is an inch off the line the suite
  // runs along, so the catch would pull it down that inch; the square keeps
  // it on its line.
  const { at } = await open(page, shell({ drop: 1 / 12 }));
  await lightTsquare(page);
  await dragSuite(page, at, [20 - OUT, -OUT], [-OUT + 1 / 12, -OUT + 0.6 / 12]);
  const d = await saved(page);
  expect([r3(d.holograms[0].x), r3(d.holograms[0].z)], 'into the corner, not down').toEqual([0, 0]);
});

// A BLUE SUITE FILE CATCHES TOO (Movie, 23 Oct: "all suites attrached and glow").
test('a blue suite file is held by its corner too', async ({ page }) => {
  const { at } = await open(page, shell({ holo: { mode: 'hologram', source: { ...SUITE, suiteKind: 'residential' } } }));
  await dragSuite(page, at, [20 - OUT, -OUT], [-OUT + 1 / 12, -OUT]);
  const d = await saved(page);
  expect([r3(d.holograms[0].x), r3(d.holograms[0].z)]).toEqual([0, 0]);
});

test('Ctrl held: nothing catches, the corner goes where the hand is', async ({ page }) => {
  const { at } = await open(page, shell());
  await page.locator('[data-mode-hologram]').click();
  await page.locator('#hologram-ask [data-hologram-move="h1"]').click();
  await page.mouse.move(...at(20 - OUT, -OUT));
  await page.mouse.down();
  await page.keyboard.down('Control');
  await page.mouse.move(...at(-OUT + 1 / 12, -OUT), { steps: 8 });
  await page.waitForTimeout(100);
  expect(await magnetAt(page), 'nothing lit').toBeNull();
  await page.mouse.up();
  await page.keyboard.up('Control');
  await page.waitForTimeout(150);
  const d = await saved(page);
  expect(d.holograms[0].x, 'an inch short of the corner').toBeGreaterThan(0.04);
});

test('a super node left in an old file is ignored: the suite holds by its own four corners', async ({ page }) => {
  const SN = (id, x, z) => ({ id, levelId: 3, view: 'plan', point: { x, y: 0, z } });
  const { at } = await open(page, shell({ superNodes: [SN('hn1', 30, 0)] }));
  await dragSuite(page, at, [20 - OUT, -OUT], [30 - OUT + 2 / 12, -OUT]);
  const d = await saved(page);
  expect(r3(d.holograms[0].x), 'no pull to the old node').not.toBe(30);
});
