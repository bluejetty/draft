// TIER 3A — MODEL.html's first editing tool: click a wall and it lights up.
//
// The page could read, draw and save before this; it could not be TOUCHED.
// Selection is the smallest honest first rung, and this file proves it the way
// model-html-joins.spec.js proves mitres: WHOLE-CANVAS HASHES, no colour
// sampling and no thresholds.
//
// THE PREMISE. Nothing in the drawing changes when a wall is selected -- the
// walls, floors, dimensions and grid are identical in every render below. The
// ONLY thing that can differ between two of these hashes is the selection
// overlay. So a difference proves the overlay painted, and an equality proves
// it did not, with nothing else able to move underneath.
//
// WHY THE OVERLAY AND NOT THE PAINTER. MODEL.dc.html splits selection by what
// is selected: AREAS go through their painter with { selected: true }
// (:7393, drawFloor2D), SEGMENTS get a separate pass (:7380). drawWallSeg2D
// has no `selected` key at all -- drawRoof2D, drawFixture2D and drawFloor2D
// do. A wall is a segment, so this page draws the overlay, matching the old
// page rather than adding a key to a shared painter that never had one.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const PROFILE_KEY = 'draft-active-package:standards';   // profile-manager.js:7

const canvasHash = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
  let n = 0x811c9dc5;
  for (let i = 0; i < data.length; i += 4) {
    n ^= data[i] | (data[i + 1] << 8) | (data[i + 2] << 16);
    n = Math.imul(n, 0x01000193) >>> 0;
  }
  return `${n.toString(16)}:${c.width}x${c.height}`;
});

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  await page.evaluate(key => localStorage.setItem(key, JSON.stringify({
    format: 'draft-profile-package',
    kind: 'standards',
    content: { model: { structureStandards: { autoElevations: false } } },
  })), PROFILE_KEY);
}

// TWO WALLS, ARRANGED SO THE CANVAS CENTRE LANDS ON ONE OF THEM. The page
// fits the drawing on load, so the centre of the canvas is the centre of the
// bounding box -- x -10..10, z -5..5 here, centre (0, 0). Wall `a` runs
// straight through that point.
//
// That is what lets every click below be expressed in pixels from the centre
// with no world-to-screen mapping: the page's toS lives inside its closure and
// a test-only hook to reach it would be a worse fixture than arithmetic.
const FIXTURE = `
  d.walls = [
    { id: 'a', start: { x: -10, z: 0 }, end: { x: 10, z: 0 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6' },
    { id: 'b', start: { x: -10, z: -5 }, end: { x: -10, z: 5 },
      levelId: ${MAIN_FL}, view: 'plan', wallType: 'stud_2x6' }
  ];
  d.lines = []; d.floors = []; d.dimensions = []; d.roofs = []; d.shapes = [];
  return d;`;

async function open(page) {
  await page.evaluate(async ({ bucket, src }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', src)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src: FIXTURE });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls 2/2', { timeout: 6000 });
}

// Click at an offset in CSS pixels from the canvas centre.
async function clickAt(page, dx, dy) {
  const box = await page.locator('#plan').boundingBox();
  await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
  await page.waitForTimeout(60);
}

test.describe('MODEL.html selection', () => {
  test('a click on a wall highlights it; an empty click and Escape clear it',
    async ({ page }) => {
      await houseOnOldPage(page);
      await open(page);

      const unselected = await canvasHash(page);

      // CONTROL, and every assertion below is worthless without it: the same
      // drawing must paint the same pixels twice. Each test here is an
      // inequality against `unselected`, so a render that wobbled on its own
      // would satisfy them all for the wrong reason.
      await clickAt(page, 0, -300);   // far above the walls: hits nothing
      expect(await canvasHash(page),
        'an empty click must repaint identically, or no inequality below means '
        + 'anything').toBe(unselected);

      // THE WALL IS AT THE CENTRE. A click on it must change the picture.
      await clickAt(page, 0, 0);
      const selected = await canvasHash(page);
      expect(selected,
        'clicking a wall must paint the selection overlay -- the drawing is '
        + 'unchanged, so this hash can only differ by the highlight')
        .not.toBe(unselected);

      // AND IT MUST COME BACK OFF. Without this the drafter can select but
      // never deselect, which is half a tool.
      await clickAt(page, 0, -300);
      expect(await canvasHash(page), 'an empty click must clear the selection')
        .toBe(unselected);

      // Escape is the other way out, and it is the one a drafter reaches for.
      await clickAt(page, 0, 0);
      expect(await canvasHash(page), 're-selecting must work after a clear')
        .toBe(selected);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(60);
      expect(await canvasHash(page), 'Escape must clear the selection')
        .toBe(unselected);
    });

  test('the grab zone has an edge: a click well off the wall selects nothing',
    async ({ page }) => {
      await houseOnOldPage(page);
      await open(page);
      const unselected = await canvasHash(page);

      // 4px off centre is inside the 12px grab zone.
      await clickAt(page, 0, 4);
      expect(await canvasHash(page),
        'a click 4px from the wall is inside the 12px grab zone and must select')
        .not.toBe(unselected);

      await page.keyboard.press('Escape');
      await page.waitForTimeout(60);

      // 40px off is well outside it. WITHOUT THIS the hit test could match
      // every wall at any distance and the test above would still pass -- a
      // selector that always selects is not a selector.
      await clickAt(page, 0, 40);
      expect(await canvasHash(page),
        'a click 40px from the wall is outside the grab zone and must select '
        + 'nothing -- otherwise the hit test is not testing distance at all')
        .toBe(unselected);
    });

  test('a drag pans and does not select', async ({ page }) => {
    await houseOnOldPage(page);
    await open(page);
    const unselected = await canvasHash(page);

    // Dragging FROM the wall. Every pointerdown starts a pan on this page, so
    // selection decides on release by how far the pointer travelled. A drag
    // that began on a wall must move the sheet and leave nothing selected --
    // otherwise panning would select whatever it started on, every time.
    const box = await page.locator('#plan').boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 120, cy + 40, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(60);

    const panned = await canvasHash(page);
    expect(panned, 'the drag must have moved the view').not.toBe(unselected);

    // Pan back the same distance: if nothing was selected the picture returns.
    await page.mouse.move(cx + 120, cy + 40);
    await page.mouse.down();
    await page.mouse.move(cx, cy, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(60);
    expect(await canvasHash(page),
      'panning back must restore the original picture -- if the drag had also '
      + 'selected the wall it started on, the highlight would still be here')
      .toBe(unselected);
  });
});
