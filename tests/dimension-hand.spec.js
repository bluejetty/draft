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
  await page.keyboard.press('Enter');
  await expect(page.locator('#strip-message')).toContainText('click where the string goes');
  await press(page, at, [5, -1.5]);
  const made = hand(await saved(page));
  expect(made.map(span).sort((a, b) => a[0] - b[0])).toEqual([[0, 4, -1.5, -1.5], [4, 10, -1.5, -1.5]]);
  expect(made.every(x => x.auto === false && x.view === 'plan' && x.levelId === 3)).toBe(true);
  // THE INK STANDS OFF AWAY FROM WHAT IT MEASURES: north of the string, the
  // side away from the walls at z = 0.
  expect(made.every(x => inkSide(x).z < 0)).toBe(true);
});

test('a VERT string ends with a double-click and stands where the next press is', async ({ page }) => {
  await open(page, drawing(RUN));
  const { at } = await frame(page);
  await armDimension(page);
  await page.locator('[data-dim-pop] [data-dim-mode="v"]').click();
  await press(page, at, [10.03, 0.02]);
  await page.mouse.move(...at(10.02, 5.98));
  await page.mouse.dblclick(...at(10.02, 5.98));
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
  await page.keyboard.press('Enter');
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
  // A whole string, then one undo.
  for (const pt of [[0, 0], [4, 0], [10, 0]]) await press(page, at, pt);
  await page.keyboard.press('Enter');
  await press(page, at, [5, -1.5]);
  expect(hand(await saved(page))).toHaveLength(2);
  await page.keyboard.press('Control+z');
  expect(hand(await saved(page))).toHaveLength(0);
  // Placed again, and AUTO DIMS run over the level: both hand pieces stay.
  await armDimension(page);
  for (const pt of [[0, 0], [4, 0], [10, 0]]) await press(page, at, pt);
  await page.keyboard.press('Enter');
  await press(page, at, [5, -1.5]);
  await page.locator('[data-auto-dims]').click();
  const d = await saved(page);
  expect(hand(d)).toHaveLength(2);
  expect((d.dimensions || []).some(x => x.auto === true), 'and AUTO DIMS did lay its own').toBe(true);
});
