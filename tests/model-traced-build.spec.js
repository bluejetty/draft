// THE BONE BUILDS THE HOUSE THE DRAFTER TRACED (BONEYARD PR 3b).
//
// Movie, 3 Oct: the drive-thru's "CLICK HERE to draw house OUTLINE", then
// "main floor -> garage (if attached) -> bone builds, like the premade
// houses", for every type, with automatic windows and doors. His rulings on
// the roofs: a bungalow + garage is one roof, a garage on a lower plate (2
// STOREY + garage) keeps its own; a bilevel's entry is placed for him after
// the garage is traced.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

// A HOUSE AT 9'-1 1/8", WHICH THE GARAGE'S 10'-1 3/4" DEFAULT TOPS OUT LEVEL
// WITH (Movie, 6 Oct: the garage stands on the house sill, one MAIN floor
// package below the house's floor). At the office's 8'-1 1/8" the garage
// stands a foot taller and gets its own roof -- tests/project-garage-height
// covers that; the checks here are about a garage under the house's plate.
const matchedTops = () => ({ ...empty(), levelAssemblies: { 3: { wallHeightFt: 109.125 / 12 } } });

async function open(page, file = empty()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// The board, the type, and CLICK HERE to draw it.
async function drawType(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`[data-build-family="${family}"]`).click();
  await page.locator(`[data-build-entry="${entry}"]`).click();
  await page.locator('#dt-outline').click();
  await expect(page.locator('#drivethru')).toHaveAttribute('data-shut', '');
  // The sign slides down for 220 ms and takes a press until it is gone: a
  // corner in its path would land on the sign, not the plan.
  await expect(page.locator('#drivethru')).toBeHidden();
}

async function trace(page, corners) {
  const { at } = await h.planFrame(page);
  for (const [x, z] of [...corners, corners[0]]) await page.mouse.click(...at(x, z));
  // PROFESSOR GRUFF'S GARAGE LESSON comes up when a house that hangs a
  // garage closes; ENTER puts him away, as his button says.
  if (await page.locator('#garage-lesson').isVisible()) {
    await page.keyboard.press('Enter');
    await expect(page.locator('#garage-lesson')).toBeHidden();
  }
  // CONNECT AT CORNER, answered the way a drafter does: Enter, 1'-0".
  await page.waitForTimeout(150);
  if (await page.locator('#corner-join').isVisible()) {
    await page.keyboard.press('Enter');
    await expect(page.locator('#corner-join')).toBeHidden();
  }
}
// The old page's OPEN garage run: presses only, no closing press.
async function run(page, corners) {
  const { at } = await h.planFrame(page);
  for (const [x, z] of corners) await page.mouse.click(...at(x, z));
}

