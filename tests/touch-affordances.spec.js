// What a finger can and cannot reach (audit C2/M8, migration slice 3).
//
// The pointer migration made the canvas accept touch. This file walks the
// board's definition of done on a real touchscreen and pins the parts that
// WORK, so they cannot quietly regress. The parts that do not work are not
// asserted as failures here — they are recorded in RD-DOCUMENTS/TOUCH-NOTES.md, because
// the slice's rule is to fix only what hard-BLOCKS drawing, and to file the
// rest rather than redesign it.
//
// Deliberately NOT covered, and not a regression: polar-origin dwell (it arms
// on a hover that rests, which a finger has no way to perform), magnet
// highlights and tooltips (hover states with no touch equivalent), and
// pan/zoom (middle-drag, alt-drag and the wheel — none reachable by touch;
// two-finger gestures are their own board). See the notes.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// THE TOUR IS PARKED for drafters (Movie, 2 Sep) but this file drives it:
// its setup helpers climb FOUNDATION -> MAIN -> rooms through the popup ladder,
// so every test here turns the escort back on. The code is switched off, not
// deleted, and a parked feature with no coverage is one flag from shipping with
// nothing watching it.

test.use({ hasTouch: true });

async function tapWorld(page, x, z) {
  const p = await h.worldToClient(page, x, z);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(400);
}

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

test('the tool rail, the level cards and the layer views all answer a tap', async ({ page }) => {
  await h.openModel(page, { tourEscort: true });

  // The rails come out by tap (they start tucked behind their pull tabs).
  await expect(page.locator('[data-model-left]')).toBeVisible();
  await expect(page.locator('[data-model-right]')).toBeVisible();

  // A tool chosen by finger really becomes the active tool.
  await page.getByRole('button', { name: /\bWall\b/i }).first().tap();
  const active = await h.activeToolLabels(page);
  expect(active.join(' ')).toMatch(/WALL/i);

  // A level card opens by tap — the DoD item, and the way a drafter changes
  // storeys on site.
  await levelRow(page, '2ND FL').locator('.level-name').tap();
  await page.waitForTimeout(300);
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/2ND FL/);
  await levelRow(page, 'MAIN FL').locator('.level-name').tap();
  await page.waitForTimeout(300);
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/MAIN FL/);
});

test('a finger can run the tour: trace, climb, and stamp rooms', async ({ page }) => {
  await h.openModel(page, { tourEscort: true });
  await page.locator('[data-select-build="bungalow"]').tap();
  await page.keyboard.press('Enter'); // past PROFESSOR GRUFF
  for (const [x, z] of [[-14, -12], [14, -12], [14, 12], [-14, 12]]) await tapWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // The tour's popup is the escorted path's only control — it has to take a
  // tap, or a touch drafter is stranded on FOUNDATION.
  const popup = page.locator('[data-tour-popup]');
  await expect(popup).toBeVisible();
  await popup.tap();
  await expect(page.locator('.level-row.active .level-name')).toHaveText(/MAIN FL/);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.beams.length, 'the foundation step ran from a finger trace').toBeGreaterThan(0);
});

test('a double tap ends a wall chain, so a finger needs no keyboard to draw one', async ({ page }) => {
  // This is the one that decides whether the iPad story holds up on site. An
  // iPad shows a keyboard only while a text field has focus, so every spec in
  // this suite pressing Enter to finish a chain is doing something a drafter
  // at the counter cannot do. The chain's other ending is a double click —
  // and two quick taps are what the browser turns into one.
  await h.openModel(page, { tourEscort: true });
  await h.selectTool(page, 'Wall');
  await tapWorld(page, -6, -4);
  await tapWorld(page, 6, -4);

  // Two taps inside the double-click window, on the last point.
  const last = await h.worldToClient(page, 6, -4);
  await page.touchscreen.tap(last.x, last.y);
  await page.touchscreen.tap(last.x, last.y);
  await page.waitForTimeout(500);
  await h.waitForSaved(page);

  const walls = h.allWalls(await h.savedDrawing(page));
  expect(walls.length, 'the run committed without a keypress').toBeGreaterThanOrEqual(1);
  expect(h.touchesPoint(walls[0], -6, -4)).toBe(true);
  expect(h.touchesPoint(walls[0], 6, -4)).toBe(true);
});
