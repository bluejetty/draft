// THE RISING REVEAL ON MODEL.html (board #283).
//
// "Every bone press that grows the house jumps to the E1 front elevation and
// the house climbs out of the ground under the rising mask -- not just the
// tour finale. BONE REVEAL in SETTINGS turns it off for drafters who'd rather
// stay on the plan." That is MODEL.dc.html's behaviour, and tests/
// bone-reveal.spec.js has guarded it there since it landed.
//
// THIS PAGE NEVER HAD IT, and nothing said so -- an unrecorded parity gap.
// The port is small (tour.js owns the easing) but it is not nothing, and the
// dc spec cannot be pointed at this page: every hook it uses is absent here.
// data-build-house, data-model-title-detail, data-model-left and
// data-model-right are all MODEL.dc.html's. This page names the same things
// differently and keeps its view in the URL.
//
// WHAT THIS FILE ADDS OVER THE DC ONE: it watches the CURTAIN, not just the
// jump. A port that changed the view and drew no mask would satisfy every
// assertion about E1 and the rails while doing none of what Movie asked for
// -- "make it a nice presentation where it is revealed to the user by the
// GROW". So the reveal is measured as INK ON THE CANVAS at two moments, and
// the two have to differ in the right direction.
//
// AND IT WRITES NOTHING, which is worth stating because the page's OTHER
// reveal did. tests/build-reveal-saved.spec.js exists because BUILD HOUSE
// lands its beam and teleposts on timers, each an ordinary edit with its own
// save -- so the page said SAVED with part of the house still queued. The
// rising reveal is a mask over a finished drawing: no edit, no save, nothing
// to promise. The last check here says so rather than leaving it assumed.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = h.STORAGE_BUCKET;

// A drawing with nothing in it, so the build below is the only geometry and
// E1 is derived from it alone.
const empty = () => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  walls: [], lines: [], dimensions: [], outlines: [],
});

// Ink is every pixel that is not the page's own ground. During the curtain
// the mask has painted surface-page over everything, so the count collapses;
// once it has climbed away the elevation is back. Reading the CANVAS rather
// than a screenshot keeps this off the scroll position -- the trap band 2's
// spec recorded and band 3's inherited.
const inkCount = page => page.evaluate(() => {
  const c = document.querySelector('#plan');
  const g = c.getContext('2d');
  const { data } = g.getImageData(0, 0, c.width, c.height);
  // The ground, sampled from the canvas itself rather than named: the skin
  // decides it, and this file should not need to know which skin is on.
  const r0 = data[0], g0 = data[1], b0 = data[2];
  let ink = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (Math.abs(data[i] - r0) > 12 || Math.abs(data[i + 1] - g0) > 12
      || Math.abs(data[i + 2] - b0) > 12) ink += 1;
  }
  return ink;
});

async function buildAHouse(page, opts = {}) {
  await h.openModel(page, { webgl: false, ...opts });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="twoStorey-over"]').click();
  await page.locator('#dt-bone').click();
}

test('a bone press jumps to E1 with both rails open', async ({ page }) => {
  await buildAHouse(page, { boneReveal: true });

  // CUT_VIEW + the id. The first draft of the port passed a bare 'E1', which
  // resolves to nothing and falls through to the layer-view branch -- the
  // fault cutForViewId's own comment already records from an earlier bug.
  await expect.poll(() => page.url(), { timeout: 8000 })
    .toContain('view=cut%3AE1');
  const url = new URL(page.url());
  expect(url.searchParams.get('left'), 'the left rail opens for the curtain')
    .toBe('1');
  expect(url.searchParams.get('right'), 'the right rail opens for the curtain')
    .toBe('1');
});

test('the curtain covers the elevation and then climbs off it', async ({ page }) => {
  await buildAHouse(page, { boneReveal: true });
  await expect.poll(() => page.url(), { timeout: 8000 }).toContain('view=cut%3AE1');

  // DURING: the held beat plus a little. revealStart sits one REVEAL_HOLD_MS
  // in the future, so these frames compute a clip below the canvas and the
  // mask covers everything.
  await page.waitForTimeout(600);
  const covered = await inkCount(page);

  // AFTER: past the hold and the whole climb, with room for a slow machine.
  await page.waitForTimeout(4200);
  const revealed = await inkCount(page);

  // THE PRECONDITION, SAID OUT LOUD. An elevation that drew nothing would
  // make both numbers zero and the comparison below would pass on an empty
  // canvas -- the shape of dud this repo keeps meeting.
  expect(revealed, 'the elevation drew nothing, so this file is measuring an '
    + 'empty canvas and proving nothing').toBeGreaterThan(2000);
  expect(covered, 'the curtain never covered the drawing -- the view changed '
    + 'but no mask was painted, which is the jump without the presentation')
    .toBeLessThan(revealed / 4);
});

test('BONE REVEAL off builds without leaving the plan', async ({ page }) => {
  // The suite seeds this setting OFF by default (helpers.js), which is the
  // path every other spec runs on -- so this also checks the port honours the
  // same switch the dc page does rather than inventing its own.
  await buildAHouse(page);
  await page.waitForTimeout(1200);
  expect(page.url(), 'a drafter who turned the reveal off stayed on the plan')
    .not.toContain('view=cut%3AE1');
});

test('the reveal writes nothing, so SAVED keeps its promise', async ({ page }) => {
  await buildAHouse(page, { boneReveal: true });
  await expect.poll(() => page.url(), { timeout: 8000 }).toContain('view=cut%3AE1');
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  const atSaved = JSON.stringify(await h.savedDrawing(page));

  // Past the entire reveal. The OTHER reveal on this page -- the beam and its
  // teleposts, on timers -- broke exactly this promise, which is why
  // build-reveal-saved.spec.js exists. A mask over a finished drawing cannot,
  // and that is a claim worth holding rather than assuming.
  await page.waitForTimeout(4200);
  expect(JSON.stringify(await h.savedDrawing(page)),
    'the rising reveal changed the drawing -- it is a mask, it must not write')
    .toBe(atSaved);
});
