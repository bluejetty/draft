// THE MAGNET: WALL FACES AND FACE CORNERS PULL (Movie, 19 Oct).
//
// "i'm line up the 3.5" node with the inside corner of the 5.5" interior wall.
// can these interior walls be 'attracted' to SNAP to the INTERIOR CORNER and
// also to the INTERIOR WALL LINE (but more pull from the inside/outside
// corners" -- "when i draw a LINE i'd also like these NODES and int lines to
// allow SNAPPING" -- "glow orange at 'magnetic snap nodes' and glow yellow
// green neon for LINE and non node corner magnetic snaps".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, wallType = 'stud_2x6') => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType, refLine: 'center' });
const HALF = 2.75 / 12;
const drawing = walls => ({
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0, nextDrawingItemId: 50,
  walls, lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
const L = [W('w1', [0, 0], [10, 0]), W('w2', [10, 0], [10, 8])];

async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function frame(page) {
  const box = await page.locator('#plan').boundingBox();
  for (let i = 0; i < 14; i++) {
    const { scale } = await h.planFrame(page);
    if (scale >= 40 && scale <= 90) break;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, scale > 90 ? 120 : -120);
    await page.waitForTimeout(120);
  }
  return h.planFrame(page);
}
async function press(page, at, pt) {
  await page.mouse.move(...at(...pt));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(...pt));
  await page.waitForTimeout(60);
}
async function saved(page) {
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
async function armLine(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const key = page.locator('[data-tool-key="line"]');
  if (await key.getAttribute('aria-pressed') !== 'true') await page.keyboard.press('l');
  await expect(key).toHaveAttribute('aria-pressed', 'true');
}
const magnet = async page => JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet') || 'null');
const r3 = n => Math.round(n * 1000) / 1000;

test('a LINE started a hair off an interior wall\'s face starts ON the face, and the face lights neon', async ({ page }) => {
  await open(page, drawing(L));
  const { at } = await frame(page);
  await armLine(page);
  await page.mouse.move(...at(5, HALF + 0.05));
  await page.waitForTimeout(80);
  expect((await magnet(page))?.kind).toBe('face');
  await press(page, at, [5, HALF + 0.05]);
  await press(page, at, [5, 4]);
  const [line] = (await saved(page)).lines;
  expect(r3(line.start.z)).toBe(r3(HALF));
  expect(Math.abs(line.start.x - 5)).toBeLessThan(0.1);
});

// A POINT BEATS A LINE (Movie, 26 Oct, the one snap rule): within the
// corner's 1 1/2" the corner has the hand, though the face is nearer.
test('the inside corner pulls harder than the face: 1.2" along the face still lands on the corner', async ({ page }) => {
  await open(page, drawing(L));
  const { at } = await frame(page);
  await armLine(page);
  const off = 1.2 / 12;
  const pt = [10 - HALF - off, HALF + 0.01];
  await page.mouse.move(...at(...pt));
  await page.waitForTimeout(80);
  expect((await magnet(page))?.kind, 'a face corner, not a node').toBe('corner');
  await press(page, at, pt);
  await press(page, at, [6, 4]);
  const [line] = (await saved(page)).lines;
  expect([r3(line.start.x), r3(line.start.z)]).toEqual([r3(10 - HALF), r3(HALF)]);
});

test('a wall\'s own end is a node: it glows orange, not neon', async ({ page }) => {
  await open(page, drawing(L));
  const { at } = await frame(page);
  await armLine(page);
  await page.mouse.move(...at(0.03, 0.03));
  await page.waitForTimeout(80);
  expect(await magnet(page)).toEqual({ kind: 'node', at: [0, 0] });
});

test('a 2x4\'s node dragged near the 2x6\'s face lands on it', async ({ page }) => {
  // The 2x6 runs up x = 0; the 2x4 stands free to its right.
  await open(page, drawing([W('w1', [0, 0], [0, 10]), W('w3', [4, 5], [8, 5], 'stud_2x4')]));
  const { at } = await frame(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await press(page, at, [6, 5]);
  await page.mouse.move(...at(4, 5));
  await page.mouse.down();
  await page.mouse.move(...at(HALF + 0.04, 5), { steps: 8 });
  await page.waitForTimeout(60);
  expect((await magnet(page))?.kind).toBe('face');
  await page.mouse.up();
  await page.waitForTimeout(100);
  const w3 = (await saved(page)).walls.find(w => w.id === 'w3');
  expect([r3(w3.start.x), r3(w3.start.z)]).toEqual([r3(HALF), 5]);
});