// CLOSING THE LAST LOOP BUILDS IT (Movie, 3 Oct: "Build right away") --
// no bone press. What is left is to save and read the file back.
async function build(page) {
  await page.waitForTimeout(500);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

// A MOD BILEVEL WAITS FOR THE BONE: its room's end wall is moved first.
async function boneBuild(page) {
  await page.locator('#bone').click();
  await page.locator('[data-build-choice-build]').click();
  return build(page);
}

const HOUSE = [[-10, -8], [10, -8], [10, 8], [-10, 8]];
// In front of the house, against its front wall, two feet past its right corner.
const GARAGE = [[-2, 8], [12, 8], [12, 24], [-2, 24]];

test('a traced 1 STOREY + GARAGE is built whole, under one roof', async ({ page }) => {
  await open(page, matchedTops());
  await drawType(page, 'bungalow', 'bungalow-garage');
  await trace(page, HOUSE);
  await expect(page.locator('#strip-message')).toContainText('Now draw the garage');
  await trace(page, GARAGE);
  const d = await build(page);

  const main = d.outlines.filter(o => Number(o.levelId) === 3);
  expect(main.filter(o => o.garage).length, 'the garage body').toBe(1);
  expect(main.filter(o => !o.garage).length, 'the house body').toBe(1);
  expect(d.boneyardOutlines, 'the trace came off with the build').toEqual([]);
  expect(d.walls.filter(w => Number(w.levelId) === 1).length, 'concrete under it').toBeGreaterThan(0);
  expect(d.floors.length, 'a floor').toBeGreaterThan(0);
  expect(d.roofs.length, 'one roof over house and garage').toBe(1);
  const doors = d.fenestrations.filter(f => f.type === 'door');
  expect(doors.filter(f => f.garage).length, 'overhead doors on the garage').toBeGreaterThan(0);
  expect(doors.filter(f => !f.garage).length, 'a front door and a man door').toBeGreaterThanOrEqual(2);
  expect(d.fenestrations.filter(f => f.type === 'window').length, 'windows dealt').toBeGreaterThan(0);

  // ONE CTRL+Z takes the house and puts the trace back.
  await page.locator('#model-undo').click();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const back = await h.savedDrawing(page);
  expect(back.walls.length, 'the house went').toBe(0);
  expect(back.boneyardOutlines.length, 'the two traced loops came back').toBe(2);
});

test('a traced 2 STOREY + GARAGE keeps the garage under its own lower roof', async ({ page }) => {
  await open(page);
  await drawType(page, 'bungalow', 'twoStorey-garage');
  await trace(page, HOUSE);
  await trace(page, GARAGE);
  const d = await build(page);
  expect(d.walls.filter(w => Number(w.levelId) === 5).length, 'the upper storey').toBeGreaterThan(0);
  expect(d.roofs.length, 'two roofs').toBe(2);
  expect(d.roofs.filter(r => r.garage).length, 'one of them the garage\'s').toBe(1);
});

test('a traced BILEVEL + GARAGE gets its entry placed for it', async ({ page }) => {
  await open(page);
  await drawType(page, 'bilevel', 'bilevel-garage');
  await trace(page, HOUSE);
  await trace(page, GARAGE);
  const d = await build(page);
  expect(d.levels.some(l => Number(l.id) === 2), 'the ENTRY level').toBe(true);
  const entry = d.outlines.find(o => Number(o.levelId) === 2);
  expect(entry, 'the entry body').toBeTruthy();
  // STRADDLING THE GARAGE LINE (x = -2): six feet either side, on the front.
  const xs = entry.points.map(p => p.x), zs = entry.points.map(p => p.z);
  expect([Math.min(...xs), Math.max(...xs), Math.max(...zs), Math.min(...zs)]).toEqual([-8, 4, 8, 2]);
  expect(d.stairs.length, 'the up and down flights').toBeGreaterThanOrEqual(2);
});

test('a traced DETACHED GARAGE is built on its own loop', async ({ page }) => {
  await open(page);
  await drawType(page, 'detachedGarage', 'detached-thickened');
  await trace(page, [[0, 0], [14, 0], [14, 18], [0, 18]]);
  const d = await build(page);
  const g = d.outlines.filter(o => o.garage && o.detached);
  expect(g.length, 'one detached garage').toBe(1);
  const xs = g[0].points.map(p => p.x), zs = g[0].points.map(p => p.z);
  expect([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]).toEqual([0, 14, 0, 18]);
  expect(d.fenestrations.some(f => f.garage), 'its overhead door').toBe(true);
  expect(d.roofs.length, 'its roof').toBe(1);
});

// A garage deeper than the room, so the room takes 18 ft at the house end
// and the rest keeps a lower roof of its own.
const DEEP_GARAGE = [[-2, 8], [12, 8], [12, 32], [-2, 32]];

test('a traced 2 STOREY + ROOM OVER puts the room on the 18 ft at the house end', async ({ page }) => {
  await open(page);
  await drawType(page, 'bungalow', 'twoStorey-over');
  await trace(page, HOUSE);
  await trace(page, DEEP_GARAGE);
  const d = await build(page);
  const room = d.outlines.filter(o => Number(o.levelId) === 5 && !o.garage)
    .find(o => Math.max(...o.points.map(p => p.z)) > 8);
  expect(room, 'the room over the garage, on 2ND FL').toBeTruthy();
  expect(Math.max(...room.points.map(p => p.z)), '18 ft out from the house front').toBe(26);
  expect(d.roofs.length, 'one over house and room, one lower over the rest').toBe(2);
  expect(d.roofs.filter(r => r.garage).length).toBe(1);
});

test('a traced MODIFIED BILEVEL gets its entry and its room over the garage', async ({ page }) => {
  await open(page);
  await drawType(page, 'bilevel', 'modifiedBilevel');
  await trace(page, HOUSE);
  await trace(page, DEEP_GARAGE);
  const d = await boneBuild(page);
  expect(d.levels.some(l => Number(l.id) === 2), 'ENTRY').toBe(true);
  expect(d.levels.some(l => Number(l.id) === 4), 'OVER GARAGE').toBe(true);
  expect(d.outlines.some(o => Number(o.levelId) === 4), 'the room').toBe(true);
  expect(d.stairs.length, 'three flights').toBeGreaterThanOrEqual(3);
  // THE ROOM'S ROOF HIPS AT EVERY CORNER (Movie, 6 Oct: "it should be
  // ridgeline to corner at 45"): it stands half a storey over MAIN, so no
  // edge dies into the house as a gable.
  const upper = d.roofs.find(r => Number(r.sourceLevelId) === 4);
  expect(upper, 'the room\'s own roof').toBeTruthy();
  expect(upper.edges.every(e => e === 'eave'), 'all eaves').toBe(true);
});

// THE BONE MID-TRACE IS NOT A PREMADE ORDER. Movie, 5 Oct: "i tried the
// outline method ... it allowed me to draw the outline, but then it asked me
// about saving or discarding the previous drawing ... and then it didn't make
// the outline, it just created the premade version square version". The
// MODIFIED BILEVEL waits for the garage loop; a press of the bone before it
// fell through to the order, counted his house loop as a building already in
// the file, offered a clean file and built the premade square. It says what
// the trace still needs now, and the trace carries on to his own house.
test('the bone pressed before the garage is traced asks for the garage, not a new file', async ({ page }) => {
  await open(page);
  await drawType(page, 'bilevel', 'modifiedBilevel');
  await trace(page, HOUSE);
  await expect(page.locator('#strip-message')).toContainText('Now draw the garage');
  await page.locator('#bone').click();
  await page.locator('[data-build-choice-build]').click();
  await expect(page.locator('#strip-message')).toContainText('Draw the garage first');
  await expect(page.locator('#file-guard')).toBeHidden();
  await trace(page, DEEP_GARAGE);
  const d = await boneBuild(page);
  expect(d.levels.some(l => Number(l.id) === 4), 'OVER GARAGE').toBe(true);
  // HIS house, not the premade square: the main floor stands on his loop.
  const xs = d.walls.filter(w => Number(w.levelId) === 3 && w.body !== 'garage')
    .flatMap(w => [w.start.x, w.end.x]);
  expect(Math.min(...xs)).toBeCloseTo(Math.min(...HOUSE.map(p => p[0])), 0);
});

// THE ROOM'S END WALL IS A LINE HE MOVES (Movie, 5-6 Oct): after the garage
// closes, the entry, the balcony and the room are shown and the room's end
// wall is dragged in whole feet -- 8 ft at least, up to 2 ft past the garage
// front. At the front or past it there is no lower garage roof; short of it
// a lower roof covers the open garage. DEEP_GARAGE runs z 8..32, 24 ft deep.
async function dragRoomTo(page, z) {
  const line = await page.evaluate(() => window.ModelRoomPick.line());
  expect(line, 'the room\'s end line is offered').toBeTruthy();
  const { at } = await h.planFrame(page);
  const mid = { x: (line[0].x + line[1].x) / 2, z: (line[0].z + line[1].z) / 2 };
  await page.mouse.move(...at(mid.x, mid.z));
  await page.mouse.down();
  await page.mouse.move(...at(mid.x, z), { steps: 8 });
  await page.mouse.up();
}
const roomOver = d => d.outlines.find(o => Number(o.levelId) === 4);
const maxZ = loop => Math.max(...loop.points.map(p => p.z));

test('the MOD BILEVEL room is cantilevered 2 ft past the garage and the lower roof goes', async ({ page }) => {
  await open(page);
  await drawType(page, 'bilevel', 'modifiedBilevel');
  await trace(page, HOUSE);
  await trace(page, DEEP_GARAGE);
  await expect(page.locator('#strip-message')).toContainText('Drag the bold line');
  expect(await page.evaluate(() => window.ModelRoomPick.depthFt()), 'the design\'s 18 ft to start').toBe(18);
  // Past the 2 ft it may hang: held at 26.
  await dragRoomTo(page, 40);
  expect(await page.evaluate(() => window.ModelRoomPick.depthFt())).toBe(26);
  await expect(page.locator('#strip-message')).toContainText('2 ft past the garage front');
  const d = await boneBuild(page);
  expect(maxZ(roomOver(d)), 'the room reaches 2 ft past the garage front').toBeCloseTo(34, 3);
  expect(d.roofs.filter(r => r.garage).length, 'no lower garage roof').toBe(0);
});

test('the MOD BILEVEL room moved short of the front keeps a lower roof over the open garage', async ({ page }) => {
  await open(page);
  await drawType(page, 'bilevel', 'modifiedBilevel');
  await trace(page, HOUSE);
  await trace(page, DEEP_GARAGE);
  await dragRoomTo(page, 28.3);
  expect(await page.evaluate(() => window.ModelRoomPick.depthFt()), 'whole feet').toBe(20);
  const d = await boneBuild(page);
  expect(maxZ(roomOver(d))).toBeCloseTo(28, 3);
  const lower = d.roofs.filter(r => r.garage);
  expect(lower.length, 'one lower garage roof').toBe(1);
  const zs = lower[0].points.map(p => p.z);
  // From the room's end wall out over the 4 ft left open (and its eave).
  expect(Math.min(...zs), 'the lower roof dies into the room').toBeCloseTo(28, 3);
  expect(Math.max(...zs), 'and covers the open garage to its front').toBeGreaterThanOrEqual(32);
});

// THE GARAGE STEP, THE OLD PAGE'S WAY (Movie, 6 Oct: "check the
// model.dc.html. it worked good in there (the garage outline )"). Professor
// Gruff says how it connects, and the garage is three legs from the house
// and back to it -- it closes itself along the house wall.
test('the garage step brings up Professor Gruff, and "don\'t show this again" holds', async ({ page }) => {
  await open(page);
  await drawType(page, 'bungalow', 'bungalow-garage');
  const { at } = await h.planFrame(page);
  for (const [x, z] of [...HOUSE, HOUSE[0]]) await page.mouse.click(...at(x, z));
  await expect(page.locator('#garage-lesson')).toBeVisible();
  await expect(page.locator('#garage-lesson')).toContainText('ON the house');
  await page.locator('[data-garage-lesson-off]').check();
  await page.locator('[data-garage-lesson-go]').click();
  await expect(page.locator('#garage-lesson')).toBeHidden();
  // The next house that hangs a garage does not ask again -- after a reload,
  // because the tick is a setting, not something the page holds.
  await open(page);
  await drawType(page, 'bungalow', 'twoStorey-garage');
  const again = await h.planFrame(page);
  for (const [x, z] of [...HOUSE, HOUSE[0]]) await page.mouse.click(...again.at(x, z));
  await expect(page.locator('#strip-message')).toContainText('Now draw the garage');
  await expect(page.locator('#garage-lesson')).toBeHidden();
});

test('a garage drawn as three legs off the house closes itself along the house wall', async ({ page }) => {
  await open(page, matchedTops());
  await drawType(page, 'bungalow', 'bungalow-garage');
  await trace(page, HOUSE);
  // First corner on the front wall, out, across, and back -- the last press a
  // foot short of the wall, brought onto it along its own leg.
  await run(page, [[-2, 8.4], [-2, 24], [8, 24], [8, 9]]);
  const d = await build(page);
  const g = d.outlines.filter(o => Number(o.levelId) === 3 && o.garage);
  expect(g.length, 'the garage body').toBe(1);
  const xs = g[0].points.map(p => p.x), zs = g[0].points.map(p => p.z);
  expect([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]).toEqual([-2, 8, 8, 24]);
  expect(d.roofs.length, 'one roof over house and garage').toBe(1);
});

// CONNECT AT CORNER (Movie, 6 Oct): a garage wall that carries a house wall
// on past its corner is moved over 1 ft, square, with a stub at the corner,
// so the garage's foundation bears full on the house wall. On DRAFTING it
// asks -- 1'-0" first, or the foundation's thickness; on TOY it just does it.
// The garage here runs down the house's right wall (x = 10) and on past its
// front corner (10, 8) to z = 14.
const SIDE_RUN = [[10, -4], [30, -4], [30, 14], [10, 14], [10, 8]];
const garageOf = d => d.outlines.find(o => Number(o.levelId) === 3 && o.garage);
const has = (loop, x, z) => loop.points.some(p => Math.abs(p.x - x) < 1e-6 && Math.abs(p.z - z) < 1e-6);

test('DRAFTING: CONNECT AT CORNER asks, and Enter moves the garage wall over 1 ft', async ({ page }) => {
  await open(page);
  await drawType(page, 'bungalow', 'bungalow-garage');
  await trace(page, HOUSE);
  await run(page, SIDE_RUN);
  await expect(page.locator('#corner-join')).toBeVisible();
  await expect(page.locator('#corner-join')).toContainText('FOUNDATION THICKNESS (8")');
  await page.keyboard.press('Enter');
  await expect(page.locator('#corner-join')).toBeHidden();
  const d = await build(page);
  const g = garageOf(d);
  expect(g, 'the garage body').toBeTruthy();
  expect([has(g, 11, 14), has(g, 11, 8), has(g, 10, 14)], 'the wall 1 ft over, the stub at the corner')
    .toEqual([true, true, false]);
});

test('TOY: the garage wall is moved over 1 ft without asking', async ({ page }) => {
  await open(page);
  await page.locator('[data-board-switch] [data-board="toy"]').click();
  await drawType(page, 'bungalow', 'bungalow-garage');
  await trace(page, HOUSE);
  await run(page, SIDE_RUN);
  await expect(page.locator('#corner-join')).toBeHidden();
  const d = await build(page);
  const g = garageOf(d);
  expect([has(g, 11, 14), has(g, 11, 8)]).toEqual([true, true]);
});

// LINED UP IS ALREADY FASTENED (Movie, 6 Oct): "if the wall connects at the
// corner and LINES UP - there is no req. for it to move over". Here the
// garage's front wall carries on in line with the house's front wall
// (z = 8) and both buildings sit behind it, so the two 8" walls meet face to
// face: no question, no move.
test('a garage wall that lines up with the house wall is not moved', async ({ page }) => {
  await open(page);
  await drawType(page, 'bungalow', 'bungalow-garage');
  await trace(page, HOUSE);
  await run(page, [[10, 8], [10, -4], [30, -4], [30, 8], [10, 8]]);
  await page.waitForTimeout(200);
  await expect(page.locator('#corner-join')).toBeHidden();
  await expect(page.locator('#strip-message')).not.toContainText(/crosses itself/i);
  const d = await build(page);
  const g = garageOf(d);
  expect(g, 'the garage body').toBeTruthy();
  const zs = g.points.map(p => p.z), xs = g.points.map(p => p.x);
  expect([Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)],
    'the garage exactly as traced').toEqual([10, 30, -4, 8]);
});

// A TRACE THE TYPE CANNOT TAKE IS NOT BUILT, and says why: the bone stays
// the way on once the drafter has fixed it.
test('a closed trace the type refuses builds nothing and says why', async ({ page }) => {
  await open(page);
  await drawType(page, 'bilevel', 'bilevel');
  await trace(page, [[0, 0], [8, 0], [8, 8], [0, 8]]);
  await expect(page.locator('#strip-message')).toContainText('front');
  // AND THE BONE DOES NOT BUILD THE PREMADE IN ITS PLACE (Movie, 6 Oct: "the
  // house didn't get drawn in proper shape as requested").
  await page.locator('#bone').click();
  await page.locator('[data-build-choice-build]').click();
  await expect(page.locator('#file-guard')).toBeHidden();
  await page.waitForTimeout(400);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  expect(d.walls.length, 'no house').toBe(0);
  expect(d.boneyardOutlines.length, 'the trace is kept').toBe(1);
});
