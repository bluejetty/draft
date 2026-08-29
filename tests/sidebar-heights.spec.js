// The right rail keeps each layer set's standards list tucked away: clicking
// the set's button reveals it and it hides itself again after a minute. The
// freed space beside each level title shows key construction heights, measured
// from a 0' datum at the top of the main-floor sheathing (switchable to 100').
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

  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'WALL PLAN', exact: true }).click();
  await expect(page.locator('.level-layer-content').first()).toBeVisible();

  await fastForward(page, 61_000);
  await expect(page.locator('.level-layer-content')).toHaveCount(0);
});

test('switching layer sets moves the revealed list and restarts the timer', async ({ page }) => {
  await page.clock.install();
  await h.openModel(page);

  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'WALL PLAN', exact: true }).click();
  await fastForward(page, 40_000);
  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'FLOOR PLAN', exact: true }).click();
  await expect(levelRow(page, 'MAIN FL').locator('.level-layer-content').first()).toBeVisible();

  // The earlier click's timer must not hide the newly revealed set.
  await fastForward(page, 40_000);
  await expect(page.locator('.level-layer-content').first()).toBeVisible();
  await fastForward(page, 30_000);
  await expect(page.locator('.level-layer-content')).toHaveCount(0);
});

test('level cards draw the floor profile with heights on its border lines', async ({ page }) => {
  await h.openModel(page);

  // MAIN FL: sheathing top is the 0' datum; the floor bottom (top of
  // foundation) sits one default floor assembly below it (11 7/8 + 3/4).
  const main = levelRow(page, 'MAIN FL');
  await expect(main.locator('.level-edge-val').nth(0)).toHaveText(`0'-0"`);
  await expect(main.locator('.level-edge-val').nth(1)).toHaveText(`-1'-0 5/8"`);

  // 2ND FL: floor bottom = main wall top; sheathing = wall top + floor.
  const second = levelRow(page, '2ND FL');
  await expect(second.locator('.level-edge-val').nth(0)).toHaveText(`+9'-1 3/4"`);
  await expect(second.locator('.level-edge-val').nth(1)).toHaveText(`+8'-1 1/8"`);

  // FOUNDATION: the border line above the FOUNDATION box is the bottom of
  // the wall (top of footing) — one default wall below the main-floor bottom
  // — the line below runs a footing (8") deeper, and the unlabeled
  // top-of-slab number floats 3" above without a line.
  const fdn = levelRow(page, 'FOUNDATION');
  await expect(fdn.locator('.level-edge[title^="Bottom of foundation wall"] .level-edge-val')).toHaveText(`-9'-1 3/4"`);
  await expect(fdn.locator('.level-edge-edit[title^="Base of footing"]')).toHaveText(`-9'-9 3/4"`);
  await expect(fdn.locator('.level-edge-edit[title^="Top of slab"]')).toHaveText(`-8'-10 3/4"`);

  // ROOF: its bottom line is the 2nd-floor top of wall, where trusses bear.
  const roof = levelRow(page, 'ROOF');
  await expect(roof.locator('.level-edge-val')).toHaveText(`+17'-2 7/8"`);
});

test('clicking the top-of-slab number edits the slab thickness', async ({ page }) => {
  await h.openModel(page);
  const fdn = levelRow(page, 'FOUNDATION');

  await fdn.locator('.level-edge-edit[title^="Top of slab"]').click();
  await expect(fdn.locator('.assembly-label')).toHaveText('SLAB');
  const input = fdn.locator('.assembly-input');
  await expect(input).toHaveValue('3"');
  await input.fill('4');
  await input.press('Enter');
  await expect(fdn.locator('.level-assembly-editor')).toHaveCount(0);

  // The slab top rides up an inch; the wall-bottom mark stays put.
  await expect(fdn.locator('.level-edge-edit[title^="Top of slab"]')).toHaveText(`-8'-9 3/4"`);
  await expect(fdn.locator('.level-edge[title^="Bottom of foundation wall"] .level-edge-val')).toHaveText(`-9'-1 3/4"`);

  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).levelAssemblies['1'].slabThicknessIn).toBe(4);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  await expect(levelRow(page, 'FOUNDATION').locator('.level-edge-edit[title^="Top of slab"]')).toHaveText(`-8'-9 3/4"`);
});

