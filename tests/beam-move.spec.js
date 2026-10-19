// BEAMS AND COLUMNS THE DRAFTER CAN MOVE (Movie, 19 Oct).
//
// "so the AUTOPLACED beams and columns. I'd like to be able to move the BEAM
// manually so that all the columns follow. i will also want to probably
// DELETE one line of beams and will only have 2 lines located where on each
// side wall of a central hallway. so i will need to move beams up or down" --
// "would be 31 feet max space for OWJ" -- "but make that TEXT editable so and
// ENGINEER can change it to whatever they specify the floor or beams as
// (STEEL, LAMINATED BEAMS etc)".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// An L on MAIN FL: 40 wide, 32 deep on the left, the right half stopping at
// z = 4. A row of beam in two pieces post to post -- the way AUTO BEAM lays
// one -- runs across the deep half at z = 8, x -20 to 0, on a post at the
// joint and another mid-piece; a third post stands off it.
const L = [[-20, -16], [20, -16], [20, 4], [0, 4], [0, 16], [-20, 16]];
const P = (x, z) => ({ x, y: 0, z });
const drawing = (extra = {}) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [], lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [],
  outlines: [{ id: 'outline-l', levelId: 3, garage: false, points: L.map(([x, z]) => P(x, z)) }],
  shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [],
  beams: [
    { id: 1, start: P(-20, 8), end: P(-8, 8), levelId: 1, view: 'foundation', mode: 'flush', auto: true },
    { id: 2, start: P(-8, 8), end: P(0, 8), levelId: 1, view: 'foundation', mode: 'flush', auto: true },
  ],
  columns: [
    { id: 1, point: P(-8, 8), levelId: 1, view: 'foundation', footing: 'pad36', auto: true },
    { id: 2, point: P(-14, 8), levelId: 1, view: 'foundation', footing: 'pad36', auto: true },
    { id: 3, point: P(-10, 12), levelId: 1, view: 'foundation', footing: 'pad36' },
  ],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  ...extra,
});
async function open(page, f = drawing(), url = '/MODEL.html') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function toFoundation(page) {
  await h.pickModelLayer(page, 1, 'foundation');
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function drag(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const r2 = n => Math.round(n * 100) / 100 + 0;
const seg = b => [b.start.x, b.start.z, b.end.x, b.end.z].map(r2);
const pt = c => [c.point.x, c.point.z].map(r2);

test('a click on one piece picks the row; MOVE slides it across itself only, its posts ride, its far end finds the wall', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await click(page, at, -4, 8);
  await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
  // Up 8 and 2 to the side: only the 8 is taken.
  await drag(page, at, [-4, 8], [-2, 0]);
  let d = await saved(page);
  // Up here the L runs the full 40, so the row's end reaches x = 20.
  expect(d.beams.map(seg)).toEqual([[-20, 0, -8, 0], [-8, 0, 20, 0]]);
  expect(d.columns.map(pt)).toEqual([[-8, 0], [-14, 0], [-10, 12]]);
  // ONE UNDO puts the row and its posts back together.
  await page.keyboard.press('Escape');
  await page.locator('#model-undo').click();
  d = await saved(page);
  expect(d.beams.map(seg)).toEqual([[-20, 8, -8, 8], [-8, 8, 0, 8]]);
  expect(d.columns.map(pt)).toEqual([[-8, 8], [-14, 8], [-10, 12]]);
});

// A TYPED DISTANCE FINISHES A BEAM ROW'S MOVE TOO, re-clipped and its floor
// asked again for the exact place (Movie, 19 Oct: "can you do this one in
// that PR too").
test('after a MOVE drag, a typed distance puts the row exactly that far across', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await click(page, at, -4, 8);
  await page.locator('#model-move').click();
  await drag(page, at, [-4, 8], [-4, 6]);
  await expect(page.locator('#frozen-length')).toBeEnabled();
  await page.keyboard.type('8');
  await page.keyboard.press('Enter');
  let d = await saved(page);
  expect(d.beams.map(seg), 'eight up, and the far end finds the wall again').toEqual([[-20, 0, -8, 0], [-8, 0, 20, 0]]);
  expect(d.columns.map(pt)).toEqual([[-8, 0], [-14, 0], [-10, 12]]);
  await page.keyboard.press('Escape');
  await page.locator('#model-undo').click();
  d = await saved(page);
  expect(d.beams.map(seg), 'one UNDO').toEqual([[-20, 8, -8, 8], [-8, 8, 0, 8]]);
});

test('DELETE on a beam takes its whole row and its posts; a post off the row stays; one UNDO brings it back', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await click(page, at, -16, 8);
  await page.locator('#delete').click();
  let d = await saved(page);
  expect(d.beams).toHaveLength(0);
  expect(d.columns.map(c => c.id)).toEqual([3]);
  await page.locator('#model-undo').click();
  d = await saved(page);
  expect(d.beams).toHaveLength(2);
  expect(d.columns.map(c => c.id).sort()).toEqual([1, 2, 3]);
});

