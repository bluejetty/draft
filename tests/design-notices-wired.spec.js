// DESIGN NOTICES REACH A DRAFTER — the half design-notices.js could not test.
//
// The module shipped in #318 with 27 checks and 18 mutations proving what it
// SAYS. It had zero callers: no page loaded it, so nothing it said reached
// anyone. Devin, 7 Sep: "an exported module with zero callers is a dead claim
// sitting in the repo." A harness cannot close that; only a page test can.
//
// Both tests here assert the notice's ABSENCE as well as its presence, and the
// absence is the half that matters. A banner that appears once and never
// leaves says the wall is still short after the drafter has fixed it -- and a
// test that only checks it appears would pass on exactly that bug.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// ── PROJECT: the garage door head ─────────────────────────────────────────
//
// The head hangs a fixed drop under the top plate, so it follows the wall down
// without anyone wiring it. project-page.js has said since 5 Sep that "a 7'-0"
// overhead door needs OPENING_HEAD_DROP_IN above its head, so the wall has to
// reach 8'-4 1/2". The house precut is 8'-1 1/8". The default garage could not
// be built as drawn." That sentence is what this test drives.
test('the garage door head notice appears only when the wall cannot clear a door',
  async ({ page }) => {
    await page.goto('/PROJECT.html');
    const notice = page.locator('#garage-door-head-notice');
    const wall = page.locator('#sched-garage .sched-row')
      .filter({ has: page.locator('.sched-name', { hasText: 'Garage wall height' }) })
      .locator('.sched-value');
    await expect(wall).toHaveCount(1);

    // ONE: the shipped default clears a 7'-0" door, so the page says nothing.
    // 9'-1 1/8" less the 16 1/2" drop is a 7'-8 5/8" head.
    await expect(notice).not.toBeVisible();

    // TWO: type the house precut into the garage, which is the exact mistake
    // the file's comment describes -- a wall that reads fine and cannot hold
    // its own door.
    await wall.fill(`8'-1 1/8"`);
    await wall.dispatchEvent('change');
    await expect(notice).toBeVisible();
    // The numbers, not just the banner: 8'-1 1/8" - 16 1/2" = 6'-8 5/8", which
    // is 3 3/8" under the door, and 80" is the tallest that still fits.
    await expect(notice).toContainText(`6'-8 5/8"`);
    await expect(notice).toContainText(`3 3/8"`);
    await expect(notice).toContainText(`80"`);
    // Movie, 6 Sep: "the user will need to take the door limitation height
    // into consideration for their design." So it reports, never adjusts.
    await expect(notice).toContainText('has not been changed');

    // THREE, AND THIS IS THE HALF A PRESENCE-ONLY TEST WOULD MISS: put the
    // wall back and the banner has to GO. Board #313 cuts both ways -- the
    // page may not move the drawing, and it may not keep warning about a
    // drawing that has moved.
    await wall.fill(`9'-1 1/8"`);
    await wall.dispatchEvent('change');
    await expect(notice).not.toBeVisible();
  });

// ── MODEL: the stair that no longer fits what it was drawn for ────────────
//
// A stair re-derives its rise from the level heights on every paint and never
// writes the new one back, so `stair.riseFt` is the rise at PLACEMENT. Edit a
// wall height and the stored number is silently stale forever. Board #313
// forbids moving the stair; this is the page saying so instead.
test('the stair refit notice appears when a placed stair no longer fits its rise',
  async ({ page }) => {
    // A HOUSE FIRST. The seed below edits the SAVED drawing, and there is no
    // saved drawing until the bone builds one -- the first attempt at this
    // test read `null.text()` for exactly that reason.
    // RAILS ON: armStairTool clicks the STAIR button, and rails:false leaves
    // no rail to click. The first run of this test timed out on exactly that.
    await h.openModel(page, { webgl: false, entryCoach: true });
    await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
    await page.locator('[data-first-bone-press]').click();
    await h.waitForSaved(page);

    const banner = page.locator('[data-stair-refit-notice]');
    const armStairTool = () => h.selectTool(page, 'stair');

    // A stair whose PLACED rise is a foot shallower than the house now gives
    // it. Written through the saved drawing rather than by drawing one: the
    // subject is the notice, and placing a stair by hand would make this a
    // test of the stair tool that happens to end in a banner.
    const seed = async riseFt => page.evaluate(async ({ bucket, rise }) => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const drawing = JSON.parse(await file.text());
      drawing.stairs = [{
        id: 7501, levelId: 3, view: 'plan', layer: 'A-STR',
        start: { x: -2, z: 0 }, end: { x: 8, z: 0 },
        widthFt: 3, rail: 'both',
        ...(rise === null ? {} : { riseFt: rise }),
        shape: 'straight', turn: 'right', winders: 0,
      }];
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
    }, { bucket: 'model-drawing', rise: riseFt });

    // ONE: A STAIR WITH NO PLACED RISE IS NOT A DRIFTING STAIR, and the
    // module says so -- "a stair drawn before the field existed, not a stair
    // that has drifted." A guaranteed-quiet case that needs no knowledge of
    // what the house's rise currently is, and it exercises a real branch
    // rather than standing in for one.
    await seed(null);
    await page.reload();
    await h.waitForModelReady(page);
    await armStairTool();
    await expect(banner).toHaveCount(0);

    // TWO: a stair placed for a 3'-0" rise. Deliberately absurd for a storey
    // -- 36" at the 7 7/8" maximum is 5 risers, a count no real level height
    // can produce -- so this DIFFERS from the live rise whatever the live
    // rise is. The same control model-html-stairs.spec.js uses, and it means
    // this test does not go red the next time a wall height is ruled on.
    await seed(3);
    await page.reload();
    await h.waitForModelReady(page);
    await armStairTool();
    await expect(banner).toHaveCount(1);
    await expect(banner).toContainText('risers instead of');
    await expect(banner).toContainText('Nothing has been moved');
  });
