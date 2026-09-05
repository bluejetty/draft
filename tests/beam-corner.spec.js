// The auto-beam corner rule (board #244), as amended by the beam-posts board:
// a jog (re-entrant corner) whose node sits inside the beam's clear strip
// pulls the mid-span auto beam onto the corner node exactly, and the end is
// linked to the BONEYARD master point (srcId) so outline edits carry the beam
// along.
//
// It does NOT get a telepost. #244 gave one to any end landing on a re-entrant
// node, on the reasoning that such an end "bears on nothing"; that was
// inverted. A re-entrant node is an outline vertex, and the foundation wall
// runs through the outline — so a post there stands on concrete. Posts go
// where a beam end has nothing under it, which is the end `trimRun` leaves out
// in the floor, and #244's rule missed exactly those. The geometry itself is pinned by the offline harness
// against build-house.js; these specs pin the commit layer — the tour
// reveal, the stair re-derive, the master-drag ripple, and the reload path.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// THE TOUR IS PARKED, so there is no FOUNDATION DONE popup to wait on.
//
// These specs never wanted the popup as navigation -- they wanted it as a
// SIGNAL. The reveal lands the beam at 400ms and the teleposts at 800ms, and
// the popup arrived at 1200ms, so "popup is visible" meant "the reveal has
// finished". With the escort switched off the structure still lands on the
// same timers; only the announcement is gone.
//
// So wait for the thing itself. This is the better assertion anyway: it waits
// on the beam this file is about, rather than on a banner that happened to
// come after it.
// WAIT FOR THE REVEAL TO SETTLE, not for one frame of it. The beam lands at
// 400ms and the teleposts at 800ms, so waiting on the beam alone returns
// halfway through and the column assertions read an empty list -- which is
// exactly the mistake the first version of this helper made. Rather than
// encode either timing, wait until two consecutive reads agree: the reveal is
// done when it stops changing, whatever its frames are today.
// WAIT FOR WHAT THE TEST ASSERTS, NOT FOR THINGS TO GO QUIET.
//
// The first version of this waited until two reads 150ms apart agreed. That
// is not proof the auto-structure finished -- it is proof nothing changed in a
// 150ms window, and the app builds in two waves: the mid-span beam at ~400ms
// and its teleposts at ~800ms. In the ~400ms gap between them two reads agree
// happily on "1 beam / 0 columns", so this exited early and the column
// assertions read an empty list. It failed 2 runs in 3 locally and once on CI.
//
// That was the same mistake it was written to fix. The popup was a proxy for
// "the structure is built"; so was settle-detection. Both answer a question
// next to the one being asked. So each caller now states the counts its own
// assertions need, and this waits for exactly those.
//
// It fails LOUDLY with what it actually saw (Gilligan, 3 Sep) rather than
// letting the poll run into the 90s test timeout, where playwright would
// report a locator error that says nothing about what the app built.
//
// Three callers ask for `columns: 1` while only asserting things ABOUT the
// columns -- `autoColumns(saved).some(c => c.point.srcId)` and friends. That
// is deliberate: `.some()` on an empty array is false, so those assertions
// pass perfectly well when no telepost was built at all. Waiting for one to
// exist is what makes them mean anything.
async function waitForAutoBeams(page, { beams = 1, columns = 0, timeoutMs = 8000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let saw = 'nothing';
  for (;;) {
    const saved = await h.savedDrawing(page);
    const gotBeams = (saved?.beams || []).filter(beam => beam.auto).length;
    const gotColumns = (saved?.columns || []).filter(column => column.auto).length;
    saw = `${gotBeams} beams / ${gotColumns} columns`;
    if (gotBeams >= beams && gotColumns >= columns) break;
    if (Date.now() > deadline) {
      throw new Error(`auto structure never arrived within ${timeoutMs}ms: `
        + `expected at least ${beams} beams / ${columns} columns, saw ${saw}`);
    }
    await page.waitForTimeout(100);
  }
  await h.waitForSaved(page);
}

// An L-plan, 30 x 24 overall with a 12 x 14 bite out of the east side: the
// jog corner lands at (3, -2), 2' off the unsnapped mid-line z=0. The beam
// snaps to z=-2, runs from the west wall to the corner (the shallow east
// wing spans 10' on its own), and splits once at x=-6.
async function traceLHouse(page) {
  await page.locator('[data-select-build="bungalow"]').click();
  await page.keyboard.press('Enter'); // past PROFESSOR GRUFF
  await h.clickWorld(page, -15, -12);
  await h.clickWorld(page, 15, -12);
  await h.clickWorld(page, 15, -2);
  await h.clickWorld(page, 3, -2);
  await h.clickWorld(page, 3, 12);
  await h.clickWorld(page, -15, 12);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function switchLevel(page, name) {
  await page.locator('.level-name', { hasText: name }).click();
  await page.waitForTimeout(300);
}

async function dragWorld(page, fromX, fromZ, toX, toZ) {
  await h.selectTool(page, 'Select');
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);
}

// Real-mouse drags carry integer-pixel rounding (~0.07' at default zoom);
// snapped and linked positions stay exact.
const closeish = (received, expected) => expect(Math.abs(received - expected)).toBeLessThan(0.2);

const autoBeams = saved => saved.beams.filter(beam => beam.auto);
const autoColumns = saved => saved.columns.filter(column => column.auto);
const jogMasterPoint = saved => saved.boneyardOutlines[0].points
  .reduce((best, point) => {
    const d = Math.hypot(point.x - 3, point.z + 2);
    return !best || d < best.d ? { point, d } : best;
  }, null).point;

test('the auto beam snaps onto the jog corner, dead-ends there, and links to the master point', async ({ page }) => {
  await h.openModel(page);
  await traceLHouse(page);

  await waitForAutoBeams(page, { beams: 2, columns: 1 });
  const saved = await h.savedDrawing(page);

  // Snapped: every beam segment rides z=-2 (the corner), not the mid-line 0.
  const beams = autoBeams(saved);
  expect(beams).toHaveLength(2);
  beams.forEach(beam => {
    expect(beam.start.z).toBeCloseTo(-2, 5);
    expect(beam.end.z).toBeCloseTo(-2, 5);
  });
  // Trimmed: the shallow east wing spans 10' on its own — the beam
  // dead-ends at the corner, west wall to x=3.
  const xs = beams.flatMap(beam => [beam.start.x, beam.end.x]);
  expect(Math.min(...xs)).toBeCloseTo(-15, 5);
  expect(Math.max(...xs)).toBeCloseTo(3, 5);

  // The corner END is linked to the jog master point. (The post that used to
  // stand here is gone — see the header.)
  const master = jogMasterPoint(saved);
  expect(master.x).toBeCloseTo(3, 5);
  expect(master.z).toBeCloseTo(-2, 5);
  const cornerEnd = beams.flatMap(beam => [beam.start, beam.end])
    .find(point => point.srcId);
  expect(cornerEnd).toBeTruthy();
  expect(cornerEnd.srcId).toBe(master.id);
  expect(cornerEnd.x).toBeCloseTo(3, 5);

  // The only post is the mid-run split. Nothing stands on the jog corner:
  // that end is on the outline, so the foundation wall is already under it.
  const columns = autoColumns(saved);
  expect(columns).toHaveLength(1);
  expect(columns[0].point.x).toBeCloseTo(-6, 5);
  expect(columns.some(column =>
    Math.hypot(column.point.x - 3, column.point.z + 2) < 0.5)).toBe(false);
});

test('dragging the master jog corner carries the linked beam end along', async ({ page }) => {
  await h.openModel(page);
  await traceLHouse(page);
  await waitForAutoBeams(page, { columns: 1 });

  await switchLevel(page, 'BONEYARD');
  await dragWorld(page, 3, -2, 6, -1);

  const saved = await h.savedDrawing(page);
  const master = jogMasterPoint(saved);
  closeish(master.x, 6);
  closeish(master.z, -1);
  // The linked beam end sits EXACTLY on the moved master point; the split
  // column stayed where it was placed, and no post rode along because none
  // was ever put on the corner.
  const cornerEnd = autoBeams(saved).flatMap(beam => [beam.start, beam.end])
    .find(point => point.srcId);
  expect(cornerEnd.x).toBeCloseTo(master.x, 5);
  expect(cornerEnd.z).toBeCloseTo(master.z, 5);
  expect(autoColumns(saved).some(column => column.point.srcId)).toBe(false);
  expect(autoColumns(saved).find(column => !column.point.srcId).point.x).toBeCloseTo(-6, 5);
});

test('the corner link survives a reload — the revived beam still rides the master', async ({ page }) => {
  await h.openModel(page);
  await traceLHouse(page);
  await waitForAutoBeams(page, { columns: 1 });

  await page.reload();
  await h.waitForModelReady(page);

  await switchLevel(page, 'BONEYARD');
  await dragWorld(page, 3, -2, 7, -2);

  const saved = await h.savedDrawing(page);
  const master = jogMasterPoint(saved);
  closeish(master.x, 7);
  const cornerEnd = autoBeams(saved).flatMap(beam => [beam.start, beam.end])
    .find(point => point.srcId);
  expect(cornerEnd).toBeTruthy();
  expect(cornerEnd.x).toBeCloseTo(master.x, 5);
  expect(autoColumns(saved).some(column => column.point.srcId)).toBe(false);
});

test('the stair re-derive keeps the corner snap and re-links through the second commit site', async ({ page }) => {
  await h.openModel(page);
  await traceLHouse(page);
  await waitForAutoBeams(page, { columns: 1 });

  // A stair well north of the corner: hole strip z 4..10, so the larger
  // clear strip becomes [-12, 4] (mid -4) — the corner at z=-2 is still
  // inside it and still wins the snap after the re-derive replaces the
  // whole auto set through _rederiveTourBeam.
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, -10, 4);
  await h.clickWorld(page, -10, 10);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const beams = autoBeams(saved);
  expect(beams.length).toBeGreaterThan(0);
  beams.forEach(beam => {
    expect(beam.start.z).toBeCloseTo(-2, 5);
    expect(beam.end.z).toBeCloseTo(-2, 5);
  });
  const master = jogMasterPoint(saved);
  const cornerEnd = beams.flatMap(beam => [beam.start, beam.end])
    .find(point => point.srcId);
  expect(cornerEnd).toBeTruthy();
  expect(cornerEnd.srcId).toBe(master.id);
  expect(autoColumns(saved).some(column => column.point.srcId)).toBe(false);
});

