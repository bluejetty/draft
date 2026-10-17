// A ROOF'S ENDS, AND A WING THAT IS A ROOF OF ITS OWN.
//
// Movie, 16 Oct, with his own modified bilevel traced and marked up in GIMP:
//
//   "the back on this one could have been a hip" -- a V drawn at the main
//   block's back end;
//   "the upper roof should have been 2 separate roofs with a gable on both"
//   -- the main block and the stub beside it;
//   "can you draw the lower red roof that connects back to the house wall
//   gable (show it as dotted line (under the upper roof overhang) make it
//   clear they are 2 different roofs that way";
//   a 45-degree line from the stub's far corner to the room's wall;
//   "the upper 2nd floor roof can be hip no problem because it won't have to
//   worry about height of other walls";
//   "the peak of the roof should be at the 2nd floor wall if there is main
//   floor roof beside the 2nd floor wall slope that roof AWAY or to the SIDES
//   of that 2nd floor wall".
//
// This drives his house the way he drew it: the drive-thru's OUTLINE press,
// six corners for the house, the garage's legs off it, and the room-over
// card's BUILD. Then it reads the four roofs the build filed.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

// HIS FILE'S LEVELS AND NOTHING ELSE: a named, empty drawing for the build
// to land in, with the MOD BILEVEL's own level stack already in it.
const EMPTY = (() => {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-roof-wings.draft'), 'utf8'));
  Object.keys(d).forEach(key => { if (Array.isArray(d[key]) && key !== 'levels') d[key] = []; });
  d.buildType = null;
  return d;
})();

const HOUSE = [[0, 0], [0, -18], [-12, -18], [-12, -22], [-36, -22], [-36, 0]];
const GARAGE = [[-12, 0], [-12, 10], [14, 10], [14, 2], [24, 2], [24, -12], [0, -12], [0, 0]];

const r = n => Math.round(n * 100) / 100;
const ringOf = roof => roof.points.map(p => [r(p.x), r(p.z)]);
const edgeOf = (roof, a, b) => {
  const pts = roof.points;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const same = (u, v) => Math.abs(u.x - v[0]) < 0.01 && Math.abs(u.z - v[1]) < 0.01;
    if ((same(p, a) && same(q, b)) || (same(p, b) && same(q, a))) {
      return { kind: roof.edges[i], overhang: roof.edgeOverhang ? roof.edgeOverhang[i] : roof.overhang };
    }
  }
  return null;
};

async function buildHisHouse(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    // A NAMED, EMPTY FILE, so the build's autosave has somewhere to land.
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: EMPTY });
  await page.goto('/MODEL.html?mode=day&pane=previews&right=1&level=3&lpane=drafting&left=1');
  await page.waitForTimeout(1200);
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bilevel"]').click();
  await page.locator('[data-build-entry="modifiedBilevel"]').click();
  await page.locator('#dt-outline').click();
  await expect(page.locator('#drivethru')).toBeHidden();
  await h.dropSeededCorner(page);
  // Zoomed out until the 60 ft plan fits the canvas, read back off the view.
  const box = await page.locator('#plan').boundingBox();
  let frame = await h.planFrame(page);
  for (let i = 0; i < 30 && frame.scale > 8; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(100);
    frame = await h.planFrame(page);
  }
  const { at } = frame;
  for (const [x, z] of HOUSE) await page.mouse.click(...at(x, z));
  await page.mouse.click(...at(0, 0));
  await expect(page.locator('#strip-message')).toContainText('Now draw the garage', { timeout: 5000 });
  // PROFESSOR GRUFF explains the garage's legs before the first press.
  const coach = page.locator('[data-garage-lesson-go]');
  await coach.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {});
  if (await coach.isVisible().catch(() => false)) await coach.click();
  else await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  for (const [x, z] of GARAGE) {
    await page.mouse.click(...at(x, z));
    await page.waitForTimeout(120);
  }
  await expect(page.locator('#room-pick')).toBeVisible({ timeout: 5000 });
  await page.locator('#room-pick [data-room-pick-build]').click();
  await expect(page.locator('#strip-message')).toContainText('MODIFIED BILEVEL built', { timeout: 15000 });
  if (await page.locator('#lot-pick').isVisible().catch(() => false)) {
    await page.locator('#lot-pick [data-lot-pick-skip]').click();
  }
  await page.locator('#save').click().catch(() => {});
  await h.waitForSaved(page).catch(() => {});
  await page.waitForTimeout(1500);
  const d = await h.savedDrawing(page);
  expect(d, 'the build was saved').toBeTruthy();
  return d;
}

