// STAIRS STACKED FLOOR OVER FLOOR MOVE AS ONE PIECE (jb, 14 Nov 2026).
//
// "can we make the multi-level stairs LOCKED together, so that the stairs
// move as one peice. on the floor plans when they are moved." Each storey's
// flight is its own record, so a drag of MAIN's flight left 2ND's flight
// (and its well) where it was. THE STACK IS WHAT OVERLAPS: a flight on
// another floor whose plan footprint overlaps the one moved goes with it --
// a drag, the arrows, ROTATE -- by the same delta, its well too, in one UNDO.
// ALT on the press moves the one flight alone. A flight on the SAME floor,
// or one elsewhere on another floor, is never carried.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const SECOND = 5;
const MAIN_ID = 7501;    // MAIN -> basement
const UPPER_ID = 7502;   // 2ND -> MAIN, over MAIN's
const FAR_ID = 7503;     // 2ND -> MAIN, across the house: not a mate
const BESIDE_ID = 7504;  // MAIN, beside MAIN's: same floor, never a mate
const UPPER_WELL = 'OP-UP';

const flight = (id, levelId, x, z, extra = {}) => ({
  id, levelId, view: 'plan', layer: 'A-STR',
  start: { x, z }, end: { x: x + 10, z },
  widthFt: 3, riseFt: 9, rail: 'left', shape: 'straight', turn: 'right', winders: 0, auto: false, ...extra,
});
const fixture = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: SECOND, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
  floors: [{
    id: 'FL-2', levelId: SECOND, view: 'floor', structure: 'floor',
    points: [{ x: -20, z: -20 }, { x: 20, z: -20 }, { x: 20, z: 20 }, { x: -20, z: 20 }],
  }],
  stairs: [
    flight(MAIN_ID, MAIN_FL, -2, -4),
    // Half a foot off MAIN's line: overlapping, not identical.
    flight(UPPER_ID, SECOND, -1.5, -4.5),
    flight(FAR_ID, SECOND, -2, 10),
    flight(BESIDE_ID, MAIN_FL, -2, 4),
  ],
  surfaceOpenings: [{
    id: UPPER_WELL, hostType: 'floor', hostId: 'FL-2', levelId: SECOND, stairId: UPPER_ID,
    points: [{ x: -2, z: -6 }, { x: 9, z: -6 }, { x: 9, z: -3 }, { x: -2, z: -3 }],
  }],
});

async function open(page) {
  await h.openEditor(page, { drawing: fixture(), bucket: BUCKET, url: `/MODEL.html?left=1&right=1&level=${MAIN_FL}`, webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}
async function save(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}
const saved = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);
const stairOf = (file, id) => file.stairs.find(s => Number(s.id) === id);
const wellOf = file => file.surfaceOpenings.find(o => o.id === UPPER_WELL);

async function pickMain(page) {
  const { at } = await h.planFrame(page);
  const [x, y] = at(-0.5, -4);
  await page.mouse.move(x, y);
  await expect(page.locator('#hover-name'), 'the press point is on the stair').toHaveText('STAIR', { timeout: 4000 });
  await page.mouse.click(x, y);
  return [x, y];
}
async function dragBy(page, [x, y], dxFt, dzFt, { alt = false } = {}) {
  const { scale } = await h.planFrame(page);
  await page.mouse.move(x, y);
  if (alt) await page.keyboard.down('Alt');
  await page.mouse.down();
  await page.mouse.move(x + dxFt * scale, y + dzFt * scale, { steps: 6 });
  await page.mouse.up();
  if (alt) await page.keyboard.up('Alt');
}
const shifted = (after, before, dx, dz, what) => {
  expect(after.x - before.x, `${what} x`).toBeCloseTo(dx, 2);
  expect(after.z - before.z, `${what} z`).toBeCloseTo(dz, 2);
};

test('a drag of MAIN\'s flight carries the 2ND FL flight over it and its well; one UNDO puts both back', async ({ page }) => {
  await open(page);
  const first = await saved(page);
  const at = await pickMain(page);
  await dragBy(page, at, 4, 3);
  await save(page);
  const after = await saved(page);
  shifted(stairOf(after, MAIN_ID).start, stairOf(first, MAIN_ID).start, 4, 3, 'MAIN flight');
  shifted(stairOf(after, UPPER_ID).start, stairOf(first, UPPER_ID).start, 4, 3, 'the 2ND FL flight over it');
  shifted(stairOf(after, UPPER_ID).end, stairOf(first, UPPER_ID).end, 4, 3, 'its foot');
  wellOf(after).points.forEach((pt, i) => shifted(pt, wellOf(first).points[i], 4, 3, `its well corner ${i}`));
  expect(stairOf(after, FAR_ID), 'a 2ND FL flight it does not overlap stays').toEqual(stairOf(first, FAR_ID));
  expect(stairOf(after, BESIDE_ID), 'a flight on the same floor stays').toEqual(stairOf(first, BESIDE_ID));

  await page.locator('#model-undo').click();
  await save(page);
  const undone = await saved(page);
  expect(stairOf(undone, MAIN_ID).start).toEqual(stairOf(first, MAIN_ID).start);
  expect(stairOf(undone, UPPER_ID).start).toEqual(stairOf(first, UPPER_ID).start);
  expect(wellOf(undone).points).toEqual(wellOf(first).points);
});

test('ALT on the press moves the one flight alone', async ({ page }) => {
  await open(page);
  const first = await saved(page);
  const at = await pickMain(page);
  await dragBy(page, at, 4, 3, { alt: true });
  await save(page);
  const after = await saved(page);
  shifted(stairOf(after, MAIN_ID).start, stairOf(first, MAIN_ID).start, 4, 3, 'MAIN flight');
  expect(stairOf(after, UPPER_ID).start, 'the 2ND FL flight stays').toEqual(stairOf(first, UPPER_ID).start);
});

test('the arrows and ROTATE carry the stack too', async ({ page }) => {
  await open(page);
  const first = await saved(page);
  await pickMain(page);
  await page.keyboard.press('Control+ArrowRight');
  await save(page);
  const nudged = await saved(page);
  shifted(stairOf(nudged, MAIN_ID).start, stairOf(first, MAIN_ID).start, 1, 0, 'MAIN flight');
  shifted(stairOf(nudged, UPPER_ID).start, stairOf(first, UPPER_ID).start, 1, 0, 'the 2ND FL flight');

  await page.evaluate(() => rotateSelection(90));
  await save(page);
  const turned = await saved(page);
  const bearing = s => Math.atan2(s.end.z - s.start.z, s.end.x - s.start.x) * 180 / Math.PI;
  expect(Math.abs(bearing(stairOf(turned, MAIN_ID))), 'MAIN turned a quarter').toBeCloseTo(90, 1);
  expect(Math.abs(bearing(stairOf(turned, UPPER_ID))), 'and the 2ND FL flight with it').toBeCloseTo(90, 1);
  expect(stairOf(turned, FAR_ID)).toEqual(stairOf(first, FAR_ID));
});
