// A TURNED STAIR'S FLIGHTS AND LANDINGS (jb, 14 Nov 2026).
//
// "for the U SHaped and L shaped we should add a section in the prop/oject
// so that the user can add more stairs to the upper portion (delete from
// lower) or vice versa"; "ad a section for LOWER STAIR LANDING and UPPER
// STAIR LANDING ... 2 or 3 winders per landing"; "on U shaped the wide
// landing should be considered 2 landings (put them level at first and then
// they can add a step by increasing the upper landing"; "on the U we should
// also allow stairs between the upper and lower landings too".
//
// FLIGHTS moves a tread across the turn (`splitTreads`), the risers never
// change. A U's UPPER and LOWER LANDING each take FLAT / 2 / 3 WINDERS
// (`winders`, `lowerWinders`), and STEPS BETWEEN LANDINGS (`midRisers`)
// parts them: 0 level, 1 a single riser, more a middle flight across.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const STAIR_ID = 7401;
const MATE_ID = 7402;
const FLOOR_ID = 'FL-TEST-1';
const WELL_ID = 'OP-TEST-1';

// A straight flight across an empty MAIN FL with the floor it is cut through,
// and 9 ft of rise -- which at the 7 7/8" maximum riser is thirteen treads,
// well past the three a turn needs.
const base = ({ shape = 'straight', winders = 0, shared = false } = {}) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [],
  underlays: [],
  floors: [{
    id: FLOOR_ID, levelId: MAIN_FL, view: 'floor', structure: 'floor',
    points: [{ x: -20, z: -16 }, { x: 20, z: -16 }, { x: 20, z: 16 }, { x: -20, z: 16 }],
  }],
  stairs: [
    {
      id: STAIR_ID, levelId: MAIN_FL, view: 'plan', layer: 'A-STR',
      start: { x: -2, z: -4 }, end: { x: 8, z: -4 },
      widthFt: 3, riseFt: 9, rail: 'left',
      shape, turn: 'right', winders, auto: true,
    },
    ...(shared ? [{
      id: MATE_ID, levelId: MAIN_FL, view: 'plan', layer: 'A-STR',
      start: { x: -2, z: 6 }, end: { x: 8, z: 6 },
      widthFt: 3, riseFt: 9, rail: 'left',
      shape: 'straight', turn: 'right', winders: 0, auto: true,
    }] : []),
  ],
  surfaceOpenings: [{
    id: WELL_ID, hostType: 'floor', hostId: FLOOR_ID, levelId: MAIN_FL,
    stairId: STAIR_ID,
    ...(shared ? { stairIds: [STAIR_ID, MATE_ID] } : {}),
    points: [
      { x: -2.5, z: -5.5 }, { x: 8.5, z: -5.5 },
      { x: 8.5, z: -2.5 }, { x: -2.5, z: -2.5 },
    ],
  }],
});

