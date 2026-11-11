// ARCS AND CIRCLES IN THE LINE COMMAND (jb, 11 Nov 2026: "i don't think i
// can draw circle yet" -- "can it be a part of the LINE command, so i could
// includ and ARC in a series of lines, maybe would need to use the right
// click menu for this"). model/19-line-arcs.js; the arc maths in
// geometry-2d.js (lineArc), read by every painter as a circular arc.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const FIXTURE = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  // Two lines far apart so the fitted view has room to draw in between.
  lines: [
    { id: 'la', start: V(-20, -15), end: V(-14, -15), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 },
    { id: 'lb', start: V(14, 15), end: V(20, 15), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 },
  ],
  walls: [], shapes: [], outlines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: FIXTURE() });
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(120); };
const r = v => Math.round(v * 1000) / 1000 + 0;
const strip = page => page.evaluate(() => stripNotice);
const tool = page => page.evaluate(() => activeTool);
const lines = page => page.evaluate(() => drawing.lines.slice(2).map(l =>
  [l.start.x, l.start.z, l.end.x, l.end.z, l.bulge].map(v => Math.round(v * 1000) / 1000 + 0)));
// The circle a bent line is read as: centre, radius, the sweep in degrees.
const arcOf = (page, index) => page.evaluate(i => {
  const l = drawing.lines[2 + i];
  const a = window.DraftGeometry2D.lineArc(l);
  return a ? [a.cx, a.cz, a.r, a.sweep * 180 / Math.PI].map(v => Math.round(v * 100) / 100 + 0) : null;
}, index);
const mode = page => page.evaluate(() => lineArcState.mode);
const inHand = page => page.evaluate(() => !!drawStart);

test('the LINE row stands in the foot: ARC bends the next piece off the one before it, STRAIGHT puts the run back on lines', async ({ page }) => {
  const { at } = await open(page);
  await expect(page.locator('[data-line-bar]')).toBeHidden();
  await page.keyboard.press('l');
  expect(await tool(page)).toBe('line');
  await expect(page.locator('[data-line-bar]')).toBeVisible();
  await expect(page.locator('[data-line-mode="straight"]')).toHaveAttribute('aria-pressed', 'true');
  // A straight piece west to east along z = 0.
  await click(page, at, -10, 0);
  await click(page, at, 0, 0);
  expect(await lines(page)).toEqual([[-10, 0, 0, 0, 0]]);
  // ARC: the next press is the arc's end, and it leaves the line tangent --
  // a quarter circle to (10, 10), centred on (0, 10), radius 10.
  await page.locator('[data-line-mode="arc"]').click();
  expect(await mode(page)).toBe('arc');
  expect(await strip(page)).toContain('press where the arc ends');
  await click(page, at, 10, 10);
  expect((await lines(page)).length).toBe(2);
  const [, arc] = await lines(page);
  expect(arc.slice(0, 4)).toEqual([0, 0, 10, 10]);
  expect(arc[4]).not.toBe(0);
  expect(await arcOf(page, 1)).toEqual([0, 10, 10, 90]);
  // STRAIGHT again: the run goes on from the arc's end as plain lines.
  await page.locator('[data-line-mode="straight"]').click();
  await click(page, at, 10, 14);
  expect((await lines(page))[2]).toEqual([10, 10, 10, 14, 0]);
  await page.keyboard.press('Enter');
  expect(await inHand(page)).toBe(false);
  // The three pieces are one string, as a string of lines always is.
  const group = await page.evaluate(() => drawing.groups.map(g => [g.name, g.members.length]));
  expect(group).toEqual([['LINES 1', 3]]);
  // The string picks whole, on the arc's own curve.
  await page.keyboard.press('s');
  await click(page, at, 7.07, 2.93);
  expect((await page.evaluate(() => selection.map(s => s.item.id))).length).toBe(3);
  // Putting the tool down puts the mode back on STRAIGHT.
  expect(await mode(page)).toBe('straight');
});

test('3-POINT ARC takes the end then the point the arc passes through; ARC on a fresh run asks the same', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('l');
  await page.locator('[data-line-mode="arc3"]').click();
  await click(page, at, -10, 0);
  await click(page, at, 10, 0);
  expect(await strip(page)).toContain('passes through');
  expect((await lines(page)).length, 'nothing is drawn until the through point').toBe(0);
  // Through (0, 10): a half circle of radius 10 about the origin.
  await click(page, at, 0, 10);
  expect(await lines(page)).toEqual([[-10, 0, 10, 0, 20]]);
  expect(await arcOf(page, 0)).toEqual([0, 0, 10, -180]);
  // The run goes on from the arc's end; ESC puts it down.
  expect(await inHand(page)).toBe(true);
  await page.keyboard.press('Escape');
  // THE PANEL READS THE ARC ALONG ITS CURVE AND NAMES ITS RADIUS: a half
  // circle of 10 is 31'-5" round.
  await page.keyboard.press('s');
  await click(page, at, 0, 10);
  expect(await page.evaluate(() => selection.map(s => s.item.id))).toEqual(['line-50']);
  await expect(page.locator('[data-prop-radius]')).toContainText("10'");
  await expect(page.locator('[data-prop-span]')).toContainText("31'-5");
  // ARC with nothing before it asks for the through point too.
  await page.keyboard.press('l');
  await page.locator('[data-line-mode="arc"]').click();
  await click(page, at, 10, 10);
  await click(page, at, 20, 10);
  expect(await strip(page)).toContain('passes through');
  await click(page, at, 15, 7);
  expect((await lines(page)).length).toBe(2);
  expect(await arcOf(page, 1)).toEqual([15, 12.67, 5.67, 123.86]);
});

