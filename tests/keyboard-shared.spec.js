// Shortcut defaults and key normalisation have one source of truth
// (profile-manager.js); Model Space and Settings both read it.
const { test, expect } = require('@playwright/test');
const { openModel } = require('./helpers');

test('Model Space labels its tools from the shared defaults', async ({ page }) => {
  await openModel(page);

  const shared = await page.evaluate(() => window.DraftKeyboard.DEFAULT_KEYBINDINGS);
  await expect(page.getByRole('button', { name: new RegExp(`^Line\\s+${shared.line}$`, 'i') })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^Wall\\s+${shared.wall}$`, 'i') })).toBeVisible();
});

test('no page re-declares the keyboard helpers', async ({ page }) => {
  for (const path of ['/MODEL.dc.html', '/SETTINGS.html', '/LAYOUT.dc.html']) {
    const source = await (await page.request.get(path)).text();
    expect(source, `${path} declares its own defaults`).not.toMatch(/(const|let|var)\s+DEFAULT_KEYBINDINGS\s*=/);
    expect(source, `${path} declares its own normaliser`).not.toMatch(/function\s+normaliseKeyBinding/);
  }
});

test('the shared matcher honours modifiers', async ({ page }) => {
  await openModel(page);

  const results = await page.evaluate(() => {
    const { eventMatchesBinding, normaliseKeyBinding } = window.DraftKeyboard;
    const ev = (key, mods = {}) => ({ key, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...mods });
    return {
      plain:        eventMatchesBinding(ev('z'), 'Ctrl+Z'),
      withCtrl:     eventMatchesBinding(ev('z', { ctrlKey: true }), 'Ctrl+Z'),
      extraShift:   eventMatchesBinding(ev('z', { ctrlKey: true, shiftKey: true }), 'Ctrl+Z'),
      redo:         eventMatchesBinding(ev('z', { ctrlKey: true, shiftKey: true }), 'Ctrl+Shift+Z'),
      space:        eventMatchesBinding(ev(' '), 'Space'),
      unbound:      eventMatchesBinding(ev('q'), ''),
      normalisedEsc: normaliseKeyBinding('esc'),
    };
  });

  expect(results).toEqual({
    plain: false,
    withCtrl: true,
    extraShift: false,
    redo: true,
    space: true,
    unbound: false,
    normalisedEsc: 'Escape',
  });
});

test('number keys no longer switch views', async ({ page }) => {
  await openModel(page);

  const shared = await page.evaluate(() => window.DraftKeyboard.DEFAULT_KEYBINDINGS);
  expect(shared).not.toHaveProperty('perspective');
  expect(shared).not.toHaveProperty('top');
  expect(shared).not.toHaveProperty('front');
  expect(shared).not.toHaveProperty('side');

  const viewChip = page.locator('text=TOP / PLAN').last();
  await expect(viewChip).toBeVisible();
  for (const key of ['1', '2', '3', '4']) {
    await page.keyboard.press(key);
    await expect(viewChip).toBeVisible();
  }
});

test('Extend answers to X and Ctrl+H', async ({ page }) => {
  await openModel(page);

  const extendPanel = page.getByRole('button', { name: 'CURRENT LEVEL' });

  await page.keyboard.press('x');
  await expect(extendPanel).toBeVisible();

  await page.keyboard.press('s');
  await expect(extendPanel).toHaveCount(0);

  await page.keyboard.press('Control+h');
  await expect(extendPanel).toBeVisible();
});

