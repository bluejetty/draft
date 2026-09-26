// AN ELEVATION IS DRAWN IN THE WHITE THE SIDE MENUS LEAVE IT.
//
// Movie, 22 Sep 2026, with both rails open on E4:
//
//   "when the side menus are open they cover the drawing in elevation, can we
//    make the zoom for the elevations so the house is a little smaller and
//    there is more white around the edges and sides so these menus when
//    expanded don't cover it"
//
// The rails are `position:fixed` overlays and this canvas is painted the full
// width underneath them, so "covered" is literal: the house was drawn where
// the panels sit. MODEL.html measures the two rails and hands the painter what
// they cover (railMargins); cut-view.js widens its margins to suit.
//
// THE PAINTER'S HALF IS PINNED OFFLINE, in proto/elevation-harness.js (seven
// checks, three mutation runs): that a margin asked for is honoured, that one
// asked for on one side alone does not eat the other, and that asking for less
// than the painter's own default changes nothing. WHAT NEEDS A BROWSER is the
// other half -- that the numbers handed over are the rails' real boxes, and
// that they are the boxes AT PAINT TIME.
//
// That second clause is the whole reason this file exists. The arithmetic was
// right for a day while the drawing stayed covered: boot paints before the
// shell has laid the rails out, so on `?left=1&right=1` railMargins measured
// nothing and the elevation was drawn at full width under both panels. A
// toggle repainted it correctly, which is exactly the shape of defect a
// browser check catches and a unit check cannot -- so this file measures the
// page AS LOADED, before touching anything.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

const empty = () => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
});

// WHERE THE HOUSE IS, in CSS pixels across the canvas.
//
// INK PER COLUMN, not a bounding box over every dark pixel: the level datum
// lines and the grade line are drawn edge to edge on purpose, so a box would
// report the full canvas covered whatever the house did. A column crossed only
// by those rules carries a handful of dark pixels; one through the house
// carries hundreds. The floor sits well above the first and well below the
// second.
//
// "DARK" WAS THE WORD, AND IT STOPPED BEING TRUE ON 24 SEP. This counted a
// pixel as ink when any channel fell below 200 -- near enough on a white
// elevation, and nonsense the moment cut-view.js started taking its inks from
// the caller and MODEL began handing it the skin. On RUFF night the elevation's
// ground is #1d1f20, so EVERY pixel on the canvas read as ink, every column
// cleared the floor, and the house was reported as spanning 0 to full width.
// CI said "the house starts at 0 and the left rail ends at 221", which is the
// measurement saying the drawing was covered when it was drawn correctly.
//
// SO INK IS NOW WHAT DIFFERS FROM THE CANVAS'S OWN GROUND, sampled from the
// top-left rather than assumed. The painter clears the whole canvas before it
// draws, and that corner is outside every margin either painter uses.
//
// THE MARGIN OF 50 IS THE OLD SENSITIVITY, not a fresh guess. "below 200" on
// a #fafafa ground is "more than 50 off the ground", so on paper this counts
// exactly what it always counted -- and it keeps the same things out on the
// night skin, which is the test that it is the same rule rather than a new
// one: a wall face is 5 off the ground on paper (#fff on #fafafa) and 18 on
// night (#2f3335 on #1d1f20), poche either way and ink in neither.
const readPage = page => page.evaluate(() => {
  const c = document.querySelector('canvas');
  const box = c.getBoundingClientRect();
  const rails = ['#left-rail', '#right-rail'].map(sel => {
    const el = document.querySelector(sel);
    if (!el || el.hidden) return { sel, open: false };
    const r = el.getBoundingClientRect();
    if (!(r.width > 0) || !(r.height > 0)) return { sel, open: false };
    return { sel, open: true, left: r.left, right: r.right };
  });
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const dpr = c.width / box.width;
  const counts = new Array(c.width).fill(0);
  const [gr, gg, gb] = [d[0], d[1], d[2]];
  for (let x = 0; x < c.width; x++) {
    for (let y = 0; y < c.height; y++) {
      const i = (y * c.width + x) * 4;
      if (Math.abs(d[i] - gr) > 50 || Math.abs(d[i + 1] - gg) > 50
        || Math.abs(d[i + 2] - gb) > 50) counts[x] += 1;
    }
  }
  const floor = 40 * dpr;
  let lo = -1, hi = -1;
  counts.forEach((n, x) => { if (n > floor) { if (lo < 0) lo = x; hi = x; } });
  // AND WHAT IS PAINTED UNDER THE LEFT RAIL, at ANY density. The house is
  // measured by column density above because the datum rules run edge to edge
  // and would swamp a bounding box; the ELEVATION NUMBERS are the opposite
  // problem -- nine-pixel type, a few dozen dark pixels each, invisible to a
  // floor of 40. Movie, 25 Sep: "of the left the elevation numbers, can you
  // bring those to the right so they aren't covered by the side menu when it
  // is open". So this counts every ink pixel in the rail's own columns.
  //
  // BELOW THE HEADER ROW. `E4 — GENERATED ELEVATION` is drawn at (10, 8) and
  // is meant to be there -- it is the sheet's title, not part of the drawing,
  // and it sits above the rail's top edge anyway. Everything from y=30 down
  // in those columns is drawing that has escaped its margin.
  const railRight = rails[0] && rails[0].open ? rails[0].right : 0;
  let underRail = 0;
  for (let x = 0; x < Math.min(c.width, Math.round((railRight - box.left) * dpr)); x++) {
    for (let y = Math.round(30 * dpr); y < c.height; y++) {
      const i = (y * c.width + x) * 4;
      if (Math.abs(d[i] - gr) > 50 || Math.abs(d[i + 1] - gg) > 50
        || Math.abs(d[i + 2] - gb) > 50) underRail += 1;
    }
  }
  return {
    underRail,
    canvas: { left: box.left, right: box.right, width: box.width },
    rails,
    ground: `${gr},${gg},${gb}`,
    // EVERY COLUMN LIT IS THE COUNTER FAILING, not a house that wide: the
    // painter insets its margins on every skin, so a reading that says the
    // drawing reaches both edges is a reading that no longer knows what blank
    // looks like. Reported rather than inferred, because the assertions below
    // would otherwise blame the rails for it -- which is what they did.
    allLit: counts.every(n => n > floor),
    house: lo < 0 ? null
      : { left: box.left + lo / dpr, right: box.left + hi / dpr },
  };
});

