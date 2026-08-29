// The tour's ROOF pause + finale (board #238): the preview footprint with
// E/G tags and pull-out-only edges, the explicit GABLE mode with anchors
// harvested from the floors below, increments counted from the building
// corner, and the finish — ROOF DONE only hints, the drafter presses the
// real bone, and the house grows out of the ground in the front elevation.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function traceHouse(page, w, d) {
  await page.locator('[data-select-house]').click();
  await page.keyboard.press('Enter');
  await h.clickWorld(page, -w / 2, -d / 2);
  await h.clickWorld(page, w / 2, -d / 2);
  await h.clickWorld(page, w / 2, d / 2);
  await h.clickWorld(page, -w / 2, d / 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function reachRoof(page, w, d, beforeStairs) {
  await traceHouse(page, w, d);
  await page.locator('[data-tour-popup]').click(); // FOUNDATION DONE → MAIN
  if (beforeStairs) await beforeStairs();
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, 2, -2);
  await h.clickWorld(page, 2, 4);
  await h.waitForSaved(page);
  await page.keyboard.press('Enter'); // the lit gate opens MAIN FLOOR DONE
  await page.locator('[data-tour-popup]').click(); // → the rooms pause (#198)
  await page.keyboard.press('Enter'); // the always-lit rooms gate
  await page.locator('[data-tour-popup] [data-tour-next-roof]').click();
  await expect(page.locator('[data-tour-gable]')).toBeVisible();
}

test('the E/G tag flips a whole edge and the bone frames it — no reveal mid-tour', async ({ page }) => {
  await h.openModel(page);
  await reachRoof(page, 16, 12);

  // The bottom edge's tag floats outside its preview line (overhang 2' + 1.4').
  await h.clickWorld(page, 0, -9.4);
  await h.waitForSaved(page);
  let saved = await h.savedDrawing(page);
  expect(saved.roofIntent.edges).toHaveLength(1);
  expect(saved.roofIntent.edges[0].kind).toBe('gable');

  // Bone pressed BEFORE the finale: builds normally, ends the tour, no jump.
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.tour.step).toBe(null);
  expect(saved.roofs[0].edges[0]).toBe('gable');
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/ROOF/);
});

test('GABLE places on the corner-counted grid, the chip drops to 6", and the bone splits the edge', async ({ page }) => {
  await h.openModel(page);
  await reachRoof(page, 28, 24);

  await page.locator('[data-tour-gable]').click();
  // Preview bottom edge rides at z = -14; 19.3' from the corner snaps to 19'.
  await h.clickWorld(page, 5.3, -14);
  await h.waitForSaved(page);
  await expect(page.locator('[data-model-drawing-message]')).toContainText(/Wall lengthens/);
  let saved = await h.savedDrawing(page);
  expect(saved.roofIntent.gables).toHaveLength(1);
  expect(saved.roofIntent.gables[0].centerFt).toBeCloseTo(19, 5);
  expect(saved.roofIntent.gables[0].widthFt).toBeCloseTo(8, 5);

  // The chip cycles the resting grid: 1' → 6" — 7.3' now snaps to 7.5'.
  await page.locator('[data-tour-increment]').click();
  await expect(page.locator('[data-tour-increment]')).toHaveText('6"');
  await h.clickWorld(page, -6.7, -14);
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.roofIntent.gables).toHaveLength(2);
  expect(saved.roofIntent.gables[1].centerFt).toBeCloseTo(7.5, 5);

  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  const roof = saved.roofs[0];
  expect(roof.points).toHaveLength(8); // 4 corners + 2 split points per gable
  expect(roof.edges.filter(kind => kind === 'gable')).toHaveLength(2);
});

test('a window below becomes a labeled anchor and the gable centers on it', async ({ page }) => {
  await h.openModel(page);
  await reachRoof(page, 28, 24, async () => {
    // Free-form on MAIN: a wall along the south outline with a window at x=6.
    await h.selectTool(page, 'Wall');
    await h.clickWorld(page, -14, -12);
    await h.clickWorld(page, 14, -12);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    await h.selectTool(page, 'Fenestration');
    await page.getByRole('button', { name: 'WINDOW', exact: true }).click();
    await h.clickWorld(page, 6, -12);
    await h.waitForSaved(page);
  });

  await page.locator('[data-tour-gable]').click();
  // 20.4' from the corner falls inside the W anchor's capture at t = 20.
  await h.clickWorld(page, 6.4, -14);
  await h.waitForSaved(page);
  await expect(page.locator('[data-model-drawing-message]')).toContainText(/centered on W 1/);
  const saved = await h.savedDrawing(page);
  expect(saved.roofIntent.gables[0].centerFt).toBeCloseTo(20, 5);
  const window0 = saved.fenestrations.find(opening => opening.type === 'window');
  expect(saved.roofIntent.gables[0].widthFt).toBeCloseTo(window0.width + 2, 5);
});

test('edges pull OUT on the grid and refuse to tuck back under the house', async ({ page }) => {
  await h.openModel(page);
  await reachRoof(page, 16, 12);

  // Drag the bottom preview edge (z=-8) out to 3' of overhang.
  let from = await h.worldToClient(page, 0, -8);
  let to = await h.worldToClient(page, 0, -9.3);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await h.waitForSaved(page);
  let saved = await h.savedDrawing(page);
  expect(saved.roofIntent.edges).toHaveLength(1);
  expect(saved.roofIntent.edges[0].overhangFt).toBeCloseTo(3, 5);

  // Dragging back inside the base overhang floors at the house default (2').
  from = await h.worldToClient(page, 0, -9);
  to = await h.worldToClient(page, 0, -6.6);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.roofIntent.edges[0].overhangFt).toBeCloseTo(2, 5);
});

test('PRESS ▲ BONE hints, the bone glows, and the press grows the house in the front elevation', async ({ page }) => {
  await h.openModel(page);
  await reachRoof(page, 16, 12);

  // The under-bone button reads PRESS ▲ BONE from the roof pause on.
  await expect(page.locator('[data-tour-next]')).toContainText('PRESS');
  await expect(page.locator('[data-tour-next]')).toContainText('BONE');
  await page.locator('[data-tour-next]').click();
  const popup = page.locator('[data-tour-popup]');
  await expect(popup).toContainText('ROOF DONE');
  await expect(popup).toContainText(/press the BONE/i);
  await page.keyboard.press('Enter');
  await expect(popup).toBeHidden();
  await expect(page.locator('[data-tour-next]')).toContainText('BONE');
  const boneStyle = await page.locator('[data-build-house]').getAttribute('style');
  expect(boneStyle).toContain('drop-shadow');

  await page.locator('[data-build-house]').click();
  // The view jumps to the front elevation and the house grows bottom-to-top.
  // The finale slides both rails open (which tucks the thumb wall away), so
  // E1 lights up on the LEVELS panel's cut row.
  await expect(page.locator('.cut-row.active')).toContainText('E1');
  await page.waitForTimeout(4300); // 1s curtain hold + the ~2.5s reveal
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.tour.step).toBe(null);
  expect(saved.walls.length).toBeGreaterThan(0);
  expect(saved.roofs.length).toBeGreaterThan(0);
});
