// NO VALLEY RUNS INTO A CORNER — THE CRICKET, ON A ROOF THAT WAS BUILT.
//
// Movie, 19 Sep, on two roofs meeting: it "will need a 'cricket' between the
// roofs at places where low points could cause water damage". Asked on
// 14 Oct what the two feet in his note measure: "keep the valley 2ft from
// the corner so 2ft of extra watershed rather than valley running into the
// corner". And asked how far to take it: model it fully, not just on the
// roof plan.
//
// WHICH IT IS, BY CONSTRUCTION. A cricket bears on another roof's SLOPING
// plane, so a roof record -- which bears on a level's plate -- cannot hold
// one. Cut as a chamfer of the roof's own outline it needs no new record at
// all: the skeleton, the faces, the 3D lift, the elevations and the sections
// read the ring they already read. proto/roof-skeleton-harness.js pins the
// geometry offline, in feet; this file is the other half of that claim --
// that a roof the BONE builds comes out carrying it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const ROOF = 7;
// MATCHED TOPS, which is the condition for one roof over both bodies
// (garage-roofs: "if both walls are same height exactly they should be ONE
// roof"). Two roofs at different heights never make this valley.
const base = () => ({
  format: 'draft-drawing', version: 1,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 }],
  board: 'drafting',
  levelAssemblies: { 3: { wallHeightFt: 109.125 / 12 } },
});
const HOUSE = [[-10, -8], [10, -8], [10, 8], [-10, 8]];
// In front of the house and past its right corner: the L whose inside corner
// at (-2, 8) is the one water from both wings runs to.
const GARAGE = [[-2, 8], [12, 8], [12, 24], [-2, 24]];
// THE INSIDE CORNER OF THE WALLS. The ROOF's own corner is this one pushed
// out by the overhang along each leg -- the roof points are the overhung
// ring, which is the shape the valley is actually cut in -- so it is derived
// from the roof rather than typed, and a change to the eave moves it.
const WALL_CORNER = { x: -2, z: 8 };
const deadCornerOf = roof => ({
  x: WALL_CORNER.x - (roof.overhang || 0),
  z: WALL_CORNER.z + (roof.overhang || 0),
});

async function buildIt(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: base() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="bungalow-garage"]').click();
  await page.locator('#dt-outline').click();
  await expect(page.locator('#drivethru')).toBeHidden();
  // The press seeds a corner on the bullseye; this house and garage are
  // traced about the origin, not from it, so it comes back off first.
  await h.dropSeededCorner(page);
  const { at } = await h.planFrame(page);
  const trace = async corners => {
    for (const [x, z] of [...corners, corners[0]]) await page.mouse.click(...at(x, z));
    await page.waitForTimeout(200);
    for (const sel of ['#garage-lesson', '#corner-join']) {
      if (await page.locator(sel).isVisible().catch(() => false)) {
        await page.keyboard.press('Enter');
        await page.waitForTimeout(150);
      }
    }
  };
  await trace(HOUSE);
  await page.waitForTimeout(250);
  await trace(GARAGE);
  await page.waitForTimeout(800);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

const roofOf = saved => (saved.roofs || []).find(r => Number(r.levelId) === ROOF);
const awayFrom = (dead, pt) => Math.hypot(pt.x - dead.x, pt.z - dead.z);

test('the roof over a house and its garage has its inside corner cut back',
  async ({ page }) => {
    const saved = await buildIt(page);
    const roof = roofOf(saved);
    expect(roof, 'one roof over both bodies').toBeTruthy();
    const dead = deadCornerOf(roof);
    const away = pt => awayFrom(dead, pt);
    // THE CORNER ITSELF IS GONE, and two points stand where it was. Asked of
    // the record rather than of a picture: this is the shape every reader
    // downstream -- skeleton, faces, elevations, sections, DXF -- works from.
    const atCorner = roof.points.filter(pt => away(pt) < 0.01);
    expect(atCorner, 'the dead corner is still a corner').toHaveLength(0);
    const near = roof.points.filter(pt => away(pt) < 3.5);
    expect(near.length, `points near the corner: ${JSON.stringify(near)}`).toBe(2);
    // AND THE CUT IS 2 FT, measured along each leg from where the corner was.
    near.forEach(pt => expect(Math.abs(away(pt) - 2),
      `a cricket end ${away(pt).toFixed(2)} ft off the corner, not 2`).toBeLessThan(0.01));
  });

test('and the valley stops 2 ft short of it instead of running in',
  async ({ page }) => {
    // HIS SENTENCE AS A NUMBER: "keep the valley 2ft from the corner". The
    // skeleton is asked of the roof as built, through the page's own
    // geometry, so this is the line that will be drawn and framed.
    const saved = await buildIt(page);
    const roof = roofOf(saved);
    const dead = deadCornerOf(roof);
    const away = pt => awayFrom(dead, pt);
    const ends = await page.evaluate(r => {
      const arcs = window.DraftGeometry2D.roofSkeleton(r);
      // An arc touching the eave is a valley or a hip off the perimeter;
      // what matters is how close any of them now gets to the corner.
      return arcs.filter(a => Math.min(a.ta, a.tb) < 0.01)
        .flatMap(a => [a.a, a.b]).map(p => ({ x: p.x, z: p.z }));
    }, { points: roof.points, edges: roof.edges, pitch: roof.pitch || 6 });
    const closest = Math.min(...ends.map(away));
    expect(Math.abs(closest - 2),
      `the nearest valley end is ${closest.toFixed(2)} ft from the corner, not 2`)
      .toBeLessThan(0.05);
  });

test('the cricket is an eave, with the roof\'s own overhang along it',
  async ({ page }) => {
    // It is open roof over the corner, not a sheet dying into a wall -- so
    // it carries a board like any other eave. A gable here would draw a rake
    // across the valley and tell a framer the wrong thing.
    const saved = await buildIt(page);
    const roof = roofOf(saved);
    const dead = deadCornerOf(roof);
    const away = pt => awayFrom(dead, pt);
    const first = roof.points.findIndex(pt => away(pt) < 3.5 && away(pt) > 0.01);
    expect(first, 'no cricket on the roof').toBeGreaterThanOrEqual(0);
    expect(roof.edges[first], 'the cricket is not an eave').toBe('eave');
    if (Array.isArray(roof.edgeOverhang)) {
      expect(roof.edgeOverhang[first], 'the cricket carries no overhang')
        .toBeGreaterThan(0);
    }
  });
