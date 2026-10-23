// A WALL'S END DRAGS ON THE SHELF, AND THE INSIDE CORNERS SEND CROSS LINES
// (Movie, 22 Oct, on a suite on the shelf): "the length of the walls seems
// to be locked, can we allow the user to select the nodes at the end of the
// line and then change its length by dragging ... i need the int wall to
// line up with that interior corner (the 2 walls shouldn't overlap so i
// would like to trim it to the inside of that 5.5" wall). so i'd like the
// interior corners to have mini-node style magnetic link / cross lines".
//
// On the shelf a selected wall's ends took no grab (cornerAt offered only a
// master's corners there); now they drag as on a floor. While an end is
// dragged, every face corner the end is not joined to sends its cross the
// moment the hand is in line with it, and the line pulls the end onto it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
// A 20 x 15 suite on SHELF 1 (levelId -1), 2x6 walls on their centre lines,
// an interior wall standing short of the top wall's inside face, and a
// second interior wall ending free, its face corners off any face line.
const HALF = 2.75 / 12;
const drawing = () => ({ version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('s1', [0, 0], [20, 0], -1), W('s2', [20, 0], [20, 15], -1), W('s3', [20, 15], [0, 15], -1),
    W('s4', [0, 15], [0, 0], -1), W('int', [10, 12], [10, 3], -1), W('int2', [14, 12], [14, 9], -1)],
  boneyardShelves: [{ id: 1, name: 'SHELF 1' }], nextBoneyardShelfId: 2, activeBoneyardShelfId: 1 });

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?level=3&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openModelRail(page);
  await page.locator('[data-shelf="1"]').click();
  await page.waitForTimeout(300);
  await expect(page.locator('#readout')).toContainText('walls 6/6', { timeout: 5000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return frame(page);
}
// 40 to 90 px to the foot, so a quarter-inch reads as pixels.
async function frame(page) {
  const box = await page.locator('#plan').boundingBox();
  for (let i = 0; i < 14; i += 1) {
    const { scale } = await h.planFrame(page);
    if (scale >= 40 && scale <= 90) break;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, scale > 90 ? 120 : -120);
    await page.waitForTimeout(120);
  }
  return h.planFrame(page);
}
async function press(page, at, x, z) { await page.mouse.click(...at(x, z)); await page.waitForTimeout(80); }
async function saved(page) {
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const rays = async page => JSON.parse(await page.locator('#plan').getAttribute('data-tracking-rays') || 'null');
const r3 = n => Math.round(n * 1000) / 1000;
const r2 = n => Math.round(n * 100) / 100;
async function chipOn(page, sel, on) {
  const chip = page.locator(sel);
  const lit = /\blit\b/.test(await chip.getAttribute('class') || '') || (await chip.getAttribute('aria-pressed')) === 'true';
  if (lit !== on) await chip.click();
}

test('on the shelf a selected wall\'s end drags, and the wall is longer for it', async ({ page }) => {
  const { at } = await open(page);
  await h.armFromRail(page, 'select');
  await press(page, at, 10, 8);
  await page.mouse.move(...at(10, 3));
  await page.mouse.down();
  await page.mouse.move(...at(10, 6), { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  const wall = (await saved(page)).walls.find(w => w.id === 'int');
  expect([r2(wall.start.x), r2(wall.start.z)], 'the far end stayed').toEqual([10, 12]);
  expect(r2(wall.end.x), 'still plumb').toBe(10);
  expect(Math.abs(wall.end.z - 6), 'the near end went where the hand went').toBeLessThan(0.05);
});

test('dragged toward the top wall, the inside corner sends its cross line and the end lands on the inside face', async ({ page }) => {
  const { at } = await open(page);
  await h.armFromRail(page, 'select');
  await press(page, at, 10, 8);
  await page.mouse.move(...at(10, 3));
  await page.mouse.down();
  await page.mouse.move(...at(10, 1.5), { steps: 8 });
  // IN LINE WITH THE INSIDE CORNER of the top and right walls, a hair off its line.
  await page.mouse.move(...at(10, HALF + 0.01), { steps: 8 });
  await page.waitForTimeout(120);
  const r = await rays(page);
  expect(r, 'cross lines while the end is dragged').toBeTruthy();
  expect(r.nodes.map(n => n.map(r2)), 'the inside corner sends its cross').toContainEqual([r2(20 - HALF), r2(HALF)]);
  expect(r.lit.length, 'and its line is lit').toBeGreaterThan(0);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const wall = (await saved(page)).walls.find(w => w.id === 'int');
  expect(r3(wall.end.z), 'trimmed to the inside face of the 5.5" wall').toBe(r3(HALF));
  expect(r2(wall.end.x)).toBe(10);
});

test('with the SNAP light off the cross line alone pulls the end onto a free end\'s corner line', async ({ page }) => {
  const { at } = await open(page);
  await chipOn(page, '[data-mode-snap]', false);
  await h.armFromRail(page, 'select');
  await press(page, at, 10, 8);
  // IN LINE WITH THE SECOND WALL'S FREE-END FACE CORNERS at z = 9, with no
  // face line anywhere near (10, 9): only the corner's cross can pull.
  await page.mouse.move(...at(10, 3));
  await page.mouse.down();
  await page.mouse.move(...at(10, 6), { steps: 8 });
  await page.mouse.move(...at(10, 9.02), { steps: 8 });
  await page.waitForTimeout(120);
  const r = await rays(page);
  expect(r?.nodes.map(n => n.map(r2)), 'the free end\'s face corner sends its cross').toContainEqual([r2(14 - HALF), 9]);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const wall = (await saved(page)).walls.find(w => w.id === 'int');
  expect(r3(wall.end.z), 'on the corner\'s line').toBe(9);
});

test('dropped within an inch of a face it crosses, with every light off, the end connects onto that face; beyond the inch it stays', async ({ page }) => {
  const { at } = await open(page);
  await chipOn(page, '[data-mode-snap]', false);
  await chipOn(page, '[data-mode-track]', false);
  await h.armFromRail(page, 'select');
  await press(page, at, 10, 8);
  // 0.84" short of the inside face: it connects.
  await page.mouse.move(...at(10, 3));
  await page.mouse.down();
  await page.mouse.move(...at(10, HALF + 0.07), { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  let wall = (await saved(page)).walls.find(w => w.id === 'int');
  expect(r3(wall.end.z), 'within the inch: on the face').toBe(r3(HALF));
  // 1.44" short: it stays where it was dropped.
  await press(page, at, 10, 8);
  await page.mouse.move(...at(10, HALF));
  await page.mouse.down();
  await page.mouse.move(...at(10, HALF + 0.12), { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(100);
  wall = (await saved(page)).walls.find(w => w.id === 'int');
  expect(Math.abs(wall.end.z - (HALF + 0.12)), 'beyond the inch: the hand\'s').toBeLessThan(0.02);
});
