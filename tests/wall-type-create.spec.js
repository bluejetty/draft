// CREATE WALL TYPE (jb, 16 Nov 2026).
//
// "can i have in addition to the 'emtpy wall - you pick thickness' can i
// have another button - create wall-type. which will allow the user to
// identify the 'slice compoments' of the wall with their thicknesses
// showing. allow the user to 'hatch or shade' each slice" -- "this is needed
// for the foundation walls too exactly the same" -- and "there will be a
// foundation wall i'd like that shows the 8" conc on the foundation plan,
// but shows the other component (air space and 2x4 wall with batt insul,
// VB and gyp finish) but those parts to not show on foundation, the full
// wall to show on Basement Plan".
//
// model/20-wall-type-card.js (the card), wall-types.js (the registry every
// painter reads), render-2d.js drawWallSeg2D (slices, hatches, FDN / BSMT),
// plan-composition.js (the same on LAYOUT sheets).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SHOTS = process.env.WALL_TYPE_SHOTS || '';
const W = (id, a, b, extra) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8, ...extra });
const F = (id, a, b, extra) => W(id, a, b, { levelId: 1, view: 'foundation', wallType: 'concrete_8',
  refLine: 'left', baseHeight: -8, topHeight: 0, ...extra });
const drawing = extra => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 40,
  walls: [W('n', [0, 0], [12, 0]), W('e', [12, 0], [12, 10]), W('s', [12, 10], [0, 10]), W('w', [0, 10], [0, 0]),
    W('loose', [18, 0], [18, 10]),
    // A foundation loop drawn clockwise on screen with its line on the
    // OUTSIDE face, and one basement partition.
    F('fn', [0, 0], [20, 0]), F('fe', [20, 0], [20, 16]), F('fs', [20, 16], [0, 16]), F('fw', [0, 16], [0, 0]),
    W('bp', [10, 1], [10, 15], { levelId: 1, wallType: 'stud_2x4' })],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
  ...extra,
});
async function open(page, url = '/MODEL.html?left=1&right=1&level=3', extra = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing(extra) });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const wall = (d, id) => d.walls.find(w => w.id === id);
const slot = '#props-slot';
const card = '[data-wall-type-card]';
const shot = async (page, name, locator) => {
  if (!SHOTS) return;
  await (locator ? page.locator(locator) : page).screenshot({ path: `${SHOTS}/${name}.png` });
};
// The colour under a world point, read off the plan canvas.
const inkAt = async (page, x, z) => {
  const { at } = await h.planFrame(page);
  const [sx, sy] = at(x, z);
  return page.evaluate(([px, py]) => {
    const c = document.querySelector('#plan');
    const r = c.getBoundingClientRect();
    const k = c.width / r.width;
    const d = c.getContext('2d').getImageData(Math.round((px - r.left) * k), Math.round((py - r.top) * k), 1, 1).data;
    return [d[0], d[1], d[2]];
  }, [sx, sy]);
};

test('CREATE WALL TYPE beside CUSTOM WIDTH: the card lists slices with their thicknesses, the TOTAL follows, and the type goes on the wall in hand', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(18, 5));
  const create = page.locator(`${slot} [data-prop-row="type"] [data-prop-value="create-wall-type"]`);
  await expect(create, 'the chip stands beside CUSTOM WIDTH').toBeVisible();
  await create.click();
  await expect(page.locator(card)).toBeVisible();
  // The starter floor wall: siding, sheathing, 2x6 + batt, VB, gyp.
  await expect(page.locator(`${card} [data-slice-row]`)).toHaveCount(5);
  await expect(page.locator(`${card} [data-wall-type-total]`)).toHaveText('7 3/16"');
  // A slice's thickness typed: the total follows.
  await page.locator(`${card} [data-slice-in="2"]`).fill('3 1/2');
  await page.locator(`${card} [data-slice-in="2"]`).press('Enter');
  await expect(page.locator(`${card} [data-wall-type-total]`)).toHaveText('5 3/16"');
  // A hatch picked.
  await page.locator(`${card} [data-slice-fill="1"]`).selectOption('grey');
  await page.locator(`${card} [data-wall-type-name]`).fill('2x4 ext');
  await shot(page, '1-create-wall-type-card', `${card} .promote-card`);
  await page.locator(`${card} [data-wall-type-save]`).click();
  await expect(page.locator(card)).toHaveCount(0);

  const d = await saved(page);
  expect(d.wallTypes).toHaveLength(1);
  const made = d.wallTypes[0];
  expect(made).toMatchObject({ name: '2X4 EXT', kind: 'floor' });
  expect(made.layers.map(l => l.in)).toEqual([0.75, 0.4375, 3.5, 0, 0.5]);
  expect(made.layers[1].fill).toBe('grey');
  expect(wall(d, 'loose')).toMatchObject({ wallType: made.id, widthIn: 5.1875 });
  expect(wall(d, 'n').wallType, 'nothing else moved').toBe('stud_2x6');
  // A TYPE chip now, lit on this wall.
  await expect(page.locator(`${slot} [data-prop-row="type"] [data-prop-value="${made.id}"]`))
    .toHaveAttribute('aria-pressed', 'true');
  await shot(page, '2-made-type-chip-and-wall', null);

  // Reopened, the wall is still that wide.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const ft = await page.evaluate(() => window.DraftWallTypes.wallThicknessFt(drawing.walls.find(x => x.id === 'loose')));
  expect(ft * 12).toBeCloseTo(5.1875, 4);
});

