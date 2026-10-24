// DIMENSIONS BY HAND (Movie, 17-18 Oct).
//
// "i need to make the NORMAL style dimension ... D command ... VERT or HORIZ
// ... DIAG" -- "aloow the user to make a line of dimensions and then press
// enter or double click to end the string and the next click will position
// the dimensions" -- "it should be in PROPERTIES area but should also pop up
// somewhere when the dimensions are in use" -- and the look: "same as the
// autodims look". So: D, points pressed one after another (snapped the way a
// wall's are), ENTER or a double-click ends the string, the next press stands
// it off; one record per piece on A-DIMS-HAND, auto false, which AUTO DIMS
// never sweeps.
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

test('D arms it: HORIZ, VERT and DIAG in PROPERTIES and on the pop-up over the sheet, HORIZ lit', async ({ page }) => {
  await open(page, drawing(RUN));
  await armDimension(page);
  await expect(page.locator('[data-dim-modes] [data-dim-mode]')).toHaveText(['HORIZ', 'VERT', 'DIAG']);
  await expect(page.locator('[data-dim-pop]')).toBeVisible();
  await expect(page.locator('[data-dim-pop] [data-dim-mode="h"]')).toHaveAttribute('aria-pressed', 'true');
  // One press on the pop-up lights the mode in PROPERTIES too.
  await page.locator('[data-dim-pop] [data-dim-mode="v"]').click();
  await expect(page.locator('[data-dim-modes] [data-dim-mode="v"]')).toHaveAttribute('aria-pressed', 'true');
  // Put down with the tool.
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('d');
  await expect(page.locator('[data-dim-pop]')).toBeHidden();
});

test('a HORIZ string: three points, ENTER, a press above stands two dimensions there, on A-DIMS-HAND', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  // A hair off each node: each lands on it.
  for (const pt of [[0.04, 0.03], [4.03, -0.02], [9.97, 0.04]]) await press(page, at, pt);
  await page.keyboard.press('Enter'); // once ends the points (Movie, 23 Oct)
  await expect(page.locator('#strip-message')).toContainText('click where the string goes');
  await press(page, at, [5, -1.5]);
  const made = hand(await saved(page));
  expect(made.map(span).sort((a, b) => a[0] - b[0])).toEqual([[0, 4, -1.5, -1.5], [4, 10, -1.5, -1.5]]);
  expect(made.every(x => x.auto === false && x.view === 'plan' && x.levelId === 3)).toBe(true);
  // THE INK STANDS OFF AWAY FROM WHAT IT MEASURES: north of the string, the
  // side away from the walls at z = 0.
  expect(made.every(x => inkSide(x).z < 0)).toBe(true);
});

test('a VERT string ends with ENTER and stands where the next press is', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  await page.locator('[data-dim-pop] [data-dim-mode="v"]').click();
  await press(page, at, [10.03, 0.02]);
  await page.mouse.move(...at(10.02, 5.98));
  await press(page, at, [10.02, 5.98]);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  await expect(page.locator('#strip-message')).toContainText('click where the string goes');
  await press(page, at, [11.5, 3]);
  const [made] = hand(await saved(page));
  expect(span(made)).toEqual([11.5, 11.5, 0, 6]);
  expect(inkSide(made).x, 'east, away from the wall it measures').toBeGreaterThan(0);
});

test('DIAG runs along its first point to its last, its length the true distance', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  await page.locator('[data-dim-pop] [data-dim-mode="d"]').click();
  await press(page, at, [4.02, 0.03]);
  await press(page, at, [10.03, 5.97]);
  await page.keyboard.press('Enter'); // once ends the points (Movie, 23 Oct)
  await press(page, at, [5, 4]);
  const [made] = hand(await saved(page));
  const len = Math.hypot(made.end.x - made.start.x, made.end.z - made.start.z);
  expect(len).toBeCloseTo(Math.hypot(6, 6), 6);
  // Parallel to the run from (4, 0) to (10, 6).
  expect(Math.abs((made.end.x - made.start.x) - (made.end.z - made.start.z))).toBeLessThan(1e-6);
});

test('Esc puts the string down, one UNDO takes a placed one, and AUTO DIMS leaves hand strings alone', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  await press(page, at, [0, 0]);
  await press(page, at, [4, 0]);
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement?.blur?.());
  await armDimension(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('#strip-message')).not.toContainText('click where the string goes');
  // And another tool taken up puts it down too.
  await press(page, at, [0, 0]);
  await press(page, at, [4, 0]);
  await page.keyboard.press('l');
  await armDimension(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('#strip-message')).not.toContainText('click where the string goes');
  // A whole string, then one undo.
  for (const pt of [[0, 0], [4, 0], [10, 0]]) await press(page, at, pt);
  await page.keyboard.press('Enter'); // once ends the points (Movie, 23 Oct)
  await press(page, at, [5, -1.5]);
  expect(hand(await saved(page))).toHaveLength(2);
  await page.keyboard.press('Control+z');
  expect(hand(await saved(page))).toHaveLength(0);
  // Placed again, and AUTO DIMS run over the level: both hand pieces stay.
  await armDimension(page);
  for (const pt of [[0, 0], [4, 0], [10, 0]]) await press(page, at, pt);
  await page.keyboard.press('Enter'); // once ends the points (Movie, 23 Oct)
  await press(page, at, [5, -1.5]);
  await page.locator('[data-auto-dims]').click();
  const d = await saved(page);
  expect(hand(d)).toHaveLength(2);
  expect((d.dimensions || []).some(x => x.auto === true), 'and AUTO DIMS did lay its own').toBe(true);
});

