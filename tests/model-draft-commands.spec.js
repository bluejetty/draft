// THE CLASSIC EDITS (jb, 9 Nov): "these are vital: OFFSET, MIRROR, ROTATE,
// FILLET, ARRAY. Offset is the most-used command in 2D drafting and it is
// not on the palette." Five keys in DRAW / EDIT, model/18-draft-commands.js.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const LINE = (id, a, b) => ({ id, start: V(...a), end: V(...b), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 });
const FIXTURE = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  // A horizontal line, a vertical one short of it (for FILLET), a wall and
  // a square shape off to one side, all inside the fitted view.
  lines: [LINE('la', [-10, 0], [-2, 0]), LINE('lb', [2, -8], [2, -2])],
  walls: [{ id: 'wa', start: V(-10, 10), end: V(0, 10), levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' }],
  shapes: [{ id: 'sa', levelId: 3, points: [V(4, 4), V(8, 4), V(8, 8), V(4, 8)], layer: 'SHAPE' }],
  outlines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
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
  await expect(page.locator('[data-tool-key="offset"]')).toBeVisible();
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(120); };
// S with SELECT already up goes BACK to the last tool, so it is pressed
// only when a tool is up.
const pick = async (page, at, x, z) => {
  if (await page.evaluate(() => activeTool) !== 'select') await page.keyboard.press('s');
  await click(page, at, x, z);
};
const r = v => Math.round(v * 1000) / 1000 + 0;
const seg = (page, id) => page.evaluate(id => {
  const l = [...drawing.lines, ...drawing.walls].find(i => i.id === id);
  return l ? [l.start.x, l.start.z, l.end.x, l.end.z].map(v => Math.round(v * 1000) / 1000 + 0) : null;
}, id);
const lineCount = page => page.evaluate(() => drawing.lines.length);
const strip = page => page.evaluate(() => stripNotice);
const tool = page => page.evaluate(() => activeTool);

test('the five keys stand in DRAW / EDIT with their letters, and each has its own row in the foot', async ({ page }) => {
  const { at } = await open(page);
  const faces = await page.locator('[data-tool-group="draw"] [data-tool-key]').evaluateAll(els =>
    els.map(el => [el.dataset.toolKey, el.querySelector('[data-tool-letter]').textContent.trim()]));
  expect(faces).toEqual(expect.arrayContaining([['offset', 'I'], ['mirror', 'J'], ['rotate', 'Z'], ['fillet', 'V'], ['array', '']]));
  // OFFSET's row comes up with its tool and goes with it.
  await page.keyboard.press('i');
  expect(await tool(page)).toBe('offset');
  await expect(page.locator('[data-offset-bar]')).toBeVisible();
  await expect(page.locator('#delete')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await expect(page.locator('[data-offset-bar]')).toBeHidden();
  // The three that act on a pick refuse to arm with nothing picked.
  await page.keyboard.press('j');
  expect(await tool(page)).toBe('select');
  expect(await strip(page)).toContain('MIRROR: pick what to mirror first');
  await pick(page, at, -6, 0);
  await page.keyboard.press('j');
  expect(await tool(page)).toBe('mirror');
  await expect(page.locator('[data-mirror-bar]')).toBeVisible();
});

test('OFFSET copies a line, a wall and a shape the typed distance over, on the side pressed, and stays up', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('i');
  await page.locator('#offset-dist').fill('2');
  // The line, then the side below it (z runs down the sheet).
  await click(page, at, -6, 0);
  expect(await strip(page)).toContain('now press the side');
  await click(page, at, -6, 3);
  expect(await lineCount(page)).toBe(3);
  const made = await page.evaluate(() => drawing.lines[2]);
  expect([made.start.x, made.start.z, made.end.x, made.end.z].map(r)).toEqual([-10, 2, -2, 2]);
  expect(made.id).not.toBe('la');
  expect(await tool(page), 'the tool stays up for the next one').toBe('offset');
  // The same line, the other side, one foot.
  await page.locator('#offset-dist').fill("1'");
  await click(page, at, -6, 0);
  await click(page, at, -6, -3);
  expect(await seg(page, 'line-51')).toEqual([-10, -1, -2, -1]);
  // The wall, up a foot: a wall of the same kind.
  await click(page, at, -5, 10);
  await click(page, at, -5, 8);
  const walls = await page.evaluate(() => drawing.walls.map(w => [w.id, w.wallType, w.start.x, w.start.z, w.end.x, w.end.z]));
  expect(walls.length).toBe(2);
  expect(walls[1].slice(1)).toEqual(['stud_2x4', -10, 9, 0, 9]);
  // The shape, pressed on its top edge and then inside: a square a foot in.
  await click(page, at, 6, 4);
  await click(page, at, 6, 6);
  const shapes = await page.evaluate(() => drawing.shapes.map(s => s.points.map(p => [p.x, p.z])));
  expect(shapes.length).toBe(2);
  expect(shapes[1].map(p => p.map(r))).toEqual([[5, 5], [7, 5], [7, 7], [5, 7]]);
  // And outside: a foot out.
  await click(page, at, 6, 4);
  await click(page, at, 6, 2);
  const out = await page.evaluate(() => drawing.shapes[2].points.map(p => [p.x, p.z]));
  expect(out.map(p => p.map(r))).toEqual([[3, 3], [9, 3], [9, 9], [3, 9]]);
  // One UNDO per offset.
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => drawing.shapes.length)).toBe(2);
});

