// THE ASSEMBLED UNITS STAND BESIDE THEIR GROUP'S NAME.
//
// Movie, 14 Oct, looking at the BUILD rail: "in the BUILD men were it has
// KITCHEN title * and all the kitch stuff below) i like that , oh not sure if
// we can any assembled kitchens yet but we have BATH A , BATH B. bring those
// ASSEMBLED units for BATH and KITCHEN up beside the title (to the right) ...
// and make them a slightly different color", then "give them GOLD or whatever
// the BUILD/ PROPERTIES beside it is using" and "match the BUILT and PROPERTIES
// outline 'currently GOLD'".
//
// WHAT MAKES ONE ASSEMBLED is `preset: true` in fixture-kinds.js, and the
// washroom presets, which are whole ROOMS. The difference the colour carries is
// that one press puts down a kitchen or a washroom, where everything under the
// title is a single cabinet or fixture.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// ON THE DRAFTING BOARD, which is not decoration here: FIXTURE is not a TOY
// tool, so on TOY every chip in this panel is DISABLED -- and `.sel-chip:disabled`
// greys it, accent or no accent. A colour check run on the toy board measures
// the disabled rule and says the accent never arrived.
const openBuild = async page => {
  await h.openModel(page);
  await page.goto('/MODEL.html?right=0&left=1&lpane=build');
  await expect(page.locator('[data-assembled-row="bath"]')).toBeAttached();
  // The DRAFTING press here went with the switch (15 Oct). The chip is live
  // on the board the page opens on, which is what this asserts.
  await expect(page.locator('[data-assembled-row="bath"] [data-washroom="A"]')).toBeEnabled();
};

test('the kitchen and bath presets ride beside their titles, and nothing else does',
  async ({ page }) => {
    await openBuild(page);
    await expect(page.locator('[data-assembled-row="kitchen"] .sel-chip'))
      .toHaveText(['L PRESET']);
    await expect(page.locator('[data-assembled-row="bath"] .sel-chip'))
      .toHaveText(['BATH A', 'BATH B']);
    // A GROUP WITH NO ASSEMBLED UNIT LOOKS EXACTLY AS IT DID. The row is
    // there and empty, which collapses -- LAUNDRY must not grow a gap waiting
    // for a preset nobody has drawn.
    await expect(page.locator('[data-assembled-row="laundry"] .sel-chip')).toHaveCount(0);

    // AND THE PIECES STAY UNDER THE TITLE. The whole point is the two kinds
    // of thing are told apart; a cabinet that climbed up with them would
    // undo it.
    const under = page.locator('[data-tool-group="fixture-kitchen"] > .sel-row .sel-chip');
    await expect(under.first()).toHaveText('CABINET');
    await expect(page.locator('[data-tool-group="fixture-kitchen"] > .sel-row [data-fixture-kind="kitchenL"]'))
      .toHaveCount(0);
  });

test('they wear the accent, which is the gold the selected rail tab wears',
  async ({ page }) => {
    await openBuild(page);
    // READ OFF THE PAGE, not typed here: the point is that the chip and the
    // tab resolve to the SAME token, so the day --accent changes they change
    // together. Typing a hex would pass on a skin nobody is looking at.
    const same = await page.evaluate(() => {
      // THE CHIP THE OTHER CHECKS PRESS, not just the first thing that
      // matches: scoping it keeps this measuring the control he is looking at.
      const chip = document.querySelector('[data-assembled-row="bath"] [data-washroom="A"]');
      // AND THE ACCENT AS IT APPLIES WHERE THE CHIP STANDS. Read off
      // documentElement instead and this compares the wrong two colours: the
      // left pane carries its own --accent (the gold on the rail tabs) over
      // the root's, which is why the chip is gold on a page whose root accent
      // is red. The token is the claim; which value it holds is the skin's.
      const accent = getComputedStyle(chip).getPropertyValue('--accent').trim();
      const probe = document.createElement('div');
      probe.style.color = accent;
      chip.parentNode.appendChild(probe);
      const want = getComputedStyle(probe).color;
      probe.remove();
      const got = getComputedStyle(chip);
      return { colour: got.color === want, border: got.borderTopColor === want,
        accent, shown: got.color };
    });
    expect(same.accent, 'the pane has no accent to borrow').toBeTruthy();
    expect(same.colour, `the chip is ${same.shown}, not the accent ${same.accent}`).toBe(true);
    expect(same.border, 'its outline is not wearing the accent').toBe(true);
  });

test('and they still do what they did — the press is unchanged', async ({ page }) => {
  await openBuild(page);
  // MOVING A BUTTON MUST NOT UNWIRE IT, which is the one way a change that is
  // "only CSS" is not.
  const bathA = page.locator('[data-assembled-row="bath"] [data-washroom="A"]');
  await bathA.click();
  await expect(bathA, 'BATH A did not take the press').toHaveAttribute('aria-pressed', 'true');
  const kitchenL = page.locator('[data-assembled-row="kitchen"] [data-fixture-kind="kitchenL"]');
  await kitchenL.click();
  await expect(kitchenL, 'L PRESET did not take the press').toHaveAttribute('aria-pressed', 'true');
  // AND PICKING ONE PUTS THE OTHER DOWN: a washroom and a kitchen preset are
  // both "what the next press drops", so they cannot both be held.
  await expect(bathA).toHaveAttribute('aria-pressed', 'false');
});
