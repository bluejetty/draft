// AUTO DIMS ON A SHELF, AND A ROW TAKEN OFF AND PUT BACK (Movie, 26 Oct).
//
// "can we put the AUTODIM / HAND DIM buttons in the SHELF ... if the user
// pressed it please make them for the FENS on inside, INT walls next, and the
// EXT WALLS with corners and then full EXT wall (4 dimension lines)" -- and
// "allow the user to be able to DELETE a string or add a string back from
// AUTODIMENSION ... when the line is deleted i'd like the other lines to
// re-adjust. and then put it back if they change their mind".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const W = (id, a, b, extra = {}) => ({ id, levelId: -1, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: V(...a), end: V(...b), ...extra });
// A 30 x 20 suite parked on SHELF 1 (level -1): a window in its west wall,
// a partition across it from the west wall, so the west side has all four rows.
const SHELF = {
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  boneyardShelves: [{ id: 1, name: 'SHELF 1' }],
  walls: [W('n', [0, 0], [30, 0]), W('e', [30, 0], [30, 20]), W('s', [30, 20], [0, 20]), W('w', [0, 20], [0, 0]),
    W('p', [0, 8], [12, 8], { wallType: 'stud_2x4' }), W('q', [12, 0], [12, 20], { wallType: 'stud_2x4' }),
    W('j', [20, 20], [20, 26]), W('k', [20, 26], [30, 26]), W('l', [30, 26], [30, 20])],
  fenestrations: [{ id: 'f1', wallId: 'w', levelId: -1, view: 'plan', type: 'window', offset: 14, width: 4, sillHeight: 3, headHeight: 6.67 }],
  dimensions: [], lines: [], floors: [], roofs: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [],
  notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
};

async function onShelf(page, drawing = SHELF) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.evaluate(() => enterShelf(1));
  await page.waitForTimeout(200);
}
// The west side's rows, outermost first: where each stands and what it is.
const westRows = page => page.evaluate(() => {
  const rows = new Map();
  dimensions().filter(d => d.auto && Math.abs(d.start.x - d.end.x) < 1e-6 && d.start.x < 0)
    .forEach(d => rows.set(Math.round(d.start.x * 100) / 100, d.layer));
  return [...rows.entries()].sort((a, b) => a[0] - b[0]);
});

test('on a shelf the AUTO DIMS chip is there before any strings, and a press lays the four rows', async ({ page }) => {
  await onShelf(page);
  expect(await page.evaluate(() => activeLevelId())).toBe(-1);
  await expect(page.locator('[data-dims-show="auto"]')).toBeVisible();
  await expect(page.locator('[data-dims-show="hand"]')).toBeVisible();
  await page.locator('[data-dims-show="auto"]').click();
  const rows = await westRows(page);
  // Outermost first: OVERALL, CORNERS, INT WALLS, OPENINGS by the wall.
  expect(rows.map(r => r[1])).toEqual(['A-DIMS-OVR', 'A-DIMS-EXT', 'A-DIMS-INT', 'A-DIMS-FENS']);
});

test('DELETE on one piece of a row takes the row off that side, and the rows outside step in', async ({ page }) => {
  await onShelf(page);
  await page.locator('[data-dims-show="auto"]').click();
  const before = await westRows(page);
  await page.evaluate(() => {
    const d = dimensions().find(x => x.auto && x.layer === 'A-DIMS-INT' && Math.abs(x.start.x - x.end.x) < 1e-6 && x.start.x < 0);
    setSelection([{ type: 'dimension', item: d }]);
  });
  await page.keyboard.press('Delete');
  const after = await westRows(page);
  expect(after.map(r => r[1]), 'the INT WALLS row is gone').toEqual(['A-DIMS-OVR', 'A-DIMS-EXT', 'A-DIMS-FENS']);
  // The rows outside it each moved one step in; the one inside stays put.
  expect(after.map(r => r[0])).toEqual([before[1][0], before[2][0], before[3][0]]);
  // Only the west side lost a row.
  const east = await page.evaluate(() => new Set(dimensions().filter(d => d.auto && autoDimSide(d) === 'E').map(d => d.layer)).size);
  expect(east).toBeGreaterThanOrEqual(3);
  // AUTO DIMS again keeps it off.
  await page.evaluate(() => { pressAutoDims(); });
  expect((await westRows(page)).map(r => r[1])).toEqual(['A-DIMS-OVR', 'A-DIMS-EXT', 'A-DIMS-FENS']);
});

test('ROWS puts it back, the rows step out again; UNDO takes the put-back away', async ({ page }) => {
  await onShelf(page);
  await page.locator('[data-dims-show="auto"]').click();
  const full = await westRows(page);
  await page.evaluate(() => {
    const d = dimensions().find(x => x.auto && x.layer === 'A-DIMS-INT' && Math.abs(x.start.x - x.end.x) < 1e-6 && x.start.x < 0);
    setSelection([{ type: 'dimension', item: d }]);
  });
  await page.keyboard.press('Delete');
  await page.locator('[data-auto-rows]').click();
  const tick = page.locator('[data-auto-row="W:A-DIMS-INT"]');
  await expect(tick).not.toBeChecked();
  await tick.check();
  expect(await westRows(page)).toEqual(full);
  await page.evaluate(() => { undoOnce(); paint(); });
  expect((await westRows(page)).map(r => r[1])).toEqual(['A-DIMS-OVR', 'A-DIMS-EXT', 'A-DIMS-FENS']);
  // And the level remembers it is off again, so AUTO DIMS keeps it off.
  await page.evaluate(() => { pressAutoDims(); });
  expect((await westRows(page)).map(r => r[1])).toEqual(['A-DIMS-OVR', 'A-DIMS-EXT', 'A-DIMS-FENS']);
  await page.evaluate(() => { undoOnce(); paint(); });
  await page.evaluate(() => { undoOnce(); paint(); });
  expect(await westRows(page), 'and the DELETE undoes too').toEqual(full);
});

