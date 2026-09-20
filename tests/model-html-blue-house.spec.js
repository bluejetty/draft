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

// Press a world point on the plan, through the camera the page publishes.
// h.clickWorld reads [data-model-canvas], which is the OLD page's canvas.
async function pressWorld(page, x, z) {
  const frame = await h.planFrame(page);
  const [cx, cy] = frame.at(x, z);
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(80);
}

async function save(page) {
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

// Saved, then counted: this page does not autosave, so the store holds the
// fixture until SAVE is pressed.
async function savedOutlines(page) {
  await save(page);
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    if (!file) return 0;
    return (JSON.parse(await file.text()).outlines || []).length;
  }, BUCKET);
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

  // ── THE TWO PRESSES ────────────────────────────────────────────────────
  //
  // Movie ruled the collision between two of his own rules, 19 Sep: "go with
  // the 19 sep rule, on 1st press go to drivethru questions and on 2nd always
  // offer choice between drivetrhu or house build". So the 18 Sep rule --
  // "when they draw the U outline, they should still press the BONE or blue
  // house to cause the house to be created" -- no longer describes the FIRST
  // press. The traced shape still gets built; it is built from the card.

  test('the second press asks, and names the house it would build',
    async ({ page }) => {
      await open(page, 'rough');
      await orderAtWindow(page, 'bungalow', 'bungalow');
      await page.keyboard.press('Escape');            // shut the board, keep the pick
      await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');

      await page.locator('#bone').click();
      const card = page.locator('#build-choice');
      await expect(card).toBeVisible();
      // "(and should show what type of house they are currently going to
      // build - (1 storey bungalow, 2 storey over garage, Modified Bilevel
      // etc.)". A choice between two verbs with no subject is not a choice.
      await expect(card.locator('[data-build-choice-house]')).toHaveText('1 STOREY');
      // AND IT HAS NOT BUILT ANYTHING BY ASKING. Escape first: the card is a
      // full-sheet modal and SAVE is behind it, which is the point of a
      // modal and not something to work around by reaching past it.
      await page.keyboard.press('Escape');
      await expect(card).toBeHidden();
      await save(page);
      expect(await wallCount(page)).toBe(0);
    });

  test('CHANGE IT goes back to the window', async ({ page }) => {
    await open(page, 'rough');
    await orderAtWindow(page, 'bungalow', 'bungalow');
    await page.keyboard.press('Escape');
    await page.locator('#bone').click();
    await page.locator('[data-build-choice-change]').click();
    await expect(page.locator('#build-choice')).toBeHidden();
    // The press lights for two seconds before the board rises.
    await expect(page.locator('#drivethru'))
      .not.toHaveAttribute('data-shut', '', { timeout: 6000 });
  });

  test('BUILD IT builds the house that was named', async ({ page }) => {
    await open(page, 'rough');
    await orderAtWindow(page, 'bungalow', 'bungalow');
    await page.keyboard.press('Escape');
    await page.locator('#bone').click();
    await page.locator('[data-build-choice-build]').click();
    await page.waitForTimeout(600);
    await expect(page.locator('#build-choice')).toBeHidden();
    await save(page);
    expect(await wallCount(page),
      'the card offered to build and then did not').toBeGreaterThan(0);
  });

  // THE RULING'S SHARP EDGE, and the reason it is worth a check of its own:
  // an outline traced and a type picked used to build ON THE FIRST PRESS.
  // Movie chose the board over that. The shape is not lost -- it is what the
  // card's BUILD then raises -- but the first press must not build it.
  // A TYPE PICKED **AND** AN OUTLINE TRACED is the scenario Movie's 18 Sep
  // rule described and his 19 Sep ruling overrode: "when they draw the U
  // outline, they should still press the BONE or blue house to cause the
  // house to be created". That press used to build on the spot, because
  // fireBuild ran first. It asks now.
  //
  // BOTH HALVES ARE LOAD-BEARING. With no type picked fireBuild answers
  // false and builds nothing anyway, so a check that only traced a shape
  // would pass against the old code and prove nothing -- measured, by
  // putting the old line back and watching it stay green.
  test('a traced outline with a type picked asks before it builds',
    async ({ page }) => {
      await open(page, 'rough');
      await orderAtWindow(page, 'bungalow', 'bungalow');
      await page.keyboard.press('Escape');
      await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');

      // NO selectTool HERE. Picking a type at the window ARMS the trace --
      // "_pressBuildType does two things, records the type AND arms the
      // outline tool" -- so pressing the key again would put it down, and
      // the corners below would land on a SELECT tool. The first draft of
      // this check did exactly that and traced nothing.
      //
      // pressWorld, NOT h.clickWorld: that helper reads
      // [data-model-canvas], which is the OLD page's canvas, and waits out
      // its timeout on this one.
      const CORNERS = [[-14, -9], [14, -9], [14, 9], [-14, 9]];
      for (const [x, z] of CORNERS) await pressWorld(page, x, z);
      // CLOSED ON THE FIRST CORNER, which is the outline's own gesture on
      // this page -- press the corners, press the first one again. Enter
      // commits NOTHING here: an earlier draft of this check used it, traced
      // no outline at all, and therefore passed against the very behaviour
      // it was written to forbid. Measured by reading the saved file back:
      // outlines 0.
      await pressWorld(page, ...CORNERS[0]);
      await page.waitForTimeout(250);
      expect((await savedOutlines(page)),
        'no outline was traced, so this check would prove nothing')
        .toBeGreaterThan(0);

      await page.locator('#bone').click();
      await expect(page.locator('#build-choice'),
        'the first press built the traced house instead of asking')
        .toBeVisible();
      await page.keyboard.press('Escape');
      await save(page);
      expect(await wallCount(page),
        'and it built nothing by asking').toBe(0);

      // THE TRACED SHAPE IS NOT LOST, which is the half of the 18 Sep rule
      // that survives: the card's BUILD is where it gets raised.
      await page.locator('#bone').click();
      await page.locator('[data-build-choice-build]').click();
      await page.waitForTimeout(600);
      await save(page);
      expect(await wallCount(page)).toBeGreaterThan(0);
    });
});
