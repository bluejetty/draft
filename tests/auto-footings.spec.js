// Automatic footings ride BUILD HOUSE: strip footings around the house and
// pad footings under the columns. On the FOUNDATION plan a pad label is a
// live control — clicking it opens an entry that types the pad square in
// inches. Nearby pads render as one combined footing, and S-FOOTING strip
// lines stay locked to BUILD HOUSE unless the company standard turns on
// freeform footing editing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function useFoundationPlan(page) {
  await levelRow(page, 'FOUNDATION').locator('.level-body').click();
  await levelRow(page, 'FOUNDATION').locator('.level-layer', { hasText: 'FOUNDATION' }).click();
  await page.waitForTimeout(300);
}

// A pad label sits just under the pad's dashed rectangle; the hit band runs
// a few px below the text baseline, so aim slightly under the pad bottom.
async function clickPadLabel(page, worldX, padBottomZ) {
  const p = await h.worldToClient(page, worldX, padBottomZ);
  await page.evaluate(({ cx, cy }) => {
    const canvas = document.querySelector('[data-model-canvas]');
    const opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0 };
    canvas.dispatchEvent(new PointerEvent('mousemove', { ...opts, buttons: 0 }));
    canvas.dispatchEvent(new PointerEvent('mousedown', { ...opts, buttons: 1 }));
    window.dispatchEvent(new PointerEvent('mouseup', { ...opts, buttons: 0 }));
  }, { cx: p.x, cy: p.y + 8 });
  await page.waitForTimeout(300);
}

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);
}

test('clicking a FOUNDATION pad label types a custom pad size that survives a reload', async ({ page }) => {
  await h.openModel(page);
  await useFoundationPlan(page);

  await h.selectTool(page, 'Column');
  await h.clickWorld(page, 0, 0);
  await h.waitForSaved(page);

  // The 36×36 default pad ends 1.5 ft below its centre; the label hangs there.
  await h.selectTool(page, 'Select');
  await clickPadLabel(page, 0, 1.5);
  await expect(page.locator('[data-pad-editor-input]')).toBeVisible();

  await page.locator('[data-pad-editor-input]').fill('40');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  let saved = await h.savedDrawing(page);
  expect(saved.columns).toHaveLength(1);
  expect(saved.columns[0].padIn).toBe(40);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);
  saved = await h.savedDrawing(page);
  expect(saved.columns[0].padIn).toBe(40);
});

test('nearby pads combine into one footing and share the typed size', async ({ page }) => {
  await h.openModel(page);
  await useFoundationPlan(page);

  // Two teleposts 2.5 ft apart: their 3 ft pads overlap into one footing.
  await h.selectTool(page, 'Column');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 2.5, 0);
  await h.waitForSaved(page);

  // The combined label hangs under the shared bounding rectangle.
  await h.selectTool(page, 'Select');
  await clickPadLabel(page, 1.25, 1.5);
  await expect(page.locator('[data-pad-editor-input]')).toBeVisible();
  await expect(page.getByText('every pad in this combined footing')).toBeVisible();

  // Architectural entry: 3-4 reads as 3'-4" = 40 inches, set on every pad.
  await page.locator('[data-pad-editor-input]').fill('3-4');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.columns).toHaveLength(2);
  saved.columns.forEach(column => expect(column.padIn).toBe(40));
});

test('a pile label never takes a square pad size', async ({ page }) => {
  await h.openModel(page);
  await useFoundationPlan(page);

  await h.selectTool(page, 'Column');
  await page.getByRole('button', { name: '10"ø PILE' }).click();
  await h.clickWorld(page, 0, 0);
  await h.waitForSaved(page);

  // A pile draws its true circle — there is no pad label to click.
  await h.selectTool(page, 'Select');
  await clickPadLabel(page, 0, 5 / 12);
  await expect(page.locator('[data-pad-editor-input]')).toHaveCount(0);

  const saved = await h.savedDrawing(page);
  expect(saved.columns).toHaveLength(1);
  expect(saved.columns[0].footing).toBe('pile10');
  expect(saved.columns[0].padIn).toBeUndefined();
});

test('S-FOOTING lines are locked until the standards allow freeform editing', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);
  await buildHouse(page);

  let saved = await h.savedDrawing(page);
  expect(saved.lines.filter(line => line.layer === 'S-FOOTING')).toHaveLength(8);

  // With the LINE filter engaged, a click dead on the outer footing ring
  // refuses the pick and explains the office standard instead.
  await useFoundationPlan(page);
  await h.selectTool(page, 'Select');
  await page.locator('[data-select-filters] button').filter({ hasText: /^LINE$/ }).click();
  await h.clickWorld(page, 0, -6.5);
  await expect(page.getByText('FREEFORM FOOTING EDITING')).toBeVisible();
  await page.keyboard.press('Delete');
  await page.waitForTimeout(400);
  saved = await h.savedDrawing(page);
  expect(saved.lines.filter(line => line.layer === 'S-FOOTING')).toHaveLength(8);

  // The company standard flips the lock.
  await page.goto('/STANDARDS.html');
  await page.locator('[data-freeform-footings]').check();
  await expect(page.locator('#status')).toContainText('Freeform footing editing is on');

  await page.goto('/MODEL.dc.html');
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);
  await useFoundationPlan(page);
  await h.selectTool(page, 'Select');
  await page.locator('[data-select-filters] button').filter({ hasText: /^LINE$/ }).click();
  await h.clickWorld(page, 0, -6.5);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.lines.filter(line => line.layer === 'S-FOOTING')).toHaveLength(7);
});

test('a typed R length follows a cursor pointed left', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');

  await h.clickWorld(page, 0, 0);
  // Aim LEFT, freeze, type 12: the segment must land at (-12, 0), not (12, 0).
  await h.moveTo(page, -5, 0);
  await page.keyboard.press('r');
  await page.keyboard.type('12');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  await h.clickWorld(page, -12, -10);
  await h.clickWorld(page, 0, -10);
  await h.clickWorld(page, 0, 0);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);
  const master = saved.boneyardOutlines[0];
  expect(master.points.some(p => h.near(p.x, -12) && h.near(p.z, 0))).toBe(true);
  expect(master.points.some(p => p.x > 5)).toBe(false);
});
