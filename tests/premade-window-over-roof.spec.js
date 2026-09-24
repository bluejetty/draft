// A WINDOW CLEARS THE ROOF UNDER IT BY 4 INCHES.
//
// Movie, 21 Sep 2026, looking at E4 RIGHT on the live app:
//
//   "the window should be about 4\" over the roof line"
//
// and, asked which of three ways a window should move to win that clearance:
//
//   "keep top of window at same spot and subtract size from bottom"
//
// So the head is the datum and the sill rises. A row of heads that no longer
// line up is worse on an elevation than one window that is short, and it is
// also how they are built -- the header is set by the framing and the opening
// grows downward from it.
//
// THIS FILE IS ABOUT THE PREMADE PATH, which is the one he was looking at.
// BOARD-a-roof-through-a-window.md diagnosed the cause as auto-windows.js and
// was wrong: his fixture carries eighteen windows and none with `auto: true`.
// They are premade-plans.js's `upperOpenings()`, a fixed `8, 16, 24` across
// the front, and MODEL.html raises them. The dealer's own copy of the rule is
// pinned offline by proto/auto-windows-harness.js (61 checks, seven mutation
// runs); what needs a browser is that this page applies the same rule to the
// windows the design hands it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');
// THE PAINTER, IN NODE, so the measurement below owes nothing to the page
// that placed the window. proto/harness-env.js loads cut-view and geometry-2d
// into a vm and wires a saved drawing up as the cut env they paint through --
// the same plumbing the offline elevation harness runs on, so the two cannot
// come to different answers about where a roof is.
const H = require('../proto/harness-env.js');

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

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: empty() });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function order(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(250);
}

async function saveOnNewPage(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

const savedFile = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()) : null;
}, BUCKET);

// Every window on a level, with the wall it rides, so a reading can name the
// wall rather than an index into a list nobody can check.
function windowsOn(saved, levelId) {
  const walls = new Map((saved.walls || [])
    .filter(w => (w.view || 'plan') === 'plan').map(w => [w.id, w]));
  return (saved.fenestrations || [])
    .filter(o => o.type === 'window' && Number(o.levelId) === levelId)
    .map(o => {
      const w = walls.get(o.wallId);
      return {
        wall: w ? `(${w.start.x},${w.start.z})->(${w.end.x},${w.end.z})` : '?',
        start: w ? w.start : null,
        end: w ? w.end : null,
        offset: Number(o.offset),
        widthFt: Number(o.width),
        sill: Number(o.sillHeight),
        head: Number(o.headHeight),
      };
    });
}

// The window's two ends in WORLD coordinates, off the wall it rides: the
// offset is measured from `start` ALONG the wall, so the direction has to
// come from the wall's own vector.
//
// IT USED TO READ ONLY x, on the grounds that the front wall runs along x.
// It does -- but this file asks about every window on the storey, and on a
// wall running along z that reading put a window thirty feet sideways of
// where it is. The front row still classified correctly, by luck, and a
// side-wall window landed inside the garage roof's x-span and quietly
// stopped being checked for having NOT moved.
function spanWorld(win) {
  const dx = win.end.x - win.start.x, dz = win.end.z - win.start.z;
  const len = Math.hypot(dx, dz) || 1;
  const u = { x: dx / len, z: dz / len };
  const centre = { x: win.start.x + u.x * win.offset, z: win.start.z + u.z * win.offset };
  const half = win.widthFt / 2;
  return [
    { x: centre.x - u.x * half, z: centre.z - u.z * half },
    { x: centre.x + u.x * half, z: centre.z + u.z * half },
  ];
}
// And its span in x, for the plan overlap with a roof's footprint.
function spanX(win) {
  const [a, b] = spanWorld(win);
  return [Math.min(a.x, b.x), Math.max(a.x, b.x)];
}

