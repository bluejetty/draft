// A STAIR IN OBJ / PROP (Movie, 25 Oct): "so it a guy clicks on the STAIRCASE
// it will allow him to see the OBJ/PROP window with the STAIR info" -- its
// PLAN and SECTION in the two top boxes, the lower two gone, its PROPERTIES
// under them: WIDTH ("One PROPERTIES i'd like added is WIDTH") and a riser
// more or less ("ADD or SUBTRACT stair tread"), between "min rise 6" and
// 7 7/8" ("200mm ... ok use that measurement"). And its width said on the
// plan ("add a STAIR WIDTH mark (36 / 42 / etc at the top of the stairs on
// the 2nd tread"), changed there too ("allow the user to change that number
// on the plan to change the width too").
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const FOUNDATION = 1, MAIN_FL = 3, SECOND_FL = 5;

// THE WHOLE LEVEL STACK, for the reason model-html-auto-beam.spec.js gives:
// drawing-format.js drops any record whose levelId the drawing does not list,
// so a fixture missing a level would write stairs the next open loses and
// every count below would measure the page's memory rather than the file.
const empty = (extra = {}) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

// `cx`/`cz` DEFAULT TO THE ORIGIN, so every caller written before them is
// unchanged. They exist because a storey with TWO bodies on it cannot be
// built out of rectangles that all stand in the same place, and two bodies is
// the only shape that can tell houseOutlineOn's three rules apart.
const rect = ({ id = 'outline-x', levelId = MAIN_FL, wide = 40, deep = 32,
  cx = 0, cz = 0, garage = false } = {}) => ({
  id, levelId, garage,
  points: [
    { x: cx - wide / 2, y: 0, z: cz - deep / 2 },
    { x: cx + wide / 2, y: 0, z: cz - deep / 2 },
    { x: cx + wide / 2, y: 0, z: cz + deep / 2 },
    { x: cx - wide / 2, y: 0, z: cz + deep / 2 },
  ],
});

// A FLOOR FOR THE HOLE TO BE CUT FROM. `structure: 'floor'` rather than 'slab'
// is the discriminator buildStairOpenings filters on -- a slab is poured, not
// framed, and nothing cuts a stairwell out of one.
const floorOn = ({ id = 'floor-x', levelId = MAIN_FL, wide = 40, deep = 32,
  cx = 0, cz = 0 } = {}) => ({
  id, levelId, view: 'plan', structure: 'floor', garage: false,
  slopeInPerFt: 0, thickness: 0.9583333333333334, thickenedEdge: false,
  points: rect({ wide, deep, cx, cz }).points,
});

async function open(page, file = empty()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  // ?left=1 FOR THE TOOL COLUMN AND ?right=1 FOR THE PROPERTIES SLOT: both
  // ship collapsed, and the key is the only way to arm a tool with no legacy
  // button.
  await page.goto('/MODEL.html?left=1&lpane=build&right=1');
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function saveNow(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}
const savedFile = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);
// A HOUSE OF TWO FLOORS, each with its outline and its deck.
const house = () => empty({
  outlines: [rect({ id: 'o-main', levelId: MAIN_FL }), rect({ id: 'o-2nd', levelId: SECOND_FL })],
  floors: [floorOn({ id: 'f-main', levelId: MAIN_FL }), floorOn({ id: 'f-2nd', levelId: SECOND_FL })],
});

const strip = page => page.locator('#strip-message');
const win = page => page.locator('#objprop');
async function press(page, at, x, z) {
  await page.mouse.move(...at(x, z));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(100);
}
// A STRAIGHT FLIGHT DOWN FROM MAIN FL, placed by hand, then picked.
async function stairPicked(page) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await page.setViewportSize({ width: 1366, height: 760 });
  await open(page, house());
  const { at } = await h.planFrame(page);
  await page.locator('[data-tool-key="stair"]').click();
  await page.waitForTimeout(150);
  await press(page, at, 0, -8);
  await press(page, at, 0, 4);
  await expect(strip(page)).toContainText('STAIR placed');
  await page.keyboard.press('s');
  await page.waitForTimeout(100);
  await press(page, at, 0, -4);
  return at;
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const inked = page => page.evaluate(() => [...document.querySelectorAll('#objprop [data-objprop-view]')].map(cv => {
  if (!cv.offsetParent) return null;
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n += 1;
  return n > 50;
}));
const stairOf = async page => { await saveNow(page); return (await savedFile(page)).stairs[0]; };
const runOf = st => Math.hypot(st.end.x - st.start.x, st.end.z - st.start.z);