test('a row taken off stays off through a save and a reload', async ({ page }) => {
  await onShelf(page);
  await page.locator('[data-dims-show="auto"]').click();
  await page.evaluate(() => {
    const d = dimensions().find(x => x.auto && x.layer === 'A-DIMS-OVR' && Math.abs(x.start.x - x.end.x) < 1e-6 && x.start.x < 0);
    setSelection([{ type: 'dimension', item: d }]);
  });
  await page.keyboard.press('Delete');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.autoDimRowsOff).toEqual({ '-1|plan': ['W:A-DIMS-OVR'] });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.evaluate(() => enterShelf(1));
  await page.evaluate(() => { pressAutoDims(); });
  expect((await westRows(page)).map(r => r[1])).toEqual(['A-DIMS-EXT', 'A-DIMS-INT', 'A-DIMS-FENS']);
});

// THE ROWS STAND IN PAPER (Movie, 26 Oct: "the text changes size but the
// lines don't move to new spacings for the altered scale"): 1.5 ft apart at
// 1/4" = 1' is 3/8" of paper, so at 1" = 20' they stand 7.5 ft apart.
test('DIM SCALE lays the rows out again at the new paper; UNDO puts them back', async ({ page }) => {
  await onShelf(page);
  await page.locator('[data-dims-show="auto"]').click();
  const gaps = rows => rows.slice(1).map((r, i) => Math.round((r[0] - rows[i][0]) * 100) / 100);
  const quarter = await westRows(page);
  expect(gaps(quarter)).toEqual([1.5, 1.5, 1.5]);
  await page.locator('[data-dim-scale]').selectOption(String(1 / 20));
  const twenty = await westRows(page);
  expect(twenty.map(r => r[1]), 'the same rows').toEqual(quarter.map(r => r[1]));
  expect(gaps(twenty)).toEqual([7.5, 7.5, 7.5]);
  await page.evaluate(() => { undoOnce(); paint(); });
  expect(await westRows(page)).toEqual(quarter);
});

// "on this fenestration autodim there is an extra point for some reason, i
// tried to select and delete it but i couldn't select the point where the 2
// dims meet" (Movie, 28 Oct).
test('a point where two pieces of an auto row meet can be picked; DELETE takes just that point and AUTO DIMS keeps it off; UNDO puts it back', async ({ page }) => {
  const twoWindows = { ...SHELF, fenestrations: [...SHELF.fenestrations,
    { id: 'f2', wallId: 'w', levelId: -1, view: 'plan', type: 'window', offset: 5, width: 3, sillHeight: 3, headHeight: 6.67 }] };
  await onShelf(page, twoWindows);
  await page.locator('[data-dims-show="auto"]').click();
  const fens = () => page.evaluate(() => dimensions()
    .filter(d => d.auto && d.layer === 'A-DIMS-FENS' && autoDimSide(d) === 'W')
    .map(d => [Math.min(d.start.z, d.end.z), Math.max(d.start.z, d.end.z)].map(v => Math.round(v * 100) / 100))
    .sort((a, b) => a[0] - b[0]));
  const before = await fens();
  expect(before.length, 'two windows: three pieces').toBe(3);
  // The joint between the first two pieces, picked where it is drawn.
  const joint = before[0][1];
  const picked = await page.evaluate(z => {
    const d = dimensions().find(x => x.auto && x.layer === 'A-DIMS-FENS' && autoDimSide(x) === 'W'
      && Math.abs(Math.max(x.start.z, x.end.z) - z) < 0.01);
    const line = dimDrawnLine(d);
    const tip = Math.abs(d.end.z - z) < 0.01 ? line[1] : line[0];
    const hit = dimPointAt(toWorld(tip.x, tip.y));
    return hit && { type: hit.type, point: hit.point, auto: hit.item.auto };
  }, joint);
  expect(picked, 'the joint is pickable on an auto row').toEqual({ type: 'dimension', point: expect.any(String), auto: true });
  await page.evaluate(z => {
    const d = dimensions().find(x => x.auto && x.layer === 'A-DIMS-FENS' && autoDimSide(x) === 'W'
      && Math.abs(Math.max(x.start.z, x.end.z) - z) < 0.01);
    setSelection([{ type: 'dimension', item: d, point: d.end.z > d.start.z ? 'end' : 'start' }]);
  }, joint);
  await page.keyboard.press('Delete');
  const after = await fens();
  expect(after, 'the two pieces are one; the row stays').toEqual([[before[0][0], before[1][1]], before[2]]);
  await page.evaluate(() => { pressAutoDims(); });
  expect(await fens(), 'AUTO DIMS keeps the point off').toEqual(after);
  // UNDO the AUTO DIMS press, then the DELETE: the point is back.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  expect(await fens(), 'UNDO puts it back').toEqual(before);
});
