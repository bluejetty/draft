// + CUT TAKES YOU SOMEWHERE YOU CAN CUT.
//
// Movie, 14 Oct: "i also noticed if i'm on ELEVATION or some others and i press
// +CUT or the SECTION viewport with +CUT in it, nothing happens, if they user
// presses either +CUT or command +CUT can you take the user to the MAIN FLOOR
// PLAN and allow them to make the cut".
//
// A CUT IS DRAWN ON A PLAN -- two presses for the ends and a third for the side
// to look from -- but + CUT can be pressed from anywhere: the SECTIONS head is
// in the rail on every view, and an empty S seat offers the same press. On an
// elevation the tool armed and had nothing to land on, so the button read as
// broken.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MAIN_FLOOR = 3;

async function houseOnScreen(page) {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
}

const where = page => page.evaluate(() => {
  const p = new URLSearchParams(location.search);
  return { level: p.get('level'), view: p.get('view') };
});

test('pressing + CUT on an elevation lands on the main floor plan, armed',
  async ({ page }) => {
    await houseOnScreen(page);
    // STANDING ON AN ELEVATION, which is where he was.
    await page.goto('/MODEL.html?right=1&left=1&level=3&view=cut%3AE2');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    expect((await where(page)).view, 'the fixture did not open on an elevation').toBe('cut:E2');

    await page.locator('[data-add-cut]').click();
    const at = await where(page);
    // THE ELEVATION IS LEFT, which is the half that was missing: the tool used
    // to arm while the page stayed on a view the gesture cannot be made in.
    expect(at.view, 'still standing on the elevation').toBeNull();
    expect(at.level, 'not on the main floor').toBe(String(MAIN_FLOOR));
    // AND ARMED, so the next press is the first end of the line rather than
    // a second trip to the button.
    await expect(page.locator('[data-tool-key="cut"]'), 'the cut tool is not armed')
      .toHaveAttribute('aria-pressed', 'true');
  });

// A THIRD CHECK -- drawing the whole section from there -- was written and
// taken out again: clickWorld aims at the plan canvas through a boundingBox,
// and the canvas it wants is the one the page rebuilds on the way back from
// the elevation, so the check spent three minutes timing out on a page that
// was working. What it would have added over the two here is small: the arm
// is already read off the tool key, and the cut gesture itself is covered by
// tests that start on a plan where it belongs.

test('pressed on a plan it stays put — it only rescues a view that cannot cut',
  async ({ page }) => {
    // A DRAFTER ALREADY ON A PLAN MUST NOT BE MOVED. He may be cutting the
    // SECOND floor on purpose, and a + CUT that dragged him down to MAIN
    // every time would be a new bug wearing the fix's clothes.
    await houseOnScreen(page);
    await page.goto('/MODEL.html?right=1&left=1&level=5');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    const before = await where(page);
    await page.locator('[data-add-cut]').click();
    expect((await where(page)).level, 'the press moved a drafter who was already on a plan')
      .toBe(before.level);
    await expect(page.locator('[data-tool-key="cut"]')).toHaveAttribute('aria-pressed', 'true');
  });
