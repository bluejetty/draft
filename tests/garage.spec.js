// An attached GARAGE is an OPEN outline run: MARK ATTACHED GARAGE arms the
// Outline tool so the next run of 3+ legs starts and ends ON the house outline,
// welding its end points onto shared house master points (inserting mid-wall
// points where needed; a corner landing only prompts for a stub when the leg
// continues a house wall with the garage on its far side). BUILD
// HOUSE then grows the grade beam along the open legs only (32" concrete +
// 1.5" plate, top of plate 1'-0" below the top of the house foundation), a
// flat 4" slab closed against the house, garage stud walls flush with the
// main-floor ceiling, and ONE roof over the combined house + garage loop.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// House: 16×12 rect. Attached garage: an open 3-leg run off the house's
// right side, both ends landing mid-wall on the x=8 edge.
async function drawHouseOutline(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function drawGarageRun(page, points) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
  for (const [x, z] of points) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
}

async function drawGarageOutline(page) {
  await drawGarageRun(page, [[8, -4], [20, -4], [20, 4], [8, 4]]);
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

async function dragWorld(page, fromX, fromZ, toX, toZ) {
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);
}

test('MARK ATTACHED GARAGE stores an OPEN run welded onto shared house points', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);

  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(2);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster).toBeTruthy();
  expect(garageMaster.open).toBe(true);
  expect(garageMaster.points).toHaveLength(4);

  // Mid-wall ends insert real points into the house master, and the garage
  // end points carry those ids as their attachments.
  const houseMaster = saved.boneyardOutlines.find(outline => !outline.garage);
  expect(houseMaster.points).toHaveLength(6);
  const houseIds = houseMaster.points.map(point => point.id);
  expect(houseIds).toContain(garageMaster.points[0].attach);
  expect(houseIds).toContain(garageMaster.points[3].attach);
  expect(houseMaster.points.some(point => h.near(point.x, 8) && h.near(point.z, -4))).toBe(true);
  expect(houseMaster.points.some(point => h.near(point.x, 8) && h.near(point.z, 4))).toBe(true);

  // Every level carries a copy of each, the garage copies open + flagged.
  expect(saved.outlines).toHaveLength(saved.levels.length * 2);
  const garageCopies = saved.outlines.filter(outline => outline.garage);
  expect(garageCopies).toHaveLength(saved.levels.length);
  garageCopies.forEach(copy => expect(copy.open).toBe(true));
});

test('a run whose end misses the house stays alive to fix and finish', async ({ page }) => {
  await h.openModel(page);
  await page.keyboard.press('t'); // set the T-square down — the missing leg is deliberately angled
  await drawHouseOutline(page);
  await drawGarageRun(page, [[8, -4], [20, -4], [20, 4], [23, 10]]);
  await page.waitForTimeout(300);

  // Nothing committed — the house is still the only master.
  let saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines).toHaveLength(1);

  // Pull the run onto the house and finish again: now it lands.
  await h.clickWorld(page, 8, 4);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  saved = await h.savedDrawing(page);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster).toBeTruthy();
  expect(garageMaster.open).toBe(true);
  expect(garageMaster.points).toHaveLength(5);
});

test('a corner landing with the garage alongside the wall welds silently at the corner', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  // The first leg continues the front wall with the garage on the SAME side
  // as the house — faces line up, so no stub question.
  await drawGarageRun(page, [[8, -6], [20, -6], [20, 4], [8, 4]]);
  await h.waitForSaved(page);

  await expect(page.locator('[data-garage-corner-prompt]')).toHaveCount(0);
  const saved = await h.savedDrawing(page);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster).toBeTruthy();
  expect(garageMaster.cornerStubs).toHaveLength(0);
  expect(garageMaster.points).toHaveLength(4);
  expect(h.near(garageMaster.points[0].x, 8, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[0].z, -6, 0.05)).toBe(true);
  // Only the mid-wall end inserted a house point — the corner end reused it.
  const houseMaster = saved.boneyardOutlines.find(outline => !outline.garage);
  expect(houseMaster.points).toHaveLength(5);
});

// A run whose end leg extends the house's side wall southward with the garage
// body EAST of that wall line — house interior is west, so the runs would sit
// face to interior without an offset.
const OPPOSITE_SIDE_RUN = [[8, -6], [8, -14], [20, -14], [20, -2], [8, -2]];

test('an in-line corner landing prompts; the beam stub shifts the run over square', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageRun(page, OPPOSITE_SIDE_RUN);

  const prompt = page.locator('[data-garage-corner-prompt]');
  await expect(prompt).toBeVisible();
  await expect(prompt).toContainText('CONNECT AT CORNER');
  await expect(page.locator('[data-garage-stub-beam]')).toContainText('8"');
  await page.locator('[data-garage-stub-beam]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster.cornerStubs).toHaveLength(1);
  expect(garageMaster.cornerStubs[0].lengthIn).toBe(8);
  // The end stays welded on the corner; a square 8" stub joins it to the
  // shifted leg, whose outside corner moved the same 8" — no diagonal.
  expect(garageMaster.points).toHaveLength(6);
  expect(h.near(garageMaster.points[0].x, 8, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[0].z, -6, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[1].x, 8 + 8 / 12, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[1].z, -6, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[2].x, 8 + 8 / 12, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[2].z, -14, 0.05)).toBe(true);
});

