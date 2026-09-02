// Checklist 9 + 11: delete a level and see what is left behind.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

test('R6: deleting a level leaves its fenestrations, fixtures, stairs, notes and room tags orphaned', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-14, -10], [14, -10], [14, 10], [-14, 10], [-14, -10]]) await h.clickWorld(page, x, z);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);

  // Put an opening in a 2ND FL wall.
  await levelRow(page, '2ND FL').locator('.level-name').click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 0, -10);
  await h.waitForSaved(page).catch(() => {});
  const before = await h.savedDrawing(page);
  const secondId = before.levels.find(l => l.name === '2ND FL').id;
  const own = d => ({
    walls: (d.walls || []).filter(w => w.levelId === secondId).length,
    fenestrations: (d.fenestrations || []).filter(f => f.levelId === secondId).length,
    fixtures: (d.fixtures || []).filter(f => f.levelId === secondId).length,
    stairs: (d.stairs || []).filter(f => f.levelId === secondId).length,
    notes: (d.notes || []).filter(f => f.levelId === secondId).length,
    roomTags: (d.roomTags || []).filter(f => f.levelId === secondId).length,
    dimensions: (d.dimensions || []).filter(f => f.levelId === secondId).length,
  });
  console.log('2ND FL owns before delete:', JSON.stringify(own(before)));

  page.on('dialog', d => d.accept());
  await levelRow(page, '2ND FL').locator('text=×').first().click();
  await page.waitForTimeout(500);
  await h.waitForSaved(page);
  const after = await h.savedDrawing(page);
  console.log('level still present:', after.levels.some(l => l.id === secondId));
  console.log('2ND FL owns after delete:', JSON.stringify(own(after)));
  // Reload: the orphan trips the "incomplete items" warning on a drawing the
  // user never corrupted.
  await page.reload();
  await h.waitForModelReady(page);
  const msg = await page.locator('[data-model-drawing-message]').textContent().catch(() => '');
  console.log('message after reload:', JSON.stringify((msg || '').trim()));
  const orphans = own(after);
  expect(orphans, 'nothing may reference a level that no longer exists').toEqual({
    walls: 0, fenestrations: 0, fixtures: 0, stairs: 0, notes: 0, roomTags: 0, dimensions: 0,
  });
});
