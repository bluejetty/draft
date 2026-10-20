// THE SAME TWO ARROWS, THREE DIFFERENT LISTS.
//
// Movie, 14 Oct: "those arrow can be placed on the PROJECT and REAL ESTATE
// PLANS, CONSTRUCTION PLANS but in stead of going up and down levels, go up
// and down on the stack of pages in the layouts, or in the project area, cycle
// throught each HOUSE TYPE selection, 1st DETACHED GARAGE THICKENED EDGE / 2nd
// DETACHED GARAGE GRADE BEAM (1 storey) / 2nd DETACHED GARAGE GRADE BEAM ROOM
// OVER (2 STOREY) ... FROST WALL... FROST WALL 2 STOREY... BUNGALOW 1
// STOREY... etc", and "for specs can scroll through the content sections".
//
// WHAT THIS FILE IS FOR is the half a shared helper makes easy to get wrong:
// three pages hand the bar three lists, and the bar can only be right about
// all three if each page's `at()` really names where the drafter is standing.
// So every test below walks the list and asks the PAGE where it ended up --
// the lit tile, the active sheet, the current section -- rather than asking
// the arrows what they think they did.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const up = page => page.locator('#trio-up');
const down = page => page.locator('#trio-down');

test.describe('PROJECT: the arrows cycle the house types', () => {
  test('DOWN walks the column from the top, in the order the page reads', async ({ page }) => {
    await page.goto('/PROJECT.html');
    await expect(page.locator('#detached-family-row .family-button').first()).toBeVisible();

    // NOTHING IS LIT ON A PLAN NOBODY HAS TOUCHED -- the thickened edge is
    // only the office default, and the column deliberately lights nothing
    // until somebody presses (tests/project-page.spec.js asks for this
    // outright). So the first DOWN has to land on the FIRST stop rather than
    // doing nothing, which is what an arrow reading a -1 would otherwise do.
    const lit = () => page.evaluate(() => [...document.querySelectorAll('.family-col:not(#suite-family-row) .family-button')]
      .map((button, index) => ({ index, label: button.textContent.trim(),
        on: button.getAttribute('aria-pressed') === 'true' }))
      .filter(entry => entry.on));
    expect(await lit(), 'a family button was lit before anything was pressed').toEqual([]);

    await down(page).click();
    const first = await lit();
    expect(first.length, 'the first DOWN lit nothing').toBeGreaterThan(0);
    expect(first[0].index, 'the first stop is not the top of the column').toBe(0);
    // MOVIE'S ORDER, FIRST ENTRY: "1st DETACHED GARAGE THICKENED EDGE".
    expect(first[0].label.toUpperCase()).toContain('THICKENED');

    // AND THE SECOND IS THE GRADE BEAM, the third its + ROOM OVER. That is
    // the column's own order -- the stops are pushed as the buttons are
    // built, not listed a second time -- and it is the order he named.
    await down(page).click();
    expect((await lit()).slice(-1)[0].label.toUpperCase(),
      'the second stop is not the grade beam').toContain('GRADE BEAM');
    await down(page).click();
    const third = await lit();
    expect(third.slice(-1)[0].label.toUpperCase(),
      'the third stop is not the room over the grade beam').toContain('ROOM OVER');
    // BOTH LIGHT AT ONCE HERE, and that is correct rather than a smear: the
    // foundation button says what it stands on, + ROOM OVER says what is on
    // top, and a grade beam with a room over it is both. It is also exactly
    // why the bar reads the LAST lit button as "where we are".
    expect(third.length, 'the room over a grade beam lit only one of the two').toBe(2);
  });

  test('and UP comes back off a room over, which no button on the column can do',
    async ({ page }) => {
      // THE ONE CASE THAT NEEDED CODE RATHER THAN A CLICK. Pressing GRADE BEAM
      // while standing on GRADE BEAM + ROOM OVER does nothing -- the handler
      // returns early on the same foundation, and deliberately leaves the room
      // alone so that pressing a DIFFERENT foundation keeps the storey you had.
      // Stepping UP off the room has to land on the bare grade beam anyway.
      await page.goto('/PROJECT.html');
      await expect(page.locator('#detached-family-row .family-button').first()).toBeVisible();
      await down(page).click();
      await down(page).click();
      await down(page).click();
      const roomOn = page.locator('#detached-family-row [data-family-room-over]').first();
      await expect(roomOn, 'the walk did not reach the room over').toHaveAttribute('aria-pressed', 'true');

      await up(page).click();
      await expect(roomOn, 'UP left the room standing on the garage')
        .toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#detached-family-row [data-family-entry]').nth(1),
        'UP did not land on the bare grade beam').toHaveAttribute('aria-pressed', 'true');
    });

  test('UP is dead at the top of the column and DOWN at the bottom', async ({ page }) => {
    await page.goto('/PROJECT.html');
    await expect(page.locator('#detached-family-row .family-button').first()).toBeVisible();
    // GREYED AT THE ENDS RATHER THAN HIDDEN, which is MODEL's rule for the
    // same pair: a button that vanished would move the bone sideways under
    // the drafter's hand at the end of every list.
    await down(page).click();
    await expect(up(page), 'UP is live on the first stop').toBeDisabled();
    await expect(down(page)).toBeEnabled();
    // THE ARROWS STEP THE HOUSE TYPES; the SUITE's two (20 Oct) are not one.
    const stops = await page.evaluate(() =>
      document.querySelectorAll('.family-col:not(#suite-family-row) .family-button').length);
    for (let i = 1; i < stops; i += 1) await down(page).click();
    await expect(down(page), 'DOWN is live on the last stop').toBeDisabled();
    await expect(up(page)).toBeEnabled();
  });
});

