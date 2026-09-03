// The ROOF tool works on the ROOF level in two modes. ROOF (basic): draw a
// line at the roof edge, click the side the roof extends toward, and accept
// an overhang to drop in a square footprint. FROM SHAPE: build the footprint
// from the newest SHAPE outline, grown outward by the eave overhang.
// Either way the footprint is an editable A-ROOF outline whose edges tag as
// EAVE / GABLE.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Like h.countColor but only counts solid pixels: faint grid strokes read
// back from the canvas with noisy unpremultiplied colors at low alpha.
function countSolid(pixels, [r, g, b], tol = 26) {
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue;
    if (Math.abs(pixels[i] - r) <= tol && Math.abs(pixels[i + 1] - g) <= tol
      && Math.abs(pixels[i + 2] - b) <= tol) count += 1;
  }
  return count;
}

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

test('a gable edge draws its wall line one overhang inside the rake edge', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'ROOF');

  // Shape ±(8, 6) grows to a ±(10, 8) footprint with the 2' default overhang.
  await h.selectTool(page, 'Shape');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Roof');
  await page.getByRole('button', { name: 'FROM SHAPE', exact: true }).click();
  await page.getByRole('button', { name: 'BUILD FROM SHAPE' }).click();
  await h.waitForSaved(page);
  await page.waitForTimeout(400);

  // Sample with Select active so the Roof tool's EAVE / GABLE tags stay clear.
  const edgeColor = [122, 74, 33];
  const atWall = await h.worldToClient(page, 8, 3);
  await h.selectTool(page, 'Select');
  await page.waitForTimeout(400);
  // All-eave roof: no roof stroke back at the wall line x=8 (off the ridge).
  expect(countSolid(await h.overlayPixels(page, atWall.x, atWall.y, 4), edgeColor)).toBe(0);

  // Tag the x=10 edge GABLE: its wall line lands at x=8 — the outline the
  // roof grew from, one overhang inside the rake edge.
  await h.selectTool(page, 'Roof');
  await h.clickWorld(page, 10, 0);
  await h.waitForSaved(page);
  const roof = (await h.savedDrawing(page)).roofs[0];
  expect(roof.edges.filter(edge => edge === 'gable')).toHaveLength(1);
  await h.selectTool(page, 'Select');
  await page.waitForTimeout(400);
  expect(countSolid(await h.overlayPixels(page, atWall.x, atWall.y, 4), edgeColor)).toBeGreaterThan(0);
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

test('FROM SHAPE builds the footprint from the newest shape grown by the overhang', async ({ page }) => {
  await h.openModel(page);

  // A hand-drawn shape on the ROOF level is the roof's source outline.
  await switchLevel(page, 'ROOF');
  await h.selectTool(page, 'Shape');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Roof');
  await page.getByRole('button', { name: 'FROM SHAPE', exact: true }).click();
  await page.getByRole('button', { name: 'BUILD FROM SHAPE' }).click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.roofs).toHaveLength(1);
  const roof = saved.roofs[0];
  expect(roof.levelId).toBe(7);
  expect(roof.layer).toBe('A-ROOF');
  expect(roof.sourceShapeId).toBe(saved.shapes[0].id);
  expect(roof.points).toHaveLength(4);
  expect(roof.edges).toEqual(['eave', 'eave', 'eave', 'eave']);
  // Shape outline ±(8, 6) grown by the 2' overhang → ±(10, 8).
  const xs = roof.points.map(p => Math.abs(p.x));
  const zs = roof.points.map(p => Math.abs(p.z));
  xs.forEach(x => expect(x).toBeGreaterThan(9.5));
  zs.forEach(z => expect(z).toBeGreaterThan(7.5));

  // The source shape stays untouched at the wall line.
  const shape = saved.shapes[0];
  expect(shape.points).toHaveLength(4);
  shape.points.forEach(p => {
    expect(Math.abs(p.x)).toBeLessThan(8.5);
    expect(Math.abs(p.z)).toBeLessThan(6.5);
  });
});

