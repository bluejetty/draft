// THE CORNER UNDER THE CURSOR LIGHTS UP.
//
// MODEL.html has known where the grab was since the corner drag landed --
// cornerAt runs on every pointermove -- and said so only through a CSS cursor.
// A drafter learned where a node was grabbable by sweeping the mouse and
// watching the pointer flicker, and on a touch screen, where there is no
// cursor at all, never learned it.
//
// MEASURED AS PIXELS, NOT AS STATE. "The page thinks a corner is hovered" is
// the claim a check can make without the drafter ever seeing anything; what is
// asserted here is ink on the canvas, in the place the corner is, and its
// absence where there is no corner.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });

// SYMMETRIC ABOUT THE ORIGIN so the fitted view is predictable, and one wall
// only: the corner under test is its end, with nothing else near enough to
// confuse which node the ring belongs to.
const base = extra => ({
  version: 1,
  board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [{ id: 'w1', start: V(-6, 0), end: V(6, 0), levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' }],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// THE RING'S OWN INK, counted in a small box around a world point. The ring is
// rgba(89,128,166,.85); the wall is drawn in the page's line ink and the ground
// is pale, so "pixels close to the select blue" is the ring and nothing else.
const ringInkNear = (page, x, z) => page.evaluate(([wx, wz]) => {
  const c = document.getElementById('plan');
  const view = c.getAttribute('data-view');
  const [cx, cz, scale] = view.trim().split(/\s+/).map(Number);
  const r = c.getBoundingClientRect();
  const px = Math.round((wx - cx) * scale + r.width / 2);
  const py = Math.round((wz - cz) * scale + r.height / 2);
  const dpr = c.width / r.width;
  const g = c.getContext('2d');
  const half = 14;
  const d = g.getImageData(Math.round((px - half) * dpr), Math.round((py - half) * dpr),
    Math.round(half * 2 * dpr), Math.round(half * 2 * dpr)).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    // Near #5980a6 (89,128,166): blue clearly ahead of red, and mid-toned.
    if (d[i + 2] > d[i] + 30 && d[i + 2] > 110 && d[i] < 170) n++;
  }
  return n;
}, [x, z]);

// Hover a world point without pressing — AND PROVE IT LANDED ON THE SHEET.
//
// The fixture is one 12ft wall, so fit() zooms to ~92 px/ft and the canvas
// covers barely +/-4ft of z. My first "move away from the corner" aimed at
// world (0,5), which is y=818 on a 720px canvas: the pointer never reached the
// canvas at all, the hover state kept its previous value, and the check read
// that as "the ring did not clear". An off-canvas hover and a broken feature
// look identical, which is the same trap model-html-draw-delete writes up for
// taps. Asserted rather than assumed.
async function hover(page, x, z) {
  const { at } = await h.planFrame(page);
  const box = await page.locator('#plan').boundingBox();
  const [px, py] = at(x, z);
  expect(px >= box.x && px <= box.x + box.width
      && py >= box.y && py <= box.y + box.height,
  `world (${x}, ${z}) is off the canvas — the hover would land nowhere`)
    .toBe(true);
  await page.mouse.move(px, py);
  await page.waitForTimeout(150);
}

test('hovering a corner of the selected wall paints a ring on it',
  async ({ page }) => {
    await open(page);
    // SELECTION FIRST: this page only offers handles on a wall already chosen,
    // so a ring before that would be promising a grab the drag would refuse.
    const { at } = await h.planFrame(page);
    await page.mouse.click(...at(0, 0));
    await page.waitForTimeout(150);

    const before = await ringInkNear(page, -6, 0);
    await hover(page, -6, 0);
    const after = await ringInkNear(page, -6, 0);

    expect(after, `the corner carries ring ink while hovered `
      + `(${before} -> ${after})`).toBeGreaterThan(before);
    expect(after, 'and it is a ring, not a stray pixel').toBeGreaterThan(20);
  });

test('the ring follows the cursor off the corner, and leaves nothing behind',
  async ({ page }) => {
    // THE HALF A "DOES IT APPEAR" CHECK MISSES. A ring that is painted and
    // never cleared looks correct on the way in and wrong ever after: every
    // corner the cursor has visited stays lit, which is worse than no ring at
    // all because it is a promise about where the grab is that is false
    // everywhere except the last place.
    await open(page);
    const { at } = await h.planFrame(page);
    await page.mouse.click(...at(0, 0));
    await page.waitForTimeout(150);

    await hover(page, -6, 0);
    const lit = await ringInkNear(page, -6, 0);
    expect(lit, 'the corner lit first').toBeGreaterThan(20);

    // Out to bare sheet: 2ft below the wall is ~183px at this fit, far
    // outside the 30px grab zone, and still on the canvas.
    await hover(page, 0, 2);
    const afterLeaving = await ringInkNear(page, -6, 0);
    expect(afterLeaving,
      `the ring left with the cursor (${lit} -> ${afterLeaving})`)
      .toBeLessThan(lit);
  });

test('bare sheet gets no ring — the mark means a grab, not a cursor position',
  async ({ page }) => {
    await open(page);
    const { at } = await h.planFrame(page);
    await page.mouse.click(...at(0, 0));
    await page.waitForTimeout(150);

    await hover(page, 4, 2);          // nothing there, and on the sheet
    const ink = await ringInkNear(page, 4, 2);
    expect(ink, 'no ring where there is no corner').toBeLessThan(20);
  });

test('a corner of an UNSELECTED wall gets no ring, matching what the drag offers',
  async ({ page }) => {
    // cornerAt only returns a corner of a wall that is already selected -- the
    // page's own rule, so that a pan begun near any corner still pans. The ring
    // is painted from that same answer, which is the point: it cannot advertise
    // a grab the gesture would refuse, because there is only one hit test.
    await open(page);
    await hover(page, -6, 0);         // nothing selected yet
    const ink = await ringInkNear(page, -6, 0);
    expect(ink, 'an unselected wall offers no handle, so it shows none')
      .toBeLessThan(20);
  });
