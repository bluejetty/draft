// TIER 2c — MODEL.html paints floors with drawFloor2D, the real painter.
//
// Tier 2a hand-rolled a polygon wash: fill the outline in draw-floor and stop.
// That is not what a slab looks like on a drawing. drawFloor2D adds the
// outline, the corner handles, holes cut even-odd for surface openings, and
// for a garage the dashed thickened-edge ring and the pour/slope note.
//
// TWO REASONS THIS FILE EXISTS, and the second is the bigger one.
//
// 1. drawFloor2D had ZERO coverage before this file. Gilligan measured that
//    when he extracted it: the existing floor specs assert the SAVED MODEL --
//    a slab exists, it has a thickness, its points are where they were put --
//    and never that anything gets painted from it. Three of the six painters
//    he moved were in that state. So the assertion below is not "the wiring
//    works"; it is the first thing in the suite that fails if this painter
//    stops painting.
//
// 2. A floor's view fallback is 'floor', not 'plan' (MODEL.dc.html:2905,
//    9029, 9089, 9098, 9162, 17025 -- every other item type reads 'plan').
//    Tier 2a used 'plan' for everything. That is invisible on any fixture,
//    because the old page always writes an explicit `view` on a floor, and it
//    only shows on an older saved drawing whose floors predate the field --
//    exactly the drawings that have to keep opening. So this file builds that
//    drawing by hand rather than waiting for one to turn up.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MAIN_FL = 3;
const BUCKET = 'model-drawing';

// The floor edge, from palette.js. Hard-coded rather than read from the page:
// asking the page what colour it used and then checking it used that colour
// is a tautology. If the palette changes this constant has to change with it,
// and that is the point -- the failure is loud and names the file.
const EDGE = [0x59, 0x80, 0xa6];

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

const readout = page => page.locator('#readout');
const floorCount = async page => Number(
  (await readout(page).textContent()).match(/floors (\d+)\//)?.[1] ?? -1);

async function waitForPaint(page) {
  await expect(readout(page)).toContainText('floors', { timeout: 6000 });
}

// Count pixels close to a target colour. Whole canvas, not a sample point:
// sampling one pixel and assuming nothing else is painted there is how the
// last version of this measurement went wrong.
async function inkShare(page, rgb) {
  return page.evaluate(target => {
    const canvas = document.querySelector('#plan');
    const { data } = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height);
    let hits = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += 1;
      const d = Math.max(Math.abs(data[i] - target[0]),
        Math.abs(data[i + 1] - target[1]), Math.abs(data[i + 2] - target[2]));
      if (d <= 10) hits += 1;
    }
    return hits / total;
  }, rgb);
}

// Rewrite the stored drawing, then reload so the page reads the new one.
// MODEL.html only ever reads, so this goes through the store directly.
async function rewriteStored(page, mutate) {
  const changed = await page.evaluate(async ({ bucket, fn }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const applied = new Function('d', fn)(drawing) || drawing;
    const blob = new File([JSON.stringify(applied)], 'drawing.json',
      { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(blob, bucket);
    return applied;
  }, { bucket: BUCKET, fn: mutate });
  await page.reload();
  await waitForPaint(page);
  return changed;
}

test.describe('MODEL.html floors', () => {
  test('the slab is drawn by drawFloor2D, outline and all', async ({ page }) => {
    const saved = await houseOnOldPage(page);

    // The controls first, so a fixture that stopped carrying floors fails
    // here rather than making the ink assertion vacuously true.
    const mainFloors = (saved.floors || [])
      .filter(f => Number(f.levelId) === MAIN_FL);
    expect(mainFloors.length, 'the fixture must put a floor on MAIN FL')
      .toBeGreaterThan(0);
    const view = mainFloors[0].view || 'floor';
    expect(view, 'and that floor must carry a view to select it by').toBeTruthy();

    await page.goto(`/MODEL.html?level=${MAIN_FL}&view=${view}`);
    await waitForPaint(page);
    expect(await floorCount(page), 'the floor must be on screen to be measured')
      .toBeGreaterThan(0);

    // THE ASSERTION. draw-floor-edge is the slab OUTLINE, which only
    // drawFloor2D draws -- the tier-2a wash filled and never stroked. So this
    // fails if the painter stops painting AND if someone quietly puts the
    // hand-rolled wash back, which a fill-only check would let through.
    // MEASURED, not guessed. With the painter: 0.002345 of the canvas. With
    // drawFloor2D no-op'd: 0.000000 -- not "a bit less", none. The gap is
    // presence against total absence, so the threshold sits an order of
    // magnitude clear of both ends. Two earlier versions of a canvas check in
    // this suite used a number invented to sit just past one measurement, and
    // both were flaky within a day; the fix is to ask a question whose answer
    // is wide rather than to tune a constant.
    const edge = await inkShare(page, EDGE);
    expect(edge, 'the slab outline must be on the canvas in draw-floor-edge')
      .toBeGreaterThan(0.0004);
  });

  test('a floor with no view saved lands on FLOOR, not on the plan set',
    async ({ page }) => {
      const saved = await houseOnOldPage(page);
      await page.goto(`/MODEL.html?level=${MAIN_FL}`);
      await waitForPaint(page);

      // Control: the fixture cannot produce this case on its own.
      const withView = (saved.floors || []).filter(f => f.view);
      expect(withView.length, 'every fixture floor carries an explicit view, '
        + 'which is why the no-view case has to be built by hand')
        .toBe((saved.floors || []).length);

      const stripped = await rewriteStored(page,
        "d.floors.forEach(f => { delete f.view; }); return d;");
      expect(stripped.floors.every(f => f.view === undefined),
        'the rewrite must actually remove the field').toBe(true);

      // On the FLOOR set it shows: 'floor' is the fallback the old page uses.
      await page.goto(`/MODEL.html?level=${MAIN_FL}&view=floor`);
      await waitForPaint(page);
      expect(await floorCount(page),
        "a view-less floor belongs to the FLOOR set, the old page's fallback")
        .toBeGreaterThan(0);

      // On the plan set it does not. This is the half that fails with the
      // tier-2a rule, which defaulted every item type to 'plan'.
      await page.goto(`/MODEL.html?level=${MAIN_FL}&view=plan`);
      await waitForPaint(page);
      expect(await floorCount(page),
        'and it must NOT be dragged onto the plan set, which is what '
        + "defaulting floors to 'plan' did").toBe(0);
    });

  test('floors 0 on the plan set is correct, not a missing painter',
    async ({ page }) => {
      // Recorded because it looked like a bug and was chased as one. MAIN FL's
      // slab lives on the FLOOR layer set, so the default plan view shows
      // 0 of N -- the same answer the old page gives, since _activeFloors
      // filters on the identical rule. The readout says 0/3 rather than 0 so
      // that this is legible without opening the file.
      const saved = await houseOnOldPage(page);
      const total = (saved.floors || []).length;
      expect(total, 'the fixture must hold floors for 0/N to mean anything')
        .toBeGreaterThan(0);
      expect((saved.floors || []).some(f => (f.view || 'floor') !== 'plan'),
        'and at least one must live off the plan set').toBe(true);

      await page.goto(`/MODEL.html?level=${MAIN_FL}&view=plan`);
      await waitForPaint(page);
      expect(await floorCount(page)).toBe(0);
      await expect(readout(page)).toContainText(`floors 0/${total}`);
    });
});
