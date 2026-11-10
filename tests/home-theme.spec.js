// THE DOOR DECIDES THE FIRST SKIN.
//
// Movie, 9 Nov 2026: "when they come from ROUGHDRAFTER.COM (or bluejetty) i'd
// like them to go to the ROUGH DRAFTER VERSION first, if they go to
// RUFFDRAFTER.com, then the one with the bone first". palette.js answers
// that in one place, DraftPalette.homeTheme(hostname), and every page's
// fallback reads it instead of the literal 'ruff' it carried before.
//
// Three things are pinned: the table itself; that a page served under the
// public names wears the right brand on its first frame; and that the rule
// is only a FALLBACK -- a stored pick and a ?theme= in the address still win,
// exactly as they did before the rule existed.
//
// THE PUBLIC NAMES ARE PLAYED, NOT RESOLVED. Playwright routes every request
// to https://roughdrafter.com and https://ruffdrafter.com back to the suite's
// own server, so the page believes its hostname and no DNS is consulted.
// Each name is its own origin, so its localStorage starts empty -- which is
// precisely the "chosen nothing yet" visit the rule is for.
const { test, expect } = require('@playwright/test');

const PUBLIC = /^https:\/\/(ruffdrafter|roughdrafter)\.com\//;

async function playPublicNames(page, baseURL) {
  // A public name is not a desk, so traffic-counter.js would report the hit;
  // the suite speaks to no host but its own (tests/no-third-party.spec.js).
  await page.route(/goatcounter\.com/, route => route.abort());
  await page.route(PUBLIC, async route => {
    const u = new URL(route.request().url());
    const response = await route.fetch({ url: baseURL + u.pathname + u.search });
    await route.fulfill({ response });
  });
}

const themeOn = page => page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const skinOn = page => page.evaluate(() => [document.documentElement.getAttribute('data-theme'),
  document.documentElement.getAttribute('data-mode')].join('/'));

test('homeTheme: ruff behind a name that says ruff, rough behind any other name, ruff on a desk', async ({ page }) => {
  await page.goto('/SETTINGS.html');
  const table = await page.evaluate(() => {
    const P = window.DraftPalette;
    return Object.fromEntries([
      'ruffdrafter.com', 'www.ruffdrafter.com', 'RUFFDRAFTER.COM',
      'roughdrafter.com', 'www.roughdrafter.com', 'draft.bluejetty.ca', 'bluejetty.github.io',
      'localhost', '127.0.0.1', '[::1]', '',
    ].map(host => [host, P.homeTheme(host)]));
  });
  expect(table).toEqual({
    'ruffdrafter.com': 'ruff', 'www.ruffdrafter.com': 'ruff', 'RUFFDRAFTER.COM': 'ruff',
    'roughdrafter.com': 'rough', 'www.roughdrafter.com': 'rough',
    'draft.bluejetty.ca': 'rough', 'bluejetty.github.io': 'rough',
    'localhost': 'ruff', '127.0.0.1': 'ruff', '[::1]': 'ruff', '': 'ruff',
  });
  // With no argument it reads the page's own host -- the suite's desk.
  expect(await page.evaluate(() => window.DraftPalette.homeTheme())).toBe('ruff');
  expect(await page.evaluate(() => [window.DraftPalette.homeMode('rough'), window.DraftPalette.homeMode('ruff')]))
    .toEqual(['day', 'night']);
});

test('a first visit from roughdrafter.com wears ROUGH; from ruffdrafter.com, RUFF', async ({ page, baseURL }) => {
  await playPublicNames(page, baseURL);
  for (const file of ['MODEL.html', 'SETTINGS.html', 'LAYOUT.html', 'PROJECT.html', 'BONEYARD.html']) {
    await page.goto(`https://roughdrafter.com/${file}`);
    // AND THE LIGHT FOLLOWS THE BRAND (Movie, 9 Nov 2026): the plain board
    // opens on white paper, the bone keeps its night.
    expect(await skinOn(page), `${file} off roughdrafter.com`).toBe('rough/day');
    await page.goto(`https://ruffdrafter.com/${file}`);
    expect(await skinOn(page), `${file} off ruffdrafter.com`).toBe('ruff/night');
  }
});

test('the door is only a fallback: a stored pick and a ?theme= still win', async ({ page, baseURL }) => {
  await playPublicNames(page, baseURL);
  await page.goto('https://roughdrafter.com/SETTINGS.html');
  expect(await themeOn(page)).toBe('rough');
  // The drafter pressed RUFF yesterday: RUFF on roughdrafter.com today.
  await page.evaluate(() => localStorage.setItem('draft-skin', JSON.stringify({ theme: 'ruff', mode: 'night' })));
  await page.goto('https://roughdrafter.com/SETTINGS.html');
  expect(await skinOn(page), 'the stored pick, mode included').toBe('ruff/night');
  // A stored DAY on ROUGH and a stored NIGHT on ROUGH both hold: the door
  // never overrules what the drafter pressed.
  await page.evaluate(() => localStorage.setItem('draft-skin', JSON.stringify({ theme: 'rough', mode: 'night' })));
  await page.goto('https://roughdrafter.com/SETTINGS.html');
  expect(await skinOn(page), 'stored NIGHT on ROUGH').toBe('rough/night');
  await page.evaluate(() => localStorage.setItem('draft-skin', JSON.stringify({ theme: 'ruff', mode: 'night' })));
  await page.goto('https://roughdrafter.com/SETTINGS.html');
  // A pasted link says what it says, over both the door and the store.
  await page.goto('https://roughdrafter.com/SETTINGS.html?theme=rough');
  expect(await themeOn(page), '?theme= over the store').toBe('rough');
  await page.goto('https://ruffdrafter.com/SETTINGS.html?theme=rough');
  expect(await themeOn(page), '?theme= over the door').toBe('rough');
});

test('the desk still opens on RUFF, so every spec written against the bone stands', async ({ page }) => {
  await page.goto('/MODEL.html');
  expect(await skinOn(page)).toBe('ruff/night');
});
