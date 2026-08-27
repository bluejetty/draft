// The select-first button strip (#226): the type buttons live centered on
// the top bar — HOUSE · BONE · DETACHED at first, growing SPLIT and ATTACHED
// once a house outline exists (those two need a house to attach to). The
// drafter picks the type, traces the outline in the button's colour, and the
// red bone builds it. The bone never arms a trace on its own.
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

test('strip starts as HOUSE · BONE · DETACHED; SPLIT and ATTACHED wait for a house', async ({ page }) => {
  await h.openModel(page);

  const cluster = page.locator('[data-build-cluster]');
  await expect(cluster.locator('[data-select-house]')).toBeVisible();
  await expect(cluster.locator('[data-build-house]')).toBeVisible();
  await expect(cluster.locator('[data-mark-detached-garage]')).toBeVisible();
  await expect(cluster.locator('[data-select-split]')).toHaveCount(0);
  await expect(cluster.locator('[data-mark-attached-garage]')).toHaveCount(0);

  // No OUTLINE key on the keypad — the type buttons arm the trace.
  await expect(page.locator('.tool-key', { hasText: /outline/i })).toHaveCount(0);

  // No BUILD GARAGE below — the strip carries only drafting instruments.
  await expect(page.locator('[data-build-garage]')).toHaveCount(0);
});

test('a house outline unlocks SPLIT and ATTACHED, and they survive a reload', async ({ page }) => {
  await h.openModel(page);

  await page.locator('[data-select-house]').click();
  await page.keyboard.press('Enter'); // past PROFESSOR GRUFF
  await traceRect(page);

  const cluster = page.locator('[data-build-cluster]');
  await expect(cluster.locator('[data-select-split]')).toBeVisible();
  await expect(cluster.locator('[data-mark-attached-garage]')).toBeVisible();

  await page.reload();
  await h.waitForModelReady(page);
  await expect(cluster.locator('[data-select-split]')).toBeVisible();
  await expect(cluster.locator('[data-mark-attached-garage]')).toBeVisible();
});

test('bone with nothing drawn coaches instead of building', async ({ page }) => {
  await h.openModel(page);

  await page.locator('[data-build-house]').click();
  await expect(page.getByText(/Nothing to build yet/)).toBeVisible();

  const saved = await h.savedDrawing(page);
  expect(saved?.walls?.length ?? 0).toBe(0);
});

test('HOUSE press arms the trace and PROFESSOR GRUFF points at PROJECT; Escape opens it', async ({ page }) => {
  await h.openModel(page);
  await page.locator('[data-select-house]').click();

  await expect(page.locator('[data-project-callout]')).toBeVisible();
  await expect(page.getByText('Professor Gruff')).toBeVisible();
  await expect(page.getByText(/HOUSE — trace the outline/)).toBeVisible();

  // PROJECT lives on its own page now — Escape heads there.
  await page.keyboard.press('Escape');
  await page.waitForURL(/PROJECT\.html/);
  await expect(page.locator('[data-project-name]')).toBeVisible();
});

test('select HOUSE, trace, bone builds the house', async ({ page }) => {
  await h.openModel(page);

  await page.locator('[data-select-house]').click();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-project-callout]')).toBeHidden();

  await traceRect(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.walls.length).toBeGreaterThan(0);
  expect(saved.roofs.length).toBeGreaterThan(0);
});

test("don't show this again survives a reload", async ({ page }) => {
  await h.openModel(page);
  await page.locator('[data-select-house]').click();
  await expect(page.locator('[data-project-callout]')).toBeVisible();

  await page.locator('[data-callout-off]').check();
  await page.locator('[data-callout-continue]').click();
  await expect(page.locator('[data-project-callout]')).toBeHidden();

  await page.reload();
  await h.waitForModelReady(page);
  await page.locator('[data-select-house]').click();
  await expect(page.getByText(/HOUSE — trace the outline/)).toBeVisible();
  await expect(page.locator('[data-project-callout]')).toBeHidden();
});

test('DETACHED arms its trace from the default tool; live trace wears the purple', async ({ page }) => {
  await h.openModel(page);

  await page.locator('[data-mark-detached-garage]').click();
  await expect(page.getByText(/DETACHED GARAGE — draw its own loop/)).toBeVisible();

  await h.clickWorld(page, -6, -4);
  await h.clickWorld(page, 6, -4);
  await h.moveTo(page, 6, 4);
  const probe = await h.worldToClient(page, 0, -4);
  const pixels = await h.overlayPixels(page, probe.x, probe.y);
  expect(h.countColor(pixels, [125, 91, 166])).toBeGreaterThan(0); // #7d5ba6
  await page.keyboard.press('Escape');
});

test('HOUSE trace draws in the button red', async ({ page }) => {
  await h.openModel(page);

  await page.locator('[data-select-house]').click();
  await page.keyboard.press('Enter');

  await h.clickWorld(page, -6, -4);
  await h.clickWorld(page, 6, -4);
  await h.moveTo(page, 6, 4);
  const probe = await h.worldToClient(page, 0, -4);
  const pixels = await h.overlayPixels(page, probe.x, probe.y);
  expect(h.countColor(pixels, [192, 57, 43])).toBeGreaterThan(0); // #c0392b
  await page.keyboard.press('Escape');
});
