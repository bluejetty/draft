// A DIMENSION'S DIVIDE SNAPS (jb, 10 Nov 2026).
//
// "can we place a 'midpoint snap' on the dimension line so i can dimension
// something and then find the centerline. also in the OBJ. PROP can we
// allot that centerpoint DEFAULT (2 PIECES) can change to 3, 4, 5, or
// whatever number and it will split the line into that many pieces and
// place the 'midpoint' snaps at those locations (like a divide type of
// measurement function)". So: every dimension shown on the level offers its
// midpoint as a node to every tool; a DIVIDE field on the picked dimension's
// OBJ / PROP panel cuts it into N pieces with a snap at each division; the
// record carries `divide` only off the default of two; UNDO takes it off.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
const DIM = (extra = {}) => ({ id: 7, start: { x: 0, y: 0, z: -3 }, end: { x: 10, y: 0, z: -3 }, levelId: 3,
  view: 'plan', layer: 'A-DIMS-HAND', auto: false, ...extra });
const drawing = (dim = DIM()) => ({
  version: 1, board: 'drafting', units: 'imperial',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 20,
  walls: [W('w1', [0, 0], [10, 0]), W('w2', [10, 0], [10, 6])],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [dim],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('s');
  await page.locator('#objprop-tab').click();
}
// PICK THE DIMENSION: its line stands 19px off its record, to the LEFT of
// start -> end (render-2d drawDimension2D); start -> end runs +x here, so
// the line is 19px down the screen from the string.
async function pickDim(page) {
  const { at } = await h.planFrame(page);
  const [x, y] = at(5, -3);
  await page.mouse.click(x, y + 19);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => selection.map(s => s.type))).toEqual(['dimension']);
}
async function armLine(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const key = page.locator('[data-tool-key="line"]');
  // The key itself, pressed: the L key goes to the panel's field after a
  // DIVIDE edit, and the button arms the tool whatever has focus.
  if (await key.getAttribute('aria-pressed') !== 'true') await key.click();
  await expect(key).toHaveAttribute('aria-pressed', 'true');
}
// WHAT THE HAND WOULD CATCH at a world point: the orange donut's node, as
// the snap specs read it (tests/snap-track.spec.js).
async function caughtAt(page, x, z) {
  const { at } = await h.planFrame(page);
  await page.mouse.move(...at(x, z));
  await page.waitForTimeout(80);
  const v = await page.locator('#plan').getAttribute('data-snap-node');
  return v ? JSON.parse(v) : null;
}
const divide = page => page.evaluate(() => drawing.dimensions[0].divide ?? null);
const field = page => page.locator('[data-dim-divide]');
async function saved(page) {
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test('the helper: no key is one midpoint, N pieces are N-1 points on the measured span, 1 is none', async ({ page }) => {
  await open(page, drawing());
  const pts = await page.evaluate(() => {
    const R = window.DraftRender2D;
    const dim = n => ({ start: { x: 0, y: 0, z: -3 }, end: { x: 10, y: 0, z: -3 }, ...(n ? { divide: n } : {}) });
    const flat = list => list.map(p => [p.x, p.z]);
    return { none: flat(R.dimensionDividePoints2D(dim())), four: flat(R.dimensionDividePoints2D(dim(4))),
      one: flat(R.dimensionDividePoints2D(dim(1))) };
  });
  expect(pts.none).toEqual([[5, -3]]);
  expect(pts.four).toEqual([[2.5, -3], [5, -3], [7.5, -3]]);
  expect(pts.one).toEqual([]);
});

test('LINE: a press near a dimension\'s midpoint lands exactly on it, on the measured span', async ({ page }) => {
  await open(page, drawing());
  await armLine(page);
  // A hair off the midpoint of the 10 ft string at z = -3.
  expect(await caughtAt(page, 5.08, -3.06)).toEqual([5, -3]);
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(5.08, -3.06));
  await page.waitForTimeout(80);
  await page.mouse.click(...at(5.08, 4));
  await page.waitForTimeout(80);
  const made = (await saved(page)).lines || [];
  expect(made.length).toBe(1);
  expect([made[0].start.x, made[0].start.z]).toEqual([5, -3]);
  // TRACK: the second press a hair off plumb below the midpoint stood plumb.
  expect(made[0].end.x).toBe(5);
});

test('DIVIDE on the panel: 4 pieces give three snaps, the record carries 4, UNDO takes it off, 2 carries no key', async ({ page }) => {
  await open(page, drawing());
  await pickDim(page);
  await expect(field(page)).toHaveValue('2');
  await expect(page.locator('[data-prop-row="divide-hint"]')).toContainText('ONE MIDPOINT SNAP');
  await page.locator('[data-dim-divide-step="1"]').click();
  await page.locator('[data-dim-divide-step="1"]').click();
  await expect(field(page)).toHaveValue('4');
  expect(await divide(page)).toBe(4);
  await expect(page.locator('[data-prop-row="divide-hint"]')).toContainText('4 EQUAL PIECES: 3 SNAPS');
  // The quarter points catch now, and the midpoint still does.
  await armLine(page);
  expect(await caughtAt(page, 2.55, -3.05)).toEqual([2.5, -3]);
  expect(await caughtAt(page, 7.45, -2.95)).toEqual([7.5, -3]);
  expect(await caughtAt(page, 5.05, -3.05)).toEqual([5, -3]);
  // Nothing at a third point of a four-piece dimension.
  expect(await caughtAt(page, 3.33, -3.3)).toBeNull();
  // Typed: 5 pieces.
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await pickDim(page);
  await field(page).fill('5');
  await field(page).press('Enter');
  await page.waitForTimeout(100);
  expect(await divide(page)).toBe(5);
  expect((await saved(page)).dimensions[0].divide).toBe(5);
  // UNDO twice: back to 4, then back to the default with no key.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(80);
  expect(await divide(page)).toBe(4);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(80);
  expect(await divide(page)).toBe(3);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(80);
  expect(await divide(page)).toBeNull();
  expect('divide' in (await saved(page)).dimensions[0]).toBe(false);
});

test('a saved DIVIDE comes back on open, and 1 piece offers no snap along the dimension', async ({ page }) => {
  await open(page, drawing(DIM({ divide: 3 })));
  await pickDim(page);
  await expect(field(page)).toHaveValue('3');
  await armLine(page);
  expect(await caughtAt(page, 3.38, -3.05)).toEqual([3.3333, -3]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await pickDim(page);
  await field(page).fill('1');
  await field(page).press('Enter');
  await page.waitForTimeout(100);
  await expect(page.locator('[data-prop-row="divide-hint"]')).toContainText('NO SNAP');
  await armLine(page);
  expect(await caughtAt(page, 5.05, -3.05)).toBeNull();
  expect((await saved(page)).dimensions[0].divide).toBe(1);
});
