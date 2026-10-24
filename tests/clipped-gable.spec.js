// A GABLE WITH ITS CORNER CLIPPED AT 45, and the fit of an elevation.
//
// Movie, 23 Oct, E3 of his own drawing (proto/repro-movie-clipped-gable.draft
// is that file: a long bungalow whose gable end turns 45 at one corner, the
// roof's rake following the turn, with a porch under the rake past the 45
// wall): *"on this elevation the angled wall / roof has some problems the
// wall seam is warped - i marked in red where the 45 corner crease in the
// wall should be. the rest of the 'exposed' gable area of roof i show should
// all be the exterior finish (in green) but the roof is roof asphalt/
// fiberglass shingle showing through"*. And, on the same page: *"on the EXT
// finish and ELEVATION make sure it zooms out to show the entire building in
// addition to the ELEVATION marks on the side (elevation dimensions and
// about 10% extra cushion"*.
//
// THREE THINGS WERE WRONG AT THAT CORNER, and each is a claim here:
//
//   THE SEAM     the 45 wall climbed to the roof only from half a foot past
//                its corner, so its top jumped from the plate to the rake
//                over one station: the slant he marked. It climbs from the
//                corner now, and the corner is a plumb crease from the floor
//                to the rake.
//   THE GABLE    the rake runs on past the 45 wall over the porch; nothing
//                stood under that stretch and the far hip's shingles showed
//                through. The rest of the gable is filled as a wall there,
//                in the 45 wall's finish.
//   THE SOFFIT   and the foot or two of rake past an ordinary gable corner
//                is still the eave's soffit, not a gable: nothing fills it.
//
// AND THE FIT: EXT. FINISH fitted the drawing itself from the mark's ends,
// before the painter grew the mark out to the roof, and handed the painter a
// fit with no margins -- so the roof ran off the canvas and the level marks
// drew at a negative x. Both pages now take the painter's own fit, with the
// marks' gutter and a tenth of the drawing of air each side and sky above.
//
// Read off the painted canvas through the frame each page hands back, so no
// pixel here is a guess at where the painter put a foot.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-clipped-gable.draft'), 'utf8'));

// The plate of MAIN FL on this bungalow (0 + 8' 1 1/8"), which is where the
// gable triangle stands and what every height below is measured from. The
// roof bears there too, so the rake over the 45 wall is plate + (83 - u) / 3
// along the view, u being the plan's z: the gable corner is at u 65, the 45
// wall runs to 75, the rake to the eave corner at 83.
const PLATE = 8.09375;
const CORNER = 65, WALL_END = 75, EAVE_CORNER = 83;

async function openExt(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/EXTFINISH.html');
  await expect(page.locator('#elev-list [data-elev]').first()).toBeVisible({ timeout: 10000 });
  // E3 is the clipped end: the drawing is turned three quarters, so E3's
  // mark sits on the x = 0 side and looks at it from -x.
  await page.locator('[data-elev="E3"]').click();
  await page.waitForFunction(() => !!window.__extFinishFrame && window.__extFinishFrame.cut.id === 'E3');
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const { cut, axis, ...f } = window.__extFinishFrame;
    return f;
  });
}

// A box of canvas pixels round a point in the view's own feet, as RGB rows.
const boxAt = (page, f, u, e, half = 1) => page.evaluate(([x, y, half]) => {
  const c = document.getElementById('elev');
  const d = c.getContext('2d').getImageData(Math.round(x) - half, Math.round(y) - half, 2 * half + 1, 2 * half + 1).data;
  const out = [];
  for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]);
  return out;
}, [f.x0 + (u - f.uMin) * f.pxPerFt, f.y0 + (f.yTop - e) * f.pxPerFt, half]);
const same = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= 12;
const rakeAt = u => PLATE + (EAVE_CORNER - u) / 3;
// The scale a tenth of cushion produces from the fit the painter hands back:
// the drawing's span plus a tenth each side, its height plus a tenth of sky,
// into the room inside the margins. A fit with no cushion is a tenth or a
// fifth larger, so two percent of slack tells them apart.
const expectCushionedScale = f => {
  const want = Math.min(
    (f.w - f.marginL - f.marginR) / ((f.uMax - f.uMin) * 1.2),
    (f.h - f.marginT - f.marginB) / ((f.yTop - f.yFit) * 1.1));
  expect(f.cushion, 'the painter was asked for a tenth').toBeCloseTo(0.1, 5);
  expect(Math.abs(f.pxPerFt - want) / want,
    `${f.pxPerFt.toFixed(3)} px/ft drawn against ${want.toFixed(3)} with the cushion`).toBeLessThan(0.02);
};

