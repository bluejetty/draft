// THE NORTH ARROW AND HOUSE ROTATE: A MATCHED PAIR OVER THE RAIL.
//
// Movie, 14 Oct: "over in upper right area where the N Arrow is and the box
// with the ROTATE page, can we make them the same size and center each over
// the layouts below ... the N arrow would be alot smaller", then "the same
// color WHITE for both and the NOrth arrow doesn't need a box actually just
// make them similar size", and for the hand: "make them glow green for the
// north arrow ... and make the rotation one GOLD glowing", with the colours
// named — "the GREEN will match the Site plan registration mark and the Gold
// will match the HOUSE registration mark".
//
// AND A THIRD, 23 Oct, with a mockup: "update the NORTH arrow make it look
// like the other button" and "add a ZOOM TO FILL". The arrow's hand wears the
// turn button's box now, ZOOM TO FILL stands over the second column, and the
// turn button between them (tests/zoom-to-fill.spec.js has the row).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function houseOnScreen(page) {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  await page.goto('/MODEL.html?right=1&left=1&level=3');
  await expect(page.locator('#strip-rotate')).toBeVisible();
}

const boxes = page => page.evaluate(() => {
  const mid = el => { const r = el.getBoundingClientRect(); return { cx: r.x + r.width / 2, w: r.width, h: r.height }; };
  const seats = [...document.querySelectorAll('[data-seat]')].slice(0, 2)
    .map(s => { const r = s.getBoundingClientRect(); return r.x + r.width / 2; })
    .sort((a, b) => a - b);
  return { seats, north: mid(document.getElementById('north-hit')),
    turn: mid(document.getElementById('strip-rotate')), fill: mid(document.getElementById('strip-fill')) };
});

test('the arrow sits over the first column, ZOOM TO FILL over the second, and the turn button between', async ({ page }) => {
  await houseOnScreen(page);
  const at = await boxes(page);
  expect(at.seats.length, 'the rail never came up to line up with').toBe(2);
  // MEASURED AGAINST THE SEATS THEMSELVES, not against a pixel typed here:
  // the rail was widened 15px earlier the same day, and a check written to
  // the old number would have gone red for the right reason and the wrong
  // one at once.
  expect(Math.abs(at.north.cx - at.seats[0]),
    'the north arrow is not over the first column').toBeLessThanOrEqual(2);
  expect(Math.abs(at.fill.cx - at.seats[1]),
    'ZOOM TO FILL is not over the second column').toBeLessThanOrEqual(2);
  expect(Math.abs(at.turn.cx - (at.seats[0] + at.seats[1]) / 2),
    'HOUSE ROTATE is not halfway between').toBeLessThanOrEqual(2);
});

test('and they are a matched set, not one big and one small', async ({ page }) => {
  await houseOnScreen(page);
  const at = await boxes(page);
  // THE ARROW WAS 77px TALL BESIDE A 36px BUTTON. "the same size" -- and
  // since 23 Oct the same box, so the same to the pixel.
  expect(Math.abs(at.north.h - at.turn.h),
    `arrow ${at.north.h}px, button ${at.turn.h}px`).toBeLessThanOrEqual(1);
  expect(Math.abs(at.fill.h - at.turn.h)).toBeLessThanOrEqual(1);
});

test('the turn button is white, and lights the HOUSE mark gold under the hand',
  async ({ page }) => {
    await houseOnScreen(page);
    const turn = page.locator('#strip-rotate');
    await expect(turn).toHaveCSS('color', 'rgb(255, 255, 255)');
    const before = await turn.evaluate(el => getComputedStyle(el).filter);
    await turn.hover();
    const after = await turn.evaluate(el => ({
      filter: getComputedStyle(el).filter,
      // THE GOLD IS THE HOUSE MARK'S OWN, read off the skin rather than typed
      // here: "the Gold will match the HOUSE registration mark", which is the
      // draw-origin key paintOrigin paints that mark with.
      gold: getComputedStyle(document.documentElement).getPropertyValue('--draw-origin').trim(),
    }));
    expect(after.gold, 'the skin has no house-mark gold to borrow').toBeTruthy();
    expect(after.filter, 'nothing glows under the hand').not.toBe(before);
    expect(after.filter, 'the glow is not a drop-shadow').toContain('drop-shadow');
  });

test('the arrow wears the turn button\'s box', async ({ page }) => {
  // 14 Oct: "the NOrth arrow doesn't need a box"; 23 Oct, with a mockup of
  // three matching squares: "update the NORTH arrow make it look like the
  // other button". The later word stands: the hand is a chip like its
  // neighbours, and the arrow is drawn inside it.
  await houseOnScreen(page);
  const hit = page.locator('#north-hit'), turn = page.locator('#strip-rotate');
  const bg = await turn.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  await expect(hit).toHaveCSS('background-color', bg);
  await expect(hit).toHaveCSS('border-radius', await turn.evaluate(el => getComputedStyle(el).borderRadius));
});