// ── The beam posts what bears on nothing, and lines up where it can ──
// These are the geometry, exercised through the shipped module in the page
// rather than through the UI: midSpanBeams is pure, so a plan goes in and
// beams and columns come out, and the plans below are ones the tour cannot
// easily be driven to trace.
//
// THE QUESTION IS ALWAYS "DOES SOMETHING BEAR HERE", NEVER "IS THIS ON THE
// OUTLINE". The outline is only midSpanBeams' DEFAULT answer, because the
// foundation wall usually traces it — but a cantilever, a walkout corner or
// a garage slab edge are outline points with nothing beneath. Asserting
// against the bearing answer rather than the outline is what makes it safe
// to delete board #244's vertex rule instead of merely inverting it: an
// honest bearing lookup keeps the post on an unsupported end automatically.
//
// A bearing test cannot be serialised into the page, so a case names the
// unsupported stretch and the page builds the predicate.
const beamsFor = (page, points, { unsupportedEastOf = null, ...opts } = {}) => page.evaluate(
  ({ pts, o, cut }) => {
    const onOutline = p => pts.some((a, i) => {
      const b = pts[(i + 1) % pts.length];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
      return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t)) < 1e-6;
    });
    const bearsAt = cut == null ? null : (p => onOutline(p) && p.x < cut);
    const result = window.DraftBuildHouse.midSpanBeams(pts, bearsAt ? { ...o, bearsAt } : o);
    // Hand the bearing answer back so the assertions can use the same one the
    // module used, rather than a second opinion about the outline.
    const bears = bearsAt || onOutline;
    return {
      ...result,
      bearing: result.columns.map(bears),
      endBearing: [...result.beams].map(b => [bears(b.start), bears(b.end)]),
    };
  },
  { pts: points.map(([x, z]) => ({ x, z })), o: opts, cut: unsupportedEastOf });