test('the 2 STOREY + GARAGE raises its upper front windows clear of the garage roof', async ({ page }) => {
  await open(page);
  await order(page, 'bungalow', 'twoStorey-garage');
  await saveOnNewPage(page);
  const saved = await savedFile(page);

  // THE GARAGE ROOF IS THE LOW ONE and it is found by its own flag, not by
  // id: an id pins this fixture, the flag is what the rule reads.
  const garageRoof = (saved.roofs || []).find(r => r.garage === true);
  expect(garageRoof, 'the design raised a garage roof to clear').toBeTruthy();
  const roofX = [Math.min(...garageRoof.points.map(p => p.x)),
    Math.max(...garageRoof.points.map(p => p.x))];

  // THE DESIGN SAYS WHERE ITS WINDOWS GO, asked of the module rather than
  // typed in again -- a spec carrying its own 8/16/24 would pass on a page
  // that had stopped reading premade-plans.js and grown a copy.
  const dealt = await page.evaluate(() =>
    window.DraftPremadePlans.planFor('twoStorey-garage').upperOpenings
      .filter(o => o.type === 'window').length);
  const upper = windowsOn(saved, 5);
  expect(upper.length, 'every window the design deals upstairs is on the drawing')
    .toBe(dealt);

  // Over the garage roof, or clear of it. Only the first kind may have moved.
  const over = upper.filter(w => {
    const [a, b] = spanX(w);
    return b > roofX[0] && a < roofX[1];
  });
  const clear = upper.filter(w => !over.includes(w));
  expect(over.length, 'some upper window overlaps the garage roof in plan')
    .toBeGreaterThan(0);
  expect(clear.length, 'and some does not, so the two can be told apart')
    .toBeGreaterThan(0);

  // THE HEAD NEVER MOVES. This is Movie's ruling and it is the whole reason
  // the sill is what changes: every upper window keeps the head the design
  // gave it, lifted or not, so the row still reads as a row.
  const heads = [...new Set(upper.map(w => w.head.toFixed(4)))];
  expect(heads, 'one head height across the whole storey').toHaveLength(1);

  // AND A WINDOW CLEAR OF THE ROOF IS UNTOUCHED: the sill only ever rises,
  // and only where a roof is in the way.
  const designSill = await page.evaluate(() =>
    window.DraftPremadePlans.planFor('twoStorey-garage').upperOpenings
      .find(o => o.type === 'window').sillFt);
  clear.forEach(w => {
    expect(w.sill, `the window at x ${spanX(w).map(n => n.toFixed(1)).join('..')} `
      + 'has no roof in front of it and should not have moved').toBeCloseTo(designSill, 3);
  });

  // AND THE ONES OVER THE ROOF SIT HIGHER THAN THE DESIGN PUT THEM. Stated as
  // "higher than the design's own sill" rather than as a number, because the
  // number is the roof's and the roof is the design's arithmetic.
  const lifted = over.filter(w => w.sill > designSill + 1e-6);
  expect(lifted.length,
    `${over.length} upper window(s) overlap the garage roof; `
    + `sills ${over.map(w => w.sill.toFixed(3)).join(', ')} against a design sill of ${designSill}`)
    .toBeGreaterThan(0);
});

// MUTATION-RUN, 22 Sep, three of them, each turning this file red:
//
//   the pass is never called            -> 6 windows still at the design sill
//   the sill is computed, never written -> the same
//   every roof counts, the house's too  -> EVERY upper window vanishes
//
// THE THIRD IS THE ONE WORTH HAVING. It fails differently from the other two
// -- "every window the design deals upstairs is on the drawing" rather than a
// sill that did not move -- because counting the roof this wall holds up
// lifts every sill above its own head and the whole storey is dropped for
// having no glass. That is the failure the bearing test exists to prevent,
// and without this check it would ship as an empty second floor.
//
// AND A SECOND TEST THAT DOES MEASURE THE FOUR INCHES, because the first one
// cannot and a bug walked straight through the gap.
//
// Movie, 24 Sep, on a render of his own drawing: *"the window is also
// overlapping the [roof] (if there isn't 4\" space under the window possible
// with the smaller window don't put a window in that location"*. The window
// he marked HAD been lifted -- 3.948 ft against a design sill of 2.833 -- so
// the test above was green, and the garage ridge still came up an inch and a
// half INSIDE the glass.
//
// THE LIFT WAS STRUCK AGAINST THE WRONG ROOF. `riseAt` measures from the EAVE
// line; MODEL handed auto-windows.js `roofBaseElev`, which is where the roof
// BEARS -- the bottom of the fascia, 5 1/2" lower. Four inches of clearance
// less five and a half of fascia is an inch and a half of overlap, which is
// what the drawing showed to the foot. Nothing could see it: the sill rose,
// so "it moved" passed; the painter drew the roof from the eave and the
// placer from the bearing, and no check compared the two.
//
// SO THIS ONE COMPARES THEM, and the note the deleted attempt left behind is
// the reason it is written the way it is. That attempt rebuilt the roof
// surface IN THE PAGE and ended up asserting a string was truthy. This one
// measures in node off the saved file, through cut-view's own functions, and
// asserts the roof height is a real number in a sane band BEFORE it asserts
// anything about the sill -- so an assertion left standing over a measurement
// that collapsed fails rather than passes.
//
// THE DATUM IS SPELLED OUT rather than taken from `roofEaveElev`. That helper
// is the fix; a check that called it would go green again the day someone
// took the fascia back out of it.