// AUTO DIMS / HAND DIMS ON THE SHEET (Movie, 18 Oct): two chips beside the
// north arrow put each kind out of sight and back. The drawing keeps both.
const DIM = (id, a, b, auto) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', auto, ...(auto ? { layer: 'A-DIMS-OVR' } : { layer: 'A-DIMS-HAND' }) });
const BOTH = () => ({ ...drawing(RUN), dimensions: [DIM(31, [0, -2], [10, -2], true), DIM(32, [0, -4], [4, -4], false)] });
// What one paint draws: every drawDimension2D call, by id. 0 (fit) repaints.
async function painted(page) {
  await page.evaluate(() => {
    // render-2d is frozen, so the spy is a copy of it with one painter wrapped.
    const R = window.DraftRender2D;
    window.__dimIds = [];
    window.__dimReal = R;
    window.DraftRender2D = { ...R, drawDimension2D: (ctx, toS, d, ...rest) => {
      if (!rest[0]?.preview) window.__dimIds.push(d.id);
      return R.drawDimension2D(ctx, toS, d, ...rest);
    } };
  });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return page.evaluate(() => {
    window.DraftRender2D = window.__dimReal;
    return [...new Set(window.__dimIds)].sort((a, b) => a - b);
  });
}

test('AUTO DIMS and HAND DIMS beside the north arrow show or hide each kind; the drawing keeps both; a reload remembers', async ({ page }) => {
  await open(page, BOTH());
  const chip = kind => page.locator(`[data-dims-show="${kind}"]`);
  await expect(chip('auto')).toHaveText('AUTO DIMS');
  await expect(chip('hand')).toHaveText('HAND DIMS');
  await expect(chip('auto')).toHaveAttribute('aria-pressed', 'true');
  // Left of the arrow, on its line.
  const [box, north] = await Promise.all([page.locator('[data-dims-show]').first().boundingBox(),
    page.locator('#north-hit').boundingBox()]);
  expect(box.x + box.width).toBeLessThanOrEqual(north.x);
  expect(Math.abs((box.y + box.height / 2) - (north.y + north.height / 2))).toBeLessThan(north.height);
  expect(await painted(page)).toEqual([31, 32]);
  await chip('hand').click();
  await expect(chip('hand')).toHaveAttribute('aria-pressed', 'false');
  expect(await painted(page)).toEqual([31]);
  await chip('auto').click();
  expect(await painted(page)).toEqual([]);
  expect((await saved(page)).dimensions.map(d => d.id).sort(), 'out of sight, not out of the file').toEqual([31, 32]);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(chip('auto')).toHaveAttribute('aria-pressed', 'false');
  await chip('auto').click();
  expect(await painted(page)).toEqual([31]);
});

test('no strings on the level, no chips -- until the DIMENSION tool is up', async ({ page }) => {
  await open(page, drawing(RUN));
  await expect(page.locator('#dims-show')).toBeHidden();
  await armDimension(page);
  await expect(page.locator('#dims-show')).toBeVisible();
});

// ON ITS NODE (Movie, 18 Oct: "i moved thenode but the dim didn't follow the
// node it should be linked too" -- and "light them NODES up for the DIMENSION
// points so the user will know they are going to be locked on the right spot").
test('a hand dimension follows the corner it was put on, along its own run; UNDO brings it back', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  await press(page, at, [4, 0]);
  await press(page, at, [10, 0]);
  await page.keyboard.press('Enter'); // once ends the points (Movie, 23 Oct)
  await press(page, at, [7, -1.5]);
  let d = await saved(page);
  expect(hand(d).map(span)).toEqual([[4, 10, -1.5, -1.5]]);
  expect(hand(d)[0].endRef || hand(d)[0].startRef).toBeTruthy();
  // The corner at (10, 0) dragged 2' along: the string's end goes with it,
  // and its row stays where it was put. ENTER finishes the string (ESC would
  // abandon it, Movie 24 Oct).
  await page.keyboard.press('Enter');
  await page.keyboard.press('s');
  await press(page, at, [7, 0]);
  await page.mouse.move(...at(10, 0));
  await page.mouse.down();
  await page.mouse.move(...at(12, 0), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  d = await saved(page);
  expect(hand(d).map(span)).toEqual([[4, 12, -1.5, -1.5]]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect(hand(d).map(span)).toEqual([[4, 10, -1.5, -1.5]]);
});

test('the node a dimension point will lock to lights up under the pointer', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  const ringAt = async (x, z) => page.evaluate(([px, py]) => {
    const c = document.getElementById('plan');
    const r = c.getBoundingClientRect(), dpr = c.width / r.width;
    const g = c.getContext('2d');
    // Sample the ring 7px out from the node, round it.
    let lit = 0;
    for (let k = 0; k < 16; k += 1) {
      const a = k * Math.PI / 8;
      const d = g.getImageData(Math.round((px - r.left + 7 * Math.cos(a)) * dpr), Math.round((py - r.top + 7 * Math.sin(a)) * dpr), 1, 1).data;
      if (Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]) > 80) lit += 1;   // the accent, not the grey ink
    }
    return lit;
  }, at(x, z));
  await page.mouse.move(...at(2, 3));
  await page.waitForTimeout(150);
  expect(await ringAt(4, 0), 'no ring with the pointer away').toBeLessThan(3);
  await page.mouse.move(...at(4.1, 0.1));
  await page.waitForTimeout(150);
  expect(await ringAt(4, 0)).toBeGreaterThan(6);
});
