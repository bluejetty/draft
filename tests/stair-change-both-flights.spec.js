// CHANGE BOTH FLIGHTS (jb, 25 Nov 2026).
//
// "beside UPPER 10 - LOWER 2 on the right put a box for CHANGE BOTH FLIGHTS
// and if they click it it will match the changes on each level. also for
// some reason these stairs aren't lining up properly", then "the landings
// should line up ... but sometimes the stairs might not land directly over
// or below so that will need to be adjustable".
//
// Why they drifted: every floor's flight is its own record and an edit only
// touched the one picked -- the 2ND FL flight stacked as the mirror of a
// 2-step entry L (UPPER 11 · LOWER 2) never heard that MAIN's became 6 / 6.
// Ticked (`matchStack`), the shape, turn, split, landings, width and rail go
// to every flight of the stack, laid from the same top nosing; each floor
// keeps its own risers. Unticked, the one flight alone.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const FOUNDATION = 1, MAIN_FL = 3, SECOND = 5;
const BASE_ID = 7701;   // MAIN -> basement
const UPPER_ID = 7702;  // 2ND -> MAIN

const rect = (wide = 40, deep = 32) => [
  { x: -wide / 2, y: 0, z: -deep / 2 }, { x: wide / 2, y: 0, z: -deep / 2 },
  { x: wide / 2, y: 0, z: deep / 2 }, { x: -wide / 2, y: 0, z: deep / 2 },
];
const flight = (id, levelId, extra = {}) => ({
  id, levelId, view: 'plan', layer: 'A-STR',
  start: { x: -8, y: 0, z: -10 }, end: { x: -3, y: 0, z: -10 },
  widthFt: 3, riseFt: 9, rail: 'left', shape: 'L', turn: 'right', winders: 0, auto: false, ...extra,
});
// jb's screenshots: MAIN FL an L 6 / 6; 2ND FL stacked the entry-L way --
// turned the other way, 11 / 2, its first flight along MAIN's second.
const drifted = () => [
  flight(BASE_ID, MAIN_FL, { splitTreads: 6 }),
  flight(UPPER_ID, SECOND, { start: { x: -1.25, y: 0, z: -4 }, end: { x: -1.25, y: 0, z: -9 },
    turn: 'left', splitTreads: 11, widthFt: 3.5, rail: 'right' }),
];
const house = (stairs = drifted()) => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: SECOND, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: FOUNDATION, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  walls: [], lines: [], roofs: [], fenestrations: [], dimensions: [], shapes: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [], surfaceOpenings: [],
  outlines: [
    { id: 'o-main', levelId: MAIN_FL, garage: false, points: rect() },
    { id: 'o-2nd', levelId: SECOND, garage: false, points: rect() },
  ],
  floors: [MAIN_FL, SECOND].map(levelId => ({
    id: `f-${levelId}`, levelId, view: 'plan', structure: 'floor', garage: false,
    slopeInPerFt: 0, thickness: 0.9583333333333334, thickenedEdge: false, points: rect(),
  })),
  stairs,
});

