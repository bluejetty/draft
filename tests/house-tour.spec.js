// The guided full-house flow, slice 1 (board #230): closing a HOUSE outline
// pulls the drafter to FOUNDATION, the mid-span beam + teleposts appear where
// a span needs them (>19' joist span), and the FOUNDATION DONE popup climbs
// to MAIN on Enter, Space, or a tap. The tour is the escorted path, never a
// cage: Esc leaves it, the level cards stay free, and a parked tour resumes
// across a reload.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function traceHouse(page, w, d) {
  await page.locator('[data-select-house]').click();
  await page.keyboard.press('Enter'); // past PROFESSOR GRUFF
  await h.clickWorld(page, -w / 2, -d / 2);
  await h.clickWorld(page, w / 2, -d / 2);
  await h.clickWorld(page, w / 2, d / 2);
  await h.clickWorld(page, -w / 2, d / 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

function activeLevel(page) {
  return page.locator('.level-row.active .level-name');
}

test('a deep house pulls to FOUNDATION, grows beam + teleposts, and Enter climbs to MAIN', async ({ page }) => {
  await h.openModel(page);
  // 28 x 24: the 24' joist span passes 19', so one beam line rides the long
  // axis at mid-span — 28' splits into 3 working spans on 2 teleposts.
  await traceHouse(page, 28, 24);

  await expect(activeLevel(page)).toHaveText(/FOUNDATION/);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await h.waitForSaved(page);

  let saved = await h.savedDrawing(page);
  expect(saved.tour.step).toBe('foundation');
  expect(saved.beams).toHaveLength(3);
  saved.beams.forEach(beam => {
    expect(beam.levelId).toBe(1);
    expect(beam.view).toBe('foundation');
    expect(beam.start.z).toBeCloseTo(0, 5); // mid-span of the 24' short axis
  });
  expect(saved.columns).toHaveLength(2);
  expect(saved.columns.map(c => Math.round(c.point.x)).sort((a, b) => a - b))
    .toEqual([-5, 5]); // thirds of the 28' run at -14/3 and 14/3... rounded

  await page.keyboard.press('Enter');
  await expect(page.locator('[data-tour-popup]')).toBeHidden();
  await expect(activeLevel(page)).toHaveText(/MAIN FL/);
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.tour.step).toBe('main');
});

test('a shallow house needs no beam and the popup itself is the button', async ({ page }) => {
  await h.openModel(page);
  await traceHouse(page, 16, 12); // 12' span — under the 19' trigger

  await expect(activeLevel(page)).toHaveText(/FOUNDATION/);
  const popup = page.locator('[data-tour-popup]');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText(/no mid-span beam/i);

  const saved = await h.savedDrawing(page);
  expect(saved.beams).toHaveLength(0);
  expect(saved.columns).toHaveLength(0);

  await popup.click();
  await expect(popup).toBeHidden();
  await expect(activeLevel(page)).toHaveText(/MAIN FL/);
});

test('Esc leaves the tour and the level cards stay free', async ({ page }) => {
  await h.openModel(page);
  await traceHouse(page, 28, 24);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-tour-popup]')).toBeHidden();
  await expect(activeLevel(page)).toHaveText(/FOUNDATION/); // no forced move
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.tour.step).toBe(null);
  // The beam the reveal placed is real drawing content — leaving keeps it.
  expect(saved.beams.length).toBeGreaterThan(0);

  await page.locator('.level-row')
    .filter({ has: page.locator('.level-name', { hasText: '2ND FL' }) })
    .locator('.level-name').click();
  await expect(activeLevel(page)).toHaveText(/2ND FL/);
});

test('a parked tour resumes across a reload without duplicating the reveal', async ({ page }) => {
  await h.openModel(page);
  await traceHouse(page, 28, 24);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await h.waitForSaved(page);

  await page.reload();
  await h.waitForModelReady(page);
  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  const saved = await h.savedDrawing(page);
  expect(saved.tour.step).toBe('foundation');
  expect(saved.beams).toHaveLength(3); // restored, not re-grown

  await page.keyboard.press(' ');
  await expect(page.locator('[data-tour-popup]')).toBeHidden();
  await expect(activeLevel(page)).toHaveText(/MAIN FL/);
});
