// NEW ON EXT. FINISH GOES HOME AND STARTS A BLANK ONE.
//
// Movie, 28 Sep: *"when i press NEW can you take me back to MODEL page from
// the EXT FINISH page and open a new blank plan"*.
//
// THE PAGE HAS NO DRAWING TO BLANK. EXT. FINISH clads a drawing it does not
// own: it re-reads the shared file, merges `walls` and `roofs` and writes it
// back on every edit. So NEW there is the MODEL space's NEW reached by a link,
// and `?new=1` is how it asks rather than answering -- MODEL owns what a blank
// drawing is, and a second copy of that answer would drift the day it changes.
//
// WHY A SPEC AND NOT A HARNESS. Every part of this is browser: a click, a
// navigation, a URL flag, and a store that must still hold the old drawing
// afterwards. None of it is visible offline.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

async function seed(page) {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
}

test('NEW on EXT. FINISH lands in MODEL on a blank drawing', async ({ page }) => {
  await seed(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForSelector('#elev-list [data-elev]', { timeout: 10000 });

  // THE FIXTURE'S OWN REACH: the page is showing a drawing with walls in it,
  // so "blank afterwards" is a change and not the state it started in.
  const before = await page.evaluate(async bucket => {
    const at = await window.SharedFileStore.loadSharedFileAt(bucket);
    return JSON.parse(await at.file.text()).walls.length;
  }, BUCKET);
  expect(before, 'the seeded drawing has walls to lose').toBeGreaterThan(0);

  await page.locator('#file-new').click();
  await page.waitForURL(/MODEL\.html/, { timeout: 10000 });

  // THE DRAWING ON SCREEN IS EMPTY, read off the readout the way
  // model-file-row.spec.js reads it -- `walls 0/0` is this page's own words
  // for a blank drawing, and a canvas is no use here: a blank sheet and a
  // sheet scrolled off its drawing are the same pixels.
  await expect(page.locator('#readout')).toContainText('walls 0/0', { timeout: 15000 });

  // AND THE FLAG IS SPENT, so a refresh lands in the new drawing rather than
  // blanking the drafter's work a second time.
  //
  // ASKED AFTER THE DRAWING, NOT BEFORE IT. `waitForURL` returns the moment
  // the navigation commits, which is before boot has run a line -- so asked
  // first this raced, and it caught the page spending the flag beside the
  // branch that reads it rather than before its first `await`. The order
  // here is what makes the answer about the page and not about the clock.
  expect(new URL(page.url()).searchParams.get('new'),
    'the flag is spent on arrival').toBeNull();

  // AND IT ARRIVED UNSAVED, which is true -- the store has never seen it.
  await expect(page.locator('[data-model-save]')).toHaveText('UNSAVED');

  // THE STORE STILL HOLDS WHAT WAS THERE. NEW hands the drafter an unsaved
  // blank; it does not reach back and delete the file. Losing the drawing
  // without being asked is the one outcome this must not have.
  const kept = await page.evaluate(async bucket => {
    const at = await window.SharedFileStore.loadSharedFileAt(bucket);
    if (!at.file) return 0;
    return JSON.parse(await at.file.text()).walls.length;
  }, BUCKET);
  expect(kept, 'the stored drawing survives until the drafter saves over it')
    .toBe(before);
});

test('MODEL without the flag still opens the stored drawing', async ({ page }) => {
  // THE OTHER HALF, and it is the half a flag breaks. A `new` branch that
  // fires on every boot would blank the drawing every time MODEL is opened,
  // and the test above would pass exactly as it does now.
  await seed(page);
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).not.toContainText('walls 0/0', { timeout: 15000 });
});
