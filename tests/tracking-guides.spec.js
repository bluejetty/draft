// Show the tracking lines before they are caught.
//
// #217 made the catch work — the cursor is measured against a node's tracking
// line rather than against the node — but the overlay only drew anything once
// _trackingRef was set, i.e. once the intersection had already been found. So
// the drafter hunted for a line the app never showed him and found it by the
// cursor jumping. These are those lines, painted while he is still looking.
//
// Faint orange (the polar family, #e07a20) at 1px for "you could line up
// here"; the existing solid blue indicator still means "you are on it", and
// the change of colour at the moment of catch is the feedback.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Count overlay pixels close to the guide's orange, inside a box in world
// feet. The guides are the only faint orange on an otherwise empty overlay.
async function guideInk(page, x, z, halfFt) {
  const box = await page.locator('[data-model-canvas]').boundingBox();
  const ppf = box.height / 50;                     // HALF_HEIGHT_FT 25 => 50ft tall
  const cx = box.width / 2 + x * ppf;
  const cy = box.height / 2 + z * ppf;
  const r = Math.max(4, halfFt * ppf);
  return page.evaluate(({ cx, cy, r }) => {
    const canvas = document.querySelector('[data-model-overlay]');
    if (!canvas) return -1;
    const d = canvas.getContext('2d').getImageData(
      Math.round(cx - r), Math.round(cy - r), Math.round(r * 2), Math.round(r * 2)).data;
    let orange = 0;
    for (let i = 0; i < d.length; i += 4) {
      // #e07a20 is red-dominant with a mid green and a low blue.
      if (d[i + 3] > 8 && d[i] > 120 && d[i] > d[i + 1] + 30 && d[i + 1] > d[i + 2]) orange += 1;
    }
    return orange;
  }, { cx, cy, r });
}


// The caught indicator is blue (#5980a6): blue-dominant, unlike the guides.
async function caughtInk(page, x, z, halfFt) {
  const box = await page.locator('[data-model-canvas]').boundingBox();
  const ppf = box.height / 50;
  const cx = box.width / 2 + x * ppf;
  const cy = box.height / 2 + z * ppf;
  const r = Math.max(4, halfFt * ppf);
  return page.evaluate(({ cx, cy, r }) => {
    const canvas = document.querySelector('[data-model-overlay]');
    if (!canvas) return -1;
    const d = canvas.getContext('2d').getImageData(
      Math.round(cx - r), Math.round(cy - r), Math.round(r * 2), Math.round(r * 2)).data;
    let blue = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 8 && d[i + 2] > 120 && d[i + 2] > d[i] + 30) blue += 1;
    }
    return blue;
  }, { cx, cy, r });
}

// A node off to the side, then an angle-locked draw that has not reached it.
async function lockedDrawPastANode(page) {
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 12, -9);
  await h.clickWorld(page, 16, -9);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -14, 0);      // chain start
  await h.moveTo(page, -2, 0);           // travelling +x, still well short of x=12
  await page.waitForTimeout(150);
}

test('a node off to the side has its tracking line drawn before the cursor is near it', async ({ page }) => {
  await h.openModel(page);
  await lockedDrawPastANode(page);

  // The node is at (12, -9) and the cursor is at (-2, 0): nowhere near it.
  // Its tracking line still crosses the ray at x = 12, and is painted.
  expect(await guideInk(page, 12, 4, 2)).toBeGreaterThan(0);
});

test('the guide extends past the node both ways, not a stub', async ({ page }) => {
  await h.openModel(page);
  await lockedDrawPastANode(page);

  // Above the node and below it, both far from the node itself.
  expect(await guideInk(page, 12, -16, 2)).toBeGreaterThan(0);
  expect(await guideInk(page, 12, 8, 2)).toBeGreaterThan(0);
});

test('no angle lock means no guides', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 12, -9);
  await h.clickWorld(page, 16, -9);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await page.keyboard.press('t');        // put the T-square away
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -14, 0);
  await h.moveTo(page, -2, 0);
  await page.waitForTimeout(150);

  expect(await guideInk(page, 12, 4, 2)).toBe(0);
});

test('with no draw in progress nothing is drawn', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Line');
  await h.clickWorld(page, 12, -9);
  await h.clickWorld(page, 16, -9);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  // Tool armed, no chain started: there is no ray to cast guides against.
  await h.selectTool(page, 'Line');
  await h.moveTo(page, -2, 0);
  await page.waitForTimeout(150);

  expect(await guideInk(page, 12, 4, 2)).toBe(0);
});

test('crossing a guide catches the intersection, and the caught line reads differently', async ({ page }) => {
  await h.openModel(page);
  await lockedDrawPastANode(page);

  // Before the catch the node's line is orange guide only, no blue.
  expect(await guideInk(page, 12, 4, 2)).toBeGreaterThan(0);
  expect(await caughtInk(page, 12, -4, 3)).toBe(0);

  // Cross it: the cursor reaches the node's tracking line at x = 12.
  await h.moveTo(page, 12, 0);
  await page.waitForTimeout(200);

  // Now the caught indicator runs from the node to the snap point in blue —
  // faint orange means "you could line up here", solid blue means "you are
  // on it", and the change of colour is the feedback.
  expect(await caughtInk(page, 12, -4, 3)).toBeGreaterThan(0);
});

test('a drawing with many nodes does not draw all of them', async ({ page }) => {
  await h.openModel(page);
  // Eight candidate nodes strung along the ray's axis.
  await h.selectTool(page, 'Line');
  for (const x of [0, 2, 4, 6, 8, 10, 12, 14]) await h.clickWorld(page, x, -9);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Line');
  await h.clickWorld(page, -14, 0);
  await h.moveTo(page, -2, 0);          // travelling +x from x = -2
  await page.waitForTimeout(150);

  // TRACKING_GUIDE_MAX is 6, chosen by ALONG-RAY gap: from x = -2 the nearest
  // six lines are x = 0..10, so the two beyond them get nothing. Forty nodes
  // would otherwise be forty lines.
  expect(await guideInk(page, 0, 4, 1.5)).toBeGreaterThan(0);
  expect(await guideInk(page, 10, 4, 1.5)).toBeGreaterThan(0);
  expect(await guideInk(page, 14, 4, 1.5)).toBe(0);
});
