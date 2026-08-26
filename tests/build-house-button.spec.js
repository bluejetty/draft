// The red BUILD HOUSE bone button (#211): center-bottom on the instrument
// strip, it is the product's one big action. On a blank drawing it arms the
// outline trace with the project defaults and PROFESSOR RUFF points at the
// PROJECT button; with an outline on the shelf it grows the house. The
// OUTLINE key is gone from the keypad — the U shortcut and the garage marks
// arm the tool now.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function traceRect(page) {
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('red bone button sits on the instrument strip; OUTLINE key left the keypad', async ({ page }) => {
  await h.openModel(page);

  const button = page.locator('[data-build-house]');
  await expect(button).toBeVisible();
  await expect(button).toHaveText(/BUILD\s*HOUSE/);
  await expect(button).toHaveCSS('background-color', 'rgb(192, 57, 43)');
  await expect(button.locator('[data-build-house-bone]')).toBeVisible();

  // The button lives on the bottom instrument strip.
  await expect(page.locator('[data-instrument-strip] [data-build-house]')).toBeVisible();

  // No OUTLINE key on the keypad anymore.
  await expect(page.locator('.tool-key', { hasText: /outline/i })).toHaveCount(0);

  // The garage marks moved to the strip beside the bone.
  await expect(page.locator('[data-instrument-strip] [data-mark-attached-garage]')).toBeVisible();
  await expect(page.locator('[data-instrument-strip] [data-mark-detached-garage]')).toBeVisible();
  await expect(page.locator('[data-instrument-strip] [data-build-garage]')).toBeVisible();
});

test('first press arms the trace and PROFESSOR RUFF points at PROJECT; Escape opens it', async ({ page }) => {
  await h.openModel(page);
  await page.locator('[data-build-house]').click();

  await expect(page.locator('[data-project-callout]')).toBeVisible();
  await expect(page.getByText('Professor Ruff')).toBeVisible();
  await expect(page.getByText(/default project settings/)).toBeVisible();
  await expect(page.getByText('Trace the house outline')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-project-callout]')).toBeHidden();
  await expect(page.locator('[data-project-dialog]')).toBeVisible();
});

test('Enter dismisses the callout and the trace then bone press builds the house', async ({ page }) => {
  await h.openModel(page);
  await page.locator('[data-build-house]').click();
  await expect(page.locator('[data-project-callout]')).toBeVisible();

  await page.keyboard.press('Enter');
  await expect(page.locator('[data-project-callout]')).toBeHidden();

  // The outline tool is already armed — trace the house and press the bone.
  await traceRect(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.walls.length).toBeGreaterThan(0);
  expect(saved.roofs.length).toBeGreaterThan(0);
});

test("don't show this again survives a reload", async ({ page }) => {
  await h.openModel(page);
  await page.locator('[data-build-house]').click();
  await expect(page.locator('[data-project-callout]')).toBeVisible();

  await page.locator('[data-callout-off]').check();
  await page.locator('[data-callout-continue]').click();
  await expect(page.locator('[data-project-callout]')).toBeHidden();

  await page.reload();
  await h.waitForModelReady(page);
  await page.locator('[data-build-house]').click();
  await expect(page.getByText('Trace the house outline')).toBeVisible();
  await expect(page.locator('[data-project-callout]')).toBeHidden();
});

test('garage marks arm the outline tool from any tool', async ({ page }) => {
  await h.openModel(page);

  // From the default Select tool, DETACHED arms the trace by itself.
  await page.locator('[data-mark-detached-garage]').click();
  await expect(page.getByText(/DETACHED GARAGE — draw its own loop/)).toBeVisible();

  // ATTACHED still insists on a house first.
  await page.locator('[data-mark-detached-garage]').click(); // cancel
  await page.locator('[data-mark-attached-garage]').click();
  await expect(page.getByText(/Draw the house OUTLINE first/)).toBeVisible();
});
