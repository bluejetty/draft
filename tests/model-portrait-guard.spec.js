// MODEL PRESENTS LANDSCAPE ON A TABLET — board #310, and the page that lost it.
//
// The ruling, quoted at the top of orientation-guard.js: *"MODEL, LAYOUT,
// PROJECT, STANDARDS and SETTINGS always present landscape on a tablet —
// width greater than height, the way they look on a computer. Never the
// portrait arrangement, not even briefly."*
//
// Five pages are named. MODEL.dc.html carried the guard at :130; LAYOUT,
// PROJECT, STANDARDS and SETTINGS all carried it. MODEL.html had it nowhere.
// So on an iPad turned portrait, the page a drafter spends most of their time
// on gave exactly the arrangement the ruling forbids.
//
// ── WHY NOTHING COULD HAVE CAUGHT IT ────────────────────────────────────────
//
// The guard's own gate is `(pointer: coarse)`, and every spec in this repo ran
// at desktop width with a FINE pointer. A suite that never sets a coarse
// pointer cannot see a missing coarse-pointer guard — the absence and the
// all-clear look identical from a desktop context. This is the first check
// here that asks for a finger.
//
// ── AND THE THIRD CASE IS THE ONE THAT MATTERS ──────────────────────────────
//
// orientation-guard.js is emphatic about it: *"DESKTOP IS NOT TOUCHED. The
// gate is a COARSE POINTER, not the aspect ratio: someone dragging a desktop
// window tall must never see this. That is why the test is `(pointer: coarse)`
// and not `innerHeight > innerWidth` alone."* A guard that fired on a tall
// desktop window would be a worse bug than the one being fixed, and a check
// that only proved "portrait is blocked" would pass on exactly that.
const { test, expect } = require('@playwright/test');

const PORTRAIT = { width: 820, height: 1180 };   // iPad, held upright
const LANDSCAPE = { width: 1180, height: 820 };  // the same slab, turned

const guard = page => page.locator('[data-orientation-guard]');

// A FINGER, NOT A MOUSE. hasTouch + isMobile is what makes Chromium report
// `(pointer: coarse)`; asking for the viewport alone would leave the pointer
// fine and test nothing the desktop suite does not already cover.
const touch = { hasTouch: true, isMobile: true };

test.describe('MODEL.html — landscape on a tablet', () => {
  test('a touch device in portrait is covered', async ({ browser }) => {
    const page = await (await browser.newContext({ ...touch, viewport: PORTRAIT })).newPage();
    await page.goto('/MODEL.html');
    await expect(guard(page)).toBeVisible();
    // COVERED COMPLETELY, not merely present. The ruling's promise is that
    // "nothing beneath it can be touched", so a panel that appeared in a
    // corner would satisfy a visibility check and none of the ruling.
    const box = await guard(page).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(PORTRAIT.width - 1);
    expect(box.height).toBeGreaterThanOrEqual(PORTRAIT.height - 1);
    expect(await page.evaluate(() => document.body.dataset.orientationBlocked))
      .toBe('1');
    await page.close();
  });

  test('and steps aside when the tablet is turned', async ({ browser }) => {
    const context = await browser.newContext({ ...touch, viewport: PORTRAIT });
    const page = await context.newPage();
    await page.goto('/MODEL.html');
    await expect(guard(page)).toBeVisible();
    // THE SAME PAGE, TURNED — not a fresh load in landscape. The guard listens
    // and re-applies, and a check that reloaded would pass on a guard that
    // only ever decided once, at boot.
    await page.setViewportSize(LANDSCAPE);
    await expect(guard(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.body.dataset.orientationBlocked))
      .toBe('0');
    await page.close();
  });

  test('a DESKTOP window dragged tall is never covered', async ({ browser }) => {
    // THE CASE THE MODULE IS EMPHATIC ABOUT. Same portrait shape, but a mouse:
    // `(pointer: coarse)` is false, so nothing should happen. Without this, a
    // guard keyed on the aspect ratio alone would pass both checks above and
    // ambush anyone with a tall browser window.
    const page = await (await browser.newContext({ viewport: PORTRAIT })).newPage();
    await page.goto('/MODEL.html');
    await page.waitForTimeout(300);
    await expect(guard(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.body.dataset.orientationBlocked))
      .toBe('0');
    await page.close();
  });

  test('every page the ruling names loads the guard', async ({ page }) => {
    // THE ABSENCE ITSELF, asked of all five rather than of the one that was
    // missing. MODEL.html is the page this suite exists for, but the fault was
    // a port dropping a script tag — and the next port can drop another. This
    // reads the ruling's own list.
    const PAGES = ['/MODEL.html', '/LAYOUT.html', '/PROJECT.html',
      '/STANDARDS.html', '/SETTINGS.html'];
    const missing = [];
    for (const path of PAGES) {
      await page.goto(path);
      const has = await page.evaluate(() => !!window.DraftOrientationGuard);
      if (!has) missing.push(path);
    }
    expect(missing, 'board #310 names these five pages').toEqual([]);
  });
});
