// STAIRS IN STANDARDS (Movie, 25 Oct): "is stair limitations set up in
// STANDARDS, we should allow that to change too in STANDARDS" -- MAX RISER
// 7 7/8" ("ok use that measurement" of 200 mm), MIN RISER 6" ("make min rise
// 6""), TREAD RUN 10", MIN WIDTH 36", MIN HEADROOM 6'-10". The page keeps
// them in the office's standards package; every page that draws a stair
// reads them from there.
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
const watch = page => { page.__errors = []; page.on('pageerror', err => page.__errors.push(String(err))); };
const box = (page, key) => page.locator(`[data-stair-std="${key}"]`);
const pkg = page => page.evaluate(() => window.DraftProfileManager.getActive('standards')?.content?.model?.stairStandards || null);
async function standards(page) {
  await page.goto('/STANDARDS.html');
  await expect(box(page, 'maxRiserIn')).toBeVisible();
}
async function setStd(page, key, text) {
  await box(page, key).fill(text);
  await box(page, key).press('Enter');
  await box(page, key).blur();
  await page.waitForTimeout(80);
}

test('STANDARDS has a STAIRS section with the office defaults; inches or feet-and-inches are kept; nonsense is refused; RESET puts them back', async ({ page }) => {
  watch(page);
  await h.openModel(page, { webgl: false });
  await standards(page);
  const said = async () => Promise.all(['maxRiserIn', 'minRiserIn', 'treadRunIn', 'minWidthIn', 'headroomIn']
    .map(key => box(page, key).inputValue()));
  expect(await said()).toEqual(['7 7/8"', '6"', '10"', '36"', "6'-10\""]);
  await setStd(page, 'maxRiserIn', '7 1/2');
  await expect(page.locator('#status')).toContainText('MAX RISER is 7 1/2"');
  await setStd(page, 'headroomIn', "7'");
  expect(await pkg(page)).toMatchObject({ maxRiserIn: 7.5, headroomIn: 84, minRiserIn: 6, treadRunIn: 10, minWidthIn: 36 });
  await setStd(page, 'treadRunIn', 'ten');
  await expect(page.locator('#status')).toContainText('TREAD RUN: type inches');
  expect((await pkg(page)).treadRunIn, 'unchanged').toBe(10);
  // A LEAST ABOVE THE MOST comes down to it.
  await setStd(page, 'minRiserIn', '9');
  expect((await pkg(page)).minRiserIn).toBe(7.5);
  page.once('dialog', d => d.accept());
  await page.locator('#reset').click();
  await page.waitForTimeout(150);
  expect(await said()).toEqual(['7 7/8"', '6"', '10"', '36"', "6'-10\""]);
  expect(await pkg(page)).toMatchObject({ maxRiserIn: 7.875, minRiserIn: 6, treadRunIn: 10, minWidthIn: 36, headroomIn: 82 });
});

test('the model lays a stair out by the office\'s numbers: MAX RISER sets the risers, TREAD RUN the run, MIN WIDTH the least WIDTH', async ({ page }) => {
  watch(page);
  await page.setViewportSize({ width: 1366, height: 760 });
  await h.openModel(page, { webgl: false });
  await standards(page);
  await setStd(page, 'maxRiserIn', '7 1/2');
  await setStd(page, 'treadRunIn', '11');
  await setStd(page, 'minWidthIn', '40');
  await open(page, house());
  const { at } = await h.planFrame(page);
  await page.locator('[data-tool-key="stair"]').click();
  await page.waitForTimeout(150);
  await expect(page.locator('[data-stair-width]').first(), 'the popup starts at the office\'s least').toHaveValue('40');
  for (const [x, z] of [[0, -8], [0, 4]]) {
    await page.mouse.move(...at(x, z));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(x, z));
    await page.waitForTimeout(100);
  }
  await saveNow(page);
  const st = (await savedFile(page)).stairs[0];
  const riseIn = st.riseFt * 12;
  expect(st.risers, 'the fewest at 7 1/2" the most').toBe(Math.ceil(riseIn / 7.5 - 1e-9));
  expect(Math.hypot(st.end.x - st.start.x, st.end.z - st.start.z), 'each tread 11"')
    .toBeCloseTo((st.risers - 1) * 11 / 12, 3);
  expect(st.widthFt).toBeCloseTo(40 / 12, 6);
  // WIDTH UNDER THE LEAST IS REFUSED, and says the office's number.
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.mouse.click(...at(0, -4));
  await page.locator('#objprop [data-stair-width]').fill('38');
  await page.locator('#objprop [data-stair-width]').press('Enter');
  await expect(page.locator('#strip-message')).toContainText('40" at the least');
});
