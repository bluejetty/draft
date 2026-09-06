// A BLOCKED indexedDB OPEN MUST NOT WEDGE THE PAGE.
//
// `indexedDB.open` has three outcomes, not two. Alongside success and error
// there is BLOCKED -- fired when a deleteDatabase is still pending or another
// connection holds the old version -- and while blocked, NEITHER onsuccess NOR
// onerror fires. shared-file-store.js wired the two obvious ones and not the
// third, so a blocked open produced a promise that never settled.
//
// THE PERMANENCE IS THE BUG, not the stall. openDb caches that promise in
// `dbPromise`, and forget() is reachable only from onsuccess, onerror,
// onversionchange and onclose. A promise that never settles reaches none of
// them, so dbPromise is never cleared and every later read on that page awaits
// the same dead promise. One blocked open finishes the page.
//
// The trigger is not hypothetical: eleven spec files call
// `indexedDB.deleteDatabase('pdf-img-mgr-shared')` in their init scripts, and
// that string is exactly DB_NAME. A delete that has not finished closing when
// the next page opens is precisely the blocked case.
//
// This test forces the third outcome directly rather than racing for it, which
// is the only way to make an intermittent into a check that fails every time.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Make the NEXT open on every subsequent navigation report blocked, once.
// Later opens pass through, so a page that handles the first one recovers and
// a page that does not simply never loads.
async function blockFirstOpen(page) {
  await page.addInitScript(() => {
    const real = indexedDB.open.bind(indexedDB);
    let armed = true;
    indexedDB.open = function (...args) {
      if (!armed) return real(...args);
      armed = false;
      const req = {
        onblocked: null, onsuccess: null, onerror: null, onupgradeneeded: null,
        result: null, error: null,
      };
      // Asynchronous, as the real event is: the caller must have wired its
      // handlers before this fires, or the test proves nothing about wiring.
      setTimeout(() => { if (req.onblocked) req.onblocked(new Event('blocked')); }, 0);
      return req;
    };
  });
}

test('a blocked open is survivable — the page opens the drawing anyway', async ({ page }) => {
  // A real saved drawing first, with no stub in the way.
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);

  await blockFirstOpen(page);
  await page.goto('/MODEL.html');

  // WITHOUT the onblocked handler this line is where it dies: the store's
  // promise never settles, the drawing never arrives, and the readout never
  // fills in. It does not fail an assertion -- it runs out of clock, which is
  // exactly how this presented in the wild.
  await expect(page.locator('#readout'),
    'a blocked first open must be recovered from, not waited on forever')
    .toContainText('walls', { timeout: 15000 });
});
