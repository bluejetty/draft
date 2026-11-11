// ARCS AND CIRCLES ON THE AREA / SHAPE COMMAND, AND LINES INTO A SHAPE AND
// BACK (jb, 11 Nov 2026: "the AREA command doesn't have CIRCLE, maybe these
// commands should be added to it" -- "select the shape (like this circle)
// and in the properties ... change the items to AREA / SHAPE with the
// middle filled in" -- "option to turn a closed shape into lines").
// model/19-line-arcs.js (loopArcPress, linesToShape, shapeToLines); the loop
// maths in geometry-2d.js (loopSegment, loopAreaSqFt, circleLoop).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const FIXTURE = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
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
const r3 = v => Math.round(v * 1000) / 1000 + 0;
const strip = page => page.evaluate(() => stripNotice);
const shapes = page => page.evaluate(() => drawing.shapes.map(s => s.points.map(p =>
  [p.x, p.z, p.bulge || 0].map(v => Math.round(v * 1000) / 1000 + 0))));
const areaOf = (page, i) => page.evaluate(i => Math.round(window.DraftGeometry2D.loopAreaSqFt(drawing.shapes[i].points) * 100) / 100, i);
const picked = page => page.evaluate(() => selection.map(s => `${s.type}:${s.item.id}`).sort());
const lines = page => page.evaluate(() => drawing.lines.slice(2).map(l =>
  [l.start.x, l.start.z, l.end.x, l.end.z, l.bulge || 0].map(v => Math.round(v * 1000) / 1000 + 0)));

test('SHAPE takes ARC and STRAIGHT from the foot row; the closed shape keeps the bend, counts its bow and picks inside it', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('a');
  await expect(page.locator('[data-tool-key="shape"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-line-bar]'), 'the LINE row stands for SHAPE too').toBeVisible();
  await click(page, at, -10, 0);
  await click(page, at, 0, 0);
  // ARC: the next corner ends an arc tangent to the edge before it -- a
  // quarter circle to (10, 10) about (0, 10).
  await page.locator('[data-line-mode="arc"]').click();
  expect(await strip(page)).toContain('press where the arc ends');
  await click(page, at, 10, 10);
  await page.locator('[data-line-mode="straight"]').click();
  await click(page, at, 10, 14);
  await click(page, at, -10, 14);
  // Close on the first corner.
  await click(page, at, -10, 0);
  const made = await shapes(page);
  expect(made.length).toBe(1);
  expect(made[0].map(p => p.slice(0, 2))).toEqual([[-10, 0], [0, 0], [10, 10], [10, 14], [-10, 14]]);
  expect(made[0][1][2], 'the corner at (0,0) bends the edge leaving it').not.toBe(0);
  expect(made[0].filter(p => p[2] !== 0).length).toBe(1);
  // The area: the polygon 230 sq ft, plus the bow the arc adds outside the
  // chord (a quarter circle of 10 less its triangle: 78.54 - 50 = 28.54).
  expect(await areaOf(page, 0)).toBe(258.54);
  await expect(page.locator('[data-prop-span]')).toContainText('259');
  // Picks inside the bow, past the chord.
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await click(page, at, 6, 3);
  expect(await picked(page)).toEqual(['shape:shape-50']);
  await expect(page.locator('[data-make-lines]')).toBeVisible();
});

test('CIRCLE on SHAPE: the centre then the radius makes a four-arc shape of pi r squared; MAKE LINES and MAKE SHAPE go round trip with UNDO', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('a');
  await page.locator('[data-line-mode="circle"]').click();
  expect(await strip(page)).toContain('press the centre');
  await click(page, at, 0, 0);
  expect(await strip(page)).toContain('radius');
  await click(page, at, 4, 0);
  const made = await shapes(page);
  expect(made.length).toBe(1);
  expect(made[0].length).toBe(4);
  expect(made[0].map(p => p.slice(0, 2))).toEqual([[4, 0], [0, -4], [-4, 0], [0, 4]]);
  expect(await areaOf(page, 0)).toBe(50.27);
  // Picked on commit, panel up with the area.
  expect(await picked(page)).toEqual(['shape:shape-50']);
  await expect(page.locator('[data-prop-span]')).toContainText('50');
  // MAKE LINES: four arcs, one assembly, the shape gone.
  await page.locator('[data-make-lines]').click();
  await page.waitForTimeout(120);
  expect((await shapes(page)).length).toBe(0);
  const four = await lines(page);
  expect(four.length).toBe(4);
  expect(four.every(l => l[4] !== 0)).toBe(true);
  expect(await page.evaluate(() => drawing.groups.map(g => [g.name, g.members.length]))).toEqual([['SHAPE 1', 4]]);
  expect((await picked(page)).length).toBe(4);
  // MAKE SHAPE takes them back to one shape of the same ring.
  await expect(page.locator('[data-make-shape]')).toBeEnabled();
  await page.locator('[data-make-shape]').click();
  await page.waitForTimeout(120);
  expect((await lines(page)).length).toBe(0);
  expect(await page.evaluate(() => drawing.groups.length)).toBe(0);
  expect((await shapes(page)).length).toBe(1);
  expect(await areaOf(page, 0)).toBe(50.27);
  // One UNDO: the lines and their assembly are back; another: the shape.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  expect((await lines(page)).length).toBe(4);
  expect(await page.evaluate(() => drawing.groups.length)).toBe(1);
  expect((await shapes(page)).length).toBe(0);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  expect((await lines(page)).length).toBe(0);
  expect((await shapes(page)).length).toBe(1);
});

