// DIMENSION CHAINS: points in any order, SPACE as well as ENTER, line after
// line of the same points, and a dimension row copied out to trim.
//
// Movie, 20 Oct: "i'd like it if it doesn't matter what order they are
// placed, the closest together ones will create a dimention between and the
// END the cycle it is press ENTER now, can you also add PRESS SPACEBAR to also
// end the cycle and go to placing the line ,,, after the first line is placed
// can you also allow the user to place a SECOND line in another position and
// another until the user double clicks the mouse, enter key or keyboard
// (click again after the last one twice) to stop making new ones .. and then
// on the new ones, what i like to do is just DELETE the locations of the
// dimensions that i don't want on the 2nd or 3rd chain ... i'd also like to be
// able to copy and paste and existing dimension line a little further outward
// or inward so i can delete some of the dimensions on it for new dimension
// line".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
const drawing = (walls = []) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 20,
  walls, lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
// Two walls in a row and one up from the far end: nodes at x = 0, 4 and 10
// on z = 0, and at (10, 6).
const RUN = [W('w1', [0, 0], [4, 0]), W('w2', [4, 0], [10, 0]), W('w3', [10, 0], [10, 6])];

async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
// AT A KNOWN ZOOM, 40 to 90 px a foot, so every press is on the open sheet.
async function frame(page) {
  const box = await page.locator('#plan').boundingBox();
  for (let i = 0; i < 12; i++) {
    const { scale } = await h.planFrame(page);
    if (scale >= 40 && scale <= 90) break;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, scale > 90 ? 120 : -120);
    await page.waitForTimeout(120);
  }
  return h.planFrame(page);
}
async function press(page, at, pt) {
  await page.mouse.move(...at(...pt));
  await page.waitForTimeout(50);
  await page.mouse.click(...at(...pt));
  await page.waitForTimeout(50);
}
async function armDimension(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const key = page.locator('[data-tool-key="dimension"]');
  if (await key.getAttribute('aria-pressed') !== 'true') await page.keyboard.press('d');
  await expect(key).toHaveAttribute('aria-pressed', 'true');
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const hand = d => (d.dimensions || []).filter(x => x.layer === 'A-DIMS-HAND');
const r2 = n => Math.round(n * 100) / 100;
const span = x => [r2(Math.min(x.start.x, x.end.x)), r2(Math.max(x.start.x, x.end.x)),
  r2(Math.min(x.start.z, x.end.z)), r2(Math.max(x.start.z, x.end.z))];
// The side drawDimension2D stands the line off to: the left of start -> end.
const inkSide = x => ({ x: -(x.end.z - x.start.z), z: x.end.x - x.start.x });


test('points pressed in any order measure between neighbours along the string', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  for (const pt of [[0, 0], [10, 0], [4, 0]]) await press(page, at, pt);
  await page.keyboard.press('Enter'); // once ends the points (Movie, 23 Oct)
  await press(page, at, [5, -1.5]);
  const pieces = hand(await saved(page)).map(span).map(s => [s[0], s[1]]).sort((a, b) => a[0] - b[0]);
  expect(pieces, '0 to 4, then 4 to 10 -- not 0 to 10 and back').toEqual([[0, 4], [4, 10]]);
});

test('SPACE ends the points as ENTER does', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  await press(page, at, [0, 0]);
  await press(page, at, [4, 0]);
  await page.keyboard.press(' '); // once ends the points (Movie, 23 Oct)
  await expect(page.locator('#strip-message')).toContainText('click where the string goes');
  await press(page, at, [2, -1.5]);
  expect(hand(await saved(page))).toHaveLength(1);
});

test('after the first line, each click lays another line of the same points until ENTER', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  for (const pt of [[0, 0], [4, 0], [10, 0]]) await press(page, at, pt);
  await page.keyboard.press('Enter'); // once ends the points (Movie, 23 Oct)
  await press(page, at, [5, 1.5]);
  await expect(page.locator('#strip-message')).toContainText('another line');
  await press(page, at, [5, 3]);
  await press(page, at, [5, 4.5]);
  await page.keyboard.press('Enter');
  let d = await saved(page);
  expect(hand(d), 'three lines of two pieces').toHaveLength(6);
  const rows = [...new Set(hand(d).map(x => r2(x.start.z)))].sort((a, b) => a - b);
  expect(rows, 'on three rows').toHaveLength(3);
  // FINISHED: the next press starts a fresh string, not another line.
  await press(page, at, [0, 0]);
  await expect(page.locator('#strip-message')).toContainText('the next point');
  // AND A PIECE OFF AN OUTER LINE IS DELETED LIKE ANY DIMENSION.
  await page.keyboard.press('Escape');
  await h.armFromRail(page, 'select');
  const outer = hand(d).find(x => r2(x.start.z) === rows[0]);
  const mx = (outer.start.x + outer.end.x) / 2;
  let hit = false;
  for (const dz of [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75]) {
    await page.mouse.move(...at(mx, outer.start.z + dz));
    await page.waitForTimeout(40);
    if (/DIM/.test(await page.locator('#hover-name').textContent())) { await page.mouse.click(...at(mx, outer.start.z + dz)); hit = true; break; }
  }
  expect(hit, 'the outer piece is under the cursor').toBe(true);
  await page.locator('#delete').click();
  d = await saved(page);
  expect(hand(d), 'one piece gone, the rest kept').toHaveLength(5);
});