test('EDIT TYPE changes every wall of it; FLIP SLICES turns them round; DELETE TYPE leaves the walls their width', async ({ page }) => {
  const type = { id: 'wt_test1', name: 'TEST', kind: 'floor',
    layers: [{ name: 'BRICK', in: 4, fill: 'brick' }, { name: 'STUD', in: 3.5, fill: 'insulation' }] };
  const { at } = await open(page, '/MODEL.html?left=1&right=1&level=3', { wallTypes: [type] });
  await page.evaluate(() => {
    drawing.walls.filter(w => ['n', 'e'].includes(w.id)).forEach(w => { w.wallType = 'wt_test1'; });
    paint();
  });
  await page.mouse.click(...at(6, 0));
  await page.keyboard.press('Escape');
  await page.mouse.click(...at(12, 5));
  await page.locator(`${slot} [data-wall-type-edit]`).click();
  await page.locator(`${card} [data-slice-in="0"]`).fill('3 5/8');
  await page.locator(`${card} [data-slice-in="0"]`).press('Enter');
  await page.locator(`${card} [data-wall-type-save]`).click();
  let d = await saved(page);
  expect(d.wallTypes[0].layers[0].in).toBe(3.625);
  const widths = await page.evaluate(() => ['n', 'e'].map(id => window.DraftWallTypes.wallTypeOf(drawing.walls.find(w => w.id === id)).totalIn));
  expect(widths, 'both walls of the type').toEqual([7.125, 7.125]);
  // FLIP SLICES on the picked wall, and UNDO.
  await page.locator(`${slot} [data-wall-slice-flip]`).click();
  d = await saved(page);
  expect(wall(d, 'e').sliceFlip).toBe(true);
  expect(wall(d, 'n').sliceFlip).toBeUndefined();
  // DELETE TYPE: the walls stay where they are, as a custom width.
  await page.locator(`${slot} [data-wall-type-edit]`).click();
  await page.locator(`${card} [data-wall-type-delete]`).click();
  await expect(page.locator(`${card} [data-wall-type-delete]`), 'the first press asks').toContainText('2 WALLS BECOME CUSTOM WIDTH');
  await page.locator(`${card} [data-wall-type-delete]`).click();
  d = await saved(page);
  expect(d.wallTypes).toEqual([]);
  expect(wall(d, 'n')).toMatchObject({ wallType: 'custom', widthIn: 7.125 });
});

