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
  for (let x = 0; x < c.width; x++) {
    for (let y = 0; y < c.height; y++) {
      const i = (y * c.width + x) * 4;
      if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) counts[x] += 1;
    }
  }
  const floor = 40 * dpr;
  let lo = -1, hi = -1;
  counts.forEach((n, x) => { if (n > floor) { if (lo < 0) lo = x; hi = x; } });
  return {
    canvas: { left: box.left, right: box.right, width: box.width },
    rails,
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

  // AND WITH THE RAILS SHUT IT USES THE PAGE. Without this the whole thing
  // is satisfied by drawing every elevation small for ever, which is not what
  // he asked for -- "a little smaller" was the price of the menus being open,
  // not a new zoom.
  await page.locator('#left-tab').click();
  await page.locator('.rail-tab[data-pane-tab="levels"]').click();
  await page.waitForTimeout(400);
  const shut = await readPage(page);
  expect(shut.rails.some(r => r.open), 'both rails are shut').toBe(false);
  expect(shut.house, 'the elevation still draws a house').toBeTruthy();
  const wasWide = open.house.right - open.house.left;
  const nowWide = shut.house.right - shut.house.left;
  expect(nowWide,
    `${nowWide.toFixed(0)}px of house with the rails shut against `
    + `${wasWide.toFixed(0)}px with them open`).toBeGreaterThan(wasWide + 20);
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
// THE THIRD IS THE ONE WORTH HAVING. The first two are the defect itself, and
// either would have been caught by looking at the page. The third passes every
// clearance check in this file and is still wrong: it answers "don't cover the
// drawing" by drawing every elevation small for ever, which is the opposite of
// what he asked for -- "a little smaller" was the price of the menus being
// open, not a new zoom. Without the rails-shut reading it would ship.