// The roof standing in front of a window, in the datum the sill is quoted in:
// feet above the window's own level floor, or null where nothing is there.
function roofReader(saved) {
  const win = H.loadDraftModules();
  const CV = win.DraftCutView;
  const G = win.DraftGeometry2D;
  const env = H.buildEnv(win, saved);
  const stack = CV.sectionLevelStack(env);
  const FASCIA_FT = CV.STANDARDS.ROOF_FASCIA_IN / 12;
  const roofs = env.roofs()
    .filter(roof => (roof.points || []).length >= 3)
    .map(roof => ({
      // THE EAVE LINE, WRITTEN OUT: the bearing plus the fascia board that
      // hangs off it. This is the sum the whole board is about.
      eave: CV.roofBaseElev(roof, stack, env) + FASCIA_FT,
      roof,
      faces: G.roofFaces(roof, G.roofSkeleton(roof)),
    }));
  return {
    stack,
    clearFt: 4 / 12,
    topOver(start, end, floorTop, wallTop) {
      // NOT THE ROOF THIS WALL HOLDS UP. Its eave is at the plate, above
      // every head on the storey; counted, it would lift every sill above
      // its own head and the answer would be "no windows anywhere".
      const lower = roofs.filter(entry => entry.eave < wallTop - 0.05);
      if (!lower.length) return null;
      // OFF THE WALL, ALONG ITS OWN NORMAL. A roof edge landing exactly on
      // the wall face puts the sample on a polygon boundary, where inside is
      // a coin toss. Both sides are probed and the taller answer taken: the
      // roof bearing on this wall is already out, so whichever side answers
      // is a roof standing in front of the window.
      const dx = end.x - start.x, dz = end.z - start.z;
      const len = Math.hypot(dx, dz) || 1;
      const n = { x: -dz / len, z: dx / len };
      let top = null;
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const at = { x: start.x + dx * t, z: start.z + dz * t };
        [-0.05, 0.05].forEach(off => {
          lower.forEach(entry => {
            const rise = CV.sectionRoofHeightAt(
              { x: at.x + n.x * off, z: at.z + n.z * off }, entry.roof, entry.faces);
            if (!Number.isFinite(rise)) return;
            const elev = entry.eave + rise - floorTop;
            if (top === null || elev > top) top = elev;
          });
        });
      }
      return top;
    },
  };
}

test('and it clears that roof by four inches, measured against the roof the painter draws',
  async ({ page }) => {
    await open(page);
    await order(page, 'bungalow', 'twoStorey-garage');
    await saveOnNewPage(page);
    const saved = await savedFile(page);

    const reader = roofReader(saved);
    const floor = reader.stack.floors.find(level => level.id === 5);
    expect(floor, 'the saved stack carries the 2ND FL the windows are on').toBeTruthy();

    const readings = windowsOn(saved, 5).map(w => {
      const [a, b] = spanWorld(w);
      const [x0, x1] = spanX(w);
      return { w, x0, x1, roofTop: reader.topOver(a, b, floor.floorTop, floor.wallTop) };
    });
    const over = readings.filter(r => r.roofTop !== null);
    expect(over.length, 'some upper window has a roof under it, or this measures nothing')
      .toBeGreaterThan(0);

    // A ROOF UNDER THE WINDOW IS NOT THE SAME AS A ROOF IN ITS WAY. The
    // garage eave sits BELOW this storey's floor, so the window whose edge
    // just reaches the roof's outer corner reads a negative height -- real,
    // and nothing to clear. The ones that matter are those reaching above
    // the floor the window stands on.
    const inTheWay = over.filter(r => r.roofTop > 0);
    expect(inTheWay.length, 'some upper window has a roof standing in front of its wall')
      .toBeGreaterThan(0);

    // THE MEASUREMENT IS SANE BEFORE IT IS BELIEVED. A roof in the way of a
    // second-storey window stands between that floor and its plate; a reading
    // outside that band means the plumbing collapsed, and an assertion left
    // standing over a collapsed measurement is the failure the deleted
    // attempt shipped.
    inTheWay.forEach(({ x0, x1, roofTop }) => {
      expect(roofTop, `the roof read under the window at x ${x0.toFixed(1)}..${x1.toFixed(1)}`)
        .toBeLessThan(floor.wallTop - floor.floorTop);
    });

    // AND NO SILL IS BELOW ITS ROOF PLUS FOUR INCHES. The bug was 1.5" the
    // wrong side of this line.
    over.forEach(({ w, x0, x1, roofTop }) => {
      expect(w.sill - roofTop,
        `the window at x ${x0.toFixed(1)}..${x1.toFixed(1)} sits ${((w.sill - roofTop) * 12).toFixed(1)}"`
        + ` over a roof at ${roofTop.toFixed(3)}ft above the floor`)
        .toBeGreaterThanOrEqual(reader.clearFt - 1e-6);
    });

    // AND ONE OF THEM IS AT EXACTLY FOUR INCHES, which is what says the rule
    // set the sill rather than the design happening to clear the roof.
    const onTheLine = over.filter(r => Math.abs(r.w.sill - r.roofTop - reader.clearFt) < 1e-6);
    expect(onTheLine.length,
      `sills ${over.map(r => (r.w.sill - r.roofTop).toFixed(4)).join(', ')} over their roofs`)
      .toBeGreaterThan(0);
  });

// The peak-under-the-window rule, the head staying put and the no-glass-left
// drop are pinned in proto/auto-windows-harness.js, offline and against seven
// mutations, each caught by its own check. What needs a browser is what this
// file asserts: that MODEL.html's premade build runs that rule, over the
// windows the design deals it, against the roof it actually draws.