// MOVIE'S SEQUENCE (24 Oct): LEFT only adds; RIGHT, SPACE or ENTER finish.
test('a click beside the line just placed lays another; a click right on it lays nothing; ENTER finishes', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  for (const pt of [[0, 0], [4, 0], [10, 0]]) await press(page, at, pt);
  await page.keyboard.press('Enter');
  await press(page, at, [5, 1.5]);
  await press(page, at, [7, 1.5]);           // the same line again: nothing new
  await press(page, at, [5, 2.5]);           // a foot further: a second line
  await expect(page.locator('#strip-message')).not.toContainText('done');
  expect(hand(await saved(page))).toHaveLength(4);
  await page.keyboard.press('Enter');
  await expect(page.locator('#strip-message')).toContainText('done');
  expect(hand(await saved(page))).toHaveLength(4);
});

test('a double-click does not finish: it is two clicks, one line, and the string waits for ENTER', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  for (const pt of [[0, 0], [4, 0], [10, 0]]) await press(page, at, pt);
  await page.keyboard.press('Enter');
  await page.mouse.dblclick(...at(5, 4));
  await page.waitForTimeout(100);
  await expect(page.locator('#strip-message')).not.toContainText('done');
  expect(hand(await saved(page))).toHaveLength(2);
  await page.keyboard.press('Enter');
  await expect(page.locator('#strip-message')).toContainText('done');
});

// ESC KEEPS WHAT IS DOWN (Movie, 25 Oct: "can we change it so what has been
// created so far is KEPT when ESC is pressed").
test('ESC while the lines are being laid keeps every line already laid, and lays no more', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  for (const pt of [[0, 0], [4, 0], [10, 0]]) await press(page, at, pt);
  await page.keyboard.press('Enter');
  await press(page, at, [5, 1.5]);
  await press(page, at, [5, 3]);
  expect(hand(await saved(page))).toHaveLength(4);
  await page.mouse.move(...at(6, 6));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await expect(page.locator('#strip-message')).toContainText('2 lines kept');
  expect(hand(await saved(page)), 'both lines stay, none at the mouse').toHaveLength(4);
  // THE NEXT PRESS STARTS A FRESH STRING.
  await press(page, at, [0, 0]);
  await expect(page.locator('#strip-message')).toContainText('the next point');
  // AND UNDO STILL TAKES THEM BACK ONE LINE AT A TIME.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  expect(hand(await saved(page)), 'one line back').toHaveLength(2);
});

test('points clicked quickly, one after another, are all points', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  for (const pt of [[0, 0], [4, 0], [10, 0]]) await page.mouse.click(...at(...pt));
  await page.keyboard.press('Enter');
  await press(page, at, [5, 1.5]);
  await page.keyboard.press('Enter');
  expect(hand(await saved(page)), 'three points, two dimensions').toHaveLength(2);
});

test('a dimension COPIED and PASTED lands as a row of its own, 2 ft out, to slide and trim', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  await press(page, at, [0, 0]);
  await press(page, at, [4, 0]);
  await page.keyboard.press('Enter'); // once ends the points (Movie, 23 Oct)
  await press(page, at, [2, -1.5]);
  await page.keyboard.press('Enter');
  const [orig] = hand(await saved(page));
  await h.armFromRail(page, 'select');
  let hit = false;
  for (const dz of [0, 0.25, -0.25, 0.5, -0.5, 0.75, -0.75]) {
    await page.mouse.move(...at(2, orig.start.z + dz));
    await page.waitForTimeout(40);
    if (/DIM/.test(await page.locator('#hover-name').textContent())) { await page.mouse.click(...at(2, orig.start.z + dz)); hit = true; break; }
  }
  expect(hit).toBe(true);
  await page.locator('#copy').click();
  await page.locator('#paste').click();
  const d = await saved(page);
  const all = hand(d);
  expect(all, 'the original and its copy').toHaveLength(2);
  const copy = all.find(x => x.id !== orig.id);
  expect(Number.isInteger(copy.id), 'a whole-number id, so it draws').toBe(true);
  expect(copy.auto).toBe(false);
  expect(Math.abs(copy.start.z - orig.start.z), 'two feet off the original').toBeCloseTo(2, 6);
  expect(copy.start.x).toBeCloseTo(orig.start.x, 6);
});

test('UNDO of the line just placed ends the lines: the next press is a fresh string', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  for (const pt of [[0, 0], [4, 0], [10, 0]]) await press(page, at, pt);
  await page.keyboard.press('Enter'); // once ends the points (Movie, 23 Oct)
  await press(page, at, [5, 1.5]);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  await press(page, at, [0, 0]);
  await expect(page.locator('#strip-message')).toContainText('the next point');
  expect(hand(await saved(page)), 'the line undone, no new one laid').toHaveLength(0);
});

// A LINE PLACED IS A LINE SEEN (Movie, 24 Oct: "the LEFT CLICK to place the
// dimension line isn't working still"). It was placing them -- with HAND DIMS
// switched off, a choice the page remembers, so each went down out of sight.
// Placing one puts HAND DIMS back on and says so.
test('with HAND DIMS off, placing a line turns them back on and says so', async ({ page }) => {
  await open(page, drawing(RUN));
  await page.evaluate(() => localStorage.setItem('model.dimsHidden', JSON.stringify({ auto: false, hand: true })));
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const { at } = await frame(page);
  await armDimension(page);
  await expect(page.locator('[data-dims-show="hand"]'), 'HAND DIMS starts off').toHaveAttribute('aria-pressed', 'false');
  await press(page, at, [0, 0]);
  await press(page, at, [4, 0]);
  await page.keyboard.press('Enter');
  await press(page, at, [2, -1.5]);
  await expect(page.locator('#strip-message')).toContainText('HAND DIMS was off');
  await expect(page.locator('[data-dims-show="hand"]'), 'and is on now').toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('model.dimsHidden')).hand), 'remembered on').toBe(false);
  expect(hand(await saved(page))).toHaveLength(1);
});