test('his house: the main block hips at the back and gables at the stub; the stub is its own roof under the rake', async ({ page }) => {
  test.setTimeout(180000);
  const d = await buildHisHouse(page);
  const roofs = d.roofs || [];
  expect(roofs.length, '"2 separate roofs": house, stub, room, garage stub').toBe(4);
  const main = roofs.find(roof => roof.points.some(p => p.x < -37));
  const stub = roofs.find(roof => roof.points.every(p => p.x >= -12.01 && p.x <= 2.01 && p.z <= -11.99));
  expect(main, 'the main block has a roof').toBeTruthy();
  expect(stub, 'the stub has a roof of its own').toBeTruthy();
  // THE BACK END HIPS: "the back on this one could have been a hip".
  expect(edgeOf(main, [-38, 2], [-38, -24]), 'the back end').toEqual({ kind: 'eave', overhang: 2 });
  // THE SIDES STAY EAVES.
  expect(edgeOf(main, [-38, -24], [-10, -24]).kind).toBe('eave');
  expect(edgeOf(main, [-12, 2], [-38, 2]).kind).toBe('eave');
  // THE GARAGE END IS A GABLE WITH ITS RAKE OVER THE STUB: "connects back to
  // the house wall gable ... under the upper roof overhang".
  expect(edgeOf(main, [-10, -24], [-10, -12]), 'the rake over the stub').toEqual({ kind: 'gable', overhang: 2 });
  // THE EDGES ALONG THE LANDING ARE FLUSH GABLES: the peak is at that wall.
  expect(edgeOf(main, [-10, -12], [-13.5, -12])).toEqual({ kind: 'gable', overhang: 0 });
  expect(edgeOf(main, [-13.5, -12], [-13.5, -6])).toEqual({ kind: 'gable', overhang: 0 });
  // THE STUB: flush against the house wall, flush against the room's wall,
  // an eave to the north, and a hip at its open end -- his 45-degree line.
  expect(ringOf(stub)).toEqual([[-12, -12], [-12, -20], [2, -20], [2, -12]]);
  expect(edgeOf(stub, [-12, -12], [-12, -20]), 'into the house wall').toEqual({ kind: 'gable', overhang: 0 });
  expect(edgeOf(stub, [2, -12], [-12, -12]), 'into the room wall').toEqual({ kind: 'gable', overhang: 0 });
  expect(edgeOf(stub, [-12, -20], [2, -20]), 'the north eave').toEqual({ kind: 'eave', overhang: 2 });
  expect(edgeOf(stub, [2, -20], [2, -12]), 'the open end hips').toEqual({ kind: 'eave', overhang: 2 });
  // AND THE STUB RUNS UNDER THE RAKE: the plan dots what is under it.
  const spans = await page.evaluate(({ stub, main }) => window.DraftGeometry2D.roofHiddenSpans(stub, [main]),
    { stub, main });
  const west = spans[0];
  expect(west, 'the whole west edge lies under the rake').toEqual([[0, 1]]);
  expect(spans[1][0][0], 'the north eave: the first two feet').toBeCloseTo(0, 5);
  expect(spans[1][0][1] * 14, 'the north eave: the first two feet').toBeCloseTo(2, 2);
});

test('his house: the room over the garage hips both ends, and the garage stub rises to its wall with a hipped front', async ({ page }) => {
  test.setTimeout(180000);
  const d = await buildHisHouse(page);
  const roofs = d.roofs || [];
  const room = roofs.find(roof => Number(roof.sourceLevelId) === 4);
  const garage = roofs.find(roof => roof.garage === true);
  expect(room, 'the room over the garage has a roof').toBeTruthy();
  expect(garage, 'the garage stub has a roof').toBeTruthy();
  // "the upper 2nd floor roof can be hip no problem because it won't have
  // to worry about height of other walls".
  expect(room.edges.every(kind => kind === 'eave'), `room edges ${room.edges}`).toBe(true);
  // "slope that roof AWAY or to the SIDES of that 2nd floor wall": flush
  // against the room, hipped everywhere else -- his "hip version".
  expect(edgeOf(garage, [18, -14], [18, 4])).toEqual({ kind: 'gable', overhang: 0 });
  expect(edgeOf(garage, [18, 4], [26, 4]).kind).toBe('eave');
  expect(edgeOf(garage, [26, -14], [18, -14]).kind).toBe('eave');
  expect(edgeOf(garage, [26, 4], [26, -14]).kind).toBe('eave');
});
