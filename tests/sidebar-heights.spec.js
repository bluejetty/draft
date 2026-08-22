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

  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'PLAN', exact: true }).click();
  await expect(page.locator('.level-layer-content').first()).toBeVisible();

  await fastForward(page, 61_000);
  await expect(page.locator('.level-layer-content')).toHaveCount(0);
});

test('switching layer sets moves the revealed list and restarts the timer', async ({ page }) => {
  await page.clock.install();
  await h.openModel(page);

  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'PLAN', exact: true }).click();
  await fastForward(page, 40_000);
  await levelRow(page, 'MAIN FL').getByRole('button', { name: 'FLOOR', exact: true }).click();
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
  await page.waitForTimeout(500);
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
  await page.waitForTimeout(500);
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
  await page.waitForTimeout(500);
  await expect(page.getByRole('button', { name: "DATUM 100'" })).toBeVisible();
});

test('WALL HEIGHT edits the level wall height and moves the marks above', async ({ page }) => {
  await h.openModel(page);
  const main = levelRow(page, 'MAIN FL');

  await main.getByRole('button', { name: 'WALL HT' }).click();
  const wallInput = main.locator('.assembly-input');
  await expect(wallInput).toHaveValue(`8'-1 1/8"`);
  await wallInput.fill(`9'`);
  await wallInput.press('Enter');
  await expect(main.locator('.level-assembly-editor')).toHaveCount(0);

  // The 2nd-floor border heights ride on the main-floor wall top.
  const second = levelRow(page, '2ND FL');
  await expect(second.locator('.level-edge-val').nth(1)).toHaveText(`+9'-0"`);
  await expect(second.locator('.level-edge-val').nth(0)).toHaveText(`+10'-0 5/8"`);

  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).levelAssemblies['3'].wallHeightFt).toBe(9);

  // The assembly survives a reload.
  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(levelRow(page, '2ND FL').locator('.level-edge-val').nth(1)).toHaveText(`+9'-0"`);
});

test('FLOOR JOISTS edits the assembly and recomputes the foundation top', async ({ page }) => {
  await h.openModel(page);
  const main = levelRow(page, 'MAIN FL');

  await main.getByRole('button', { name: 'FL JST' }).click();
  const editor = main.locator('.level-assembly-editor');
  await expect(editor.locator('.assembly-input').nth(0)).toHaveValue(`11 7/8"`);
  await expect(editor.locator('.assembly-input').nth(2)).toHaveValue(`3/4"`);

  // Conventional 2x10 pre-fills its 9 1/4" depth.
  await editor.getByRole('button', { name: '2x10' }).click();
  await expect(editor.locator('.assembly-input').nth(0)).toHaveValue(`9 1/4"`);
  await editor.locator('.assembly-input').nth(0).press('Enter');
  await expect(main.locator('.level-assembly-editor')).toHaveCount(0);

  // Floor is now 10" total, so the bottom line and the foundation wall
  // bottom (one default wall further down) follow.
  await expect(main.locator('.level-edge-val').nth(1)).toHaveText(`-0'-10"`);
  const fdn = levelRow(page, 'FOUNDATION');
  await expect(fdn.locator('.level-edge[title^="Bottom of foundation wall"] .level-edge-val')).toHaveText(`-8'-11 1/8"`);

  await h.waitForSaved(page);
  const saved = (await h.savedDrawing(page)).levelAssemblies['3'];
  expect(saved.joistType).toBe('conv_2x10');
  expect(saved.joistDepthIn).toBeCloseTo(9.25);
  expect(saved.sheathingIn).toBeCloseTo(0.75);
});

test('Space accepts the offered floor values until the user starts typing', async ({ page }) => {
  await h.openModel(page);
  const main = levelRow(page, 'MAIN FL');

  await main.getByRole('button', { name: 'FL JST' }).click();
  const editor = main.locator('.level-assembly-editor');
  await editor.locator('.assembly-input').nth(2).press(' ');
  await expect(main.locator('.level-assembly-editor')).toHaveCount(0);
  await expect(main.locator('.level-edge-val').nth(1)).toHaveText(`-1'-0 5/8"`);

  // After typing, Space is a character again and Enter commits.
  await main.getByRole('button', { name: 'FL JST' }).click();
  const spacing = editor.locator('.assembly-input').nth(1);
  await spacing.fill('19.2');
  await spacing.press(' ');
  await expect(main.locator('.level-assembly-editor')).toHaveCount(1);
  await spacing.press('Enter');
  await expect(main.locator('.level-assembly-editor')).toHaveCount(0);

  await h.waitForSaved(page);
  // Stored lengths snap to the nearest 1/16".
  expect((await h.savedDrawing(page)).levelAssemblies['3'].joistSpacingIn).toBeCloseTo(19.1875);
});
