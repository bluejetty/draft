// The select-first button strip (#226, the house types NEW-5): the type
// buttons live centered on the top bar — BUNGALOW · 2 STOREY · BILEVEL ·
// MODIFIED BILEVEL · BONE · DETACHED at first, growing ATTACHED once a house
// outline exists (it needs a house to attach to). The drafter picks the
// type, which the drawing remembers, traces the outline in the type's red,
// and the red bone builds it. The bone never arms a trace on its own.
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

test('strip starts as the four house types · BONE · DETACHED; ATTACHED waits for a house', async ({ page }) => {
  await h.openModel(page);

  const cluster = page.locator('[data-build-cluster]');
  // Movie's words, in his order: "BUNGALOW / 2 STOREY / BILEVEL / MODIFIED
  // BILEVEL / DETACHED GARAGE (first) then after the house add in ATTACHED".
  await expect(cluster.locator('[data-select-build]')).toHaveText(['BUNGALOW', '2 STOREY', 'BILEVEL', 'MODIFIED BILEVEL']);
  await expect(cluster.locator('[data-build-house]')).toBeVisible();
  await expect(cluster.locator('[data-mark-detached-garage]')).toBeVisible();
  await expect(cluster.locator('[data-mark-attached-garage]')).toHaveCount(0);

  // No OUTLINE key on the keypad — the type buttons arm the trace.
  await expect(page.locator('.tool-key', { hasText: /outline/i })).toHaveCount(0);

  // No BUILD GARAGE below — the strip carries only drafting instruments.
  await expect(page.locator('[data-build-garage]')).toHaveCount(0);
});

test('a house outline unlocks ATTACHED, and it survives a reload', async ({ page }) => {
  await h.openModel(page);

  await page.locator('[data-select-build="bungalow"]').click();
  await page.keyboard.press('Enter'); // past PROFESSOR GRUFF
  await traceRect(page);

  const cluster = page.locator('[data-build-cluster]');
  await expect(cluster.locator('[data-mark-attached-garage]')).toBeVisible();

  await page.reload();
  await h.waitForModelReady(page);
  await expect(cluster.locator('[data-mark-attached-garage]')).toBeVisible();
});

test('a type press stores its type; it survives a reload and a NEW clears it', async ({ page }) => {
  await h.openModel(page);

  // Each button stores its own id — the persisted vocabulary, not the label.
  for (const [id, label] of [['bungalow', 'BUNGALOW'], ['twoStorey', '2 STOREY'],
    ['bilevel', 'BILEVEL'], ['modifiedBilevel', 'MODIFIED BILEVEL']]) {
    await page.locator(`[data-select-build="${id}"]`).click();
    if (id === 'bungalow') await page.keyboard.press('Enter'); // past PROFESSOR GRUFF, once
    await expect(page.locator('[data-model-drawing-message]')).toContainText(`${label} — trace the outline`);
    await h.waitForSaved(page);
    expect((await h.savedDrawing(page)).buildType).toBe(id);
  }

  await page.reload();
  await h.waitForModelReady(page);
  expect((await h.savedDrawing(page)).buildType).toBe('modifiedBilevel');

  await page.getByRole('button', { name: 'NEW', exact: true }).click();
  const dontSave = page.getByRole('button', { name: "DON'T SAVE" });
  if (await dontSave.count()) await dontSave.click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).buildType).toBeNull();
});

test('a type may change after the house is built, and the build does not move', async ({ page }) => {
  await h.openModel(page);

  await page.locator('[data-select-build="bungalow"]').click();
  await page.keyboard.press('Enter');
  await traceRect(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  const built = await h.savedDrawing(page);
  expect(built.buildType).toBe('bungalow');
  expect(built.walls.length).toBeGreaterThan(0);

  // The type is a label the bone does not read yet: BUILD HOUSE pours the
  // outline as drawn under every lamp, so changing it afterwards changes
  // the file's answer and nothing in the geometry.
  await page.locator('[data-select-build="twoStorey"]').click();
  await h.waitForSaved(page);
  const after = await h.savedDrawing(page);
  expect(after.buildType).toBe('twoStorey');
  expect(after.walls).toEqual(built.walls);
  expect(after.roofs).toEqual(built.roofs);
  expect(after.floors).toEqual(built.floors);
});

test('bone with nothing drawn coaches instead of building', async ({ page }) => {
  await h.openModel(page);

  await page.locator('[data-build-house]').click();
  await expect(page.getByText(/Nothing to build yet/)).toBeVisible();

  const saved = await h.savedDrawing(page);
  expect(saved?.walls?.length ?? 0).toBe(0);
});

test('a type press arms the trace and PROFESSOR GRUFF points at PROJECT; Escape opens it', async ({ page }) => {
  await h.openModel(page);
  await page.locator('[data-select-build="bungalow"]').click();

  await expect(page.locator('[data-project-callout]')).toBeVisible();
  await expect(page.getByText('Professor Gruff')).toBeVisible();
  await expect(page.getByText(/BUNGALOW — trace the outline/)).toBeVisible();

  // PROJECT lives on its own page now — Escape heads there.
  await page.keyboard.press('Escape');
  await page.waitForURL(/PROJECT\.html/);
  await expect(page.locator('[data-project-name]')).toBeVisible();
});

test('select BUNGALOW, trace, bone builds the house', async ({ page }) => {
  await h.openModel(page);

  await page.locator('[data-select-build="bungalow"]').click();
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
  await page.locator('[data-select-build="bungalow"]').click();
  await expect(page.locator('[data-project-callout]')).toBeVisible();

  await page.locator('[data-callout-off]').check();
  await page.locator('[data-callout-continue]').click();
  await expect(page.locator('[data-project-callout]')).toBeHidden();

  await page.reload();
  await h.waitForModelReady(page);
  await page.locator('[data-select-build="bungalow"]').click();
  await expect(page.getByText(/BUNGALOW — trace the outline/)).toBeVisible();
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

test('a house trace draws in the type red', async ({ page }) => {
  await h.openModel(page);

  await page.locator('[data-select-build="bungalow"]').click();
  await page.keyboard.press('Enter');

  await h.clickWorld(page, -6, -4);
  await h.clickWorld(page, 6, -4);
  await h.moveTo(page, 6, 4);
  const probe = await h.worldToClient(page, 0, -4);
  const pixels = await h.overlayPixels(page, probe.x, probe.y);
  expect(h.countColor(pixels, [192, 57, 43])).toBeGreaterThan(0); // #c0392b
  await page.keyboard.press('Escape');
});
