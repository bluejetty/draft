// FENESTRATION LABELS (board #141): the office's naming ladder as a pure
// formatter (fen-labels.js) — G 8x16 garage doors in FEET height-first,
// ED36 / D32 / DD72 doors in inches of width, W 24x36 windows in INCHES
// width-first — plus the editable stock ladder in COMPANY STANDARDS and
// plan labels beside each opening behind a toggle that defaults OFF.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const INK = [29, 31, 32]; // #1d1f20 — committed line/label ink

async function openStandards(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/STANDARDS.html');
  await expect(page.locator('[data-fen-show-labels]')).toBeVisible();
}

test('the formatter encodes every quirk in the ladder', async ({ page }) => {
  await h.openModel(page);
  const labels = await page.evaluate(() => {
    const fen = window.DraftFenLabels;
    const door = (widthFt, flags = {}) => fen.fenLabel({ type: 'door', widthFt, ...flags });
    return {
      // Garage: FEET, HEIGHT x WIDTH — height first, always.
      garageDouble: door(16, { garage: true, heightFt: 8 }),
      garageSingle: door(9, { garage: true, heightFt: 8 }),
      // Exterior man doors: inches wide.
      ed36: door(3, { exterior: true }),
      ed32: door((2 * 12 + 8) / 12, { exterior: true }),
      // Interior swing doors, down through the closet run.
      d32: door((2 * 12 + 8) / 12),
      d30: door(2.5),
      d24: door(2),
      d18: door(1.5),
      // Closet double doors — and a double outranks ED wherever it hangs.
      dd72: door(6, { double: true }),
      dd60: door(5, { double: true }),
      dd48: door(4, { double: true, exterior: true }),
      // Windows: INCHES, WIDTH x HEIGHT.
      w2436: fen.fenLabel({ type: 'window', widthFt: 2, heightFt: 3 }),
      // Derivation from a real opening record: the BUILD HOUSE overhead
      // (16' x 7' head, garage flag) and man door (2'-8", exterior wall).
      autoOverhead: fen.fenLabelForOpening(
        { type: 'door', width: 16, headHeight: 7, garage: true }, { exteriorWall: true }),
      autoMan: fen.fenLabelForOpening(
        { type: 'door', width: (2 * 12 + 8) / 12, headHeight: (6 * 12 + 8) / 12 }, { exteriorWall: true }),
      looseWallDoor: fen.fenLabelForOpening(
        { type: 'door', width: 3, headHeight: (6 * 12 + 8) / 12 }, { exteriorWall: false }),
      window: fen.fenLabelForOpening(
        { type: 'window', width: 2, sillHeight: 2.5, headHeight: 5.5 }, { exteriorWall: true }),
      defaults: fen.normaliseFenStandards(null),
    };
  });
  expect(labels.garageDouble).toBe('G 8x16');
  expect(labels.garageSingle).toBe('G 8x9');
  expect(labels.ed36).toBe('ED36');
  expect(labels.ed32).toBe('ED32');
  expect(labels.d32).toBe('D32');
  expect(labels.d30).toBe('D30');
  expect(labels.d24).toBe('D24');
  expect(labels.d18).toBe('D18');
  expect(labels.dd72).toBe('DD72');
  expect(labels.dd60).toBe('DD60');
  expect(labels.dd48).toBe('DD48');
  expect(labels.w2436).toBe('W 24x36');
  expect(labels.autoOverhead).toBe('G 7x16');
  expect(labels.autoMan).toBe('ED32');
  expect(labels.looseWallDoor).toBe('D36');
  expect(labels.window).toBe('W 24x36');
  // Labels ship dark: nothing changes until the office opts in.
  expect(labels.defaults.showLabels).toBe(false);
  expect(labels.defaults.stock.d).toEqual(['36', '32', '30', '24', '18']);
  expect(labels.defaults.stock.garage).toEqual(['8x16', '8x9']);
});

test('the STANDARDS stock ladder edits persist and reset restores the seeds', async ({ page }) => {
  await openStandards(page);
  const toggle = page.locator('[data-fen-show-labels]');
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(page.locator('#status')).toContainText('Fenestration labels ON.');

  const dLadder = page.locator('[data-fen-stock="d"]');
  await expect(dLadder).toHaveValue('36, 32, 30, 24, 18');
  await dLadder.fill('32, 28');
  await dLadder.dispatchEvent('change');
  await expect(page.locator('#status')).toContainText('D stock ladder saved.');

  await page.reload();
  await expect(page.locator('[data-fen-show-labels]')).toBeChecked();
  await expect(page.locator('[data-fen-stock="d"]')).toHaveValue('32, 28');
  // An emptied list never sticks — it falls back to the seeds.
  await page.locator('[data-fen-stock="dd"]').fill(' ,  , ');
  await page.locator('[data-fen-stock="dd"]').dispatchEvent('change');
  await expect(page.locator('[data-fen-stock="dd"]')).toHaveValue('72, 60, 48');

  await page.locator('#reset').click();
  await expect(page.locator('[data-fen-show-labels]')).not.toBeChecked();
  await expect(page.locator('[data-fen-stock="d"]')).toHaveValue('36, 32, 30, 24, 18');
});

test('plan labels stay dark until the STANDARDS toggle turns them on', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);

  // The label paints just off the wall face below the opening centre. Sample
  // the same window before and after: geometry is identical both times, so
  // the only delta ink can be the label text.
  const at = await h.worldToClient(page, 2, 0.78);
  const off = h.countColor(await h.overlayPixels(page, at.x, at.y), INK);

  await page.goto('/STANDARDS.html');
  await page.locator('[data-fen-show-labels]').check();
  await expect(page.locator('#status')).toContainText('Fenestration labels ON.');

  await page.goto('/MODEL.dc.html');
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  const onAt = await h.worldToClient(page, 2, 0.78);
  const on = h.countColor(await h.overlayPixels(page, onAt.x, onAt.y), INK);
  expect(on - off).toBeGreaterThan(10);
});
