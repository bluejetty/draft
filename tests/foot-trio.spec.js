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
  return { up: read('trio-up'), bone: read('bone'), down: read('trio-down'),
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

test('PROJECT wears the same trio, and its bone is on the axis too', async ({ page }) => {
  // THIS TEST USED TO SAY "a page with no levels shows neither arrow". That
  // was true of PROJECT for one day. Movie, 14 Oct: "those arrow can be
  // placed on the PROJECT and REAL ESTATE PLANS, CONSTRUCTION PLANS but
  // instead of going up and down levels ... in the project area, cycle
  // through each HOUSE TYPE selection". So PROJECT now steps house types, and
  // what is worth measuring here is that it wears the SAME trio: same order,
  // same gaps, bone still on the page's middle.
  await page.goto('/PROJECT.html');
  await page.waitForTimeout(600);
  const at = await boxes(page);
  expect(at.up, 'PROJECT shows no UP arrow').not.toBeNull();
  expect(at.down, 'PROJECT shows no DOWN arrow').not.toBeNull();
  expect(at.up.cx, 'UP is not left of the bone').toBeLessThan(at.bone.cx);
  expect(at.down.cx, 'DOWN is not right of the bone').toBeGreaterThan(at.bone.cx);
  const left = at.bone.cx - at.up.cx;
  const right = at.down.cx - at.bone.cx;
  expect(Math.abs(left - right), `${left} px left of the bone, ${right} px right`)
    .toBeLessThanOrEqual(1);
  expect(Math.abs(at.bone.cx - at.middle),
    `the bone stands ${Math.round(at.bone.cx - at.middle)} px off the page's middle`)
    .toBeLessThanOrEqual(1);
});

test('a bone-less page gets the trio all the same, and keeps it hidden until it is wired',
  async ({ page }) => {
    // REAL ESTATE PLAN mounts the bar with `bone: false`, which used to drop
    // the whole middle of it -- so the two pages that want no drive-thru had
    // nowhere for an arrow to stand at all. The trio mounts there now, with
    // the middle left out.
    //
    // AND IT IS STILL HIDDEN, because this page prints ONE sheet: there is no
    // stack to step and nothing has called stepper(). That is the honest
    // state for it, and it is the thing to change when a second sheet exists
    // -- not the markup.
    await page.goto('/REALESTATEPLAN.html');
    await page.waitForTimeout(600);
    const seen = await page.evaluate(() => {
      const trio = document.getElementById('dt-trio');
      const live = id => {
        const el = document.getElementById(id);
        return !!el && !el.hidden;
      };
      return { trio: !!trio, bone: !!document.getElementById('bone'),
        up: live('trio-up'), down: live('trio-down') };
    });
    expect(seen.trio, 'the trio never mounted on a bone-less page').toBe(true);
    expect(seen.bone, 'a bone turned up on a page that asked for none').toBe(false);
    expect(seen.up, 'REAL ESTATE PLAN shows an arrow with nothing to step').toBe(false);
    expect(seen.down, 'REAL ESTATE PLAN shows an arrow with nothing to step').toBe(false);
  });
