// THE DRIVE-THRU'S OUTLINE PRESS PUTS THE FIRST CORNER DOWN ITSELF.
//
// Movie, 15 Oct: "when they select to DRAW THE OUTLINE (at the drive thru)
// when the drivethru window disappears and it goes to the model space screen,
// select the first point for them on the bullseye (registration point), and
// allow them to proceed from that point" -- and, when I read it back to him,
// "starting on the bullseye would feel good".
//
// THE WHOLE FEATURE IS ONE CORNER, so the only way to see it is to draw a
// loop that is one corner short. Every test here presses three corners and
// then presses where the seed should be: if the seed is there that press
// CLOSES the loop and a master is kept, and if it is not there the press is
// an ordinary fourth corner and nothing is kept. A check that counted pending
// corners through some back door would pass on a seed the drafter cannot
// actually draw from, which is the only failure worth catching.
//
// AND IT IS THE DRIVE-THRU PRESS ALONE. Arming the same tool from the key, or
// by picking a type at the window, seeds nothing -- the drafter has not said
// he is about to draw, and a corner placed under him is a corner he did not
// put there. Both of those are tested, and so is the drawing that has no
// bullseye on it at all.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = extra => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, extra) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty(extra) });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// PRESS THE DRIVE-THRU'S OUTLINE LINK, with a type picked so it is offered at
// all, and wait for the sign to slide clear -- the canvas presses below land
// where the sign was.
async function pressDrawOutline(page) {
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow"]').click();
  const link = page.locator('#dt-banner-outline');
  await expect(link).toHaveText('DRAW HOUSE OUTLINE');
  await link.click();
  await expect(page.locator('#drivethru')).toBeHidden();
}

// THE LOOPS THE TRACE KEPT, read back off the store.
//
// drawing.outlines, NOT boneyardOutlines, and that is not a detail: the
// drive-thru press builds the house the moment the loop closes
// (tracedBuildsOnClose), and the build takes the masters with it -- a check
// reading boneyardOutlines here finds an empty list after a trace that worked
// perfectly. The copy on the level is what both routes leave behind.
async function savedLoops(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  return (d.outlines || []).map(o =>
    o.points.map(p => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]));
}

test('the drive-thru press leaves the first corner on the bullseye', async ({ page }) => {
  await open(page);
  await pressDrawOutline(page);
  const { at } = await h.planFrame(page);
  // THREE CORNERS, not four. The fourth press is on the datum, and it closes
  // the loop only because the press already put a corner there.
  await page.mouse.click(...at(20, 0));
  await page.mouse.click(...at(20, 15));
  await page.mouse.click(...at(0, 15));
  await page.mouse.click(...at(0, 0));
  const loops = await savedLoops(page);
  expect(loops.length, 'three presses and the datum closed a loop').toBe(1);
  expect(new Set(loops[0].map(String)),
    'the corner the drafter never placed is the one at the bullseye').toEqual(
    new Set([[0, 0], [20, 0], [20, 15], [0, 15]].map(String)));
});

test('the drafter is not stuck with it: UNDO takes the seeded corner back', async ({ page }) => {
  // A HOUSE THAT DOES NOT START AT THE DATUM is still his to draw. The corner
  // in hand is what UNDO takes first (Movie, 4 Oct: "can we make the UNDO
  // feature go back one line in the outline creation"), so one press puts the
  // sheet back where the key would have left it -- which is the route every
  // older spec that traces away from the origin now takes.
  await open(page);
  await pressDrawOutline(page);
  await page.keyboard.press('Control+z');
  await expect(page.locator('#strip-message')).toContainText('first corner taken back');
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(30, 10));
  await page.mouse.click(...at(50, 10));
  await page.mouse.click(...at(50, 25));
  await page.mouse.click(...at(30, 25));
  await page.mouse.click(...at(30, 10));
  const loops = await savedLoops(page);
  expect(loops.length, 'the house he actually walked').toBe(1);
  expect(new Set(loops[0].map(String)), 'and the datum is not in it').toEqual(
    new Set([[30, 10], [50, 10], [50, 25], [30, 25]].map(String)));
});

test('the tool armed from the key seeds nothing', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await h.selectTool(page, 'outline');
  await page.mouse.click(...at(20, 0));
  await page.mouse.click(...at(20, 15));
  await page.mouse.click(...at(0, 15));
  // The same four presses as above. With no seed under them this is a loop
  // still open at its last corner, not a closed one.
  await page.mouse.click(...at(0, 0));
  expect(await savedLoops(page), 'nothing closed on the datum').toEqual([]);
  // And it closes where it actually started.
  await page.mouse.click(...at(20, 0));
  expect((await savedLoops(page)).length, 'closed on its own first corner').toBe(1);
});

test('a type picked at the window seeds nothing either', async ({ page }) => {
  await open(page);
  await h.openDriveThru(page);
  // PICKING THE TYPE ARMS THE SAME TRACE -- it always has -- but he has not
  // said he is about to draw, so no corner is put down for him.
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#drivethru')).toBeHidden();
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(20, 0));
  await page.mouse.click(...at(20, 15));
  await page.mouse.click(...at(0, 15));
  await page.mouse.click(...at(0, 0));
  expect(await savedLoops(page), 'nothing closed on the datum').toEqual([]);
});

test('the seed follows the datum, it is not the world origin', async ({ page }) => {
  // A DRAWING WHOSE BULLSEYE HAS BEEN MOVED. The painter draws it at the
  // drawingOrigin, so that is where the corner has to be.
  await open(page, { drawingOrigin: { x: 10, z: -6 } });
  await pressDrawOutline(page);
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(30, -6));
  await page.mouse.click(...at(30, 9));
  await page.mouse.click(...at(10, 9));
  await page.mouse.click(...at(10, -6));
  const loops = await savedLoops(page);
  expect(loops.length, 'it closed on the moved bullseye').toBe(1);
  expect(new Set(loops[0].map(String))).toEqual(
    new Set([[10, -6], [30, -6], [30, 9], [10, 9]].map(String)));
});

test('a drawing with no bullseye painted gets no corner', async ({ page }) => {
  // gridDatum answers three ways and the painter draws a bullseye on two of
  // them. On the third there is nothing on screen to stand on, and a corner
  // placed out of sight is worse than no corner at all.
  await open(page, { drawingOrigin: null });
  await pressDrawOutline(page);
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(20, 0));
  await page.mouse.click(...at(20, 15));
  await page.mouse.click(...at(0, 15));
  await page.mouse.click(...at(0, 0));
  expect(await savedLoops(page), 'no mark, no seed').toEqual([]);
});
