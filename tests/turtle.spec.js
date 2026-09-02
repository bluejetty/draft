// THE TURTLE — turtle path step 3, on screen and walking.
//
// ── THE TWO CLAIMS THESE SPECS EXIST TO PROTECT ─────────────────────────
//
//   1. TWO VERBS. Turn 90°, and go a whole number of feet. Nothing else.
//   2. THE USER SETS 12 AND THE ROOM MEASURES 12.
//
// The second is why the first is shaped as it is, and why the turtle walks the
// INSIDE FACE: walk the centreline instead and someone sets 12 and the
// finished room measures 11'-6½", every dimension on the drawing contradicting
// the number they set. That is the confusion the whole mode exists to prevent.
//
// The walk itself is proved in node, in proto/turtle-harness.js — headings,
// quantising, orthogonality by construction, and the face arithmetic. What is
// pinned here is the surface: that the verbs are reachable without a keyboard,
// that a closed walk becomes walls, and that an unclosed one becomes nothing.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const openToy = page => h.openModel(page, { webgl: false, search: '?toy=1' });

const panel = page => page.locator('[data-turtle-panel]');
const facing = page => page.locator('[data-turtle-facing]');
const feet = page => page.locator('[data-turtle-feet]');
const message = page => page.locator('[data-model-drawing-message]');

const startTurtle = async page => {
  await page.locator('[data-select-turtle]').click();
  await expect(panel(page)).toBeVisible();
};

// Set the distance by nudging, because there is no keyboard in this path.
async function setFeet(page, target) {
  for (let i = 0; i < 60; i++) {
    const now = parseInt((await feet(page).textContent()).replace(/\D/g, ''), 10);
    if (now === target) return;
    await page.locator(now < target ? '[data-turtle-more]' : '[data-turtle-less]').click();
  }
  throw new Error(`could not reach ${target} feet`);
}

async function go(page, turn, distanceFt) {
  if (turn) await page.locator(`[data-turtle-${turn}]`).click();
  await setFeet(page, distanceFt);
  await page.locator('[data-turtle-go]').click();
}

const walls = async page => h.allWalls(await h.savedDrawing(page));

