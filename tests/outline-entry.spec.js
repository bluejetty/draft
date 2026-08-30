// Guided outline entry by finger (board #311).
//
// The gesture board gave the iPad a way to move the view; the polish sweep
// gave it buttons; the pointer migration let a finger draw at all. What was
// still missing is the thing a drafter actually does: draw an EXACT outline.
// On the desk that is the type-ahead ruler (#161) — point the direction with
// the cursor, type the distance, Enter. A tablet has neither a cursor to point
// with nor a keyboard to type on, so it gets a RAY to tap and a PAD to type on,
// both feeding the same ruler.
//
// HOW THE LEGS ARE MEASURED: by the world coordinates in the saved drawing,
// never by what the screen says. A ruler that shows 12'-0" and commits 11'-9"
// would pass any UI assertion and fail the only thing this feature is for.
//
// The rays are a TOUCH aid — `hasTouch` here is not decoration, it is the gate
// the app checks (`pointer: coarse`), and the last test in this file is the one
// that proves the desk is untouched.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// The ring radius and the pad width the app paints with. If these ever change
// in MODEL.dc.html they change here too — that is deliberate, since a spec that
// re-derives them from the app cannot catch the app moving them.
const RAY_PX = 78;

test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

// Tap the direction knob `angle` radians round the ring from a pending corner.
// The knobs are painted in SCREEN space around the corner's screen position, so
// that is where the finger goes — no world-to-screen guesswork.
async function tapRay(page, cornerX, cornerZ, angle) {
  const anchor = await h.worldToClient(page, cornerX, cornerZ);
  await page.touchscreen.tap(
    anchor.x + Math.cos(angle) * RAY_PX,
    anchor.y + Math.sin(angle) * RAY_PX,
  );
  await page.waitForTimeout(300);
}

// Type a length on the on-screen pad and press its ENTER — the same commit the
// keyboard's Enter reaches.
async function padLength(page, text) {
  for (const ch of text) await page.locator(`[data-pad-key="${ch}"]`).tap();
  await page.locator('[data-entry-pad-enter]').tap();
  await page.waitForTimeout(350);
}

async function startOutlineAt(page, x, z) {
  await h.selectTool(page, 'Outline');
  const first = await h.worldToClient(page, x, z);
  await page.touchscreen.tap(first.x, first.y);
  await page.waitForTimeout(400);
}

const outlinePoints = saved =>
  (saved?.boneyardOutlines || []).find(o => !o.garage)?.points || [];

test('tapping a ray sets the direction and opens the pad — it does not drop a corner', async ({ page }) => {
  await h.openModel(page);
  await startOutlineAt(page, -10, -6);

  // Nothing is up before a ray is tapped: the pad is the ray's consequence.
  await expect(page.locator('[data-entry-pad]')).toHaveCount(0);

  await tapRay(page, -10, -6, 0);
  await expect(page.locator('[data-entry-pad]')).toHaveCount(1);

  // The tap was SPENT on the ray. If it had fallen through to the drawing it
  // would have dropped a second corner out at the knob, roughly 78px away —
  // so finish the run and check there is no such corner.
  await padLength(page, '12');
  await tapRay(page, 2, -6, Math.PI / 2);
  await padLength(page, '8');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const points = outlinePoints(await h.savedDrawing(page));
  expect(points, 'three corners: the start and two typed legs').toHaveLength(3);
});

test('a typed length commits an exact leg', async ({ page }) => {
  await h.openModel(page);
  await startOutlineAt(page, -10, -6);

  await tapRay(page, -10, -6, 0);
  await padLength(page, '12');
  await tapRay(page, 2, -6, Math.PI / 2);
  await padLength(page, '8');
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const points = outlinePoints(await h.savedDrawing(page));
  expect(points).toHaveLength(3);
  // Measured in world feet against the corner they grew from, not against the
  // origin — the first corner came from a tap and carries a pixel of rounding,
  // but every TYPED leg has to be exact to the foot.
  const leg1 = Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z);
  const leg2 = Math.hypot(points[2].x - points[1].x, points[2].z - points[1].z);
  expect(leg1).toBeCloseTo(12, 6);
  expect(leg2).toBeCloseTo(8, 6);
  // And on the headings that were tapped: the first ray ran along +x, the
  // second along +z. A ruler that measured 12 feet in the wrong direction is
  // the failure this pins.
  expect(Math.abs(points[1].z - points[0].z)).toBeLessThan(1e-6);
  expect(Math.abs(points[2].x - points[1].x)).toBeLessThan(1e-6);
});

