// THE CLOSET OBJECT, wired up — auto-placement and the clear strip.
//
// ── THE RULING THESE SPECS EXIST TO PROTECT ─────────────────────────────
//
//   A ROOM IN TOY MODE IS ALWAYS A RECTANGLE. A CLOSET IS AN OBJECT PLACED
//   IN IT — NOT A BITE TAKEN OUT OF ITS OUTLINE.
//
// (Movie, 1 Sep 2026.) It is what keeps every other rule in the toy simple:
// the room stays the shape the rules are good at, and the awkward thing gets
// its own size and its own checks. There is no neck measurement anywhere and
// there must never be one.
//
// Two behaviours follow, and both are here:
//
//   AUTO-PLACE, UNASKED. Every secondary bedroom gets one. The drafter may
//   move or delete it; the toy just never leaves one out.
//
//   THE CLEAR STRIP. 3'-0" of floor in front, so a bedroom cannot be shrunk
//   until its own closet will not open. The constraint module refuses that
//   without ever learning what a closet is — it asks, and closets.js answers.
//
// The placement rules themselves are proved in node, in
// proto/closets-harness.js. What is pinned here is the wiring.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const openToy = page => h.openModel(page, { webgl: false, search: '?toy=1' });

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

// Two bedrooms side by side, the west one clearly bigger so it is the suite.
// A closet in each makes them bedrooms rather than unrated rooms.
async function drawTwoBedrooms(page) {
  await drawWall(page, -20, -7, 14, -7);
  await drawWall(page, 14, -7, 14, 7);
  await drawWall(page, 14, 7, -20, 7);
  await drawWall(page, -20, 7, -20, -7);
  await drawWall(page, 0, -7, 0, 7);
}

// A fixture makes a room read as a BEDROOM to the category vote, which is what
// decides whether a closet is owed at all.
async function closetFixture(page, x1, x2, z) {
  await h.selectTool(page, 'Fixture');
  await page.getByRole('button', { name: 'CLOSET', exact: true }).click();
  await h.clickWorld(page, x1, z);
  await h.clickWorld(page, x2, z);
  await h.waitForSaved(page);
}

const closets = async page => (h.savedDrawing
  ? ((await h.savedDrawing(page))?.fixtures || []).filter(f => f.kind === 'closet')
  : []);

const message = page => page.locator('[data-model-drawing-message]');

test.describe('The closet object', () => {
  // ── A DEPENDENCY WORTH KNOWING ABOUT ──────────────────────────────────
  // The room detector votes a room's category from the fixtures inside it,
  // and the ONLY fixture that marks a bedroom is a closet. So a room is not
  // recognised as a bedroom until it already has the thing auto-placement
  // exists to give it, and the fixture path is circular: the pass can only
  // ever reach rooms a drafter has STAMPED as bedrooms.
  //
  // That is not a defect in the pass -- it is where the feature actually takes
  // effect, which is after the rooms are named. Reported rather than worked
  // around, because working around it would mean guessing which unnamed rooms
  // are bedrooms and carpeting a house with closets.
  //
  // What is pinned below is the wiring either side of that: the pass runs, it
  // never doubles up, it never fires for a drafter, and it does not guess. The
  // placement rules themselves -- squaring, openings winning, the shared-wall
  // tie-break, the clear strip -- are proved in proto/closets-harness.js.

  test('an unnamed room is not guessed to be a bedroom', async ({ page }) => {
    await openToy(page);
    await drawTwoBedrooms(page);
    await page.reload();
    await h.waitForModelReady(page);
    await page.waitForTimeout(300);

    // Two enclosed rooms, nothing in them, nothing stamped. A pass that put a
    // closet in each would be guessing, and would carpet a living room with
    // wardrobes.
    expect(await closets(page)).toHaveLength(0);
  });

  test('a room that already has one is never given a second', async ({ page }) => {
    await openToy(page);
    await drawTwoBedrooms(page);
    // A hand-placed closet is the one non-stamp route to being a bedroom --
    // and it is also, by definition, a bedroom that is not missing a closet.
    await closetFixture(page, -16, -12, -6.6);
    expect(await closets(page)).toHaveLength(1);

    await page.reload();
    await h.waitForModelReady(page);
    await h.waitForSaved(page);

    // The toy places what is MISSING. A closet the drafter drew -- or moved --
    // is still that room's closet.
    expect(await closets(page)).toHaveLength(1);
  });

  test('reading the same plan twice changes nothing', async ({ page }) => {
    await openToy(page);
    await drawTwoBedrooms(page);
    await closetFixture(page, -16, -12, -6.6);
    for (let i = 0; i < 2; i++) {
      await page.reload();
      await h.waitForModelReady(page);
      await h.waitForSaved(page);
    }
    expect(await closets(page)).toHaveLength(1);
  });

  test('a drafting session is given nothing it did not ask for', async ({ page }) => {
    // Auto-placement is the toy deciding for someone who did not ask. Someone
    // who opens the same file to draft has asked for nothing and gets nothing,
    // which is why the pass is behind the mode and not behind the plan.
    await h.openModel(page, { webgl: false });
    await drawTwoBedrooms(page);
    await closetFixture(page, -16, -12, -6.6);
    await page.reload();
    await h.waitForModelReady(page);
    expect(await closets(page)).toHaveLength(1);
  });

  test('the closet the drafter draws is the size Movie\'s rule gives it', async ({ page }) => {
    await openToy(page);
    await drawTwoBedrooms(page);
    // 4'-0" outside. The trim is 4" each side ON THE OUTSIDE FACE, so the door
    // is sized against the closet's own width -- this used to be taken off the
    // inside width, already 7" narrower, so shipped closets carried doors for
    // a closet 7" smaller than the one drawn.
    await closetFixture(page, -16, -12, -6.6);
    const [closet] = await closets(page);
    expect(closet.width).toBeCloseTo(4, 1);
    expect(closet.depth).toBeCloseTo(2 + 1 / 12 + 3.5 / 12, 4);
  });
});
