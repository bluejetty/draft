// PULLED OFF ITS WALL (jb, 27 Nov 2026): "can we make it so the cabinets
// stick to the wall but a user can pull it away from the wall with an
// EXAGGERATED pull away it will become unstuck and the user can position on
// the floor or choose a new wall to 'stick too'". A drag that wanders a foot
// or so off the wall still slides the piece along it; past 3 ft square off
// the wall the piece lets go, and is let go free on the floor or against
// another wall, which takes it. One UNDO puts it back on its wall.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const FX = (id, kind, offset, width) => ({ id, wallId: 'a', levelId: 3, view: 'plan', kind, offset, width, depth: 2, side: 1 });
// A 4' sink base from 7' to 11' on wall a; wall b runs 12' across the room
// from it, on the side the sink faces (set once the side is known).
const drawing = (bz) => ({
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [W('a', [0, 0], [16, 0]), W('b', [0, bz], [16, bz])],
  fixtures: [FX('s', 'sinkbase', 9, 4)],
  fenestrations: [], lines: [], floors: [], roofs: [], dimensions: [], outlines: [], shapes: [], groups: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
});

async function open(page) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  // Which side of wall a the sink stands on: wall b goes 12' that way.
  const z = await page.evaluate(d => window.DraftFixtureGeometry.fixtureGeometry(d.walls, d.fixtures[0]).center.z, drawing(12));
  const sign = z > 0 ? 1 : -1;
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), drawing(12 * sign));
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(250);
  return { ...(await h.planFrame(page)), z, sign };
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const sinkOf = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).fixtures.find(f => f.id === 's');
};
async function selectDrag(page, from, to) {
  await page.keyboard.press('s');
  await page.mouse.click(...from);
  await page.waitForTimeout(100);
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.move(from[0] + 4, from[1], { steps: 2 });
  await page.mouse.move(...to, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test('a drag that wanders off the wall still slides the sink along it', async ({ page }) => {
  const { at, z, sign } = await open(page);
  await selectDrag(page, at(9, z), at(10, z + 1.5 * sign));
  await expect(page.locator('#strip-message')).toContainText('slid along its wall');
  const s = await sinkOf(page);
  expect(s.wallId).toBe('a');
  expect(s.host).toBeUndefined();
  expect(s.offset).toBeCloseTo(10, 1);
});

test('an exaggerated pull lets it go free on the floor, and one UNDO puts it back on its wall', async ({ page }) => {
  const { at, z, sign } = await open(page);
  await selectDrag(page, at(9, z), at(9, z + 5 * sign));
  await expect(page.locator('#strip-message')).toContainText('on no wall');
  const s = await sinkOf(page);
  expect(s.wallId).toBeNull();
  expect(s.host).toBeTruthy();
  const c = await page.evaluate(f => window.DraftFixtureGeometry.fixtureGeometry([], f).center, s);
  expect(c.x).toBeCloseTo(9, 1);
  expect(c.z).toBeCloseTo(z + 5 * sign, 1);
  await page.keyboard.press('Control+z');
  const back = await sinkOf(page);
  expect(back.wallId).toBe('a');
  expect(back.host).toBeUndefined();
  expect(back.offset).toBeCloseTo(9, 6);
});

test('pulled across the room against another wall, it sticks to that wall', async ({ page }) => {
  const { at, z, sign } = await open(page);
  // To 1.5' short of wall b's centre line: its back lands on b's face.
  await selectDrag(page, at(9, z), at(6, 12 * sign - 1.4 * sign));
  await expect(page.locator('#strip-message')).toContainText('is on that wall now');
  const s = await sinkOf(page);
  expect(s.wallId).toBe('b');
  expect(s.host).toBeUndefined();
  expect(s.offset).toBeCloseTo(6, 0);
});
