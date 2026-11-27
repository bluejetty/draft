// THE 3D VIEW ON THE REAL ESTATE PLAN (jb, 27 Nov 2026: "automatically
// generate one for Real Estate Plans please").
//
// The FRONT 3D VIEW tile is drawn by itself: the sheet opens the 3D viewer
// in a frame (view3d-host.js), asks it for a picture and draws that. A
// double-click opens the live viewer over the tile; DONE keeps the view.
// And the 2D promise still holds: with viewer/ gone, the sheet works and
// the tile says the viewer is not installed.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-timberhouse-jog-fascia.draft'), 'utf8'));

async function openSheet(page, { noViewer = false } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (noViewer) await page.route('**/viewer/**', route => route.fulfill({ status: 404, body: 'not here' }));
  await h.suppressEntryCoach(page);
  await page.goto('/REALESTATEPLAN.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async ({ bucket, saved }) => {
    localStorage.removeItem('draft-realestate-3d');
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: HOUSE });
  await page.setViewportSize({ width: 1360, height: 820 });
  await page.addInitScript(() => {
    window.__ink = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
      window.__ink.push(String(text));
      return orig.call(this, text, x, y);
    };
  });
  await page.goto('/REALESTATEPLAN.html');
  return errors;
}

// The tile's middle, in page pixels, read off the sheet canvas. The tile is
// the last box: bottom right on the default four-seat sheet.
async function tileCentre(page) {
  const box = await page.locator('#sheet').boundingBox();
  return { x: box.x + box.width * 0.71, y: box.y + box.height * 0.69 };
}

// How much of the tile is not white paper: the house drawn there.
async function inkedShare(page) {
  return page.evaluate(() => {
    const cv = document.getElementById('sheet');
    const ctx = cv.getContext('2d');
    const x = Math.round(cv.width * 0.6), y = Math.round(cv.height * 0.55);
    const w = Math.round(cv.width * 0.2), hh = Math.round(cv.height * 0.25);
    const d = ctx.getImageData(x, y, w, hh).data;
    let inked = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) inked += 1;
    return inked / (w * hh);
  });
}

test('the FRONT 3D VIEW tile draws the house by itself', async ({ page }) => {
  const errors = await openSheet(page);
  await page.waitForFunction(() => document.body.dataset.view3d === 'drawn', null, { timeout: 30000 });
  expect(await inkedShare(page), 'the house is on the tile').toBeGreaterThan(0.05);
  const ink = await page.evaluate(() => window.__ink);
  expect(ink).toContain('DOUBLE-CLICK TO TURN');
  expect(ink).not.toContain('3D VIEW — once available');
  // The seat is a real tick now, not a held-open one.
  await expect(page.locator('#seat-list input').last()).toBeEnabled();
  expect(errors).toEqual([]);
});

test('double-click turns the 3D view, and DONE keeps it for the house', async ({ page }) => {
  await openSheet(page);
  await page.waitForFunction(() => document.body.dataset.view3d === 'drawn', null, { timeout: 30000 });
  await expect(page.locator('#view3d-reset')).toBeHidden();
  const at = await tileCentre(page);
  await page.mouse.dblclick(at.x, at.y);
  const frame = page.locator('[data-view3d-frame]');
  await expect(frame).toBeVisible();
  const inside = page.frameLocator('[data-view3d-frame]');
  await expect(inside.locator('#embed-bar')).toBeVisible();
  await inside.locator('[data-preset="back"]').click();
  await inside.locator('#embed-done').click();
  await expect(frame).toBeHidden();
  await expect(page.locator('#view3d-reset')).toBeVisible();
  const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('draft-realestate-3d') || '{}'));
  const cameras = Object.values(kept);
  expect(cameras).toHaveLength(1);
  // BACK is the front's yaw turned 215 degrees; this house's front is E1 to
  // the east (planTurn 3), yaw 90.
  expect(cameras[0].yaw).toBe((90 + 215) % 360);

  // Opened again, the sheet draws the kept view.
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.view3d === 'drawn', null, { timeout: 30000 });
  await expect(page.locator('#view3d-reset')).toBeVisible();

  // RESET goes back to the front-left corner.
  await page.locator('#view3d-reset').click();
  await expect(page.locator('#view3d-reset')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('draft-realestate-3d'))).toBe('{}');
});

test('a click off the live 3D view keeps the view too', async ({ page }) => {
  await openSheet(page);
  await page.waitForFunction(() => document.body.dataset.view3d === 'drawn', null, { timeout: 30000 });
  const at = await tileCentre(page);
  await page.mouse.dblclick(at.x, at.y);
  await expect(page.locator('[data-view3d-frame]')).toBeVisible();
  await page.frameLocator('[data-view3d-frame]').locator('[data-preset="side"]').click();
  await page.mouse.click(300, 400);
  await expect(page.locator('[data-view3d-frame]')).toBeHidden();
  const kept = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('draft-realestate-3d') || '{}')));
  expect(kept).toHaveLength(1);
  expect(kept[0].yaw).toBe((90 + 90) % 360);
});

test('with viewer/ deleted the sheet still works and says so in the tile', async ({ page }) => {
  const errors = await openSheet(page, { noViewer: true });
  await page.waitForFunction(() => (window.__ink || []).includes('3D VIEWER NOT INSTALLED'), null, { timeout: 20000 });
  const ink = await page.evaluate(() => window.__ink);
  expect(ink, 'the plans still drew').toContain('MAIN FL');
  expect(ink).toContain('TOTAL HOUSE');
  expect(errors).toEqual([]);
});
