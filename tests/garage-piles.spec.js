// Garage piles: the attached garage's grade beam bears on drilled concrete
// piles. BUILD HOUSE sets the two at the beam corners against the house
// (10"ø default); the drafter places the rest with the COLUMN tool's three
// pile sizes, COPY, or a straight drag.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function useFoundationContext(page) {
  await levelRow(page, 'FOUNDATION').locator('.level-body').click();
  await levelRow(page, 'FOUNDATION').locator('.level-layer', { hasText: 'PLAN' }).first().click();
}

// House: 16×12 rect. Attached garage: an open 3-leg run off the right side.
async function drawHouseOutline(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
}

async function drawGarageOutline(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
  await page.keyboard.press('Enter'); // the professor's lesson steps aside
  for (const [x, z] of [[8, -4], [20, -4], [20, 4], [8, 4]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

async function dragWindow(page, x1, z1, x2, z2) {
  const a = await h.worldToClient(page, x1, z1);
  const b = await h.worldToClient(page, x2, z2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2);
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

async function dragWorld(page, fromX, fromZ, toX, toZ) {
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);
}

test('COLUMN offers three pile sizes that place, persist, and reload', async ({ page }) => {
  await h.openModel(page);
  await useFoundationContext(page);

  await h.selectTool(page, 'Column');
  await expect(page.getByRole('button', { name: '8"ø PILE' })).toBeVisible();
  await expect(page.getByRole('button', { name: '10"ø PILE' })).toBeVisible();
  await expect(page.getByRole('button', { name: '12"ø PILE' })).toBeVisible();

  await page.getByRole('button', { name: '10"ø PILE' }).click();
  await h.clickWorld(page, -4, -4);
  await page.getByRole('button', { name: '12"ø PILE' }).click();
  await h.clickWorld(page, 4, -4);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.columns).toHaveLength(2);
  const footings = saved.columns.map(column => column.footing).sort();
  expect(footings).toEqual(['pile10', 'pile12']);
  saved.columns.forEach(column => {
    expect(column.view).toBe('foundation');
    expect(column.levelId).toBe(1);
    expect(column.layer).toBe('S-COL-FOOTING');
  });

  // The pile circle + centre mark render on the FOUNDATION plan.
  const at = await h.worldToClient(page, -4, -4);
  const pixels = await h.overlayPixels(page, at.x, at.y, 12);
  expect(h.countColor(pixels, [29, 31, 32])).toBeGreaterThan(0);

  // And survive a reload through the drawing format.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  const reloaded = await h.savedDrawing(page);
  expect(reloaded.columns).toHaveLength(2);
  expect(reloaded.columns.map(column => column.footing).sort()).toEqual(['pile10', 'pile12']);
});

test('BUILD HOUSE sets 2 piles at the beam corners against the house — never doubled', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);
  await buildHouse(page);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.columns).toHaveLength(2);
  saved.columns.forEach(column => {
    expect(column.footing).toBe('pile10');
    expect(column.levelId).toBe(1);
    expect(column.view).toBe('foundation');
  });
  // At the two garage ends welded onto the house (8,-4) and (8,4).
  const zs = saved.columns.map(column => column.point.z).sort((a, b) => a - b);
  saved.columns.forEach(column => expect(h.near(column.point.x, 8, 0.05)).toBe(true));
  expect(h.near(zs[0], -4, 0.05)).toBe(true);
  expect(h.near(zs[1], 4, 0.05)).toBe(true);

  // A second BUILD HOUSE never doubles them.
  await buildHouse(page);
  const rebuilt = await h.savedDrawing(page);
  expect(rebuilt.columns).toHaveLength(2);
});

test('a detached garage gets no automatic piles', async ({ page }) => {
  await h.openModel(page);
  // A DETACHED garage (grade beam) stands on its own — its supports are the
  // drafter's call, so BUILD HOUSE places none.
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /DETACHED GARAGE/ }).click();
  for (const [x, z] of [[-6, -5], [6, -5], [6, 5], [-6, 5]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await page.locator('[data-detached-grade-beam]').click();
  await h.waitForSaved(page);
  await buildHouse(page);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.columns ?? []).toHaveLength(0);
});

test('COPY captures a pile and drops repeats along the beam', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);
  await buildHouse(page);
  await h.waitForSaved(page);
  await useFoundationContext(page);

  await page.keyboard.press('k');
  await page.waitForTimeout(200);
  await dragWindow(page, 7, 3, 9, 5);      // window around the (8,4) pile
  await h.clickWorld(page, 8, 4);          // base on the pile centre
  await h.clickWorld(page, 14, 4);         // repeat along the front beam
  await h.clickWorld(page, 20, 4);         // and at the far corner
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.columns).toHaveLength(4);
  const copies = saved.columns.filter(column => !h.near(column.point.x, 8, 0.05));
  expect(copies).toHaveLength(2);
  copies.forEach(column => {
    expect(column.footing).toBe('pile10');
    expect(column.view).toBe('foundation');
    expect(h.near(column.point.z, 4, 0.5)).toBe(true);
  });
  expect(copies.some(column => h.near(column.point.x, 14, 0.5))).toBe(true);
  expect(copies.some(column => h.near(column.point.x, 20, 0.5))).toBe(true);
});

test('SELECT drags a pile straight to a new centre', async ({ page }) => {
  await h.openModel(page);
  await useFoundationContext(page);

  await h.selectTool(page, 'Column');
  await page.getByRole('button', { name: '8"ø PILE' }).click();
  await h.clickWorld(page, -4, -4);
  await h.waitForSaved(page);

  await h.selectTool(page, 'Select');
  await dragWorld(page, -4, -4, 2, 3);

  const saved = await h.savedDrawing(page);
  expect(saved.columns).toHaveLength(1);
  expect(h.near(saved.columns[0].point.x, 2, 0.5)).toBe(true);
  expect(h.near(saved.columns[0].point.z, 3, 0.5)).toBe(true);
  expect(saved.columns[0].footing).toBe('pile8');
});