test('a CIRCLE of lines picked on its rim offers MAKE SHAPE; two loose lines do not', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('l');
  await page.locator('[data-line-mode="circle"]').click();
  await click(page, at, 0, 0);
  await click(page, at, 4, 0);
  expect((await lines(page)).length).toBe(2);
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await click(page, at, 0, 4);
  expect((await picked(page)).length).toBe(2);
  const make = page.locator('[data-make-shape]');
  await expect(make).toBeEnabled();
  await make.click();
  await page.waitForTimeout(120);
  expect((await lines(page)).length).toBe(0);
  expect(await page.evaluate(() => drawing.groups.length), 'the CIRCLE assembly went with its lines').toBe(0);
  const made = await shapes(page);
  expect(made.length).toBe(1);
  expect(made[0].length, 'two half circles become four quarter arcs').toBe(4);
  expect(await areaOf(page, 0)).toBe(50.27);
  expect(await picked(page)).toEqual(['shape:shape-52']);
  // Inside the disc picks the shape now.
  await page.keyboard.press('Escape');
  await click(page, at, 1, 1);
  expect(await picked(page)).toEqual(['shape:shape-52']);
  // The two fixture lines, far apart, make no ring: the button is greyed.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+a');
  await page.waitForTimeout(100);
  await page.evaluate(() => setSelection(drawing.lines.slice(0, 2).map(item => ({ type: 'line', item }))));
  await page.waitForTimeout(100);
  await expect(page.locator('[data-make-shape]')).toBeDisabled();
});

test('the right click on SHAPE opens the menu; CLOSE with ARC bends the closing edge; 3-POINT ARC asks the through point', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('a');
  await click(page, at, -10, -10);
  await click(page, at, 10, -10);
  await click(page, at, 10, 10);
  await page.mouse.click(...at(0, 0), { button: 'right' });
  await page.waitForTimeout(100);
  const menu = page.locator('[data-line-menu]');
  await expect(menu).toBeVisible();
  const items = await menu.locator('button').evaluateAll(els => els.map(el => [el.dataset.lineMenuItem, el.disabled]));
  expect(items).toEqual([['straight', false], ['arc', false], ['arc3', false], ['circle', false],
    ['close', false], ['finish', false], ['cancel', false]]);
  expect(await page.evaluate(() => shapeCorners.length), 'the right click dropped no corner').toBe(3);
  await menu.locator('[data-line-menu-item="arc"]').click();
  await page.waitForTimeout(80);
  // CLOSE: the closing edge from (10, 10) back to (-10, -10) leaves the
  // edge before it tangent, so it bends.
  await page.locator('[data-line-close]').click();
  await page.waitForTimeout(150);
  const made = await shapes(page);
  expect(made.length).toBe(1);
  expect(made[0].map(p => p.slice(0, 2))).toEqual([[-10, -10], [10, -10], [10, 10]]);
  expect(made[0][2][2], 'the last corner bends the closing edge').not.toBe(0);
  expect(await page.evaluate(() => activeTool), 'the tool stays up').toBe('shape');
  // 3-POINT ARC on a fresh shape: end, then through.
  await page.locator('[data-line-mode="arc3"]').click();
  await click(page, at, -18, 6);
  await click(page, at, -10, 6);
  expect(await strip(page)).toContain('passes through');
  expect(await page.evaluate(() => shapeCorners.length)).toBe(1);
  // Through (-14, 10): a half circle of radius 4.
  await click(page, at, -14, 10);
  expect(await page.evaluate(() => shapeCorners.map(c => [c.x, c.z, c.bulge || 0].map(v => Math.round(v * 100) / 100 + 0)))).toEqual([[-18, 6, 8], [-10, 6, 0]]);
});
