// THE REAL ESTATE PLAN HAS A WITNESS AT LAST.
//
// Devin's audit, 28 Sep: *"No test ever opens REALESTATEPLAN.html. One spec
// mentions the name -- as the `href` of a link it never follows. That is why
// 1324 green tests did not see it."* Two defects were living on the page:
// every stair silently not drawn, and the garage slab's standards missing.
//
// BOTH WERE ONE SCRIPT TAG. `layout-plan.js` builds its stair stage as
// `stairs && LEVELS && VIEWS ? {...} : null`, and VIEWS is DraftLayerViews --
// absent, the whole stage is null and nothing throws. It reads its slab
// standards as `(window.DraftCutView && window.DraftCutView.STANDARDS) || {}`
// -- absent, every standard is `undefined` and still nothing throws.
//
// SO THE TEST THAT MATTERS IS NOT "DOES IT LOAD". The page loaded perfectly
// in both broken states, painted a plan, returned true and logged nothing.
// What separates the states is whether particular INK reaches the sheet, so
// that is what this reads.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

// Chosen for what it CARRIES, checked rather than assumed: two stairs and one
// garage slab. A fixture without stairs would let the stair check pass by
// having nothing to lose.
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));

async function openListingPlan(page) {
  await h.suppressEntryCoach(page);
  await page.goto('/REALESTATEPLAN.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: REPRO });
  await page.goto('/REALESTATEPLAN.html');
  await page.evaluate(() => {
    window.__ink = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      window.__ink.push(String(text));
      return orig.call(this, text, x, y);
    };
  });
  // FORCED, because the first paint can be over before the hook is installed.
  await page.setViewportSize({ width: 1360, height: 764 });
  await page.waitForFunction(() => (window.__ink || []).length > 0, null, { timeout: 20000 });
}

test('the listing plan draws its stairs', async ({ page }) => {
  await openListingPlan(page);

  // THE FIXTURE'S OWN REACH FIRST: this drawing has stairs to lose. Without
  // this line a fixture that quietly lost its stairs would make the check
  // below vacuous rather than failing -- which is the whole disease being
  // treated here.
  expect(REPRO.stairs.length, 'the fixture carries stairs at all').toBeGreaterThan(0);

  const ink = await page.evaluate(() => window.__ink);
  expect(ink.length, 'the sheet was painted').toBeGreaterThan(0);
  expect(ink.filter(t => /^DN — \d+R @ /.test(t)),
    'every stair note is missing: layout-plan built no stair stage, which is '
    + 'what a missing layer-views.js looks like from the sheet').not.toHaveLength(0);
});

test('the slab standards layout-plan reads are actually there', async ({ page }) => {
  await openListingPlan(page);

  // THE EXACT EXPRESSION layout-plan.js EVALUATES, not a proxy for it:
  //   const STANDARDS = (window.DraftCutView && window.DraftCutView.STANDARDS) || {};
  // Missing cut-view.js -- or cut-view.js present and throwing on load, which
  // is a different fault with identical symptoms -- makes this `{}`, and every
  // standard downstream becomes `undefined`. GARAGE_SLAB_THICKNESS_IN is the
  // one that reaches the garage slab note as its thickness, so a blank note is
  // this object being empty, one step later.
  //
  // READ HERE RATHER THAN OFF THE SHEET, and the reason is worth writing down:
  // the garage slab sits on FOUNDATION, and a listing plan is not obliged to
  // show a buyer the foundation. A check that waited for that note to be
  // painted would be asserting on a view this page may rightly never open,
  // and would fail for a reason that is not a defect.
  const standards = await page.evaluate(() =>
    (window.DraftCutView && window.DraftCutView.STANDARDS) || {});
  expect(Object.keys(standards).length,
    'STANDARDS came back empty: cut-view.js is missing, or threw on load')
    .toBeGreaterThan(0);
  expect(standards.GARAGE_SLAB_THICKNESS_IN,
    'the garage slab has no thickness standard, so its note prints with a hole')
    .toBeGreaterThan(0);
});

test('the page loads every module its own painters ask for', async ({ page }) => {
  // THE GENERAL SHAPE OF BOTH DEFECTS, stated once. layout-plan.js is loaded
  // here and reaches for these two by name; a page that loads the caller and
  // not the callee gets silence, not an error. This is cheap and it is the
  // check that would have caught both on the day the page was written.
  await openListingPlan(page);
  const missing = await page.evaluate(() => ['DraftLayerViews', 'DraftCutView',
    'DraftStairGeometry', 'DraftLevelAssembly', 'DraftLayoutPlan',
    'DraftPlanComposition'].filter(name => !window[name]));
  expect(missing, 'modules layout-plan.js asks for that this page never loaded')
    .toEqual([]);
});
