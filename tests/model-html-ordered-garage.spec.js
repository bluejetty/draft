// THE ORDERED GARAGE GETS ITS FOUNDATION — MODEL.html's drive-thru.
//
// Movie, 18 Sep, having picked a foundation off the board: "i selected
// detached garage 25x25 with frost wall". He got four stud walls. The FROST
// WALL was recorded on the outline and read by nothing, because the thing
// that reads it — MODEL.dc.html's _buildGarageGradeBeam — had never been
// ported. The tile asked him a question and threw the answer away.
//
// THREE FOUNDATIONS, THREE DIFFERENT BUILDINGS, and the difference is not
// cosmetic:
//
//   FROST WALL      concrete standing on a strip footing at the house's
//                   footing depth — so it gets footings, and its base is 0.
//   GRADE BEAM      a band of concrete HANGING off grade, with no footing
//                   under it at all. Its base is its own top less the pour.
//   THICKENED EDGE  no beam and no footing: the slab's own perimeter IS the
//                   footing, which is what `thickenedEdge` on the slab says.
//
// So every check below is a check that the three come out DIFFERENT. A build
// that read `foundation` and made the same thing for all three would be worse
// than one that ignored it, because the drawing would then state a foundation
// it has not got — and a `garage frost wall` label over a hanging beam is a
// drawing that lies to the person pouring it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');
const fs = require('fs');
const path = require('path');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

// An empty sheet on the real level stack. EMPTY MATTERS: the fixture's own
// house would put walls and concrete in the file that this spec would then
// have to tell apart from the garage's.
async function open(page, view = 'foundation') {
  await h.openModel(page, { webgl: false });
  await bare(page);
  // ORDERED FROM THE FOUNDATION SET, which is where Movie was standing and is
  // the state that made this wrong twice over — see the stud-wall check.
  await page.goto(`/MODEL.html?level=1&view=${view}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// THE SAME SHEET, WITH THE SIZE QUESTION BACK ON. The board stopped asking
// how big on 24 Sep and only asks again behind `?sizes=ask`, so a spec about
// a garage of a PARTICULAR span has to come in that way — the shelf's own
// 24x26 is inside the joist table and can say nothing about the far side of
// it. `boneReveal` is the second half: the bone-grow trip is what the span
// ask has to hold, and openModel turns the reveal off by default.
async function openAsk(page, { boneReveal = false } = {}) {
  await h.openModel(page, { webgl: false, boneReveal });
  // AND SAID AGAIN HERE, LAST. The file's beforeEach has already opened the
  // page once with the suite's default — reveal OFF — and that seed is an
  // init script that still runs on every navigation this page makes. A
  // second openModel asking for the reveal cannot undo it: its own seed only
  // writes the key "when unset", and the first one set it. So the setting is
  // written outright, from the script added last, which is the one that wins.
  // Found by measurement: the card came up and the trip never happened,
  // because the trip was switched off rather than held.
  if (boneReveal) {
    await page.addInitScript(() => {
      const key = 'draft-active-package:settings';
      let pkg = null;
      try { pkg = JSON.parse(localStorage.getItem(key) || 'null'); } catch { pkg = null; }
      if (!pkg || !pkg.content || !pkg.content.model) return;
      pkg.content.model.boneReveal = true;
      try { localStorage.setItem(key, JSON.stringify(pkg)); } catch { /* private window */ }
    });
  }
  await bare(page);
  await page.goto('/MODEL.html?level=1&view=foundation&sizes=ask');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function bare(page) {
  await page.evaluate(async ({ bucket, saved }) => {
    const bare = {
      ...saved,
      walls: [], outlines: [], floors: [], roofs: [], fenestrations: [],
      dimensions: [], lines: [], shapes: [], stairs: [],
    };
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(bare)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
}

async function orderGarage(page, entry, sideFt = null) {
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
  await page.locator(`#dt-tiles [data-build-entry="${entry}"]`).click();
  // THE BOARD NO LONGER ASKS HOW BIG (Movie, 24 Sep) -- every garage it
  // builds is the shelf's own 24x26 until the question comes back. A spec
  // that needs a particular span comes in through openAsk and says so, which
  // is the only way to reach a size the shelf has not got.
  if (sideFt !== null) {
    await page.locator('#size-stock [data-build-size="custom"]').click();
    await page.locator('#size-w').fill(String(sideFt));
    await page.locator('#size-d').fill(String(sideFt));
  }
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, BUCKET);
}