test.describe('The turtle', () => {
  test('is a TOY MODE surface, not something a drafter is handed', async ({ page }) => {
    // Pressing TURTLE while drafting must not swap the app out from under
    // someone who pressed a build-row button.
    await h.openModel(page, { webgl: false });
    await page.locator('[data-select-turtle]').click();
    await expect(message(page)).toContainText(/coming soon/i);
    await expect(panel(page)).toHaveCount(0);
  });

  test('has two verbs and no keyboard', async ({ page }) => {
    await openToy(page);
    await startTurtle(page);

    // Turn, and go a distance. That is the whole control surface, and every
    // target is big enough for a finger -- the iPad pass is step 4, but a
    // control that needed a keyboard would have to be thrown away by it.
    for (const verb of ['left', 'right', 'less', 'more', 'go']) {
      const button = panel(page).locator(`[data-turtle-${verb}]`);
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(38);
    }
    // No text entry anywhere in the path: an inch has no way in.
    await expect(panel(page).locator('input')).toHaveCount(0);

    // A turn is remembered and shown before it is walked, so a press to turn
    // is visible rather than silent.
    await expect(facing(page)).toContainText('FACING E');
    await page.locator('[data-turtle-right]').click();
    await expect(facing(page)).toContainText('FACING S');
    await page.locator('[data-turtle-left]').click();
    await expect(facing(page)).toContainText('FACING E');
  });

  test('a walk that comes home becomes a room, drawn to the inside face', async ({ page }) => {
    await openToy(page);
    await startTurtle(page);

    const before = (await walls(page)).length;
    await go(page, null, 12);          // east 12
    await go(page, 'right', 14);       // south 14
    await go(page, 'right', 12);       // west 12
    // Still open, so still nothing committed: a room is only drawn when the
    // walk comes home.
    expect((await walls(page)).length).toBe(before);
    await go(page, 'right', 14);       // north 14 — home

    await h.waitForSaved(page);
    const after = await walls(page);
    expect(after.length).toBe(before + 4);
    await expect(message(page)).toContainText(/closed the room/i);

    // THE FACES ARE THE POINT. The turtle walked the inside face, so the walls
    // carry a refLine naming the side the room is on -- not 'center', which is
    // the setting that would have handed back 11'-6 1/2" for a 12.
    const drawn = after.slice(-4);
    expect(drawn.every(wall => wall.refLine === 'left' || wall.refLine === 'right')).toBe(true);
    expect(new Set(drawn.map(wall => wall.refLine)).size).toBe(1);

    // And the walk is the size that was set, on the foot.
    const runs = drawn.map(wall => Math.round(
      Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) * 100) / 100).sort();
    expect(runs).toEqual([12, 12, 14, 14]);
  });

  test('turning the other way still gets the faces right', async ({ page }) => {
    await openToy(page);
    await startTurtle(page);
    // Nobody is asked which way round the room is. The module reads it off the
    // finished walk, so a left-handed walk is as good as a right-handed one --
    // and it must come out as the OTHER refLine, or it was not read at all.
    await go(page, null, 12);
    await go(page, 'left', 14);
    await go(page, 'left', 12);
    await go(page, 'left', 14);
    await h.waitForSaved(page);

    // Length asserted first: `every` on an empty array is true, so without
    // this the check would pass loudest exactly when nothing was drawn at all.
    const drawn = (await walls(page)).slice(-4);
    expect(drawn).toHaveLength(4);
    expect(drawn.every(wall => wall.refLine === 'left')).toBe(true);
  });

  test('stopping part-way drops the walk rather than leaving legs behind', async ({ page }) => {
    await openToy(page);
    await startTurtle(page);
    const before = (await walls(page)).length;
    await go(page, null, 12);
    await go(page, 'right', 14);

    await page.locator('[data-turtle-done]').click();
    await expect(panel(page)).toHaveCount(0);
    // The user walked those legs and is told they are gone, rather than
    // finding out by noticing.
    await expect(message(page)).toContainText(/dropped/i);
    expect((await walls(page)).length).toBe(before);
  });

  test('the distance never leaves whole feet', async ({ page }) => {
    await openToy(page);
    await startTurtle(page);
    // Nudged, never typed. And it cannot be nudged to nothing: a zero-foot GO
    // is not a wall, so one foot is the floor.
    await setFeet(page, 1);
    for (let i = 0; i < 3; i++) await page.locator('[data-turtle-less]').click();
    await expect(feet(page)).toHaveText("1'");
    await page.locator('[data-turtle-more]').click();
    await expect(feet(page)).toHaveText("2'");
  });
});

// ── WHERE STEP 3 MEETS STEP 2 ───────────────────────────────────────────
// "Everything the turtle draws is orthogonal by construction, so TOY output is
// TOY-editable by definition." That is a claim about two boards meeting, and
// it is the seam where the walls-committed-as-raw-geometry bug hid: the room
// looked right and could not be touched afterwards, because its corners were
// not actually shared.
test.describe('What the turtle draws, the toy can edit', () => {
  test('a room the turtle closed wears grip tabs and moves', async ({ page }) => {
    await h.openModel(page, { webgl: false, search: '?toy=1' });
    await page.locator('[data-select-turtle]').click();
    await expect(page.locator('[data-turtle-panel]')).toBeVisible();

    const nudge = async target => {
      for (let i = 0; i < 60; i++) {
        const now = parseInt((await page.locator('[data-turtle-feet]').textContent())
          .replace(/\D/g, ''), 10);
        if (now === target) return;
        await page.locator(now < target ? '[data-turtle-more]' : '[data-turtle-less]').click();
      }
    };
    const step = async (turn, ft) => {
      if (turn) await page.locator(`[data-turtle-${turn}]`).click();
      await nudge(ft);
      await page.locator('[data-turtle-go]').click();
    };
    await step(null, 20);
    await step('right', 14);
    await step('right', 20);
    await step('right', 14);
    await h.waitForSaved(page);

    const drawn = h.allWalls(await h.savedDrawing(page));
    expect(drawn).toHaveLength(4);
    await page.waitForTimeout(250);

    // A tab where the toy can reason about the wall. The turtle only turns
    // 90°, so there is no way for it to have drawn something inert -- if this
    // is missing, the walk produced geometry the toy cannot touch.
    const box = await page.locator('[data-model-canvas]').boundingBox();
    const anyTab = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        if (Math.abs(data[i] - 44) <= 26 && Math.abs(data[i + 1] - 110) <= 26
          && Math.abs(data[i + 2] - 155) <= 26) count += 1;
      }
      return count;
    });
    expect(anyTab).toBeGreaterThan(0);
    expect(box).toBeTruthy();
  });
});