test('the engineer\'s MARK names the beam, survives the reload and a re-press of AUTO BEAM', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await h.showLeftPane(page, 'drafting');
  await click(page, at, -4, 8);
  const mark = page.locator('[data-prop-text="mark"]');
  await mark.fill('STEEL W8x18');
  await mark.press('Enter');
  let d = await saved(page);
  expect(d.beams.map(b => b.mark)).toEqual(['STEEL W8x18', 'STEEL W8x18']);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  d = await saved(page);
  expect(d.beams.map(b => b.mark)).toEqual(['STEEL W8x18', 'STEEL W8x18']);
  // AND IT IS WHAT THE BEAM IS LABELLED, on the plan and on the sheets --
  // both paint through render-2d's drawBeam2D.
  const said = await page.evaluate(() => {
    const texts = [];
    const ctx = new Proxy({}, { get: (t, k) => (k === 'fillText' ? text => texts.push(text)
      : k === 'measureText' ? () => ({ width: 10 }) : (k in t ? t[k] : () => {})), set: (t, k, v) => { t[k] = v; return true; } });
    const beam = { start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, mode: 'flush', mark: 'STEEL W8x18' };
    const env = { beamColor: '#000', labelFont: '10px sans-serif', isPrinting: false };
    window.DraftRender2D.drawBeam2D(ctx, p => ({ x: p.x * 10, y: p.z * 10 }), beam, { above: true }, env);
    window.DraftRender2D.drawBeam2D(ctx, p => ({ x: p.x * 10, y: p.z * 10 }), { ...beam, mark: undefined }, {}, env);
    return texts;
  });
  expect(said).toEqual(['STEEL W8x18 ABOVE', 'FLUSH BEAM']);
});

test('a floor\'s JOIST CALLOUT is typed in the BEAM panel and replaces the worked-out one', async ({ page }) => {
  await open(page);
  await toFoundation(page);
  await h.showLeftPane(page, h.TOOL_PANE.beam || 'build');
  const key = page.locator('[data-tool-key="beam"]');
  if (await key.getAttribute('aria-pressed') !== 'true') await key.click();
  const field = page.locator('[data-joist-callout] input');
  await expect(field).toBeVisible();
  await field.fill('LAMINATED BEAM 3-1/2 x 11-7/8');
  await field.press('Enter');
  const d = await saved(page);
  expect(d.levelAssemblies['3'].joistCallout).toBe('LAMINATED BEAM 3-1/2 x 11-7/8');
  const label = await page.evaluate(() => window.DraftBuildHouse.joistCallout(
    window.DraftLevelAssembly.levelAssemblyFor({ 3: { joistCallout: 'LAMINATED BEAM 3-1/2 x 11-7/8' } }, 3)));
  expect(label).toBe('LAMINATED BEAM 3-1/2 x 11-7/8');
});

test('AUTO BEAM on an OWJ floor spaces its rows by the joist: a 40 ft deep house takes one row, not two', async ({ page }) => {
  const rect = [[-30, -20], [30, -20], [30, 20], [-30, 20]];
  const base = drawing({ beams: [], columns: [],
    outlines: [{ id: 'outline-r', levelId: 3, garage: false, points: rect.map(([x, z]) => P(x, z)) }] });
  const rows = async f => {
    await open(page, f);
    await toFoundation(page);
    await h.showLeftPane(page, h.TOOL_PANE.beam || 'build');
    const key = page.locator('[data-tool-key="beam"]');
    if (await key.getAttribute('aria-pressed') !== 'true') await key.click();
    await page.locator('[data-auto-beam]').click();
    const d = await saved(page);
    return new Set(d.beams.filter(b => b.auto).map(b => r2(b.start.z))).size;
  };
  expect(await rows(base), 'the 1\'-0 5/8" floor keeps its 19 ft rule').toBe(2);
  expect(await rows({ ...base, levelAssemblies: { 3: { joistType: 'owj', joistDepthIn: 23.25 } } }),
    'an OWJ floor spans 28 ft').toBe(1);
});

test('pressing AUTO BEAM again keeps the MARK on the beam it lays back down in the same place', async ({ page }) => {
  const rect = [[-30, -20], [30, -20], [30, 20], [-30, 20]];
  await open(page, drawing({ beams: [], columns: [],
    outlines: [{ id: 'outline-r', levelId: 3, garage: false, points: rect.map(([x, z]) => P(x, z)) }] }));
  const { at } = await toFoundation(page);
  await h.showLeftPane(page, h.TOOL_PANE.beam || 'build');
  const key = page.locator('[data-tool-key="beam"]');
  if (await key.getAttribute('aria-pressed') !== 'true') await key.click();
  await page.locator('[data-auto-beam]').click();
  let d = await saved(page);
  const row = d.beams.find(b => b.auto);
  const z = row.start.z;
  await key.click();                                    // BEAM off: back to SELECT
  await expect(key).toHaveAttribute('aria-pressed', 'false');
  await click(page, at, 10, z);
  const mark = page.locator('[data-prop-text="mark"]');
  await mark.fill('LVL 3-1.75x11-7/8');
  await mark.press('Enter');
  d = await saved(page);
  const marked = d.beams.filter(b => b.mark === 'LVL 3-1.75x11-7/8');
  expect(marked.length, 'the click took the whole row').toBeGreaterThan(1);
  expect(marked.every(b => Math.abs(b.start.z - z) < 0.01)).toBe(true);
  await page.keyboard.press('Escape');
  await h.showLeftPane(page, h.TOOL_PANE.beam || 'build');
  if (await key.getAttribute('aria-pressed') !== 'true') await key.click();
  await page.locator('[data-auto-beam]').click();
  d = await saved(page);
  const again = d.beams.filter(b => b.auto && Math.abs(b.start.z - z) < 0.01);
  expect(again.length).toBeGreaterThan(0);
  expect(again.every(b => b.mark === 'LVL 3-1.75x11-7/8')).toBe(true);
  expect(d.beams.filter(b => Math.abs(b.start.z - z) >= 0.01).every(b => !b.mark)).toBe(true);
});
