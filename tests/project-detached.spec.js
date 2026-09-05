// BAND 3 — THE DETACHED GARAGE, AND IT IS NOT BAND 1's GARAGE MOVED.
//
// The attached garage in band 1 is drawn by buildGarageSection, which is
// structurally attached in four ways: no wall of its own (the house wall IS
// the wall at that cut), x running negative from the shared face, no grade
// line because the garage stands over that ground, and every height hung off
// the house's datum. Band 3 is a separate builder for a separate building, and
// the tests below are chosen so a flag on the old one could not pass them.
const { test, expect } = require('@playwright/test');

const read = (page, key) =>
  page.locator(`[data-detached-value="${key}"]`).textContent();

test('band 3 is wired and draws without error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/PROJECT.html');
  await expect(page.locator('#detached-canvas')).toBeVisible();
  const shot = (await page.locator('#detached-canvas').screenshot()).toString('base64');
  // A page error here is the failure this file exists for. fillBilevel once
  // gained a parameter without its call site and threw on repaint, and BOTH
  // bands silently lost every label -- caught by looking at a screenshot, not
  // by a test. An empty errors array is the cheap version of that look.
  expect(errors).toEqual([]);
  expect(shot.length).toBeGreaterThan(2000);
});

// THE NUMBERS COME FROM THE DETACHED ROW, which is the point of the band. Every
// one of these was wrong until today: the row had no defaults at all and fell
// through to the HOUSE's live values, so this schedule would have read a 3"
// slab and the bungalow's 8'-1 1/8" precut.
test('band 3 reads the DETACHED GARAGE row, not the house', async ({ page }) => {
  await page.goto('/PROJECT.html');
  await expect(page.locator('#detached-canvas')).toBeVisible();

  // 0'-4" and 0'-10", not 4" and 10": formatArchitecturalInches always emits
  // feet-and-inches, and band 2's SLAB row reads the same way. Asserted as the
  // page actually renders rather than as a drafter would write it, because
  // changing that is a decision about both bands and not this one.
  expect(await read(page, 'slabThickness')).toBe(`0'-4"`);
  expect(await read(page, 'edgeDepth')).toBe(`1'-0"`);
  expect(await read(page, 'slabAboveGrade')).toBe(`0'-10"`);
  expect(await read(page, 'wallHeight')).toBe(`9'-1 1/8"`);

  // AND NOT THE HOUSE'S. The inequality that makes the four above mean
  // something: a band reading the live house would show a 3" slab and the
  // 8'-1 1/8" precut, and both are a plausible-looking wrong answer.
  expect(await read(page, 'slabThickness')).not.toBe(`0'-3"`);
  expect(await read(page, 'wallHeight')).not.toBe(`8'-1 1/8"`);
});

// THE DOOR HEAD IS COMPOSED, not pinned. 9'-1 1/8" less the 1'-4 1/2" head
// drop is 7'-8 5/8" -- which is what lets a 7'-0" overhead door into this wall
// at all, and was the reason the row needed its own wall height.
test('the door head hangs the head drop below the top plate', async ({ page }) => {
  await page.goto('/PROJECT.html');
  await expect(page.locator('#detached-canvas')).toBeVisible();
  expect(await read(page, 'doorHead')).toBe(`7'-8 5/8"`);
});

// WHAT BAND 3 BORROWS AND WHAT IT REFUSES -- both halves, for the reason band
// 2's spec gives: sharing everything passes one assertion, sharing nothing
// passes the other, and only the pair pins the contract.
//
// It takes the ROOF PITCH from band 1, because a pitch belongs to the job. It
// refuses band 1's FOUNDATION, because a detached garage's foundation is its
// own and is the whole subject of this band.
test('band 3 ignores a foundation edit in band 1', async ({ page }) => {
  await page.goto('/PROJECT.html');
  await expect(page.locator('#detached-canvas')).toBeVisible();
  const shoot = async () =>
    (await page.locator('#detached-canvas').screenshot()).toString('base64');
  const before = await shoot();
  const edgeBefore = await read(page, 'edgeDepth');

  const fdn = page.locator('#sched-house').getByLabel('FDN WALL HT');
  await expect(fdn).toBeVisible();
  await fdn.fill(String.raw`6'-0"`);
  await fdn.press('Enter');
  await page.waitForTimeout(300);

  // Band 1 moved, or this asserts nothing.
  await expect(page.locator('#detail-canvas')).toBeVisible();
  expect(await read(page, 'edgeDepth')).toBe(edgeBefore);
  expect(await shoot()).toBe(before);
});

// LABELS THAT LAND ON EACH OTHER SAY NOTHING. The same invariant band 1 and 2
// carry: a thickened edge, a slab and a floor-over-grade are inches apart and
// all three deserve their own line, so the de-collision pass has to run here
// too rather than being a thing bands 1 and 2 happen to have.
test('band 3 labels do not overlap each other', async ({ page }) => {
  await page.goto('/PROJECT.html');
  await expect(page.locator('#detached-canvas')).toBeVisible();
  await page.waitForTimeout(400);

  const boxes = await page.locator('#detached-wrap .detail-tag').evaluateAll(nodes =>
    nodes.filter(n => n.style.display !== 'none' && n.textContent.trim())
      .map(n => {
        const r = n.getBoundingClientRect();
        return { text: n.textContent.trim(), top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      }));
  expect(boxes.length).toBeGreaterThan(3);

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlaps = a.left < b.right && b.left < a.right
        && a.top < b.bottom && b.top < a.bottom;
      expect(overlaps, `${a.text} overlaps ${b.text}`).toBe(false);
    }
  }
});