test('the 45 corner is a plumb crease from the floor to the rake, and no wall line leans beside it', async ({ page }) => {
  const f = await openExt(page);
  // THE WALL'S OWN COLOUR, read off the middle of the gable wall.
  const [wall] = await boxAt(page, f, 30, PLATE - 3, 0);
  // THE CREASE: every row from just above the plate to just under the rake
  // has ink in the corner's column. The line is a pixel and a quarter wide
  // on a half-pixel centre, so a 3px box is read and any non-wall pixel in
  // it counts.
  const rows = [];
  for (let e = PLATE + 0.3; e <= rakeAt(CORNER) - 0.4; e += 0.1) {
    const px = await boxAt(page, f, CORNER, e, 1);
    rows.push(px.some(p => !same(p, wall)));
  }
  const inked = rows.filter(Boolean).length;
  expect(inked, `${inked} of ${rows.length} rows up the corner carry the crease`).toBeGreaterThanOrEqual(rows.length - 1);
  // AND NOTHING LEANS: three quarters of a foot along the 45 wall, from a
  // foot above the plate to under the rake, is wall colour and nothing else.
  // The slant he marked crossed this column; so did the shingles in the
  // notch the slant left.
  for (let e = PLATE + 1; e <= rakeAt(CORNER + 0.75) - 0.6; e += 0.25) {
    const px = await boxAt(page, f, CORNER + 0.75, e, 1);
    expect(px.every(p => same(p, wall)), `plain wall at u ${CORNER + 0.75}, ${e.toFixed(2)} ft`).toBe(true);
  }
});

test('the rest of the gable past the 45 wall is wall, not shingles, out to the eave corner', async ({ page }) => {
  const f = await openExt(page);
  const [wall] = await boxAt(page, f, 30, PLATE - 3, 0);
  // Inside the triangle between the 45 wall's end and the eave corner, under
  // the rake board (which hangs a fascia's depth, 5 1/2", below the rake):
  // a box the height of a course of shingles is one colour, the wall's.
  // Each point sits clear of the board above it and of the plate line
  // below it by more than the box reaches.
  for (const [u, e] of [[WALL_END + 1, PLATE + 1.2], [WALL_END + 2.5, PLATE + 0.85], [WALL_END + 3.5, PLATE + 0.6]]) {
    const px = await boxAt(page, f, u, e, 3);
    const off = px.filter(p => !same(p, wall)).length;
    expect(off, `${off} of ${px.length} pixels at u ${u}, ${e.toFixed(2)} ft are not wall`).toBe(0);
  }
  // (The eave's soffit past the OTHER gable corner staying open is checked
  // offline, in proto/elevation-harness.js: on screen the rake board covers
  // all but a sliver of that triangle.)
});

test('EXT. FINISH fits the whole building and its level marks, a tenth of air each side', async ({ page }) => {
  const f = await openExt(page);
  // THE ROOF RUNS u -2..89 ON THIS VIEW (the eave past the house on both
  // sides, 6 ft further on the right for the bump). All of it on the canvas,
  // inside the marks' gutter on the left and the tail on the right, with a
  // tenth of the drawing's width of air beyond each end -- 8% asked, so a
  // rounding of the fit cannot fail this.
  const X = u => f.x0 + (u - f.uMin) * f.pxPerFt;
  const span = X(89) - X(-2);
  expect(f.uMin, 'the frame starts at the roof\'s own end').toBeLessThanOrEqual(-2);
  expect(X(-2) - 64, `air left of the roof: ${(X(-2) - 64).toFixed(0)}px against ${(span * 0.08).toFixed(0)}`).toBeGreaterThanOrEqual(span * 0.08);
  expect(f.w - 24 - X(89), `air right of the roof: ${(f.w - 24 - X(89)).toFixed(0)}px`).toBeGreaterThanOrEqual(span * 0.08);
  // AND THE READINGS ARE ON THE PAGE: the level rule for the plate runs out
  // into the gutter left of the drawing, where before it drew at a negative
  // x. A faint rule, so any pixel off the paper in a 3px box is enough.
  const [paper] = await boxAt(page, f, -2 - 30 / f.pxPerFt, PLATE + 20, 0);
  const gutter = await page.evaluate(([x, y]) => {
    const c = document.getElementById('elev');
    const d = c.getContext('2d').getImageData(Math.round(x) - 1, Math.round(y) - 1, 3, 3).data;
    const out = [];
    for (let i = 0; i < d.length; i += 4) out.push([d[i], d[i + 1], d[i + 2]]);
    return out;
  }, [f.x0 - 10, f.y0 + (f.yTop - PLATE) * f.pxPerFt]);
  expect(gutter.some(p => !same(p, paper)), 'the plate\'s level rule reaches into the gutter').toBe(true);
  expectCushionedScale(f);
});

test('MODEL\'s E3 fits the same way', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?theme=rough&mode=day&level=3&view=cut%3AE3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForFunction(() => !!window.__elevFrame);
  await page.waitForTimeout(500);
  const read = await page.evaluate(() => ({ ...window.__elevFrame }));
  const X = u => read.x0 + (u - read.uMin) * read.pxPerFt;
  const span = X(89) - X(-2);
  expect(read.uMin).toBeLessThanOrEqual(-2);
  // The painter's own gutter and tail, then the cushion inside them.
  expect(X(-2) - 64, `air left of the roof: ${(X(-2) - 64).toFixed(0)}px of ${span.toFixed(0)}`).toBeGreaterThanOrEqual(span * 0.08);
  expect(read.w - 24 - X(89), `air right of the roof: ${(read.w - 24 - X(89)).toFixed(0)}px`).toBeGreaterThanOrEqual(span * 0.08);
  // AND THE SCALE IS THE CUSHIONED ONE, whichever way the window limits it:
  // the drawing a fifth wider and a tenth taller than it is, fitted into the
  // room the margins leave. The painter hands the whole fit back, so this is
  // arithmetic on its own numbers rather than a hunt for ink.
  expectCushionedScale(read);
});
