// The protractor: Shift held is the temporary blade — it grabs the nearest 45°
// ray from the last point and holds it while the cursor slides along, and it
// re-aims on every fresh press instead of inheriting the T-square's ray. A bare
// Ctrl tap works the T-square light like T; Ctrl inside a combo does not.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function lastLine(drawing) {
  const lines = h.allLines(drawing);
  return lines[lines.length - 1];
}

function farEnd(line, ox, oz) {
  return [line.start, line.end].find(pt => !(h.near(pt.x, ox, 0.2) && h.near(pt.z, oz, 0.2)));
}

test('a fresh Shift press aims the blade at the cursor, not the T-square ray', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');

  // First segment runs east under the full-time T-square, arming a horizontal ray.
  await h.clickWorld(page, -15, -15);
  await page.keyboard.down('Shift');
  await h.moveTo(page, -10, -15.2);
  await h.clickWorld(page, -10, -15.2);
  await page.keyboard.up('Shift');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // A later chain aims north-east: the new Shift press must take the diagonal.
  await h.clickWorld(page, 0, 0);
  await h.moveTo(page, 10, 0.5);
  await page.keyboard.down('Shift');
  await h.moveTo(page, 7, 6.5);
  await h.clickWorld(page, 7, 6.5);
  await page.keyboard.up('Shift');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const end = farEnd(lastLine(await h.savedDrawing(page)), 0, 0);
  expect(Math.abs(end.x - end.z)).toBeLessThan(0.3);
  expect(end.x).toBeGreaterThan(3);
});

test('the held blade keeps its direction while the cursor slides along it', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);

  await page.keyboard.down('Shift');
  await h.moveTo(page, 6, 6);        // aims the 45° blade
  await h.moveTo(page, 12, 9);       // drifts off-axis: distance grows, angle holds
  await h.clickWorld(page, 12, 9);
  await page.keyboard.up('Shift');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const end = farEnd(lastLine(await h.savedDrawing(page)), 0, 0);
  expect(Math.abs(end.x - end.z)).toBeLessThan(0.3);
  expect(end.x).toBeGreaterThan(8);
});

test('Shift covers the straight rays: a near-horizontal aim locks dead east', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);

  await page.keyboard.down('Shift');
  await h.moveTo(page, 12, 1.4);
  await h.clickWorld(page, 12, 1.4);
  await page.keyboard.up('Shift');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const end = farEnd(lastLine(await h.savedDrawing(page)), 0, 0);
  expect(h.near(end.z, 0, 0.2)).toBe(true);
  expect(end.x).toBeGreaterThan(10);
});

test('releasing Shift hands the point back to the free cursor', async ({ page }) => {
  await h.openModel(page);
  await page.keyboard.press('t');   // set the T-square down so the free angle stands
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);

  await page.keyboard.down('Shift');
  await h.moveTo(page, 6, 6);
  await page.keyboard.up('Shift');
  await h.moveTo(page, 9, 2);
  await h.clickWorld(page, 9, 2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const end = farEnd(lastLine(await h.savedDrawing(page)), 0, 0);
  expect(h.near(end.x, 9, 0.3)).toBe(true);
  expect(h.near(end.z, 2, 0.3)).toBe(true);
});

// The T-square is the drafter's tool, not the wall tool's: anything drawn
// along a line squares to it. A section line drifting a foot and a half off
// horizontal is the case that used to save crooked.
test('the T-square squares a section line, not only the drawing tools', async ({ page }) => {
  await h.openModel(page);
  await page.keyboard.press('c');
  await h.clickWorld(page, -12, 0);
  await h.moveTo(page, 12, 1.5);
  await h.clickWorld(page, 12, 1.5);
  await h.clickWorld(page, 0, -8);
  await h.waitForSaved(page);

  const cut = (await h.savedDrawing(page)).cuts.at(-1);
  expect(h.near(cut.endPt.z, cut.startPt.z, 0.2)).toBe(true);
  expect(cut.endPt.x - cut.startPt.x).toBeGreaterThan(20);
});

test('a bare Ctrl tap works the T-square light like T', async ({ page }) => {
  await h.openModel(page);
  const chip = page.locator('[data-mode-tsquare]');

  const litColor = await chip.evaluate(el => el.style.color);
  await page.keyboard.press('Control');
  await expect.poll(() => chip.evaluate(el => el.style.color)).not.toBe(litColor);

  await page.keyboard.press('Control');
  await expect.poll(() => chip.evaluate(el => el.style.color)).toBe(litColor);
});

test('Ctrl+Z stays undo: a combo Ctrl never flips the T-square', async ({ page }) => {
  await h.openModel(page);
  const chip = page.locator('[data-mode-tsquare]');
  const litColor = await chip.evaluate(el => el.style.color);

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 8, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  expect(await chip.evaluate(el => el.style.color)).toBe(litColor);
});

test('Ctrl+Shift keeps the 30° blade for pitched work', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);

  await page.keyboard.down('Shift');
  await page.keyboard.down('Control');
  await h.moveTo(page, 8, 5);
  await h.clickWorld(page, 8, 5);
  await page.keyboard.up('Control');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const end = farEnd(lastLine(await h.savedDrawing(page)), 0, 0);
  expect(Math.abs(Math.atan2(end.z, end.x) - Math.PI / 6)).toBeLessThan(0.02);
});