test('an elevation is drawn clear of the rails, and full width when they are shut', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 700 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="twoStorey-over"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(400);

  // SAVE BEFORE NAVIGATING. The build is in memory and openModel's init script
  // clears the store ONCE per session, so a second goto reloads from the store
  // rather than wiping it -- an unsaved build is simply not there, and an
  // earlier version of this reading measured a blank plan's grid for exactly
  // that reason.
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });

  // E4 is the one he was looking at, and it is the wide elevation: E1 on this
  // design is height-bound, so its house never reaches the rails and would
  // report success whatever the margins did.
  await page.goto('/MODEL.html?view=cut%3AE4&right=1&left=1');
  await expect(page.locator('#readout')).toContainText('elevation E4', { timeout: 10000 });
  await page.waitForTimeout(800);

  const open = await readPage(page);
  const [leftRail, rightRail] = open.rails;
  expect(leftRail.open, 'the left rail is open, or this measures nothing').toBe(true);
  expect(rightRail.open, 'the right rail is open, or this measures nothing').toBe(true);
  expect(open.house, 'the elevation drew a house at all').toBeTruthy();
  // THE COUNTER BEFORE THE CLEARANCE. Every column lit means the reading has
  // lost track of what blank looks like on this skin, and the clearance
  // assertions below would then report a covered drawing whatever the painter
  // did -- which is exactly how this file failed on 24 Sep, blaming the rails
  // for a threshold that had gone stale. Named first so it cannot do that
  // again quietly.
  expect(open.allLit,
    `every column reads as ink — the ground sampled as ${open.ground}, so this `
    + 'is the counter failing rather than a house the full width of the canvas')
    .toBe(false);

  // AND THE RAILS ARE ACTUALLY OVER THE CANVAS, which is what makes the rest
  // of this a test. A shell that had moved them off it would leave every
  // clearance below true for free.
  expect(leftRail.right, 'the left rail overlaps the canvas')
    .toBeGreaterThan(open.canvas.left + 20);
  expect(rightRail.left, 'the right rail overlaps the canvas')
    .toBeLessThan(open.canvas.right - 20);

  // THE READING HE ASKED FOR. Measured AS LOADED -- nothing has been clicked.
  expect(open.house.left,
    `the house starts at ${open.house.left.toFixed(0)} and the left rail ends at `
    + `${leftRail.right.toFixed(0)}`).toBeGreaterThanOrEqual(leftRail.right);
  expect(open.house.right,
    `the house ends at ${open.house.right.toFixed(0)} and the right rail starts at `
    + `${rightRail.left.toFixed(0)}`).toBeLessThanOrEqual(rightRail.left);

  // AND NEITHER DO THE NUMBERS DOWN ITS LEFT-HAND SIDE. The two assertions
  // above were both true on 25 Sep while the level readings were printed over
  // the tool palette: the level marks hang OUTSIDE the drawing on that side,
  // right-aligned at `marginL - 22`, so they were drawn from the margin the
  // rail had asked for rather than inside it. Nine-pixel type is far under
  // the density floor the house is found with, so nothing above could see it.
  //
  // ZERO, NOT A THRESHOLD. The painter insets its whole drawing past the rail
  // now; what is left in those columns is the page's own ground, and any ink
  // at all there is something that escaped. Reported with a count so a
  // failure says how much rather than merely that.
  expect(open.underRail,
    `${open.underRail} ink pixels are painted in the ${leftRail.right.toFixed(0)}px `
    + 'the left rail covers — the elevation numbers are drawn under the menu')
    .toBe(0);

  // AND WITH THE RAILS SHUT IT DOES NOT MOVE. THIS ASSERTION USED TO SAY THE
  // OPPOSITE, and the reversal is Movie's, on 24 Sep with the page in front
  // of him:
  //
  //   "when the collapsable menus on the side are closed can the screen scale
  //    stay the same with the extra little white area. it looks nicer with
  //    more space / smaller drawing" ... "so it would be this same size (not
  //    change) when the sidemenus close"
  //
  // WHAT IT SAID BEFORE, and why it is worth keeping the record rather than
  // quietly swapping the line: it required the house to grow by at least 20px
  // when the rails shut, on the reading that "a little smaller was the price
  // of the menus being open, not a new zoom" -- and the note at the foot of
  // this file names a mutation ("a fixed margin whatever the rails do") that
  // this assertion was the only thing catching, and calls it the one worth
  // having. That mutation is now the shipped behaviour. It is not that the
  // reasoning was wrong; it is that he looked at both and preferred the
  // steadier one.
  //
  // SO THE CHECK IS THE SAME SHAPE, AIMED THE OTHER WAY. "Same size" still
  // needs the rails-shut reading, because without it the whole file is
  // satisfied by an elevation that grows to fill the page the moment a menu
  // closes -- the defect he is reporting.
  await page.locator('#left-tab').click();
  await page.locator('.rail-tab[data-pane-tab="levels"]').click();
  await page.waitForTimeout(400);
  const shut = await readPage(page);
  expect(shut.rails.some(r => r.open), 'both rails are shut').toBe(false);
  expect(shut.house, 'the elevation still draws a house').toBeTruthy();
  const wasWide = open.house.right - open.house.left;
  const nowWide = shut.house.right - shut.house.left;
  expect(Math.abs(nowWide - wasWide),
    `${nowWide.toFixed(0)}px of house with the rails shut against `
    + `${wasWide.toFixed(0)}px with them open -- shutting a menu resized the `
    + 'drawing').toBeLessThanOrEqual(1);
  // AND IT IS STILL WHERE IT WAS, not the same width somewhere else.
  expect(Math.abs(shut.house.left - open.house.left),
    'the house slid sideways when the rails shut').toBeLessThanOrEqual(1);
});