// A free end is a beam endpoint no other segment shares — a run's own end,
// not one of the intermediate splits.
const freeEnds = beams => beams.flatMap(b => [b.start, b.end]).filter(p =>
  beams.filter(o => [o.start, o.end].some(q =>
    Math.abs(q.x - p.x) < 1e-6 && Math.abs(q.z - p.z) < 1e-6)).length === 1);
const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < 1e-6;

const L_HOUSE = [[-15, -12], [15, -12], [15, -2], [3, -2], [3, 12], [-15, 12]];
// Two notches at different depths: whatever the cut snaps to, the local span
// still drops under the trigger away from the notch corners, so trimRun cuts
// runs at break coordinates out in the floor.
const TWO_NOTCH = [[-40, -12], [40, -12], [40, 12], [20, 12], [20, 6],
  [0, 6], [0, 12], [-20, 12], [-20, 2], [-40, 2]];

test.describe('posts go where nothing bears', () => {
  test('no post stands where something already bears', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    const { columns, bearing } = await beamsFor(page, L_HOUSE);

    // The run dead-ends on the jog corner, which bears. Board #244 posted it;
    // that was the inverted rule. Not one column sits on a bearing point.
    expect(columns.length).toBeGreaterThan(0);
    expect(bearing.some(Boolean)).toBe(false);
  });

  test('a run trimmed mid-floor gets a post at its free end', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    const { beams, columns, bearing, endBearing } = await beamsFor(page, TWO_NOTCH);

    // Pair each free end with the bearing answer the module itself used.
    const ends = freeEnds(beams);
    const bearsAtEnd = new Map();
    beams.forEach((b, i) => {
      bearsAtEnd.set(`${b.start.x},${b.start.z}`, endBearing[i][0]);
      bearsAtEnd.set(`${b.end.x},${b.end.z}`, endBearing[i][1]);
    });
    const posted = p => columns.some(c => near(c, p));
    const hanging = ends.filter(p => bearsAtEnd.get(`${p.x},${p.z}`) === false);

    // trimRun really cut runs short out in the floor on this plan.
    expect(hanging.length).toBeGreaterThan(0);
    // Every unsupported free end carries a post ...
    hanging.forEach(p => expect(posted(p)).toBe(true));
    // ... and no post stands anywhere something already bears.
    expect(bearing.some(Boolean)).toBe(false);
  });

  test('an end ON the outline with nothing under it keeps its post', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    // The east side of the L is cantilevered — outline, but no concrete. This
    // is the case that would regress if the rule read the outline instead of
    // asking; #244's node at (3,-2) is on the outline and unsupported here.
    const { beams, columns } = await beamsFor(page, L_HOUSE, { unsupportedEastOf: 0 });

    const ends = freeEnds(beams);
    const eastEnd = ends.find(p => p.x > 0);
    expect(eastEnd).toBeTruthy();
    expect(columns.some(c => near(c, eastEnd))).toBe(true);
    // The west end is over the wall and still gets nothing.
    const westEnd = ends.find(p => p.x < -10);
    expect(westEnd).toBeTruthy();
    expect(columns.some(c => near(c, westEnd))).toBe(false);
  });
});

