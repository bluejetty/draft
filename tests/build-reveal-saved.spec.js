// SAVED IS A PROMISE, AND THE STAGED REVEAL WAS BREAKING IT.
//
// BUILD HOUSE lands the mid-span beam and its teleposts on TIMERS — "the mini
// reveal, three staged frames: the beam lands, the teleposts follow, then the
// popup" (MODEL.dc.html). Each frame is an ordinary edit with its own save, so
// between two of them the page was clean by every measure it had and said
// SAVED while the rest of the house was still queued behind a timer.
//
// WHAT THAT COST, in two places:
//
//   The drafter. Press the bone, read SAVED, close the tab inside that beat,
//   and the drawing on disk has no beam and no teleposts in it — a house the
//   page said was saved and was not.
//
//   The suite. write-tier.spec.js:580 compares the file the old page wrote
//   against the file MODEL.html writes back, key for key. Its fixture read the
//   file when the page said SAVED — mid-reveal on a quick machine, finished on
//   a slow one — so the comparison found auto columns appearing from nowhere
//   and failed on whichever side the machine landed. Measured on pristine main
//   at da6b177: pass, fail, pass on one commit, with nothing changed between.
//
// THE FIX IS THE CLAIM, NOT THE WRITES. Every stage still reaches the store the
// moment it happens — nothing is held hostage to an animation — but the page no
// longer SAYS saved while a writing stage is still queued.
//
// WHY THIS FILE MEASURES THE FILE AND NOT THE FLAG. `data-build-settling` is
// the mechanism, and a spec that watched it would pass on a page that set the
// flag honestly and still announced SAVED underneath it. What the promise
// means is that nothing arrives after it, so that is what is asserted: read
// when SAVED appears, wait, read again, and the two must be the same file.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// The stored drawing in the shape this file argues about.
const snapshot = page => page.evaluate(async bucket => {
  const store = window.SharedFileStore;
  const at = await store.loadSharedFileAt(bucket);
  const drawing = JSON.parse(await at.file.text());
  return {
    rev: at.rev,
    beams: (drawing.beams || []).length,
    columns: (drawing.columns || []).length,
    walls: (drawing.walls || []).length,
  };
}, h.STORAGE_BUCKET);

// The first house, and NOT through h.waitForSaved — the helper is one of the
// readers this ruling is about, so using it here would be asking the thing
// under test whether it is telling the truth. This waits on the page's own
// words: the status element the drafter reads.
async function firstHouse(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await expect(page.locator('[data-model-status]'))
    .toHaveText('SAVED', { timeout: 8000 });
}

test('when the page first says SAVED, nothing else is still coming', async ({ page }) => {
  await firstHouse(page);
  const claimed = await snapshot(page);

  // LONGER THAN THE WHOLE REVEAL. The last writing stage is armed at 800ms and
  // the popup at 1200ms; two seconds is past both with room for a slow
  // machine, which is the machine this defect hid on.
  await page.waitForTimeout(2000);
  const later = await snapshot(page);

  expect(later, 'the file the page called SAVED is the file that is there a '
    + 'moment later — a stage landing after the claim is the claim being false')
    .toEqual(claimed);
});

test('the structure the bone builds is in the file before SAVED is said', async ({ page }) => {
  await firstHouse(page);
  const claimed = await snapshot(page);

  // THE FIXTURE HAS TO BE THE INTERESTING ONE. A house whose every span is
  // under 19' grows no beam at all, and this file would then be asserting
  // nothing while passing — so the count is a precondition, said out loud.
  expect(claimed.beams,
    'the starter house must need a mid-span beam, or this spec watches an '
    + 'empty reveal and proves nothing').toBeGreaterThan(0);
  expect(claimed.columns,
    'the teleposts are the LAST writing stage, so they are the one the old '
    + 'claim was made in front of').toBeGreaterThan(0);
});

test('the claim is released, not held — the flag clears once the reveal is done',
  async ({ page }) => {
    await firstHouse(page);

    // A "still working" flag that outlives the work is worse than none: every
    // reader waiting on it waits forever, and the suite would hang rather than
    // fail. This is the assertion that names that failure if it ever happens.
    await expect.poll(() => page.evaluate(() => document.body.dataset.buildSettling),
      { timeout: 4000 }).toBe('0');

    // And the beacon the rest of the suite waits on agrees. Both are clean, so
    // h.waitForSaved returns rather than timing out — which is the contract
    // every other spec in this repo is built on.
    await h.waitForSaved(page);
  });