test('a click on a stair opens OBJ / PROP on it: PLAN and SECTION up top, the lower boxes gone, WIDTH and RISERS under them', async ({ page }) => {
  await stairPicked(page);
  await expect(win(page)).toBeVisible();
  await expect(win(page)).toHaveAttribute('data-objprop-kind', 'stair');
  await expect(win(page).locator('[data-objprop-title]')).toContainText('STAIR');
  await expect(win(page).locator('[data-objprop-title]')).toContainText('36" WIDE');
  await expect(win(page).locator('figcaption').nth(0)).toHaveText('PLAN');
  await expect(win(page).locator('figcaption').nth(1)).toHaveText('SECTION');
  expect(await inked(page), 'two views drawn, two hidden').toEqual([true, true, null, null]);
  await expect(win(page).locator('[data-stair-width]')).toHaveValue('36');
  await expect(win(page).locator('[data-stair-risers="more"]')).toBeVisible();
  await expect(win(page).locator('[data-stair-risers="less"]')).toBeVisible();
});

test('RISERS +: one more riser, each lower, the flight a tread longer, kept on save; UNDO takes it back', async ({ page }) => {
  await stairPicked(page);
  const before = await stairOf(page);
  await win(page).locator('[data-stair-risers="more"]').click();
  await expect(strip(page)).toContainText(`${before.risers + 1} risers`);
  const after = await stairOf(page);
  expect(after.riserCount).toBe(before.risers + 1);
  expect(after.risers).toBe(before.risers + 1);
  expect(runOf(after) - runOf(before), 'a 10" tread longer').toBeCloseTo(10 / 12, 3);
  const hole = d => d.surfaceOpenings.find(o => o.stairId === after.id);
  await expect(win(page).locator('[data-stair-risers-said]')).toContainText(`${before.risers + 1} @`);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  const undone = await stairOf(page);
  expect(undone.riserCount, 'UNDO takes the count away').toBeUndefined();
  expect(undone.risers).toBe(before.risers);
  expect(runOf(undone)).toBeCloseTo(runOf(before), 4);
  expect(hole(await savedFile(page)), 'the well still cut').toBeTruthy();
});

test('RISERS − at the fewest is refused: the riser would be over 7 7/8"', async ({ page }) => {
  await stairPicked(page);
  const before = await stairOf(page);
  await win(page).locator('[data-stair-risers="less"]').click();
  await expect(strip(page)).toContainText('over the');
  expect((await stairOf(page)).risers).toBe(before.risers);
});

test('RISERS + past the 6" least is refused', async ({ page }) => {
  await stairPicked(page);
  const before = await stairOf(page);
  const most = Math.floor(before.riseFt * 12 / 6 + 1e-9);
  for (let n = before.risers; n < most; n += 1) {
    await win(page).locator('[data-stair-risers="more"]').click();
    await page.waitForTimeout(60);
  }
  await win(page).locator('[data-stair-risers="more"]').click();
  await expect(strip(page)).toContainText('under the');
  expect((await stairOf(page)).risers).toBe(most);
});

test('WIDTH 42 in OBJ / PROP widens the stair and its well; 30 is refused', async ({ page }) => {
  await stairPicked(page);
  await saveNow(page);
  const d0 = await savedFile(page);
  const hole0 = d0.surfaceOpenings.find(o => o.stairId === d0.stairs[0].id).points;
  const span = pts => { const xs = pts.map(p => p.x); return Math.max(...xs) - Math.min(...xs); };
  const field = win(page).locator('[data-stair-width]');
  await field.fill('42');
  await field.press('Enter');
  await page.waitForTimeout(150);
  const d1 = (await saveNow(page), await savedFile(page));
  expect(d1.stairs[0].widthFt).toBeCloseTo(3.5, 6);
  const hole1 = d1.surfaceOpenings.find(o => o.stairId === d1.stairs[0].id).points;
  expect(span(hole1) - span(hole0), 'the well 6" wider').toBeCloseTo(0.5, 2);
  await win(page).locator('[data-stair-width]').fill('30');
  await win(page).locator('[data-stair-width]').press('Enter');
  await expect(strip(page)).toContainText('36" at the least');
  expect((await stairOf(page)).widthFt).toBeCloseTo(3.5, 6);
});

