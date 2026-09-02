// Landscape on every working screen (board #310).
//
// The ruling: MODEL, LAYOUT, PROJECT, SPECS, STANDARDS and SETTINGS always present
// landscape on a tablet. Portrait is blocked BOTH ways up, because upside-down
// portrait is still portrait; both landscape directions are fine. ENTRY is the
// one screen that may follow the device.
//
// The web platform will not hard-lock orientation outside fullscreen, so the
// guarantee is an interstitial that covers the working surface and takes the
// taps. What these specs pin is the GATE: a coarse pointer AND portrait. A
// desktop user dragging a window tall must never see it, which is the failure
// mode a naive aspect-ratio check would have.
const { test, expect } = require('@playwright/test');

const WORK_PAGES = [
  '/MODEL.dc.html',
  '/LAYOUT.dc.html',
  '/PROJECT.html',
  '/SPECS.html',
  '/STANDARDS.html',
  '/SETTINGS.html',
];

const guard = page => page.locator('[data-orientation-guard]');

test.describe('a tablet held portrait', () => {
  test.use({ hasTouch: true, viewport: { width: 768, height: 1024 } });

  test('every working screen shows the turn-your-device panel', async ({ page }) => {
    for (const path of WORK_PAGES) {
      await page.goto(path);
      await expect(guard(page), `${path} guards portrait`).toBeVisible();
      await expect(guard(page)).toContainText(/turn your device/i);
      expect(await page.evaluate(() => document.body.dataset.orientationBlocked)).toBe('1');
    }
  });

  test('the panel takes the taps, so nothing beneath it is reachable', async ({ page }) => {
    await page.goto('/MODEL.dc.html');
    await expect(guard(page)).toBeVisible();
    // Whatever sits at the middle of the screen, the panel is what a finger
    // finds there — the drawing surface is not merely hidden, it is covered.
    const onTop = await page.evaluate(() => {
      const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      return !!(el && el.closest('[data-orientation-guard]'));
    });
    expect(onTop).toBe(true);
  });

  test('ENTRY is exempt and renders normally', async ({ page }) => {
    await page.goto('/index.html');
    await expect(guard(page)).toHaveCount(0);
  });
});

test.describe('a tablet held landscape', () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

  test('no panel on any working screen, either way up', async ({ page }) => {
    for (const path of WORK_PAGES) {
      await page.goto(path);
      await expect(guard(page), `${path} is clear in landscape`).toHaveCount(0);
      expect(await page.evaluate(() => document.body.dataset.orientationBlocked)).toBe('0');
    }
  });

  test('turning the tablet portrait raises the panel, and turning back clears it', async ({ page }) => {
    await page.goto('/MODEL.dc.html');
    await expect(guard(page)).toHaveCount(0);
    // The 180° flip of landscape is still landscape, and still fine.
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(guard(page)).toHaveCount(0);
    // Portrait — either way up — is not.
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(guard(page)).toBeVisible();
    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(guard(page)).toHaveCount(0);
  });
});

test.describe('a desktop window dragged tall', () => {
  // No touch: a fine pointer, which is the whole point of the gate.
  test.use({ hasTouch: false, viewport: { width: 700, height: 1000 } });

  test('never sees the panel, however tall the window', async ({ page }) => {
    for (const path of WORK_PAGES) {
      await page.goto(path);
      await expect(guard(page), `${path} leaves the desk alone`).toHaveCount(0);
    }
  });
});
