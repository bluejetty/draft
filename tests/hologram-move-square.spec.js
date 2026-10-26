// A MOVED HOLOGRAM READS THE T-SQUARE AND THE FOOT LIGHT.
//
// Movie, 19 Oct: "when i MOVE the hologram --- when the T SQUARE is engaged
// it should only move in 90's from its original position".
//
// MOVE put the thing in hand exactly where the hand went. The T-SQUARE held a
// run being DRAWN to one axis and a corner being DRAGGED to one axis
// (model-html-point-drag-instruments), and said nothing about a hologram:
// the one gesture whose whole point is lining a suite up with the shell was
// the one the instrument did not govern. The FOOT LIGHT had the same hole.
//
// So the drag is a run from the press to the hand, read the way drawPoint
// reads one: squared first, then on the whole foot, no floor on the length.
// "From its original position" is where it stood when the press went down.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const BLANK = {
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
};
const HOUSE = fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-corner-garage.draft'));

async function open(page, drawing = BLANK) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft.trace.on'); } catch { /* fine */ }
    // THE LIGHTS START DARK: the foot light is remembered per browser.
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const chip = page => page.locator('[data-mode-hologram]');
const tsquare = page => page.locator('[data-mode-tsquare]');
const foot = page => page.locator('[data-mode-scale]');
const closeCard = async page => {
  if (await page.locator('#trace-ask').isVisible()) await page.locator('[data-trace-later]').click();
  if (await page.locator('#hologram-ask').isVisible()) await page.locator('[data-hologram-close]').click();
};
const saved = async page => {
  await closeCard(page);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const bringIn = async page => {
  await chip(page).click();
  await page.locator('[data-hologram-ask-upload]').click();
  await page.locator('[data-hologram-file]').setInputFiles(
    { name: 'existing-house.draft', mimeType: 'application/json', buffer: HOUSE });
  await expect.poll(async () => (await saved(page)).holograms?.length || 0).toBe(1);
};
// MOVE, then a drag of (dx, dy) screen pixels from the middle of the plan.
const moveBy = async (page, dx, dy) => {
  if (!await page.locator('#hologram-ask').isVisible()) await chip(page).click();
  await page.locator('[data-hologram-move]').click();
  const box = await page.locator('#plan').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + dx, cy + dy, { steps: 4 });
  await page.mouse.up();
  const holo = (await saved(page)).holograms[0];
  return { x: holo.x, z: holo.z };
};
const whole = n => Math.abs(n - Math.round(n)) < 1e-6;

test('with the T-SQUARE down a MOVE goes along one axis only, from where it stood', async ({ page }) => {
  await open(page);
  await bringIn(page);
  await tsquare(page).click();
  await expect(tsquare(page)).toHaveClass(/lit/);
  // Mostly to the right: straight across, nothing down.
  const first = await moveBy(page, 60, 30);
  expect(first.x).toBeGreaterThan(0.5);
  expect(first.z).toBe(0);
  // Mostly down from THERE: straight down, x kept where the first move left it.
  const second = await moveBy(page, 20, 70);
  expect(second.x).toBe(first.x);
  expect(second.z).toBeGreaterThan(0.5);
});

test('with the T-SQUARE up the same drag goes where the hand went', async ({ page }) => {
  await open(page);
  await bringIn(page);
  await expect(tsquare(page)).not.toHaveClass(/lit/);
  const at = await moveBy(page, 60, 30);
  expect(at.x).toBeGreaterThan(0.5);
  expect(at.z).toBeGreaterThan(0.25);
  expect(Math.abs(at.x / at.z - 2)).toBeLessThan(0.05);
});

test('the FOOT LIGHT lands the move on the whole foot, and TOY squares and rounds both', async ({ page }) => {
  await open(page);
  await bringIn(page);
  await foot(page).click();
  await expect(foot(page)).toHaveClass(/lit/);
  // 60 x 30 px at the opening scale is a run of 11.18 ft: the light makes it 11.
  const lit = await moveBy(page, 60, 30);
  const run = Math.hypot(lit.x, lit.z);
  expect(run).toBeGreaterThan(1.5);
  expect(whole(run), `a run of ${run} ft with the foot light lit`).toBe(true);
  expect(Math.abs(lit.x / lit.z - 2)).toBeLessThan(0.05);
  // TOY: both instruments at once, with no chip lit.
  await open(page, { ...BLANK, board: 'toy' });
  await bringIn(page);
  const toy = await moveBy(page, 60, 30);
  expect(toy.z).toBe(0);
  expect(toy.x).toBeGreaterThan(1.5);
  expect(whole(toy.x), `TOY moved it ${toy.x} ft`).toBe(true);
});