test("the 1'-0\" stub option shifts the wall and its outside corner a full foot", async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageRun(page, OPPOSITE_SIDE_RUN);

  await expect(page.locator('[data-garage-corner-prompt]')).toBeVisible();
  await page.locator('[data-garage-stub-foot]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster.cornerStubs).toHaveLength(1);
  expect(garageMaster.cornerStubs[0].lengthIn).toBe(12);
  expect(garageMaster.points).toHaveLength(6);
  expect(h.near(garageMaster.points[1].x, 9, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[1].z, -6, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[2].x, 9, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[2].z, -14, 0.05)).toBe(true);
});

test('IN LINE keeps an aligned leg exactly where it was drawn — no stub, no shift', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageRun(page, OPPOSITE_SIDE_RUN);

  const prompt = page.locator('[data-garage-corner-prompt]');
  await expect(prompt).toBeVisible();
  await page.locator('[data-garage-stub-none]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster.cornerStubs).toHaveLength(0);
  expect(garageMaster.points).toHaveLength(5);
  expect(h.near(garageMaster.points[0].x, 8, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[0].z, -6, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[1].x, 8, 0.05)).toBe(true);
  expect(h.near(garageMaster.points[1].z, -14, 0.05)).toBe(true);
});

test('closing the loop under MARK ATTACHED GARAGE errors instead of committing', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);

  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
  await h.clickWorld(page, 8, -4);
  await h.clickWorld(page, 20, -4);
  await h.clickWorld(page, 20, 4);
  await h.clickWorld(page, 8, 4);
  await h.clickWorld(page, 8, -4);

  await expect(page.locator('[data-model-drawing-message]')).toContainText('OPEN run');
  const saved = await h.savedDrawing(page);
  expect(saved.boneyardOutlines.filter(outline => outline.garage)).toHaveLength(0);
});

test('MARK ATTACHED GARAGE without a house explains itself and stays off', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();

  await expect(page.locator('[data-model-drawing-message]')).toContainText('Draw the house OUTLINE first');
  await expect(page.getByRole('button', { name: /MARKING ATTACHED GARAGE/ })).toHaveCount(0);
});

test('an ICF foundation offers its own thickness as the grade-beam stub', async ({ page }) => {
  await h.openModel(page);

  // An ICF wall on the FOUNDATION layer set sets the house's assembly.
  await page.locator('.level-row', { has: page.locator('.level-name', { hasText: 'FOUNDATION' }) })
    .locator('.level-name').click();
  await page.waitForTimeout(300);
  await page.locator('.level-row', { has: page.locator('.level-name', { hasText: 'FOUNDATION' }) })
    .locator('.level-layer', { hasText: 'FOUNDATION' }).click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Wall');
  await page.getByRole('button', { name: 'ICF  (11¼")' }).click();
  await h.clickWorld(page, -20, -20);
  await h.clickWorld(page, -14, -20);
  await page.keyboard.press('Escape');
  await h.waitForSaved(page);

  await drawHouseOutline(page);
  await drawGarageRun(page, OPPOSITE_SIDE_RUN);

  await expect(page.locator('[data-garage-corner-prompt]')).toBeVisible();
  await expect(page.locator('[data-garage-stub-beam]')).toContainText('11 1/4"');
  await page.locator('[data-garage-stub-beam]').click();
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster.cornerStubs[0].lengthIn).toBeCloseTo(11.25, 5);
  expect(h.near(garageMaster.points[1].x, 8 + 11.25 / 12, 0.05)).toBe(true);
});

