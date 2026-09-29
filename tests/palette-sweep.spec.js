// THE SKIN ARRIVES ON EVERY DASHBOARD, NOT ONLY ON MODEL.
//
// SPEC-skins.md rules four dashboards: two brands (RUFF DRAFTER, ROUGH
// DRAFTER) times two modes (night, day). palette.js carries that as named
// roles, and a page receives them by calling DraftPalette.apply(). The count
// is read from DraftPalette.ROLES, never written down here, so a role added
// tomorrow is swept without this file changing.
//
// Every skin assertion the suite had before this file lives in
// model-html-skins.spec.js, and every one of them loads /MODEL.html. Eight
// pages call apply(); seven had nothing asserting it arrives. This sweep is
// the other seven, and it reads its population off the disk -- see
// palette-pages.js for why the EXEMPTIONS are named and the covered pages
// are not.
//
// WHAT IS ASSERTED, AND WHY EACH ONE. The roles are read as COMPUTED STYLE
// off the root, not as the return value of apply(): the question is what the
// page got, and a page that calls apply() into a detached document or writes
// the properties somewhere the stylesheet never reads would satisfy the
// return value and leave the dashboard unpainted.
//
// NOT THE SAME CHECK AS proto/skinned-page-harness.js, which is the other
// half and is easy to mistake for this one. That harness reads page TEXT and
// proves no hex literal crept back into a converted page; it is static, and
// its subjects are the pages that have been converted. This sweep loads the
// page and reads COMPUTED STYLE, proving the roles actually arrive. A page can
// pass either and fail the other: one with no literals that never calls
// apply() is clean to the scanner and unpainted here, and one painted
// perfectly from a stray literal is right here and dirty to the scanner.
//
// THIS SWEEP WAS GREEN THE DAY IT WAS WRITTEN. All eight pages were measured
// applying every role before a line of it existed, so it is a regression
// guard and not a bug fix, and it is written down as one. What makes it worth
// its runtime is the population, not the assertions: a ninth page added
// tomorrow is swept without anybody remembering this file exists, and a page
// that loses its palette is caught, because losing the palette is not a way
// off the roster.
const { test, expect } = require('@playwright/test');
const { SKINNED_PATHS, SKINNED_PAGES, rosterProblems } = require('./palette-pages.js');

const SKINS = [
  { theme: 'ruff', mode: 'night' },
  { theme: 'ruff', mode: 'day' },
  { theme: 'rough', mode: 'night' },
  { theme: 'rough', mode: 'day' },
];

// THE COMPANION THE SWEEP NEEDS, for the reason every scanning file in this
// repo writes down: every assertion below is of the shape "every page does
// X", which is triumphantly true of a roster that has stopped matching. A
// rename or a move into a subdirectory fails here, loudly, instead of
// sweeping nothing at all.
test('the roster is sound before anything is swept', () => {
  expect(rosterProblems()).toEqual([]);
  expect(SKINNED_PAGES).toContain('MODEL.html');
  expect(SKINNED_PAGES).toContain('SETTINGS.html');
  expect(SKINNED_PATHS.length).toBeGreaterThanOrEqual(8);
});

// What the page actually got: every role as the stylesheet sees it, plus
// the two attributes apply() stamps on the root.
async function skinOnPage(page, path, theme, mode) {
  await page.goto(`${path}?theme=${theme}&mode=${mode}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.documentElement.getAttribute('data-mode') !== null,
    undefined, { timeout: 10000 });
  return page.evaluate(() => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const roles = window.DraftPalette.ROLES;
    const values = {};
    roles.forEach(r => { values[r] = cs.getPropertyValue(`--${r}`).trim(); });
    return {
      theme: root.getAttribute('data-theme'),
      mode: root.getAttribute('data-mode'),
      unset: roles.filter(r => !values[r]),
      values,
      bodyBg: getComputedStyle(document.body).backgroundColor,
    };
  });
}

test.describe('every dashboard takes the skin', () => {
  for (const { theme, mode } of SKINS) {
    test(`${theme}/${mode} reaches every role on every page`, async ({ page }) => {
      for (const path of SKINNED_PATHS) {
        const got = await skinOnPage(page, path, theme, mode);
        expect(got.theme, `${path} stamps data-theme`).toBe(theme);
        expect(got.mode, `${path} stamps data-mode`).toBe(mode);
        // Named individually so a failure says WHICH role went missing on
        // WHICH page, rather than "expected 0 to be 30".
        expect(got.unset, `${path} leaves no role unset in ${theme}/${mode}`).toEqual([]);
        // A transparent body means the page never took the ground: the skin
        // resolved and nothing painted with it.
        expect(got.bodyBg, `${path} paints a body background`)
          .not.toBe('rgba(0, 0, 0, 0)');
      }
    });
  }
});

// THE TWO AXES ARE LIVE ON EVERY PAGE, not merely present. A page could carry
// every role at its night value in both modes and pass everything above;
// what proves the axis arrived is that the value MOVES when the axis does.
test.describe('both axes move on every page', () => {
  test('night and day differ in the surface roles', async ({ page }) => {
    for (const path of SKINNED_PATHS) {
      const night = await skinOnPage(page, path, 'ruff', 'night');
      const day = await skinOnPage(page, path, 'ruff', 'day');
      expect(night.values['surface-page'], `${path} moves its ground with the mode`)
        .not.toBe(day.values['surface-page']);
      expect(night.bodyBg, `${path} repaints its body for day`).not.toBe(day.bodyBg);
    }
  });

  // The brands are NOT a second set of surfaces -- Movie's brief is that Rough
  // Drafter changes "mainly through logos and colors". Measured on palette.js:
  // ruff and rough differ in 3 roles at night and 2 by day, all of them accent
  // roles, and in none of the 27 surface and ink roles. So the assertion is
  // that the ACCENT moves and the ground does not: asserting whole-palette
  // difference would fail correctly-built pages, and asserting nothing would
  // let the theme axis die unnoticed.
  test('the brands differ in the accent and agree on the ground', async ({ page }) => {
    for (const path of SKINNED_PATHS) {
      const ruff = await skinOnPage(page, path, 'ruff', 'night');
      const rough = await skinOnPage(page, path, 'rough', 'night');
      expect(ruff.values.accent, `${path} carries the brand accent`)
        .not.toBe(rough.values.accent);
      expect(ruff.values['surface-page'], `${path} keeps one ground across brands`)
        .toBe(rough.values['surface-page']);
    }
  });
});
