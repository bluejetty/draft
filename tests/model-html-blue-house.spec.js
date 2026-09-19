// THE BLUE HOUSE THAT DID NOT BUILD.
//
// Movie, 19 Sep, from his own screen: "when the user goes through the RUFF
// drivethru or DRAFTING menu, the BLUE HOUSE doesn't make the house always,
// the BONE seems to work more often sometimes when the BLUE HOUSE doesn't
// sometimes i have to switch to RUFF to make it work."
//
// THE BLUE HOUSE AND THE BONE ARE ONE BUTTON. BONE_ART swaps the foot press's
// artwork by THEME -- ruff wears bone-red.png, rough wears house-blue-*.png --
// so "switching to RUFF to make it work" is not reaching for a different
// control. It is the same press behaving differently, and the difference is
// what the theme changes about the BOARD:
//
//   BOARD_ART.ruff   drivethru-menu-board.png   coversBone: true
//   BOARD_ART.rough  draft-board.png            coversBone: false
//
// On RUFF the board covers the foot press, so setSign disables it and the
// drafter is pushed to the bone on the post, which orders. On ROUGH the sheet
// stops above the bar, the foot press stays live under a board that does not
// cover it -- and the drafter presses the one in front of him.
//
// AND THAT PRESS DID NOTHING AT ALL. Its handler read:
//
//     if (fireBuild()) return;     // nothing drawn to build from -> false
//     if (chosen()) return;        // a type IS picked -> return, silently
//
// A bare return with no refusal, no board, no sound. So on ROUGH: pick a
// house at the window, press the blue house, and the page does nothing and
// says nothing -- which is exactly "doesn't make the house always", and
// exactly why switching to RUFF fixes it.
//
// TWO PRESSES THAT MEAN THE SAME THING ARE NOW ONE FUNCTION. Movie's rule for
// it, same day: "unless they are inside the drive thru, if they press it then
// (or when the house is glowing blue) that will count as only BUILD HOUSE".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

const empty = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, theme) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  if (theme) {
    await page.locator(`#mode-corner [data-theme="${theme}"]`).click();
    await page.waitForTimeout(200);
  }
}

// Pick a type at the window, and stop there — the press is the subject.
async function orderAtWindow(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
}

async function save(page) {
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const wallCount = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  if (!file) return 0;
  return (JSON.parse(await file.text()).walls || []).length;
}, BUCKET);

test.describe('the blue house builds', () => {
  test('on ROUGH, the press in front of the drafter builds the house he picked',
    async ({ page }) => {
      await open(page, 'rough');
      await expect(page.locator('#bone [data-bone-art]'))
        .toHaveAttribute('src', /house-blue/);

      await orderAtWindow(page, 'bungalow', 'bungalow');

      // THE PRESS IS LIVE AND IN FRONT OF HIM, which is the whole reason he
      // reaches for it: ROUGH's sheet stops above the bar.
      await expect(page.locator('#bone')).toBeEnabled();
      await page.locator('#bone').click();
      await page.waitForTimeout(500);
      await save(page);

      expect(await wallCount(page),
        'the blue house was pressed with a type picked and built nothing')
        .toBeGreaterThan(0);
    });

  test('on RUFF the board covers that press, so the post is the only way',
    async ({ page }) => {
      await open(page, 'ruff');
      await orderAtWindow(page, 'bungalow', 'bungalow');
      // UNCHANGED, and asserted so the fix above cannot be made by taking
      // the cover rule away: nothing under a sheet should be reachable.
      await expect(page.locator('#bone')).toBeDisabled();

      await page.locator('#dt-bone').click();
      await page.waitForTimeout(500);
      await save(page);
      expect(await wallCount(page)).toBeGreaterThan(0);
    });

  test('with the board down and a type already picked, the press opens it',
    async ({ page }) => {
      await open(page, 'rough');
      await orderAtWindow(page, 'bungalow', 'bungalow');
      await page.keyboard.press('Escape');            // shut the board, keep the pick
      await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');

      await page.locator('#bone').click();
      // The press lights for two seconds before the board rises, so this
      // waits for the board rather than for the press.
      await expect(page.locator('#drivethru'),
        'a press with a type picked and nothing drawn did nothing at all')
        .not.toHaveAttribute('data-shut', '', { timeout: 6000 });
    });
});