test('FILLET joins two lines at a square corner, keeping the parts pressed; a radius rounds it with an arc', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('v');
  await click(page, at, -6, 0);
  expect(await strip(page)).toContain('now press the second');
  await click(page, at, 2, -5);
  expect(await seg(page, 'la')).toEqual([-10, 0, 2, 0]);
  expect(await seg(page, 'lb')).toEqual([2, -8, 2, 0]);
  expect(await lineCount(page)).toBe(2);
  expect(await strip(page)).toContain('square corner');
  // UNDO puts both ends back.
  await page.keyboard.press('Control+z');
  expect(await seg(page, 'la')).toEqual([-10, 0, -2, 0]);
  expect(await seg(page, 'lb')).toEqual([2, -8, 2, -2]);
  // A 2 ft radius: each line stops 2 ft short of the corner and an arc of
  // that radius joins them, bulging toward the corner.
  await page.locator('#fillet-radius').fill('2');
  await click(page, at, -6, 0);
  await click(page, at, 2, -5);
  expect(await seg(page, 'la')).toEqual([-10, 0, 0, 0]);
  expect(await seg(page, 'lb')).toEqual([2, -8, 2, -2]);
  expect(await lineCount(page)).toBe(3);
  const arc = await page.evaluate(() => { const a = drawing.lines[2]; return [a.start.x, a.start.z, a.end.x, a.end.z, a.bulge]; });
  expect(arc.slice(0, 4).map(r)).toEqual([0, 0, 2, -2]);
  // The painter's control point stands twice the sagitta (2 - sqrt 2) off
  // the chord, on the corner's side.
  expect(r(arc[4])).toBe(r(2 * (2 - Math.SQRT2)));
  expect(await strip(page)).toContain('Rounded with a');
  await page.keyboard.press('Control+z');
  expect(await lineCount(page)).toBe(2);
  expect(await seg(page, 'la')).toEqual([-10, 0, -2, 0]);
});

test('MIRROR copies what is picked across a line of two presses, or mirrors it in place with KEEP ORIGINAL off', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at, -6, 0);
  await page.keyboard.press('j');
  // A vertical mirror line on x = 0.
  await click(page, at, 0, -6);
  await click(page, at, 0, 6);
  expect(await lineCount(page)).toBe(3);
  expect(await seg(page, 'la'), 'the original stays').toEqual([-10, 0, -2, 0]);
  const copy = await page.evaluate(() => { const l = drawing.lines[2]; return [l.start.x, l.start.z, l.end.x, l.end.z].map(v => Math.round(v * 1000) / 1000 + 0); });
  expect(copy).toEqual([10, 0, 2, 0]);
  expect(await tool(page), 'back to SELECT when it is done').toBe('select');
  expect(await strip(page)).toContain('MIRRORED');
  // In place: the original itself moves and nothing is added.
  await pick(page, at, -6, 0);
  await page.keyboard.press('j');
  await page.locator('[data-mirror-keep]').click();
  await click(page, at, -4, -6);
  await click(page, at, -4, 6);
  expect(await lineCount(page)).toBe(3);
  expect(await seg(page, 'la')).toEqual([2, 0, -6, 0]);
  await page.keyboard.press('Control+z');
  expect(await seg(page, 'la')).toEqual([-10, 0, -2, 0]);
  await page.keyboard.press('Control+z');
  expect(await lineCount(page), 'one UNDO takes the copy back').toBe(2);
});

test('ROTATE turns what is picked about a pressed centre, by a typed angle or by the arm as it is and where it goes', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at, -6, 0);
  await page.keyboard.press('z');
  expect(await tool(page)).toBe('rotate');
  await click(page, at, -2, 0);
  expect(await strip(page)).toContain('press a point on the arm');
  await page.locator('#turn-angle').fill('90');
  await page.keyboard.press('Enter');
  // A quarter turn clockwise about the line's own end: it now runs up.
  expect(await seg(page, 'la')).toEqual([-2, -8, -2, 0]);
  expect(await tool(page)).toBe('select');
  await page.keyboard.press('Control+z');
  expect(await seg(page, 'la')).toEqual([-10, 0, -2, 0]);
  // THREE PRESSES (jb, 11 Nov, ArchiCAD's way): the centre, the arm as it
  // is (the line's far end, due west), then where it goes (due north).
  // West to north is a quarter turn clockwise on the screen.
  await pick(page, at, -6, 0);
  await page.keyboard.press('z');
  await click(page, at, -2, 0);
  await click(page, at, -10, 0);
  expect(await strip(page)).toContain('press where the arm goes');
  // The DEG box shows the turn the hand is showing before the press.
  await page.mouse.move(...at(-2, -6));
  await page.waitForTimeout(120);
  expect(await page.locator('#turn-angle').getAttribute('placeholder')).toBe('90°');
  await click(page, at, -2, -6);
  expect(await seg(page, 'la')).toEqual([-2, -8, -2, 0]);
  expect(await strip(page)).toContain('Turned');
});

