// SNAP AND TRACK, THE BULLSEYE, NO DRAG-TO-DRAW ON A MOUSE, AND ENTER.
//
// Movie, 17 Oct: "when i draw a LINE or a WALL, see those nodes where the
// wall ends, i'd like them to light up glow orange when the mouse scrolls over
// and if the user clicks NEARBY those within an 4" dia 2" radius lets try make
// the point go righton the other node" -- "i want to be able to 'snap' on the
// cross lines yes so i can easily connect back to a node perpendicular" --
// "make those 2 features that we can turn on and off in the Instrument
// pannel ... have them ON default yes". The bullseye: "when the user mouses
// over the TARGET when the screen is clear (nothing on it) snap that node to
// within 2.5ft radius of that point. (only when nothing is around". And: "there
// is a click drag drop function for drawing a wall --- ITS NOT GOOD ... not on
// PC or Linux", "to place the walls the click choose direction and length and
// then click again or ENTER".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center' });
const drawing = (walls = []) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 20,
  walls, lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
// AT A KNOWN ZOOM, 40 to 90 px a foot. The page fits one wall so its far end
// sits under the view rail, where the canvas never sees the pointer, and fits
// an empty sheet so far out that six pixels -- the snap's reach -- is more than
// a foot. So the wheel brings it into range either way.
async function frame(page) {
  const box = await page.locator('#plan').boundingBox();
  for (let i = 0; i < 12; i++) {
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
// THE W KEY: the helper's button search finds CUT first on this page. The
// key toggles, so it is pressed only when WALL is not already in hand.
async function armWall(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const key = page.locator('[data-tool-key="wall"]');
  if (await key.getAttribute('aria-pressed') !== 'true') await page.keyboard.press('w');
  await expect(key).toHaveAttribute('aria-pressed', 'true');
}
const newWalls = d => (d.walls || []).filter(w => w.id !== 'wall-1');
const ONE = [W('wall-1', [0, 0], [10, 0])];

test('SNAP and TRACK stand in the instrument strip, lit by default', async ({ page }) => {
  await open(page, drawing(ONE));
  await expect(page.locator('[data-mode-snap]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-mode-track]')).toHaveAttribute('aria-pressed', 'true');
});

test('SNAP: a press near a wall end lands exactly on it, and the orange donut marks it first', async ({ page }) => {
  await open(page, drawing(ONE));
  const { at } = await frame(page);
  await armWall(page);
  await page.mouse.move(...at(10.1, 0.1));
  await page.waitForTimeout(80);
  expect(JSON.parse(await page.locator('#plan').getAttribute('data-snap-node'))).toEqual([10, 0]);
  await press(page, at, [10.1, 0.1]);
  await press(page, at, [10.1, 3]);
  const [made] = newWalls(await saved(page));
  expect([made.start.x, made.start.z]).toEqual([10, 0]);
});

test('TRACK: a press near the line square to a node lands on it', async ({ page }) => {
  await open(page, drawing(ONE));
  const { at } = await frame(page);
  await armWall(page);
  await press(page, at, [6, 2.5]);
  // A hair off plumb above the wall's end at x = 10: it lands plumb.
  await press(page, at, [10.03, -3]);
  const [made] = newWalls(await saved(page));
  expect(made.end.x).toBe(10);
});

test('switched off, they leave the press where it was', async ({ page }) => {
  await open(page, drawing(ONE));
  const { at } = await frame(page);
  await page.locator('[data-mode-snap]').click();
  await page.locator('[data-mode-track]').click();
  await expect(page.locator('[data-mode-snap]')).toHaveAttribute('aria-pressed', 'false');
  await armWall(page);
  await press(page, at, [10.1, 0.1]);
  // A hair off plumb below the wall's end, which TRACK would take to x = 10.
  await press(page, at, [10.03, 3]);
  const [made] = newWalls(await saved(page));
  expect(made.start.x).not.toBe(10);
  expect(Math.abs(made.start.x - 10.1)).toBeLessThan(0.1);
  expect(made.end.x, 'no plumb line pulled it').not.toBe(10);
});

test('the bullseye pulls the first point from 2.5 ft on an empty drawing, and not once there is a wall', async ({ page }) => {
  await open(page, drawing());
  const { at } = await frame(page);
  await armWall(page);
  await press(page, at, [1.5, -1.2]);
  await press(page, at, [8, -1.2]);
  let d = await saved(page);
  expect([d.walls[0].start.x, d.walls[0].start.z], 'on the bullseye').toEqual([0, 0]);
  // Now there is a wall: a press two feet off the bullseye is free.
  await armWall(page);
  await press(page, at, [1.2, -1.6]);
  await press(page, at, [6.3, -3.1]);
  d = await saved(page);
  expect(d.walls).toHaveLength(2);
  const second = d.walls[d.walls.length - 1];
  expect(Math.abs(second.start.x - 1.2)).toBeLessThan(0.1);
  expect(Math.abs(second.start.z + 1.6)).toBeLessThan(0.1);
});

test('a mouse press-drag-release places no wall; click, choose, click does', async ({ page }) => {
  await open(page, drawing());
  const { at } = await frame(page);
  await armWall(page);
  await page.mouse.move(...at(-3, 1.5));
  await page.mouse.down();
  await page.mouse.move(...at(3, 1.5), { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(80);
  await expect(page.locator('#strip-message')).not.toContainText('placed');
  // The release placed nothing: the run is still in hand from the press, and
  // the next click ends the one wall there.
  await press(page, at, [1, -1]);
  const d = await saved(page);
  expect(d.walls, 'one wall, from the click to the click').toHaveLength(1);
  expect(Math.abs(d.walls[0].end.x - 1)).toBeLessThan(0.1);
  expect(Math.abs(d.walls[0].end.z + 1)).toBeLessThan(0.1);
});

test('ENTER places the point the cursor shows, as a click would', async ({ page }) => {
  await open(page, drawing());
  const { at } = await frame(page);
  await armWall(page);
  await press(page, at, [-3, 1.5]);
  await page.mouse.move(...at(4, 1.5));
  await page.waitForTimeout(80);
  await page.keyboard.press('Enter');
  const d = await saved(page);
  expect(d.walls).toHaveLength(1);
  expect(Math.abs(d.walls[0].end.x - 4)).toBeLessThan(0.1);
});
