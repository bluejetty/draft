// A DIMENSION THAT DRIVES: one selected, a length typed, and the drawing
// moves to make it so.
//
// Movie, 20 Oct: "if i click on that dimension and the type in 9-5 1/2" into
// the dimension instead, it would stetch the wall to that size after i press
// enter ... and the other walls would adust accordingly to allow the change
// --- in this one i have the door and its 2 sidewalls as an ASSEMBLY so it
// shouldn't stretch but the other 'LONE" line at the north / top side should
// stretch because it isn't in an ASSEMBLY" -- "i'd like to do this for the
// windows and door dimensions too" -- and a value that can't be met changes
// nothing and says why on the strip ("4 solves the problem without a popup").
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const W = (id, a, b) => ({ id, start: P(...a), end: P(...b), levelId: 3, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
// A HAND DIMENSION, laid where its string stands.
const D = (id, a, b) => ({ id, start: P(...a), end: P(...b), levelId: 3, view: 'plan',
  layer: 'A-DIMS-HAND', auto: false });
const drawing = extra => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, f, url = '/MODEL.html') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
// Pick the dimension by its drawn line -- the painter stands it a little off
// the record's two points -- then type the length straight in.
async function drive(page, at, x, z, typed) {
  // How far it stands off is a screen distance, so it is found, not assumed.
  let off = null;
  for (const dz of [0.25, 0.5, 0.75, 1, 1.25, 1.5, -0.25, -0.5, -0.75, -1]) {
    await page.mouse.move(...at(x, z + dz));
    await page.waitForTimeout(40);
    if (/DIM/.test(await page.locator('#hover-name').textContent())) { off = dz; break; }
  }
  expect(off, 'the dimension is under the cursor somewhere beside its points').not.toBeNull();
  await page.mouse.click(...at(x, z + off));
  await page.waitForTimeout(120);

  await expect(page.locator('#frozen-length'), 'the box reads the dimension').toBeEnabled();
  await page.keyboard.type(typed);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}
const wall = (d, id) => d.walls.find(w => w.id === id);

test('a lone wall moves to make the dimension so, and the far end is the one that goes', async ({ page }) => {
  const { at } = await open(page, drawing({
    walls: [W('w', [-10, -10], [-10, 10]), W('x', [2, -10], [2, 10])],
    dimensions: [D(41, [-10, 5], [2, 5])],
  }));
  await drive(page, at, -4, 5, '13');
  await expect(page.locator('#strip-message')).toContainText("13'-0\"");
  let d = await saved(page);
  expect(wall(d, 'x').start.x, 'the far wall went a foot').toBeCloseTo(3, 6);
  expect(wall(d, 'x').end.x).toBeCloseTo(3, 6);
  expect(wall(d, 'w').start.x, 'the near one stayed').toBeCloseTo(-10, 6);
  expect(d.dimensions[0].end.x, 'and the dimension reads it').toBeCloseTo(3, 6);
  await page.keyboard.press('Control+z');
  d = await saved(page);
  expect(wall(d, 'x').start.x, 'one UNDO').toBeCloseTo(2, 6);
  expect(d.dimensions[0].end.x).toBeCloseTo(2, 6);
});

test('an ASSEMBLY moves whole and the LONE walls beside it stretch; the overall stays', async ({ page }) => {
  // A run along x: a lone wall, the assembly (a wall with its door), and a
  // lone wall again, end to end.
  const { at } = await open(page, drawing({
    walls: [W('l1', [-10, 0], [-2, 0]), W('g', [-2, 0], [2, 0]), W('l2', [2, 0], [10, 0])],
    fenestrations: [{ id: 'door-1', wallId: 'g', levelId: 3, view: 'plan', type: 'door',
      offset: 2, width: 3, sillHeight: 0, headHeight: 6 + 8 / 12 }],
    groups: [{ id: 'group-1', name: 'DOOR WALL', fixed: true, stretchBehavior: 'rigid',
      members: [{ type: 'wall', id: 'g' }, { type: 'fenestration', id: 'door-1' }] }],
    dimensions: [D(41, [-10, 3], [-2, 3])],
  }));
  await drive(page, at, -6, 3, '9');
  await expect(page.locator('#strip-message')).toContainText('assembly');
  const d = await saved(page);
  expect([wall(d, 'g').start.x, wall(d, 'g').end.x], 'the assembly a foot along, its length kept').toEqual([-1, 3]);
  expect(wall(d, 'l1').end.x, 'the lone wall before it stretched').toBeCloseTo(-1, 6);
  expect(wall(d, 'l2').start.x, 'the lone wall after it gave the foot up').toBeCloseTo(3, 6);
  expect([wall(d, 'l1').start.x, wall(d, 'l2').end.x], 'the overall stayed').toEqual([-10, 10]);
  expect(d.fenestrations[0].offset, 'the door rode with its wall').toBeCloseTo(2, 6);
});

test('a door slides along its wall to the typed distance', async ({ page }) => {
  const { at } = await open(page, drawing({
    walls: [W('w', [-10, 0], [10, 0])],
    fenestrations: [{ id: 'door-1', wallId: 'w', levelId: 3, view: 'plan', type: 'door',
      offset: 10, width: 3, sillHeight: 0, headHeight: 6 + 8 / 12 }],
    dimensions: [D(41, [-10, 3], [0, 3])],
  }));
  await drive(page, at, -5, 3, '12-6');
  await expect(page.locator('#strip-message')).toContainText('door slid');
  const d = await saved(page);
  expect(d.fenestrations[0].offset, "its dot 12'-6\" from the wall's end").toBeCloseTo(12.5, 6);
  expect(wall(d, 'w').start.x, 'the wall itself stayed').toBeCloseTo(-10, 6);
});

test('a value that can\'t be met changes nothing, and the strip says why', async ({ page }) => {
  const { at } = await open(page, drawing({
    walls: [W('w', [-10, 0], [10, 0])],
    fenestrations: [{ id: 'door-1', wallId: 'w', levelId: 3, view: 'plan', type: 'door',
      offset: 10, width: 3, sillHeight: 0, headHeight: 6 + 8 / 12 }],
    dimensions: [D(41, [-10, 3], [0, 3])],
  }));
  await drive(page, at, -5, 3, '25');
  await expect(page.locator('#strip-message')).toContainText('Nothing changed');
  const d = await saved(page);
  expect(d.fenestrations[0].offset, 'the door where it was').toBeCloseTo(10, 6);
  expect(d.dimensions[0].end.x, 'and the dimension too').toBeCloseTo(0, 6);
});

// AND ON AN AUTO STRING, which is where he found it: the segment from the
// west wall to the door's dot, typed longer, slides the door; the strings are
// laid again for where it now is.
test('an AUTO string to a door, typed longer, slides the door and the strings follow', async ({ page }) => {
  const S = (id, a, b) => W(id, a, b);
  const { at } = await open(page, drawing({
    walls: [S('n', [-10, -10], [10, -10]), S('e', [10, -10], [10, 10]), S('s', [10, 10], [-10, 10]), S('w', [-10, 10], [-10, -10])],
    fenestrations: [{ id: 'door-1', wallId: 'n', levelId: 3, view: 'plan', type: 'door',
      offset: 10, width: 3, sillHeight: 0, headHeight: 6 + 8 / 12 }],
  }), '/MODEL.html?left=1');
  await h.selectTool(page, 'Dimension');
  await page.locator('[data-auto-dims]').click();
  await page.waitForTimeout(200);
  await h.armFromRail(page, 'select');
  const before = await saved(page);
  // The north string's piece that ends on the door's dot, from the west.
  const piece = before.dimensions.find(d => d.auto && Math.abs(d.start.z - d.end.z) < 1e-6 && d.start.z < -10
    && [d.start.x, d.end.x].some(x => Math.abs(x) < 0.01) && Math.min(d.start.x, d.end.x) < -9);
  expect(piece, 'AUTO DIMS strung the door from the west').toBeTruthy();
  const was = Math.abs(piece.end.x - piece.start.x);
  const mid = (piece.start.x + piece.end.x) / 2;
  await page.keyboard.press('0');
  await page.waitForTimeout(150);
  const f = await h.planFrame(page);
  await drive(page, f.at, mid, piece.start.z, '12');
  await expect(page.locator('#strip-message')).toContainText('door slid');
  const d = await saved(page);
  expect(d.fenestrations[0].offset - 10, 'the door went the difference').toBeCloseTo(12 - was, 6);
  expect(d.dimensions.some(x => x.auto && [x.start.x, x.end.x].some(v => Math.abs(v - (12 - was)) < 0.01)),
    'and a string reads it where it now is').toBe(true);
});
