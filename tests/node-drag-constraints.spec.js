// A dragged node obeys the same constraints as a drawn point: Shift locks
// it onto a 45° T-square ray from its grab point, R freezes the drag so an
// exact distance can be typed (measured from the armed polar zero), Escape
// puts the node back, and the magnet still welds it onto other nodes — while
// never treating the dragged node as its own snap target.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
}

// Press on a node and pull it, leaving the mouse button down for the caller.
async function startDrag(page, fromX, fromZ, toX, toZ) {
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(150); // a drawing tool's grab arms after the hold delay
  await page.mouse.move(to.x, to.y, { steps: 8 });
}

test('Shift locks a dragged node onto a 45° ray from its grab point', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);

  await h.selectTool(page, 'Select');
  await page.keyboard.down('Shift');
  await startDrag(page, 10, 0, 18, 2.5);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  const moved = [lines[0].start, lines[0].end].find(p => p.x > 0);
  // The cursor drifted off-axis; the lock projects it back onto the east ray.
  expect(h.near(moved.x, 18)).toBe(true);
  expect(h.near(moved.z, 0, 0.1)).toBe(true);
});

test('Shift locks a dragged node onto the south ray too', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);

  await h.selectTool(page, 'Select');
  await page.keyboard.down('Shift');
  await startDrag(page, 10, 0, 10, 8);
  await page.mouse.move((await h.worldToClient(page, 11.5, 8)).x, (await h.worldToClient(page, 11.5, 8)).y);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  const moved = [lines[0].start, lines[0].end].find(p => p.x > 0);
  // Locked south: the sideways drift cannot bend the ray.
  expect(h.near(moved.x, 10, 0.1)).toBe(true);
  expect(h.near(moved.z, 8)).toBe(true);
});

test('an engaged Shift lock beats the vertex magnet: a node off the ray cannot yank the point', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, 10, 2, 14, 2); // leaves a node at (10,2) just off the east ray

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await page.keyboard.down('Shift');
  const mid = await h.worldToClient(page, 8, 0);
  await page.mouse.move(mid.x, mid.y); // aims the lock east
  const near = await h.worldToClient(page, 10, 2);
  await page.mouse.move(near.x, near.y); // cursor lands ON the off-ray node
  await page.mouse.click(near.x, near.y);
  await page.keyboard.up('Shift');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(2);
  const drawn = lines.find(line => [line.start, line.end].some(p => h.near(p.x, 0) && h.near(p.z, 0)));
  const endPt = [drawn.start, drawn.end].find(p => !(h.near(p.x, 0) && h.near(p.z, 0)));
  // The locked east ray holds: the endpoint projects to (10,0), not the node at (10,2).
  expect(h.near(endPt.z, 0, 0.1)).toBe(true);
});

test('R during a node drag types an exact distance from the grab point', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);

  await h.selectTool(page, 'Select');
  await startDrag(page, 10, 0, 14, 0);
  await page.keyboard.press('r');
  await page.keyboard.type('20');
  await page.keyboard.press('Enter');
  await page.mouse.up();
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  const moved = [lines[0].start, lines[0].end].find(p => p.x > 0);
  // 20' east of the grab point (10, 0) — typed beats pointed.
  expect(h.near(moved.x, 30, 0.1)).toBe(true);
  expect(h.near(moved.z, 0, 0.1)).toBe(true);
});

test('Escape cancels the typed distance and puts the node back', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);

  await h.selectTool(page, 'Select');
  await startDrag(page, 10, 0, 14, 0);
  await page.keyboard.press('r');
  await page.keyboard.type('20');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  const moved = [lines[0].start, lines[0].end].find(p => p.x > 0);
  // Back where the drag sat when R was pressed, not 20' out.
  expect(h.near(moved.x, 14)).toBe(true);
  expect(h.near(moved.z, 0)).toBe(true);
});

test('a dragged node still magnets onto another node', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);
  await drawLine(page, -10, 8, 10, 8);

  await h.selectTool(page, 'Select');
  await startDrag(page, 10, 0, 10.15, 7.9);
  await page.mouse.up();
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  const moved = lines
    .flatMap(seg => [seg.start, seg.end])
    .find(p => p.x > 0 && p.z > 4);
  // Welded exactly onto the other line's endpoint, not left nearby.
  expect(Math.abs(moved.x - 10)).toBeLessThan(0.05);
  expect(Math.abs(moved.z - 8)).toBeLessThan(0.05);
});

test('mid-drag, Shift keeps the grab-point lock even with an armed polar node', async ({ page }) => {
  await h.openModel(page);
  await page.keyboard.press('p'); // pick the compass up — polar is off by default
  await drawLine(page, -10, 0, 10, 0);
  await drawLine(page, 2, 6, 8, 6);

  await h.selectTool(page, 'Select');
  // Pull the endpoint over the other line's node and pause there — the dwell
  // arms it as the polar origin — then Shift back toward the grab point's
  // west ray: the grab point owns the direction, so the vertex lands on ITS
  // locked ray, not on a ray cast from the armed node.
  await startDrag(page, 10, 0, 8, 6);
  await expect(page.locator('[data-model-polar]')).toBeVisible();
  await page.keyboard.down('Shift');
  await h.moveTo(page, 1, 0.5);
  await page.mouse.up();
  await page.keyboard.up('Shift');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  const moved = [lines[0].start, lines[0].end].find(p => p.x > -5);
  expect(h.near(moved.x, 1)).toBe(true);
  expect(h.near(moved.z, 0)).toBe(true);
});

test('grabbing a BONEYARD master node shows the ripple warning while dragging', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Outline');
  await startDrag(page, 8, 6, 12, 8);

  // The warning must stay on screen for the whole drag, not get wiped by the
  // per-move save path.
  await expect(page.locator('[data-model-drawing-message]')).toContainText('BONEYARD master point');
  await page.mouse.up();
  await h.waitForSaved(page);
});

test('a whole node drag is one history entry: a single undo puts it back', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  await h.selectTool(page, 'Outline');
  await startDrag(page, 8, 6, 14, 10);
  await page.mouse.up();
  await h.waitForSaved(page);

  // The dragged level-copy corner is a local override; the master stays put.
  const moved = await h.savedDrawing(page);
  const movedCopy = moved.outlines.find(o => o.levelId === 3);
  expect(movedCopy.points.some(p => h.near(p.x, 8) && h.near(p.z, 6))).toBe(false);
  expect(movedCopy.points.some(p => h.near(p.x, 14) && h.near(p.z, 10))).toBe(true);

  await page.keyboard.press('Control+z');
  await h.waitForSaved(page);

  const undone = await h.savedDrawing(page);
  const undoneCopy = undone.outlines.find(o => o.levelId === 3);
  expect(undoneCopy.points.some(p => h.near(p.x, 8) && h.near(p.z, 6))).toBe(true);
  expect(undoneCopy.points.some(p => h.near(p.x, 14) && h.near(p.z, 10))).toBe(false);
});

test('R types an exact distance while dragging an outline corner', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  await h.selectTool(page, 'Outline');
  await startDrag(page, 8, 6, 12, 6);
  await page.keyboard.press('r');
  await page.keyboard.type('10');
  await page.keyboard.press('Enter');
  await page.mouse.up();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines[0].points).toHaveLength(4);
  const main = saved.outlines.find(o => o.levelId === 3);
  // 10' east of the grabbed corner (8, 6).
  expect(main.points.some(p => h.near(p.x, 18, 0.1) && h.near(p.z, 6, 0.1))).toBe(true);
});
