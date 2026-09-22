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

// The window's span in WORLD x, for a wall that runs along x. That is the
// only kind this fixture's front wall is, and naming the assumption keeps the
// reading honest if the design ever turns.
function spanX(win) {
  const along = win.end.x - win.start.x;
  const dir = Math.sign(along) || 1;
  const centre = win.start.x + dir * win.offset;
  return [centre - win.widthFt / 2, centre + win.widthFt / 2].sort((a, b) => a - b);
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
// NO SECOND TEST MEASURING THE 4 INCHES ITSELF, deliberately. One was
// written here and deleted: it rebuilt the roof surface in the page to
// compare against each sill, and by the time the plumbing was right the
// assertion left standing was that a string was truthy. A check that passes
// while measuring nothing is worse than no check -- it reports the rule is
// held when nothing is holding it.
//
// The four inches, the peak-under-the-window rule, the head staying put and
// the no-glass-left drop are all pinned in proto/auto-windows-harness.js,
// offline and against seven mutations, each caught by its own check. What
// needs a browser is only what this file asserts: that MODEL.html's premade
// build runs that rule over the windows the design deals it.