const concreteOf = saved => (saved.walls || [])
  .filter(wall => wall.view === 'foundation' && wall.body === 'garage');
const studsOf = saved => (saved.walls || [])
  .filter(wall => wall.wallType === 'stud_2x6');
const slabOf = saved => (saved.floors || []).find(floor => floor.garage === true);
const footingsOf = saved => (saved.lines || [])
  .filter(line => line.layer === 'S-FOOTING');

test('its stud walls go on the storey, not on the set being looked at',
  async ({ page }) => {
    // THE OTHER HALF OF THE SAME REPORT, and the one that hid inside it. The
    // order was placed from the FOUNDATION set, and commitWall took the
    // active view — so contextWallType handed back concrete_8 and a garage
    // meant to be framed came out as eight inches of concrete on the
    // foundation plan. MODEL.dc.html's _buildGarageWalls uses
    // `_floorLevels()[0]` for exactly this reason.
    const saved = await orderGarage(page, 'detached-frostwall');
    const studs = studsOf(saved);
    // EIGHT NOW, NOT FOUR, and the count is the point rather than a number
    // that had to be loosened: a frost wall carries a room over the garage
    // (13 Oct), so there are two rings of framing — the bay and the room.
    // What this test is about is still asked of every one of them: a wall
    // filed on the set that happened to be open is the defect, whichever
    // storey it belongs to.
    expect(studs.length, 'two rings of framing: the bay and the room').toBe(8);
    expect(studs.filter(wall => wall.levelId === 3).length,
      'four round the garage').toBe(4);
    expect(studs.filter(wall => wall.levelId === 4).length,
      'four round the room over it').toBe(4);
    for (const wall of studs) {
      expect(wall.view, 'on the plan, never the set being looked at').toBe('plan');
      expect(wall.body, 'and known to be the garage-s').toBe('garage');
    }
  });

test('FROST WALL stands on footings', async ({ page }) => {
  const saved = await orderGarage(page, 'detached-frostwall');
  const concrete = concreteOf(saved);
  expect(concrete.length, 'concrete round the garage').toBe(4);
  for (const wall of concrete) {
    expect(wall.levelId).toBe(1);
    expect(wall.wallType).toBe('concrete_8');
    // IT STANDS. A frost wall bears on a strip footing at the house's footing
    // depth, so its base is the datum — not a band hung off grade.
    expect(wall.baseHeight, 'a frost wall stands on its footing').toBeCloseTo(0, 3);
    expect(wall.topHeight, 'and rises above it').toBeGreaterThan(1);
  }
  // AND IT HAS THE FOOTING TO STAND ON: two rings round a four-sided garage.
  expect(footingsOf(saved).length, 'two rings of four').toBe(8);

  // The slab falls toward the door — Movie, 4 Sep: "slab 4" conc slope 1/8"
  // down from back to the garage door opening (front)".
  const slab = slabOf(saved);
  expect(slab, 'the garage slab was poured').toBeTruthy();
  expect(slab.thickness * 12).toBeCloseTo(4, 2);
  expect(slab.slopeInPerFt, 'it falls to the door').toBeCloseTo(1 / 8, 4);
  expect(slab.thickenedEdge, 'its edge is not the footing').toBe(false);
});

test('GRADE BEAM hangs off grade, with no footing at all', async ({ page }) => {
  const saved = await orderGarage(page, 'detached-gradebeam');
  const concrete = concreteOf(saved);
  expect(concrete.length, 'concrete round the garage').toBe(4);
  for (const wall of concrete) {
    // IT HANGS. This is the whole difference from a frost wall, and it is one
    // number: the beam is a band of concrete whose base is its own top less
    // the pour, sitting well above the datum a footing would be at.
    expect(wall.baseHeight, 'a grade beam hangs, it does not stand')
      .toBeGreaterThan(1);
    expect(wall.topHeight - wall.baseHeight,
      'and it is a band, not a wall — 32 inches of pour').toBeCloseTo(32 / 12, 2);
  }
  // NO FOOTING UNDER IT, by definition. Footings here would draw concrete
  // that is not there, under a beam whose whole point is not needing any.
  expect(footingsOf(saved).length, 'a grade beam has no footing').toBe(0);
  expect(slabOf(saved).slopeInPerFt, 'the slab still falls to the door')
    .toBeCloseTo(1 / 8, 4);
});

