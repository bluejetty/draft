// A PICKED BEAM ROW'S END PULLS IN OFF THE WALL (jb, 25 Nov 2026): "i'm
// having a hard time disconnecting the beam from the foundation wall.. i'd
// like to bring it in about 3'6 for the stair it doesn't need to go all the
// way to the foudnation" -- "maybe once the beam is selected the beam nodes
// seperate from any nodes which may be in the same location".
//
// Fixture from tests/beam-move.spec.js:
//
// "so the AUTOPLACED beams and columns. I'd like to be able to move the BEAM
// manually so that all the columns follow. i will also want to probably
// DELETE one line of beams and will only have 2 lines located where on each
// side wall of a central hallway. so i will need to move beams up or down" --
// "would be 31 feet max space for OWJ" -- "but make that TEXT editable so and
// ENGINEER can change it to whatever they specify the floor or beams as
// (STEEL, LAMINATED BEAMS etc)".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// An L on MAIN FL: 40 wide, 32 deep on the left, the right half stopping at
// z = 4. A row of beam in two pieces post to post -- the way AUTO BEAM lays
// one -- runs across the deep half at z = 8, x -20 to 0, on a post at the
// joint and another mid-piece; a third post stands off it.
const L = [[-20, -16], [20, -16], [20, 4], [0, 4], [0, 16], [-20, 16]];
const P = (x, z) => ({ x, y: 0, z });
const drawing = (extra = {}) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [], lines: [], floors: [], roofs: [], dimensions: [], fenestrations: [],
  outlines: [{ id: 'outline-l', levelId: 3, garage: false, points: L.map(([x, z]) => P(x, z)) }],
  shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [],
  beams: [
    { id: 1, start: P(-20, 8), end: P(-8, 8), levelId: 1, view: 'foundation', mode: 'flush', auto: true },
    { id: 2, start: P(-8, 8), end: P(0, 8), levelId: 1, view: 'foundation', mode: 'flush', auto: true },
  ],
  columns: [
    { id: 1, point: P(-8, 8), levelId: 1, view: 'foundation', footing: 'pad36', auto: true },
    { id: 2, point: P(-14, 8), levelId: 1, view: 'foundation', footing: 'pad36', auto: true },
    { id: 3, point: P(-10, 12), levelId: 1, view: 'foundation', footing: 'pad36' },
  ],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
  ...extra,
});
async function open(page, f = drawing(), url = '/MODEL.html') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function toFoundation(page) {
  await h.pickModelLayer(page, 1, 'foundation');
  const levels = page.getByRole('button', { name: 'LEVELS / LAYERS' });
  if (await levels.getAttribute('aria-expanded') === 'true') await levels.click();
  await page.keyboard.press('Escape');
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(100); };
async function drag(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const r2 = n => Math.round(n * 100) / 100 + 0;
const seg = b => [b.start.x, b.start.z, b.end.x, b.end.z].map(r2);
const pt = c => [c.point.x, c.point.z].map(r2);


const endX = d => Math.max(...d.beams.flatMap(b => [b.start.x, b.end.x]));

test('the picked row\'s end square drags that end in along the row; a typed 3\'6" puts it exactly; one UNDO puts it back', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await click(page, at, -4, 8);
  expect(await page.evaluate(() => selection.length)).toBe(2);
  // Pressed on the end on the wall (x = 0), pulled in and a little off the line.
  await drag(page, at, [0, 8], [-2, 9]);
  let d = await saved(page);
  expect(r2(endX(d)), 'along the row only').toBe(-2);
  expect(d.beams.map(seg)).toEqual([[-20, 8, -8, 8], [-8, 8, -2, 8]]);
  expect(d.beams.every(b => b.auto === false), 'a hand-shortened row is the drafter\'s').toBe(true);
  // AND TYPED, exactly 3'-6" in from the wall.
  await expect(page.locator('#frozen-length')).toBeEnabled();
  await page.keyboard.type("3'6");
  await page.keyboard.press('Enter');
  d = await saved(page);
  expect(d.beams.map(seg)).toEqual([[-20, 8, -8, 8], [-8, 8, -3.5, 8]]);
  await page.keyboard.press('Escape');
  await page.locator('#model-undo').click();
  d = await saved(page);
  expect(d.beams.map(seg)).toEqual([[-20, 8, -8, 8], [-8, 8, 0, 8]]);
});

test('the end stops short of the last post and at the wall', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await click(page, at, -4, 8);
  await drag(page, at, [0, 8], [-12, 8]);
  let d = await saved(page);
  expect(r2(endX(d)), '6" past the post at x = -8').toBe(-7.5);
  await drag(page, at, [-7.5, 8], [6, 8]);
  d = await saved(page);
  expect(r2(endX(d)), 'out no further than the wall').toBe(0);
});

test('a pulled-in end catches the stair opening\'s corner lined up across from it', async ({ page }) => {
  // The MAIN FL's stair hole, drawn over the FOUNDATION it stands on.
  await open(page, drawing({ surfaceOpenings: [{ id: 40, hostType: 'floor', hostId: 'f', levelId: 3,
    points: [P(-3, 10), P(-1, 10), P(-1, 14), P(-3, 14)] }] }));
  const { at } = await toFoundation(page);
  await click(page, at, -4, 8);
  await page.mouse.move(...at(0, 8));
  await page.mouse.down();
  await page.mouse.move(...at(-2.96, 8), { steps: 8 });
  expect(JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet'))).toMatchObject({ kind: 'node', at: [-3, 10] });
  await page.mouse.up();
  const d = await saved(page);
  expect(r2(endX(d))).toBe(-3);
});

test('a row pulled in stays in when it is slid across itself; the end on the wall still finds the wall', async ({ page }) => {
  await open(page);
  const { at } = await toFoundation(page);
  await click(page, at, -4, 8);
  await drag(page, at, [0, 8], [-3, 8]);
  await click(page, at, -10, 8);
  await page.locator('#model-move').click();
  await drag(page, at, [-10, 8], [-10, 6]);
  const d = await saved(page);
  expect(d.beams.map(seg)).toEqual([[-20, 6, -8, 6], [-8, 6, -3, 6]]);
});
