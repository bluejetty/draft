// TIER 2G — MODEL.html mitres its wall corners, and the vertex pool behind it.
//
// From tier 1 until now this page passed `joins = null` to drawWallSeg2D,
// which gives CAPPED ends: every corner closed with a straight line across the
// assembly rather than the layer boundaries running through the vertex. The
// classifier (geometry-2d's wallJoins) was extracted before the thing it
// needs.
//
// What it needs is OBJECT IDENTITY. wallJoins keys its endpoint groups on the
// point object, deliberately -- that is what stops a garage wall splicing into
// a coincident house wall. JSON restores values and not references, so a
// drawing read back off disk holds a separate object at every corner and the
// classifier returns an empty Map. The load path now rebuilds that identity
// through geometry-2d's mergeVertex, keyed (levelId, viewId, body).
//
// THE WHOLE FILE RESTS ON ONE OBSERVATION: with `null` joins, all three
// renders below would be pixel-identical, because every corner would be
// capped. So a difference between them proves three things at once -- the
// joins are supplied, the pool rebuilt identity, and the body is part of the
// key. No threshold, no colour sampling, no counting.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;

const canvasHash = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let n = 0x811c9dc5;
  for (let i = 0; i < data.length; i += 4) {
    n ^= data[i] | (data[i + 1] << 8) | (data[i + 2] << 16);
    n = Math.imul(n, 0x01000193) >>> 0;
  }
  return `${n.toString(16)}:${c.width}x${c.height}`;
});

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
}

// TWO WALLS AND NOTHING ELSE. The generated house is replaced rather than
// added to: its own corners would mitre too, and a render carrying forty
// mitred corners plus the one under test says less than a render carrying
// exactly one.
const corner = body => `
  d.walls = [
    { id: 'a', start: { x: 0, z: 0 }, end: { x: 10, z: 0 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6' },
    { id: 'b', start: { x: 10, z: 0 }, end: { x: 10, z: 10 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6'${
        body ? `, body: ${JSON.stringify(body)}` : ''} }
  ];
  d.lines = []; d.floors = []; d.dimensions = []; d.roofs = []; d.shapes = [];
  return d;`;

async function render(page, src) {
  await page.evaluate(async ({ bucket, src: s }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', s)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls 2/2', { timeout: 6000 });
  return canvasHash(page);
}

test.describe('MODEL.html wall joins', () => {
  test('two walls of one body mitre; a second body does not join them',
    async ({ page }) => {
      await houseOnOldPage(page);

      const bothHouse = await render(page, corner(null));

      // CONTROL FIRST, and the file is worthless without it: the same stored
      // drawing must paint the same pixels twice. Every assertion below is an
      // inequality, so a non-deterministic render would satisfy them all for
      // the wrong reason.
      expect(await render(page, corner(null)),
        'the same drawing must paint identically twice, or no inequality '
        + 'below means anything')
        .toBe(bothHouse);

      const withGarage = await render(page, corner('garage'));
      const withShed = await render(page, corner('shed'));

      expect(withGarage,
        'a garage wall must NOT mitre into a house wall at the same corner. '
        + 'If joins were still null both renders would be capped and equal, '
        + 'so this single inequality also proves the joins are supplied at '
        + 'all and that the vertex pool rebuilt identity')
        .not.toBe(bothHouse);

      expect(withShed,
        'and neither must a body the app has never assigned. This is the '
        + 'assertion that fails if drawing-format.js goes back to collapsing '
        + 'every non-garage body: shed would arrive with no body, pool as '
        + 'house, and splice onto the house corner')
        .not.toBe(bothHouse);

      expect(withShed,
        'an unrecognised body behaves exactly like a recognised non-house '
        + 'one -- both simply pool on their own. Asserting only the two '
        + 'inequalities above would pass on a page that treated shed as its '
        + 'own THIRD kind of thing')
        .toBe(withGarage);
    });

  test('a wall hidden by the view filter does not vote on a visible corner',
    async ({ page }) => {
      await houseOnOldPage(page);

      const twoOnPlan = await render(page, corner(null));

      // A third wall at the same corner, on the FOUNDATION layer set. MAIN FL
      // opens on the walls plan, so it is not drawn -- and it must not turn
      // the visible corner into a tee either.
      //
      // THIS TEST PINS AN OUTCOME, NOT A MECHANISM, and that is deliberate
      // because there turned out to be two mechanisms. Classifying over the
      // visible walls stops it; so does the pool keying on viewId. Mutating
      // either one alone leaves this green -- both were tried -- and only
      // mutating both together turns the corner into a tee. A single-mutation
      // check cannot tell a redundant guard from a useless one, so the
      // assertion is written against what the drafter sees rather than
      // against whichever guard happens to deliver it.
      await page.evaluate(async ({ bucket, mainFl }) => {
        const file = await window.SharedFileStore.loadSharedFile(bucket);
        const d = JSON.parse(await file.text());
        d.walls.push({
          id: 'c', start: { x: 10, z: 0 }, end: { x: 20, z: 0 },
          levelId: mainFl, view: 'foundation', wallType: 'stud_2x6',
        });
        await window.SharedFileStore.saveSharedFile(
          new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }), bucket);
      }, { bucket: BUCKET, mainFl: MAIN_FL });
      await page.goto('/MODEL.html?mode=night');
      await expect(page.locator('#readout'),
        'three walls stored, two on the plan set').toContainText('walls 2/3');

      expect(await canvasHash(page),
        'the corner the drafter can see must look the same whether or not an '
        + 'invisible wall shares it -- the drawing mitres the way it looks')
        .toBe(twoOnPlan);
    });
});
