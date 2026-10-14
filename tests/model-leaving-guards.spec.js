// LEAVING THE PAGE IS LEAVING THE DRAWING.
//
// Movie, 27 Sep, with two screenshots a minute apart: *"something weird is
// happening the PREVIOUSLY created plan is popping back up when i move from
// MODEL area into the EXT FINISH area it switches to the PREVIOUS house ar
// that point"*. MODEL showed a 2 STOREY + GARAGE and the word UNSAVED;
// EXT. FINISH showed the bungalow he had built before it.
//
// IT IS NOT THE OLD PLAN COMING BACK. IT IS THE NEW ONE NEVER LEAVING.
// MODEL holds the drawing in memory and writes it to the shared store on SAVE.
// Every other page READS that store — so it shows the last house that WAS
// saved. And a fresh MODEL reads the same store, so going back does not bring
// the new one home either. The work is gone, and nothing said so.
//
// ── WHAT THIS SUITE IS ACTUALLY FOR ─────────────────────────────────────────
//
// NOT "the dialog appears". A guard that appears and then lets the navigation
// through anyway is the same data loss with a flash of text over it, which is
// worse than none at all because the drafter now believes they were asked. So
// every check here asserts WHERE THE BROWSER ENDED UP, and the ones about
// keeping the work also assert the work is still there afterwards.
//
// AND EVERY "IT WAS BLOCKED" CARRIES AN "IT CAN GO THROUGH". A page that never
// navigates at all satisfies half of this file; the clean-drawing check and
// the Discard check are what stop that passing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const MAIN_FL = 3;

const base = () => ({
  version: 1,
  levels: [{ id: 1, name: 'FOUNDATION', elev: -8 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 1,
  board: 'drafting',
  walls: [
    ['n', V(-14, -14), V(14, -14)], ['e', V(14, -14), V(14, 14)],
    ['s', V(14, 14), V(-14, 14)], ['w', V(-14, 14), V(-14, -14)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: MAIN_FL, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

const readout = page => page.locator('#readout');
const guard = page => page.locator('#file-guard');
// THE DIRTY FLAG AS THE PAGE PUBLISHES IT, the same reading model-html-save
// takes. '1' is unsaved.
const beacon = page => page.evaluate(() => document.body.dataset.saveDirty);
const storedWalls = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text()).walls.length;
}, BUCKET);

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base() });
  await page.goto(`/MODEL.html?level=${MAIN_FL}&view=plan&left=1&lpane=build`);
  await expect(readout(page)).toContainText('walls', { timeout: 10000 });
  return h.planFrame(page);
}

// AN EDIT, MADE BY GESTURE rather than by reaching into the page. What makes
// the drawing dirty has to be the thing a drafter does, or this suite would be
// guarding a flag instead of guarding work.
//
// THREE PRESSES, because a second point is confirmed rather than merely
// clicked — see model-point-confirm.spec.js.
async function drawOneWall(page, f) {
  await page.locator('[data-tool-key="wall"]').click();
  await page.mouse.move(...f.at(0, 0));
  await page.mouse.click(...f.at(0, 0));
  await page.waitForTimeout(50);
  await page.mouse.move(...f.at(9, 0));
  await page.mouse.click(...f.at(9, 0));
  await page.waitForTimeout(50);
  await page.mouse.click(...f.at(9, 0));
  await page.waitForTimeout(60);
  expect(await beacon(page), 'the wall left the drawing unsaved').toBe('1');
}

const extFinish = page => page.locator('#page-row a[data-page="ext-finish"]');

