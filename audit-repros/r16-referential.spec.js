// Checklist 11: delete each referenced target and see what happens to the
// things pointing at it, through a save and a reload.
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(500);
  await h.waitForSaved(page);
}

test('R16a: deleting a wall that hosts a window', async ({ page }) => {
  await h.openModel(page);
  await buildHouse(page);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 0, -9);
  await h.waitForSaved(page);
  let d = await h.savedDrawing(page);
  const opening = (d.fenestrations || [])[0];
  console.log('opening', opening && opening.id, '-> wall', opening && opening.wallId);
  expect(opening).toBeTruthy();

  // Select that wall and delete it.
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 6, -9);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(400);
  await h.waitForSaved(page);
  d = await h.savedDrawing(page);
  const wallGone = !(d.walls || []).some(w => w.id === opening.wallId);
  console.log('host wall deleted:', wallGone,
    '| fenestrations left:', (d.fenestrations || []).length,
    '| orphaned:', (d.fenestrations || []).filter(f => !(d.walls || []).some(w => w.id === f.wallId)).length);

  await page.reload();
  await h.waitForModelReady(page);
  const note = await page.locator('[data-model-drawing-message]').textContent().catch(() => '');
  console.log('message after reload:', JSON.stringify((note || '').trim()));
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -30, -30); await h.clickWorld(page, -30, -26);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const after = await h.savedDrawing(page);
  console.log('after a reload + one edit: fenestrations', (after.fenestrations || []).length);
});

test('R16b: deleting the BONEYARD master under generated geometry', async ({ page }) => {
  await h.openModel(page);
  await buildHouse(page);
  let d = await h.savedDrawing(page);
  const linked = (d.walls || []).filter(w => w.start.srcId || w.end.srcId).length;
  console.log('walls carrying a master srcId:', linked, 'of', (d.walls || []).length);
  console.log('boneyard masters:', (d.boneyardOutlines || d.boneyard || []).length,
    Object.keys(d).filter(k => /bone/i.test(k)).join(','));

  // Delete the master on the BONEYARD shelf.
  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(400);
  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, -9);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(400);
  const msg = await page.locator('[data-model-drawing-message]').textContent().catch(() => '');
  console.log('deleting the master says:', JSON.stringify((msg || '').trim().slice(0, 120)));
  await page.waitForTimeout(600);
  d = await h.savedDrawing(page);
  const stillLinked = (d.walls || []).filter(w => w.start.srcId || w.end.srcId).length;
  console.log('walls still carrying a srcId:', stillLinked, '| walls', (d.walls || []).length);
  await page.reload();
  await h.waitForModelReady(page);
  const note = await page.locator('[data-model-drawing-message]').textContent().catch(() => '');
  console.log('message after reload:', JSON.stringify((note || '').trim()));
  const after = await h.savedDrawing(page);
  console.log('walls after reload:', (after.walls || []).length);
});