test('BUILD HOUSE grows the open-leg beam, flat slab, flush walls, and one roof', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);
  await buildHouse(page);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);

  // Grade beam on the 3 open legs only; the inserted attach points split the
  // house's right foundation wall, so the house builds 6 walls.
  const fdnWalls = saved.walls.filter(wall => wall.levelId === 1);
  expect(fdnWalls).toHaveLength(9); // 6 house + 3 garage
  fdnWalls.forEach(wall => {
    expect(wall.wallType).toBe('concrete_8');
    expect(wall.view).toBe('foundation');
  });
  const beams = fdnWalls.filter(wall => h.touchesPoint(wall, 20, -4) || h.touchesPoint(wall, 20, 4));
  expect(beams).toHaveLength(3);

  // The 33.5" stack: 32" concrete with the 1.5" plate on top, top of plate
  // 1'-0" below the top of the house foundation wall.
  const houseWall = fdnWalls.find(wall => !beams.includes(wall));
  beams.forEach(beam => {
    expect(beam.topHeight).toBeCloseTo(houseWall.topHeight - 1 - 1.5 / 12, 3);
    expect(beam.topHeight - beam.baseHeight).toBeCloseTo(32 / 12, 3);
  });

  // The beam ties into the house foundation with REBAR TIE notes at both
  // shared attachment nodes.
  const ties = saved.notes.filter(note => note.body === 'REBAR TIE');
  expect(ties).toHaveLength(2);
  ties.forEach(note => {
    expect(note.view).toBe('foundation');
    expect(h.near(note.anchor.x, 8)).toBe(true);
  });

  // Garage stud walls on MAIN FL along the open legs, dropped to the beam
  // plate so their ceiling lands flush with the main-floor ceiling.
  const mainWalls = saved.walls.filter(wall => wall.levelId === 3);
  expect(mainWalls).toHaveLength(9); // 6 house + 3 garage
  const garageStud = mainWalls.filter(wall => h.touchesPoint(wall, 20, -4) || h.touchesPoint(wall, 20, 4));
  expect(garageStud).toHaveLength(3);
  const houseStud = mainWalls.find(wall => !garageStud.includes(wall));
  garageStud.forEach(wall => {
    expect(wall.topHeight).toBeCloseTo(houseStud.topHeight, 3);
    expect(wall.baseHeight).toBeLessThan(-1);
  });

  // Flat 4" slab closed against the house — no slope, no house-side line
  // beyond the polygon closure (the straight span adds no extra points).
  const slabs = saved.floors.filter(floor => floor.levelId === 1);
  expect(slabs).toHaveLength(2); // house slab + garage slab
  const garageSlab = slabs.find(floor => floor.garage);
  expect(garageSlab).toBeTruthy();
  expect(garageSlab.structure).toBe('slab');
  expect(garageSlab.thickness * 12).toBeCloseTo(4, 5);
  expect(garageSlab.slopeInPerFt).toBe(0);
  expect(garageSlab.points).toHaveLength(4);

  // ONE roof over house + garage: no separate garage roof, and the combined
  // footprint reaches past the garage's far wall by the overhang.
  expect(saved.roofs).toHaveLength(1);
  const roof = saved.roofs[0];
  expect(roof.garage).toBeFalsy();
  expect(Math.max(...roof.points.map(point => point.x))).toBeGreaterThan(20);
});

test('a second BUILD HOUSE click never doubles the garage', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);
  await buildHouse(page);
  await h.waitForSaved(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(9);
  expect(saved.walls.filter(wall => wall.levelId === 3)).toHaveLength(9);
  expect(saved.floors.filter(floor => floor.levelId === 1)).toHaveLength(2);
  expect(saved.notes.filter(note => note.body === 'REBAR TIE')).toHaveLength(2);
  expect(saved.roofs).toHaveLength(1);
});

test('an L-shaped run builds a beam member on every open leg', async ({ page }) => {
  await h.openModel(page);
  await page.keyboard.press('t'); // set the T-square down — the closing leg runs at an angle
  await drawHouseOutline(page);
  await drawGarageRun(page, [[8, -4], [20, -4], [20, 8], [14, 8], [8, 4]]);
  await h.waitForSaved(page);
  await buildHouse(page);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster.points).toHaveLength(5);
  expect(saved.walls.filter(wall => wall.levelId === 1)).toHaveLength(10); // 6 house + 4 garage
  expect(saved.roofs).toHaveLength(1);
});

test('the shared end node moves house and garage together on a level', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);

  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, 4, 10, 5);

  const saved = await h.savedDrawing(page);
  const moved = saved.outlines.filter(outline =>
    outline.points.some(point => h.near(point.x, 10) && h.near(point.z, 5)));
  // The dragged level's house AND garage copies both follow the one node.
  expect(moved).toHaveLength(2);
  expect(moved.some(outline => outline.garage)).toBe(true);
  expect(moved.some(outline => !outline.garage)).toBe(true);
});

test('the weld survives a save and reload', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await h.waitForModelReady(page);

  // The restored metadata is intact...
  let saved = await h.savedDrawing(page);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  expect(garageMaster.open).toBe(true);
  expect(garageMaster.points[0].attach).toBeTruthy();

  // ...and the copies re-welded: one drag still moves house + garage together.
  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, 4, 10, 5);
  saved = await h.savedDrawing(page);
  const moved = saved.outlines.filter(outline =>
    outline.points.some(point => h.near(point.x, 10) && h.near(point.z, 5)));
  expect(moved).toHaveLength(2);
  expect(moved.some(outline => outline.garage)).toBe(true);
});

test('editing the house master carries the attached garage along', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);

  // Drag the house master's attach point on the BONEYARD: the garage master's
  // welded end follows, and every level copy of both moves with it.
  await page.locator('.level-name', { hasText: 'BONEYARD' }).click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Select');
  await dragWorld(page, 8, -4, 10, -3);

  const saved = await h.savedDrawing(page);
  const garageMaster = saved.boneyardOutlines.find(outline => outline.garage);
  const houseMaster = saved.boneyardOutlines.find(outline => !outline.garage);
  const movedHouse = houseMaster.points.some(point => h.near(point.x, 10) && h.near(point.z, -3));
  const movedGarage = garageMaster.points.some(point => h.near(point.x, 10) && h.near(point.z, -3));
  expect(movedHouse || movedGarage).toBe(true);
  if (movedHouse) expect(movedGarage).toBe(true);
});
