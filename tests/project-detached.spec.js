// BAND 3 — THE DETACHED GARAGE, AND IT IS NOT BAND 1's GARAGE MOVED.
//
// The attached garage in band 1 is drawn by buildGarageSection, which is
// structurally attached in four ways: no wall of its own (the house wall IS
// the wall at that cut), x running negative from the shared face, no grade
// line because the garage stands over that ground, and every height hung off
// the house's datum. Band 3 is a separate builder for a separate building, and
// the tests below are chosen so a flag on the old one could not pass them.
const { test, expect } = require('@playwright/test');

// A CELL IS A BOX NOW, and half of them are inputs. Movie, 28 Sep: "we need
// to make the text box areas so the user can input the text". textContent on
// an <input> is the empty string, so a reader that only knew about spans
// would report every typeable row as blank and pass nothing but the derived
// ones. Asked of the element it actually is.
const read = (page, key) =>
  page.locator(`[data-detached-value="${key}"]`).evaluate(el =>
    (el.tagName === 'INPUT' ? el.value : el.textContent));

const press = (page, label) =>
  page.locator('#detached-family-row button', { hasText: label });

const shoot = page =>
  page.evaluate(() => document.querySelector('#detached-canvas').toDataURL());

test('band 3 is wired and draws without error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/PROJECT.html?type=detached');
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
  await page.goto('/PROJECT.html?type=detached');
  await expect(page.locator('#detached-canvas')).toBeVisible();

  // 0'-4" and 0'-10", not 4" and 10": formatArchitecturalInches always emits
  // feet-and-inches, and band 2's SLAB row reads the same way. Asserted as the
  // page actually renders rather than as a drafter would write it, because
  // changing that is a decision about both bands and not this one.
  expect(await read(page, 'slabThickness')).toBe(`4"`);
  expect(await read(page, 'fdnDepth')).toBe(`1'-0"`);
  expect(await read(page, 'slabAboveGrade')).toBe(`0'-10"`);
  expect(await read(page, 'wallHeight')).toBe(`9'-1 1/8"`);

  // AND NOT THE HOUSE'S. The inequality that makes the four above mean
  // something: a band reading the live house would show a 3" slab and the
  // 8'-1 1/8" precut, and both are a plausible-looking wrong answer.
  expect(await read(page, 'slabThickness')).not.toBe(`3"`);
  expect(await read(page, 'wallHeight')).not.toBe(`8'-1 1/8"`);
});

// THE DOOR HEAD IS COMPOSED, not pinned. 9'-1 1/8" less the 1'-4 1/2" head
// drop is 7'-8 5/8" -- which is what lets a 7'-0" overhead door into this wall
// at all, and was the reason the row needed its own wall height.
test('the door head hangs the head drop below the top plate', async ({ page }) => {
  await page.goto('/PROJECT.html?type=detached');
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
  // OPENS ON THE BAND IT EDITS, not the one it measures. One type is on screen
  // at a time now (Movie, 23 Sep), and the FDN WALL HT this test types into
  // belongs to band 1. repaint() paints every canvas whether its section is
  // shown or not, so band 3's pixels are still the honest answer.
  await page.goto('/PROJECT.html?type=bungalow');
  await page.waitForFunction(
    () => document.querySelector('#detached-canvas')?.paintedSection != null,
    null, { timeout: 10000 });
  // READ THE CANVAS, NOT THE SCREEN -- the lesson band 2's spec already
  // recorded. An element screenshot needs the element visible AND is taken of
  // the page as scrolled, so it turns "did band 3 repaint?" into "did the page
  // scroll?". toDataURL answers the same for a hidden canvas as a shown one.
  const before = await shoot(page);
  const edgeBefore = await read(page, 'fdnDepth');

  const fdn = page.locator('#sched-house').getByLabel('FDN WALL HT');
  await expect(fdn).toBeVisible();
  await fdn.fill(String.raw`6'-0"`);
  await fdn.press('Enter');
  await page.waitForTimeout(300);

  // Band 1 moved, or this asserts nothing.
  await expect(page.locator('#detail-canvas')).toBeVisible();
  expect(await read(page, 'fdnDepth')).toBe(edgeBefore);
  expect(await shoot(page)).toBe(before);
});

