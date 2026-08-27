// Scratch repro: closing the house rectangle on the first point (bug report).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test('house rectangle closes by clicking the first point (exact click)', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await h.clickWorld(page, -8, -6); // back to first point
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  console.log('EXACT outlines:', JSON.stringify((saved.boneyardOutlines || []).map(o => ({ n: o.points.length, open: o.open }))));
  expect(saved.boneyardOutlines[0].points.length).toBe(4);
});

test('house rectangle closes by clicking NEAR the first point (imprecise click)', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await h.clickWorld(page, -8.2, -6.15); // near the first point, off both axes
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  console.log('NEAR outlines:', JSON.stringify((saved.boneyardOutlines || []).map(o => ({ n: o.points.length, open: o.open, pts: o.points.map(p => [p.x, p.z]) }))));
  expect(saved.boneyardOutlines[0].points.length).toBe(4);
});

test('HOUSE-button flow: rectangle closes on the first point', async ({ page }) => {
  await h.openModel(page);
  await page.locator('[data-select-house]').click();
  await page.keyboard.press('Enter'); // dismiss Professor Gruff
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await h.clickWorld(page, -8, -6);
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  console.log('BONE outlines:', JSON.stringify((saved.boneyardOutlines || []).map(o => ({ n: o.points.length, open: o.open }))));
  expect(saved.boneyardOutlines[0].points.length).toBe(4);
});
