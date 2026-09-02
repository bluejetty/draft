// The electric sheet: move, delete, add — and only electric things.
//
// Everything not electric is the background the drafter draws on: visible,
// not selectable. He cannot nudge a wall while placing outlets along it.
//
// The spec is explicit that this is enforced by the MODE rather than the
// painter: "the sheet's hit-testing only ever returns electric entities. If
// it is done by making other things merely hard to grab, it is not done."
//
// So these assert the CONSEQUENCE — whether the building can be damaged —
// using the same click on the same wall in both modes. A test that clicked
// slightly off the wall and found nothing selected would pass on a
// merely-awkward implementation too, which is the failure being guarded.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function useLayerView(page, level, view) {
  await levelRow(page, level).locator('.level-body').click();
  await levelRow(page, level).locator('.level-layer', { hasText: view }).first().click();
  await page.waitForTimeout(250);
}

// A wall running along z = -6, so (0, -6) is dead on its line.
async function oneWall(page) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

test('the control: on the plan that wall selects and deletes', async ({ page }) => {
  await h.openModel(page);
  await oneWall(page);
  expect(h.allWalls(await h.savedDrawing(page))).toHaveLength(1);

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, -6);          // dead on the wall line
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  expect(h.allWalls(await h.savedDrawing(page))).toHaveLength(0);
});

test('on the ELECTRIC sheet the identical click cannot touch the wall', async ({ page }) => {
  await h.openModel(page);
  await oneWall(page);
  await useLayerView(page, 'MAIN FL', 'ELECTRIC');

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, -6);          // the exact click that worked above
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);

  expect(h.allWalls(await h.savedDrawing(page))).toHaveLength(1);
});

test('nor through its corner, which would be a back door into dragging it', async ({ page }) => {
  await h.openModel(page);
  await oneWall(page);
  await useLayerView(page, 'MAIN FL', 'ELECTRIC');

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, -8, -6);         // the wall's own vertex
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);

  expect(h.allWalls(await h.savedDrawing(page))).toHaveLength(1);
});