// jb, 16 Nov 2026: "a way to EDIT the 'user created' wall types (maybe make
// their cards blue tinge, rather than just grey to make obvious to the user)".
test('a made type\'s chip is tinted blue and edits from its own pencil, on a picked wall of ANOTHER type and on the WALL tool, right-click too', async ({ page }) => {
  const type = { id: 'wt_test1', name: 'TEST', kind: 'floor',
    layers: [{ name: 'BRICK', in: 4, fill: 'brick' }, { name: 'STUD', in: 3.5, fill: 'insulation' }] };
  const { at } = await open(page, '/MODEL.html?left=1&right=1&level=3', { wallTypes: [type] });
  // A 2x6 wall picked: the made chip is there, blue, with its pencil.
  await page.mouse.click(...at(18, 5));
  const row = page.locator(`${slot} [data-prop-row="type"]`);
  const chip = row.locator('[data-prop-value="wt_test1"]');
  await expect(chip).toHaveAttribute('data-made-type', '');
  await expect(row.locator('[data-prop-value="stud_2x6"]')).not.toHaveAttribute('data-made-type', '');
  const tint = await chip.evaluate(el => getComputedStyle(el).backgroundColor);
  const grey = await row.locator('[data-prop-value="stud_2x4"]').evaluate(el => getComputedStyle(el).backgroundColor);
  expect(tint, 'not the table chips\' grey').not.toBe(grey);
  const [r, , b] = tint.match(/[\d.]+/g).map(Number);
  expect(b, 'a blue tinge').toBeGreaterThan(r);
  await shot(page, '6-made-type-blue-with-pencil', slot);
  // The pencil opens the type's card without putting it on the wall.
  await row.locator('[data-made-type-edit="wt_test1"]').click();
  await expect(page.locator(`${card} h3`)).toContainText('EDIT WALL TYPE — TEST');
  await page.locator(`${card} [data-wall-type-name]`).fill('TEST TWO');
  await page.locator(`${card} [data-wall-type-save]`).click();
  let d = await saved(page);
  expect(d.wallTypes[0].name).toBe('TEST TWO');
  expect(wall(d, 'loose').wallType, 'the picked wall kept its type').toBe('stud_2x6');
  await expect(chip).toContainText('TEST TWO');
  // A right-click on the chip opens it too.
  await chip.click({ button: 'right' });
  await expect(page.locator(`${card} h3`)).toContainText('TEST TWO');
  await page.locator(`${card} [data-wall-type-cancel]`).click();
  // The WALL tool's panel: same tint, same pencil, and the panel follows the edit.
  await page.keyboard.press('Escape');
  await h.armWall(page);
  const toolRow = page.locator('[data-prop-row="wall type"]');
  await expect(toolRow.locator('[data-prop-value="wt_test1"]')).toHaveAttribute('data-made-type', '');
  await toolRow.locator('[data-made-type-edit="wt_test1"]').click();
  await page.locator(`${card} [data-wall-type-name]`).fill('TEST 3');
  await page.locator(`${card} [data-wall-type-save]`).click();
  await expect(toolRow.locator('[data-prop-value="wt_test1"]')).toContainText('TEST 3');
  d = await saved(page);
  expect(d.activeWallType ?? null, 'editing is not picking').not.toBe('wt_test1');
});

test('a wall whose type the file lost keeps its width, drawn as a plain wall, and keeps the type for when it comes back', async ({ page }) => {
  const { at } = await open(page);
  await page.evaluate(() => {
    const w = drawing.walls.find(x => x.id === 'loose');
    w.wallType = 'wt_gone1'; w.widthIn = 9.25;
  });
  let d = await saved(page);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const got = await page.evaluate(() => {
    const w = drawing.walls.find(x => x.id === 'loose');
    return { type: w.wallType, inches: window.DraftWallTypes.wallThicknessFt(w) * 12 };
  });
  expect(got.type).toBe('wt_gone1');
  expect(got.inches).toBeCloseTo(9.25, 4);
  d = await saved(page);
  expect(wall(d, 'loose')).toMatchObject({ wallType: 'wt_gone1', widthIn: 9.25 });
});