test('an L-shaped footprint gets a ridge inside and no guide outside', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'ROOF');

  // L-shape: bar z∈[-8,0] × x∈[-10,10] plus wing x∈[-10,0] × z∈[0,8].
  await h.selectTool(page, 'Shape');
  await h.clickWorld(page, -10, -8);
  await h.clickWorld(page, 10, -8);
  await h.clickWorld(page, 10, 0);
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 0, 8);
  await h.clickWorld(page, -10, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Roof');
  await page.getByRole('button', { name: 'FROM SHAPE', exact: true }).click();
  await page.getByRole('button', { name: 'BUILD FROM SHAPE' }).click();
  await h.waitForSaved(page);
  await page.waitForTimeout(400);

  // The bar's ridge runs along z=-4 (all-eave inset of the 12'-wide grown bar).
  const guideColor = [163, 112, 63];
  const onRidge = await h.worldToClient(page, 4, -4);
  expect(h.countColor(await h.overlayPixels(page, onRidge.x, onRidge.y), guideColor)).toBeGreaterThan(0);
  // The wing's ridge runs along x=-4.
  const onWingRidge = await h.worldToClient(page, -4, 4);
  expect(h.countColor(await h.overlayPixels(page, onWingRidge.x, onWingRidge.y), guideColor)).toBeGreaterThan(0);
  // The old skeleton shot a stray guide out past the footprint on L-shapes.
  const outside = await h.worldToClient(page, 18, -4);
  expect(h.countColor(await h.overlayPixels(page, outside.x, outside.y), guideColor)).toBe(0);
});

test('a roof survives a reload', async ({ page }) => {
  await h.openModel(page);
  await drawBasicRoof(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  const roof = (await h.savedDrawing(page)).roofs[0];
  expect(roof.points).toHaveLength(4);
  expect(roof.layer).toBe('A-ROOF');
});

test('PORK CHOP builds gable edges at half the eave overhang (board #252)', async ({ page }) => {
  await h.openModel(page);
  await page.evaluate(() => {
    const m = window.DraftProfileManager;
    m.saveActive(m.createPackage('standards', 'test', { model: { structureStandards: { gableCorner: 'porkchop' } } }));
  });
  await page.reload();
  await h.waitForModelReady(page);

  // The tour authors the gable as roof INTENT, so the bone derives the
  // footprint with the halved gable offset.
  await page.locator('[data-select-house]').click();
  await page.keyboard.press('Enter');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await page.locator('[data-tour-popup]').click(); // FOUNDATION DONE → MAIN
  // The stair runs along the 16' axis: this house is only 12' deep, and a
  // 10'-10" run does not fit across that once a wall assembly comes off
  // each side, so the app now refuses it. The stair is scaffolding to
  // light the MAIN gate here, not the subject of the test.
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, -2, 2);
  await h.clickWorld(page, 4, 2);
  await h.waitForSaved(page);
  await page.keyboard.press('Enter'); // the lit gate opens the climb popup
  // Tolerant of the rooms pause (#198): older flows offer STRAIGHT TO ROOF
  // on this popup, newer ones one popup later.
  const nextRoof = page.locator('[data-tour-popup] [data-tour-next-roof]');
  if (!(await nextRoof.count())) {
    await page.locator('[data-tour-popup]').click();
    await page.keyboard.press('Enter');
  }
  await nextRoof.click();
  await expect(page.locator('[data-tour-gable]')).toBeVisible();

  // Flip the south edge GABLE (its tag floats outside the preview line),
  // then the bone builds the roof.
  await h.clickWorld(page, 0, -9.4);
  await h.waitForSaved(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const roof = saved.roofs[0];
  // South gable edge: 1' out (half the 2' eaves) — every eave keeps 2'.
  expect(Math.min(...roof.points.map(point => point.z))).toBeCloseTo(-7, 1);
  expect(Math.max(...roof.points.map(point => point.z))).toBeCloseTo(8, 1);
  expect(Math.min(...roof.points.map(point => point.x))).toBeCloseTo(-10, 1);
  expect(Math.max(...roof.points.map(point => point.x))).toBeCloseTo(10, 1);
});