test('THICKENED EDGE builds no beam — the slab edge is the footing',
  async ({ page }) => {
    const saved = await orderGarage(page, 'detached-thickened');
    // NO CONCRETE WALL AT ALL, which is the rule and not an omission:
    // _buildGarageGradeBeam returns early on a thickened garage, because its
    // slab's own perimeter carries it.
    expect(concreteOf(saved).length, 'no beam and no frost wall').toBe(0);
    expect(footingsOf(saved).length, 'and no strip footing').toBe(0);

    const slab = slabOf(saved);
    expect(slab.thickenedEdge, 'the slab carries its own edge').toBe(true);
    // A THICKENED SLAB IS LEVEL. The slope belongs to the two that drain to a
    // door; pouring a falling slab with a structural edge is a different
    // detail and not this one.
    expect(slab.slopeInPerFt, 'and it is level').toBe(0);
    // The studs still went up: this is a foundation difference, not a garage
    // that failed to build.
    expect(studsOf(saved).length).toBe(4);
  });

test('the three foundations are three different buildings', async ({ page }) => {
  // THE CONTROL FOR ALL OF THE ABOVE, in one place. Each check above reads
  // one kind; none of them can tell whether the BUILD is reading `foundation`
  // at all or just happens to suit that kind. Three orders, three shapes.
  const shape = saved => [concreteOf(saved).length, footingsOf(saved).length,
    slabOf(saved).thickenedEdge, slabOf(saved).slopeInPerFt > 0].join('/');

  await open(page);
  const frost = shape(await orderGarage(page, 'detached-frostwall'));
  await open(page);
  const beam = shape(await orderGarage(page, 'detached-gradebeam'));
  await open(page);
  const thick = shape(await orderGarage(page, 'detached-thickened'));

  expect(new Set([frost, beam, thick]).size,
    `the tile's answer changes what is built: ${frost} / ${beam} / ${thick}`)
    .toBe(3);
});

test('one Ctrl+Z takes the garage and its concrete together',
  async ({ page }) => {
    await open(page);
    await h.openDriveThru(page);
    await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
    await page.locator('#dt-tiles [data-build-entry="detached-frostwall"]').click();
    await page.locator('#dt-bone').click();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');

    await page.keyboard.press('Control+z');
    await page.waitForTimeout(250);
    await page.locator('[data-model-save]').click();
    await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

    const saved = await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return JSON.parse(await file.text());
    }, BUCKET);
    expect((saved.walls || []).length, 'the framing and the concrete went').toBe(0);
    expect((saved.lines || []).length, 'the footings went').toBe(0);
    expect((saved.floors || []).length, 'the slab went').toBe(0);
    expect((saved.outlines || []).length, 'the footprint went').toBe(0);
    // AND THE TWO PIECES THIS BOARD ADDED. One press is one undo, and a roof
    // or a pair of doors left standing over a garage that is gone is the
    // shape of an undo that only knew about half of what it built.
    expect((saved.roofs || []).length, 'the roof went').toBe(0);
    expect((saved.fenestrations || []).length, 'the doors and the window went')
      .toBe(0);
  });

// ── A BARE BOX — Movie, 20 Sep ───────────────────────────────────────────
//
// "also the detached garage doesn't have a roof or windows and doors yet i
// noticed". He was looking at the E3 LEFT elevation, where a garage that had
// been ordered, framed and poured stood as a flat rectangle: no sheet over it
// and no way into it.
//
// THE PREMADE HOUSES HAD BOTH ALREADY, which is what makes this a gap rather
// than a feature nobody had reached. raiseLoop deals a design's openings and
// buildPremadePlan raises its roofs; the ordered garage went down a different
// path — it mints its own outline, because it carries `detached: true` and the
// foundation off the tile — and that path had neither.

// THE WALLS OF THE BOX, NAMED BY WHERE THEY ARE. garage-site.js plots the
// loop clockwise from the back-left corner and stands it EAST of whatever is
// already built, so the door wall is the one at max z and the wall the house
// is on is the one at min x. Asked of the coordinates rather than of array
// order: a check that read walls[2] would keep passing if the loop were ever
// rewound, and would then be checking a different wall.
const wallWhere = (walls, value, want) => walls.find(wall => {
  const got = value(wall);
  return Math.abs(got - want) < 0.01;
});
const frontWall = walls => wallWhere(walls, w => Math.min(w.start.z, w.end.z),
  Math.max(...walls.map(w => Math.min(w.start.z, w.end.z))));
