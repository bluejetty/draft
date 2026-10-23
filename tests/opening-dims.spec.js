// A DOOR'S OR WINDOW'S MIDDLE DOT TAKES A DIMENSION, AND THE STRINGS FOLLOW
// THE OPENING LIVE.
//
// Movie, 20 Oct: "when i dimension the fenstrations, can you make that round
// dot in the middle SNAPABLE point ORANGE for the dimensions to link onto and
// if i move that can the dimension move with it. it would be really nice to
// autoupdate those fenstration dimensions immediately if possible (so the
// user can see what they move the opening too in REAL time" -- "easier for
// designing".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const MAIN_FL = 3;
// A plain square house, 20 ft walls, the same as model-html-fenestration's.
const base = () => ({
  version: 1,
  levels: [{ id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  board: 'drafting',
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: MAIN_FL, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], dimensions: [],
  // THE DOOR, IN THE MIDDLE OF THE NORTH WALL: its offset is its centre's
  // distance from the wall's start.
  fenestrations: [{ id: 'door-1', wallId: 'n', levelId: MAIN_FL, view: 'plan', type: 'door',
    offset: 10, width: 3, sillHeight: 0, headHeight: 6 + 8 / 12 }],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base() });
  await page.goto('/MODEL.html?left=1');
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
const click = async (page, at, x, z) => { await page.mouse.click(...at(x, z)); await page.waitForTimeout(120); };
// What the painter writes, caught at fillText through one full repaint.
const painted = page => page.evaluate(() => new Promise(resolve => {
  const said = [];
  const real = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) { said.push(String(text)); return real.call(this, text, ...rest); };
  window.dispatchEvent(new Event('resize'));
  setTimeout(() => { CanvasRenderingContext2D.prototype.fillText = real; resolve(said); }, 300);
}));
const door = d => d.fenestrations.find(f => f.id === 'door-1');

test('a dimension put on the door\'s dot is linked to it, and follows the door when it is slid', async ({ page }) => {
  const { at } = await open(page);
  await h.armFromRail(page, 'dimension');
  // From the west wall's corner to the door's dot, a HORIZ string, stood
  // four feet inside the wall.
  await click(page, at, -10, -10);
  await click(page, at, 0.15, -10.1);
  await page.keyboard.press('Enter'); // once ends the points (Movie, 23 Oct)
  await click(page, at, -3, -6);
  let d = await saved(page);
  const [dim] = d.dimensions;
  const refs = [dim.startRef, dim.endRef].filter(Boolean);
  expect(refs.map(r => r.openingId), 'one end is on the door').toContain('door-1');
  const onDoor = dim.startRef?.openingId === 'door-1' ? 'start' : 'end';
  expect(dim[onDoor].x, 'on the dot itself').toBeCloseTo(0, 6);

  // The door slid five feet east, the SELECT tool's two-step: press it, then
  // press it again and drag.
  await h.armFromRail(page, 'select');
  await click(page, at, 0, -10);
  await page.mouse.move(...at(0, -10));
  await page.mouse.down();
  await page.mouse.move(...at(2.5, -10), { steps: 4 });
  await page.mouse.move(...at(5, -10), { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(door(d).offset, 'the door went five feet').toBeCloseTo(15, 1);
  expect(d.dimensions[0][onDoor].x, 'and the dimension\'s end with it').toBeCloseTo(door(d).offset - 10, 6);

  // KEPT ON RELOAD: the link is in the file, and still follows.
  // Read back through the loader, and written again from what it kept.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(150);
  const f2 = await h.planFrame(page);
  await click(page, f2.at, 0, 0);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  d = await saved(page);
  expect([d.dimensions[0].startRef, d.dimensions[0].endRef].some(r => r?.openingId === 'door-1')).toBe(true);
});

test('with AUTO DIMS on the plan, the strings follow the door while it is being slid, and one UNDO puts them back', async ({ page }) => {
  const { at } = await open(page);
  await h.selectTool(page, 'Dimension');
  await page.locator('[data-auto-dims]').click();
  await page.waitForTimeout(200);
  const before = (await saved(page)).dimensions.filter(x => x.auto).map(x => [x.start, x.end]);
  expect(before.length, 'the plan is strung').toBeGreaterThan(0);
  await h.armFromRail(page, 'select');
  await click(page, at, 0, -10);
  // MID-DRAG: the button is still down, and the strings already read the
  // door where the hand has it -- 15 ft from one end, 5 from the other.
  await page.mouse.move(...at(0, -10));
  await page.mouse.down();
  await page.mouse.move(...at(2.5, -10), { steps: 4 });
  await page.mouse.move(...at(5, -10), { steps: 4 });
  const live = await painted(page);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const labels = live.join(' | ');
  // TWICE: the opening's own pair follows it as it is drawn, and the auto
  // string beside it is the one asked again on every move.
  expect((labels.match(/15'-0"/g) || []).length, 'the strings read the door where the hand has it, before the release').toBe(2);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  const undone = await saved(page);
  expect(door(undone).offset, 'one UNDO, the door back').toBeCloseTo(10, 6);
  expect(undone.dimensions.filter(x => x.auto).map(x => [x.start, x.end]), 'and the strings as they were').toEqual(before);
});
