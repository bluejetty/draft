// The auto-beam corner rule (board #244): a jog (re-entrant corner) whose
// node sits inside the beam's clear strip pulls the mid-span auto beam onto
// the corner node exactly, a beam dead-ending there gets its own telepost,
// and both are linked to the BONEYARD master point (srcId) so outline edits
// carry the beam along. The geometry itself is pinned by the offline harness
// against build-house.js; these specs pin the commit layer — the tour
// reveal, the stair re-derive, the master-drag ripple, and the reload path.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// An L-plan, 30 x 24 overall with a 12 x 14 bite out of the east side: the
// jog corner lands at (3, -2), 2' off the unsnapped mid-line z=0. The beam
// snaps to z=-2, runs from the west wall to the corner (the shallow east
// wing spans 10' on its own), and splits once at x=-6.
async function traceLHouse(page) {
  await page.locator('[data-select-house]').click();
  await page.keyboard.press('Enter'); // past PROFESSOR GRUFF
  await h.clickWorld(page, -15, -12);
  await h.clickWorld(page, 15, -12);
  await h.clickWorld(page, 15, -2);
  await h.clickWorld(page, 3, -2);
  await h.clickWorld(page, 3, 12);
  await h.clickWorld(page, -15, 12);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function switchLevel(page, name) {
  await page.locator('.level-name', { hasText: name }).click();
  await page.waitForTimeout(300);
}

async function dragWorld(page, fromX, fromZ, toX, toZ) {
  await h.selectTool(page, 'Select');
  const from = await h.worldToClient(page, fromX, fromZ);
  const to = await h.worldToClient(page, toX, toZ);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await h.waitForSaved(page);
}

// Real-mouse drags carry integer-pixel rounding (~0.07' at default zoom);
// snapped and linked positions stay exact.
const closeish = (received, expected) => expect(Math.abs(received - expected)).toBeLessThan(0.2);

const autoBeams = saved => saved.beams.filter(beam => beam.auto);
const autoColumns = saved => saved.columns.filter(column => column.auto);
const jogMasterPoint = saved => saved.boneyardOutlines[0].points
  .reduce((best, point) => {
    const d = Math.hypot(point.x - 3, point.z + 2);
    return !best || d < best.d ? { point, d } : best;
  }, null).point;

test('the auto beam snaps onto the jog corner, dead-ends there, and links to the master point', async ({ page }) => {
  await h.openModel(page);
  await traceLHouse(page);

  await expect(page.locator('[data-tour-popup]')).toBeVisible();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  // Snapped: every beam segment rides z=-2 (the corner), not the mid-line 0.
  const beams = autoBeams(saved);
  expect(beams).toHaveLength(2);
  beams.forEach(beam => {
    expect(beam.start.z).toBeCloseTo(-2, 5);
    expect(beam.end.z).toBeCloseTo(-2, 5);
  });
  // Trimmed: the shallow east wing spans 10' on its own — the beam
  // dead-ends at the corner, west wall to x=3.
  const xs = beams.flatMap(beam => [beam.start.x, beam.end.x]);
  expect(Math.min(...xs)).toBeCloseTo(-15, 5);
  expect(Math.max(...xs)).toBeCloseTo(3, 5);

  // The corner end and its extra telepost are LINKED to the jog master point.
  const master = jogMasterPoint(saved);
  expect(master.x).toBeCloseTo(3, 5);
  expect(master.z).toBeCloseTo(-2, 5);
  const cornerEnd = beams.flatMap(beam => [beam.start, beam.end])
    .find(point => point.srcId);
  expect(cornerEnd).toBeTruthy();
  expect(cornerEnd.srcId).toBe(master.id);
  expect(cornerEnd.x).toBeCloseTo(3, 5);

  const columns = autoColumns(saved);
  expect(columns).toHaveLength(2); // the split at x=-6 plus the corner
  const cornerCol = columns.find(column => column.point.srcId);
  expect(cornerCol).toBeTruthy();
  expect(cornerCol.point.srcId).toBe(master.id);
  expect(cornerCol.point.x).toBeCloseTo(3, 5);
  expect(cornerCol.point.z).toBeCloseTo(-2, 5);
  expect(columns.find(column => !column.point.srcId).point.x).toBeCloseTo(-6, 5);
});

test('dragging the master jog corner carries the beam end and its telepost along', async ({ page }) => {
  await h.openModel(page);
  await traceLHouse(page);
  await page.locator('[data-tour-popup]').click(); // FOUNDATION DONE → MAIN
  await h.waitForSaved(page);

  await switchLevel(page, 'BONEYARD');
  await dragWorld(page, 3, -2, 6, -1);

  const saved = await h.savedDrawing(page);
  const master = jogMasterPoint(saved);
  closeish(master.x, 6);
  closeish(master.z, -1);
  // The linked beam end and corner telepost sit EXACTLY on the moved master
  // point; the unlinked split column stayed where it was placed.
  const cornerEnd = autoBeams(saved).flatMap(beam => [beam.start, beam.end])
    .find(point => point.srcId);
  expect(cornerEnd.x).toBeCloseTo(master.x, 5);
  expect(cornerEnd.z).toBeCloseTo(master.z, 5);
  const cornerCol = autoColumns(saved).find(column => column.point.srcId);
  expect(cornerCol.point.x).toBeCloseTo(master.x, 5);
  expect(cornerCol.point.z).toBeCloseTo(master.z, 5);
  expect(autoColumns(saved).find(column => !column.point.srcId).point.x).toBeCloseTo(-6, 5);
});

test('the corner link survives a reload — the revived beam still rides the master', async ({ page }) => {
  await h.openModel(page);
  await traceLHouse(page);
  await page.locator('[data-tour-popup]').click();
  await h.waitForSaved(page);

  await page.reload();
  await h.waitForModelReady(page);

  await switchLevel(page, 'BONEYARD');
  await dragWorld(page, 3, -2, 7, -2);

  const saved = await h.savedDrawing(page);
  const master = jogMasterPoint(saved);
  closeish(master.x, 7);
  const cornerEnd = autoBeams(saved).flatMap(beam => [beam.start, beam.end])
    .find(point => point.srcId);
  expect(cornerEnd).toBeTruthy();
  expect(cornerEnd.x).toBeCloseTo(master.x, 5);
  const cornerCol = autoColumns(saved).find(column => column.point.srcId);
  expect(cornerCol.point.x).toBeCloseTo(master.x, 5);
});

test('the stair re-derive keeps the corner snap and re-links through the second commit site', async ({ page }) => {
  await h.openModel(page);
  await traceLHouse(page);
  await page.locator('[data-tour-popup]').click(); // → MAIN
  await h.waitForSaved(page);

  // A stair well north of the corner: hole strip z 4..10, so the larger
  // clear strip becomes [-12, 4] (mid -4) — the corner at z=-2 is still
  // inside it and still wins the snap after the re-derive replaces the
  // whole auto set through _rederiveTourBeam.
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, -10, 4);
  await h.clickWorld(page, -10, 10);
  await h.waitForSaved(page);

  const saved = await h.savedDrawing(page);
  const beams = autoBeams(saved);
  expect(beams.length).toBeGreaterThan(0);
  beams.forEach(beam => {
    expect(beam.start.z).toBeCloseTo(-2, 5);
    expect(beam.end.z).toBeCloseTo(-2, 5);
  });
  const master = jogMasterPoint(saved);
  const cornerEnd = beams.flatMap(beam => [beam.start, beam.end])
    .find(point => point.srcId);
  expect(cornerEnd).toBeTruthy();
  expect(cornerEnd.srcId).toBe(master.id);
  const cornerCol = autoColumns(saved).find(column => column.point.srcId);
  expect(cornerCol).toBeTruthy();
  expect(cornerCol.point.srcId).toBe(master.id);
});
