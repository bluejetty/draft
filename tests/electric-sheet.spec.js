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

// A fridge on that wall. Fixtures are the entity that matters here: every
// other active-set helper (_activeWalls, _activeLines, _activeDimensions,
// _activeRoomTags, _activeColumns, _activeBeams) already filters by the
// level's layer view, so those are excluded from the electric sheet before
// selection is even asked. _activeFixtures does NOT, so a sink or a stove
// was selectable on it — the one real hole the spec's "fixtures are
// background, not selectable" rule was catching.
async function oneFixture(page) {
  await h.selectTool(page, 'Fixture');
  await page.getByRole('button', { name: 'FRIDGE', exact: true }).click();
  await h.clickWorld(page, 2, -5.6);
  await h.waitForSaved(page);
}

test('the control: on the plan that fixture selects and deletes', async ({ page }) => {
  await h.openModel(page);
  await oneWall(page);
  await oneFixture(page);
  expect((await h.savedDrawing(page)).fixtures).toHaveLength(1);

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 2, -5.6);
  await page.keyboard.press('Delete');
  await h.waitForSaved(page);

  expect((await h.savedDrawing(page)).fixtures).toHaveLength(0);
});

test('on the ELECTRIC sheet the identical click cannot touch the fixture', async ({ page }) => {
  await h.openModel(page);
  await oneWall(page);
  await oneFixture(page);
  await useLayerView(page, 'MAIN FL', 'ELECTRIC');

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 2, -5.6);        // the exact click that worked above
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);

  expect((await h.savedDrawing(page)).fixtures).toHaveLength(1);
});

test('the wall is background there too, though its layer view already said so', async ({ page }) => {
  await h.openModel(page);
  await oneWall(page);
  await useLayerView(page, 'MAIN FL', 'ELECTRIC');

  await h.selectTool(page, 'Select');
  await h.clickWorld(page, 0, -6);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);

  expect(h.allWalls(await h.savedDrawing(page))).toHaveLength(1);
});
