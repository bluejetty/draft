// THE BASEMENT FLIGHT BESIDE AN EXTERIOR WALL (jb, 19 Nov 2026).
//
// "if they are placed beside the exterior wall, the downstairs flight will
// need to be adjusted ... 14\" ... for 8\" conc. wall ... the upper ext wall
// ... lets give them 6\" ... if the upstairs are 3'8\" wide, on the side next
// to the ext wall, 8\" reduced for basement width 3'0\"", "on the INTERIOR
// stairs the widths can be the same", "one switch for reducing (maybe allow
// manual input to change the distance too) and another switch for the side
// the stairs are on ext".
//
// REDUCE BASEMENT (ON / OFF + inches, 8 by default) and EXT. WALL SIDE (by
// the compass) on the stair panel, written to the basement flight: its
// width is the flight above's less the cut, taken off the wall side only, so
// the inside edges line up. A width typed on the flight above carries down.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const SECOND = 5;
const BASE_ID = 7601;   // MAIN -> basement, along the NORTH wall
const UPPER_ID = 7602;  // 2ND -> MAIN, over it

const flight = (id, levelId, extra = {}) => ({
  id, levelId, view: 'plan', layer: 'A-STR',
  start: { x: -2, z: -18 }, end: { x: 8, z: -18 },
  widthFt: 3, riseFt: 9, rail: 'left', shape: 'straight', turn: 'right', winders: 0, auto: false, ...extra,
});
const square = { id: 'OUT-1', levelId: MAIN_FL, view: 'plan',
  points: [{ x: -20, z: -20 }, { x: 20, z: -20 }, { x: 20, z: 20 }, { x: -20, z: 20 }] };
