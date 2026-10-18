// THE PROTRACTOR TURNS IN STEPS, THE ANGLE WORD LOCKS, ONE LIT AT A TIME.
//
// Movie, 17 Oct: "the PROTRACTOR - isn't working properly. it should act
// similar to the T excep in addition to 90 degree directions, go in at 45
// degree directions, and it should be clickable and can change it to 30
// degree increments, or back to 45. if you click the protractor it will be
// locked to either 45 or 30 increments (like the T bar, but the T is only
// 90's if they click the Protractor the T turns off. if they click ANGLE it
// uses the ANGLE textbox and the typed angle is used the ANGLE word is lit up
// and glow around the text box". And before: "if they enter and ANGLE eg 33 -
// it should take them that angle with their line and lock it at that angle
// unless they enter a new angle or retouch the T or the PROTRACTOR" -- "or if
// they go back to angle text box and delete the number it will go back to
// swinigng free".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 20,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
// AT A KNOWN ZOOM, 40 to 90 px a foot, so every press is on the open sheet.
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
async function armWall(page) {
  await page.evaluate(() => document.activeElement?.blur?.());
  const key = page.locator('[data-tool-key="wall"]');
  if (await key.getAttribute('aria-pressed') !== 'true') await page.keyboard.press('w');
  await expect(key).toHaveAttribute('aria-pressed', 'true');
}
// The one wall drawn, as the bearing it runs on from its start, in degrees
// counter-clockwise from east (z runs south on the sheet).
async function bearing(page) {
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  expect(d.walls).toHaveLength(1);
  const w = d.walls[0];
  return Math.atan2(-(w.end.z - w.start.z), w.end.x - w.start.x) * 180 / Math.PI;
}
const lit = (page, sel) => expect(page.locator(sel)).toHaveClass(/\blit\b/);
const dark = (page, sel) => expect(page.locator(sel)).not.toHaveClass(/\blit\b/);

test('lit, the PROTRACTOR turns the run in 45s: an aim at 41 degrees lands on 45', async ({ page }) => {
  await open(page);
  const { at } = await frame(page);
  await page.locator('[data-mode-protractor]').click();
  await armWall(page);
  await press(page, at, [0, 0]);
  await press(page, at, [4, -3.5]);
  expect(await bearing(page)).toBeCloseTo(45, 6);
});

test('its step button turns it to 30s and lights it; 45 again on the next press', async ({ page }) => {
  await open(page);
  const { at } = await frame(page);
  const step = page.locator('[data-protractor-step]');
  await expect(step).toHaveText('45°');
  await step.click();
  await expect(step).toHaveText('30°');
  await lit(page, '[data-mode-protractor]');
  await armWall(page);
  await press(page, at, [0, 0]);
  // 34 degrees: a 30 step, not the 45 a 45 protractor would take.
  await press(page, at, [4, -2.7]);
  expect(await bearing(page)).toBeCloseTo(30, 6);
  await step.click();
  await expect(step).toHaveText('45°');
});

test('one lit at a time: the PROTRACTOR puts the T out, the T puts the PROTRACTOR out', async ({ page }) => {
  await open(page);
  await page.locator('[data-mode-tsquare]').click();
  await lit(page, '[data-mode-tsquare]');
  await page.locator('[data-mode-protractor]').click();
  await lit(page, '[data-mode-protractor]');
  await dark(page, '[data-mode-tsquare]');
  await page.locator('[data-mode-tsquare]').click();
  await dark(page, '[data-mode-protractor]');
});

test('a typed ANGLE locks at once: the word lights, the box glows, the run holds 33', async ({ page }) => {
  await open(page);
  const { at } = await frame(page);
  await page.locator('[data-mode-protractor]').click();
  await armWall(page);
  await press(page, at, [0, 0]);
  await page.locator('#frozen-angle').fill('33');
  await page.locator('#frozen-angle').press('Enter');
  await lit(page, '[data-angle-word]');
  await expect(page.locator('#frozen-angle')).toHaveClass(/\blocked\b/);
  await dark(page, '[data-mode-protractor]');
  await press(page, at, [4, -1]);
  expect(await bearing(page)).toBeCloseTo(33, 6);
});

test('the T puts the ANGLE out, and the ANGLE word lights it again on the kept number', async ({ page }) => {
  await open(page);
  const { at } = await frame(page);
  await armWall(page);
  await page.locator('#frozen-angle').fill('120');
  await page.locator('#frozen-angle').press('Enter');
  await page.locator('[data-mode-tsquare]').click();
  await dark(page, '[data-angle-word]');
  await expect(page.locator('#frozen-angle')).not.toHaveClass(/\blocked\b/);
  await page.locator('[data-angle-word]').click();
  await lit(page, '[data-angle-word]');
  await dark(page, '[data-mode-tsquare]');
  await armWall(page);
  await press(page, at, [0, 0]);
  await press(page, at, [-2, -4]);
  expect(await bearing(page)).toBeCloseTo(120, 6);
});

test('deleting the number frees the run: the ANGLE goes dark and the press lands where it is', async ({ page }) => {
  await open(page);
  const { at } = await frame(page);
  await armWall(page);
  await page.locator('#frozen-angle').fill('33');
  await page.locator('#frozen-angle').press('Enter');
  await lit(page, '[data-angle-word]');
  await page.locator('#frozen-angle').fill('');
  await dark(page, '[data-angle-word]');
  await armWall(page);
  await press(page, at, [0, 0]);
  await press(page, at, [4.3, -1.9]);
  expect(await bearing(page)).toBeCloseTo(Math.atan2(1.9, 4.3) * 180 / Math.PI, 0);
});
