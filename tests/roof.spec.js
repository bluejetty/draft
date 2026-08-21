// The ROOF tool works on the ROOF level in two modes. ROOF (basic): draw a
// line at the roof edge, click the side the roof extends toward, and accept
// an overhang to drop in a square footprint. CAPTURE: trace the exterior
// wall outline of the level below, grown outward by the eave overhang.
// Either way the footprint is an editable A-ROOF shape whose edges tag as
// EAVE / GABLE.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function switchLevel(page, name) {
  await levelRow(page, name).locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function drawBasicRoof(page) {
  await switchLevel(page, 'ROOF');
  await h.selectTool(page, 'Roof');
  await h.clickWorld(page, -6, 0);   // first end of the roof edge
  await h.clickWorld(page, 6, 0);    // second end
  await h.clickWorld(page, 0, 8);    // the side the roof extends toward
  await page.keyboard.press('Enter'); // accept the 2' default overhang
  await h.waitForSaved(page);
}

test('basic mode drops a square roof from a drawn edge with the default overhang', async ({ page }) => {
  await h.openModel(page);
  await drawBasicRoof(page);

  const saved = await h.savedDrawing(page);
  expect(saved.roofs).toHaveLength(1);
  const roof = saved.roofs[0];
  expect(roof.levelId).toBe(7);
  expect(roof.layer).toBe('A-ROOF');
  expect(roof.points).toHaveLength(4);
  expect(roof.overhang).toBe(2);
  expect(roof.pitch).toBe(4);
  expect(roof.fascia).toBe(5.5);
  // heel = 5.5" fascia + 24" overhang × 4/12 rise = 13.5"
  expect(roof.heel).toBeCloseTo(13.5, 5);
  // The drawn edge is one side; the body extends its own length toward +z.
  expect(roof.points.some(p => h.near(p.x, -6) && h.near(p.z, 0))).toBe(true);
  expect(roof.points.some(p => h.near(p.x, 6) && h.near(p.z, 12))).toBe(true);
  expect(roof.edges).toEqual(['eave', 'gable', 'eave', 'gable']);
});

test('typing an overhang in the panel stores it on the roof', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'ROOF');
  await h.selectTool(page, 'Roof');
  await page.getByLabel('Eave overhang').fill("1'6\"");
  await page.getByLabel('Eave overhang').blur();
  await page.getByLabel('Roof pitch').fill('6');
  await page.getByLabel('Roof pitch').blur();

  await h.clickWorld(page, -6, 0);
  await h.clickWorld(page, 6, 0);
  await h.clickWorld(page, 0, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const roof = (await h.savedDrawing(page)).roofs[0];
  expect(roof.overhang).toBe(1.5);
  expect(roof.pitch).toBe(6);
  // heel = 5.5 + 18 × 6/12 = 14.5"
  expect(roof.heel).toBeCloseTo(14.5, 5);
});

test('an out-of-range overhang is rejected with a message', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'ROOF');
  await h.selectTool(page, 'Roof');
  await page.getByLabel('Eave overhang').fill("8'");
  await page.getByLabel('Eave overhang').blur();
  await expect(page.getByText("Overhang must be between 0 and 6'.")).toBeVisible();
});

test('clicking a roof edge with the Roof tool toggles EAVE / GABLE', async ({ page }) => {
  await h.openModel(page);
  await drawBasicRoof(page);

  // Idle Roof clicks near an edge toggle its tag; the drawn edge is edge 0.
  await h.clickWorld(page, 0, 0);
  await h.waitForSaved(page);
  let roof = (await h.savedDrawing(page)).roofs[0];
  expect(roof.edges[0]).toBe('gable');

  await h.clickWorld(page, 0, 0);
  await h.waitForSaved(page);
  roof = (await h.savedDrawing(page)).roofs[0];
  expect(roof.edges[0]).toBe('eave');
});

test('roof corners drag independently with Select', async ({ page }) => {
  await h.openModel(page);
  await drawBasicRoof(page);

  await h.selectTool(page, 'Select');
  const from = await h.worldToClient(page, 6, 12);
  const to = await h.worldToClient(page, 10, 16);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);

  const roof = (await h.savedDrawing(page)).roofs[0];
  expect(roof.points.some(p => h.near(p.x, 10) && h.near(p.z, 16))).toBe(true);
});

test('capture traces the walls below and grows the footprint by the overhang', async ({ page }) => {
  await h.openModel(page);

  // A closed rectangle of exterior walls on MAIN FL PLAN.
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await h.clickWorld(page, -8, -6); // close onto the first point
  await h.waitForSaved(page);

  await switchLevel(page, 'ROOF');
  await h.selectTool(page, 'Roof');
  await page.getByRole('button', { name: 'CAPTURE', exact: true }).click();
  await page.getByRole('button', { name: 'CAPTURE WALLS BELOW' }).click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.roofs).toHaveLength(1);
  const roof = saved.roofs[0];
  expect(roof.levelId).toBe(7);
  expect(roof.sourceLevelId).toBe(3); // MAIN FL
  expect(roof.points).toHaveLength(4);
  expect(roof.edges).toEqual(['eave', 'eave', 'eave', 'eave']);
  // Wall centerline outline ±(8, 6) grown by the 2' overhang → ±(10, 8).
  const xs = roof.points.map(p => Math.abs(p.x));
  const zs = roof.points.map(p => Math.abs(p.z));
  xs.forEach(x => expect(x).toBeGreaterThan(9.5));
  zs.forEach(z => expect(z).toBeGreaterThan(7.5));

  // The captured walls stay untouched on MAIN FL.
  const walls = h.allWalls(saved);
  expect(walls).toHaveLength(4);
  expect(walls.every(wall => wall.levelId === 3)).toBe(true);
});

test('a roof survives a reload', async ({ page }) => {
  await h.openModel(page);
  await drawBasicRoof(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);

  const roof = (await h.savedDrawing(page)).roofs[0];
  expect(roof.points).toHaveLength(4);
  expect(roof.layer).toBe('A-ROOF');
});