test.describe('the cut favours a line-up over the middle', () => {
  // Convex throughout, so the old re-entrant-only snap could never fire and
  // the cut sat at dead centre. The chamfer corner is at z = -7.
  const CHAMFER = [[-15, -12], [10, -12], [15, -7], [15, 12], [-15, 12]];
  // 40 x 30: dead centre leaves two 15' joist runs, but lining up on the
  // chamfer at z = -12 would leave a 27' run — over the 19' trigger.
  const OVER_SPAN = [[-20, -15], [15, -15], [20, -12], [20, 15], [-20, 15]];

  test('a cut that can reach a corner lands on it, not at mid-span', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    const { beams } = await beamsFor(page, CHAMFER);

    expect(beams.length).toBeGreaterThan(0);
    beams.forEach(beam => {
      expect(beam.start.z).toBeCloseTo(-7, 5);
      expect(beam.end.z).toBeCloseTo(-7, 5);
    });
  });

  test('a corner snap that would over-span is refused — spanning is a rule', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    const { beams } = await beamsFor(page, OVER_SPAN);

    expect(beams.length).toBeGreaterThan(0);
    beams.forEach(beam => {
      expect(beam.start.z).toBeCloseTo(0, 5);
      expect(beam.end.z).toBeCloseTo(0, 5);
    });
  });
});