test.describe('MODEL.html — leaving with unsaved work', () => {
  test('pressing another page stops at the guard instead of walking out',
    async ({ page }) => {
      const f = await open(page);
      await drawOneWall(page, f);

      await extFinish(page).click();
      await expect(guard(page)).toBeVisible();
      // THE URL IS THE CHECK, not the dialog. A guard that shows and lets the
      // navigation through is the same loss with a flash of text over it.
      expect(page.url(), 'the browser did not leave').toContain('MODEL.html');
      await expect(page.locator('[data-file-guard-text]'))
        .toContainText('unsaved edits');
    });

  test('Cancel keeps the drafter and the drawing exactly where they were',
    async ({ page }) => {
      const f = await open(page);
      await drawOneWall(page, f);
      await extFinish(page).click();
      await expect(guard(page)).toBeVisible();

      await page.locator('[data-guard-cancel]').click();
      await expect(guard(page)).toBeHidden();
      expect(page.url(), 'Cancel stays on MODEL').toContain('MODEL.html');
      // AND THE WALL IS STILL IN HAND. A Cancel that quietly saved, or quietly
      // dropped the edit, would satisfy the URL check above and lose the work
      // anyway — which is the whole defect wearing a different hat.
      expect(await beacon(page), 'the edit is still unsaved and still there').toBe('1');
      expect(await readout(page).textContent()).toContain('walls 5/5');
    });

  test('Save first writes the drawing and THEN goes', async ({ page }) => {
    const f = await open(page);
    expect(await storedWalls(page), 'the file starts with the four house walls').toBe(4);
    await drawOneWall(page, f);

    await extFinish(page).click();
    await expect(guard(page)).toBeVisible();
    await page.locator('[data-guard-save]').click();

    await page.waitForURL(/EXTFINISH\.html/, { timeout: 10000 });
    // THE POINT OF THE WHOLE EXERCISE: the page he arrives at is looking at
    // the house he just built, because it went into the store on the way.
    expect(await storedWalls(page), 'the wall reached the file before the move')
      .toBe(5);
  });

  // ── SAVE FIRST WHEN ANOTHER TAB HOLDS THE DRAWING ──────────────────────────
  //
  // Movie, 13 Oct: *"i'm tryint to choose SAVE FIRST but nothing is
  // happening"* — with this exact dialog on screen and the corner banner
  // reading BEING EDITED IN ANOTHER TAB at the same moment. The refusal was
  // right: another tab held the lease, so the write would have been refused
  // by the store, and the page declines to spend the drafter's attention
  // finding that out. What was wrong is that the dialog said nothing. The
  // whole answer was a chip in the opposite corner of the screen, behind the
  // modal he was looking at.
  //
  // So: the same sentence under the three answers, and the one press that
  // resolves it beside it. The refusal itself is unchanged — this is about
  // the dialog being legible, not about letting the save through.
  //
  // MUTATION: drop `fileGuardLease.hidden = held` from paintLease. Fails.
  test('SAVE FIRST refused by the lease says so under the buttons, and TAKE '
    + 'OVER there is the way through', async ({ page, context }) => {
      const f = await open(page);
      await expect(page.locator('body'),
        'this page starts with the drawing').toHaveAttribute('data-lease-held', '1',
        { timeout: 10000 });
      expect(await storedWalls(page)).toBe(4);
      await drawOneWall(page, f);

      // Another tab takes it — the state the screenshot was in.
      const other = await context.newPage();
      await other.goto('/MODEL.html?mode=night');
      await expect(other.locator('#readout')).toContainText('walls', { timeout: 10000 });
      await other.locator('[data-take-over]').click();
      await expect(other.locator('body')).toHaveAttribute('data-lease-held', '1',
        { timeout: 10000 });
      await expect(page.locator('body'),
        'and this one knows it has lost it').toHaveAttribute('data-lease-held', '0',
        { timeout: 12000 });

      await extFinish(page).click();
      await expect(guard(page)).toBeVisible();
      const note = page.locator('[data-guard-lease]');
      await expect(note,
        'the dialog itself says why SAVE FIRST cannot save').toBeVisible();
      await expect(note).toContainText(/being edited in another tab/i);
      // UNDER THE THREE ANSWERS, which is where he was looking. The corner
      // banner was already on screen and carried the same words; being in the
      // corner is the entire reason it did not land.
      expect(await page.evaluate(() => {
        const row = document.querySelector('#file-guard .promote-row');
        const n = document.querySelector('[data-guard-lease]');
        return !!(row && n
          && (row.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING));
      }), 'under the buttons, not above them').toBe(true);

      // THE PRESS THAT APPEARED TO DO NOTHING. It still does not save — the
      // store would refuse it — but the dialog no longer sits there mute, and
      // the edit is still in hand.
      await page.locator('[data-guard-save]').click();
      await page.waitForTimeout(800);
      await expect(guard(page), 'the guard stays up, holding the question').toBeVisible();
      expect(page.url(), 'and the browser did not leave').toContain('MODEL.html');
      expect(await storedWalls(page), 'nothing was written').toBe(4);
      expect(await beacon(page), 'and the wall is still unsaved, still there').toBe('1');
      await expect(note, 'with the reason still on screen').toBeVisible();

      // The resolution, in the dialog rather than across the screen. It takes
      // the lease and nothing else: SAVE FIRST is still the commit point.
      await page.locator('#file-guard [data-guard-take-over]').click();
      await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1',
        { timeout: 10000 });
      await expect(note, 'the note goes when the reason for it goes').toBeHidden();
      await expect(guard(page), 'and the question is still being asked').toBeVisible();

      await page.locator('[data-guard-save]').click();
      await page.waitForURL(/EXTFINISH\.html/, { timeout: 12000 });
      expect(await storedWalls(page), 'and now SAVE FIRST saves').toBe(5);
    });

  // AND THE NOTE IS NOT SIMPLY ALWAYS THERE. Every "it is visible" check
  // above is satisfied by a note that was never hidden — which is the shape
  // of bug this page has already shipped once, an inline style beating
  // `[hidden]` on the lease banner itself.
  test('a page that holds the drawing shows no such note', async ({ page }) => {
    const f = await open(page);
    await expect(page.locator('body')).toHaveAttribute('data-lease-held', '1',
      { timeout: 10000 });
    await drawOneWall(page, f);
    await extFinish(page).click();
    await expect(guard(page)).toBeVisible();
    await expect(page.locator('[data-guard-lease]')).toBeHidden();
    await expect(page.locator('[data-lease-banner]'),
      'nor the corner banner it mirrors').toBeHidden();
  });

  test('Discard goes, and is honest about it', async ({ page }) => {
    const f = await open(page);
    await drawOneWall(page, f);

    await extFinish(page).click();
    await expect(guard(page)).toBeVisible();
    await page.locator('[data-guard-discard]').click();

    await page.waitForURL(/EXTFINISH\.html/, { timeout: 10000 });
    // DISCARD MEANS DISCARD. The drafter was asked and said go, so the file is
    // untouched — this check is here so that "Save first" above is measuring
    // the save rather than measuring that anything at all writes on the way
    // out.
    expect(await storedWalls(page), 'Discard wrote nothing').toBe(4);
  });

  test('a clean drawing walks straight through, with nothing in the way',
    async ({ page }) => {
      await open(page);
      expect(await beacon(page), 'a freshly loaded drawing is clean').toBe('0');

      await extFinish(page).click();
      await page.waitForURL(/EXTFINISH\.html/, { timeout: 10000 });
      // WITHOUT THIS THE WHOLE FILE PASSES ON A PAGE THAT NEVER NAVIGATES.
      // A guard that stops everything is not a guard, it is a wall, and every
      // check above would be satisfied by one.
    });

  test('a ctrl-press is not a departure', async ({ page }) => {
    const f = await open(page);
    await drawOneWall(page, f);

    // OPENING THE DESTINATION SOMEWHERE ELSE LEAVES THIS PAGE WHERE IT IS,
    // drawing and all — so there is nothing to save before doing it, and
    // asking would be the page not understanding what it was just told.
    await extFinish(page).click({ modifiers: ['Control'] });
    await page.waitForTimeout(150);
    await expect(guard(page)).toBeHidden();
    expect(page.url(), 'this page did not move').toContain('MODEL.html');
    expect(await beacon(page), 'and still holds the edit').toBe('1');
  });
});