// ── AND THE FOOT BAR IS THE SAME CLAIM, WITH ONE THING LET THROUGH ────────
//
// Movie, 26 Sep: "see how the footing bottom line is just under the dashboard
// line where the tint starts - could we make the house just a little smaller
// so that the bottom of the footing doesnt cross over the 'tint' line of the
// lower bar ... keep them about 3-5 pixels above that line so there is a
// little space, BUT ALLOW THE PILES TO EXTEND PAST THAT TINT LINE." And then,
// correcting the fix he could see coming: "rather than moving the house up,
// make it smaller scale slightly so it fits and gets smaller too" ... "the
// position is nice centered basically how it is just need it smaller".
//
// #house-strip IS `position:fixed; bottom:0` OVER A CANVAS THAT RUNS TO THE
// WINDOW'S FOOT -- the same shape as the rails, and covering the drawing the
// same way. Measured at 1366x700 before the fix, twoStorey-garage E1: the
// bar's top edge at y 636, the footing's dashed bottom at y 655.
//
// THE ARITHMETIC IS proto/elevation-harness.js'S. What only a browser can
// prove is what is here: that the box handed over is the BAR'S OWN, measured
// from the page rather than typed, and that a drawing painted before the
// shell laid the bar out is repainted once it has.
test('the footing clears the foot bar, and the piles run under it', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 700 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

  // A GARAGE, because the piles are the half of this that is allowed out and
  // an attached garage on a grade beam is the only thing that puts a shaft on
  // an elevation at all.
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator('[data-build-entry="twoStorey-garage"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(400);
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });

  await page.goto('/MODEL.html?view=cut%3AE1&right=1&left=1');
  await expect(page.locator('#readout')).toContainText('elevation E1', { timeout: 10000 });
  await page.waitForTimeout(800);

  const read = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const box = c.getBoundingClientRect();
    const strip = document.querySelector('#house-strip');
    const sr = strip ? strip.getBoundingClientRect() : null;
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const dpr = c.width / box.width;
    const [gr, gg, gb] = [d[0], d[1], d[2]];
    const rows = new Array(c.height).fill(0);
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (Math.abs(d[i] - gr) > 50 || Math.abs(d[i + 1] - gg) > 50
          || Math.abs(d[i + 2] - gb) > 50) rows[y] += 1;
      }
    }
    // TOLD APART BY SHAPE, not by elevation. The footing's underside is a long
    // dashed HORIZONTAL -- 205px of it on this build -- and the shafts are
    // verticals four to eight pixels wide. A row floor of 60 separates them
    // with two orders of magnitude to spare and needs no datum to do it.
    let footing = -1, deepest = -1;
    rows.forEach((n, y) => {
      if (n > 60 * dpr) footing = y;
      if (n > 0) deepest = y;
    });
    return {
      ground: `${gr},${gg},${gb}`,
      canvasTop: box.top, canvasBottom: box.bottom,
      barTop: sr && sr.height > 0 ? sr.top : null,
      footing: footing < 0 ? null : box.top + footing / dpr,
      deepest: deepest < 0 ? null : box.top + deepest / dpr,
      allLit: rows.every(n => n > 0),
    };
  });

  // THE READING BEFORE THE CLAIM, the habit the rails half of this file
  // learned the hard way: a counter that has lost track of what blank looks
  // like would satisfy or fail everything below for its own reasons.
  expect(read.allLit,
    `every row reads as ink — the ground sampled as ${read.ground}`).toBe(false);
  expect(read.footing, 'the elevation drew a footing line at all').toBeTruthy();
  // AND THE BAR IS ACTUALLY OVER THE CANVAS. A shell that had moved it off
  // would leave the clearance below true for free.
  expect(read.barTop, 'the foot bar is on the page').toBeTruthy();
  expect(read.barTop, 'the foot bar overlaps the canvas')
    .toBeLessThan(read.canvasBottom - 10);
  expect(read.barTop, 'and does not cover the whole of it')
    .toBeGreaterThan(read.canvasTop + 100);

  // THE TWO CLAIMS. Either alone is met by a painter that has given up:
  // draw nothing below the bar and the first passes, draw everything through
  // it and the second does.
  expect(read.footing,
    `the footing's underside is drawn at ${read.footing.toFixed(0)} and the `
    + `bar's tint begins at ${read.barTop.toFixed(0)}`)
    .toBeLessThan(read.barTop);
  expect(read.deepest,
    `the deepest ink is at ${read.deepest.toFixed(0)}, above the bar at `
    + `${read.barTop.toFixed(0)} — the pile shafts stop short of it`)
    .toBeGreaterThan(read.barTop);
  // AND SNUG, not merely clear. A drawing that answered this by shrinking to
  // a postage stamp clears the bar by a mile and is not what was asked for.
  //
  // AN INCH OF GROUND is what the number is: Movie, on the first cut of this
  // sitting 16px off the bar, "make it look like the footing is just about
  // resting on one inch of dirt and then the tint starts". At the scale this
  // build lands at in a 1366x700 window that is between one and two pixels;
  // the arithmetic behind it, in feet, is proto/elevation-harness.js's.
  expect(read.barTop - read.footing,
    `${(read.barTop - read.footing).toFixed(0)}px between the footing and the `
    + 'bar — an inch of ground at this scale is one to two')
    .toBeLessThanOrEqual(5);
});

