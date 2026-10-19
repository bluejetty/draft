// THE CONSTRUCTION CALCULATOR, a CALC tab on the NOTES pad (Movie, 18 Oct:
// "can we add a construction calculator tab under the notebook tab ... metric
// and ft and do area" -- "need areas for sure" -- "don't need volumes -
// except for CONC estimation later"). The arithmetic is checked offline in
// proto/calc-engine-harness.js; these check the pad it lives on.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const drawing = (extra = {}) => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, f = drawing()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    localStorage.removeItem('draft.calc');
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const line = page => page.locator('[data-calc-line]');
const answer = page => page.locator('[data-calc-answer]');
const rows = page => page.locator('[data-calc-row]');
const key = (page, k) => page.locator(`[data-calc-key="${k}"]`);
const act = (page, what) => page.locator(`[data-calc-do="${what}"]`);
async function openCalc(page) {
  const tab = page.locator('#notes-tab');
  if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click();
  await page.locator('[data-pad-tab="calc"]').click();
  await expect(line(page)).toBeVisible();
}

test('CALC is a tab beside NOTES on the pad; it swaps the page for the calculator and back', async ({ page }) => {
  await open(page);
  await openCalc(page);
  await expect(page.locator('[data-pad-tab="calc"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-notes-text]')).toBeHidden();
  await expect(page.locator('[data-notes-clear]')).toBeHidden();
  await expect(line(page)).toBeFocused();
  await page.locator('[data-pad-tab="notes"]').click();
  await expect(page.locator('[data-notes-text]')).toBeVisible();
  await expect(page.locator('[data-calc]')).toBeHidden();
});

test('his sum typed the way he writes it: 367-10 1/4 - 10-1 1/4 is 357\'-9", onto the tape with ENTER', async ({ page }) => {
  await open(page);
  await openCalc(page);
  await line(page).fill('367-10 1/4 - 10-1 1/4');
  await expect(answer(page)).toContainText(`357'-9"`);
  await line(page).press('Enter');
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('367-10 1/4 - 10-1 1/4');
  await expect(rows(page).first()).toContainText(`357'-9"`);
  // The answer stays on the line to work on from.
  await expect(answer(page)).toContainText(`357'-9"`);
  // And the tape is kept through a reload.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await openCalc(page);
  await expect(rows(page)).toHaveCount(1);
});

test('on the keys: 12 FT x 10 FT = is an area, 120 sq ft; METRIC turns it to sq m first', async ({ page }) => {
  await open(page);
  await openCalc(page);
  for (const k of ['1', '2', "'", ' x ', '1', '0', "'"]) await key(page, k).click();
  await expect(line(page)).toHaveValue("12' x 10'");
  await act(page, 'equals').click();
  await expect(rows(page).first()).toContainText('120 sq ft');
  await act(page, 'clear').click();
  await expect(line(page)).toHaveValue('');
  await act(page, 'units').click();
  await expect(act(page, 'units')).toHaveText('METRIC');
  for (const k of ['4', ' x ', '3']) await key(page, k).click();
  await expect(answer(page)).toContainText('12 sq m');
  await act(page, 'back').click();
  await expect(line(page)).toHaveValue('4 x');
});

test('a volume is refused and says why; a tape row clicked brings its answer back', async ({ page }) => {
  await open(page);
  await openCalc(page);
  await line(page).fill(`12' x 10' x 8'`);
  await expect(answer(page)).toContainText('volume');
  await line(page).press('Enter');
  await expect(rows(page)).toHaveCount(0);
  await line(page).fill(`10' + 2'`);
  await line(page).press('Enter');
  await line(page).fill('');
  await rows(page).first().click();
  await expect(answer(page)).toContainText(`12'-0"`);
});

test('-> NOTES writes the line and its answer on the pad, and it saves with the drawing', async ({ page }) => {
  await open(page);
  await openCalc(page);
  await line(page).fill('12 x 10');
  await act(page, 'notes').click();
  await page.locator('[data-pad-tab="notes"]').click();
  await expect(page.locator('[data-notes-text]')).toHaveValue('12 x 10 = 120 sq ft');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).notepad).toBe('12 x 10 = 120 sq ft');
});

test('a D typed on the calculator line is a D, not DIMENSION', async ({ page }) => {
  await open(page);
  await openCalc(page);
  await line(page).click();
  await page.keyboard.type('wd');
  await expect(line(page)).toHaveValue('wd');
  for (const k of ['wall', 'dimension']) {
    await expect(page.locator(`[data-tool-key="${k}"]`)).not.toHaveAttribute('aria-pressed', 'true');
  }
});
