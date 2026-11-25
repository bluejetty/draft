// A BEAM SLID ACROSS ITSELF CATCHES THE STAIR OPENING'S CORNER (jb, 25 Nov
// 2026): "i'd like to position it using the corner of the int staircase
// opening and then add 2 inches push it over so it will have 4" floor
// bearing ... just need the node snap". On the FLOOR LAYOUT the row MOVEs
// across itself and its line catches a node -- the stair's corners drawn
// from the walls plan behind, or a stair hole's -- and a second MOVE with a
// typed 2" pushes it off that corner exactly.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const MAIN_FL = 3;
const P = (x, z) => ({ x, y: 0, z });
const RECT = [[-20, -16], [20, -16], [20, 16], [-20, 16]];
const base = (extra = {}) => ({
  version: 1, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 50,
  walls: [], roofs: [], fenestrations: [], dimensions: [], floors: [], lines: [],
  outlines: [{ id: 'outline-r', levelId: MAIN_FL, garage: false, points: RECT.map(([x, z]) => P(x, z)) }],
  shapes: [], notes: [], roomTags: [], columns: [],
  beams: [{ id: 1, start: P(-20, -8), end: P(20, -8), levelId: MAIN_FL, view: 'floor', mode: 'flush' }],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [], surfaceOpenings: [],
  stairs: [
    { id: 7501, levelId: MAIN_FL, view: 'plan', layer: 'A-STR', start: { x: -2, z: -4 }, end: { x: 6, z: -4 },
      widthFt: 3, riseFt: 9, rail: 'left', shape: 'straight', winders: 0, auto: false },
  ],
  ...extra,
});

async function open(page, f, bg) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ f, bg }) => {
    localStorage.setItem('draft-bg-layers', JSON.stringify(bg));
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, { f, bg });
  await page.goto(`/MODEL.html?level=${MAIN_FL}&view=floor`);
  await page.waitForFunction(() => typeof drawing !== 'undefined' && drawing?.beams?.length === 1, null, { timeout: 10000 });
  await page.evaluate(() => { view.cx = 0; view.cz = -6; view.scale = 30; paint(); });
  await page.waitForTimeout(150);
  return h.planFrame(page);
}
async function drag(page, at, from, to) {
  await page.mouse.move(...at(...from));
  await page.mouse.down();
  await page.mouse.move(...at(...to), { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}
const beamZ = page => page.evaluate(() => drawing.beams.map(b => [b.start.z, b.end.z]));
const near = (a, b) => Math.abs(a - b) < 1e-6;

async function pickAndMove(page, at, x, z) {
  await page.keyboard.press('s');
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => selection.map(e => e.type))).toEqual(['beam']);
  if (await page.locator('#model-move').getAttribute('aria-pressed') !== 'true') await page.locator('#model-move').click();
  await expect(page.locator('#model-move')).toHaveAttribute('aria-pressed', 'true');
}

test('FLOOR LAYOUT: a sliding beam lines up on the stair\'s corner, then a typed 2" pushes it past', async ({ page }) => {
  const { at } = await open(page, base(), [`${MAIN_FL}:plan`]);
  // The stair's corner nearest the beam, as the painter draws it.
  const corner = await page.evaluate(() => {
    const st = drawing.stairs[0];
    return stairOutlineOf(st).corners.reduce((a, c) => (c.z < a.z ? c : a));
  });
  await pickAndMove(page, at, 10, -8);
  // Let go a hair (under 1") short of the corner: the line catches it.
  await page.mouse.move(...at(10, -8));
  await page.mouse.down();
  await page.mouse.move(...at(10, corner.z - 0.05), { steps: 8 });
  expect(JSON.parse(await page.locator('#plan').getAttribute('data-snap-magnet'))).toMatchObject({ kind: 'node' });
  await page.mouse.up();
  await page.waitForTimeout(100);
  let zs = await beamZ(page);
  zs.flat().forEach(z => expect(near(z, corner.z), `beam on the corner: ${z} vs ${corner.z}`).toBe(true));
  // A SECOND MOVE, a little the other way, then 2" typed: 2" off the corner.
  await drag(page, at, [10, corner.z], [10, corner.z - 0.5]);
  await expect(page.locator('#frozen-length')).toBeEnabled();
  await page.keyboard.type('2"');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  zs = await beamZ(page);
  zs.flat().forEach(z => expect(near(z, corner.z - 2 / 12), `2" past: ${z}`).toBe(true));
});

test('a stair HOLE\'s corner catches the sliding beam too; away from a node it slides free', async ({ page }) => {
  const f = base({
    stairs: [],
    floors: [{ id: 900, levelId: MAIN_FL, view: 'floor', points: RECT.map(([x, z]) => P(x, z)) }],
    surfaceOpenings: [{ id: 901, hostType: 'floor', hostId: 900, levelId: MAIN_FL,
      points: [P(-2, -5.5), P(6, -5.5), P(6, -2.5), P(-2, -2.5)] }],
  });
  const { at } = await open(page, f, []);
  await pickAndMove(page, at, 10, -8);
  await drag(page, at, [10, -8], [10, -5.55]);
  (await beamZ(page)).flat().forEach(z => expect(near(z, -5.5), `on the hole's corner: ${z}`).toBe(true));
  await page.locator('#model-undo').click();
  (await beamZ(page)).flat().forEach(z => expect(near(z, -8)).toBe(true));
  // Away from any node it goes where the hand lets go.
  await pickAndMove(page, at, 10, -8);
  await drag(page, at, [10, -8], [10, -7]);
  (await beamZ(page)).flat().forEach(z => expect(Math.abs(z + 7) < 0.05, `free at ${z}`).toBe(true));
});
