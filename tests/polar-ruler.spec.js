// The polar-tracking origin doubles as the ruler zero: while a ray is engaged
// from a rolled-over node, a typed R length measures exactly from that node —
// it can even place a tool's first point before any click, so a new line or
// outline starts a precise distance off an existing corner.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function engagePolarRay(page, nodeX, nodeZ, rayX, rayZ) {
  await h.moveTo(page, nodeX, nodeZ); // roll over the node to acquire it
  await expect(page.locator('[data-model-polar]')).toBeVisible();
  await h.moveTo(page, rayX, rayZ);   // near a 45° ray, engaging it
  await expect(page.locator('[data-model-polar]')).toBeVisible();
}

test('R types a line first point an exact distance from the rolled-over node', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, 0, 0, 5, -5); // away from the 0,0 marker rays

  await h.selectTool(page, 'Line');
  await engagePolarRay(page, 0, 0, 10, 0.2);
  await page.keyboard.press('r');
  await page.waitForTimeout(200);
  await page.keyboard.type("7'");
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  await h.clickWorld(page, 7, 5);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  const added = lines.find(line => h.touchesPoint(line, 7, 5));
  expect(added).toBeTruthy();
  expect(h.touchesPoint(added, 7, 0)).toBe(true); // exactly 7' from the node
});

test('mid-draw, R measures from the acquired node rather than the chain start', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, 0, 0, 5, -5);

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -10, 3); // chain start elsewhere
  await engagePolarRay(page, 0, 0, 10, 0.2);
  await page.keyboard.press('r');
  await page.waitForTimeout(200);
  await page.keyboard.type("6'");
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter'); // finish the chain
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  const added = lines.find(line => h.touchesPoint(line, -10, 3));
  expect(added).toBeTruthy();
  // The endpoint lands 6' along the ray from the node, not 6' from the start.
  expect(h.touchesPoint(added, 6, 0)).toBe(true);
});

test('an outline can start its first point a typed distance off an existing node', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, 0, 0, 5, -5);

  await h.selectTool(page, 'Outline');
  await engagePolarRay(page, 0, 0, 10, 0.2);
  await page.keyboard.press('r');
  await page.waitForTimeout(200);
  await page.keyboard.type("4'");
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);

  await h.clickWorld(page, 12, 0);
  await h.clickWorld(page, 12, 6);
  await h.clickWorld(page, 4, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);
  const master = saved.boneyardOutlines[0];
  expect(master.points).toHaveLength(4);
  expect(master.points.some(p => h.near(p.x, 4) && h.near(p.z, 0))).toBe(true);
  expect(master.points.some(p => h.near(p.x, 12) && h.near(p.z, 6))).toBe(true);
});