// LABELS THAT LAND ON EACH OTHER SAY NOTHING. The same invariant band 1 and 2
// carry: a thickened edge, a slab and a floor-over-grade are inches apart and
// all three deserve their own line, so the de-collision pass has to run here
// too rather than being a thing bands 1 and 2 happen to have.
test('band 3 labels do not overlap each other', async ({ page }) => {
  await page.goto('/PROJECT.html?type=detached');
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

// ── THE FOUNDATION IS A CHOICE NOW, AND THE SECTION IS WHAT ANSWERS ────────
//
// Until 28 Sep the three foundations were a comparison strip under the card
// and the three buttons beside it were deliberately dead: "there is no chosen
// detached foundation to press INTO". Movie replaced the strip with the
// choice, so the pair of facts to pin is that a press CHANGES THE DRAWING and
// that the depth cell follows the foundation rather than carrying the
// thickened edge's 1'-0" over to a 32" beam.
test('pressing a foundation redraws the section and renames its depth row',
  async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto('/PROJECT.html?type=detached');
    await expect(page.locator('#detached-canvas')).toBeVisible();

    const before = await shoot(page);
    expect(await read(page, 'fdnDepth')).toBe(`1'-0"`);

    await press(page, 'GRADE BEAM').click();
    await page.waitForTimeout(300);

    // THE DEPTH IS THE BEAM'S OWN, not the edge's. A page that stored the
    // typed cell and left it alone would still read 1'-0" here, which is the
    // wrong beam drawn under a right-looking label.
    expect(await read(page, 'fdnDepth')).toBe(`2'-8"`);
    expect(await page.locator('[data-sched-row="fdnDepth"] .sched-name').textContent())
      .toBe('GRADE BEAM HT');
    expect(await shoot(page)).not.toBe(before);
    expect(errors).toEqual([]);
  });

// ── THE STOREY, AND WHERE IT IS NOT OFFERED ───────────────────────────────
//
// Movie, 28 Sep: "we need 'Thickened Edge' version with only 1 storey, but on
// the 'FROST WALL' and 'GRADE BEAM' we need to offer the '+ADD ROOM ABOVE'".
// Both halves, because the press showing everywhere passes the first
// assertion and showing nowhere passes the second.
test('the room above is offered on a beam and a frost wall, never on a slab',
  async ({ page }) => {
    await page.goto('/PROJECT.html?type=detached');
    await expect(page.locator('#detached-canvas')).toBeVisible();
    const room = page.locator('[data-detached-value="roomOver"]');
    const roomRow = page.locator('[data-sched-row="roomOver"]');
    const wall = page.locator('[data-sched-row="overWallHeight"]');

    await expect(roomRow).toBeHidden();

    await press(page, 'FROST WALL').click();
    await page.waitForTimeout(300);
    await expect(roomRow).toBeVisible();
    await expect(wall).toBeHidden();

    const flat = await shoot(page);
    await room.click();
    await page.waitForTimeout(300);
    await expect(room).toHaveText('ROOM ABOVE ✓');
    // The storey's own wall arrives WITH the storey -- Movie, 17 Sep, on the
    // attached one: "(one 2nd floor is added)(once)".
    await expect(wall).toBeVisible();
    expect(await read(page, 'overWallHeight')).toBe(`8'-1 1/8"`);
    expect(await shoot(page)).not.toBe(flat);

    // AND IT CANNOT SURVIVE A FLOATING SLAB. A thickened edge carries a
    // garage, not a storey of house -- the same rule that keeps an attached
    // garage off one.
    await press(page, 'THICKENED EDGE').click();
    await page.waitForTimeout(300);
    await expect(roomRow).toBeHidden();
    await expect(wall).toBeHidden();
  });

// A TYPED CELL IS A STORED CELL. The rows were read-only spans until today;
// the whole ask was to make them boxes, so one round trip through one of them
// is the check that they are wired to the DETACHED GARAGE row and not just
// dressed as inputs.
test('a typed wall height moves the drawing and the door head under it',
  async ({ page }) => {
    await page.goto('/PROJECT.html?type=detached');
    await expect(page.locator('#detached-canvas')).toBeVisible();
    const before = await shoot(page);

    const wall = page.locator('[data-detached-value="wallHeight"]');
    await wall.fill(String.raw`10'-0"`);
    await wall.press('Enter');
    await page.waitForTimeout(300);

    expect(await read(page, 'wallHeight')).toBe(`10'-0"`);
    // Composed, not pinned: the head follows the plate it hangs off.
    expect(await read(page, 'doorHead')).toBe(`8'-7 1/2"`);
    expect(await shoot(page)).not.toBe(before);
  });

// THE STRIP IS GONE, and so is the paragraph under it. Movie, 28 Sep: "the
// text down below we can delete all that". Asserted rather than left to the
// eye because a card that quietly keeps a deleted element is the failure this
// change can have.
test('the comparison strip and the prose under the card are gone',
  async ({ page }) => {
    await page.goto('/PROJECT.html?type=detached');
    await expect(page.locator('#detached-canvas')).toBeVisible();
    await expect(page.locator('#detached-strip')).toHaveCount(0);
    await expect(page.locator('#stage-detached .strip-caption')).toHaveCount(0);
    await expect(page.locator('#stage-detached .zone-note')).toHaveCount(0);
  });