test('a FOUNDATION type: the FOUNDATION plan draws only its FDN slices, the BASEMENT plan the whole wall', async ({ page }) => {
  const { at } = await open(page, '/MODEL.html?left=1&right=1&level=1&view=foundation');
  await page.mouse.click(...at(10, 0));
  await page.locator(`${slot} [data-prop-row="type"] [data-prop-value="create-wall-type"]`).click();
  await expect(page.locator(`${card} [data-wall-type-kind="foundation"]`)).toHaveAttribute('aria-pressed', 'true');
  // jb's own wall is the starter: 8" conc on both, the lining BSMT only.
  await expect(page.locator(`${card} [data-slice-row]`)).toHaveCount(5);
  await expect(page.locator(`${card} [data-slice-shows="fdn-0"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`${card} [data-slice-shows="fdn-2"]`)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator(`${card} [data-slice-shows="bsmt-2"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator(`${card} [data-wall-type-total]`)).toHaveText('12 1/2"');
  await page.locator(`${card} [data-wall-type-name]`).fill('8in conc + lining');
  await shot(page, '3-foundation-type-card', `${card} .promote-card`);
  await page.locator(`${card} [data-wall-type-save]`).click();
  // The rest of the loop takes it too.
  const id = await page.evaluate(() => {
    const made = drawing.wallTypes[0].id;
    drawing.walls.filter(w => w.view === 'foundation').forEach(w => { w.wallType = made; });
    paint();
    return made;
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  // The insulation slice is 8 1/2" to 12" in from the line (the outside
  // face): 0.85 ft in along the north wall's inside.
  const insulation = [205, 228, 248];
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 30);
  const fdnInk = await inkAt(page, 15, 0.85);
  expect(near(fdnInk, insulation), `FOUNDATION plan, no lining: ${fdnInk}`).toBe(false);
  const fdnConc = await inkAt(page, 15, 0.35);
  expect(near(fdnConc, [255, 255, 255]), `FOUNDATION plan, the concrete is drawn: ${fdnConc}`).toBe(false);
  await shot(page, '4-foundation-plan-concrete-only', null);
  await saved(page);

  await page.goto('/MODEL.html?left=1&right=1&level=1&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const bsmtInk = await inkAt(page, 15, 0.85);
  expect(near(bsmtInk, insulation), `BASEMENT plan, the lining shows: ${bsmtInk}`).toBe(true);
  await shot(page, '5-basement-plan-full-wall', null);
  const d = await saved(page);
  expect(d.wallTypes[0]).toMatchObject({ id, kind: 'foundation' });
  expect(d.wallTypes[0].layers.map(l => l.fdn === false)).toEqual([false, true, true, true, true]);
});

// ── ON THE LAYOUT SHEETS ──────────────────────────────────────────────────
async function openLayout(page, saved) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
  await page.waitForTimeout(300);
}
const savedLayout = page => page.evaluate(async () => {
  const at = await window.SharedFileStore.loadSharedFileAt('model-drawing');
  return JSON.parse(await at.file.text()).layout || {};
});
async function showSheet(page, pattern) {
  const layout = await savedLayout(page);
  const titles = (layout.sheets || []).map(s => s.title || '');
  const index = titles.findIndex(t => pattern.test(t));
  expect(index, `a ${pattern} sheet is dealt (sheets: ${titles.join(' | ')})`).toBeGreaterThanOrEqual(0);
  await page.locator(`[data-layout-sheet="${index + 1}"]`).click();
  await page.waitForTimeout(300);
}
// THE SHEET'S OWN PAINTER (layout-plan drawPlan), at a scale where a 3 1/2"
// slice is many pixels wide, on a canvas of its own; counts the batt
// slice's pale blue (render-2d's insulation fill, 205,228,248).
const battOnSheet = (page, view) => page.evaluate(async view => {
  const at = await window.SharedFileStore.loadSharedFileAt('model-drawing');
  const saved = JSON.parse(await at.file.text());
  const canvas = document.createElement('canvas');
  canvas.width = 1000; canvas.height = 900;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1000, 900);
  window.DraftLayoutPlan.drawPlan(ctx, p => ({ x: 50 + p.x * 40, y: 50 + p.z * 40 }), saved, 1, { view });
  const d = ctx.getImageData(0, 0, 1000, 900).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - 205) < 14 && Math.abs(d[i + 1] - 228) < 14 && Math.abs(d[i + 2] - 248) < 10) n += 1;
  }
  return n;
}, view);

test('on the LAYOUT sheets too: the FOUNDATION plan prints the concrete only, the BASEMENT plan the whole wall', async ({ page }) => {
  const type = { id: 'wt_fdn1', name: '8IN CONC + LINING', kind: 'foundation', layers: [
    { name: '8" CONC', in: 8, fill: 'concrete' },
    { name: 'AIR SPACE', in: 0.5, fill: 'transparent', fdn: false },
    { name: '2X4 + BATT', in: 3.5, fill: 'insulation', fdn: false },
    { name: 'VB', in: 0, fill: 'stud', fdn: false },
    { name: 'GYP', in: 0.5, fill: 'white', fdn: false }] };
  const d = drawing({ wallTypes: [type], layout: { auto: true } });
  d.walls.filter(w => w.view === 'foundation').forEach(w => { w.wallType = type.id; w.widthIn = 12.5; });
  await openLayout(page, d);
  await showSheet(page, /FOUNDATION/i);
  await shot(page, '6-sheet-foundation-plan', '[data-layout-canvas]');
  await showSheet(page, /BASEMENT/i);
  await shot(page, '7-sheet-basement-plan', '[data-layout-canvas]');
  const onFdn = await battOnSheet(page, 'foundation');
  const onBsmt = await battOnSheet(page, 'plan');
  expect(onFdn, 'no lining on the FOUNDATION sheet').toBe(0);
  expect(onBsmt, 'the lining on the BASEMENT sheet').toBeGreaterThan(5000);
});
