// THE ENTRY COACH — the first press teaches the second.
//
// You arrive in MODEL by pressing the bone on the entry page. The logo does
// not come with you and the bone does, so the one thing you already know how
// to press is the one thing still on screen. A beat later everything around it
// dims and it gets named:
//
//   PRESS BUTTON TO BUILD HOUSE PLAN
//
// Two presses of the same button, in the same place, and you have a house.
// Nothing is asked and nothing is chosen — which is why this is a ceremony and
// not a form.
//
// The beat matters and is not decoration: the model area is seen unobstructed
// first, and only then pointed at. A scrim that arrived with the page would
// read as a wall between you and the app.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const coach = page => page.locator('[data-entry-coach]');
const line = page => page.locator('[data-entry-coach-line]');
const bone = page => page.locator('[data-build-house]');

// The coach is once-ever, so a spec that wants to see it has to arrive as
// somebody who never has. Cleared ONCE and not on every navigation -- an init
// script runs again on each reload, and clearing the flag there would hand the
// coach back exactly where these specs are checking it stays gone.
// Opting IN: every other spec is seeded as having seen it, because a scrim a
// second after opening would otherwise put every suite's rails behind a tint.
const asNewcomer = { webgl: false, rails: false, entryCoach: true };

test.describe('The entry coach', () => {
  test('waits a beat, then names the bone', async ({ page }) => {
    await h.openModel(page, asNewcomer);

    // The beat is the point: the model area is unobstructed at first.
    await expect(coach(page)).toHaveCount(0);

    await expect(coach(page)).toBeVisible({ timeout: 4000 });
    await expect(line(page)).toHaveText('PRESS BUTTON TO BUILD HOUSE PLAN');
  });

  test('the bone is cut out of the tint, not covered by it', async ({ page }) => {
    await h.openModel(page, asNewcomer);
    await expect(coach(page)).toBeVisible({ timeout: 4000 });

    // An instruction you cannot follow is worse than no instruction. The bone
    // has to be the thing that receives the press at its own position, with
    // the scrim covering everything else.
    const box = await bone(page).boundingBox();
    const onTop = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return !!el?.closest('[data-build-house]');
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    expect(onTop).toBe(true);

    // And the scrim really is over the rest of the screen.
    const overCanvas = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-canvas]').getBoundingClientRect();
      const el = document.elementFromPoint(canvas.left + 30, canvas.bottom - 30);
      return !!el?.closest('[data-entry-coach]');
    });
    expect(overCanvas).toBe(true);
  });

  test('the second press builds the house, and the coach is spent', async ({ page }) => {
    await h.openModel(page, asNewcomer);
    await expect(coach(page)).toBeVisible({ timeout: 4000 });

    await bone(page).click();
    await expect(coach(page)).toHaveCount(0);

    // Once, ever. Someone who has built a house does not need telling where
    // the bone is, and a coach that comes back is a nag.
    await page.reload();
    await h.waitForModelReady(page);
    await page.waitForTimeout(1800);
    await expect(coach(page)).toHaveCount(0);
  });

  test('it can be waved away, and stays away', async ({ page }) => {
    await h.openModel(page, asNewcomer);
    await expect(coach(page)).toBeVisible({ timeout: 4000 });

    // Waving it away and following it are the same statement -- "I have it" --
    // so neither earns a second showing.
    await coach(page).click({ position: { x: 40, y: 40 } });
    await expect(coach(page)).toHaveCount(0);

    await page.reload();
    await h.waitForModelReady(page);
    await page.waitForTimeout(1800);
    await expect(coach(page)).toHaveCount(0);
  });

  test('it never appears over a drawing that already exists', async ({ page }) => {
    // Drawn as an ordinary visit, with the coach suppressed, so the tools are
    // reachable. The newcomer flag is cleared afterwards -- the point is that
    // even somebody the app has never seen gets no coach over a drawing that
    // already exists.
    await h.openModel(page, { webgl: false });
    await h.selectTool(page, 'Wall');
    await h.clickWorld(page, -8, 0);
    await h.clickWorld(page, 8, 0);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);

    // "Build a house" is nonsense pointed at a drawing that has one, and
    // somebody reopening their own work is not on their first run whatever a
    // flag says.
    await page.evaluate(() => {
      try { localStorage.removeItem('draft-entry-coach-seen'); } catch (err) { /* private window */ }
    });
    await page.reload();
    await h.waitForModelReady(page, { rails: false });
    await page.waitForTimeout(1800);
    await expect(coach(page)).toHaveCount(0);
  });
});

// THE ENTRY PRESS IS HELD. The bone on the entry page is an ordinary link, so
// without help the navigation starts on the click and the crunch is torn out
// mid-bite -- a sound cut off by a page turn is worse than no sound at all.
// index.html therefore takes the click, plays the bone, and turns the page on
// a timer.
//
// This pins that the hold EXISTS. It deliberately does not pin its length as
// an upper bound: the hold is 420ms against a 710ms bone, a chosen truncation
// recorded at the number itself, and asserting a ceiling on a measured
// duration is how a suite starts failing on a loaded runner rather than on a
// broken app. The floor is safe in a way a ceiling is not -- a timer can be
// late, never early.
test('the entry bone is heard before the page turns', async ({ page }) => {
  // The stub goes in ahead of bone-sound.js, whose own `if (!window
  // .DraftBoneSound)` guard then leaves it alone. Times are written to
  // sessionStorage because the thing being measured is a navigation, and the
  // page that starts it is gone by the time there is an answer.
  await page.addInitScript(() => {
    try { sessionStorage.setItem('arrived:' + location.pathname, String(Date.now())); } catch (err) { /* nothing to record */ }
    window.DraftBoneSound = {
      crunch: opts => {
        try { sessionStorage.setItem('crunch', JSON.stringify({ at: Date.now(), big: !!(opts && opts.big) })); } catch (err) { /* nothing to record */ }
      },
      announce: () => false,
      hush: () => {},
    };
  });

  await page.goto('/index.html');
  await page.locator('.enter-bone').click();
  await page.waitForURL(/MODEL\.dc\.html/, { timeout: 15000 });

  const timing = await page.evaluate(() => ({
    crunch: JSON.parse(sessionStorage.getItem('crunch') || 'null'),
    arrived: Number(sessionStorage.getItem('arrived:/MODEL.dc.html')),
  }));

  // The BIG bone, not the build row's small one: this is the press that starts
  // something, and the two are kept apart in bone-sound.js so they cannot drift.
  expect(timing.crunch).not.toBeNull();
  expect(timing.crunch.big).toBe(true);

  // Held. 250 is well under the 420 the page asks for, so this reports a hold
  // that was removed rather than a runner that was busy.
  expect(timing.arrived - timing.crunch.at).toBeGreaterThanOrEqual(250);
});
