// PHONES AND TABLETS (jb, 26 Nov 2026): "put the note in".
//
// A touch-only device (a finger, no mouse or trackpad) sees one card on the
// first page it opens: the program is built for a computer, and here is what
// works on this device. GOT IT keeps it a TOUCH device, PC MODE treats it as
// a computer; either answer is remembered and the card does not come back.
// A computer never sees it (touch-device.js).
const { test, expect } = require('@playwright/test');

const note = page => page.locator('[data-touch-note]');
const modeOf = page => page.evaluate(() => document.body.dataset.deviceMode);

test.describe('a tablet (finger only)', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 1180, height: 820 } });

  test('the card shows once, and GOT IT keeps the tablet in TOUCH', async ({ page }) => {
    await page.goto('/index.html');
    await expect(note(page)).toBeVisible();
    await expect(note(page)).toContainText('built for a computer');
    await expect(note(page)).toContainText("Here's what you can do on this tablet");
    await expect(note(page).locator('[data-touch-pc]')).toBeVisible();
    await note(page).locator('[data-touch-ok]').click();
    await expect(note(page)).toHaveCount(0);
    expect(await modeOf(page)).toBe('touch');
    // REMEMBERED: the next page does not ask again.
    await page.goto('/SPECS.html');
    await expect(note(page)).toHaveCount(0);
    expect(await modeOf(page)).toBe('touch');
  });

  test('PC MODE is remembered, and SETTINGS can turn it back and show the card', async ({ page }) => {
    await page.goto('/STANDARDS.html');
    await note(page).locator('[data-touch-pc]').click();
    await expect(note(page)).toHaveCount(0);
    expect(await modeOf(page)).toBe('pc');
    await page.goto('/SETTINGS.html');
    await expect(note(page)).toHaveCount(0);
    const pick = page.locator('[data-device-mode-select]');
    await expect(pick).toHaveValue('pc');
    await pick.selectOption('touch');
    expect(await modeOf(page)).toBe('touch');
    await page.locator('[data-device-note-again]').click();
    await expect(note(page)).toBeVisible();
  });

  test('a real key with no box focused offers PC MODE', async ({ page }) => {
    await page.goto('/index.html');
    await note(page).locator('[data-touch-ok]').click();
    await page.keyboard.press('a');
    const hint = page.locator('[data-touch-hint]');
    await expect(hint).toBeVisible();
    await hint.locator('[data-touch-hint-yes]').click();
    expect(await modeOf(page)).toBe('pc');
  });
});

test.describe('a phone (finger only)', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 844, height: 390 },
    screen: { width: 844, height: 390 } });

  test('says phone', async ({ page }) => {
    await page.goto('/index.html');
    await expect(note(page)).toContainText("Here's what you can do on this phone");
  });
});

test.describe('a computer', () => {
  test('never sees the card, and is a computer', async ({ page }) => {
    for (const path of ['/index.html', '/SPECS.html', '/SETTINGS.html']) {
      await page.goto(path);
      await expect(note(page)).toHaveCount(0);
      expect(await modeOf(page)).toBe('computer');
    }
    await page.keyboard.press('a');
    await expect(page.locator('[data-touch-hint]')).toHaveCount(0);
  });
});
