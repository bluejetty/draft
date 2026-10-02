// FENESTRATION LABELS (board #141): the office's naming ladder as a pure
// formatter (fen-labels.js) — since 1 Oct three letters for the estimate:
// G 16W x 8H garage doors in FEET width-first, D36 for every other door in
// inches of width, W 36 X 42 windows in INCHES width-first — plus the
// editable stock ladder in COMPANY STANDARDS and the DOOR SIZES ON
// ELEVATIONS switch, which defaults OFF.
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
  await expect(page.locator('[data-fen-doors-elevations]')).toBeVisible();
}

test('the formatter encodes every quirk in the ladder', async ({ page }) => {
  await h.openModel(page);
  const labels = await page.evaluate(() => {
    const fen = window.DraftFenLabels;
    const door = (widthFt, flags = {}) => fen.fenLabel({ type: 'door', widthFt, ...flags });
    return {
      // Garage: FEET, WIDTH then HEIGHT, each marked (Movie, 1 Oct).
      garageDouble: door(16, { garage: true, heightFt: 8 }),
      garageSingle: door(9, { garage: true, heightFt: 8 }),
      // Exterior man doors: D, inches wide -- no ED any more.
      ed36: door(3, { exterior: true }),
      ed32: door((2 * 12 + 8) / 12, { exterior: true }),
      // Interior swing doors, down through the closet run.
      d32: door((2 * 12 + 8) / 12),
      d30: door(2.5),
      d24: door(2),
      d18: door(1.5),
      // French / double doors are D too: one letter for every door.
      dd72: door(6, { double: true }),
      dd60: door(5, { double: true }),
      dd48: door(4, { double: true, exterior: true }),
      // Windows: INCHES, WIDTH X HEIGHT, and the W is back for the estimate
      // (Movie, 1 Oct: "we should put the W before the window sizes"). Still
      // the actual size: "i want it to match the actual size of the window".
      w2436: fen.fenLabel({ type: 'window', widthFt: 2, heightFt: 3 }),
      // AND IT IS NOT SNAPPED TO THE STOCK LADDER. 37 x 49 is off every rung
      // of it, and the sheet must say what was drawn rather than what could
      // have been ordered.
      wOddSize: fen.fenLabel({ type: 'window', widthFt: 37 / 12, heightFt: 49 / 12 }),
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
  expect(labels.garageDouble).toBe('G 16W x 8H');
  expect(labels.garageSingle).toBe('G 9W x 8H');
  expect(labels.ed36).toBe('D36');
  expect(labels.ed32).toBe('D32');
  expect(labels.d32).toBe('D32');
  expect(labels.d30).toBe('D30');
  expect(labels.d24).toBe('D24');
  expect(labels.d18).toBe('D18');
  expect(labels.dd72).toBe('D72');
  expect(labels.dd60).toBe('D60');
  expect(labels.dd48).toBe('D48');
  expect(labels.w2436).toBe('W 24 X 36');
  expect(labels.wOddSize).toBe('W 37 X 49');
  expect(labels.autoOverhead).toBe('G 16W x 7H');
  expect(labels.autoMan).toBe('D32');
  expect(labels.looseWallDoor).toBe('D36');
  expect(labels.window).toBe('W 24 X 36');
  // Door sizes stay off the elevations until the office turns them on.
  expect(labels.defaults.doorsOnElevations).toBe(false);
  expect(labels.defaults.showLabels).toBe(false);
  expect(labels.defaults.stock.d).toEqual(['36', '32', '30', '24', '18']);
  expect(labels.defaults.stock.garage).toEqual(['16x8', '9x8']);
});

test('the STANDARDS stock ladder edits persist and reset restores the seeds', async ({ page }) => {
  await openStandards(page);
  const toggle = page.locator('[data-fen-doors-elevations]');
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(page.locator('#status')).toContainText('Door sizes on elevations ON.');

  const dLadder = page.locator('[data-fen-stock="d"]');
  await expect(dLadder).toHaveValue('36, 32, 30, 24, 18');
  await dLadder.fill('32, 28');
  await dLadder.dispatchEvent('change');
  await expect(page.locator('#status')).toContainText('D stock ladder saved.');

  await page.reload();
  await expect(page.locator('[data-fen-doors-elevations]')).toBeChecked();
  await expect(page.locator('[data-fen-stock="d"]')).toHaveValue('32, 28');
  // An emptied list never sticks — it falls back to the seeds.
  await page.locator('[data-fen-stock="dd"]').fill(' ,  , ');
  await page.locator('[data-fen-stock="dd"]').dispatchEvent('change');
  await expect(page.locator('[data-fen-stock="dd"]')).toHaveValue('72, 60, 48');

  await page.locator('#reset').click();
  await expect(page.locator('[data-fen-doors-elevations]')).not.toBeChecked();
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

  // THE OLD PAGE'S OWN SWITCH, set in the stored standards: STANDARDS no
  // longer shows it (the current pages answer to the A-DIMS layers), but
  // MODEL.dc.html still reads it and must still honour it.
  await page.goto('/STANDARDS.html');
  await page.evaluate(() => {
    const m = window.DraftProfileManager;
    const active = m.getActive('standards');
    const model = active?.content?.model || {};
    m.saveActive(m.createPackage('standards', active?.name || 'Company Standards', {
      model: { ...model, fenestrationStandards: { ...(model.fenestrationStandards || {}), showLabels: true } },
    }));
  });

  await page.goto('/MODEL.dc.html');
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  const onAt = await h.worldToClient(page, 2, 0.78);
  const on = h.countColor(await h.overlayPixels(page, onAt.x, onAt.y), INK);
  expect(on - off).toBeGreaterThan(10);
});
