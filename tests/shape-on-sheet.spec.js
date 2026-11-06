// SHAPES PRINT ON THE SHEET, AND A SHAPE CAN BE TOLD NOT TO.
//
// jb, 6 Nov: "shapes like your tree don't print on layout sheets yet ...
// yes i will need to see it" -- "we should have a properties to SHOW or NOT
// SHOW" -- "DRAFT or NO DRAFT" -- "maybe can use the existing layers maybe".
//
// A shape on the SITE level (a tree) and a shape on MAIN FL (a deck) both
// reach their plan viewports with their label, hatch and area; a shape on
// the line tool's NO-DRAFT layer is drawn in MODEL and never on a sheet;
// and the SHAPE panel's DRAFT / NO DRAFT chips move a shape between the two.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const square = (x, z, w, d) => [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }];
// A TREE: an eight-point crown, which no wall or floor ever is.
const crown = (cx, cz, r) => Array.from({ length: 8 }, (_, i) => ({
  x: cx + r * Math.cos(i * Math.PI / 4), z: cz + r * Math.sin(i * Math.PI / 4) }));

function houseAndSite(shapes) {
  const wall = (id, sx, sz, ex, ez) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8.09, refLine: 'left',
  });
  return {
    version: 1,
    levels: [
      { id: 8, name: 'SITE', elev: 0 },
      { id: 7, name: 'ROOF', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [wall(1, 0, 0, 36, 0), wall(2, 36, 0, 36, 26), wall(3, 36, 26, 0, 26), wall(4, 0, 26, 0, 0)],
    shapes,
    layout: { auto: true },
  };
}
const TREE = { id: 't1', points: crown(60, 40, 6), levelId: 8, layer: 'SHAPE', label: 'TREE', hatch: 'dots' };
const DECK = { id: 'd1', points: square(40, 4, 12, 10), levelId: 3, layer: 'SHAPE', label: 'DECK', showArea: true };

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
  const index = (layout.sheets || []).findIndex(s => pattern.test(s.title || ''));
  expect(index, `a ${pattern} sheet is dealt`).toBeGreaterThanOrEqual(0);
  await page.locator(`[data-layout-sheet="${index + 1}"]`).click();
  await page.waitForTimeout(300);
}
// THE SHAPE'S GREEN (layout-plan SHAPE_COLOR #2f6b5b): walls are black,
// floors and dimensions blue, the titleblock grey, so green is a shape.
const greenOnSheet = page => page.evaluate(() => {
  const canvas = document.querySelector('[data-layout-canvas]');
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let green = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] < 90 && d[i + 1] - d[i] >= 40 && d[i + 1] - d[i + 2] >= 8) green += 1;
  }
  return green;
});

test('a tree on the SITE level and a deck on MAIN FL print on their plan sheets, and NO-DRAFT shapes do not', async ({ page }) => {
  await openLayout(page, houseAndSite([TREE, DECK]));
  await showSheet(page, /SITE/i);
  const tree = await greenOnSheet(page);
  expect(tree, 'the tree is on the SITE PLAN sheet').toBeGreaterThan(40);
  await showSheet(page, /MAIN FL PLAN/i);
  const deck = await greenOnSheet(page);
  expect(deck, 'the deck is on the MAIN FL PLAN sheet, through the walls plan view').toBeGreaterThan(40);

  // THE SAME TWO ON NO-DRAFT: drawn in MODEL, on no sheet.
  const quiet = houseAndSite([{ ...TREE, layer: 'no-draft' }, { ...DECK, layer: 'no-draft' }]);
  quiet.layout = await savedLayout(page);
  await openLayout(page, quiet);
  await showSheet(page, /SITE/i);
  expect(await greenOnSheet(page), 'a NO DRAFT tree is not on the site sheet').toBe(0);
  await showSheet(page, /MAIN FL PLAN/i);
  expect(await greenOnSheet(page), 'a NO DRAFT deck is not on the plan sheet').toBe(0);
});

// ── THE CHIPS IN MODEL ────────────────────────────────────────────────────
const S = (id, pts, extra = {}) => ({ id, points: pts, levelId: 3, layer: 'SHAPE', ...extra });
const modelDrawing = (shapes = []) => ({
  version: 1, board: 'drafting', planTurn: 0, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  nextDrawingItemId: 50,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes, surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
const URL = '/MODEL.html?mode=day&level=3&left=1&lpane=drafting';
async function openModel(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(URL);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function zoomTo(page, target) {
  const box = await page.locator('#plan').boundingBox();
  const { scale } = await h.planFrame(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -Math.log(target / scale) / 0.0015);
  await page.waitForTimeout(120);
  return h.planFrame(page);
}
async function selectShape(page, at, x, z) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(120);
  await expect(page.locator('[data-shape-draft="draft"]')).toBeVisible();
}
const saved = async page => {
  await page.keyboard.press('Escape');
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const undo = async page => { await page.keyboard.press('Escape'); await page.locator('#model-undo').click(); await page.waitForTimeout(80); };

test('the SHAPE panel offers DRAFT / NO DRAFT; NO DRAFT is the no-draft layer, DRAFT is the flooring\'s layer again, and one UNDO takes each back', async ({ page }) => {
  await openModel(page, modelDrawing([S('s1', square(0, 0, 10, 8), { flooring: { type: 'tile', thicknessIn: 3 / 8 }, layer: 'A-FL-FLOORING' })]));
  const { at } = await zoomTo(page, 40);
  await selectShape(page, at, 5, 4);
  await expect(page.locator('[data-shape-draft="draft"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-shape-draft="no-draft"]')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('[data-shape-draft="no-draft"]').click();
  await expect(page.locator('[data-shape-draft="no-draft"]')).toHaveAttribute('aria-pressed', 'true');
  let d = await saved(page);
  expect(d.shapes[0].layer, 'NO DRAFT is the line tool\'s never-printing layer').toBe('no-draft');
  // READ BACK, it is still NO DRAFT, and DRAFT hands it to its flooring's layer.
  await openModel(page, d);
  const again = await zoomTo(page, 40);
  await selectShape(page, again.at, 5, 4);
  await expect(page.locator('[data-shape-draft="no-draft"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-shape-draft="draft"]').click();
  await expect(page.locator('[data-shape-draft="draft"]')).toHaveAttribute('aria-pressed', 'true');
  d = await saved(page);
  expect(d.shapes[0].layer, 'DRAFT with flooring is the flooring layer').toBe('A-FL-FLOORING');
  await undo(page);
  expect((await saved(page)).shapes[0].layer, 'one UNDO is NO DRAFT again').toBe('no-draft');
  // A bare shape told NO DRAFT then DRAFT lands back on SHAPE.
  await openModel(page, modelDrawing([S('s2', square(0, 0, 10, 8))]));
  const bare = await zoomTo(page, 40);
  await selectShape(page, bare.at, 5, 4);
  await page.locator('[data-shape-draft="no-draft"]').click();
  await page.waitForTimeout(80);
  await page.locator('[data-shape-draft="draft"]').click();
  expect((await saved(page)).shapes[0].layer).toBe('SHAPE');
});
