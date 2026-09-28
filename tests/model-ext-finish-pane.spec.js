// EXT. FINISH IS A PANE ON MODEL'S LEFT EDGE, AND THE ELEVATION UNDER IT
// PAINTS WHAT THE HOUSE IS CLAD IN.
//
// Movie, 27 Sep, having noticed the two pages draw the same picture: *"i think
// we should just put the EXT FINISH commands within the ELEVATIONS on
// MODEL.html area"*, then *"what about adding a tab on left that is EXT FINISH
// and we put it in there"*.
//
// ── WHY THIS IS SMALLER THAN IT LOOKS ───────────────────────────────────────
//
// The painter was always one painter. cut-view's `paintFaceFinish` and
// `paintRoof` have asked for DraftFinishPatterns and DraftRoofPatterns on
// EVERY elevation since the finishes landed, and each warns to the console and
// draws plain when they are missing. MODEL had been taking that warning on
// every elevation it painted -- so its elevations were never a different
// drawing, only the same one with the materials switched off.
//
// ── AND WHY THE SWITCH IS THE PANE ──────────────────────────────────────────
//
// Not a setting, and not always-on. cut-view's own note says what always-on
// would cost: "the construction elevations are line work, and a hatch on them
// would be a change to every sheet in the set that nobody ordered". Both
// readings are right and the pane is what tells them apart. So the check below
// measures BOTH states: a hatch that appeared and never left would pass a
// check that only looked for it.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

// THREE ROOFS, TWO OF THEM THE GARAGE'S -- the shape Movie's own file has, and
// the one that puts the most roofing on the sheet to count.
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-2storey-garage-beam.draft'), 'utf8'));

async function open(page, query) {
  await h.suppressEntryCoach(page);
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async f => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }),
      'model-drawing');
  }, REPRO);
  await page.goto(`/MODEL.html?${query}`);
  await page.waitForSelector('#plan', { timeout: 15000 });
  await page.waitForTimeout(600);
}

// HOW MUCH ROOFING WAS LAID, counted at the painter rather than read off the
// pixels: drawRoofing is called once per roof face that gets a pattern, so
// zero and non-zero is the whole question and no colour or threshold has to be
// chosen. Re-armed after the page has painted once, then the view is nudged so
// it paints again under the recorder.
const roofingLaid = page => page.evaluate(() => {
  const RP = window.DraftRoofPatterns;
  if (!RP) return null;
  window.__laid = 0;
  const real = RP.drawRoofing;
  window.DraftRoofPatterns = { ...RP,
    drawRoofing: (...a) => { window.__laid += 1; return real(...a); } };
  window.dispatchEvent(new Event('resize'));
  return new Promise(res => setTimeout(() => res(window.__laid), 400));
});

test.describe('MODEL — the EXT. FINISH pane', () => {
  test('the left edge carries two tabs and shows one pane at a time',
    async ({ page }) => {
      await open(page, 'view=cut%3AE2&left=1&lpane=tools');
      await expect(page.locator('#left-tab')).toBeVisible();
      await expect(page.locator('#finish-tab')).toBeVisible();
      await expect(page.locator('#left-rail [data-pane="tools"]')).toBeVisible();
      await expect(page.locator('#finish-pane')).toBeHidden();

      // Pressing the other tab SWAPS the pane and leaves the rail open --
      // shutting on a swap would make the second tab cost two presses, which
      // is the rule the right edge already follows.
      await page.locator('#finish-tab').click();
      await expect(page.locator('#finish-pane')).toBeVisible();
      await expect(page.locator('#left-rail [data-pane="tools"]')).toBeHidden();
      await expect(page.locator('#left-rail')).toBeVisible();

      // And pressing the tab that is already up SHUTS the rail.
      await page.locator('#finish-tab').click();
      await expect(page.locator('#left-rail')).toBeHidden();
    });

  test('the elevation paints its roofing while the pane is open, and not while it is shut',
    async ({ page }) => {
      // THE PANE SHUT FIRST, so the zero is measured on a page that has every
      // pattern module loaded. Measuring it before the modules went in would
      // have read zero for the old reason and called the new behaviour proved.
      await open(page, 'view=cut%3AE2&left=1&lpane=tools');
      const plain = await roofingLaid(page);
      expect(plain, 'roof-patterns.js is loaded').not.toBeNull();
      expect(plain, 'line work while EXT. FINISH is shut').toBe(0);

      await open(page, 'view=cut%3AE2&left=1&lpane=finish');
      const clad = await roofingLaid(page);
      expect(clad, 'the roofs are laid while EXT. FINISH is open')
        .toBeGreaterThan(0);
    });

  test('and a shut left rail is line work whichever pane it would show',
    async ({ page }) => {
      // `left` says OPEN or SHUT and `lpane` says WHICH -- two independent
      // facts, which is what lets every check written against ?left=1 keep
      // its meaning. A drafter who shuts the rail on the finish pane is back
      // to the drawing the set prints, not still looking at materials.
      await open(page, 'view=cut%3AE2&lpane=finish');
      expect(await roofingLaid(page),
        'the pane is remembered but shut, so nothing is clad').toBe(0);
    });

  test('the right rail still swaps its own panes', async ({ page }) => {
    // REGRESSION, AND NOT A FORMALITY: setPane grew a `side` argument and
    // syncShell grew a second rail to walk. The right edge's two tabs are
    // driven by the same loop, so a left-hand mistake lands there.
    await open(page, 'right=1&pane=levels');
    await expect(page.locator('#levels-panel')).toBeVisible();
    await page.locator('#previews-tab').click();
    await expect(page.locator('#view-rail')).toBeVisible();
    await expect(page.locator('#levels-panel')).toBeHidden();
    await expect(page.locator('#right-rail')).toBeVisible();
  });

  test('both left tabs stay clear of each other at a short window',
    async ({ page }) => {
      // THE OVERLAP THE RIGHT EDGE'S NOTE WAS WRITTEN ABOUT. #left-tab kept
      // .rail-tab's 52vh cap while it was alone on that edge; a second tab
      // below it collides the moment the window is short, and a fixed pixel
      // top would pass at the one height I happened to try. 600px is a laptop
      // with a browser's chrome taken off it.
      await page.setViewportSize({ width: 1280, height: 600 });
      await open(page, 'view=cut%3AE2&left=1&lpane=tools');
      const boxes = await page.evaluate(() => ['left-tab', 'finish-tab']
        .map(id => { const r = document.getElementById(id).getBoundingClientRect();
          return { id, top: r.top, bottom: r.bottom }; }));
      expect(boxes[0].bottom, `${boxes[0].id} ends at ${boxes[0].bottom}, `
        + `${boxes[1].id} starts at ${boxes[1].top}`)
        .toBeLessThanOrEqual(boxes[1].top);
    });
});
