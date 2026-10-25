// MOVE A CABINET ALONG ITS WALL, AND ITS SIDE TO A NEIGHBOUR'S (Movie, 24
// Oct): "i can't MOVE the cabinets sideways. and can you make the edges (not
// the 1/2" extra but the main edge of the cabinet) to snap to the SIDE of the
// other CABINET when its within 1 inch".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const FX = (id, kind, offset, width) => ({ id, wallId: 'a', levelId: 3, view: 'plan', kind, offset, width, depth: 2, side: 1 });
// A 4' cabinet from 1' to 5', a 4' sink base from 7' to 11'.
const drawing = (more = {}) => ({
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [W('a', [0, 0], [16, 0])],
  fixtures: [FX('c', 'cabinet', 3, 4), FX('s', 'sinkbase', 9, 4)],
  fenestrations: [], lines: [], floors: [], roofs: [], dimensions: [], outlines: [], shapes: [], groups: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
  ...more,
});

async function open(page, d = drawing()) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), d);
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(250);
  // Across the wall, the depth of the room side the pieces stand on.
  const z = await page.evaluate(d => window.DraftFixtureGeometry.fixtureGeometry(d.walls, d.fixtures[1]).center.z, drawing());
  return { ...(await h.planFrame(page)), z };
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const offsetOf = async (page, id) => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).fixtures.find(f => f.id === id).offset;
};
async function drag(page, from, to) {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(from[0] + 4, from[1], { steps: 2 });
  await page.mouse.move(...to, { steps: 8 });
  await page.mouse.up();
}
async function pickAndMove(page, at, z) {
  await page.keyboard.press('s');
  await page.mouse.click(...at(9, z));
  await page.keyboard.press('m');
  await expect(page.locator('#strip-message')).toContainText('MOVE: drag anywhere');
}

test('MOVE slides a picked sink base along its wall, and one UNDO puts it back', async ({ page }) => {
  const { at, z } = await open(page);
  await pickAndMove(page, at, z);
  // Pressed off the piece: MOVE goes by the travel, wherever it starts.
  await drag(page, at(12, z + 3), at(14, z + 3.4));
  await expect(page.locator('#strip-message')).toContainText('slid along its wall');
  expect(await offsetOf(page, 's')).toBeCloseTo(11, 1);
  await page.keyboard.press('Control+z');
  expect(await offsetOf(page, 's')).toBeCloseTo(9, 6);
});

test('its side goes to the cabinet\'s within an inch, and stays where it is let go past that', async ({ page }) => {
  const { at, z } = await open(page);
  await pickAndMove(page, at, z);
  // 7.05: two-thirds of an inch off the cabinet's side -- caught to touch it.
  await drag(page, at(9, z), at(9 - 1.95, z));
  expect(await offsetOf(page, 's'), 'its left side on the cabinet\'s right').toBeCloseTo(7, 6);
  await page.keyboard.press('m');
  await page.keyboard.press('m');
  // 3" further: no catch.
  await drag(page, at(9, z), at(9 + 0.25, z));
  expect(await offsetOf(page, 's'), 'left where let go').toBeCloseTo(7.25, 1);
  expect(Math.abs(await offsetOf(page, 's') - 7.25)).toBeLessThan(0.05);
});

test('the SELECT drag catches the same side', async ({ page }) => {
  const { at, z } = await open(page);
  await page.keyboard.press('s');
  await page.mouse.click(...at(9, z));
  await drag(page, at(9, z), at(9 - 2.05, z));
  expect(await offsetOf(page, 's')).toBeCloseTo(7, 6);
});

// "ONE at a time unless the user connects 2 with Y ASSEMBLY (2 or mor)"
// (Movie, 25 Oct): joined, the cabinet and the sink base go along the wall
// together, their gap kept; apart, MOVE takes only the one picked.
test('two pieces joined with Y slide together under MOVE, their gap kept; one UNDO puts both back', async ({ page }) => {
  const grouped = drawing({ groups: [{ id: 1, name: 'RUN', members: [{ type: 'fixture', id: 'c' }, { type: 'fixture', id: 's' }] }], nextGroupId: 2 });
  const { at, z } = await open(page, grouped);
  await page.keyboard.press('s');
  await page.mouse.click(...at(9, z));
  await page.keyboard.press('m');
  await drag(page, at(12, z + 3), at(14, z + 3.4));
  await expect(page.locator('#strip-message')).toContainText('2 pieces slid along their wall together');
  expect(await offsetOf(page, 'c')).toBeCloseTo(5, 1);
  expect(await offsetOf(page, 's')).toBeCloseTo(11, 1);
  expect((await offsetOf(page, 's')) - (await offsetOf(page, 'c')), 'the gap kept').toBeCloseTo(6, 6);
  await page.keyboard.press('Control+z');
  await expect(page.locator('#strip-message')).not.toContainText('version from');
  expect([await offsetOf(page, 'c'), await offsetOf(page, 's')]).toEqual([3, 9]);
});

test('a piece of a kitchen preset\'s assembly, walls and all, still moves on its own', async ({ page }) => {
  const preset = drawing({ groups: [{ id: 1, name: 'KITCHEN', members: [{ type: 'wall', id: 'a' }, { type: 'fixture', id: 'c' }, { type: 'fixture', id: 's' }] }], nextGroupId: 2 });
  const { at, z } = await open(page, preset);
  await page.keyboard.press('s');
  await page.mouse.click(...at(9, z));
  await page.keyboard.press('m');
  await drag(page, at(12, z + 3), at(14, z + 3.4));
  expect(await offsetOf(page, 'c'), 'the cabinet stays').toBe(3);
  expect(await offsetOf(page, 's')).toBeCloseTo(11, 1);
});
