// A TURNED PLAN REACHES EXT. FINISH — E1 keeps its own wall.
//
// Movie, 27 Sep, with a screenshot: *"i rotated the main floor plan and then
// went into the EXT FINISH area and the ELEVATIONS weren't switched E1 showed
// a side view instead of front. E2 was back view and also a line is cutting
// through in a wierd angle do you see that - looks like something to do with
// the attached garage"*.
//
// ── WHY IT BROKE, AND WHY NOTHING CAUGHT IT ─────────────────────────────────
//
// cut-marks grew `planTurn` when the house-rotate button landed. The ruling
// that shapes it is Movie's: *"the front view E1 will stay as the same view
// but the house and the E1-E4 lines will rotate"* -- so E1 keeps its own wall
// and its MARK walks a seat round the house. MODEL was taught to pass the
// turn. EXT. FINISH had its own copy of the cut builder and was not, in three
// separate places: it seated each cut off E_MARK_SIDES directly, it chose the
// cut's axis from a hardcoded `id === 'E1' || id === 'E3'`, and it asked
// eMarkDir for a direction with no turn in it.
//
// NO CHECK ON THIS PAGE HAD EVER HEARD OF A ROTATION. Both EXT. FINISH suites
// open an unturned fixture, so the page could ignore `planTurn` entirely and
// stay green -- which it did, from the day the button shipped.
//
// ── WHAT IS MEASURED ────────────────────────────────────────────────────────
//
// THE WALL, NOT THE PICTURE. "E1 shows the front" is hard to assert and easy
// to assert wrongly; "E1 shows the SAME WALL it showed before the turn" is the
// ruling itself, and the page will name a wall if you click one. So the same
// spot is clicked before and after, and the two readouts must agree.
//
// AND THE FIXTURE MUST MAKE THEM DIFFERENT. The house is 16 ft across the
// front and 12 ft deep, so a front wall and a side wall report different
// lengths -- without that, "the readout matches" would pass on a page showing
// any wall at all.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// THE TURN IS MADE THE WAY THE BUTTON MAKES IT, through plan-rotate on the
// page that owns it, rather than by writing `planTurn` into the file by hand.
// A hand-written turn would rotate nothing but the number, and the check would
// then be asking whether the marks move under a house that never did.
async function turnedDrawing(page, presses) {
  await h.suppressEntryCoach(page);
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => !!window.DraftPlanRotate, null, { timeout: 10000 });
  // ONE PRESS AT A TIME, which is what the button does and is NOT the same as
  // asking for four at once: rotateDrawing short-circuits a whole turn to a
  // copy, so `rotateDrawing(d, 4)` never touches planTurn at all -- correctly,
  // since nothing moved. Four separate quarters is the gesture a drafter
  // actually makes, and it is the one that walks planTurn 0-1-2-3-0 and puts
  // every coordinate through the lattice four times.
  return page.evaluate(({ saved, n }) => {
    let out = saved;
    for (let i = 0; i < n; i += 1) out = window.DraftPlanRotate.rotateDrawing(out, 1);
    return out;
  }, { saved: REPRO, n: presses });
}

async function openFinish(page, saved) {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: saved });
  await page.goto('/EXTFINISH.html');
  await page.waitForSelector('#elev-list [data-elev]', { timeout: 10000 });
}

// The same spot on the elevation, in the canvas's own fractions, so the two
// clicks are the same click whatever the drawing did in between.
async function clickFace(page, fx, fy) {
  const box = await page.locator('#elev').boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(80);
  return page.locator('#status').textContent();
}

test.describe('EXT. FINISH — a turned plan', () => {
  test('E1 shows the same wall after a quarter turn as before it',
    async ({ page }) => {
      await openFinish(page, REPRO);
      const straight = await clickFace(page, 0.5, 0.6);
      expect(straight, 'a wall was picked on E1 before the turn')
        .toMatch(/ft on E1/);

      const turned = await turnedDrawing(page, 1);
      expect(turned.planTurn, 'the drawing really was turned').toBe(1);
      await openFinish(page, turned);
      const after = await clickFace(page, 0.5, 0.6);

      expect(after, 'E1 keeps its own wall through the turn').toBe(straight);
    });

  test('and through a full round trip of four', async ({ page }) => {
    // FOUR QUARTERS IS WHERE IT STARTED, which makes this the one case where
    // a page that ignored the turn entirely would also pass -- so it is here
    // for the OPPOSITE reason to the check above: it pins that a turn all the
    // way round is a no-op rather than a drift, and plan-rotate's lattice is
    // what makes that true to the bit.
    await openFinish(page, REPRO);
    const straight = await clickFace(page, 0.5, 0.6);

    const turned = await turnedDrawing(page, 4);
    expect(turned.planTurn, 'four quarters is back to zero').toBe(0);
    await openFinish(page, turned);
    expect(await clickFace(page, 0.5, 0.6),
      'a house turned the whole way round draws what it started as')
      .toBe(straight);
  });

  test('every elevation moves one seat along, not just E1', async ({ page }) => {
    // E1 ALONE WOULD PASS ON A PAGE THAT SPECIAL-CASED IT, and the report
    // named two: *"E1 showed a side view instead of front. E2 was back view"*.
    // So all four are walked, and each must still be looking at the wall it
    // was looking at before -- which is the whole of "the E1-E4 lines rotate".
    const spots = { E1: [0.5, 0.6], E2: [0.5, 0.6], E3: [0.5, 0.6], E4: [0.5, 0.6] };
    const readAll = async () => {
      const out = {};
      for (const [id, [fx, fy]] of Object.entries(spots)) {
        await page.locator(`#elev-list [data-elev="${id}"]`).click();
        await page.waitForTimeout(80);
        out[id] = await clickFace(page, fx, fy);
      }
      return out;
    };

    await openFinish(page, REPRO);
    const before = await readAll();
    // THE FOUR MUST NOT ALL READ THE SAME, or the comparison below is empty.
    expect(new Set(Object.values(before)).size,
      'the four elevations show different walls to begin with')
      .toBeGreaterThan(1);

    await openFinish(page, await turnedDrawing(page, 1));
    expect(await readAll(), 'every elevation keeps its own wall').toEqual(before);
  });
});
