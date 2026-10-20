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
  await page.locator('#dt-banner-outline').click();
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

// ── NO 45 OF THE ROOF'S OWN (Movie, 16 Oct) ────────────────────────────────
//
// "you know about these 45 degree roof corners we need to get rid of right",
// and on the 15th: "those 45 degree corners aren't necessary ... they should
// been all 90 degrees no 45s" ... "there might be a 45 but not in those
// situation, only if you really need it for a cricket". So the build cuts no
// cricket: the inside corner of the roof over a house and its garage is a
// corner, the valley runs to it, and every edge of the ring is one of the
// building's own. geometry-2d's cricketRing waits for the day he adds one
// himself. proto/roof-no-45s-mutants.js is this spec's gate.
const axisAligned = (a, b) => Math.abs(a.x - b.x) < 1e-6 || Math.abs(a.z - b.z) < 1e-6;

test('the inside corner is a corner: no cricket, and no 45 anywhere on the ring',
  async ({ page }) => {
    const saved = await buildIt(page);
    const roof = roofOf(saved);
    expect(roof, 'one roof over both bodies').toBeTruthy();
    const dead = deadCornerOf(roof);
    const away = pt => awayFrom(dead, pt);
    const atCorner = roof.points.filter(pt => away(pt) < 0.01);
    expect(atCorner, 'the inside corner is a corner of the roof').toHaveLength(1);
    const near = roof.points.filter(pt => away(pt) < 3.5);
    expect(near, `only the corner stands within 3 1/2 ft of it: ${JSON.stringify(near)}`).toHaveLength(1);
    roof.points.forEach((pt, i) => {
      const next = roof.points[(i + 1) % roof.points.length];
      expect(axisAligned(pt, next), `edge ${i} runs at an angle: ${JSON.stringify([pt, next])}`).toBe(true);
    });
  });

test('and the valley runs to the corner', async ({ page }) => {
  const saved = await buildIt(page);
  const roof = roofOf(saved);
  const dead = deadCornerOf(roof);
  const away = pt => awayFrom(dead, pt);
  const ends = await page.evaluate(r => {
    const arcs = window.DraftGeometry2D.roofSkeleton(r);
    return arcs.filter(a => Math.min(a.ta, a.tb) < 0.01)
      .flatMap(a => [a.a, a.b]).map(p => ({ x: p.x, z: p.z }));
  }, { points: roof.points, edges: roof.edges, pitch: roof.pitch || 6 });
  const closest = Math.min(...ends.map(away));
  expect(closest, `the nearest valley end is ${closest.toFixed(2)} ft from the corner, not on it`)
    .toBeLessThan(0.05);
});
