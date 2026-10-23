// A DIMENSION'S POINTS CAN BE PICKED AND DELETED (Movie, 20 Oct): "i'd like
// the 'points' where the lines are dimensioned to (where the arrows meet at
// ends of a dimension line, where a new line starts,) i'd like to be able to
// select that 'point' arrows, etc where they meet and be able to DELETE it
// and rather than the dimension line disappearing only that 'point will no
// longer be measured and the measurements will change to measure the now
// longer 2 points that still exist (weren't deleted) if an end 'point' is
// deleted from a dimension line, the entire line to the next point will be
// deleted".
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
const xs = x => [r2(Math.min(x.start.x, x.end.x)), r2(Math.max(x.start.x, x.end.x))];
const pieces = d => hand(d).map(xs).sort((a, b) => a[0] - b[0]);

// A STRING OF TWO PIECES, 0 to 4 and 4 to 10, laid 1.5 ft below the walls.
async function layString(page) {
  const { at } = await frame(page);
  await armDimension(page);
  for (const pt of [[0, 0], [4, 0], [10, 0]]) await press(page, at, pt);
  await page.keyboard.press('Enter'); // once ends the points (Movie, 23 Oct)
  await press(page, at, [5, -1.5]);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await h.armFromRail(page, 'select');
  return at;
}
// THE POINT AT x, FOUND BY WHAT THE CURSOR SAYS: the arrow tips stand a
// screen offset off the string's own line, so the cursor hunts down from
// the line until the name reads DIM POINT.
async function pickPoint(page, at, x, z = -1.5) {
  for (const dz of [0, 0.15, 0.3, 0.45, 0.6, -0.15, -0.3]) {
    await page.mouse.move(...at(x, z + dz));
    await page.waitForTimeout(40);
    if ((await page.locator('#hover-name').textContent()) === 'DIM POINT') {
      await page.mouse.click(...at(x, z + dz));
      await page.waitForTimeout(60);
      return;
    }
  }
  throw new Error(`no DIM POINT under the cursor at x=${x}`);
}

test('DELETE on the point where two pieces meet joins them into one longer measurement', async ({ page }) => {
  await open(page, drawing(RUN));
  const at = await layString(page);
  expect(pieces(await saved(page))).toEqual([[0, 4], [4, 10]]);
  await pickPoint(page, at, 4);
  await expect(page.locator('#delete')).toBeVisible();
  await page.locator('#delete').click();
  const d = await saved(page);
  expect(pieces(d), 'one piece, 0 to 10').toEqual([[0, 10]]);
  // THE JOINED PIECE KEEPS BOTH FAR ENDS' CORNERS: it was put on w1's start
  // and w2's end, and still follows them.
  const [one] = hand(d);
  const refs = [one.startRef, one.endRef].filter(Boolean).map(r => `${r.wallId}:${r.end}`).sort();
  expect(refs).toEqual(['w1:start', 'w2:end']);
});

test('DELETE on an end point takes the run to the next point; the string ends there now', async ({ page }) => {
  await open(page, drawing(RUN));
  const at = await layString(page);
  await pickPoint(page, at, 0);
  await page.locator('#delete').click();
  expect(pieces(await saved(page)), 'the 0 to 4 run gone, 4 to 10 kept').toEqual([[4, 10]]);
});

test('the point reads DIM POINT under the cursor, and one UNDO puts both pieces back', async ({ page }) => {
  await open(page, drawing(RUN));
  const at = await layString(page);
  await pickPoint(page, at, 4);
  await expect(page.locator('#hover-name')).toHaveText('DIM POINT');
  await page.locator('#delete').click();
  expect(pieces(await saved(page))).toEqual([[0, 10]]);
  await page.locator('#model-undo').click();
  const d = await saved(page);
  expect(pieces(d), 'both pieces back').toEqual([[0, 4], [4, 10]]);
  const left = hand(d).find(x => xs(x)[0] === 0);
  expect([left.startRef?.wallId, left.endRef?.wallId], 'with the refs it had').toEqual(['w1', 'w1']);
});

// AUTO DIMS LAY THEMSELVES OUT AGAIN from the walls, so a point taken off
// one would be back on the next re-lay: their tips are never offered. An
// auto string ending on the same corner as a hand piece, and ahead of it in
// the file, keeps its length when that corner's point is deleted.
test('a point on an AUTO dimension is not offered; the hand piece sharing the corner goes instead', async ({ page }) => {
  const f = drawing(RUN);
  const dim = (id, a, b, extra) => ({ id, start: { x: a, y: 0, z: -2 }, end: { x: b, y: 0, z: -2 },
    levelId: 3, view: 'plan', ...extra });
  f.dimensions = [
    dim(5, 0, 10, { auto: true, layer: 'A-DIMS-EXT' }),
    dim(7, 0, 4, { auto: false, layer: 'A-DIMS-HAND', startRef: { wallId: 'w1', end: 'start', x: 0, z: 0 } }),
    dim(8, 4, 10, { auto: false, layer: 'A-DIMS-HAND', endRef: { wallId: 'w2', end: 'end', x: 10, z: 0 } }),
  ];
  await open(page, f);
  const { at } = await frame(page);
  await h.armFromRail(page, 'select');
  await pickPoint(page, at, 0, -2);
  await page.locator('#delete').click();
  const d = await saved(page);
  expect(pieces(d), 'the hand run 0 to 4 gone').toEqual([[4, 10]]);
  const auto = (d.dimensions || []).find(x => x.auto === true);
  expect(auto && xs(auto), 'the auto string untouched').toEqual([0, 10]);
});
