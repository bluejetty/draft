// UP / BONE / DOWN, ON ONE LINE AND SYMMETRICAL.
//
// Movie, 14 Oct: "can you put the UP arrow to the left of the bone and DOWN
// arrow to the right, and also bring them so they are centered at same
// location up/down with the BONE/HOUSE button so they all line up (UP / BONE /
// DOWN)", then "(make it look symetrical makes it more appealling".
//
// BOTH ARROWS SAT TO THE BONE'S RIGHT, between it and UNDO, since they arrived
// on 12 Oct. What he is asking for is one trio about one centre -- so what
// this file measures is GEOMETRY, in pixels, which is the only thing that can
// answer "does it look symmetrical": the order left to right, one line, equal
// gaps, and the bone still standing on the sheet's own centre axis.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const boxes = page => page.evaluate(() => {
  const read = id => {
    const el = document.getElementById(id);
    if (!el || el.hidden) return null;
    const r = el.getBoundingClientRect();
    return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width };
  };
  return { up: read('model-level-up'), bone: read('bone'), down: read('model-level-down'),
    middle: window.innerWidth / 2 };
});

test('the two arrows stand either side of the bone, on its line', async ({ page }) => {
  await h.openModel(page);
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const at = await boxes(page);
  expect(at.up, 'the UP arrow is not on the foot').not.toBeNull();
  expect(at.down, 'the DOWN arrow is not on the foot').not.toBeNull();

  // THE ORDER HE NAMED: UP, then the bone, then DOWN.
  expect(at.up.cx, 'UP is not left of the bone').toBeLessThan(at.bone.cx);
  expect(at.down.cx, 'DOWN is not right of the bone').toBeGreaterThan(at.bone.cx);

  // ONE LINE -- "centered at same location up/down with the BONE/HOUSE
  // button". Within a pixel, because the three are flex items on one row and
  // anything more than rounding is a real misalignment.
  expect(Math.abs(at.up.cy - at.bone.cy), 'UP rides above or below the bone')
    .toBeLessThanOrEqual(1);
  expect(Math.abs(at.down.cy - at.bone.cy), 'DOWN rides above or below the bone')
    .toBeLessThanOrEqual(1);

  // SYMMETRICAL -- the same gap each side, which is the whole of "make it look
  // symetrical". A wider UP than DOWN would read as a trio leaning left even
  // with both gaps equal, so the widths are held equal too.
  const left = at.bone.cx - at.up.cx;
  const right = at.down.cx - at.bone.cx;
  expect(Math.abs(left - right), `${left} px left of the bone, ${right} px right`)
    .toBeLessThanOrEqual(1);
  expect(Math.abs(at.up.w - at.down.w), 'the two arrows are not the same size')
    .toBeLessThanOrEqual(1);
});

test('and the bone is still on the sheet-s centre axis', async ({ page }) => {
  // THE AXIS IS THE POINT OF THE OLD ARRANGEMENT, and the reason the trio is
  // placed as one box rather than three measured off each other: the bone
  // stands on the same line the instrument rule at the top of the page stands
  // on (Movie, 16 Sep), and a trio centred about anything else would have
  // walked it off that line to make room for an arrow.
  await h.openModel(page);
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const at = await boxes(page);
  expect(Math.abs(at.bone.cx - at.middle),
    `the bone stands ${Math.round(at.bone.cx - at.middle)} px off the page's middle`)
    .toBeLessThanOrEqual(1);
});

test('a page with no levels shows neither arrow, and its bone stays centred',
  async ({ page }) => {
    // LAYOUT AND PROJECT CARRY THIS BAR TOO and have no storeys to step
    // through, so both arrows ship hidden there. A hidden flex item takes no
    // room -- which is exactly why the trio is one centred box: with the
    // arrows gone the box holds only the bone, and the bone is still on the
    // axis rather than pushed half an arrow off it.
    await page.goto('/PROJECT.html');
    await page.waitForTimeout(600);
    const at = await boxes(page);
    expect(at.up, 'PROJECT shows a level arrow it cannot use').toBeNull();
    expect(at.down, 'PROJECT shows a level arrow it cannot use').toBeNull();
    expect(Math.abs(at.bone.cx - at.middle),
      `the bone stands ${Math.round(at.bone.cx - at.middle)} px off the page's middle`)
      .toBeLessThanOrEqual(1);
  });