test('clicking the base-of-footing number edits the footing depth', async ({ page }) => {
  await h.openModel(page);
  const fdn = levelRow(page, 'FOUNDATION');

  await fdn.locator('.level-edge-edit[title^="Base of footing"]').click();
  await expect(fdn.locator('.assembly-label')).toHaveText('FTG DP');
  const input = fdn.locator('.assembly-input');
  await expect(input).toHaveValue('8"');
  await input.fill('10');
  await input.press('Enter');
  await expect(fdn.locator('.level-assembly-editor')).toHaveCount(0);

  // The excavation drops 2"; the wall bottom above stays put.
  await expect(fdn.locator('.level-edge-edit[title^="Base of footing"]')).toHaveText(`-9'-11 3/4"`);
  await expect(fdn.locator('.level-edge[title^="Bottom of foundation wall"] .level-edge-val')).toHaveText(`-9'-1 3/4"`);

  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).levelAssemblies['1'].footingDepthIn).toBe(10);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  await expect(levelRow(page, 'FOUNDATION').locator('.level-edge-edit[title^="Base of footing"]')).toHaveText(`-9'-11 3/4"`);
});

test('the datum toggle shifts every mark by 100 feet and persists', async ({ page }) => {
  await h.openModel(page);

  await page.getByRole('button', { name: "DATUM 0'" }).click();
  await expect(page.getByRole('button', { name: "DATUM 100'" })).toBeVisible();

  const main = levelRow(page, 'MAIN FL');
  await expect(main.locator('.level-edge-val').nth(0)).toHaveText(`100'-0"`);
  const fdn = levelRow(page, 'FOUNDATION');
  await expect(fdn.locator('.level-edge[title^="Bottom of foundation wall"] .level-edge-val')).toHaveText(`90'-10 1/4"`);

  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).elevationDatum).toBe(100);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);
  await expect(page.getByRole('button', { name: "DATUM 100'" })).toBeVisible();
});

test('grey summaries show the wall height and total floor thickness beside their rows', async ({ page }) => {
  await h.openModel(page);
  const main = levelRow(page, 'MAIN FL');

  // WALL PLAN carries the wall height; FLOOR PLAN carries the total floor
  // thickness (11 7/8" joists + 3/4" sheathing). No entry boxes on the card.
  const summaries = main.locator('.level-assembly-summary');
  await expect(summaries).toHaveCount(2);
  await expect(summaries.nth(0)).toHaveText(`8'-1 1/8"`);
  await expect(summaries.nth(1)).toHaveText(`1'-0 5/8"`);
  await expect(main.locator('.level-assembly-val')).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'WALL HT' })).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'FL JST' })).toHaveCount(0);
});

test('tapping a summary value goes to the PROJECT page where it changes', async ({ page }) => {
  await h.openModel(page);

  await levelRow(page, 'MAIN FL').locator('.level-assembly-summary').first().click();
  await page.waitForURL('**/PROJECT.html');
});

test('the foundation card keeps base of footing but drops the footing width', async ({ page }) => {
  await h.openModel(page);
  const fdn = levelRow(page, 'FOUNDATION');

  await expect(fdn.locator('.level-edge-edit[title^="Base of footing"]')).toHaveCount(1);
  await expect(fdn.locator('.level-edge-edit[title^="Footing width"]')).toHaveCount(0);

  // Top of slab reads right-aligned directly above the base-of-footing line.
  const marks = fdn.locator('.level-edge-edit');
  await expect(marks.nth(0)).toHaveText(`-8'-10 3/4"`);   // top of slab, no line
  await expect(marks.nth(1)).toHaveText(`-9'-9 3/4"`);    // base of footing, on the line
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
