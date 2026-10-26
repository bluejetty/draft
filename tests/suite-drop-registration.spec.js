// A SUITE DROPS ONTO THE REGISTRATION POSITION.
//
// Movie, 22 Oct: "once they drop it onto a plan it will drop into the
// registration position and the user can move it to the correct location
// they want it in". The suite file's gold target (the front-left outside
// corner of its walls, where its shelf's target sat) lands on the plan's
// gold target (the front-left outside corner of the foundation), and the
// suite is still in hand so the drag starts from there.
//
// READ OFF THE SAVED DRAWING: the hologram's x and z are the placement.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const FDN = 1, MAIN_FL = 3;
const CONC_HALF = 4 / 12;      // concrete_8, drawn on its centre line
const STUD_HALF = 5.5 / 24;    // stud_2x6

const wall = (id, levelId, view, wallType, x0, z0, x1, z1) => ({
  id, levelId, view, wallType, refLine: 'center', baseHeight: 0, topHeight: 8,
  start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
});
const box = (prefix, levelId, view, wallType, x0, z0, x1, z1) => [
  wall(`${prefix}-n`, levelId, view, wallType, x0, z0, x1, z0),
  wall(`${prefix}-e`, levelId, view, wallType, x1, z0, x1, z1),
  wall(`${prefix}-s`, levelId, view, wallType, x1, z1, x0, z1),
  wall(`${prefix}-w`, levelId, view, wallType, x0, z1, x0, z0),
];
const LEVELS = [
  { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
  { id: FDN, name: 'FOUNDATION', elev: -10 },
];
const HOUSE = { format: 'draft-drawing', version: 1, board: 'drafting', levels: LEVELS,
  walls: box('f', FDN, 'foundation', 'concrete_8', -10, -8, 10, 8) };
// The suite drawn well away from the house, as a shelf would have it.
const SUITE = { format: 'draft-drawing', version: 1, suiteKind: 'residential',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  walls: box('s', MAIN_FL, 'plan', 'stud_2x6', 100, 40, 120, 54) };
const PLAN_TARGET = { x: -10 - CONC_HALF, z: 8 + CONC_HALF };
const SUITE_TARGET = { x: 100 - STUD_HALF, z: 54 + STUD_HALF };

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft.trace.on'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: HOUSE });
  await page.goto(`/MODEL.html?level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('front-left of foundation', { timeout: 10000 });
}
async function bringIn(page, file, name) {
  await page.locator('[data-mode-hologram]').click();
  await page.locator('[data-hologram-ask-upload]').click();
  await page.locator('[data-hologram-file]').setInputFiles(
    { name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
}
async function saved(page) {
  if (await page.locator('#trace-ask').isVisible()) await page.locator('[data-trace-later]').click();
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test('a suite drops with its gold target on the plan\'s, and Esc leaves it there', async ({ page }) => {
  await open(page);
  await bringIn(page, SUITE, '1BDEN.draft');
  await expect(page.locator('#strip-message')).toContainText('on the gold target');
  await page.keyboard.press('Escape');
  const holo = (await saved(page)).holograms[0];
  expect(holo.x).toBeCloseTo(PLAN_TARGET.x - SUITE_TARGET.x, 3);
  expect(holo.z).toBeCloseTo(PLAN_TARGET.z - SUITE_TARGET.z, 3);
});

test('it arrives in hand: a drag moves it on from the registration position', async ({ page }) => {
  await open(page);
  await bringIn(page, SUITE, '1BDEN.draft');
  const box = await page.locator('#plan').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  const holo = (await saved(page)).holograms[0];
  // Moved right of the registration position, not from where its file had it.
  expect(holo.x).toBeGreaterThan(PLAN_TARGET.x - SUITE_TARGET.x + 1);
  expect(holo.x).toBeLessThan(0);
});

test('a drawing that is not a suite stays where its own file has it', async ({ page }) => {
  await open(page);
  const { suiteKind, ...phase } = SUITE;
  await bringIn(page, phase, 'PHASE 1.draft');
  await expect(page.locator('#strip-message')).not.toContainText('on the gold target');
  await page.keyboard.press('Escape');
  const holo = (await saved(page)).holograms[0];
  expect(holo.x).toBe(0);
  expect(holo.z).toBe(0);
});
