// SHAPE AND FLOOR CATCH UP WITH WALL AND LINE (Movie, 25 Oct): "i think
// tools stay on rather than go to select" -- and of the gaps WALL and LINE
// have over them, typed lengths and dragging corners: "do the other 2 for
// sure". And the foot's COPY and PASTE on Ctrl+C and Ctrl+V ("can we do CTL-C
// for copy and CTL-P for past"; V, since Ctrl+P is the browser's print).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const box = (p, x0, x1, z0, z1, lv) => [W(`${p}1`, [x0, z0], [x1, z0], lv), W(`${p}2`, [x1, z0], [x1, z1], lv),
  W(`${p}3`, [x1, z1], [x0, z1], lv), W(`${p}4`, [x0, z1], [x0, z0], lv)];
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
// The shed roof spec's house: MAIN FL 30 x 20, the 2ND FL set back 10 ft.
const house = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50, roofPitch: 3,
  walls: [...box('m', 0, 30, 0, 20, 3), ...box('u', 0, 30, 10, 20, 5)],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], fixtures: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
// A bare sheet for the outline, which builds the house.
const bare = () => ({ ...house(), levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0, walls: [] });
async function open(page, level = 5, f = house(), view = null) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(`/MODEL.html?level=${level}&lpane=build&left=1${view ? `&view=${view}` : ''}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const strip = page => page.locator('#strip-message');
async function press(page, at, x, z) { await page.mouse.click(...at(x, z)); await page.waitForTimeout(80); }
async function hover(page, at, x, z) { await page.mouse.move(...at(x, z)); await page.waitForTimeout(120); }
// THE SAME KEY TWICE, QUICKLY: well inside the 450 ms the page allows.
async function twice(page, key) { await page.keyboard.press(key); await page.keyboard.press(key); await page.waitForTimeout(80); }
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const r2 = n => Math.round(n * 100) / 100;
const ring = loop => loop.map(p => [r2(p.x), r2(p.z)]);
const lengthBox = page => page.locator('#frozen-length');

test('FLOOR stays up after it closes: the next presses draw the next floor', async ({ page }) => {
  const { at } = await open(page, 3);
  await h.armFromRail(page, 'floor');
  for (const [x, z] of [[2, 2], [8, 2], [8, 6], [2, 6], [2, 2]]) await press(page, at, x, z);
  await expect(strip(page)).toContainText('Floor drawn');
  for (const [x, z] of [[12, 2], [18, 2], [18, 6], [12, 6], [12, 2]]) await press(page, at, x, z);
  const d = await saved(page);
  expect(d.floors, 'two floors, the tool never put down').toHaveLength(2);
  expect(ring(d.floors[1].points)).toEqual([[12, 2], [18, 2], [18, 6], [12, 6]]);
});

test('SHAPE stays up after it closes, selected for its PROPERTIES, and the next presses draw the next shape', async ({ page }) => {
  const { at } = await open(page, 3);
  await h.armFromRail(page, 'shape');
  for (const [x, z] of [[2, 2], [8, 2], [8, 6], [2, 6], [2, 2]]) await press(page, at, x, z);
  await expect(strip(page)).toContainText('SHAPE closed');
  await expect(page.locator('#props-slot [data-prop-span]')).toHaveText(/AREA 24 SQ FT/);
  for (const [x, z] of [[12, 2], [18, 2], [18, 6], [12, 6], [12, 2]]) await press(page, at, x, z);
  expect((await saved(page)).shapes).toHaveLength(2);
});

// THE TOOL STAYING UP MUST NOT TURN A DOUBLE-CLICK INTO A NEW LOOP: a double on
// the first corner closes on its first click, and its second click is no
// first corner of the next shape.
test('a double-click on a SHAPE\'s first corner closes it, and starts no next shape there', async ({ page }) => {
  const { at } = await open(page, 3);
  await h.armFromRail(page, 'shape');
  for (const [x, z] of [[2, 2], [8, 2], [8, 6], [2, 6]]) await press(page, at, x, z);
  await page.mouse.dblclick(...at(2, 2));
  await page.waitForTimeout(600);
  for (const [x, z] of [[12, 2], [18, 2], [18, 6], [12, 6], [12, 2]]) await press(page, at, x, z);
  const d = await saved(page);
  expect(d.shapes).toHaveLength(2);
  expect(ring(d.shapes[1].points), 'the next shape has no stray first corner at (2, 2)')
    .toEqual([[12, 2], [18, 2], [18, 6], [12, 6]]);
});

for (const tool of ['floor', 'shape']) {
  test(`a ${tool.toUpperCase()}'s next corner takes a typed length, exactly, along the way the cursor points`, async ({ page }) => {
    const { at } = await open(page, 3);
    await h.armFromRail(page, tool);
    await press(page, at, 2, 2);
    await hover(page, at, 9, 2);
    await expect(lengthBox(page)).toBeEnabled();
    await lengthBox(page).fill("12'6");
    await lengthBox(page).press('Enter');
    for (const [x, z] of [[14.5, 8], [2, 8], [2, 2]]) await press(page, at, x, z);
    const d = await saved(page);
    const made = tool === 'floor' ? d.floors : d.shapes;
    expect(made).toHaveLength(1);
    expect(ring(made[0].points), "12'-6\" off the first corner, not rounded to 12").toEqual([[2, 2], [14.5, 2], [14.5, 8], [2, 8]]);
  });
}

