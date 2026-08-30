// The right rail keeps each layer set's standards list tucked away: clicking
// the set's button reveals it and it hides itself again after a minute. The
// level cards carry no height numbers — PROJECT holds the values and the
// on-screen elevation border lines show them live (#291).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function switchLevel(page, name) {
  await levelRow(page, name).locator('.level-name').click();
  await page.waitForTimeout(300);
}

// clock.fastForward occasionally no-ops (the fake clock reports ~0ms of
// travel), so keep nudging until the page really saw the time pass.
async function fastForward(page, ms) {
  const target = (await page.evaluate(() => Date.now())) + ms;
  for (let i = 0; i < 20; i++) {
    const now = await page.evaluate(() => Date.now());
    if (now >= target) return;
    await page.clock.fastForward(target - now);
  }
  throw new Error(`clock refused to advance ${ms}ms`);
}

test('layer standards stay hidden until their set is clicked, then hide after a minute', async ({ page }) => {
  await page.clock.install();
  await h.openModel(page);

  await expect(page.locator('.level-layer-content')).toHaveCount(0);

  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'FLOOR PLAN (WALLS)', exact: true }).click();
  await expect(page.locator('.level-layer-content').first()).toBeVisible();

  await fastForward(page, 61_000);
  await expect(page.locator('.level-layer-content')).toHaveCount(0);
});

test('switching layer sets moves the revealed list and restarts the timer', async ({ page }) => {
  await page.clock.install();
  await h.openModel(page);

  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'FLOOR PLAN (WALLS)', exact: true }).click();
  await fastForward(page, 40_000);
  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'FLOOR LAYOUT (FLOOR)', exact: true }).click();
  await expect(levelRow(page, 'MAIN FL').locator('.level-layer-content').first()).toBeVisible();

  // The earlier click's timer must not hide the newly revealed set.
  await fastForward(page, 40_000);
  await expect(page.locator('.level-layer-content').first()).toBeVisible();
  await fastForward(page, 30_000);
  await expect(page.locator('.level-layer-content')).toHaveCount(0);
});

test('level cards carry no height numbers or inline editors', async ({ page }) => {
  await h.openModel(page);

  await expect(page.locator('.level-name').first()).toBeVisible();
  await expect(page.locator('.level-edge-val')).toHaveCount(0);
  await expect(page.locator('.level-edge-edit')).toHaveCount(0);
  await expect(page.locator('.level-assembly-summary')).toHaveCount(0);
  await expect(page.locator('.level-assembly-editor')).toHaveCount(0);
});

test('the datum toggle still switches and persists for the on-screen marks', async ({ page }) => {
  await h.openModel(page);

  await page.getByRole('button', { name: "DATUM 0'" }).click();
  await expect(page.getByRole('button', { name: "DATUM 100'" })).toBeVisible();

  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).elevationDatum).toBe(100);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  await expect(page.getByRole('button', { name: "DATUM 100'" })).toBeVisible();
});

test('both side rails start hidden and pull out from their tabs', async ({ page }) => {
  await h.openModel(page, { rails: false });

  await expect(page.locator('[data-model-left]')).toBeHidden();
  await expect(page.locator('[data-model-right]')).toBeHidden();

  const leftTab = page.locator('[data-left-rail-tab]');
  const rightTab = page.locator('[data-right-rail-tab]');
  await expect(leftTab).toBeVisible();
  await expect(rightTab).toBeVisible();

  await leftTab.click();
  await expect(page.locator('[data-model-left]')).toBeVisible();
  await rightTab.click();
  await expect(page.locator('[data-model-right]')).toBeVisible();

  // Both rails share the same 190px width.
  const rightWidth = await page.locator('[data-model-right]').evaluate(el => el.getBoundingClientRect().width);
  expect(rightWidth).toBeCloseTo(190, 0);
  const leftWidth = await page.locator('[data-model-left]').evaluate(el => el.getBoundingClientRect().width);
  expect(leftWidth).toBeCloseTo(190, 0);

  // The tabs tuck the rails back away.
  await leftTab.click();
  await expect(page.locator('[data-model-left]')).toBeHidden();
  await rightTab.click();
  await expect(page.locator('[data-model-right]')).toBeHidden();
});

test('the pull tabs run the full canvas height and wear the long labels', async ({ page }) => {
  await h.openModel(page, { rails: false });

  const leftTab = page.locator('[data-left-rail-tab]');
  const rightTab = page.locator('[data-right-rail-tab]');
  await expect(leftTab).toHaveText('ROUGHDRAFTER - LITE - DRAFTING TOOLS');
  await expect(rightTab).toHaveText('LEVELS - LAYERS');

  // Full-length tabs: each runs the whole canvas edge.
  const container = await page.locator('[data-model-container]').boundingBox();
  for (const tab of [leftTab, rightTab]) {
    const box = await tab.boundingBox();
    expect(box.height).toBeCloseTo(container.height, 0);
  }
});