const fixture = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: SECOND, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [square], shapes: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
  floors: [], surfaceOpenings: [],
  stairs: [flight(BASE_ID, MAIN_FL), flight(UPPER_ID, SECOND)],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: fixture() });
  await page.goto(`/MODEL.html?left=1&right=1&level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}
const live = (page, id) => page.evaluate(id => {
  const st = drawing.stairs.find(s => Number(s.id) === id);
  return JSON.parse(JSON.stringify(st));
}, id);
async function pickBase(page) {
  const { at } = await h.planFrame(page);
  const [x, y] = at(3, -18);
  await page.mouse.move(x, y);
  await expect(page.locator('#hover-name')).toHaveText('STAIR', { timeout: 4000 });
  await page.mouse.click(x, y);
}
const row = (page, name) => page.locator(`[data-prop-row="${name}"]`).first();
// Across the run (+z is south here): the flight's north and south edges.
const edges = st => ({ north: st.start.z - st.widthFt / 2, south: st.start.z + st.widthFt / 2 });

test('REDUCE BASEMENT takes 8" off the north (wall) side; the inside edge stays under the flight above', async ({ page }) => {
  await open(page);
  await pickBase(page);
  const reduce = row(page, 'reduce basement');
  await expect(reduce).toBeVisible();
  await expect(reduce.locator('[data-prop-value="off"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(reduce.locator('[data-stair-ext-cut]')).toHaveValue('8');
  // The side nearest the house line is offered, named by the compass.
  const side = row(page, 'ext wall side');
  await expect(side.locator('[aria-pressed="true"]')).toHaveText('NORTH');
  await expect(side).toContainText('SOUTH');

  await reduce.locator('[data-prop-value="on"]').click();
  const base = await live(page, BASE_ID);
  const upper = await live(page, UPPER_ID);
  expect(base.extWall).toBe(true);
  expect(base.extWallCutIn).toBe(8);
  expect(base.widthFt * 12).toBeCloseTo(28, 4);
  expect(edges(base).south, 'inside edge lined up').toBeCloseTo(edges(upper).south, 4);
  expect(edges(base).north - edges(upper).north, 'the 8" comes off the north side').toBeCloseTo(8 / 12, 4);
  expect(upper.widthFt, 'the flight above is untouched').toBeCloseTo(3, 6);

  // ONE UNDO puts it back.
  await page.locator('#model-undo').click();
  const undone = await live(page, BASE_ID);
  expect(undone.widthFt).toBeCloseTo(3, 6);
  expect(undone.start.z).toBeCloseTo(-18, 6);
  expect(undone.extWall).toBeUndefined();
});

test('3\'-8" typed on the flight above gives a 3\'-0" basement flight; the inches and the side can change; OFF puts it back', async ({ page }) => {
  await open(page);
  await pickBase(page);
  await row(page, 'reduce basement').locator('[data-prop-value="on"]').click();
  // jb's example: 3'-8" upstairs.
  await page.evaluate(id => setStairWidth(drawing.stairs.find(s => Number(s.id) === id), 44), UPPER_ID);
  let base = await live(page, BASE_ID);
  let upper = await live(page, UPPER_ID);
  expect(upper.widthFt * 12).toBeCloseTo(44, 4);
  expect(base.widthFt * 12, '3\'-0" below').toBeCloseTo(36, 4);
  expect(edges(base).south).toBeCloseTo(edges(upper).south, 4);
  // ...and one UNDO takes both back.
  await page.locator('#model-undo').click();
  base = await live(page, BASE_ID);
  upper = await live(page, UPPER_ID);
  expect(upper.widthFt * 12).toBeCloseTo(36, 4);
  expect(base.widthFt * 12).toBeCloseTo(28, 4);
  await page.evaluate(id => setStairWidth(drawing.stairs.find(s => Number(s.id) === id), 44), UPPER_ID);

  // A typed reduction.
  await pickBase(page);
  const cut = row(page, 'reduce basement').locator('[data-stair-ext-cut]');
  await cut.fill('6');
  await cut.press('Enter');
  base = await live(page, BASE_ID);
  expect(base.extWallCutIn).toBe(6);
  expect(base.widthFt * 12).toBeCloseTo(38, 4);
  expect(edges(base).south).toBeCloseTo(edges(await live(page, UPPER_ID)).south, 4);

  // The wall on the SOUTH side instead: the north edges line up now.
  await row(page, 'ext wall side').locator('[data-prop-value="left"]').click();
  base = await live(page, BASE_ID);
  upper = await live(page, UPPER_ID);
  expect(base.extWallSide).toBe('left');
  expect(base.widthFt * 12).toBeCloseTo(38, 4);
  expect(edges(base).north).toBeCloseTo(edges(upper).north, 4);
  await expect(row(page, 'ext wall side').locator('[aria-pressed="true"]')).toHaveText('SOUTH');

  // OFF: an interior stair, the same width as above and right under it.
  await row(page, 'reduce basement').locator('[data-prop-value="off"]').click();
  base = await live(page, BASE_ID);
  expect(base.extWall).toBe(false);
  expect(base.widthFt * 12).toBeCloseTo(44, 4);
  expect(base.start.z).toBeCloseTo(upper.start.z, 4);
});

test('the switch survives a save and reload', async ({ page }) => {
  await open(page);
  await pickBase(page);
  await row(page, 'reduce basement').locator('[data-prop-value="on"]').click();
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  const file = await page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await f.text());
  }, BUCKET);
  const base = file.stairs.find(s => Number(s.id) === BASE_ID);
  expect(base.extWall).toBe(true);
  expect(base.extWallCutIn).toBe(8);
  expect(base.extWallSide).toBe('right');
  expect(base.widthFt * 12).toBeCloseTo(28, 4);
});

// "maybe have a magnet so that when a user moves the stairs in the basement
// it doesn't allow the user to push past that point" (jb, 19 Nov 2026).
const dragBy = async (page, fromX, fromZ, dxFt, dzFt) => {
  const { at, scale } = await h.planFrame(page);
  const [x, y] = at(fromX, fromZ);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dxFt * scale, y + dzFt * scale, { steps: 8 });
  await page.mouse.up();
};
test('a reduced basement flight dragged at the wall stops 14" in from the house line; the flight above rides 6" in', async ({ page }) => {
  await open(page);
  await pickBase(page);
  await row(page, 'reduce basement').locator('[data-prop-value="on"]').click();
  // Two feet north would put it past the house line (z = -20).
  await dragBy(page, 3, -17.7, 0, -2);
  const base = await live(page, BASE_ID);
  const upper = await live(page, UPPER_ID);
  expect(edges(base).north - -20, 'basement edge 14" from the line').toBeCloseTo(14 / 12, 3);
  expect(edges(upper).north - -20, 'the flight above 6" from the line').toBeCloseTo(6 / 12, 3);
  // A drag away from the wall is free.
  await dragBy(page, 3, -18.4, 0, 3);
  const off = await live(page, BASE_ID);
  expect(edges(off).north - -20).toBeCloseTo(14 / 12 + 3, 2);
});

test('with REDUCE BASEMENT off the flight goes where it is dragged', async ({ page }) => {
  await open(page);
  const before = await live(page, BASE_ID);
  await pickBase(page);
  // North, past where the 14" line would have held it.
  await dragBy(page, 1, -17.6, 0, -1.2);
  const after = await live(page, BASE_ID);
  expect(after.start.z, 'no stop at 14"').toBeLessThan(before.start.z - 0.4);
});

test('turning REDUCE BASEMENT on lines a stack near the wall up on the line, in one UNDO', async ({ page }) => {
  await open(page);
  // Slide the stack a foot off the wall first (edges 2'-6" in).
  await page.evaluate(() => drawing.stairs.forEach(st => {
    st.start = { ...st.start, z: st.start.z + 1 }; st.end = { ...st.end, z: st.end.z + 1 };
  }));
  await pickBase(page);
  // pickBase clicks z = -18: still on the flight (-18.5 .. -15.5).
  await row(page, 'reduce basement').locator('[data-prop-value="on"]').click();
  const base = await live(page, BASE_ID);
  const upper = await live(page, UPPER_ID);
  expect(edges(base).north - -20).toBeCloseTo(14 / 12, 3);
  expect(edges(upper).north - -20).toBeCloseTo(6 / 12, 3);
  await page.locator('#model-undo').click();
  const undone = await live(page, BASE_ID);
  expect(undone.start.z).toBeCloseTo(-17, 6);
  expect(undone.widthFt).toBeCloseTo(3, 6);
  expect((await live(page, UPPER_ID)).start.z).toBeCloseTo(-17, 6);
});
