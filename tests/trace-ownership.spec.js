// A part-drawn outline belongs to the builder that started it.
//
// _toggleGarageMode set outlineGarage and left _outlinePoints alone, so mid-
// trace the legs stayed on screen and only changed colour — the same partial
// loop carried on under the new owner. Not cosmetic: an ATTACHED run must
// start and end on the house outline and a DETACHED loop must close on
// itself, so a trace begun under one rule and finished under the other
// satisfies neither, and the geometry reaching _commitOutline was never drawn
// to the rule it is validated against.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const DROPPED = /Part-drawn outline dropped/;
const message = page => page.locator('[data-model-drawing-message]');

// Two legs down and the third not placed: a trace mid-flight.
async function twoLegsDown(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
}


test('tapping DETACHED mid-trace drops the trace and says so', async ({ page }) => {
  await h.openModel(page);
  await twoLegsDown(page);

  await page.locator('[data-mark-detached-garage]').click();
  await page.waitForTimeout(200);

  // Nothing of the house trace survives to be finished as a garage.
  await expect(message(page)).toContainText(DROPPED);
  await expect(message(page)).toContainText('DETACHED GARAGE');
});

test('toggling the same mode off mid-trace drops it too', async ({ page }) => {
  await h.openModel(page);
  await page.locator('[data-mark-detached-garage]').click();
  await page.waitForTimeout(200);
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);

  // Same button again: the toggle-off path had the same hole in reverse — a
  // half-drawn garage run would have become a house outline.
  await page.locator('[data-mark-detached-garage]').click();
  await page.waitForTimeout(200);

  await expect(message(page)).toContainText(DROPPED);
  await expect(message(page)).toContainText('GARAGE marking off');
});

test('ATTACHED is not offered without a house master, so no trace can be handed to it', async ({ page }) => {
  await h.openModel(page);
  await twoLegsDown(page);

  // The order's third case — tap ATTACHED with no house master and watch the
  // rejection leave the trace alone — cannot be reached through the UI. The
  // button is wrapped in <sc-if value="{{ hasHouseMaster }}">, and that value
  // is `this._shelfHasHouseMaster()`: the exact call the rejection branch
  // guards on. Same function, same moment, opposite senses — so the branch
  // only fires when the button that reaches it does not exist. It is the only
  // caller of _toggleGarageMode('attached').
  //
  // The branch is therefore left untouched, as the order says, and what is
  // pinned instead is the invariant that keeps it unreachable: with no house
  // master there is no ATTACHED button, so a trace can never be handed to the
  // builder that would refuse it.
  await expect(page.locator('[data-mark-attached-garage]')).toHaveCount(0);
  await expect(page.locator('[data-mark-detached-garage]')).toHaveCount(1);
  await expect(message(page)).not.toContainText(DROPPED);
});

test('tapping a builder with no trace in flight says nothing about dropping one', async ({ page }) => {
  await h.openModel(page);
  await page.locator('[data-mark-detached-garage]').click();
  await page.waitForTimeout(200);
  await expect(message(page)).toContainText('DETACHED GARAGE');
  await expect(message(page)).not.toContainText(DROPPED);
});