// MUTATION-RUN, 22 Sep, three of them, each turning this file red and each on
// a different line of it:
//
//   the rail observer is never attached  -> house 128..1277 under rails ending
//                                           at 221 and starting at 1040
//   railMargins measures nothing at all  -> the same reading
//   a fixed margin whatever the rails do -> 741px of house with them shut,
//                                           741px with them open
//
// THE FIRST TWO STILL STAND and are still the defect itself: an elevation
// drawn underneath the panels, which is what this file was opened for.
//
// THE THIRD IS NOW THE FEATURE. It read as the subtle one -- it passes every
// clearance check here and was caught only by the rails-shut reading -- on the
// grounds that "a little smaller was the price of the menus being open, not a
// new zoom". Movie looked at both on 24 Sep and preferred the steady one:
// "so it would be this same size (not change) when the sidemenus close". The
// rails-shut reading is still the only thing measuring it; it now asks for
// sameness rather than growth, and the mutation that breaks it is the reverse
// -- railMargins going back to measuring only the rails that are open.
//
// MUTATION-RUN, 24 Sep, against the reversed assertion:
//
//   railMargins skips a shut rail  -> 758px of house with the rails open,
//                                     1149px with them shut
//
// -- which is the reading from his screenshot: the same elevation, half as
// big again, because a menu closed.
