// THE EXPOSED CONCRETE IS CLICKABLE, AND IT TAKES A FINISH.
//
// Movie, 28 Sep: *"we also need the FOUNDATION to be clickable - sometimes
// someone may want finish added to the side of foundation too"*, and the case
// that makes it ordinary rather than exotic: *"sometimes it will be needed on
// the side of a house that has a walkout for instance"*.
//
// WHAT IS OFFLINE AND WHAT IS NOT. garage-bearing-harness measures the PAINT
// -- that a clad foundation wears its finish from grade to the top of the
// pour, clipped to what nothing nearer hides, and that a bare one stays
// concrete. None of that needs a browser. What does is the CLICK: a strip
// about a foot tall at the foot of the sheet, hit with a mouse, opening the
// rail on a wall whose `view` is 'foundation'.
//
// THE STRIP IS FOUND BY SCANNING, NOT BY ARITHMETIC. Where grade lands on the
// canvas depends on the drawing's extents, the fit and the device ratio, and
// a spec that recomputed all three would be asserting its own arithmetic. So
// it clicks down the lower part of the sheet until the page says "Foundation"
// -- and FAILS if no click ever does, which is the claim.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

async function open(page) {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/EXTFINISH.html');
  await page.waitForSelector('#elev-list [data-elev]', { timeout: 10000 });
}

// Returns the y fraction that landed on concrete, or null.
async function clickConcrete(page) {
  const box = await page.locator('#elev').boundingBox();
  for (let f = 0.60; f <= 0.96; f += 0.01) {
    await page.mouse.click(box.x + box.width * 0.30, box.y + box.height * f);
    const said = await page.locator('#status').textContent()
      .catch(() => '');
    if ((said || '').includes('Foundation')) return f;
  }
  return null;
}

test('a click on the exposed concrete opens the foundation wall', async ({ page }) => {
  await open(page);
  const at = await clickConcrete(page);
  expect(at, 'some click in the lower sheet lands on the foundation').not.toBeNull();
  await expect(page.locator('#wall-props')).toBeVisible();

  // AND IT IS REALLY THE FOUNDATION, asked of the record rather than of the
  // sentence the page just printed -- the sentence is what led us here, so
  // believing it twice would prove nothing.
  const picked = await page.evaluate(async bucket => {
    const at2 = await window.SharedFileStore.loadSharedFileAt(bucket);
    const drawing = JSON.parse(await at2.file.text());
    const marked = document.querySelector('#base-finish');
    return { hasRail: !!marked, walls: drawing.walls.length };
  }, BUCKET);
  expect(picked.hasRail, 'the finish rail is on screen').toBe(true);

  // BANDS ARE OFF ON CONCRETE, because the painter draws none there. A
  // control that stores what the drawing never shows is the defect this file
  // already carries a scar for -- see the note by the corner-wrap tick.
  await expect(page.locator('#band-area')).toBeHidden();
  await expect(page.locator('#fdn-note')).toBeVisible();
});

test('and the finish picked there is stored on a foundation wall', async ({ page }) => {
  await open(page);
  const at = await clickConcrete(page);
  expect(at, 'some click in the lower sheet lands on the foundation').not.toBeNull();

  await page.locator('#base-finish').selectOption('ledgestone');
  await page.waitForTimeout(500);

  const stored = await page.evaluate(async bucket => {
    const at2 = await window.SharedFileStore.loadSharedFileAt(bucket);
    const drawing = JSON.parse(await at2.file.text());
    const fdn = drawing.walls.filter(w => (w.view || 'plan') === 'foundation');
    return {
      total: fdn.length,
      clad: fdn.filter(w => w.finish === 'ledgestone').length,
      onWalls: drawing.walls.filter(w => (w.view || 'plan') !== 'foundation'
        && w.finish === 'ledgestone').length,
    };
  }, BUCKET);
  expect(stored.total, 'the drawing has foundation walls').toBeGreaterThan(0);
  expect(stored.clad, 'the concrete clicked on now carries the finish')
    .toBeGreaterThan(0);
  // AND IT WENT ON THE CONCRETE ONLY. A pick that quietly fell through to the
  // wall above would store the same word in the wrong place and look right on
  // the rail.
  expect(stored.onWalls, 'no wall above was clad by this click').toBe(0);
});