async function open(page, file = house(), level = MAIN_FL) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openEditor(page, { drawing: file, bucket: BUCKET, url: `/MODEL.html?left=1&lpane=build&right=1&level=${level}`, webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
}
const live = (page, id) => page.evaluate(id => {
  const st = drawing.stairs.find(s => Number(s.id) === id);
  return st ? JSON.parse(JSON.stringify(st)) : null;
}, id);
// The plan as drawn: each run's start, way and tread count, and the landing.
const drawn = (page, id) => page.evaluate(id => {
  const SG = window.DraftStairGeometry;
  const st = drawing.stairs.find(s => Number(s.id) === id);
  const parts = SG.stairPlanParts(st, SG.stairCurrentLayout(st, stairLevels()));
  const r = v => Math.round(v * 1000) / 1000;
  return {
    runs: parts.runs.map(run => ({ x: r(run.start.x), z: r(run.start.z), dx: r(run.dir.x), dz: r(run.dir.z),
      treads: run.treads, w: r(run.widthFt) })),
    landing: parts.landing ? parts.landing.poly.map(p => [r(p.x), r(p.z)]) : null,
  };
}, id);
async function pickAt(page, x, z) {
  const { at } = await h.planFrame(page);
  const [sx, sy] = at(x, z);
  await page.mouse.move(sx, sy);
  await expect(page.locator('#hover-name')).toHaveText('STAIR', { timeout: 4000 });
  await page.mouse.click(sx, sy);
  await page.waitForTimeout(100);
}
const pickMain = page => pickAt(page, -6, -10);
const flightsRow = page => page.locator('[data-prop-row="flights"]').first();
const box = page => flightsRow(page).locator('[data-stair-match] input');
const strip = page => page.locator('#strip-message');

test('the box stands beside UPPER · LOWER, unticked on an older file: FLIGHTS changes the one flight only', async ({ page }) => {
  await open(page);
  await pickMain(page);
  await expect(flightsRow(page).locator('[data-stair-match]')).toHaveText('CHANGE BOTH FLIGHTS');
  await expect(box(page)).not.toBeChecked();
  await flightsRow(page).locator('[data-stair-step="flights-more"]').click();
  expect((await live(page, BASE_ID)).splitTreads).toBe(7);
  expect((await live(page, UPPER_ID)).splitTreads, '2ND FL left as it was').toBe(11);
});

test('ticking it lines 2ND FL up with MAIN FL: same turn, split, landing; its own risers; one UNDO', async ({ page }) => {
  await open(page);
  const before = await live(page, UPPER_ID);
  await pickMain(page);
  await box(page).check();
  await expect(strip(page)).toContainText(/CHANGE BOTH FLIGHTS -- matched on 2ND FL/);
  const base = await live(page, BASE_ID), upper = await live(page, UPPER_ID);
  expect(base.matchStack && upper.matchStack, 'ticked on both').toBe(true);
  expect([upper.shape, upper.turn, upper.splitTreads, upper.rail]).toEqual(['L', 'right', 6, 'left']);
  expect(upper.widthFt).toBeCloseTo(3, 6);
  expect([upper.start.x, upper.start.z]).toEqual([base.start.x, base.start.z]);
  const a = await drawn(page, BASE_ID), b = await drawn(page, UPPER_ID);
  expect(b.landing, 'the landings lie over each other').toEqual(a.landing);
  expect(b.runs[0]).toEqual(a.runs[0]);
  expect(b.runs[1].x).toBeCloseTo(a.runs[1].x, 6);
  expect([b.runs[1].dx, b.runs[1].dz]).toEqual([a.runs[1].dx, a.runs[1].dz]);
  expect(upper.riseFt, 'its own rise').toBe(before.riseFt);

  await page.keyboard.press('Escape');
  await page.locator('#model-undo').click();
  const back = await live(page, UPPER_ID);
  expect([back.turn, back.splitTreads, back.start.x, back.start.z, back.widthFt])
    .toEqual([before.turn, before.splitTreads, before.start.x, before.start.z, before.widthFt]);
  expect(back.matchStack).toBeUndefined();
  expect((await live(page, BASE_ID)).matchStack).toBeUndefined();
});

test('ticked: FLIGHTS, TURN, WIDTH and RAIL on MAIN FL are made on 2ND FL too; untick and it is MAIN alone again', async ({ page }) => {
  await open(page);
  await pickMain(page);
  await box(page).check();
  await pickMain(page);
  await flightsRow(page).locator('[data-stair-step="flights-more"]').click();
  await expect(strip(page)).toContainText(/matched on 2ND FL/);
  expect((await live(page, UPPER_ID)).splitTreads).toBe(7);

  await page.locator('[data-prop-row="turn"] [data-prop-value="left"]').first().click();
  expect((await live(page, UPPER_ID)).turn).toBe('left');
  expect(await drawn(page, UPPER_ID).then(d => d.landing)).toEqual(await drawn(page, BASE_ID).then(d => d.landing));

  const w = page.locator('[data-stair-width]').first();
  await w.fill('42');
  await w.press('Enter');
  expect((await live(page, UPPER_ID)).widthFt * 12).toBeCloseTo(42, 4);

  await page.locator('[data-prop-row="rail"] [data-prop-value="both"]').first().click();
  expect((await live(page, UPPER_ID)).rail).toBe('both');

  // ONE UNDO takes the rail off both.
  await page.locator('#model-undo').click();
  expect((await live(page, UPPER_ID)).rail).toBe('left');
  expect((await live(page, BASE_ID)).rail).toBe('left');

  await pickMain(page);
  await box(page).uncheck();
  await pickMain(page);
  await flightsRow(page).locator('[data-stair-step="flights-less"]').click();
  expect((await live(page, BASE_ID)).splitTreads).toBe(6);
  expect((await live(page, UPPER_ID)).splitTreads, 'adjustable on its own again').toBe(7);
});

test('the 9" EXT. WALL widening stays on the wall side of the flight above after a match', async ({ page }) => {
  await open(page);
  await pickMain(page);
  await page.locator('[data-prop-row="ext leg 1"] [data-prop-value="left"]').first().click();
  await pickMain(page);
  await box(page).check();
  const upper = await live(page, UPPER_ID);
  expect(upper.legWiden[0]).toEqual({ in: 9, side: 'left' });
  const a = await drawn(page, BASE_ID), b = await drawn(page, UPPER_ID);
  expect(b.runs[0].w * 12).toBeCloseTo(45, 4);
  expect(a.runs[0].w * 12).toBeCloseTo(36, 4);
});

test('a stair laid on every floor comes ticked, and the tick is saved', async ({ page }) => {
  await open(page, house([]));
  const { at } = await h.planFrame(page);
  await page.locator('[data-tool-key="stair"]').click();
  await page.locator('[data-stair-shape="L"]').click();
  const press = async (x, z) => {
    await page.mouse.move(...at(x, z)); await page.waitForTimeout(80);
    await page.mouse.click(...at(x, z)); await page.waitForTimeout(120);
  };
  await press(-10, -10);
  await press(4, -10);
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  const saved = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, BUCKET);
  expect(saved.stairs).toHaveLength(2);
  expect(saved.stairs.every(s => s.matchStack === true)).toBe(true);
  // And read back on the next open (drawing-format keeps the field).
  await page.goto(`/MODEL.html?left=1&lpane=build&right=1&level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(300);
  const reopened = await page.evaluate(() => drawing.stairs.map(s => s.matchStack));
  expect(reopened).toEqual([true, true]);
});
