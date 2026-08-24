// COPY [K]: capture items with a window (or select first), pick a base point,
// then every destination click drops another copy. Placement rides the same
// snaps as drawing — polar rays, typed R lengths, and the angle-lock ladder
// (Ctrl 90° / Shift 45° / Ctrl+Shift 30°).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function dragWindow(page, x1, z1, x2, z2) {
  const a = await h.worldToClient(page, x1, z1);
  const b = await h.worldToClient(page, x2, z2);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2);
  await page.mouse.move(b.x, b.y);
  await page.mouse.up();
  await page.waitForTimeout(300);
}

test('window capture then repeated destination clicks drop a copy each', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, -2, 0);

  await page.keyboard.press('k');
  await page.waitForTimeout(200);
  await dragWindow(page, -10, -2, 0, 2);

  await h.clickWorld(page, -8, 0);   // base on the line's start node
  await h.clickWorld(page, -8, 5);   // first copy: straight down 5'
  await h.clickWorld(page, -8, 10);  // second copy: straight down 10'
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(3);
  const original = lines.find(line => h.touchesPoint(line, -8, 0));
  expect(original).toBeTruthy();
  expect(h.touchesPoint(original, -2, 0)).toBe(true);
  expect(lines.some(line => h.touchesPoint(line, -8, 5) && h.touchesPoint(line, -2, 5))).toBe(true);
  expect(lines.some(line => h.touchesPoint(line, -8, 10) && h.touchesPoint(line, -2, 10))).toBe(true);
});

test('selection-first: window-select then K skips the capture rectangle', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, -2, 0);

  await h.selectTool(page, 'Select');
  await dragWindow(page, -10, -2, 0, 2);
  await page.keyboard.press('k');
  await page.waitForTimeout(200);

  await h.clickWorld(page, -8, 0);   // straight to the base point
  await h.clickWorld(page, -8, 6);
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(2);
  expect(lines.some(line => h.touchesPoint(line, -8, 6) && h.touchesPoint(line, -2, 6))).toBe(true);
});

test('R freezes the copy move so an exact distance can be typed', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, -2, 0);

  await page.keyboard.press('k');
  await page.waitForTimeout(200);
  await dragWindow(page, -10, -2, 0, 2);

  await h.clickWorld(page, -8, 0);   // base on the start node
  await h.moveTo(page, -4, 0);       // aim the move east
  await page.keyboard.press('r');
  await page.waitForTimeout(200);
  await page.keyboard.type("10'");
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(2);
  expect(lines.some(line => h.touchesPoint(line, 2, 0) && h.touchesPoint(line, 8, 0))).toBe(true);
});

test('an assembly copies whole, landing as an independent group', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, 0, -8, 5, -8);
  await drawLine(page, 5, -8, 5, -3);

  await h.selectTool(page, 'Select');
  await dragWindow(page, -2, -10, 7, -1);
  await page.keyboard.press('y');            // ASSEMBLY dialog
  await page.waitForTimeout(300);
  await page.keyboard.press('n');            // not fixed
  await h.waitForSaved(page);

  await page.keyboard.press('k');            // selection seeds the copy set
  await page.waitForTimeout(200);
  await h.clickWorld(page, 0, -8);           // base on the corner node
  await h.clickWorld(page, 0, 2);            // land 10' down
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  const lines = h.allLines(drawing);
  expect(lines).toHaveLength(4);
  expect(lines.some(line => h.touchesPoint(line, 0, 2) && h.touchesPoint(line, 5, 2))).toBe(true);
  expect(lines.some(line => h.touchesPoint(line, 5, 2) && h.touchesPoint(line, 5, 7))).toBe(true);

  expect(drawing.groups).toHaveLength(2);
  const [source, landed] = drawing.groups;
  expect(landed.id).not.toBe(source.id);
  expect(landed.members).toHaveLength(2);
  const sourceIds = new Set(source.members.map(member => member.id));
  landed.members.forEach(member => expect(sourceIds.has(member.id)).toBe(false));
});

test('a door opening rides its copied host wall', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);

  await page.keyboard.press('k');
  await page.waitForTimeout(200);
  await dragWindow(page, -12, -3, 12, 3);
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, -10, 8);
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.walls).toHaveLength(2);
  expect(drawing.fenestrations).toHaveLength(2);
  const [first, second] = drawing.fenestrations;
  expect(second.wallId).not.toBe(first.wallId);
  const wallIds = new Set(drawing.walls.map(wall => wall.id));
  expect(wallIds.has(second.wallId)).toBe(true);
  expect(second.offset).toBeCloseTo(first.offset, 3);
  expect(second.type).toBe(first.type);
});

test('Ctrl locks drawing to 90° increments', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await page.keyboard.down('Control');
  await h.moveTo(page, 8, 5);
  await h.clickWorld(page, 8, 5);   // 32° aim squares onto the horizontal ray
  await page.keyboard.up('Control');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(h.touchesPoint(lines[0], 8, 0)).toBe(true);
});

test('Ctrl+Shift locks drawing to 30° increments', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await page.keyboard.down('Control');
  await page.keyboard.down('Shift');
  await h.moveTo(page, 8, 5);
  await h.clickWorld(page, 8, 5);   // 32° aim tightens onto the 30° ray
  await page.keyboard.up('Shift');
  await page.keyboard.up('Control');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  const end = [lines[0].start, lines[0].end].find(pt => Math.hypot(pt.x, pt.z) > 1);
  expect(end).toBeTruthy();
  const angle = Math.atan2(end.z, end.x);
  expect(Math.abs(angle - Math.PI / 6)).toBeLessThan(0.01);
});

test('Alt never engages the angle lock', async ({ page }) => {
  await h.openModel(page);
  await page.keyboard.press('t'); // set the T-square down — this test draws a free angle
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await page.keyboard.down('Alt');
  await h.moveTo(page, 8, 5);
  await h.clickWorld(page, 8, 5);
  await page.keyboard.up('Alt');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  expect(h.touchesPoint(lines[0], 8, 5)).toBe(true);
});

test('Ctrl squares the copy placement onto the base point rays', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -8, 0, -2, 0);

  await page.keyboard.press('k');
  await page.waitForTimeout(200);
  await dragWindow(page, -10, -2, 0, 2);
  await h.clickWorld(page, -8, 0);

  await page.keyboard.down('Control');
  await h.moveTo(page, 0, 0.8);
  await h.clickWorld(page, 0, 0.8);  // squares onto the horizontal ray → (0, 0)
  await page.keyboard.up('Control');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(2);
  expect(lines.some(line => h.touchesPoint(line, 0, 0) && h.touchesPoint(line, 6, 0))).toBe(true);
});
