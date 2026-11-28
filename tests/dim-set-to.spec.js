// TYPE THE DIMENSION, THE WINDOW MOVES (jb, 27 Nov 2026): "for windows and
// doors would it be possible to select the dimension and see over in the OBJ
// PROP it shows the measurement - could you allow the user to type in and
// change the dimension and move the window to that new dimension ... and if
// the user clicks directly on the dimension text it would be cool to change
// it directly there too" -- and the rule he settled: "keeping the window
// exactly as it is, but change distance from the corner ... should only work
// from corner to first window or door".
//
// OBJ / PROP's SET TO box and a double-click on the figure both run
// driveDimension (the LENGTH box's, tests/driving-dims.spec.js), so these
// cover the new doors into it and the new refusals.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const W = (id, a, b) => ({ id, start: P(...a), end: P(...b), levelId: 3, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const D = (id, a, b) => ({ id, start: P(...a), end: P(...b), levelId: 3, view: 'plan',
  layer: 'A-DIMS-HAND', auto: false });
const WIN = (id, offset, width = 6) => ({ id, wallId: 'w', levelId: 3, view: 'plan', type: 'window',
  offset, width, sillHeight: 3, headHeight: 6 + 8 / 12 });
const drawing = extra => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, f, url = '/MODEL.html') {
  await h.openEditor(page, { drawing: f, bucket: BUCKET, url: url, webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
// Where the dimension is drawn beside (x, z): found by the hover, since the
// painter stands its line a screen distance off the record's points.
async function dimSpot(page, at, x, z) {
  await page.mouse.move(5, 300);
  await page.waitForTimeout(40);
  for (const dz of [0.25, 0.5, 0.75, 1, 1.25, 1.5, -0.25, -0.5, -0.75, -1]) {
    await page.mouse.move(...at(x, z + dz));
    await page.waitForTimeout(40);
    if (/DIM/.test(await page.locator('#hover-name').textContent())) return at(x, z + dz);
  }
  throw new Error('no dimension under the cursor beside its points');
}
async function pick(page, at, x, z) {
  const spot = await dimSpot(page, at, x, z);
  await page.mouse.click(...spot);
  await page.waitForTimeout(120);
  return spot;
}
const setTo = async (page, typed) => {
  const box = page.locator('[data-dim-set-to]');
  await expect(box, 'OBJ / PROP has the SET TO box').toBeVisible();
  await box.fill(typed);
  await box.press('Enter');
  await page.waitForTimeout(150);
};

test('OBJ / PROP: typed 6 on the corner-to-window 6\'-0 1/4" dim, the window slides the 1/4"', async ({ page }) => {
  // The window's west jamb 6'-0 1/4" from the wall's west end, as in jb's
  // screenshot; the dimension stands 3' off the wall.
  const q = 0.25 / 12;
  const { at } = await open(page, drawing({
    walls: [W('w', [-10, 0], [10, 0])],
    fenestrations: [WIN('win-1', 6 + q + 3)],
    dimensions: [D(41, [-10, 3], [-10 + 6 + q, 3])],
  }));
  await page.locator('#objprop-tab').click();
  await pick(page, at, -7, 3);
  await expect(page.locator('[data-objprop-title]')).toContainText('DIMENSION');
  await expect(page.locator('[data-dim-set-to]')).toHaveValue('6\'-0 1/4"');
  await setTo(page, '6');
  await expect(page.locator('#strip-message')).toContainText('window slid');
  let d = await saved(page);
  expect(d.fenestrations[0].offset, 'the window went the quarter inch').toBeCloseTo(9, 6);
  expect(d.fenestrations[0].width, 'and kept its size').toBeCloseTo(6, 6);
  expect(d.walls[0].start.x, 'the corner stayed').toBeCloseTo(-10, 6);
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect(d.fenestrations[0].offset, 'one UNDO puts it back').toBeCloseTo(9 + q, 6);
});

test('OBJ / PROP on an AUTO string: the window slides and the new piece stays picked', async ({ page }) => {
  const { at } = await open(page, drawing({
    walls: [W('n', [-10, -10], [10, -10]), W('e', [10, -10], [10, 10]), W('s', [10, 10], [-10, 10]), W('w', [-10, 10], [-10, -10])],
    fenestrations: [{ ...WIN('win-1', 10, 3), wallId: 'n' }],
  }), '/MODEL.html?left=1');
  await h.selectTool(page, 'Dimension');
  await page.locator('[data-auto-dims]').click();
  await page.waitForTimeout(200);
  await h.armFromRail(page, 'select');
  const before = await saved(page);
  // The north string's piece from the west corner to the window.
  const piece = before.dimensions.find(d => d.auto && Math.abs(d.start.z - d.end.z) < 1e-6 && d.start.z < -10
    && Math.min(d.start.x, d.end.x) < -9 && [d.start.x, d.end.x].some(x => Math.abs(Math.abs(x) - 1.5) < 0.01 || Math.abs(x) < 0.01));
  expect(piece, 'AUTO DIMS strung the window from the west').toBeTruthy();
  const was = Math.abs(piece.end.x - piece.start.x);
  await page.keyboard.press('0');
  await page.waitForTimeout(150);
  const f = await h.planFrame(page);
  await page.locator('#objprop-tab').click();
  await pick(page, f.at, (piece.start.x + piece.end.x) / 2, piece.start.z);
  await setTo(page, '7');
  await expect(page.locator('#strip-message')).toContainText('window slid');
  const d = await saved(page);
  expect(d.fenestrations[0].offset - 10, 'the window went the difference').toBeCloseTo(7 - was, 6);
  await expect(page.locator('[data-dim-set-to]'), 'the new piece is picked and reads the figure').toHaveValue('7\'-0"');
});

test('a double-click on the figure opens a box there; ENTER moves the window, Esc leaves it', async ({ page }) => {
  const { at } = await open(page, drawing({
    walls: [W('w', [-10, 0], [10, 0])],
    fenestrations: [WIN('win-1', 10)],
    dimensions: [D(41, [-10, 3], [-3, 3])],
  }));
  const spot = await dimSpot(page, at, -6.5, 3);
  await page.mouse.dblclick(...spot);
  const box = page.locator('[data-dim-figure-edit]');
  await expect(box, 'the box opens on the figure').toBeVisible();
  await expect(box).toHaveValue('7\'-0"');
  await box.fill('9-6');
  await box.press('Escape');
  await expect(box).toHaveCount(0);
  let d = await saved(page);
  expect(d.fenestrations[0].offset, 'Esc moved nothing').toBeCloseTo(10, 6);

  await page.mouse.dblclick(...spot);
  await expect(box).toBeVisible();
  await box.fill('9-6');
  await box.press('Enter');
  await expect(box).toHaveCount(0);
  await expect(page.locator('#strip-message')).toContainText('window slid');
  d = await saved(page);
  expect(d.fenestrations[0].offset, "the window's jamb 9'-6\" from the corner").toBeCloseTo(12.5, 6);
});

test('refused, nothing moves: the window\'s own width, window to window, and into the next window', async ({ page }) => {
  const { at } = await open(page, drawing({
    walls: [W('w', [-10, 0], [10, 0])],
    // Jambs at -6/-3 and 2/5.
    fenestrations: [WIN('win-1', 5.5, 3), WIN('win-2', 13.5, 3)],
    dimensions: [
      D(41, [-6, 3], [-3, 3]),      // win-1's own width
      D(42, [-3, -3], [2, -3]),     // win-1 to win-2
      D(43, [-10, -3], [-6, -3]),   // the west corner to win-1
    ],
  }));
  await page.locator('#objprop-tab').click();
  await pick(page, at, -4.5, 3);
  await setTo(page, '4');
  await expect(page.locator('#strip-message')).toContainText("own width");
  await pick(page, at, -0.5, -3);
  await setTo(page, '3');
  await expect(page.locator('#strip-message')).toContainText('An opening at each end');
  await pick(page, at, -8, -3);
  await setTo(page, '11');
  await expect(page.locator('#strip-message')).toContainText('run into the window');
  const d = await saved(page);
  expect(d.fenestrations.map(o => [o.offset, o.width]), 'both windows as they were').toEqual([[5.5, 3], [13.5, 3]]);
});