test('ROTATE reads the centre pressed again as the arm\'s start, the AutoCAD reference habit', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at, -6, 0);
  await page.keyboard.press('z');
  await click(page, at, -2, 0);
  await click(page, at, -2, 0);
  expect(await strip(page)).toContain('arm starts at the centre');
  await click(page, at, -10, 0);
  expect(await strip(page)).toContain('press where the arm goes');
  await click(page, at, -2, 6);
  // West to south is a quarter turn anticlockwise: the line now runs down.
  expect(await seg(page, 'la')).toEqual([-2, 8, -2, 0]);
});

test('ROTATE\'s picks glow on a node and square off the centre with the T-SQUARE', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at, -6, 0);
  await page.keyboard.press('z');
  // The hand over the wall's end lights the node ring before any press.
  await page.mouse.move(...at(0.05, 10.05));
  await page.waitForTimeout(120);
  expect(JSON.parse(await page.locator('#plan').getAttribute('data-snap-node'))).toEqual([0, 10]);
  await click(page, at, 0.05, 10.05);
  const base = await page.evaluate(() => [draftCmd.turn.base.x, draftCmd.turn.base.z]);
  expect(base).toEqual([0, 10]);
  // The arm pressed a little off due west squares to it under the T-SQUARE.
  await page.evaluate(() => lightInstrument('tsquare'));
  await click(page, at, -6, 10.4);
  expect(await page.evaluate(() => Math.round(draftCmd.turn.ref))).toBe(180);
});

test('ROTATE\'s arm circle makes nodes where it crosses lines and shapes, and the third press lands on one', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at, -6, 0);
  await page.keyboard.press('z');
  await click(page, at, -2, 0);
  await click(page, at, -10, 0);
  expect(await strip(page)).toContain('crossings are nodes');
  // Radius 8 about (-2, 0): it crosses lb (x = 2) at z = -sqrt(48) and the
  // square shape's west edge (x = 4) at z = sqrt(28) and its top edge at
  // x = -2 + sqrt(48).
  const nodes = await page.evaluate(() => turnCircleNodes().map(n => [Math.round(n.x * 1000) / 1000, Math.round(n.z * 1000) / 1000]));
  expect(nodes).toEqual(expect.arrayContaining([[2, -6.928], [4, 5.292], [4.928, 4]]));
  // The hand near the crossing on lb lights it as a node.
  await page.mouse.move(...at(2.05, -6.85));
  await page.waitForTimeout(120);
  expect(JSON.parse(await page.locator('#plan').getAttribute('data-snap-node'))).toEqual([2, -6.9282]);
  await click(page, at, 2.05, -6.85);
  // The line's far end lands on the crossing exactly, at its own length.
  expect(await seg(page, 'la')).toEqual([2, -6.928, -2, 0]);
  expect(await page.evaluate(() => turnCircleNodes().length)).toBe(0);
});

test('ARRAY makes a row or a grid of copies at the typed spacing, and one UNDO takes them all back', async ({ page }) => {
  const { at } = await open(page);
  await pick(page, at, -6, 0);
  await page.locator('[data-tool-key="array"]').click();
  expect(await tool(page)).toBe('array');
  await expect(page.locator('[data-array-bar]')).toBeVisible();
  await page.locator('#array-cols').fill('1');
  await page.locator('#array-rows').fill('3');
  await page.locator('#array-dz').fill('4');
  await page.locator('[data-array-make]').click();
  expect(await lineCount(page)).toBe(4);
  const rows = await page.evaluate(() => drawing.lines.slice(2).map(l => [l.start.x, l.start.z, l.end.x, l.end.z]));
  expect(rows).toEqual([[-10, 4, -2, 4], [-10, 8, -2, 8]]);
  expect(await strip(page)).toContain('ARRAY made 2 copies');
  expect(await tool(page)).toBe('select');
  await page.keyboard.press('Control+z');
  expect(await lineCount(page)).toBe(2);
  // A 2 x 2 grid, the second column a foot to the left.
  await pick(page, at, -6, 0);
  await page.locator('[data-tool-key="array"]').click();
  await page.locator('#array-cols').fill('2');
  await page.locator('#array-dx').fill('-1');
  await page.locator('#array-rows').fill('2');
  await page.locator('#array-dz').fill('3');
  await page.keyboard.press('Enter');
  expect(await lineCount(page)).toBe(5);
  const grid = await page.evaluate(() => drawing.lines.slice(2).map(l => [l.start.x, l.start.z]));
  expect(grid).toEqual([[-11, 0], [-10, 3], [-11, 3]]);
});
