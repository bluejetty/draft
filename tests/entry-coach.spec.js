// THE FIRST HOUSE — the first press teaches the second.
//
// You arrive in MODEL by pressing the logo on the entry page, and a 287px
// bone is waiting dead centre -- the first bone you have seen, because the
// entry page stopped showing one on 4 Sep (Movie: nobody sees a bone until
// they are in model space). A beat later everything around it dims. Press it
// and a house exists.
//
// One button, nothing asked and nothing chosen — which is why this is a
// ceremony and not a form. (It used to be two presses of one button that
// never moved, the entry bone and this one; the second half is what remains.)
//
// NO ARROWS AND NO WORDS (Movie, 2 Sep: "the user can figure it out"). They
// were here because the bone that came with you used to be the 44px one in the
// top bar — the same picture, a sixth the size, somewhere else — and something
// had to explain where it went. Keeping the big one deletes the question
// rather than answering it, which is why this spec no longer looks for
// PRESS BUTTON TO BUILD HOUSE PLAN.
//
// The beat matters and is not decoration: the model area is seen unobstructed
// first. A scrim that arrived with the page would read as a wall between you
// and the app.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const coach = page => page.locator('[data-entry-coach]');
const bigBone = page => page.locator('[data-first-bone-press]');
const bone = page => page.locator('[data-build-house]');

// The coach is once-ever, so a spec that wants to see it has to arrive as
// somebody who never has. Cleared ONCE and not on every navigation -- an init
// script runs again on each reload, and clearing the flag there would hand the
// coach back exactly where these specs are checking it stays gone.
// Opting IN: every other spec is seeded as having seen it, because a scrim a
// second after opening would otherwise put every suite's rails behind a tint.
const asNewcomer = { webgl: false, rails: false, entryCoach: true };

test.describe('The entry coach', () => {
  test('the big bone is there from the start; the scrim waits a beat', async ({ page }) => {
    await h.openModel(page, asNewcomer);

    // The bone does not wait for anything. It is plain HTML before <x-dc>, so
    // it is on screen before React, the DC runtime and the class have booted —
    // which is the whole reason it is not part of the component.
    await expect(bigBone(page)).toBeVisible();

    // The scrim does wait. The beat is the point: the model area is seen
    // unobstructed first.
    await expect(coach(page)).toHaveCount(0);
    await expect(coach(page)).toBeVisible({ timeout: 4000 });

    // And nothing is said. No arrows, no line of text — the button that has
    // not moved is the whole instruction.
    await expect(page.locator('[data-entry-coach-line]')).toHaveCount(0);
    await expect(page.locator('[data-entry-coach-arrows]')).toHaveCount(0);
  });

  test('pressing the big bone invents a shape and builds the house', async ({ page }) => {
    await h.openModel(page, asNewcomer);
    await expect(coach(page)).toBeVisible({ timeout: 4000 });

    await bigBone(page).click();
    await h.waitForSaved(page);

    // The house is the assertion. Before this change the press dismissed the
    // scrim and then asked for an outline nobody had drawn — which is the bug
    // this whole board exists to fix.
    const saved = await h.savedDrawing(page);
    expect(saved.walls.length).toBeGreaterThan(0);

    // And the bone has done its one job.
    await expect(bigBone(page)).toHaveCount(0);
    await expect(coach(page)).toHaveCount(0);
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

  test('the top-bar bone also builds, and the scrim is spent', async ({ page }) => {
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

  test('a press anywhere on the scrim builds, and it stays away', async ({ page }) => {
    await h.openModel(page, asNewcomer);
    await expect(coach(page)).toBeVisible({ timeout: 4000 });

    // A press ANYWHERE on the scrim builds too. The bone is the target and the
    // scrim is the forgiveness: with nothing to aim at there is nothing to
    // miss, and a first-timer who stabs at the screen gets a house rather than
    // a dismissal.
    await coach(page).click({ position: { x: 40, y: 40 } });
    await h.waitForSaved(page);
    const built = await h.savedDrawing(page);
    expect(built.walls.length).toBeGreaterThan(0);
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
