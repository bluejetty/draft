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
  });

test.beforeEach(async ({ page }) => { await open(page); });