const backWall = walls => wallWhere(walls, w => Math.max(w.start.z, w.end.z),
  Math.min(...walls.map(w => Math.max(w.start.z, w.end.z))));
const houseSideWall = walls => wallWhere(walls, w => Math.max(w.start.x, w.end.x),
  Math.min(...walls.map(w => Math.max(w.start.x, w.end.x))));

const openingOn = (saved, wall) => (saved.fenestrations || [])
  .filter(record => String(record.wallId) === String(wall.id));

test('the ordered garage gets a roof, and every edge of it is an eave',
  async ({ page }) => {
    const saved = await orderGarage(page, 'detached-frostwall');
    const roofs = saved.roofs || [];
    expect(roofs.length, 'one sheet over the box').toBe(1);
    const roof = roofs[0];
    expect(roof.levelId, 'on the ROOF level').toBe(7);
    // CUT FROM THE TOP STOREY OF THE BUILDING, which on a frost wall is the
    // room over the garage (13 Oct) and not the bay. Read off the walls that
    // are actually up there rather than typed, so the one rule — the sheet is
    // cut from whatever storey the building ends at — is what is checked
    // whether or not this garage has a room in it.
    const topStorey = Math.max(...(saved.walls || [])
      .filter(wall => wall.wallType === 'stud_2x6').map(wall => wall.levelId));
    expect(roof.sourceLevelId, 'cut from the storey the garage ends at')
      .toBe(topStorey);
    // FLAGGED, WITH A REAL PLATE. cut-view.js's roofBaseElev bears a garage
    // roof at the first floor's top plus the plate rather than on the whole
    // wall stack — which is what keeps a single-storey garage's roof single
    // storey when the drawing grows a second one. A stored null reads back as
    // a plate of ZERO and would bear the sheet on the slab.
    expect(roof.garage, 'it knows it is a garage roof').toBe(true);
    expect(Number.isFinite(roof.plateHeightFt),
      'and it bears at a real plate, not at null').toBe(true);
    expect(roof.plateHeightFt, 'a storey above the floor').toBeGreaterThan(6);
    // NO GABLES, and this is the difference from the attached garage's roof
    // rather than a default nobody chose: a gable is what an edge gets when it
    // dies into a house wall, and a DETACHED garage touches nothing.
    expect(new Set(roof.edges || []), 'every edge is an eave')
      .toEqual(new Set(['eave']));
    // AND IT OVERHANGS ON EVERY SIDE, for the same reason: no edge is cut
    // flush, because no edge meets anything.
    const box = saved.outlines.find(outline => outline.garage === true);
    const span = points => ({
      minX: Math.min(...points.map(pt => pt.x)),
      maxX: Math.max(...points.map(pt => pt.x)),
      minZ: Math.min(...points.map(pt => pt.z)),
      maxZ: Math.max(...points.map(pt => pt.z)),
    });
    const sheet = span(roof.points), walls = span(box.points);
    expect(sheet.minX, 'it hangs past the left wall').toBeLessThan(walls.minX - 0.1);
    expect(sheet.maxX, 'and the right').toBeGreaterThan(walls.maxX + 0.1);
    expect(sheet.minZ, 'and the back').toBeLessThan(walls.minZ - 0.1);
    expect(sheet.maxZ, 'and the front').toBeGreaterThan(walls.maxZ + 0.1);
  });

