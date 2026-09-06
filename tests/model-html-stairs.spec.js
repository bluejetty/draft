// TIER 2 — MODEL.html paints stairs through drawStairs2D.
//
// The painter itself is covered by the render-2d harness. What only a page
// test can reach is the SEAM: what MODEL.html selects, and what it answers
// when the painter asks its two questions (layoutFor, partsFor).
//
// THE SECOND TEST IS THE POINT OF THIS FILE, and of level-assembly.js with it.
// A stair's rise is NOT the `riseFt` stored on the stair. MODEL.dc.html treats
// that as a fallback -- "the rise captured at placement" -- and re-derives the
// real rise from the level heights on every paint, without ever writing it
// back. So a drawing saved after any wall-height or joist edit holds a STALE
// riseFt, and a viewer that trusted it would show the drafter a different
// riser count than the board they drew it on. Nothing on MODEL.dc.html could
// catch that: it never reads the stored value while a level exists.
//
// That is what makes it a port defect rather than a bug, in the same family as
// the note painted in the page's own colour (model-html-notes.spec.js): the
// second page creates the failure by existing, so the second page is where the
// test has to live.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const FOUNDATION = 1;

// The painter's legend, recorded from the first frame. drawStairs2D writes
// `DN — {risers}R @ {riser}` under every stair it draws, so the legend is both
// the proof it ran and the layout it used, in one string.
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

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

async function loadWith(page, src) {
  await page.evaluate(async ({ bucket, src: s }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', s)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
}

const legends = page => page.evaluate(
  () => window.__painted.filter(t => t.startsWith('DN')));

// A STORED RISE OF 3'-0" is deliberately absurd for a storey, and that is the
// control: 36" at the 7 7/8" maximum is 5 risers, a number the real level
// heights cannot produce. If 5R ever appears the page read the stair instead
// of the house.
const STORED_RISE_FT = 3;
const STORED_RISERS = '5R';

const stair = (extra = '') => `
  d.stairs = [{
    id: 7401, levelId: ${MAIN_FL}, view: 'plan', layer: 'A-STR',
    start: { x: -2, z: 0 }, end: { x: 8, z: 0 },
    widthFt: 3, riseFt: ${STORED_RISE_FT}, rail: 'both',
    shape: 'straight', turn: 'right', winders: 0,
  }];
  ${extra}`;

test.describe('MODEL.html stairs', () => {
  test('a stair paints, with the DN legend the bone writes', async ({ page }) => {
    await recordText(page);
    await houseOnOldPage(page);
    await loadWith(page, stair());

    const dn = await legends(page);
    expect(dn, 'drawStairs2D writes one DN legend per stair it draws')
      .toHaveLength(1);
    // The shape of the legend, not its numbers -- those are the next test's
    // subject and pinning them here would make this fail for the wrong reason.
    expect(dn[0]).toMatch(/^DN — \d+R @ /);
  });

  test('the riser count comes from the LEVEL HEIGHTS, not the stored rise',
    async ({ page }) => {
      await recordText(page);
      await houseOnOldPage(page);

      // A floor assembly is joists + sheathing, and it is part of the rise a
      // stair climbs to reach this level. Twelve inches of extra joist is
      // twelve inches of extra rise.
      const withJoist = depthIn => stair(`
        d.levelAssemblies = d.levelAssemblies || {};
        d.levelAssemblies[${MAIN_FL}] = Object.assign({},
          d.levelAssemblies[${MAIN_FL}], { joistDepthIn: ${depthIn}, sheathingIn: 0.75 });
        d.levelAssemblies[${FOUNDATION}] = Object.assign({},
          d.levelAssemblies[${FOUNDATION}], { slabThicknessIn: 3 });`);

      await loadWith(page, withJoist(11.875));
      const shallow = (await legends(page))[0];

      await page.evaluate(() => { window.__painted = []; });
      await loadWith(page, withJoist(23.875));
      const deep = (await legends(page))[0];

      const risersIn = legend => Number(legend.match(/(\d+)R/)[1]);

      // ONE: the page reads the level heights at all. If it took the stored
      // riseFt these two renders would be identical, because nothing about
      // the stair changed between them -- only the house under it.
      expect(deep, 'a foot of extra floor assembly must change the stair')
        .not.toBe(shallow);

      // TWO: and it moved the right way, by an amount the constants force.
      // Twelve more inches of rise at the 7 7/8" maximum riser cannot be
      // absorbed by the existing risers, so at least one more is required.
      // Derived from STAIR_MAX_RISER_IN rather than observed from a run.
      expect(risersIn(deep),
        '12" more rise at a 7 7/8" max riser adds at least one riser')
        .toBeGreaterThanOrEqual(risersIn(shallow) + 1);

      // THREE: and neither is the stored rise. This is the assertion that
      // fails if MODEL.html is ever "simplified" to read stair.riseFt and
      // drop level-assembly.js.
      expect([shallow, deep].map(risersIn).map(String),
        `${STORED_RISE_FT}' stored would paint ${STORED_RISERS} -- the stair `
        + 'must not be its own authority on how far it descends')
        .not.toContain(STORED_RISERS.replace('R', ''));
    });

  test('a stair on another level, or another view, is not on this plan',
    async ({ page }) => {
      await recordText(page);
      await houseOnOldPage(page);

      // Four stairs, one drawable. THE FOURTH IS THE ONE THAT EARNS ITS KEEP.
      //
      // Stairs filter STRICTLY on `view` -- `stair.view === view`, with no
      // `|| 'plan'` fallback, unlike every wall, line and fixture beside them.
      // The first three stairs cannot tell that apart from the ordinary rule:
      // routing this page through onPlan() rejects an 'electrical' stair and a
      // foundation stair just the same, and a sweep that mutated the filter to
      // onPlan() left this test green. A stair carrying NO view is the only
      // input the two rules disagree about -- strict hides it, onPlan reveals
      // it -- so it is the only one that pins which rule this page follows.
      await loadWith(page, `
        d.stairs = [
          { id: 7401, levelId: ${MAIN_FL}, view: 'plan', layer: 'A-STR',
            start: { x: -2, z: 0 }, end: { x: 8, z: 0 },
            widthFt: 3, riseFt: 9, rail: 'none', shape: 'straight',
            turn: 'right', winders: 0 },
          { id: 7402, levelId: ${FOUNDATION}, view: 'plan', layer: 'A-STR',
            start: { x: -2, z: 6 }, end: { x: 8, z: 6 },
            widthFt: 3, riseFt: 9, rail: 'none', shape: 'straight',
            turn: 'right', winders: 0 },
          { id: 7403, levelId: ${MAIN_FL}, view: 'electrical', layer: 'A-STR',
            start: { x: -2, z: 12 }, end: { x: 8, z: 12 },
            widthFt: 3, riseFt: 9, rail: 'none', shape: 'straight',
            turn: 'right', winders: 0 },
          { id: 7404, levelId: ${MAIN_FL}, layer: 'A-STR',
            start: { x: -2, z: 18 }, end: { x: 8, z: 18 },
            widthFt: 3, riseFt: 9, rail: 'none', shape: 'straight',
            turn: 'right', winders: 0 },
        ];`);

      expect(await legends(page),
        'one stair on the MAIN FL walls plan. The foundation one and the '
        + 'electrical one are somewhere else, and the view-less one is '
        + 'nowhere at all -- which is the bone\'s rule, not a rounding of it')
        .toHaveLength(1);
    });
});
