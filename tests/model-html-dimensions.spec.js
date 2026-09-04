// TIER 2e — MODEL.html paints dimensions through drawDimension2D.
//
// The painter itself is covered by Gilligan's render-2d harness (label
// orientation, arrowheads, the offset line). Duplicating that here would be
// testing the module twice and the page not at all. What only a page test can
// reach is the SEAM: whether MODEL.html hands drawDimension2D a complete and
// CORRECT env.
//
// Two things live in that seam and nowhere else.
//
//   1. The env is complete. drawDimension2D reads env.label and five colours;
//      a missing one paints `undefined` (transparent black) or throws inside
//      the paint loop. Tier 2b learned this the expensive way -- an interface
//      satisfied for the fixture is not an interface satisfied.
//
//   2. THE UNITS POLARITY. MODEL.dc.html:8058 asks `units !== 'metric'`, so
//      imperial is the FALL-THROUGH, not a case. Nothing normalises `units`
//      -- drawing-format.js has no rule for it -- so it arrives raw and may be
//      absent, null, or a string older than the toggle. Inverting the test to
//      `=== 'imperial'` reads identically on any fixture that sets the field
//      and sends every other drawing to metres. That is the same polarity trap
//      that hid seven metric display sites from a grep earlier today, which is
//      why the third case below exists at all.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;          // MODEL.html:218
const A_DIM_ID = 9001;

// Twelve feet, printed both ways. Hardcoded rather than computed from the
// formatters: deriving the expectation from the code under test would pass
// whatever that code does, including nothing.
const TWELVE_FT_IMPERIAL = `12'-0"`;
const TWELVE_FT_METRIC = '3.658 m';

// Every string the page paints, recorded from the first frame. Installed
// before any script runs, so it catches the boot paint and needs no way to
// force a repaint from outside the page's IIFE.
async function recordText(page) {
  await page.addInitScript(() => {
    window.__painted = [];
    const proto = CanvasRenderingContext2D.prototype;
    const fillText = proto.fillText;
    proto.fillText = function (text, ...rest) {
      window.__painted.push(String(text));
      return fillText.call(this, text, ...rest);
    };
  });
}
const painted = page => page.evaluate(() => window.__painted.slice());

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

// Rewrite the stored drawing, then load MODEL.html fresh. MODEL.html only
// reads, so this goes through the store directly.
async function loadWith(page, src) {
  await page.evaluate(async ({ bucket, src: s }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', s)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
}

// One dimension, twelve feet long, on MAIN FL's default layer set.
const oneDimension = (units, extra = '') => `
  ${units === null ? 'delete d.units;' : `d.units = ${JSON.stringify(units)};`}
  d.dimensions = [{ id: ${A_DIM_ID}, start: { x: 0, z: 0 }, end: { x: 12, z: 0 },
                    levelId: ${MAIN_FL}, view: 'plan' }];
  ${extra}
  return d;`;

test.describe('MODEL.html dimensions', () => {
  test('a dimension paints, and its string follows the drawing\'s units',
    async ({ page }) => {
      await recordText(page);
      await houseOnOldPage(page);

      // IMPERIAL, the stated case.
      await loadWith(page, oneDimension('imperial'));
      await expect(page.locator('#readout'),
        'the dimension survives the normaliser and passes the level+view filter')
        .toContainText('dims 1/1');
      expect(await painted(page),
        'a complete env paints the string; an incomplete one throws inside the '
        + 'paint loop and the page says "painter failed" instead')
        .toContain(TWELVE_FT_IMPERIAL);

      // METRIC, the other stated case.
      await loadWith(page, oneDimension('metric'));
      const metric = await painted(page);
      expect(metric, 'a metric drawing prints metres').toContain(TWELVE_FT_METRIC);
      expect(metric,
        'and NOT feet -- a page that printed both would pass the line above '
        + 'while ignoring the units field entirely')
        .not.toContain(TWELVE_FT_IMPERIAL);

      // THE CASE NEITHER OF THOSE REACHES, and the only one that catches an
      // inverted test: no units field at all. `!== 'metric'` prints feet;
      // `=== 'imperial'` prints metres. Both pass the two cases above.
      await loadWith(page, oneDimension(null));
      expect(await painted(page),
        'a drawing older than the units toggle has no units field, and feet '
        + 'and inches is this app\'s home unit -- imperial is the '
        + 'fall-through, not a case')
        .toContain(TWELVE_FT_IMPERIAL);
    });

  test('the level and view filter, and the normaliser behind it',
    async ({ page }) => {
      await recordText(page);
      await houseOnOldPage(page);

      // A dimension on ANOTHER level is not this drawing.
      await loadWith(page, `
        d.units = 'imperial';
        d.dimensions = [{ id: ${A_DIM_ID}, start: { x: 0, z: 0 }, end: { x: 12, z: 0 },
                          levelId: ${MAIN_FL}, view: 'plan' },
                        { id: ${A_DIM_ID + 1}, start: { x: 0, z: 0 }, end: { x: 3.5, z: 0 },
                          levelId: 1, view: 'plan' }];
        return d;`);
      await expect(page.locator('#readout'),
        'two are stored, one belongs to MAIN FL').toContainText('dims 1/2');
      const oneLevel = await painted(page);
      expect(oneLevel).toContain(TWELVE_FT_IMPERIAL);
      expect(oneLevel, 'the other level\'s dimension is not painted here')
        .not.toContain(`3'-6"`);

      // A dimension on another LAYER SET of the same level. MAIN FL defaults
      // to the walls plan, so a foundation dimension is off.
      await loadWith(page, `
        d.units = 'imperial';
        d.dimensions = [{ id: ${A_DIM_ID}, start: { x: 0, z: 0 }, end: { x: 3.5, z: 0 },
                          levelId: ${MAIN_FL}, view: 'foundation' }];
        return d;`);
      await expect(page.locator('#readout'),
        'right level, wrong layer set').toContainText('dims 0/1');
      expect(await painted(page)).not.toContain(`3'-6"`);

      // THE INVARIANT THE FILTER RELIES ON. MODEL.dc.html:8929 filters
      // `dimension.view === view` with NO `|| 'plan'` fallback, unlike walls
      // and floors. That is safe only because format.dimensions drops any
      // dimension whose view is not one of the four known ones -- so a
      // view-less dimension never reaches the filter to need a fallback.
      // If the normaliser ever stopped running here, this count would be the
      // thing that noticed.
      await loadWith(page, `
        d.units = 'imperial';
        d.dimensions = [{ id: ${A_DIM_ID}, start: { x: 0, z: 0 }, end: { x: 12, z: 0 },
                          levelId: ${MAIN_FL}, view: 'plan' },
                        { id: ${A_DIM_ID + 1}, start: { x: 0, z: 0 }, end: { x: 3.5, z: 0 },
                          levelId: ${MAIN_FL} },
                        { id: ${A_DIM_ID + 2}, start: { x: 0, z: 0 }, end: { x: 3.5, z: 0 },
                          levelId: ${MAIN_FL}, view: 'elevation' }];
        return d;`);
      await expect(page.locator('#readout'),
        'a dimension with no view and one with an unknown view are both '
        + 'dropped on load, and the readout says so')
        .toContainText('dims 1/1');
      await expect(page.locator('#readout')).toContainText('2 dropped');
      expect(await painted(page)).toContain(TWELVE_FT_IMPERIAL);
    });
});