test('and a way into it: two bays, a man door beside them, and a window',
  async ({ page }) => {
    // Movie, 13 Oct, on the garage that carries a storey: "place a 2 garage
    // doors 8ft each and 1 man door 36 along one wall", "make each car bay
    // approx 12 each and then 4fet left for the mandoor and stairs".
    //
    // SO THE FRONT WALL IS THE WHOLE TEST NOW. It used to hold one wide
    // overhead with the man door round the side; a garage with a stair in it
    // puts all three on the one wall, because the man door is the way to the
    // stair and the stair stands in the strip they leave.
    const saved = await orderGarage(page, 'detached-frostwall');
    const studs = studsOf(saved).filter(wall => wall.levelId === 3);
    expect((saved.fenestrations || []).length, 'four openings').toBe(4);

    const front = openingOn(saved, frontWall(studs));
    expect(front.length, 'two bays and the man door, all on the door wall')
      .toBe(3);
    const overhead = front.filter(record => record.garage === true);
    expect(overhead.length, 'two overhead doors').toBe(2);
    for (const door of overhead) {
      expect(door.type).toBe('door');
      expect(door.width, 'an 8 ft leaf, his number').toBeCloseTo(8, 3);
      expect(door.headHeight, 'heading at 7 ft, not at the house-s 6-8')
        .toBeCloseTo(7, 3);
      expect(door.layer, 'on the door layer').toBe('A-DOOR');
    }
    // ONE IN EACH BAY, which is what makes them bays rather than two doors
    // that happen to be on one wall: the 30 ft wall less the 6 ft strip is two
    // 12 ft bays, so their centres stand 12 ft apart. Movie, 14 Oct, split the
    // same 30 this way -- "allow 6ft for the mandoor and 12 and 12 for the 2
    // bays" -- and an 8 ft leaf still clears a 12 ft bay with 2 ft of pier a
    // side.
    const apart = Math.abs(overhead[0].offset - overhead[1].offset);
    expect(apart, `${apart} ft between the two bays`).toBeCloseTo(12, 1);

    // THE MAN DOOR IN THE STRIP, at the house end of the same wall — the path
    // between house and garage runs off this side, and the strip is where the
    // stair lands.
    const man = front.filter(record => record.garage !== true);
    expect(man.length, 'one man door').toBe(1);
    expect(man[0].type).toBe('door');
    // A D36, like every default exterior door (Movie, 9 Oct).
    expect(man[0].width, 'a 3-0 leaf').toBeCloseTo(3, 3);
    // The door wall is walked from the far corner toward the house, so the
    // strip is the LAST 6 ft of it and the man door stands past both bays.
    expect(man[0].offset, 'past both bays, in the strip')
      .toBeGreaterThan(Math.max(...overhead.map(door => door.offset)));
    expect(openingOn(saved, houseSideWall(studs)).length,
      'and nothing is left round the side').toBe(0);

    // AND ONE WINDOW, on the back — away from the street and off both doors.
    const win = openingOn(saved, backWall(studs));
    expect(win.length, 'one window on the back').toBe(1);
    expect(win[0].type).toBe('window');
    expect(win[0].layer, 'on the glazing layer').toBe('A-GLAZ');
    expect(win[0].sillHeight, 'at a sill, not on the floor').toBeGreaterThan(1);

    // EVERY ONE ON A STUD WALL OF THIS GARAGE, not on its concrete and not on
    // something else's wall. A door cut into the grade beam would draw on the
    // FOUNDATION set and nowhere else.
    for (const record of saved.fenestrations) {
      const host = studs.find(wall => String(wall.id) === String(record.wallId));
      expect(host, `opening ${record.id} hangs on a framed garage wall`).toBeTruthy();
      expect(record.levelId, 'and is filed on the storey').toBe(3);
      expect(record.view, 'on the same set as its wall').toBe('plan');
      expect(record.auto, 'the design placed it, not the auto-dealer').toBe(false);
    }
  });

test('and the drawing will actually draw them', async ({ page }) => {
  // THE ONE THAT SAYS WHY THE WIDTHS ARE A RULE. An opening wider than its
  // wall can carry with the lintel bearing left at each end reaches the file
  // and is then refused by clampOpeningToWall on EVERY paint: nothing draws
  // it, nothing says so, and the drafter gets a garage that is shut on the
  // plan, shut on the elevation and shut in 3D.
  //
  // ASKED OF THE PAGE'S OWN CLAMP, in the page, with the page's own wall list
  // and thicknesses — the same call render-2d goes through. A second copy of
  // the arithmetic here would agree with itself and prove nothing.
  await orderGarage(page, 'detached-frostwall');
  const judged = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const saved = JSON.parse(await file.text());
    const G = window.DraftGeometry2D;
    const types = window.DraftWallTypes.WALL_TYPES;
    const thicknessFt = wall => (types.find(t => t.id === (wall.wallType || 'stud_2x6'))
      || types[1]).totalIn / 12;
    return (saved.fenestrations || []).map(record => {
      const wall = saved.walls.find(w => String(w.id) === String(record.wallId));
      if (!wall) return `${record.id}: no host wall`;
      const got = G.clampOpeningToWall(wall, record.offset, record.width,
        { walls: saved.walls, thicknessFt });
      if (!got) return `${record.id}: ${record.width} ft refused by the wall`;
      if (Math.abs(got.offset - record.offset) > 1e-6) {
        return `${record.id}: slid from ${record.offset} to ${got.offset}`;
      }
      return null;
    });
  }, BUCKET);
  // AND IT HAS SOMETHING TO JUDGE. An empty list passes a "nothing was
  // refused" check perfectly, which is the same garage Movie reported — so
  // the count is asserted first and the verdict second.
  expect(judged.length, 'four openings to judge').toBe(4);
  expect(judged.filter(Boolean), 'every opening fits its wall where it was put')
    .toEqual([]);
});