test('the close ray finishes the loop', async ({ page }) => {
  await h.openModel(page);
  await startOutlineAt(page, -10, -6);
  await tapRay(page, -10, -6, 0);
  await padLength(page, '12');
  await tapRay(page, 2, -6, Math.PI / 2);
  await padLength(page, '8');
  await tapRay(page, 2, 2, Math.PI);
  await padLength(page, '12');

  // Three corners down, so closing is legal and the CLOSE knob sits on the
  // first corner itself. No Enter, no FINISH button: the finger closes it.
  await expect(page.locator('[data-finish-chain]')).toBeVisible();
  const closeAt = await h.worldToClient(page, -10, -6);
  await page.touchscreen.tap(closeAt.x, closeAt.y);
  await page.waitForTimeout(400);
  await h.waitForSaved(page);

  const points = outlinePoints(await h.savedDrawing(page));
  expect(points, 'a closed four-corner rectangle').toHaveLength(4);
  // 12 by 8, squared up — the room the drafter asked for.
  const xs = points.map(p => p.x), zs = points.map(p => p.z);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(12, 5);
  expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(8, 5);
  await expect(page.locator('[data-finish-chain]')).toHaveCount(0);
});

test('the pad never covers the pending corner, on either side of the sheet', async ({ page }) => {
  await h.openModel(page);
  const canvas = await page.locator('[data-model-canvas]').boundingBox();
  const midX = canvas.x + canvas.width / 2;

  // A corner on the LEFT of the sheet: the pad has to dock right.
  await startOutlineAt(page, -18, 0);
  await tapRay(page, -18, 0, 0);
  let corner = await h.worldToClient(page, -18, 0);
  expect(corner.x, 'this corner really is on the left half').toBeLessThan(midX);
  let pad = await page.locator('[data-entry-pad]').boundingBox();
  expect(pad.x, 'the pad went to the far side').toBeGreaterThan(corner.x);
  expect(corner.x < pad.x || corner.x > pad.x + pad.width).toBe(true);

  // And a corner on the RIGHT: the pad has to dock left. Same run, new corner —
  // walk the outline across the sheet rather than starting over, because the
  // dock is re-decided on every render, not once at open.
  await padLength(page, '30');
  corner = await h.worldToClient(page, 12, 0);
  expect(corner.x, 'and this one is on the right half').toBeGreaterThan(midX);
  await tapRay(page, 12, 0, Math.PI / 2);
  pad = await page.locator('[data-entry-pad]').boundingBox();
  expect(pad.x + pad.width, 'the pad came back to the near side').toBeLessThan(corner.x);
  expect(corner.x < pad.x || corner.x > pad.x + pad.width).toBe(true);
});

test('a hardware digit puts the pad away and keeps the ruler', async ({ page }) => {
  await h.openModel(page);
  await startOutlineAt(page, -10, -6);
  await tapRay(page, -10, -6, 0);
  await expect(page.locator('[data-entry-pad]')).toHaveCount(1);

  // A Bluetooth keyboard on an iPad wins: it is faster than the pad, and the
  // pad is now just something in the way.
  await page.keyboard.press('9');
  await page.waitForTimeout(200);
  await expect(page.locator('[data-entry-pad]'), 'the pad stood down').toHaveCount(0);

  // The RULER carried on: the digit landed in it, and Enter commits it. This
  // is the half that would break if the pad had been dismissed by tearing the
  // ruler down with it.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  // A second leg the same way — ray for the heading, keyboard for the number.
  // An outline needs three corners before it will commit, so this is also what
  // makes the first leg readable at all.
  await tapRay(page, -1, -6, Math.PI / 2);
  await expect(page.locator('[data-entry-pad]')).toHaveCount(1);
  await page.keyboard.press('7');
  await page.waitForTimeout(200);
  await expect(page.locator('[data-entry-pad]')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  const points = outlinePoints(await h.savedDrawing(page));
  expect(points).toHaveLength(3);
  expect(Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z)).toBeCloseTo(9, 6);
  expect(Math.hypot(points[2].x - points[1].x, points[2].z - points[1].z)).toBeCloseTo(7, 6);
});

