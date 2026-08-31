// A finger draws (audit C2).
//
// The app's stated target is an iPad at the permit counter, and before the
// pointer migration a finger could not draw at all: every canvas listener was
// mouse-only, so taps produced nothing. Nothing in the suite would have told
// us — ~550 specs drive the canvas through synthetic events, and none of them
// touch the screen.
//
// This file is the one that would have caught it. It runs with a real
// touchscreen (`hasTouch`) and taps and drags with `page.touchscreen` /
// `page.locator.tap()`, so the events come from the browser's own touch
// pipeline: pointer events with pointerType 'touch', implicit capture, and
// none of the mouse compatibility helpers the rest of the suite leans on.
//
// Scope: the definition of done for the migration — trace an outline, press
// the bone, place a wall, drag a node. Hover-gated flows (polar dwell, magnet
// highlights, tooltips) are NOT tested here; they are a known gap recorded on
// the board, not a regression this spec should hide.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

test.use({ hasTouch: true });

// A tap at a world point, with the same settle the mouse helper uses so two
// taps in a row are not read as a double tap.
async function tapWorld(page, x, z) {
  const p = await h.worldToClient(page, x, z);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(400);
}

// A finger drag: down, several moves, up — through CDP's touch pipeline.
async function dragTouch(page, fromX, fromZ, toX, toZ) {
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  const client = await page.context().newCDPSession(page);
  const touch = (type, pt) => client.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: type === 'touchEnd' ? [] : [{ x: pt.x, y: pt.y, id: 1 }],
  });
  await touch('touchStart', from);
  for (let i = 1; i <= 6; i++) {
    await touch('touchMove', {
      x: from.x + (to.x - from.x) * (i / 6),
      y: from.y + (to.y - from.y) * (i / 6),
    });
  }
  await touch('touchEnd', to);
  await client.detach();
}

test('a finger traces a house outline and presses the bone', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-8, -6], [8, -6], [8, 6], [-8, 6]]) await tapWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // Four corners, closed, from four taps.
  let saved = await h.savedDrawing(page);
  const master = saved.boneyardOutlines.find(outline => !outline.garage);
  expect(master, 'a finger closed a house outline').toBeTruthy();
  expect(master.points).toHaveLength(4);

  await h.climbTourToMain(page);
  // The bone is an ordinary button, but it is the press the whole flow ends
  // on — if touch cannot reach it there is no house.
  await page.locator('[data-build-house]').tap();
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  expect(saved.walls.length, 'the bone built a shell').toBeGreaterThan(0);
});

test('a finger places a wall and drags a node', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Wall');
  await tapWorld(page, -6, -4);
  await tapWorld(page, 6, -4);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  let walls = h.allWalls(await h.savedDrawing(page));
  expect(walls, 'two taps drew one wall').toHaveLength(1);
  expect(h.touchesPoint(walls[0], -6, -4)).toBe(true);
  expect(h.touchesPoint(walls[0], 6, -4)).toBe(true);

  // Grab the far end and pull it: the drag has to survive as a captured
  // pointer, which is the half of this board a tap alone does not exercise.
  await h.selectTool(page, 'Select');
  await dragTouch(page, 6, -4, 6, 2);
  await h.waitForSaved(page);

  walls = h.allWalls(await h.savedDrawing(page));
  expect(walls).toHaveLength(1);
  expect(h.touchesPoint(walls[0], -6, -4), 'the anchored end stayed put').toBe(true);
  expect(h.touchesPoint(walls[0], 6, 2), 'the dragged end followed the finger').toBe(true);
});

test('a second finger landing mid-stroke takes the view, and commits nothing', async ({ page }) => {
  // AMENDED by the gesture board. This spec used to pin the migration-era
  // rule — first pointer wins everywhere, so a second finger changed nothing
  // and the wall still committed. On the CANVAS that is now deliberately
  // different: a second TOUCH pointer promotes to the pan/pinch gesture,
  // because "I started a line and actually wanted to move the view" is the
  // save a tablet needs. Everywhere else — chrome, chips, cards — first
  // pointer wins exactly as before, and a mouse never joins a gesture.
  //
  // What has NOT changed, and is still the point of this test: the intruding
  // finger never drops a corner of its own.
  await h.openModel(page);
  await h.selectTool(page, 'Wall');
  await tapWorld(page, -6, 0);

  const first = await h.worldToClient(page, 6, 0);
  const intruder = await h.worldToClient(page, 0, 8);
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: first.x, y: first.y, id: 1 }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: first.x, y: first.y, id: 1 }, { x: intruder.x, y: intruder.y, id: 2 }],
  });
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd', touchPoints: [{ x: first.x, y: first.y, id: 1 }],
  });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await client.detach();
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // The pending run was discarded, not committed behind the drafter's back —
  // and above all, nothing was drawn to the intruder's corner.
  const saved = await h.savedDrawing(page);
  const walls = h.allWalls(saved || {});
  expect(walls).toHaveLength(0);
  expect(h.allLines(saved || {})).toHaveLength(0);
});
