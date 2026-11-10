// A HAND DIMENSION FOLLOWS WHAT IT MEASURES (Movie, 9 Nov): "i'd also like
// the dimension to move when the node they are connected to moves ... if
// that item is MOVED the dimension should move and re-number to the new
// measurement. also if the item being dimensioned in deleted the dimensions
// should also disappear" -- "delete rather than set free, keep it clean".
//
// Walls and openings already held their dimensions; this is the lot, the
// line and the rest holding theirs, the whole string going with a MOVE, the
// string going with a DELETE, and old files taking hold on open.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const base = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 20,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
// A 20 x 30 LOT ON SITE, corners 0 (0,0), 1 (20,0), 2 (20,30), 3 (0,30).
const LOT = { id: 'lot', site: true, levelId: 8,
  points: [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 30 }, { x: 0, z: 30 }] };

async function open(page, f, level = 8) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(`/MODEL.html?left=1&lpane=drafting&level=${level}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function frame(page) {
  const box = await page.locator('#plan').boundingBox();
  for (let i = 0; i < 12; i++) {
    const { scale } = await h.planFrame(page);
    if (scale >= 12 && scale <= 30) break;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, scale > 30 ? 120 : -120);
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
const span = x => [r2(Math.min(x.start.x, x.end.x)), r2(Math.max(x.start.x, x.end.x)), r2(x.start.z), r2(x.end.z)];
const refOf = r => (r ? `${r.kind}:${r.id}:${r.end}` : null);

// THE LOT'S BOTTOM EDGE, DIMENSIONED: corner 3 to corner 2, the string 3'
// below (the top edge fits up under the bars in the test viewport).
async function dimTheLot(page) {
  const { at } = await frame(page);
  await armDimension(page);
  await press(page, at, [0, 30]);
  await press(page, at, [20, 30]);
  await page.keyboard.press('Enter');
  await press(page, at, [10, 33]);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await h.armFromRail(page, 'select');
  return at;
}

test('a dimension put on a lot\'s corners holds them, and MOVE of the lot takes the whole string with it', async ({ page }) => {
  const f = base(); f.outlines = [LOT];
  await open(page, f);
  const at = await dimTheLot(page);
  let d = await saved(page);
  expect(hand(d).map(span)).toEqual([[0, 20, 33, 33]]);
  const [one] = hand(d);
  expect([one.startRef, one.endRef].map(refOf).sort(), 'both ends on the lot').toEqual(['outline:lot:2', 'outline:lot:3']);
  // THE LOT PICKED AND NUDGED A FOOT EAST (Ctrl + arrow): the string goes
  // with it, whole, and still stands 3' off.
  await press(page, at, [0, 15]);
  await expect(page.locator('#delete')).toBeVisible();
  await page.keyboard.press('Control+ArrowRight');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(d.outlines[0].points[0].x, 'the lot moved').toBeCloseTo(1, 3);
  expect(hand(d).map(span), 'the string moved with it').toEqual([[1, 21, 33, 33]]);
  // UNDO puts the lot back, and the string follows it back.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(hand(d).map(span)).toEqual([[0, 20, 33, 33]]);
});

test('one corner dragged on its own slides its end along the string, and the text re-measures', async ({ page }) => {
  const f = base(); f.outlines = [LOT];
  await open(page, f);
  await dimTheLot(page);
  // Corner 2 moved 4' east and 2' south by hand, as a node drag leaves it.
  await page.evaluate(() => {
    const lot = drawing.outlines.find(o => o.id === 'lot');
    const vtx = lot.points[2];
    undoStack.push({ kind: 'rotate', before: [{ vtx, x: vtx.x, z: vtx.z }], detached: [] });
    vtx.x += 4; vtx.z += 2;
    markDirty();
    paint();
  });
  const d = await saved(page);
  expect(hand(d).map(span), 'the end took the corner\'s x and kept its row').toEqual([[0, 24, 33, 33]]);
});

test('DELETE on the lot takes its dimensions with it; one UNDO brings lot and dimensions back', async ({ page }) => {
  const f = base(); f.outlines = [LOT];
  await open(page, f);
  const at = await dimTheLot(page);
  expect(hand(await saved(page))).toHaveLength(1);
  await press(page, at, [0, 15]);
  await expect(page.locator('#delete')).toBeVisible();
  await page.locator('#delete').click();
  let d = await saved(page);
  expect(d.outlines, 'the lot is gone').toHaveLength(0);
  expect(hand(d), 'and its dimension with it').toHaveLength(0);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(d.outlines.map(o => o.id)).toEqual(['lot']);
  expect(hand(d).map(span)).toEqual([[0, 20, 33, 33]]);
  expect([hand(d)[0].startRef, hand(d)[0].endRef].map(refOf).sort()).toEqual(['outline:lot:2', 'outline:lot:3']);
});

test('a dimension standing square off a line\'s ends in an old file takes hold of them when the file opens', async ({ page }) => {
  const f = base();
  f.activeLevelIdx = 1;
  f.lines = [{ id: 'line-1', levelId: 3, view: 'plan', start: { x: 0, y: 0, z: 0 }, end: { x: 12, y: 0, z: 0 } }];
  f.dimensions = [
    // Laid 2' below the line, the way the D tool leaves it (what it measures
    // is to the right of start -> end).
    { id: 101, levelId: 3, view: 'plan', layer: 'A-DIMS-HAND', auto: false,
      start: { x: 12, y: 0, z: -2 }, end: { x: 0, y: 0, z: -2 } },
    // One with nothing square across from it stays free.
    { id: 102, levelId: 3, view: 'plan', layer: 'A-DIMS-HAND', auto: false,
      start: { x: 7, y: 0, z: -4 }, end: { x: 3, y: 0, z: -4 } },
  ];
  await open(page, f, 3);
  const d = await saved(page);
  const byId = Object.fromEntries(hand(d).map(x => [x.id, x]));
  expect([byId[101].startRef, byId[101].endRef].map(refOf)).toEqual(['line:line-1:end', 'line:line-1:start']);
  expect([byId[102].startRef, byId[102].endRef]).toEqual([undefined, undefined]);
  // And from now on it follows: the line nudged, the dimension goes with it.
  await page.evaluate(() => {
    const line = drawing.lines[0];
    const before = [line.start, line.end].map(vtx => ({ vtx, x: vtx.x, z: vtx.z }));
    undoStack.push({ kind: 'rotate', before, detached: [] });
    line.start.x += 3; line.end.x += 3;
    markDirty();
    paint();
  });
  const moved = hand(await saved(page)).find(x => x.id === 101);
  expect(span(moved)).toEqual([3, 15, -2, -2]);
});