// ── AND A STOREY OVER IT — Movie, 13 Oct ─────────────────────────────────
//
// "its the detached garages, when someone selects FROST WALL or GRADE BEAM,
// lets give them a DEFAULT - 2 storey which will need a set of stairs too and
// the thicker floor joists most likely (if wider than 19ft will need OWJ)" —
// and of the third foundation: "DETACHED GARAGE Thickened Edge can't have a
// 2 storey open, it only is good for the garage main fl no upper foors".
//
// PROJECT ALREADY WRITES THIS DEFAULT when the foundation is pressed there
// (#699). This is the OTHER door: the drive-thru is the second place a
// foundation is chosen, and a default that only fired on one of them is a
// default a drafter meets at random. So these read the MODEL, not the cell —
// what was BUILT over the garage, on which level, standing on what.
const upperOf = saved => ({
  level: (saved.levels || []).find(level => Number(level.id) === 4) || null,
  walls: (saved.walls || []).filter(wall => Number(wall.levelId) === 4),
  outlines: (saved.outlines || []).filter(loop => Number(loop.levelId) === 4),
  floors: (saved.floors || []).filter(floor => Number(floor.levelId) === 4),
  cell: saved.sectionTable?.rows?.detachedGarage?.overGarage || null,
});
const owjNoteOf = saved => (saved.notes || [])
  .map(note => String(note.body || ''))
  .find(body => /^ENGINEERED OWJ/.test(body)) || null;

test('a frost wall carries a room over the garage', async ({ page }) => {
  const saved = await orderGarage(page, 'detached-frostwall');
  const up = upperOf(saved);
  expect(up.level, 'the OVER GARAGE level is in the stack').toBeTruthy();
  expect(up.level.name).toBe('OVER GARAGE');
  // WALLS AND A FLOOR, BOTH. A storey of walls standing on nothing is what
  // the section draws when the deck is left out, and the deck is also the
  // thing the span rule measures — so neither half is optional.
  expect(up.walls.length, 'four walls around the room').toBe(4);
  expect(up.floors.length, 'and a deck under it').toBe(1);
  expect(up.outlines.length, 'with a footprint of its own').toBe(1);
  // NOT FLAGGED `garage`: it is a ROOM. Everything that counts garages —
  // the beam rule above all — would read a second bay here and go looking
  // for the floor over THAT.
  expect(up.outlines[0].garage, 'the room is not another bay').toBe(false);
  expect(up.cell, 'and the schedule says so too').toBe('room');
});

test('a grade beam carries one too, and a thickened edge carries none',
  async ({ page }) => {
    const beam = upperOf(await orderGarage(page, 'detached-gradebeam'));
    expect(beam.walls.length, 'a grade beam is a foundation that carries').toBe(4);
    expect(beam.cell).toBe('room');

    await open(page);
    const thick = upperOf(await orderGarage(page, 'detached-thickened'));
    expect(thick.level, 'no storey over a thickened edge').toBeFalsy();
    expect(thick.walls.length, 'and nothing framed on it').toBe(0);
    expect(thick.floors.length, 'and no deck either').toBe(0);
    expect(thick.cell, 'the schedule does not claim one').not.toBe('room');
  });

