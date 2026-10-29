// ZOOM AND PAN IN THE WIREFRAME'S FLAT WINDOW.
//
// Movie, 28 Oct: "i'd like to be able to zoome into the 2d wireframe window
// like in model space". The wheel zooms about the cursor, a drag on empty
// floor pans (the right button pans anywhere), and 0 fits again -- MODEL's
// "DRAG TO PAN - WHEEL TO ZOOM - 0 TO FIT".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function boneyardOfBungalow(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator('#dt-tiles [data-build-entry="bungalow"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
}

const frameOf = async page => JSON.parse(await page.locator('#bones2d').getAttribute('data-frame'));
// Where a screen point sits in the drawing, by the frame on the canvas now.
const worldAt = (frame, x, y) => ({ x: (x - frame.ox) / frame.s, z: (y - frame.oy) / frame.s });

test('the wheel zooms the flat window in about the cursor, and out again', async ({ page }) => {
  await boneyardOfBungalow(page);
  const box = await page.locator('#bones2d').boundingBox();
  const before = await frameOf(page);
  const cx = box.width * 0.3, cy = box.height * 0.4;
  const under = worldAt(before, cx, cy);
  await page.mouse.move(box.x + cx, box.y + cy);
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -120);
  const zoomed = await frameOf(page);
  expect(zoomed.s, 'closer').toBeGreaterThan(before.s * 1.4);
  const still = worldAt(zoomed, cx, cy);
  // To the mouse's whole pixel: under an inch.
  expect(Math.abs(still.x - under.x), 'the point under the cursor stays under it').toBeLessThan(1 / 12);
  expect(Math.abs(still.z - under.z)).toBeLessThan(1 / 12);
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 120);
  expect((await frameOf(page)).s, 'and back out').toBeCloseTo(before.s, 6);
});

test('a drag on empty floor pans, the right button pans anywhere, and 0 fits again', async ({ page }) => {
  await boneyardOfBungalow(page);
  const box = await page.locator('#bones2d').boundingBox();
  const fit = await frameOf(page);
  // A corner of the window, well clear of the house.
  const x0 = box.x + 12, y0 = box.y + box.height - 12;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + 40, y0 - 30, { steps: 4 });
  await page.mouse.up();
  let f = await frameOf(page);
  expect(f.ox - fit.ox, 'the plan slid with the drag').toBeCloseTo(40, 0);
  expect(f.oy - fit.oy).toBeCloseTo(-30, 0);
  expect(f.s, 'without zooming').toBeCloseTo(fit.s, 6);
  // The right button, from the middle of the house.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2, { steps: 3 });
  await page.mouse.up({ button: 'right' });
  f = await frameOf(page);
  expect(f.ox - fit.ox).toBeCloseTo(65, 0);
  await page.mouse.wheel(0, -240);
  await page.keyboard.press('0');
  f = await frameOf(page);
  expect(f, '0 puts the whole level back in the window').toEqual(fit);
});

test('zoomed in, an edge is still picked where it is drawn', async ({ page }) => {
  await boneyardOfBungalow(page);
  await page.locator('[data-bone-level="FOUNDATION"]').click();
  const box = await page.locator('#bones2d').boundingBox();
  // Zoom on the house's back wall (z = -20, x = 0), so it stays in view.
  const fit = await frameOf(page);
  await page.mouse.move(box.x + fit.ox, box.y + fit.oy - 20 * fit.s);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -120);
  const f = await frameOf(page);
  expect(f.s, 'zoomed in').toBeGreaterThan(fit.s * 1.5);
  const at = [box.x + f.ox, box.y + f.oy - 20 * f.s];
  await page.mouse.click(...at);
  await expect(page.locator('#bones2d')).not.toHaveAttribute('data-selected', '');
  await expect(page.locator('#bones2d')).toHaveAttribute('data-side-lengths', '[40,40]');
});
