// A STAIR LOCKS TO A WALL'S INSIDE FACE (Movie, 18 Oct).
//
// "make the INTERIOR line of a wall (like a SNAP POINT for the stairs so the
// edge of the stairs can move to line up there easily ... going down to the
// founsation from main floor we need to use the thickness of the foundation
// and inside insulation" (drawn as part of the wall) -- "once the stair is
// locked onto that wall, the user can move it, but if the user also changes
// the foundation wall thickness, that should also move the stairs (and
// reduce the width of the stairs to allow for the ext wall ... make a popup
// that tells the user the basement stair widths at the ext walls have been
// adjusted". The other side stays where it is; no minimum; the pop-up gives
// the new width.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const STAIR_ID = 7401;
// The MAIN FL stair goes DOWN, so it stands in the basement, beside the
// foundation wall along z = -6: 8" of concrete centred on its line, its
// inside face at z = -5'-8". The flight's right side is at z = -5.5, 2" off.
const W = (id, a, b, wallType) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 1, view: 'foundation', wallType, refLine: 'center', baseHeight: 0, topHeight: 8 });
const base = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [W('fw1', [-12, -6], [14, -6], 'concrete_8')],
  lines: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
  floors: [], surfaceOpenings: [],
  stairs: [{
    id: STAIR_ID, levelId: MAIN_FL, view: 'plan', layer: 'A-STR',
    start: { x: -2, z: -4 }, end: { x: 8, z: -4 },
    widthFt: 3, riseFt: 9, rail: 'left', shape: 'straight', turn: 'right', winders: 0, auto: false,
  }],
});

async function open(page, fixture, url = `/MODEL.html?left=1&right=1&level=${MAIN_FL}`) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: fixture });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const stairOf = d => d.stairs.find(s => Number(s.id) === STAIR_ID);
async function onStair(page) {
  const { at } = await h.planFrame(page);
  const [x, y] = at(-0.5, -4);
  await page.mouse.move(x, y);
  await expect(page.locator('#hover-name')).toHaveText('STAIR', { timeout: 4000 });
  return [x, y];
}
async function dragBy(page, [x, y], dxFt, dzFt) {
  const { scale } = await h.planFrame(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dxFt * scale, y + dzFt * scale, { steps: 6 });
  await page.mouse.up();
}
const r3 = n => Math.round(n * 1000) / 1000;

test('dragged near the foundation wall, the flight\'s side snaps to its inside face and locks to it', async ({ page }) => {
  await open(page, base());
  const at = await onStair(page);
  await page.mouse.click(at[0], at[1]);
  // Along the wall by 2', and the 2" gap closes by itself.
  await dragBy(page, at, 2, 0);
  const stair = stairOf(await saved(page));
  expect(r3(stair.start.z - 1.5), 'its right side on the face at -5\'-8"').toBe(r3(-6 + 4 / 12));
  expect(r3(stair.start.x)).toBe(0);
  expect(stair.widthFt).toBe(3);
  expect(stair.lock).toEqual({ right: { wallId: 'fw1' } });
});

test('dragged well clear, nothing snaps and the lock lets go', async ({ page }) => {
  await open(page, base());
  const at = await onStair(page);
  await page.mouse.click(at[0], at[1]);
  await dragBy(page, at, 2, 0);
  expect(stairOf(await saved(page)).lock).toEqual({ right: { wallId: 'fw1' } });
  const { at: map } = await h.planFrame(page);
  const at2 = map(1.5, -4);
  await dragBy(page, at2, 0, 4);
  const stair = stairOf(await saved(page));
  expect(r3(stair.start.z)).toBe(r3(-6 + 4 / 12 + 1.5 + 4));
  expect(stair.lock).toBeUndefined();
});

