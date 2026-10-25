// A STAIR BY HAND (Movie, 25 Oct): "i can't insert a new set of stairs when
// i use the STAIR command button". STAIR now brings up its popup -- STRAIGHT,
// L or U, the hand it turns, DOWN from this floor or UP to the one above, its
// width -- and two presses place it: the first step, then the way it runs.
// Its well is cut and its open side framed, one UNDO takes it all back, and
// Ctrl+C / Ctrl+V copy a stair ("yes").
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
const card = page => page.locator('[data-stair-pick]');
const strip = page => page.locator('#strip-message');
async function armStair(page) {
  await page.locator('[data-tool-key="stair"]').click();
  await page.waitForTimeout(150);
  await expect(card(page)).toBeVisible();
}
async function press(page, at, x, z) {
  await page.mouse.move(...at(x, z));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(100);
}
const r2 = n => Math.round(n * 100) / 100 + 0;

test('STAIR brings up its popup; DOWN, two presses place a straight flight there, its well cut', async ({ page }) => {
  await open(page, house());
  const { at } = await h.planFrame(page);
  await armStair(page);
  await expect(card(page).locator('[data-stair-shape="straight"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(card(page).locator('[data-stair-dir="down"]')).toHaveAttribute('aria-pressed', 'true');
  await press(page, at, 0, -8);
  await expect(strip(page)).toContainText('point the way it runs');
  await press(page, at, 0, 4);
  await expect(strip(page)).toContainText('STAIR placed');
  await saveNow(page);
  const d = await savedFile(page);
  expect(d.stairs).toHaveLength(1);
  const st = d.stairs[0];
  expect(st.levelId, 'filed on the floor it comes down from').toBe(MAIN_FL);
  expect([r2(st.start.x), r2(st.start.z)], 'the top step where pressed').toEqual([0, -8]);
  expect(r2(st.end.x)).toBe(0);
  expect(st.end.z, 'running the way the hand pointed').toBeGreaterThan(st.start.z);
  expect(st.auto, 'a hand placement').toBeUndefined();
  expect(d.surfaceOpenings.filter(o => o.stairId === st.id), 'its well').toHaveLength(1);
});

test('UP FROM HERE: the bottom step where pressed, filed on the floor above, climbing the way pointed', async ({ page }) => {
  await open(page, house());
  const { at } = await h.planFrame(page);
  await armStair(page);
  await card(page).locator('[data-stair-dir="up"]').click();
  await press(page, at, -10, 0);
  await press(page, at, 5, 0);
  await expect(strip(page)).toContainText('STAIR placed');
  await saveNow(page);
  const st = (await savedFile(page)).stairs[0];
  expect(st.levelId, 'filed on 2ND FL, which it comes down from').toBe(SECOND_FL);
  // ITS TOP is up the run from the press; it comes DOWN toward the press.
  expect(st.start.x).toBeGreaterThan(-10 + 5);
  expect(r2(st.start.z)).toBe(0);
  expect(st.end.x, 'running down toward the press').toBeLessThan(st.start.x);
});

test('the popup\'s L and TURN LEFT are what is placed', async ({ page }) => {
  await open(page, house());
  const { at } = await h.planFrame(page);
  await armStair(page);
  await card(page).locator('[data-stair-shape="L"]').click();
  await expect(card(page).locator('[data-stair-turns]')).toBeVisible();
  await card(page).locator('[data-stair-turn="left"]').click();
  await press(page, at, 8, -10);
  await press(page, at, 8, 4);
  await saveNow(page);
  const st = (await savedFile(page)).stairs[0];
  expect([st.shape, st.turn]).toEqual(['L', 'left']);
});

test('Esc puts the stair in hand down and places nothing; the tool stays up', async ({ page }) => {
  await open(page, house());
  const { at } = await h.planFrame(page);
  await armStair(page);
  await press(page, at, 0, -8);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  await expect(page.locator('[data-tool-key="stair"]')).toHaveAttribute('aria-pressed', 'true');
  await press(page, at, 0, 4);
  await expect(strip(page), 'that press was a new first step').toContainText('point the way it runs');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const d = await savedFile(page);
  expect((d.stairs || []).length).toBe(0);
});

test('one UNDO takes the stair and its well back', async ({ page }) => {
  await open(page, house());
  const { at } = await h.planFrame(page);
  await armStair(page);
  await press(page, at, 0, -8);
  await press(page, at, 0, 4);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  await saveNow(page);
  const d = await savedFile(page);
  expect(d.stairs.length).toBe(0);
  expect((d.surfaceOpenings || []).filter(o => o.stairId != null)).toHaveLength(0);
});

test('Ctrl+C and Ctrl+V copy a stair: a new whole-number id, beside the first, its own well', async ({ page }) => {
  await open(page, house());
  let { at } = await h.planFrame(page);
  await armStair(page);
  await press(page, at, 0, -8);
  await press(page, at, 0, 4);
  await page.keyboard.press('s');
  await page.waitForTimeout(100);
  await press(page, at, 0, -4);
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(150);
  await saveNow(page);
  const d = await savedFile(page);
  expect(d.stairs).toHaveLength(2);
  const [a, b] = d.stairs;
  expect(Number.isInteger(Number(b.id)) && b.id !== a.id).toBe(true);
  expect(Math.abs(b.start.x - a.start.x), 'a stair\'s width and a foot to the side').toBeGreaterThan(3.5);
  expect(d.surfaceOpenings.filter(o => o.stairId === b.id), 'the copy\'s own well').toHaveLength(1);
});
