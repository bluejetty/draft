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
  // ORDERED FROM THE FOUNDATION SET, which is where Movie was standing and is
  // the state that made this wrong twice over — see the stud-wall check.
  await page.goto(`/MODEL.html?level=1&view=${view}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function orderGarage(page, entry, size = '25x25') {
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="detachedGarage"]').click();
  await page.locator(`#dt-tiles [data-build-entry="${entry}"]`).click();
  await page.locator(`#size-stock [data-build-size="${size}"]`).click();
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
    expect(studs.length, 'four framed walls round the garage').toBe(4);
    for (const wall of studs) {
      expect(wall.levelId, 'on the storey').toBe(3);
      expect(wall.view).toBe('plan');
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
    await page.locator('#size-stock [data-build-size="25x25"]').click();
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
    expect(roof.sourceLevelId, 'cut from the storey the garage stands on').toBe(3);
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

test('and a way into it: an overhead door, a man door and a window',
  async ({ page }) => {
    const saved = await orderGarage(page, 'detached-frostwall');
    const studs = studsOf(saved);
    expect((saved.fenestrations || []).length, 'three openings').toBe(3);

    // THE OVERHEAD DOOR ON THE DOOR WALL, which is the one garage-site.js
    // says faces the viewer. A 25 ft wall carries the 16, so this size gets
    // the double — the 16x24 on the same board does not, and premade-plans.js
    // has the ladder and the harness for that.
    const overhead = openingOn(saved, frontWall(studs));
    expect(overhead.length, 'one door on the door wall').toBe(1);
    expect(overhead[0].type).toBe('door');
    expect(overhead[0].width, '16 ft across a 25 ft wall').toBeCloseTo(16, 3);
    expect(overhead[0].garage, 'and it is an overhead door').toBe(true);
    expect(overhead[0].headHeight, 'heading at 7 ft, not at the house-s 6-8')
      .toBeCloseTo(7, 3);
    expect(overhead[0].layer, 'on the door layer').toBe('A-DOOR');

    // THE MAN DOOR ON THE HOUSE SIDE. plot() stands the garage east of
    // everything already built, so the path between the two runs off this
    // wall — putting it on the far side would send the drafter round the box.
    const man = openingOn(saved, houseSideWall(studs));
    expect(man.length, 'one door on the wall the house is on').toBe(1);
    expect(man[0].type).toBe('door');
    expect(man[0].width, 'a 2-6 leaf').toBeCloseTo(2.5, 3);
    expect(man[0].garage, 'a man door is not an overhead door').toBe(false);

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
  expect(judged.length, 'three openings to judge').toBe(3);
  expect(judged.filter(Boolean), 'every opening fits its wall where it was put')
    .toEqual([]);
});

test.beforeEach(async ({ page }) => { await open(page); });
