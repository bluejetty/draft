// THE STRIP BESIDE A STAIR IS EITHER A ROOM OR IT IS WASTE.
//
// Movie, 15 Oct, over his own foundation plan: "lets try to minimize cols
// ,... see that part i marked pink - its too small to be useful, if that area
// is less than 7 ft we should move the stairs to the garage wall (but leave
// it 13" space between the ext wall line and where the stair starts (to allow
// for foundation wall and insulation)", and then, for the other half of the
// same rule: "if there is 7ft or more, the north side of the stair opening
// would also need 2 more columns on each end of the stair and a beam".
//
// So one measurement decides between two drawings, and the two have to be
// told apart by what they LEAVE BEHIND -- a stair against the wall with the
// room whole beside it, or a stair where it stood with its open side framed.
// Both are checked here off a built house rather than by calling the rule,
// because the rule's answer is only worth what the build does with it.
//
// AND THE THIRD THING HE SAID, which is not about the strip at all: "the
// above storey stairs goingto the second floor will have full 6" still so
// those stairs can be 6" wider" ... "line it up on and leave the extra inch
// on the exterior wall side". The widening already existed (rule B); where
// the extra width GOES is what this pins.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const FOUNDATION = 1;

const empty = () => ({
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: FOUNDATION, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
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

// THE LOT CARD COMES UP THE MOMENT THE HOUSE LANDS and these checks are about
// the foundation, not the lot. Answered the way a drafter would who came to
// look at his framing.
async function pastTheLotCard(page) {
  const card = page.locator('#lot-pick');
  if (await card.isVisible().catch(() => false)) {
    await card.locator('[data-lot-pick-skip]').click();
    await expect(card).toBeHidden();
  }
}

// A HOUSE OF THE STOCK SIZE, built from the tile.
async function buildStock(page, entry) {
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(1200);
  await pastTheLotCard(page);
}

// A HOUSE THE DRAFTER WALKS HIMSELF, so the width is this file's to choose --
// which is the only way to get a strip too narrow to be a room out of a
// design whose stock sizes are all wide enough.
async function traceHouse(page, entry, corners) {
  await h.openDriveThru(page);
  await page.locator('[data-build-family="bungalow"]').click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-banner-outline').click();
  await expect(page.locator('#drivethru')).toBeHidden();
  await h.dropSeededCorner(page);
  const { at } = await h.planFrame(page);
  for (const [x, z] of [...corners, corners[0]]) await page.mouse.click(...at(x, z));
  await page.waitForTimeout(1500);
  await pastTheLotCard(page);
}

async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

const r = n => Math.round(n * 100) / 100;
const wellOf = d => (d.surfaceOpenings || [])
  .find(hole => Number(hole.stairId) > 0 && (hole.points || []).length >= 3);
const boxOf = points => ({
  x0: Math.min(...points.map(p => p.x)), x1: Math.max(...points.map(p => p.x)),
  z0: Math.min(...points.map(p => p.z)), z1: Math.max(...points.map(p => p.z)),
});
// THE BEAMS THIS RULE ADDS, told from the mid-span pass's by `stairId` --
// which is also the field that says WHICH well a beam is holding open.
const sideBeams = d => (d.beams || []).filter(beam => Number(beam.stairId) > 0);
const handColumns = d => (d.columns || []).filter(column => column.auto === false);

test('a strip too small to be a room goes away: the stair is pushed to the wall',
  async ({ page }) => {
    await open(page);
    // 18 FT WIDE. The interior ring is 14-1/2" in off each side and the well
    // is about 3 ft across, so neither strip beside it can reach 7 ft wherever
    // the suggester puts it -- there is no answer here but the wall.
    await traceHouse(page, 'bungalow', [[-9, -16], [9, -16], [9, 16], [-9, 16]]);
    const d = await saved(page);
    const well = wellOf(d);
    expect(well, 'the stair was cut through the floor').toBeTruthy();
    const box = boxOf(well.points);
    const outline = (d.outlines || []).find(o => Number(o.levelId) === MAIN_FL && !o.garage);
    const house = boxOf(outline.points);
    // AGAINST THE SETBACK, NOT AGAINST THE WALL: the well stops one wall
    // assembly short of the outline -- the foundation wall and the insulation
    // lining it -- which is the 13" he asked for, derived.
    const inset = r(box.x0 - house.x0);
    expect(inset, 'the well sits one wall assembly off the exterior line')
      .toBeGreaterThan(0.9);
    expect(inset).toBeLessThan(1.5);
    // AND WHAT IS LEFT IS ONE ROOM, not a room and a dead strip.
    expect(r(house.x1 - box.x1), 'the whole width is on one side of it')
      .toBeGreaterThan(7);
  });

test('a strip that IS a room leaves the stair where the suggester put it',
  async ({ page }) => {
    await open(page);
    // THE STOCK 1 STOREY + GARAGE is 32 ft wide: both strips are rooms, so
    // nothing in this rule may touch the stair.
    await buildStock(page, 'bungalow-garage');
    const d = await saved(page);
    const box = boxOf(wellOf(d).points);
    const house = boxOf((d.outlines || [])
      .find(o => Number(o.levelId) === MAIN_FL && !o.garage).points);
    expect(r(box.x0 - house.x0), 'it did not slide to the wall').toBeGreaterThan(7);
    expect(r(house.x1 - box.x1), 'nor to the other one').toBeGreaterThan(7);
  });

test('the open side of the well gets a beam on two columns, and the carried side gets nothing',
  async ({ page }) => {
    await open(page);
    await buildStock(page, 'bungalow-garage');
    const d = await saved(page);
    const box = boxOf(wellOf(d).points);
    const added = sideBeams(d);
    // ONE BEAM, NOT TWO. The mid-span pass already lays one along the side it
    // hugs; the rule frames what is actually open, which is how "minimize
    // cols" and "a beam" are the same instruction.
    expect(added.length, 'one open side, one beam').toBe(1);
    const [beam] = added;
    // ALONG THE OPEN LONG EDGE, with its FACE on the edge of the opening --
    // Movie, 16 Oct: "a flush beam along the opening (edge of beam alligned
    // with edge of opening (center a few inches inside the floor)". The
    // centreline is half the beam inside the floor: 1 3/4" of a 3 1/2"
    // two-ply engineered beam. (#745 set it 2" off, which put the face 1/4"
    // inside the hole.)
    const half = 3.5 / 24;
    expect(r(beam.start.x), 'the beam\'s face on the open long edge of the well').toBe(r(box.x0 - half));
    expect(r(beam.end.x)).toBe(r(box.x0 - half));
    // TEN FEET OR MORE OF FLOOR on that side, which is what earns the beam:
    // "when long side is exposed to 10ft or more floor span".
    const house = boxOf((d.outlines || [])
      .find(o => Number(o.levelId) === MAIN_FL && !o.garage).points);
    expect(box.x0 - house.x0, 'the open side is 10 ft of floor or more').toBeGreaterThan(10);
    expect([r(beam.start.z), r(beam.end.z)].sort((a, b) => a - b),
      'end to end of the opening').toEqual([r(box.z0), r(box.z1)]);
    // AND A COLUMN AT EACH END OF IT -- "2 more columns on each end of the
    // stair and a beam".
    const posts = handColumns(d);
    expect(posts.length, 'two columns, one at each end').toBe(2);
    expect(posts.map(c => [r(c.point.x), r(c.point.z)]).sort(),
      'standing under the beam\'s ends').toEqual(
      [[r(beam.start.x), r(beam.start.z)], [r(beam.end.x), r(beam.end.z)]].sort());
    // ON THE FOUNDATION, with the beams that carry this floor: filed anywhere
    // else they would be invisible to the rule that keeps the next well clear
    // of a beam, and would print on a sheet of their own.
    expect([beam.levelId, beam.view]).toEqual([FOUNDATION, 'foundation']);
    posts.forEach(column => expect([column.levelId, column.view])
      .toEqual([FOUNDATION, 'foundation']));
  });

test('a strip that is a room but under 10 ft of floor gets no beam: the joists carry it',
  async ({ page }) => {
    await open(page);
    // 24 FT WIDE: the interior ring is 14-1/2" in off each side, the well is
    // about 3 1/2 ft across and stands against the mid-span beam, so the
    // open strip beside it is a room (over 7 ft) and under 10 ft of floor.
    // Movie's two rules stack: not dead, not framed -- "when long side is
    // exposed to 10ft or more floor span" is the trigger, and this is not it.
    await traceHouse(page, 'bungalow', [[-12, -16], [12, -16], [12, 16], [-12, 16]]);
    const d = await saved(page);
    const box = boxOf(wellOf(d).points);
    const house = boxOf((d.outlines || [])
      .find(o => Number(o.levelId) === MAIN_FL && !o.garage).points);
    // THE OPEN SIDE is the one the mid-span beam is not on; its floor runs
    // from the well's edge to the interior ring, one wall assembly (the
    // 14-1/2" the first test measures) inside the outline.
    // (On a traced house the mid-span beam is filed as flush segments along
    // one line, so it is read by position, not by mode.)
    const beamX = [...new Set((d.beams || []).filter(b => b.auto && !(Number(b.stairId) > 0))
      .map(b => r((b.start.x + b.end.x) / 2)))];
    expect(beamX.length, 'a mid-span beam carries one side').toBe(1);
    const openStrip = beamX[0] < box.x0 ? house.x1 - box.x1 : box.x0 - house.x0;
    const floor = openStrip - 14.5 / 12;
    expect(floor, 'the strip is a room').toBeGreaterThan(7);
    expect(floor, 'and under 10 ft of floor').toBeLessThan(10);
    expect(sideBeams(d), 'nothing is added for it').toEqual([]);
    expect(handColumns(d), 'no columns either').toEqual([]);
  });

test('a carrying beam in the strip is the next support: under 10 ft of floor to it, nothing is added',
  async ({ page }) => {
    await open(page);
    // 39 FT WIDE AND 40 DEEP: the joists span the 39, three bays of them, so two mid-span rows 13 ft apart. The stair hugs
    // the middle one, so the open side's floor runs from the well's edge to
    // the NEXT BEAM, some 7 ft away -- not the 17 ft to the wall. "10ft or
    // more span of floor until the next beam or ext. wall": the beam is the
    // support the joists reach first, and 7 ft of floor earns nothing.
    await traceHouse(page, 'bungalow', [[-19.5, -20], [19.5, -20], [19.5, 20], [-19.5, 20]]);
    const d = await saved(page);
    const box = boxOf(wellOf(d).points);
    const rows = [...new Set((d.beams || []).filter(b => b.auto && !(Number(b.stairId) > 0))
      .map(b => r((b.start.x + b.end.x) / 2)))].sort((a, b) => a - b);
    expect(rows.length, 'two rows of beams carry the floor ' + JSON.stringify(rows) + ' well ' + JSON.stringify(box)).toBe(2);
    const house = boxOf((d.outlines || [])
      .find(o => Number(o.levelId) === MAIN_FL && !o.garage).points);
    // The open side is the one without a beam hugging it; the next row on
    // that side is the support, and the floor between is under 10 ft.
    const hug = rows.find(x => Math.abs(x - box.x0) < 0.5 || Math.abs(x - box.x1) < 0.5);
    expect(hug, 'the well hugs a row').toBeDefined();
    const openRight = Math.abs(hug - box.x0) < 0.5;
    const next = openRight ? rows.find(x => x > box.x1 + 0.5) : [...rows].reverse().find(x => x < box.x0 - 0.5);
    expect(next, 'another row stands on the open side').toBeDefined();
    const toBeam = openRight ? next - box.x1 : box.x0 - next;
    const toWall = (openRight ? house.x1 - box.x1 : box.x0 - house.x0) - 14.5 / 12;
    expect(toBeam, 'the beam is nearer than the wall').toBeLessThan(toWall);
    expect(toBeam, 'and under 10 ft of floor away').toBeLessThan(10);
    expect(toWall, 'while the wall alone would have earned a beam').toBeGreaterThan(10);
    expect(sideBeams(d), 'nothing is added').toEqual([]);
  });

test('they are not a suggestion: an AUTO sweep cannot carry them off',
  async ({ page }) => {
    await open(page);
    await buildStock(page, 'bungalow-garage');
    const d = await saved(page);
    // `auto` IS WHAT placeAutoBeam SWEEPS AND RE-DERIVES, and what it
    // re-derives is the mid-span plan -- which knows about the hole but not
    // about this rule. A beam marked auto here would be carried off by the
    // next press and nothing put back under the open side of the well.
    sideBeams(d).forEach(beam => expect(beam.auto, 'the beam is the drafter\'s').toBe(false));
    handColumns(d).forEach(column => expect(column.auto).toBe(false));
  });

test('one Ctrl+Z takes the stair framing back with the house', async ({ page }) => {
  await open(page);
  await buildStock(page, 'bungalow-garage');
  expect(sideBeams(await saved(page)).length, 'there was something to take back')
    .toBeGreaterThan(0);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  const d = await saved(page);
  expect(sideBeams(d), 'the beam went with the building').toEqual([]);
  expect(handColumns(d), 'and so did its columns').toEqual([]);
});

test('the flight above takes its extra width on the wall side', async ({ page }) => {
  await open(page);
  // A NARROW 2 STOREY: the basement flight is pushed to the wall by the rule
  // above, which is exactly the case rule B widens the flight over it for.
  await traceHouse(page, 'twoStorey', [[-9, -18], [9, -18], [9, 18], [-9, 18]]);
  const d = await saved(page);
  const runs = (d.stairs || []).filter(s => (s.view || 'plan') === 'plan');
  const lower = runs.find(s => Number(s.levelId) === MAIN_FL);
  const upper = runs.find(s => Number(s.levelId) === 5);
  expect(lower && upper, 'a flight on each floor').toBeTruthy();
  expect(r(upper.widthFt), 'the upper flight is the wider one').toBe(3.5);
  expect(r(lower.widthFt)).toBe(3);
  // THE INSIDE EDGES LINE UP, which is the whole of "line it up on and leave
  // the extra inch on the exterior wall side": the flight above grew 6", and
  // all 6" went toward the wall rather than 3" of it into the room.
  const grew = (upper.widthFt - lower.widthFt) / 2;
  const house = boxOf((d.outlines || [])
    .find(o => Number(o.levelId) === MAIN_FL && !o.garage).points);
  const towardWall = Math.abs(lower.start.x - house.x0) < Math.abs(lower.start.x - house.x1)
    ? -1 : 1;
  expect(r(upper.start.x - lower.start.x), 'the centre moved half the growth, wall-ward')
    .toBe(r(towardWall * grew));
  expect(r(upper.start.z), 'and not along the run').toBe(r(lower.start.z));
});
