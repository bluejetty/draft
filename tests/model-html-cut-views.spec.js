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
// recording context: 0.14-0.30 ms per section on three real houses. That says
// nothing about fill and stroke, and a floor standing in for a measurement it
// did not make is exactly what this project keeps removing. This is the same
// paint through a real canvas.
test('a section paints inside a frame budget on a real canvas', async ({ page }) => {
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

  // THROUGH THE PAGE'S OWN PAINT, not a painter the test wired up. The page
  // keeps no test hook, so the repaint is provoked the way a drafter's window
  // does it — a resize — and what is timed is the whole frame the page draws
  // while a section is the active view: env, painter, fill and stroke.
  const ms = await page.evaluate(() => {
    const times = [];
    for (let i = 0; i < 30; i += 1) {
      const t0 = performance.now();
      window.dispatchEvent(new Event('resize'));
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  });
  console.log(`  section paint on a real canvas: ${ms.toFixed(2)} ms median`);
  expect(ms, 'six of these per frame must fit a 16ms budget').toBeLessThan(2.5);
});