async function open(page, fixture) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: fixture });
  await page.goto(`/MODEL.html?left=1&right=1&level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}

async function save(page) {
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
}

// WHAT A FRESH LOAD KEEPS, not what the page holds: DraftDrawingFormat is the
// normaliser the page runs on open, so this asks the question a reload asks --
// and `winders` is exactly the field a reader can quietly drop (it is zeroed
// for any shape but L).
const survives = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const raw = JSON.parse(await file.text());
  const levelIds = new Set((raw.levels || []).map(level => Number(level.id)));
  return {
    stairs: window.DraftDrawingFormat.stairs(raw.stairs, levelIds),
    wells: raw.surfaceOpenings,
  };
}, BUCKET);

const stairOf = (file, id = STAIR_ID) => file.stairs.find(s => Number(s.id) === id);
const wellOf = file => file.wells.find(o => o.id === WELL_ID);

// Select the stair: a click where the first run is, a foot and a half down
// from the top nosing. The hover label is asked for the point first, so a
// press that missed the flight cannot read as a panel that failed to build.
async function pickStair(page, stair) {
  const { at } = await h.planFrame(page);
  const len = Math.hypot(stair.end.x - stair.start.x, stair.end.z - stair.start.z);
  const dir = { x: (stair.end.x - stair.start.x) / len, z: (stair.end.z - stair.start.z) / len };
  const [x, y] = at(stair.start.x + dir.x * 1.5, stair.start.z + dir.z * 1.5);
  await page.mouse.move(x, y);
  await expect(page.locator('#hover-name'), 'the click point is on the stair')
    .toHaveText('STAIR', { timeout: 4000 });
  await page.mouse.click(x, y);
  await expect(page.locator('#props-slot [data-prop-row="shape"]')).toBeVisible({ timeout: 4000 });
  return [x, y];
}

const chip = (page, row, value) =>
  page.locator(`#props-slot [data-prop-row="${row}"] [data-prop-value="${value}"]`);

const parts = (page, id = STAIR_ID) => page.evaluate(id => {
  const SG = window.DraftStairGeometry;
  const st = drawing.stairs.find(s => Number(s.id) === id);
  const layout = SG.stairCurrentLayout(st, stairLevels());
  const split = SG.stairShapeSplit(st, layout);
  const p = SG.stairPlanParts(st, layout);
  return { treads: layout.treads, risers: layout.risers, split, landings: p.landings.length,
    middle: p.middle ? p.middle.treads : 0, winderLines: p.landings.map(l => l.winderLines.length),
    seq: SG.stairSequence(split) };
}, id);
const said = (page, key) => page.locator(`#props-slot [data-stair-step-said="${key}"]`);
const step = (page, key, dir) => page.locator(`#props-slot [data-stair-step="${key}-${dir}"]`);

test('FLIGHTS moves a tread from one flight to the other; the risers stay; UNDO puts it back', async ({ page }) => {
  await open(page, base({ shape: 'L' }));
  await pickStair(page, base({ shape: 'L' }).stairs[0]);
  const was = await parts(page);
  await expect(said(page, 'flights')).toHaveText(`UPPER ${was.split.t1} \u00b7 LOWER ${was.split.t2}`);

  await step(page, 'flights', 'more').click();
  let now = await parts(page);
  expect(now.split.t1, 'the upper flight gains a tread').toBe(was.split.t1 + 1);
  expect(now.split.t2, 'the lower loses it').toBe(was.split.t2 - 1);
  expect(now.risers, 'the risers never change').toBe(was.risers);
  await expect(said(page, 'flights')).toHaveText(`UPPER ${was.split.t1 + 1} \u00b7 LOWER ${was.split.t2 - 1}`);

  await step(page, 'flights', 'less').click();
  await step(page, 'flights', 'less').click();
  now = await parts(page);
  expect(now.split.t1).toBe(was.split.t1 - 1);
  await save(page);
  expect(stairOf(await survives(page)).splitTreads, 'kept on reload').toBe(was.split.t1 - 1);

  await page.locator('#model-undo').click();
  expect((await parts(page)).split.t1).toBe(was.split.t1);
});

test('a U is two landings, level at first; STEPS BETWEEN parts them and the step comes off the upper flight', async ({ page }) => {
  await open(page, base({ shape: 'U' }));
  await pickStair(page, base({ shape: 'U' }).stairs[0]);
  const was = await parts(page);
  expect(was.landings, 'two landing squares').toBe(2);
  expect(was.split.merged, 'level at first: one landing slot, the stair as it always was').toBe(true);
  expect(was.split.landTreads).toBe(1);
  for (const row of ['flights', 'upper landing', 'steps between', 'lower landing']) {
    await expect(page.locator(`#props-slot [data-prop-row="${row}"]`), row).toBeVisible();
  }
  await expect(said(page, 'steps between')).toHaveText('LEVEL');

  // One riser between: the upper flight gives a tread.
  await step(page, 'steps between', 'more').click();
  let now = await parts(page);
  expect(now.split.midRisers).toBe(1);
  expect(now.split.t1, 'the step comes off the upper flight').toBe(was.split.t1 - 1);
  expect(now.split.t2).toBe(was.split.t2);
  expect(now.middle, 'a single riser is no middle flight').toBe(0);
  expect(now.seq.filter(x => x.flatFt).length, 'two flat landings at two heights').toBe(2);
  await expect(said(page, 'steps between')).toHaveText('1 RISER');

  // Two more: a middle flight of two treads across between the landings.
  await step(page, 'steps between', 'more').click();
  await step(page, 'steps between', 'more').click();
  now = await parts(page);
  expect(now.split.midRisers).toBe(3);
  expect(now.middle, 'a middle flight of midRisers - 1 treads').toBe(2);
  expect(now.split.t1 + now.split.t2 + now.split.landTreads, 'every tread accounted for').toBe(now.treads);
  expect(now.split.offFt, 'the flights stand further apart for it').toBeGreaterThan(was.split.offFt);

  await save(page);
  expect(stairOf(await survives(page)).midRisers, 'kept on reload').toBe(3);

  // Back to level, one press at a time; the treads go back up.
  for (let i = 0; i < 3; i += 1) await step(page, 'steps between', 'less').click();
  now = await parts(page);
  expect(now.split.merged).toBe(true);
  expect(now.split.t1).toBe(was.split.t1);
});

test('each U landing takes its own winders', async ({ page }) => {
  await open(page, base({ shape: 'U' }));
  await pickStair(page, base({ shape: 'U' }).stairs[0]);
  await chip(page, 'upper landing', '2').click();
  await chip(page, 'lower landing', '3').click();
  const now = await parts(page);
  expect(now.split.winders).toBe(2);
  expect(now.split.lowerWinders).toBe(3);
  expect(now.winderLines, 'one fan line on the upper square, two on the lower').toEqual([1, 2]);
  expect(now.split.landTreads, 'the winders are treads').toBe(5);
  await save(page);
  const kept = stairOf(await survives(page));
  expect(kept).toMatchObject({ shape: 'U', winders: 2, lowerWinders: 3 });
  await expect(chip(page, 'upper landing', '2')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'lower landing', '3')).toHaveAttribute('aria-pressed', 'true');

  // Back to an L: the second landing goes with the U.
  await chip(page, 'shape', 'L').click();
  await save(page);
  const asL = stairOf(await survives(page));
  expect(asL.lowerWinders).toBeUndefined();
  expect(asL.winders, 'the upper landing is the L\'s landing').toBe(2);
});
