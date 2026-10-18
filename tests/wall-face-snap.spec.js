// THE CORNERS OF A WALL'S FACES SNAP (Movie, 18 Oct).
//
// "can i make the EXT WALL corner nodes (on the outline wall lines) ... so i
// can reference that edge of wall when i draw or change things". A wall's
// own nodes are its centre line's ends; the faces' corners -- outside and
// inside, where walls meet, and a free end's two -- now take a press too, on
// the wall's own floor and, on ROOF PLAN, on the wall tops drawn there.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId = 3) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center' });
const HALF = 2.75 / 12;
const drawing = (walls, levels = [{ id: 3, name: 'MAIN FL', elev: 0 }]) => ({
  version: 1, board: 'drafting', levels, activeLevelIdx: 0, nextDrawingItemId: 50,
  walls, lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page, f, url = '/MODEL.html') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(url);
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
const r3 = n => Math.round(n * 1000) / 1000;

test('a LINE started a hair off the outside corner of two 2x6 walls starts ON it', async ({ page }) => {
  // An L: along x, then down +z; the outside corner is up and right.
  await open(page, drawing([W('w1', [0, 0], [10, 0]), W('w2', [10, 0], [10, 8])]));
  const { at } = await frame(page);
  await armLine(page);
  await press(page, at, [10 + HALF + 0.02, -HALF - 0.02]);
  await press(page, at, [12, -1.5]);
  const [line] = (await saved(page)).lines;
  expect([r3(line.start.x), r3(line.start.z)]).toEqual([r3(10 + HALF), r3(-HALF)]);
});

test('and the inside corner, and a free end\'s face', async ({ page }) => {
  await open(page, drawing([W('w1', [0, 0], [10, 0]), W('w2', [10, 0], [10, 8])]));
  const { at } = await frame(page);
  await armLine(page);
  await press(page, at, [10 - HALF - 0.02, HALF + 0.02]);
  await press(page, at, [6, 4]);
  await page.keyboard.press('Escape');
  // TRACK off, so the free end's face point is reached by the snap alone and
  // not by two cross lines that happen to meet there.
  await page.locator('[data-mode-track]').click();
  await expect(page.locator('[data-mode-track]')).toHaveAttribute('aria-pressed', 'false');
  await armLine(page);
  // The free end of w1 at x = 0: its face at z = -2 3/4".
  await press(page, at, [0.02, -HALF - 0.02]);
  await press(page, at, [-3, -2]);
  const lines = (await saved(page)).lines.map(l => [r3(l.start.x), r3(l.start.z)]);
  expect(lines).toContainEqual([r3(10 - HALF), r3(HALF)]);
  expect(lines).toContainEqual([0, r3(-HALF)]);
});

test('on ROOF PLAN, the outside corner of the wall tops drawn there', async ({ page }) => {
  const f = drawing([W('a', [0, 0], [20, 0]), W('b', [20, 0], [20, 12]), W('c', [20, 12], [0, 12]), W('d', [0, 12], [0, 0])],
    [{ id: 7, name: 'ROOF', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }]);
  await open(page, f, '/MODEL.html?level=7');
  const { at } = await frame(page);
  await armLine(page);
  await press(page, at, [-HALF - 0.02, -HALF - 0.02]);
  await press(page, at, [-4, -3]);
  const [line] = (await saved(page)).lines;
  expect([r3(line.start.x), r3(line.start.z)]).toEqual([r3(-HALF), r3(-HALF)]);
});
