// ARRIVING AT THE SITE PLAN SHOWS THE SITE (Movie, 14 Oct): "also on the SITE
// plan when the user brings it up zoom to show the full site, dimensions and
// E1-E4 which will be located around the perimeter of the site and
// dimensions".
//
// WHY IT DID NOT. `fit()` frames what `allPoints` measures -- walls, lines
// and floors, which is the BUILDING -- and on every other level the building
// is the subject. On this one it is a thing standing on the subject, so the
// fit framed the house and left the lot, its two rows of figures and the ring
// of elevation marks outside the window.
//
// MEASURED AS A QUESTION ABOUT THE WINDOW, not about a zoom number: every
// corner of the lot, both ends of every dimension row, and all four marks
// have to land inside the canvas, with the drawing not shrunk to a dot.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// A 100 x 160 LOT, chosen so that no accident can pass this. The fallback a
// broken fit falls to is a fixed 6 px/ft, and at 6 px/ft a 120 ft lot lands
// exactly on the edges of a 720px canvas -- which "is it inside" calls a pass.
// 160 ft cannot: it is 960px at that scale, so a fit that never framed the
// site is off the sheet and says so.
const LOT = { x: 50, z: 80 };          // half width, half depth
const HOUSE = { x: 20, z: 15 };
const rect = (half, extra) => ({
  points: [{ x: half.x, z: -half.z }, { x: -half.x, z: -half.z },
    { x: -half.x, z: half.z }, { x: half.x, z: half.z }],
  ...extra,
});
const wall = (id, x0, z0, x1, z1) => ({
  id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
});
const DRAWING = {
  format: 'draft-drawing', version: 1,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -10 }],
  walls: [wall('n', -20, -15, 20, -15), wall('e', 20, -15, 20, 15),
    wall('s', 20, 15, -20, 15), wall('w', -20, 15, -20, -15)],
  outlines: [
    rect(LOT, { id: 'lot', site: true, levelId: 8 }),
    rect(HOUSE, { id: 'house', levelId: 3 }),
  ],
  board: 'drafting',
};

async function open(page, level) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: DRAWING });
  await page.addInitScript(saved => { window.__fitDrawing = saved; }, DRAWING);
  await page.goto(`/MODEL.html?level=${level}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// WHERE A WORLD POINT LANDS ON THE CANVAS, off the readout's own published
// scale and the canvas centre -- the same arithmetic every other MODEL.html
// spec uses, so this is not a second opinion about the projection.
async function projector(page) {
  // THE VIEW ITSELF, not a scale and an assumption about the middle. fit()
  // offsets the drawing's centre so it lands in the band the bars leave open,
  // so "height / 2 + z * scale" is wrong by that offset -- which is how the
  // first cut of this spec reported a mark 42px off the bottom of a canvas it
  // was comfortably inside.
  const view = JSON.parse(await page.locator('#plan').getAttribute('data-view'));
  const box = await page.locator('#plan').boundingBox();
  return {
    scale: view.scale,
    box,
    at: (x, z) => ({
      x: box.width / 2 + (x - view.cx) * view.scale,
      y: box.height / 2 + (z - view.cz) * view.scale,
    }),
  };
}

const inside = (p, box) => p.x >= 0 && p.x <= box.width && p.y >= 0 && p.y <= box.height;

test('the whole lot, its dimension rows and the marks are in the window', async ({ page }) => {
  await open(page, 8);
  const { scale, box, at } = await projector(page);
  // THE LOT'S FOUR CORNERS.
  [[LOT.x, LOT.z], [-LOT.x, LOT.z], [-LOT.x, -LOT.z], [LOT.x, -LOT.z]].forEach(([x, z]) => {
    const p = at(x, z);
    expect(inside(p, box), `the lot corner ${x},${z} lands at ${Math.round(p.x)},${Math.round(p.y)}`)
      .toBe(true);
  });
  // AND EVERYTHING DRAWN OUTSIDE IT: the rows at 3 ft and 5 ft, and the mark
  // ring beyond them. Read off the page rather than restated here.
  const far = await page.evaluate(() => ({
    marks: JSON.parse(document.getElementById('plan').getAttribute('data-e-marks-drawn') || '[]')
      .flatMap(m => [m.a, m.b]),
    rows: (window.DraftLayoutPlan.siteDimStrings(window.__fitDrawing) || [])
      .flatMap(r => [[r.start.x, r.start.z], [r.end.x, r.end.z]]),
  }));
  [...far.marks, ...far.rows].forEach(([x, z]) => {
    const p = at(x, z);
    expect(inside(p, box), `${x},${z} -- drawn outside the lot -- lands at ${Math.round(p.x)},${Math.round(p.y)}`)
      .toBe(true);
  });
  // AND NOT SHRUNK TO A DOT to achieve it, or "everything fits" is true of
  // any zoom far enough out.
  //
  // MEASURED DOWN THE SHEET, not across it. A deep lot in a wide window is
  // bound by the height -- this fixture is 160 ft front to back and 100 across
  // in a 1280 x 720 canvas -- so the lot fills two thirds of the height and a
  // quarter of the width, and a width test calls a correct fit a speck. The
  // first cut of this check did exactly that.
  expect(2 * LOT.z * scale, 'the lot is a speck in the middle of the sheet')
    .toBeGreaterThan(box.height * 0.5);
});

test('with the elevation marks switched off, the lot alone still frames it',
  async ({ page }) => {
    // THE RING IS WHAT STANDS FURTHEST OUT on a site plan, so folding it in
    // frames the lot and its rows by implication -- while a drafter leaves
    // the marks on. Switched off (SETTINGS' autoElevations, which is a real
    // standard a drafter sets), there is no ring, and the lot has to be
    // framed on its own account. This is the check that holds that half of
    // the code down: without it a mutant that drops the lot still passes.
    await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({
      format: 'draft-profile-package',
      kind: 'standards',
      content: { model: { structureStandards: { autoElevations: false } } },
    })), 'draft-active-package:standards');
    await open(page, 8);
    const marks = JSON.parse(
      await page.locator('#plan').getAttribute('data-e-marks-drawn') || '[]');
    expect(marks.length, 'the marks are supposed to be off for this check').toBe(0);
    const { scale, box, at } = await projector(page);
    [[LOT.x, LOT.z], [-LOT.x, LOT.z], [-LOT.x, -LOT.z], [LOT.x, -LOT.z]].forEach(([x, z]) => {
      const p = at(x, z);
      expect(inside(p, box), `the lot corner ${x},${z} lands at ${Math.round(p.x)},${Math.round(p.y)}`)
        .toBe(true);
    });
    expect(2 * LOT.z * scale, 'the lot is a speck in the middle of the sheet')
      .toBeGreaterThan(box.height * 0.5);
  });

test('and a floor plan still frames the house, not the lot', async ({ page }) => {
  // THE SCOPING IS THE POINT. On a storey the building is the subject, and a
  // view backed off to take in a 120 ft lot would make every floor plan tiny.
  await open(page, 3);
  const { scale, box } = await projector(page);
  // The house is 40 x 30 in the same window, and on a storey it is the
  // subject: it should fill a good share of the height, as the lot does on
  // the site.
  expect(2 * HOUSE.z * scale, 'the house is not what the floor plan framed')
    .toBeGreaterThan(box.height * 0.3);
});
