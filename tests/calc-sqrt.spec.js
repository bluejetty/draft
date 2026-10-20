// THE ROOT AND THE SQUARE ON THE CALC PAD (Movie, 20 Oct).
//
// "can you put a SQURE ROOT calc button on here" -- "needed that function to
// calculate for a SQ bSQ = c SQ pythag therom i think its called" -- and
// "make the title for the tab NOTES / CALC". Two keys beside FT-IN: the
// root before what it takes the root of, the square after what it squares,
// so Pythagoras is one line.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    localStorage.removeItem('draft.calc');
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const line = page => page.locator('[data-calc-line]');
const rows = page => page.locator('[data-calc-row]');
const key = (page, k) => page.locator(`[data-calc-key="${k}"]`);
const act = (page, what) => page.locator(`[data-calc-do="${what}"]`);
async function openCalc(page) {
  const tab = page.locator('#notes-tab');
  if (await tab.getAttribute('aria-expanded') !== 'true') await tab.click();
  await page.locator('[data-pad-tab="calc"]').click();
  await expect(line(page)).toBeVisible();
}

test('the tab reads NOTES / CALC', async ({ page }) => {
  await open(page);
  await expect(page.locator('#notes-tab')).toHaveText('NOTES / CALC');
});

test('Pythagoras on the keys: the root of 3 ft squared and 4 ft squared is 5 ft', async ({ page }) => {
  await open(page);
  await openCalc(page);
  for (const k of ['√(', '3', "'", '²', ' + ', '4', "'", '²', ')']) await key(page, k).click();
  await expect(line(page)).toHaveValue("√(3'² + 4'²)");
  await act(page, 'equals').click();
  await expect(rows(page).first()).toContainText(`5'-0"`);
});

test('a length squared is an area, and the root of a bare length is refused in words', async ({ page }) => {
  await open(page);
  await openCalc(page);
  for (const k of ['1', '2', "'", '²']) await key(page, k).click();
  await act(page, 'equals').click();
  await expect(rows(page).first()).toContainText('144 sq ft');
  await act(page, 'clear').click();
  for (const k of ['√(', '9', "'", ')']) await key(page, k).click();
  await expect(page.locator('[data-calc-answer]')).toContainText("can't take the root of a length");
});