test('a thicker foundation wall moves the locked side in, the far side stays, and a pop-up gives the new width', async ({ page }) => {
  const f = base();
  // Already locked on the face: right side at -5'-8", so the walk line at -4'-2".
  f.stairs[0].start.z = f.stairs[0].end.z = -6 + 4 / 12 + 1.5;
  f.stairs[0].lock = { right: { wallId: 'fw1' } };
  await open(page, f, '/MODEL.html?left=1&lpane=properties&level=1&view=foundation');
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(10, -6));
  await page.waitForTimeout(150);
  // 13 1/4" ICF: the inside face comes 2 5/8" further in.
  await page.locator('[data-prop-row="type"] [data-prop-value="icf_13"]').dispatchEvent('click');
  await expect(page.locator('#stair-fit')).toBeVisible();
  await expect(page.locator('[data-stair-fit-text]')).toContainText('basement stair widths at the exterior walls have been adjusted to fit the new foundation thickness');
  await expect(page.locator('[data-stair-fit-list]')).toContainText(`STAIR ${STAIR_ID}: 3'-0" → 2'-9 3/8" WIDE`);
  await page.locator('[data-stair-fit-ok]').click();
  await expect(page.locator('#stair-fit')).toBeHidden();
  const stair = stairOf(await saved(page));
  const right = Math.min(stair.start.z + stair.widthFt / 2, stair.start.z - stair.widthFt / 2);
  const left = Math.max(stair.start.z + stair.widthFt / 2, stair.start.z - stair.widthFt / 2);
  expect(r3(right), 'on the new face').toBe(r3(-6 + 13.25 / 24));
  expect(r3(left), 'the far side where it was').toBe(r3(-6 + 4 / 12 + 3));
  // And back to 8": the flight takes its width back, the far side still put.
  await page.locator('[data-prop-row="type"] [data-prop-value="concrete_8"]').dispatchEvent('click');
  await page.locator('[data-stair-fit-ok]').click();
  expect(stairOf(await saved(page)).widthFt).toBeCloseTo(3, 6);
});

test('a flight going UP from the main floor (filed on 2ND) snaps to the MAIN floor wall\'s inside face, not the foundation\'s', async ({ page }) => {
  const f = base();
  f.stairs[0].levelId = 5;
  // A 2x6 main floor wall on the same line: its inside face at -6 + 2 3/4".
  f.walls.push({ id: 'mw1', start: { x: -12, y: 0, z: -6 }, end: { x: 14, y: 0, z: -6 },
    levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center', baseHeight: 0, topHeight: 8 });
  await open(page, f, '/MODEL.html?left=1&right=1&level=5');
  const at = await onStair(page);
  await page.mouse.click(at[0], at[1]);
  await dragBy(page, at, 2, 0);
  const stair = stairOf(await saved(page));
  expect(stair.lock).toEqual({ right: { wallId: 'mw1' } });
  expect(r3(stair.start.z - 1.5)).toBe(r3(-6 + 2.75 / 12));
});

test('locked between the foundation wall and a basement wall, a thicker foundation squeezes it from that side only', async ({ page }) => {
  const f = base();
  // A 2x4 basement wall on the far side, its face on the flight's left side.
  f.walls.push({ id: 'bw1', start: { x: -12, y: 0, z: -2 }, end: { x: 14, y: 0, z: -2 },
    levelId: 1, view: 'plan', wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
  const left = -2 - 1.75 / 12, right = -6 + 4 / 12;
  f.stairs[0].start.z = f.stairs[0].end.z = (left + right) / 2;
  f.stairs[0].widthFt = left - right;
  f.stairs[0].lock = { right: { wallId: 'fw1' }, left: { wallId: 'bw1' } };
  await open(page, f, '/MODEL.html?left=1&lpane=properties&level=1&view=foundation');
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(10, -6));
  await page.waitForTimeout(150);
  await page.locator('[data-prop-row="type"] [data-prop-value="icf_13"]').dispatchEvent('click');
  await expect(page.locator('#stair-fit')).toBeVisible();
  await page.locator('[data-stair-fit-ok]').click();
  const stair = stairOf(await saved(page));
  expect(r3(stair.start.z + stair.widthFt / 2), 'the basement wall side stays').toBe(r3(left));
  expect(r3(stair.start.z - stair.widthFt / 2), 'the foundation side comes in').toBe(r3(-6 + 13.25 / 24));
  expect(stair.lock).toEqual({ right: { wallId: 'fw1' }, left: { wallId: 'bw1' } });
});
