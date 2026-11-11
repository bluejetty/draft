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

// AND APART AGAIN, 11 Nov (Movie, with a mockup): "move the north arrow
// changer to the left of the LAYERS/LVLS tab so the level tab can go to the
// top ... put the FULL SIZE, and page rotation down beside registration (but
// make them smaller so two are same height as the registration box (and make
// the NORTH ARROW box that smaller size too)". The arrow's hand stands alone
// at the top right, left of the rail; HOUSE turn and ZOOM TO FILL stack at
// the bottom right, a matched pair of the arrow's size.
const boxes = page => page.evaluate(() => {
  const box = el => { const r = el.getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, left: r.x, right: r.right, top: r.y, bottom: r.bottom, w: r.width, h: r.height }; };
  return { rail: box(document.getElementById('right-rail')), north: box(document.getElementById('north-hit')),
    turn: box(document.getElementById('strip-rotate')), fill: box(document.getElementById('strip-fill')),
    hint: box(document.getElementById('hint')) };
});

test('the arrow stands at the top right, left of the open rail and level with its top', async ({ page }) => {
  await houseOnScreen(page);
  const at = await boxes(page);
  expect(at.rail.w, 'the rail never came up to line up with').toBeGreaterThan(0);
  expect(at.north.right, 'the arrow is left of the rail').toBeLessThanOrEqual(at.rail.left);
  expect(at.rail.left - at.north.right, 'and close beside it').toBeLessThanOrEqual(12);
  expect(Math.abs(at.north.top - at.rail.top), 'with its top on the rail\'s top').toBeLessThanOrEqual(6);
});

test('HOUSE turn stands over ZOOM TO FILL at the bottom right, clear of the pan hint', async ({ page }) => {
  await houseOnScreen(page);
  const at = await boxes(page);
  expect(Math.abs(at.turn.cx - at.fill.cx), 'one column').toBeLessThanOrEqual(1);
  expect(at.turn.bottom, 'the turn above the fill').toBeLessThanOrEqual(at.fill.top);
  expect(at.fill.top - at.turn.bottom, 'and touching').toBeLessThanOrEqual(6);
  expect(at.fill.bottom, 'the pair stands over the pan hint').toBeLessThanOrEqual(at.hint.top);
  expect(at.fill.right, 'in the sheet\'s right margin').toBeGreaterThan(page.viewportSize().width - 60);
});

test('and they are a matched set, not one big and one small', async ({ page }) => {
  await houseOnScreen(page);
  const at = await boxes(page);
  // THE ARROW WAS 77px TALL BESIDE A 36px BUTTON. "the same size" -- and
  // since 23 Oct the same box; since 11 Nov the smaller 32px one.
  expect(Math.abs(at.north.h - at.turn.h),
    `arrow ${at.north.h}px, button ${at.turn.h}px`).toBeLessThanOrEqual(1);
  expect(Math.abs(at.fill.h - at.turn.h)).toBeLessThanOrEqual(1);
  expect(at.north.h, 'the smaller box').toBeLessThanOrEqual(34);
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
