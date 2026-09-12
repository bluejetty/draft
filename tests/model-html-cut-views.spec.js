// CUT VIEWS ON MODEL.html — the host.
//
// Spec of record: RD-DOCUMENTS/SPEC-model-html-cut-views.md.
//
// The section maths is shared and was already loaded here; what was missing was
// a host — somewhere to put a generated drawing and a state saying which one
// you are looking at. The state turned out to exist: `?view=` in the URL. A cut
// is offered as a view beside the layer views, so it is shareable, survives a
// reload, and inherits the level-change behaviour rather than re-implementing
// it.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';

// A house with a section cut straight through it. The cut is written into the
// drawing the way LAYOUT writes one — the model pages read `cuts`, they do not
// author them (persisted-format.spec.js's writer map says `cuts: ['LAYOUT']`).
async function houseWithCut(page) {
  await h.openModel(page, { webgl: false });
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -10, -6);
  await h.clickWorld(page, 10, -6);
  await h.clickWorld(page, 10, 6);
  await h.clickWorld(page, -10, 6);
  await h.clickWorld(page, -10, -6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await page.evaluate(async bucket => {
    const S = window.SharedFileStore;
    const file = await S.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    drawing.cuts = [{
      id: 'S1', name: 'S1', elev: 0, levelId: null,
      startPt: { x: -20, z: 0 }, endPt: { x: 20, z: 0 }, dirVec: { x: 0, z: 1 },
    }];
    await S.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, BUCKET);
}

const ink = page => page.evaluate(() => {
  const canvas = document.getElementById('plan');
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let lit = 0;
  for (let i = 0; i < data.length; i += 4) {
    // Anything that is not the page ground. The section and the plan both
    // paint, so the count is compared BETWEEN views rather than against zero.
    if (data[i + 3] > 0 && !(data[i] === data[i + 1] && data[i + 1] === data[i + 2] && data[i] > 240)) lit += 1;
  }
  return lit;
});

test('a cut is offered as a view, and picking it paints the section', async ({ page }) => {
  await houseWithCut(page);
  await page.goto('/MODEL.html?mode=night');
  // THE READY SIGNAL IS THE READOUT, not `data-model-ready`. That attribute is
  // MODEL.dc.html's, and waiting for it here fails four tests in a row for a
  // reason that has nothing to do with the host — the same "searched for the
  // other page's name" fault the parity retraction was about.
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

  // The picker carries it beside the layer views.
  const options = await page.locator('#view-pick option').allTextContents();
  expect(options, 'the cut must be offered as a view').toContain('S1');

  const plan = await ink(page);
  await page.selectOption('#view-pick', 'cut:S1');
  await page.waitForTimeout(300);

  // THE URL IS THE STATE. Not a page variable — this is what makes the view
  // shareable and reload-proof, and it is why no second source of truth for
  // "what am I looking at" was introduced.
  expect(page.url()).toContain('view=cut%3AS1');

  const section = await ink(page);
  expect(section, 'the section must paint something').toBeGreaterThan(0);
  expect(section, 'and it must not be the plan still on screen').not.toBe(plan);

  // AND THE INSTRUMENT FOLLOWED IT. The readout is the only instrument on this
  // page, so a section it does not describe is a section drawn behind a stale
  // caption — which is what this host did until the cold-load wait caught it.
  await expect(page.locator('#readout')).toContainText('section S1');
  await expect(page.locator('#readout')).not.toContainText('4/4');

  // A SECTION, NOT AN ELEVATION. drawCutView falls back to an elevation when
  // the cut crosses no walls, so `ink > 0` above is true of a cut that misses
  // the house entirely — which is exactly what this page drew while its env
  // handed the painter the active level's filtered walls. The readout reports
  // the painter's own crossing count, so this distinguishes the two.
  await expect(page.locator('#readout'), 'the cut must cut walls, not stand outside them')
    .toContainText('walls cut');
});

test('a section survives a reload, because the URL carries it', async ({ page }) => {
  await houseWithCut(page);
  await page.goto('/MODEL.html?mode=night&view=cut:S1');
  // THE READY SIGNAL IS THE READOUT, not `data-model-ready`. That attribute is
  // MODEL.dc.html's, and waiting for it here fails four tests in a row for a
  // reason that has nothing to do with the host — the same "searched for the
  // other page's name" fault the parity retraction was about.
  //
  // `section S1`, NOT `walls`. On a cold load only the section readout can put
  // those words on screen, so this wait proves the cut painted AND reported.
  // Waiting for `walls` was satisfied by the plan readout of an earlier paint,
  // and hid a cut branch that returned before updateReadout ever ran.
  await expect(page.locator('#readout')).toContainText('section S1', { timeout: 10000 });
  await page.waitForTimeout(300);

  expect(await page.locator('#view-pick').inputValue()).toBe('cut:S1');
  expect(await ink(page), 'the section paints on a cold load').toBeGreaterThan(0);
  // And it is a section: see the note in the first test — an elevation would
  // satisfy the ink check above just as well.
  await expect(page.locator('#readout')).toContainText('walls cut');
});

test('switching level leaves the section, as the old page does', async ({ page }) => {
  await houseWithCut(page);
  await page.goto('/MODEL.html?mode=night&view=cut:S1');
  // THE READY SIGNAL IS THE READOUT, not `data-model-ready`. That attribute is
  // MODEL.dc.html's, and waiting for it here fails four tests in a row for a
  // reason that has nothing to do with the host — the same "searched for the
  // other page's name" fault the parity retraction was about.
  //
  // `section S1`, NOT `walls`. On a cold load only the section readout can put
  // those words on screen, so this wait proves the cut painted AND reported.
  // Waiting for `walls` was satisfied by the plan readout of an earlier paint,
  // and hid a cut branch that returned before updateReadout ever ran.
  await expect(page.locator('#readout')).toContainText('section S1', { timeout: 10000 });

  // THE LEAVE PATH, and it was not written for this. goToLevel drops a `?view=`
  // the new level's layer views do not carry, and a cut id never does — so
  // extending the existing mechanism produced the old page's behaviour without
  // a line of leave-path code. A host that can be entered and not left is the
  // defect the spec's §4 exists to prevent.
  const levels = await page.locator('#level-pick option').count();
  test.skip(levels < 2, 'needs two levels to switch between');
  const other = await page.locator('#level-pick option').nth(1).getAttribute('value');
  await page.selectOption('#level-pick', other);
  await page.waitForTimeout(300);

  expect(page.url(), 'the section must not survive a level change').not.toContain('cut%3AS1');
});

// THE RASTER COST, in a browser, because the offline number is only a floor.
// proto/cut-view-timing.js measured the painter's JavaScript against a
// recording context: 0.14-0.30 ms per section on three real houses, the slowest
// being repro-garage-house. That says nothing about fill and stroke, and a
// floor standing in for a measurement it did not make is exactly what this
// project keeps removing.
//
// TWO THINGS THIS TEST GOT WRONG FIRST, both worth keeping written down:
//
// 1. It timed `dispatchEvent(new Event('resize'))`. resize() reallocates the
//    canvas backing store before it paints, and that realloc swamped the
//    paint so thoroughly that FIFTY section paints per frame moved the median
//    from 0.20 ms to 0.90 ms — and the budget still passed. A check that
//    survives fifty times the work cannot fail for the reason it claims to,
//    and 0.20 ms was the cost of reallocating a canvas, not of drawing a
//    section. The page now times its own paint body and puts it in the
//    readout, and this reads that number.
//
// 2. It ran on the four-wall box the other tests use, and reported the result
//    as comparable to offline runs on 18-24 wall houses. It uses the same
//    24-wall house the slowest offline run used, so the two numbers are about
//    the same drawing.
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

test('a section paints inside a frame budget on a real canvas', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    // A cut straight through the house, west to east at z = 0: the walls span
    // x -8..20 and z -6..6, so this crosses them rather than standing outside
    // the model, which would paint an elevation and time the wrong painter.
    saved.cuts = [{
      id: 'S1', name: 'S1', elev: 0, levelId: null,
      startPt: { x: -20, z: 0 }, endPt: { x: 30, z: 0 }, dirVec: { x: 0, z: 1 },
    }];
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });

  await page.goto('/MODEL.html?mode=night&view=cut:S1');
  await expect(page.locator('#readout')).toContainText('section S1', { timeout: 10000 });

  // THE SECTION HAS TO CONTAIN SOMETHING, or the budget is the cost of
  // painting nothing. The readout reports the crossings through the painter's
  // own pass, so this is the painter's own answer, not the test's.
  await expect(page.locator('#readout'), 'the cut must cross walls, or this times an empty page')
    .toContainText('walls cut');

  // Repaints provoked the way a drafter's window does it, but what is READ is
  // the page's own measurement of the paint body — so the canvas realloc that
  // resize also does is outside the number.
  const ms = await page.evaluate(async () => {
    const read = () => Number(/paint ([\d.]+) ms/.exec(
      document.getElementById('readout').textContent)[1]);
    const times = [];
    for (let i = 0; i < 30; i += 1) {
      window.dispatchEvent(new Event('resize'));
      times.push(read());
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  });
  console.log(`  section paint on a real canvas, 24-wall house: ${ms.toFixed(2)} ms median`);

  // Six seats at this cost is what the live-thumbnail decision rests on, so
  // the budget is six of them inside one 16 ms frame with room to spare.
  expect(ms, 'six of these per frame must fit a 16ms budget').toBeLessThan(2.5);
});
