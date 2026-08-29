// Checklist 9: level ids 3/5/7 are compared literally all over MODEL. What
// silently stops working when the levels are not the factory five?
const { test, expect } = require('@playwright/test');
const h = require('../tests/helpers.js');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}
async function traceAndBuild(page) {
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

test('R14a: a third storey (level id 9) gets no roof dimensions', async ({ page }) => {
  await h.openModel(page);
  await traceAndBuild(page);
  const before = await h.savedDrawing(page);
  console.log('factory level ids:', before.levels.map(l => `${l.id}:${l.name}`).join(' '));
  const roofDims = d => (d.dimensions || []).filter(x => x.levelId === 7 && x.auto).length;
  console.log('auto dims on ROOF (id 7):', roofDims(before));

  // Add a storey. _addLevel takes its name and elevation from window.prompt.
  let asked = 0;
  page.on('dialog', d => { asked++; d.accept(asked === 1 ? '3RD FL' : '18'); });
  await page.getByRole('button', { name: /\+ ADD/ }).click();
  await page.waitForTimeout(600);
  await h.waitForSaved(page);
  const after = await h.savedDrawing(page);
  console.log('level ids now      :', after.levels.map(l => `${l.id}:${l.name}`).join(' '));
  const third = after.levels.find(l => l.name === '3RD FL');
  expect(third, 'the level was added').toBeTruthy();
  console.log('3RD FL id =', third.id, '(every "levelId === 5" branch in MODEL is now unreachable for it)');

  // AUTO DIMS on the new storey, then on ROOF: the ROOF branch is gated on id 7.
  await levelRow(page, '3RD FL').locator('.level-name').click();
  await page.waitForTimeout(400);
  await h.selectTool(page, 'Dimension');
  await page.getByRole('button', { name: 'AUTO DIMS' }).click();
  await page.waitForTimeout(600);
  const msg = await page.locator('[data-model-drawing-message]').textContent().catch(() => '');
  console.log('AUTO DIMS on the new storey says:', JSON.stringify((msg || '').trim()));

  // Press the bone again: the new storey is empty, so it should fill — but the
  // ROOF level already has its roof, so nothing lifts the roof to the new top.
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(800);
  await h.waitForSaved(page);
  const built = await h.savedDrawing(page);
  console.log('walls per level after the rebuild:',
    JSON.stringify(built.levels.map(l => [l.name, l.elev, (built.walls || []).filter(w => w.levelId === l.id).length])));
  const roof = (built.roofs || [])[0];
  const topFloor = built.levels.find(l => l.name === '3RD FL');
  const wallTop = Math.max(...(built.walls || []).filter(w => w.levelId === topFloor.id).map(w => w.topHeight), 0);
  console.log(`3RD FL sits at ${topFloor.elev}' with walls ${wallTop}' tall -> top of wall ${topFloor.elev + wallTop}'`);
  console.log('roof plateHeightFt:', roof ? roof.plateHeightFt : 'none', '| roofs:', (built.roofs || []).length);
  const bone = await page.locator('[data-model-drawing-message]').textContent().catch(() => '');
  console.log('bone says:', JSON.stringify((bone || '').trim()));
  await page.locator('.cut-row', { hasText: 'E1' }).click({ position: { x: 18, y: 8 } });
  await page.waitForTimeout(900);
  await page.locator('[data-model-canvas]').screenshot({ path: '/tmp/fc/three-storey-e1.png' });
});

test('R14b: delete the 2ND FL and rebuild', async ({ page }) => {
  await h.openModel(page);
  await traceAndBuild(page);
  const before = await h.savedDrawing(page);
  const second = before.levels.find(l => l.name === '2ND FL').id;
  console.log('before delete: stairs', (before.stairs || []).length,
    '| surfaceOpenings', (before.surfaceOpenings || []).length,
    '| walls on 2ND', (before.walls || []).filter(w => w.levelId === second).length);

  page.on('dialog', d => d.accept());
  await levelRow(page, '2ND FL').locator('text=×').first().click();
  await page.waitForTimeout(600);
  await h.waitForSaved(page);
  const mid = await h.savedDrawing(page);
  console.log('after delete : stairs', (mid.stairs || []).length,
    '| orphan stairs on the dead level', (mid.stairs || []).filter(s => s.levelId === second).length,
    '| orphan openings', (mid.surfaceOpenings || []).filter(s => s.levelId === second).length,
    '| orphan fenestrations', (mid.fenestrations || []).filter(s => s.levelId === second).length);

  // Press the bone again: does it rebuild a 2ND FL that no longer exists?
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(700);
  await h.waitForSaved(page);
  const after = await h.savedDrawing(page);
  console.log('after rebuild: levels', after.levels.map(l => l.id).join(','),
    '| walls per level', JSON.stringify(after.levels.map(l => [l.name, (after.walls || []).filter(w => w.levelId === l.id).length])));
  const msg = await page.locator('[data-model-drawing-message]').textContent().catch(() => '');
  console.log('message:', JSON.stringify((msg || '').trim()));
});
