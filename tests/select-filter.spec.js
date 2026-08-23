// The Select tool carries an OBJECT TYPE filter (ALL / LINE / WALL / OUTLINE /
// FLOOR). While a type is engaged only that type responds to clicks and
// selection windows, so an outline buried under walls and floors can still be
// grabbed. ALL, Esc on an empty selection, the A key, and re-activating the
// tool all release the filter.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

function filterChip(page, label) {
  return page.locator('[data-select-filters] button')
    .filter({ hasText: new RegExp(`^${label}$`) });
}

async function engagedFilter(page) {
  return page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('[data-select-filters] button'));
    const active = buttons.find(b => {
      const bg = getComputedStyle(b).backgroundColor;
      return bg === 'rgb(29, 31, 32)' || bg === 'rgb(176, 64, 80)';
    });
    return active ? active.textContent.trim() : null;
  });
}

async function dragWindow(page, x1, z1, x2, z2) {
  const a = await h.worldToClient(page, x1, z1);
  const b = await h.worldToClient(page, x2, z2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2);
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test('an engaged WALL filter ignores line clicks and still picks walls', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);
  await drawWall(page, -8, 5, 8, 5);

  await h.selectTool(page, 'Select');
  await filterChip(page, 'WALL').click();

  // A click dead on the line selects nothing while WALL is engaged.
  await h.clickWorld(page, 0, 0);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  let saved = await h.savedDrawing(page);
  expect(h.allLines(saved)).toHaveLength(1);
  expect(h.allWalls(saved)).toHaveLength(1);

  // The wall itself still answers.
  await h.clickWorld(page, 0, 5);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(h.allLines(saved)).toHaveLength(1);
  expect(h.allWalls(saved)).toHaveLength(0);
});

test('a selection window honors the engaged LINE filter', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, 8, 0);
  await drawWall(page, -8, 5, 8, 5);

  await h.selectTool(page, 'Select');
  await filterChip(page, 'LINE').click();
  await dragWindow(page, -12, -4, 12, 9); // encloses both
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(h.allLines(saved)).toHaveLength(0);
  expect(h.allWalls(saved)).toHaveLength(1);
});

test('OUTLINE keeps a floor from stealing the pick; Esc on empty releases it', async ({ page }) => {
  await h.openModel(page);
  // Outline rectangle with a floor drawn over most of it.
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.selectTool(page, 'Floor');
  await h.clickWorld(page, -6, -4);
  await h.clickWorld(page, 6, -4);
  await h.clickWorld(page, 6, 4);
  await h.clickWorld(page, -6, 4);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Select');
  await filterChip(page, 'OUTLINE').click();

  // A click inside the floor no longer selects it.
  await h.clickWorld(page, 0, 0);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);
  let saved = await h.savedDrawing(page);
  expect(saved.floors.length).toBeGreaterThan(0);

  // Esc with nothing selected returns the filter to ALL...
  await page.keyboard.press('Escape');
  expect(await engagedFilter(page)).toBe('ALL');

  // ...and the same click selects and deletes the floor again.
  await h.clickWorld(page, 0, 0);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.floors).toHaveLength(0);
});

test('the A key and re-activating Select both return the filter to ALL', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Select');

  await filterChip(page, 'FLOOR').click();
  expect(await engagedFilter(page)).toBe('FLOOR');
  await h.clickWorld(page, 15, 15); // blur the chip so the key reaches the canvas
  await page.keyboard.press('a');
  expect(await engagedFilter(page)).toBe('ALL');

  await filterChip(page, 'WALL').click();
  expect(await engagedFilter(page)).toBe('WALL');
  await h.selectTool(page, 'Line');
  await h.selectTool(page, 'Select');
  expect(await engagedFilter(page)).toBe('ALL');
});