test('the plan says the width on the second tread; a double-click on it and 42 ENTER widens it; Esc leaves it', async ({ page }) => {
  await stairPicked(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const marks = async () => JSON.parse(await page.locator('#plan').getAttribute('data-stair-width-marks') || '[]');
  const [mark] = await marks();
  expect(mark, 'a width mark').toBeTruthy();
  const st = await stairOf(page);
  const { at } = await h.planFrame(page);
  const box = await page.locator('#plan').boundingBox();
  // ON THE FIRST DROPPED STEP: between the top nosing and 10" down the run.
  const top = at(st.start.x, st.start.z), next = at(st.start.x, st.start.z + 10 / 12);
  const [mx, my] = [box.x + mark[1], box.y + mark[2]];
  expect(Math.abs(mx - (top[0] + next[0]) / 2)).toBeLessThan(3);
  expect(Math.abs(my - (top[1] + next[1]) / 2)).toBeLessThan(3);
  await page.mouse.dblclick(mx, my);
  const edit = page.locator('#stair-width-edit');
  await expect(edit).toBeVisible();
  await expect(edit).toHaveValue('36');
  await edit.fill('48');
  await edit.press('Escape');
  await expect(edit).toHaveCount(0);
  expect((await stairOf(page)).widthFt, 'Esc changed nothing').toBeCloseTo(3, 6);
  const [again] = await marks();
  await page.mouse.dblclick(box.x + again[1], box.y + again[2]);
  await page.locator('#stair-width-edit').fill('42');
  await page.locator('#stair-width-edit').press('Enter');
  await page.waitForTimeout(150);
  expect((await stairOf(page)).widthFt).toBeCloseTo(3.5, 6);
});

test('a stair whose side lies on a wall grows away from it; its wall side stays', async ({ page }) => {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  // THE WALL BELOW, where the flight lands: that is the wall a stair's side
  // is judged against (stairFaceWalls).
  const wall = { id: 'wl', levelId: FOUNDATION, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
    baseHeight: 0, topHeight: 8, start: { x: -3, y: 0, z: -14 }, end: { x: -3, y: 0, z: 14 } };
  const st = { id: 1, levelId: MAIN_FL, view: 'plan', shape: 'straight', turn: 'right', rail: 'right', winders: 0,
    widthFt: 3, riseFt: 9, start: { x: 0, y: 0, z: -8 }, end: { x: 0, y: 0, z: 4 } };
  await page.setViewportSize({ width: 1366, height: 760 });
  await open(page, { ...house(), walls: [wall], stairs: [st] });
  // SLID ACROSS ONTO THE WALL'S FACE, the way its snap would lay it.
  const face = await page.evaluate(() => {
    const stair = drawing.stairs[0];
    const frame = stairFrame(stair);
    const f = wallFaceAcross(frame, drawing.walls.find(w => w.id === 'wl'));
    const shift = f > 0 ? f - frame.half : f + frame.half;
    stair.start.x += frame.n.x * shift; stair.end.x += frame.n.x * shift;
    stair.start.z += frame.n.z * shift; stair.end.z += frame.n.z * shift;
    paint();
    return { x: frame.c.x + frame.n.x * f, lock: stairLockNow(stair) };
  });
  expect(face.lock, 'its side lies on the wall').toBeTruthy();
  const { at } = await h.planFrame(page);
  await page.keyboard.press('s');
  await press(page, at, face.x + 1.5, -4);
  await expect(win(page)).toHaveAttribute('data-objprop-kind', 'stair');
  await win(page).locator('[data-stair-width]').fill('42');
  await win(page).locator('[data-stair-width]').press('Enter');
  await page.waitForTimeout(150);
  const after = await stairOf(page);
  expect(after.widthFt).toBeCloseTo(3.5, 6);
  expect(after.start.x - 1.75, 'the wall side stays on the face').toBeCloseTo(face.x, 3);
});