test('Construction Layout: the arrows step the sheet stack', async ({ page }) => {
  // A DEALT SET, which is what a drafter arrives at: several sheets, one of
  // them active, and the thumbnail rail as the other control on that same
  // answer. Stepping has to move BOTH, which is why neither reads its own
  // copy -- the arrows call _setActiveSheet exactly as the rail does.
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');

  const active = () => page.evaluate(() => Number(
    document.querySelector('[data-layout-sheet].on')?.dataset.layoutSheet || 0));
  const sheets = await page.locator('[data-layout-sheet]').count();
  expect(sheets, 'the set was never dealt').toBeGreaterThan(1);
  expect(await active(), 'the set did not open on sheet 1').toBe(1);
  await expect(up(page), 'UP is live on the first sheet').toBeDisabled();

  await down(page).click();
  expect(await active(), 'DOWN did not move to sheet 2').toBe(2);
  await up(page).click();
  expect(await active(), 'UP did not come back to sheet 1').toBe(1);

  // ONE-BASED ON THE RECORD, ZERO-BASED IN THE BAR, and the off-by-one that
  // arrangement invites would show here as a last sheet that cannot be
  // reached or a DOWN still live on it.
  for (let i = 1; i < sheets; i += 1) await down(page).click();
  expect(await active(), 'the last sheet is out of reach').toBe(sheets);
  await expect(down(page), 'DOWN is live on the last sheet').toBeDisabled();
});

test('SPECS: the arrows walk the contents', async ({ page }) => {
  await page.goto('/SPECS.html');
  await expect(page.locator('[data-toc-row]').first()).toBeVisible();

  const current = () => page.evaluate(() => document.querySelector('[data-toc-row][aria-current="true"]')
    ?.dataset.tocRow || null);
  const rows = await page.locator('[data-toc-row]').evaluateAll(
    nodes => nodes.map(node => node.dataset.tocRow));
  expect(rows.length, 'the contents are empty').toBeGreaterThan(2);
  expect(await current(), 'a section was selected before anything was pressed').toBeNull();

  await down(page).click();
  expect(await current(), 'the first DOWN did not select the first section').toBe(rows[0]);
  await down(page).click();
  expect(await current()).toBe(rows[1]);
  await up(page).click();
  expect(await current(), 'UP did not come back up the contents').toBe(rows[0]);

  // THE EDITOR FOLLOWS, because selecting is what the arrows do -- they are
  // not a scrollbar. A page where the arrows moved the highlight and left the
  // editor on the old section would be two ideas of "the current section".
  await expect(page.locator('[data-editor] .field-label').first()).toContainText(rows[0]);
});