test('the roof goes on top of the room, not on the garage ceiling',
  async ({ page }) => {
    // A ROOF LEFT ON THE LOWER PLATE sits on the garage ceiling with the room
    // standing through it — which is what this did before the plate was made
    // the whole stack. Read against the garage's OWN wall height rather than
    // a number typed here, so a change to the assembly moves both.
    const twoStorey = await orderGarage(page, 'detached-frostwall');
    await open(page);
    const oneStorey = await orderGarage(page, 'detached-thickened');
    const plateOf = saved => ((saved.roofs || [])[0] || {}).plateHeightFt;
    expect(plateOf(oneStorey), 'the single-storey garage got its roof')
      .toBeGreaterThan(0);
    // THE DIFFERENCE IS A WHOLE STOREY: the room's floor package and its
    // walls. Asked as a difference between two builds of the same page rather
    // than against a number typed here, so retuning the assembly moves both
    // and this still says the same thing.
    expect(plateOf(twoStorey) - plateOf(oneStorey),
      `${plateOf(twoStorey)} ft over ${plateOf(oneStorey)} ft is a storey`)
      .toBeGreaterThan(8);
  });

test('the floor over it is engineered for the span it actually has',
  async ({ page }) => {
    // Movie: "the thicker floor joists most likely (if wider than 19ft will
    // need OWJ)" — and later "can you adjust the floor depths based on how
    // far the span is". TWO SPANS, TWO DEPTHS, which is the only check that
    // can tell a table being read from a constant being printed.
    await openAsk(page);
    const narrow = owjNoteOf(await orderGarage(page, 'detached-gradebeam', 24));
    await openAsk(page);
    const wide = owjNoteOf(await orderGarage(page, 'detached-gradebeam', 30));
    expect(narrow, 'the 24 ft room says what carries it').toMatch(/ENGINEERED OWJ/);
    expect(wide, 'so does the 30 ft one').toMatch(/ENGINEERED OWJ/);
    expect(wide, 'and it is not the same joist').not.toBe(narrow);
    const depth = body => Number((body.match(/OWJ\s+(\d+)/) || [])[1]);
    expect(depth(wide), `${wide} is deeper than ${narrow}`)
      .toBeGreaterThan(depth(narrow));
  });

test('past 31 ft it asks how the floor is carried, and the bones wait',
  async ({ page }) => {
    // THE 12 OCT RULING, REACHED FROM THIS DOOR: "if user goes past 31 ...
    // have a popup that states: choices 1. REQ ENGINEERED ... Beam / or
    // Joists. OR 2. PLACE COLUMNS to support BEAM".
    //
    // AND THE REASON THE REVEAL IS ON. The grow trip REPLACES this page, so
    // with the reveal on the card was raised and then carried off to the
    // BONEYARD unanswered — the whole second choice offered to nobody.
    // Measured that way: this failed before presentBuild learnt to wait.
    await openAsk(page, { boneReveal: true });
    await h.openDriveThru(page);
    await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
    await page.locator('#dt-tiles [data-build-entry="detached-gradebeam"]').click();
    await page.locator('#size-stock [data-build-size="custom"]').click();
    await page.locator('#size-w').fill('40');
    await page.locator('#size-d').fill('40');
    await page.locator('#dt-bone').click();

    const card = page.locator('#garage-span');
    await expect(card).toBeVisible({ timeout: 6000 });
    await expect(card).toContainText("40'-0\"");
    // STILL HERE. The question is asked on this page or not at all.
    expect(page.url(), 'the bones have not grown yet').toContain('MODEL.html');

    await page.locator('[data-garage-span-columns]').click();
    // AND NOW THE TRIP IS TAKEN, with the answer already in the drawing the
    // BONEYARD is about to read.
    await page.waitForURL(/BONEYARD\.html/, { timeout: 8000 });
    const saved = await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return JSON.parse(await file.text());
    }, BUCKET);
    const beams = (saved.beams || []).filter(beam => beam.auto === true);
    expect(beams.length, 'a dropped beam under the room').toBeGreaterThan(0);
    const posts = (saved.columns || [])
      .filter(column => !String(column.footing || '').startsWith('pile'));
    expect(posts.length, 'standing on columns').toBeGreaterThan(0);
    expect(owjNoteOf(saved), 'and the joists are now wall to beam')
      .toMatch(/WALL TO BEAM|@/);
  });

