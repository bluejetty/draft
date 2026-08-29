// The rising reveal on every bone press (board #283): any BUILD HOUSE press
// that grows the house jumps to the E1 front elevation and the house climbs
// out of the ground — no longer only the tour finale. A press that builds
// nothing stays on the plan, and the BONE REVEAL setting turns the jump off.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function traceHouse(page) {
  await page.locator('[data-select-house]').click();
  await page.keyboard.press('Enter');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
}

async function backToPlan(page) {
  await page.locator('.level-row', { hasText: 'MAIN FL' }).locator('.level-body').click();
  await page.waitForTimeout(300);
  await expect(page.locator('[data-model-title-detail]').last()).not.toHaveText('E1');
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/MAIN/);
}

test('a regular bone press reveals in E1 and hands back SELECT', async ({ page }) => {
  await h.openModel(page, { boneReveal: true });
  await traceHouse(page);

  await page.locator('[data-build-house]').click();
  // The build jumps straight to the front elevation with both rails open.
  await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');
  await expect(page.locator('[data-model-left]')).toBeVisible();
  await expect(page.locator('[data-model-right]')).toBeVisible();
  await page.waitForTimeout(4300); // 1s curtain hold + the ~2.5s reveal
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.walls.length).toBeGreaterThan(0);
  // The reveal parks the drafter in E1 with the drawing tools stood down.
  const active = await h.activeToolLabels(page);
  expect(active.join(' ')).toMatch(/SELECT/i);
});

test('a press that builds nothing stays on the plan; a rebuild reveals again', async ({ page }) => {
  await h.openModel(page, { boneReveal: true });
  await traceHouse(page);

  await page.locator('[data-build-house]').click();
  await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');
  await page.waitForTimeout(4300);
  await h.waitForSaved(page);
  await backToPlan(page);

  // Nothing changed — the bone has nothing to grow, so no curtain moment.
  await page.locator('[data-build-house]').click();
  await page.waitForTimeout(600);
  await expect(page.locator('[data-model-title-detail]').last()).not.toHaveText('E1');
  await expect(page.locator('[data-model-drawing-message]')).toContainText(/already has its shell/i);

  // Level rebuilds only start from a bare level, so window-select every MAIN
  // wall with the WALL filter engaged, delete them, and press again: the
  // rebuild grows the shell back — reveal again.
  await h.selectTool(page, 'Select');
  await page.getByRole('button', { name: 'Grab only walls' }).click();
  const a = await h.worldToClient(page, -10, -8);
  const b = await h.worldToClient(page, 10, 8);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2);
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);
  await page.locator('[data-build-house]').click();
  await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');
});

test('BONE REVEAL off keeps the build on the plan', async ({ page }) => {
  await h.openModel(page); // the suite seed: reveal off
  await traceHouse(page);

  await page.locator('[data-build-house]').click();
  await page.waitForTimeout(600);
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.walls.length).toBeGreaterThan(0);
  await expect(page.locator('[data-model-title-detail]').last()).not.toHaveText('E1');
});