test('CIRCLE: the centre, then the radius pressed or typed; two half circles as one CIRCLE assembly, one UNDO', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('l');
  await page.locator('[data-line-mode="circle"]').click();
  expect(await strip(page)).toContain('press the centre');
  await click(page, at, 0, 0);
  expect(await strip(page)).toContain('radius');
  await click(page, at, 4, 0);
  expect(await lines(page)).toEqual([[-4, 0, 4, 0, 8], [4, 0, -4, 0, 8]]);
  expect(await arcOf(page, 0)).toEqual([0, 0, 4, -180]);
  expect(await arcOf(page, 1)).toEqual([0, 0, 4, -180]);
  expect(await page.evaluate(() => drawing.groups.map(g => [g.name, g.members.length]))).toEqual([['CIRCLE 1', 2]]);
  expect(await inHand(page), 'a circle does not chain').toBe(false);
  expect(await mode(page), 'the tool stays on CIRCLE for the next one').toBe('circle');
  // Typed: centre at (10, 10), R 3.
  await click(page, at, 10, 10);
  await page.mouse.move(...at(14, 10));
  await page.keyboard.press('r');
  await page.keyboard.type('3');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  expect((await lines(page)).length).toBe(4);
  expect(await arcOf(page, 2)).toEqual([10, 10, 3, -180]);
  // One UNDO takes the whole circle back.
  await page.keyboard.press('Control+z');
  expect((await lines(page)).length).toBe(2);
  expect(await page.evaluate(() => drawing.groups.length)).toBe(1);
  // THE CIRCLE PICKS ON ITS RIM, and comes whole: it is a FIXED assembly.
  await page.keyboard.press('s');
  await click(page, at, 0, 4);
  expect(await page.evaluate(() => selection.map(s => s.item.id).sort())).toEqual(['line-50', 'line-51']);
  // Inside the circle, nothing: the rim is the line, not the disc.
  await page.keyboard.press('Escape');
  await click(page, at, 1, 1);
  expect(await page.evaluate(() => selection.length)).toBe(0);
});

test('the right click on LINE opens the menu; CLOSE draws back to the start; on a WALL run the right click still finishes', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('l');
  await click(page, at, -10, -10);
  await click(page, at, 0, -10);
  await click(page, at, 0, 0);
  await page.mouse.click(...at(5, 5), { button: 'right' });
  await page.waitForTimeout(100);
  const menu = page.locator('[data-line-menu]');
  await expect(menu).toBeVisible();
  const items = await menu.locator('button').evaluateAll(els => els.map(el => [el.dataset.lineMenuItem, el.disabled]));
  expect(items).toEqual([['straight', false], ['arc', false], ['arc3', false], ['circle', false],
    ['close', false], ['finish', false], ['cancel', false]]);
  expect(await inHand(page), 'the right click did not end the run').toBe(true);
  // ARC from the menu, then CLOSE: the closing piece is an arc back to the
  // first point, tangent to the last line, and the run is down.
  await menu.locator('[data-line-menu-item="arc"]').click();
  await expect(menu).toBeHidden();
  expect(await mode(page)).toBe('arc');
  await page.mouse.click(...at(5, 5), { button: 'right' });
  await page.waitForTimeout(100);
  await menu.locator('[data-line-menu-item="close"]').click();
  const all = await lines(page);
  expect(all.length).toBe(3);
  expect(all[2].slice(0, 4)).toEqual([0, 0, -10, -10]);
  expect(all[2][4]).not.toBe(0);
  expect(await inHand(page)).toBe(false);
  // A press on the sheet with the menu open shuts it and draws nothing.
  await page.mouse.click(...at(5, 5), { button: 'right' });
  await page.waitForTimeout(100);
  await expect(menu).toBeVisible();
  await click(page, at, 8, 8);
  await expect(menu).toBeHidden();
  expect(await inHand(page)).toBe(false);
  // WALL: the right click is still ENTER.
  await page.keyboard.press('w');
  await click(page, at, 10, -10);
  await click(page, at, 10, -2);
  expect(await inHand(page)).toBe(true);
  await page.mouse.click(...at(12, 5), { button: 'right' });
  await page.waitForTimeout(100);
  await expect(menu).toBeHidden();
  expect(await inHand(page)).toBe(false);
  expect(await page.evaluate(() => drawing.walls.length)).toBe(1);
});

test('a bent line goes out to DXF as an ARC, and an old quadratic bend keeps its middle', () => {
  const H = require('../proto/harness-env.js');
  const win = H.loadDraftModules();
  const G = win.DraftGeometry2D, R = win.DraftRender2D, W = win.DraftDxfWriter, D = win.DraftDxfReader;
  // FILLET wrote bulge = 2 × sagitta; the arc's middle is where the
  // quadratic's was, a sagitta off the chord.
  const seg = { start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, bulge: 2 };
  const mid = G.pointOnLineSeg(seg, 0.5);
  expect([mid.x, mid.z].map(v => Math.round(v * 1000) / 1000)).toEqual([5, 1]);
  expect(Math.round(G.lineArc(seg).r * 1000) / 1000).toBe(13);
  // Through the painter onto the DXF recorder: one ARC, radius 13 units.
  const ctx = W.recorder({ layer: 'A-PLAN' });
  R.strokeSegPath2D(ctx, p => ({ x: p.x, y: p.z }), seg, { controlPoint: G.lineControlPoint });
  const text = W.write({ entities: W.mapEntities(ctx.entities, ([x, y]) => [x, -y]) });
  expect(text).toMatch(/\r\nARC\r\n8\r\nA-PLAN\r\n/);
  const arcs = D.parse(text).paths;
  expect(arcs.length).toBe(1);
  expect(/\r\n40\r\n13(\.0*)?\r\n/.test(text)).toBe(true);
});