test('and a way up into the room, landing on the garage slab',
  async ({ page }) => {
    // Movie, 13 Oct: a storey over the garage "will need a set of stairs
    // too" — and then, on where it lands: "they will land about 6" lower
    // than the sill plate , depending on the concrete slab, is there a
    // calculation for that? maybe only 4"".
    //
    // THERE IS, AND THE DRAWING NOW USES IT. A detached garage has no
    // subfloor under that room, it has concrete — so a flight sized the
    // ordinary way (the wall below plus this floor's package) is short by the
    // whole slab recess and its bottom step floats. The drop is 5 1/2": one
    // 1 1/2" sill plate, because the garage's walls bear on TOP of theirs,
    // plus the 4" the slab is poured below the concrete. His two guesses
    // bracket it.
    const saved = await orderGarage(page, 'detached-gradebeam');
    const stairs = (saved.stairs || []).filter(stair => Number(stair.levelId) === 4);
    expect(stairs.length, 'one flight into the room over the garage').toBe(1);
    const stair = stairs[0];
    expect(stair.auto, 'placed by the press, not by hand').toBe(true);
    // AND A HOLE TO COME UP THROUGH. A stair with no well is a drawing with a
    // flight running into the underside of its own deck.
    const well = (saved.surfaceOpenings || [])
      .filter(hole => String(hole.stairId) === String(stair.id));
    expect(well.length, 'with its well cut out of the deck').toBe(1);
    expect(well[0].hostType).toBe('floor');

    // THE RISE, AGAINST THE DRAWING'S OWN ASSEMBLIES rather than a number
    // typed here: the garage wall it climbs plus the room's floor package is
    // the ordinary answer, and what is left over is the slab.
    const plainFt = await page.evaluate(saved => {
      const LA = window.DraftLevelAssembly;
      const garage = LA.levelAssemblyFor(saved.levelAssemblies, 3);
      const room = LA.levelAssemblyFor(saved.levelAssemblies, 4);
      return garage.wallHeightFt + LA.levelFloorFt(room);
    }, saved);
    const dropIn = (stair.riseFt - plainFt) * 12;
    expect(dropIn, `${dropIn}" of slab under the sill`).toBeCloseTo(5.5, 2);
    // AND EVERY RISER IN IT IS STILL LEGAL, which is the reason the rise has
    // to be right: 16 risers over a flight that is really 5 1/2" taller than
    // the drawing thought is a stair whose steps do not add up.
    expect(stair.riseFt / stair.risers * 12,
      `${stair.risers} risers over ${stair.riseFt} ft`).toBeLessThanOrEqual(7.875);

    // ── ALONG ONE SIDE, OFF AN 8 FT ENTRY ──────────────────────────────────
    //
    // Movie, 13 Oct: "put the stairs along one side", and "the door goes
    // straight to the bottom of the stairs (about 8ft entry area before the
    // stairs". The suggester had parked it down the middle of the room, which
    // is what an empty box scores best; this garage's shape is the answer and
    // the build knows it.
    const box = saved.outlines.find(outline => outline.garage === true);
    const xs = box.points.map(pt => pt.x), zs = box.points.map(pt => pt.z);
    const minX = Math.min(...xs), maxX = Math.max(...xs), maxZ = Math.max(...zs);
    // THE HOUSE SIDE, which is the side the man door's strip is on. Measured
    // as "nearer that wall than the far one by a mile" rather than to an
    // inset typed here, which would be this spec keeping its own copy of the
    // wall assembly.
    const offWall = ((stair.start.x + stair.end.x) / 2) - minX;
    expect(offWall, `the run stands ${offWall} ft off the house-side wall`)
      .toBeLessThan(stair.widthFt + 1);
    expect(maxX - minX, 'and the room is far wider than that')
      .toBeGreaterThan(offWall * 3);
    // AND THE ENTRY IN FRONT OF IT. `end` is the bottom tread, the door wall
    // is at max z, and what a drafter paces is the floor — so an 8 ft entry
    // measured off the inside face lands a little under 8 from the
    // centreline the geometry keeps.
    const entryFt = maxZ - Math.max(stair.start.z, stair.end.z);
    expect(entryFt, `${entryFt} ft of floor between the door and the bottom step`)
      .toBeGreaterThan(7.5);
    expect(entryFt, 'and not a room-s worth of it').toBeLessThan(9);
  });

test.beforeEach(async ({ page }) => { await open(page); });