test('a picked SHAPE\'s corner drags; its edge midpoint grows a corner; UNDO puts the shape back', async ({ page }) => {
  const { at } = await open(page, 3);
  await h.armFromRail(page, 'shape');
  for (const [x, z] of [[2, 2], [8, 2], [8, 6], [2, 6], [2, 2]]) await press(page, at, x, z);
  await page.keyboard.press('s');
  await page.waitForTimeout(80);
  await page.mouse.move(...at(8, 6));
  await page.mouse.down();
  await page.mouse.move(...at(10, 7), { steps: 6 });
  await page.mouse.move(...at(10, 8), { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  await expect(strip(page)).toContainText('The shape is');
  let d = await saved(page);
  expect(ring(d.shapes[0].points)).toEqual([[2, 2], [8, 2], [10, 8], [2, 6]]);
  // THE MIDPOINT OF THE BOTTOM EDGE (2,2)-(8,2) GROWS A CORNER, dragged out.
  await page.mouse.move(...at(5, 2));
  await page.mouse.down();
  await page.mouse.move(...at(5, 0), { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  d = await saved(page);
  expect(ring(d.shapes[0].points)).toEqual([[2, 2], [5, 0], [8, 2], [10, 8], [2, 6]]);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(120);
  d = await saved(page);
  expect(ring(d.shapes[0].points), 'two UNDOs, the shape as drawn').toEqual([[2, 2], [8, 2], [8, 6], [2, 6]]);
});

test('a picked FLOOR\'s corner drags, and stays a plain point', async ({ page }) => {
  // ON ITS OWN LAYER SET, where MAIN FL's floor saves and shows.
  const { at } = await open(page, 3, house(), 'floor');
  await h.armFromRail(page, 'floor');
  for (const [x, z] of [[2, 2], [8, 2], [8, 6], [2, 6], [2, 2]]) await press(page, at, x, z);
  await page.keyboard.press('s');
  await page.waitForTimeout(80);
  // PICKED INSIDE IT.
  await press(page, at, 5, 4);
  await page.mouse.move(...at(8, 6));
  await page.mouse.down();
  await page.mouse.move(...at(11, 9), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  await expect(strip(page)).toContainText('The floor is');
  const d = await saved(page);
  expect(ring(d.floors[0].points)).toEqual([[2, 2], [8, 2], [11, 9], [2, 6]]);
  expect(Object.keys(d.floors[0].points[2]).sort()).toEqual(['x', 'y', 'z']);
});

test('Ctrl+C copies what is picked and Ctrl+V pastes it, as the foot\'s COPY and PASTE do', async ({ page }) => {
  const { at } = await open(page, 3);
  await h.armFromRail(page, 'shape');
  for (const [x, z] of [[2, 2], [8, 2], [8, 6], [2, 6], [2, 2]]) await press(page, at, x, z);
  await page.keyboard.press('s');
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await page.waitForTimeout(120);
  expect((await saved(page)).shapes, 'the copy pasted beside the original').toHaveLength(2);
});

// S TOGGLES (Movie, 25 Oct: "try S to toggle from tool to select"): from a
// tool, S is SELECT; S again brings the tool back.
test('S from WALL is SELECT, and S again brings WALL back up', async ({ page }) => {
  await open(page, 3);
  await h.armFromRail(page, 'wall');
  await expect(page.locator('[data-tool-key="wall"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('s');
  await expect(page.locator('[data-tool-key="wall"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(strip(page)).toContainText('S again goes back to WALL');
  await page.keyboard.press('s');
  await expect(page.locator('[data-tool-key="wall"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(strip(page)).toContainText('WALL — back up');
  // AND ONCE BACK, S IS SELECT AGAIN: the toggle goes round.
  await page.keyboard.press('s');
  await expect(page.locator('[data-tool-key="wall"]')).toHaveAttribute('aria-pressed', 'false');
});
