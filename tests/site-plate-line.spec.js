// THE TOP PLATES THE ROOF RESTS ON, ON THE SITE PLAN.
//
// Movie, 14 Oct: "please show the outline of the top plates of walls that the
// roof rests on that are n the roof plan - show those lines also in the site
// plane".
//
// THEY WERE DRAWN ALREADY, AND INVISIBLE. The site plan's footprint IS the
// roof plan -- his own ruling earlier the same day: "the ROOF PLAN with the
// WALL OUTLINES would be a good drawing to use for the FOOTPRINT" -- so
// layout-plan has carried those lines since the footprint did, in `#1d1f20`.
// That is the sheet's paper ink, and on MODEL's black ground it is black on
// black. He was asking for lines that were already under his cursor.
//
// SO THIS FILE IS ABOUT INK, not geometry. proto/layout-plan-harness.js pins
// the painter's half offline -- paper by default, the caller's ink when it
// hands one -- and what only a browser can answer is whether MODEL hands it
// one, which is the whole of the fix.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const SITE = 8;
// HIS OWN GARAGE, the drawing the report came off: a 24 x 30 detached garage
// with a roof over it. The roof matters -- roofPlanWalls answers the walls a
// ROOF rests on, so a drawing without one has no plate line to draw.
const GARAGE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-detached-2storey.draft'), 'utf8'));

async function openSite(page, drawing) {
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.goto(`/MODEL.html?mode=night&level=${SITE}&view=plan`);
  await expect(page.locator('#readout')).toContainText(/scale|walls/, { timeout: 10000 });
  await page.waitForTimeout(500);
}
// THE SAME FRAME FOR BOTH CENSUSES. The fit takes in the ring of E marks,
// and the marks come off the walls: without them the fit is tighter, the
// lot draws bigger and lights more pixels on its own (the rows and the ring
// stand out in paper since 26 Oct, so the difference is no longer small).
// Both are looked at through one window, set in the same breath as the
// count so no late fit can move it between the two.
// Closed in on the building at ten pixels a foot, so the plate line is a
// line and not a few pixels.
const frameOf = page => page.evaluate(() => {
  const pts = (drawing.roofs || []).flatMap(r => r.points || []);
  const cx = (Math.min(...pts.map(p => p.x)) + Math.max(...pts.map(p => p.x))) / 2;
  const cz = (Math.min(...pts.map(p => p.z)) + Math.max(...pts.map(p => p.z))) / 2;
  return { cx, cz, scale: 10 };
});

// TWO CENSUSES OF ONE CANVAS, taken together so a repaint cannot move one of
// them: how much ink is the skin's wall-edge grey, and how much of the sheet
// is LIGHT at all. A tolerance is unavoidable -- a stroke antialiases against
// what is under it -- and it is kept to 30, well inside the gap between this
// grey and the page's own near-black ground.
const census = (page, frame = null) => page.evaluate(frame => {
  if (frame) { Object.assign(view, frame); paint(); }
  const root = getComputedStyle(document.documentElement);
  const hex = (root.getPropertyValue('--draw-wall-edge').trim()
    || root.getPropertyValue('--draw-line').trim());
  const want = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const el = document.getElementById('plan');
  const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
  let ink = 0, light = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - want[0]) <= 30 && Math.abs(d[i + 1] - want[1]) <= 30
      && Math.abs(d[i + 2] - want[2]) <= 30) ink += 1;
    if (d[i] > 120 && d[i + 1] > 120 && d[i + 2] > 120) light += 1;
  }
  return { hex, ink, light };
}, frame);

test('the site plan draws the plate line, and the roof\'s own walls put it there',
  async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await openSite(page, GARAGE);
    const frame = await frameOf(page);
    const withWalls = await census(page, frame);
    expect(withWalls.hex, 'the skin publishes a wall-edge ink').toMatch(/^#[0-9a-f]{6}$/i);
    // ATTRIBUTED RATHER THAN COUNTED. A number on its own cannot say WHICH
    // line it found -- the property line, the dimension rows and the roof are
    // all on this sheet. Take the walls away and `roofPlanWalls` answers
    // nothing, so the plate line is the one thing that leaves; the lot and
    // the roof are drawn off records this does not touch and stay as they
    // were.
    await openSite(page, { ...GARAGE, walls: [] });
    const without = await census(page, frame);
    expect(withWalls.ink, `${withWalls.ink} px of ${withWalls.hex} with the walls, `
      + `${without.ink} without`).toBeGreaterThan(without.ink + 300);
  });

test('and in ink that reads on a dark page, not the sheet\'s paper black',
  async ({ page }) => {
    // THE WHOLE REPORT IN ONE NUMBER. The line was being drawn before this
    // change too -- in #1d1f20, which is three greys off the page's own
    // ground. So the claim is not "more ink" but "more LIGHT": paper black
    // cannot put a bright pixel on a black sheet however much of it is drawn.
    await h.openModel(page, { webgl: false });
    await openSite(page, GARAGE);
    const frame = await frameOf(page);
    const withWalls = await census(page, frame);
    await openSite(page, { ...GARAGE, walls: [] });
    const without = await census(page, frame);
    expect(withWalls.light, `${withWalls.light} light px with the walls, `
      + `${without.light} without`).toBeGreaterThan(without.light + 300);
  });
