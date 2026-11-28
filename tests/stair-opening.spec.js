// A STAIR'S FLOOR OPENING IS MEASURED, not drawn: its width is the stair's
// width plus a 1" total drywall finish allowance, and it runs down the flight
// until the headroom (6'-10" default) clears under the floor assembly,
// rounded up to the next whole inch, starting just behind the top nosing.
//
// Moved from the old page (MODEL.dc.html) to MODEL.html, 28 Nov 2026. The old
// page cut the hole from FENESTRATION's STAIRS choice; on MODEL.html the STAIR
// tool places the flight and cuts its well in the same press
// (stairOpeningFootprint), so the rule is checked there.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MAIN_FL = 3, SECOND_FL = 5;
const LOOP = [{ x: -20, y: 0, z: -16 }, { x: 20, y: 0, z: -16 },
  { x: 20, y: 0, z: 16 }, { x: -20, y: 0, z: 16 }];
const floorOn = (id, levelId) => ({ id, levelId, view: 'plan', structure: 'floor', garage: false,
  slopeInPerFt: 0, thickness: 0.9583333333333334, thickenedEdge: false, points: LOOP });
const house = () => ({
  version: 1,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: SECOND_FL, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [{ id: 'o-main', levelId: MAIN_FL, garage: false, points: LOOP },
    { id: 'o-2nd', levelId: SECOND_FL, garage: false, points: LOOP }],
  floors: [floorOn('f-main', MAIN_FL), floorOn('f-2nd', SECOND_FL)],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
});

// Defaults: 11 7/8" joists + 3/4" sheathing, 6'-10" headroom, 10" treads.
const FLOOR_IN = 11.875 + 0.75;
const HEADROOM_IN = 82;
const TREAD_IN = 10;
const NOSING_IN = 2;       // the header sits this far behind the top nosing
const HALF_FINISH_IN = 0.5;

async function placeStair(page, widthIn) {
  await h.openEditor(page, { drawing: house(), url: '/MODEL.html?left=1&lpane=build&right=1', webgl: false });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  await page.locator('[data-tool-key="stair"]').click();
  await expect(page.locator('[data-stair-pick]')).toBeVisible();
  if (widthIn) {
    const box = page.locator('[data-stair-width]').first();
    await box.fill(String(widthIn));
    await box.press('Enter');
    await page.waitForTimeout(100);
  }
  // The top step at z = -8, running south.
  for (const [x, z] of [[0, -8], [0, 4]]) {
    await page.mouse.move(...at(x, z));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(x, z));
    await page.waitForTimeout(100);
  }
  await expect(page.locator('#strip-message')).toContainText('STAIR placed');
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  const drawing = await h.savedDrawing(page);
  const stair = drawing.stairs.find(s => s.levelId === MAIN_FL);
  const well = drawing.surfaceOpenings.find(o => o.stairId === stair.id);
  return { drawing, stair, well };
}

const span = pts => ({
  x: Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x)),
  z0: Math.min(...pts.map(p => p.z)), z1: Math.max(...pts.map(p => p.z)),
});

test('a stair opening cuts the measured rectangle: width + 1", length to headroom, to the inch', async ({ page }) => {
  const { stair, well } = await placeStair(page);
  expect(well, 'the stair cut its well').toBeTruthy();
  expect(well.hostType).toBe('floor');
  expect(well.hostId).toBe('f-main');
  expect(well.points).toHaveLength(4);

  const s = span(well.points);
  // Width: 3' stair + 1" finish.
  expect(s.x * 12).toBeCloseTo(36 + 1, 3);
  // Length: tread slots down the walking line until the drop clears the
  // headroom plus the floor assembly, up to the next whole inch.
  const riserIn = stair.riseFt * 12 / stair.risers;
  const runIn = Math.ceil((HEADROOM_IN + FLOOR_IN) / riserIn * TREAD_IN - 1e-4);
  expect((s.z1 - stair.start.z) * 12, 'the far end, set by headroom').toBeCloseTo(runIn + HALF_FINISH_IN, 3);
  expect((stair.start.z - s.z0) * 12, 'the near end, behind the nosing').toBeCloseTo(NOSING_IN + HALF_FINISH_IN, 3);
  // And shorter than the flight: the hole stops where the head clears.
  expect(s.z1).toBeLessThan(stair.end.z);
});

test('a typed stair width resizes the opening', async ({ page }) => {
  const { stair, well } = await placeStair(page, 42);
  expect(stair.widthFt * 12).toBeCloseTo(42, 3);
  expect(span(well.points).x * 12).toBeCloseTo(42 + 1, 3);
});

test('the stair opening survives a reload on its floor', async ({ page }) => {
  const { well } = await placeStair(page);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText(/SAVE/, { timeout: 6000 });
  const again = await h.savedDrawing(page);
  const kept = again.surfaceOpenings.find(o => o.id === well.id);
  expect(kept, 'the well came back').toBeTruthy();
  expect(kept.levelId).toBe(MAIN_FL);
  expect(kept.hostId).toBe('f-main');
  expect(kept.points).toEqual(well.points);
});
