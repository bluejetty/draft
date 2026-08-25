// The left rail is a keypad: square tool keys four to a row, the command
// letter in the upper-left corner (re-read from SETTINGS remaps) and the tool
// name in squint-size type. The contextual tool-options strip lives in the
// sidebar under the keypad; the top bar keeps only the file controls.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test('tool keys sit four to a row and stay square', async ({ page }) => {
  await h.openModel(page);
  const keys = page.locator('[data-model-left] .tool-keypad').first().locator('.tool-key');
  const boxes = [];
  for (let i = 0; i < 5; i++) boxes.push(await keys.nth(i).boundingBox());

  // First four share a row, the fifth wraps.
  for (let i = 1; i < 4; i++) expect(Math.abs(boxes[i].y - boxes[0].y)).toBeLessThan(2);
  expect(boxes[4].y).toBeGreaterThan(boxes[0].y + boxes[0].height / 2);

  for (const box of boxes) expect(Math.abs(box.width - box.height)).toBeLessThan(2);
});

test('each key wears its command letter and a squint-size name', async ({ page }) => {
  await h.openModel(page);
  const trim = page.locator('.tool-key', { has: page.locator('.tool-key-name', { hasText: /^Trim$/i }) });
  await expect(trim.locator('.tool-key-letter')).toHaveText('Q');

  const sizes = await trim.evaluate(el => ({
    letter: parseFloat(getComputedStyle(el.querySelector('.tool-key-letter')).fontSize),
    name: parseFloat(getComputedStyle(el.querySelector('.tool-key-name')).fontSize),
  }));
  expect(sizes.letter).toBeGreaterThan(sizes.name);
  expect(sizes.name).toBeLessThan(8);
});

test('the tool options strip lives in the sidebar under the keypad', async ({ page }) => {
  await h.openModel(page);
  const strip = page.locator('[data-tool-strip]');
  await expect(strip).toHaveCount(1);
  await expect(page.locator('[data-model-left] [data-tool-strip]')).toBeVisible();

  const keypad = await page.locator('[data-model-left] .tool-keypad').last().boundingBox();
  const stripBox = await strip.boundingBox();
  expect(stripBox.y).toBeGreaterThan(keypad.y + keypad.height - 2);

  // Selecting from the keypad drives the strip like always.
  await h.selectTool(page, 'Wall');
  await expect(strip.getByText('Wall Type')).toBeVisible();
});

test('the top bar keeps the file controls and nothing else moved up', async ({ page }) => {
  await h.openModel(page);
  for (const name of ['NEW', 'OPEN', 'SAVE', 'PROJECT', 'SETTINGS']) {
    await expect(page.getByRole('button', { name, exact: true }).first()).toBeVisible();
  }
});