test('a second finger during pad entry takes the view and loses nothing committed', async ({ page }) => {
  await h.openModel(page);

  // Something genuinely committed first: a finished wall, saved and done.
  await h.selectTool(page, 'Wall');
  for (const [x, z] of [[-14, 10], [-2, 10]]) {
    const p = await h.worldToClient(page, x, z);
    await page.touchscreen.tap(p.x, p.y);
    await page.waitForTimeout(400);
  }
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  expect(h.allWalls(await h.savedDrawing(page))).toHaveLength(1);

  // Now an outline run with the pad open and a length half typed.
  await startOutlineAt(page, -10, -6);
  await tapRay(page, -10, -6, 0);
  await page.locator('[data-pad-key="1"]').tap();
  await expect(page.locator('[data-entry-pad]')).toHaveCount(1);

  // The second finger lands: this is a view gesture, per the gesture board.
  const canvas = await page.locator('[data-model-canvas]').boundingBox();
  const cx = canvas.x + canvas.width / 2, cy = canvas.y + canvas.height / 2;
  const client = await page.context().newCDPSession(page);
  const send = (type, points) => client.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })),
  });
  await send('touchStart', [{ x: cx - 60, y: cy }]);
  await send('touchStart', [{ x: cx - 60, y: cy }, { x: cx + 60, y: cy }]);
  for (let i = 1; i <= 6; i++) {
    const dx = -90 * (i / 6);
    await send('touchMove', [{ x: cx - 60 + dx, y: cy }, { x: cx + 60 + dx, y: cy }]);
  }
  await send('touchEnd', [{ x: cx - 150, y: cy }]);
  await send('touchEnd', []);
  await client.detach();
  await page.waitForTimeout(300);

  // The pending run went with the gesture, pad and all — half a length is not
  // a leg, and committing it behind the drafter's back is the thing the
  // gesture board ruled against.
  await expect(page.locator('[data-entry-pad]')).toHaveCount(0);
  await expect(page.locator('[data-finish-chain]')).toHaveCount(0);

  // But the WALL is still there. Nothing already committed was lost.
  const saved = await h.savedDrawing(page);
  expect(h.allWalls(saved)).toHaveLength(1);
  expect(outlinePoints(saved), 'no half-drawn outline was committed').toHaveLength(0);
});

test.describe('the desk is untouched', () => {
  test.use({ hasTouch: false });

  test('a mouse gets no rays and no pad — a click there draws, as it always did', async ({ page }) => {
    await h.openModel(page);
    await h.selectTool(page, 'Outline');
    await h.clickWorld(page, -10, -6);
    await page.waitForTimeout(200);

    // Click exactly where a knob would be if rays were live. With a fine
    // pointer there is nothing there, so this is an ordinary second corner.
    const anchor = await h.worldToClient(page, -10, -6);
    await page.mouse.move(anchor.x + RAY_PX, anchor.y);
    await page.mouse.click(anchor.x + RAY_PX, anchor.y);
    await page.waitForTimeout(300);
    await expect(page.locator('[data-entry-pad]')).toHaveCount(0);

    // A third corner, so the outline is one an outline run will commit.
    await h.clickWorld(page, -2, 4);
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    const points = outlinePoints(await h.savedDrawing(page));
    expect(points, 'the click drew a corner instead of being eaten by a ray').toHaveLength(3);
    // And it landed out where the mouse was, not at the corner it started from.
    expect(Math.hypot(points[1].x - points[0].x, points[1].z - points[0].z)).toBeGreaterThan(1);
  });
});
