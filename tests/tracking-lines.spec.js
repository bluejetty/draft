// Projection tracking: the rays were real, but you had to already be on the
// node to catch them.
//
// _findTrackingSnap measured the cursor's distance to the NODE. The whole
// point of a tracking line is that you are somewhere else — out on your own
// ray, lining up with a corner that may be across the drawing. By the time
// you were within the catch of the node you did not need tracking, and for a
// node off the ray's axis the test could never pass at all. It now measures
// the distance to the node's tracking line — the perpendicular through it.
//
// The catch WIDTH is unchanged: the ordinary node snap zone, not a new number
// and not the 5x magnet. What changes is that the alignment is reachable.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Comfortably inside a 4px snap zone at any canvas height the suite runs at
// (0.25 ft at 800px tall, 0.33 ft at 600px), and comfortably outside it.
const NUDGE = 0.1;
const MILES = 3;

async function drawLine(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

const lastLine = drawing => (drawing.lines || [])[(drawing.lines || []).length - 1];

test('a leg crossing a distant node\'s perpendicular catches it — cursor nowhere near the node', async ({ page }) => {
  await h.openModel(page);
  // A node at (10, -8): eight feet off the ray this line will travel.
  await drawLine(page, 10, -8, 14, -8);

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  // Travelling +x along z=0, nudged past x=10. The node is 8 ft away — far
  // outside any snap zone — but its tracking line is right here.
  await h.clickWorld(page, 10 + NUDGE, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const line = lastLine(await h.savedDrawing(page));
  expect(line.end.x).toBeCloseTo(10, 2);     // caught the intersection
  expect(line.end.z).toBeCloseTo(0, 2);
});

test('no angle lock, no tracking catch', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, 10, -8, 14, -8);
  // Put the T-square away: tracking is an aid to a locked ray, not a free snap.
  await page.keyboard.press('t');
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 10 + NUDGE, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const line = lastLine(await h.savedDrawing(page));
  expect(line.end.x).toBeCloseTo(10 + NUDGE, 2);   // landed where clicked
});

test('a node far off the tracking line is not caught', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, 10, -8, 14, -8);

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 10 + MILES, 0);   // three feet past the tracking line
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const line = lastLine(await h.savedDrawing(page));
  expect(line.end.x).toBeCloseTo(10 + MILES, 2);
});

test('the nearest tracking line wins, and a node on the ray beats one off it', async ({ page }) => {
  await h.openModel(page);
  await drawLine(page, 10, -8, 14, -8);      // node at x=10, off the ray
  await drawLine(page, 12, 5, 16, 5);        // node at x=12, also off the ray

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 0, 0);
  // Nudged past x=12: that tracking line is 0.1 away, x=10's is 2.1 away.
  await h.clickWorld(page, 12 + NUDGE, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const line = lastLine(await h.savedDrawing(page));
  expect(line.end.x).toBeCloseTo(12, 2);     // the nearer line, not x=10
});
