// Every drawing tool shares one gesture on an existing node: press-and-hold
// then move drags the node — no switch to Select needed — while a quick click
// still runs the tool's normal action (a new line can chain off a corner).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function dragWorld(page, fromX, fromZ, toX, toZ) {
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.waitForTimeout(150); // a drawing tool's grab arms after the hold delay
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);
}

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

test('the Line tool drags an existing endpoint by press-and-hold', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);

  // Still on the Line tool: grab the right endpoint and pull it north.
  await dragWorld(page, 10, 0, 10, -8);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(1);
  const moved = [lines[0].start, lines[0].end].find(p => h.near(p.x, 10));
  expect(h.near(moved.z, -8)).toBe(true);
});

test('a quick Line click on a node still chains a new line off the corner', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);

  // A quick click on the endpoint starts a new chain from it.
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 10, 0);
  await h.clickWorld(page, 10, -8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(2);
  const added = lines.find(seg => h.near(seg.start.z, 0) && h.near(seg.end.z, -8));
  expect(added).toBeTruthy();
  expect(h.near(added.start.x, 10) && h.near(added.end.x, 10)).toBe(true);
});

test('a quick flick over a node places a point instead of dragging the node', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, -10, 0, 10, 0);

  // Down-move-up faster than the hold delay: even with travel past the drag
  // threshold, the node stays put and the click chains a new line off it.
  await h.selectTool(page, 'Line');
  const from = await h.worldToClient(page, 10, 0);
  await page.evaluate(pt => {
    const canvas = document.querySelector('[data-model-canvas]');
    // PointerEvent with pointer names, in step with the canvas listeners
    // (audit C2). It was a MouseEvent; the sequence, the coordinates and the
    // 8px of travel are the same, and they are the point of the test.
    const fire = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type,
      { bubbles: true, clientX: x, clientY: y, button: 0, pointerId: 1, isPrimary: true }));
    fire('pointermove', pt.x, pt.y);
    fire('pointerdown', pt.x, pt.y);
    fire('pointermove', pt.x + 8, pt.y + 8);
    fire('pointerup', pt.x + 8, pt.y + 8);
  }, from);
  await page.waitForTimeout(400); // clear the 350ms double-click window
  await h.clickWorld(page, 10, -8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const lines = h.allLines(await h.savedDrawing(page));
  expect(lines).toHaveLength(2);
  // The original line never moved…
  const original = lines.find(seg => h.near(seg.start.z, 0) && h.near(seg.end.z, 0));
  expect(original).toBeTruthy();
  expect([original.start.x, original.end.x].sort((a, b) => a - b)
    .every((x, i) => h.near(x, [-10, 10][i]))).toBe(true);
  // …and the flick's click started the chain that drew the new line.
  const added = lines.find(seg => h.near(seg.start.z, -8) || h.near(seg.end.z, -8));
  expect(added).toBeTruthy();
});

test('the Outline tool drags an existing corner without switching to Select', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page); // drawn on MAIN FL

  await h.selectTool(page, 'Outline');
  await dragWorld(page, 8, 6, 12, 10);

  const saved = await h.savedDrawing(page);
  // The master keeps four corners; the MAIN FL copy carries the local move.
  expect(saved.boneyardOutlines[0].points).toHaveLength(4);
  const main = saved.outlines.find(o => o.levelId === 3);
  expect(main.points).toHaveLength(4);
  expect(main.points.some(p => h.near(p.x, 12) && h.near(p.z, 10))).toBe(true);
});

test('the Wall tool drags a wall node; mid-chain presses keep placing points', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // Still on the Wall tool: grab the right end and pull it south.
  await dragWorld(page, 10, 0, 10, 8);
  let saved = await h.savedDrawing(page);
  expect(saved.walls).toHaveLength(1);
  const moved = [saved.walls[0].start, saved.walls[0].end].find(p => h.near(p.x, 10));
  expect(h.near(moved.z, 8)).toBe(true);

  // Mid-chain a press over that node adds a segment instead of grabbing it.
  await h.clickWorld(page, -10, 8);
  await h.clickWorld(page, 10, 8);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.walls).toHaveLength(2);
});
