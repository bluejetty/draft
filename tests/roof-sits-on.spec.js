// A ROOF DROPPED ONTO THE STOREY BELOW (Movie, 27 Oct).
//
// "i'm going to try to cut the roof how it is now and drop it down to match
// the one beside it (on the hologram) so it will be a gable" -- and "we
// shouldn't drop it automatically but allow the user to drop it somehow, in
// the properties menu maybe? ... i think we already set it up for the lower
// roofs to show on the ROOF PLAN but maybe shaded lighter?". BREAK ROOF cuts
// it with a gable on both pieces; SITS ON drops a piece.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center' });
const box = (pre, levelId) => [W(`${pre}1`, [0, 0], [30, 0], levelId), W(`${pre}2`, [30, 0], [30, 20], levelId),
  W(`${pre}3`, [30, 20], [0, 20], levelId), W(`${pre}4`, [0, 20], [0, 0], levelId)];
const EAVE = [[-2, -2], [32, -2], [32, 22], [-2, 22]];
const drawing = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 1,
  walls: [...box('m', 3), ...box('u', 5)], lines: [], floors: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  roofs: [{ id: 'roof-1', levelId: 7, sourceLevelId: 5, follows: 'none', pitch: 6, overhang: 2,
    points: EAVE.map(([x, z]) => ({ x, y: 0, z })), edges: EAVE.map(() => 'eave'),
    edgeOverhang: EAVE.map(() => 2) }],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const sits = page => page.locator('[data-prop-row="sits on"]');
const roofNow = page => page.evaluate(() => {
  const r = drawing.roofs.find(x => x.id === 'roof-1');
  return { drawnOn: r.drawnOn ?? null, sourceLevelId: r.sourceLevelId ?? null };
});
// Where the roof bears, as the elevations and sections draw it.
const bears = page => page.evaluate(() => {
  const CV = window.DraftCutView;
  const env = cutEnv();
  const stack = CV.sectionLevelStack(env);
  const r = drawing.roofs.find(x => x.id === 'roof-1');
  return Math.round(CV.roofBaseElev(r, stack, env) * 100) / 100;
});

test('SITS ON drops a roof to the storey below: it bears on MAIN FL\'s walls, shows on 2ND FL, and is lighter on the ROOF plan', async ({ page }) => {
  const { at } = await open(page);
  await page.mouse.click(...at(15, 10));
  await expect(sits(page).locator('[data-prop-value="top"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#plan')).toHaveAttribute('data-lower-roofs', '0');
  const high = await bears(page);
  await sits(page).locator('[data-prop-value="3"]').click();
  expect(await roofNow(page)).toEqual({ drawnOn: 5, sourceLevelId: 3 });
  await expect(sits(page).locator('[data-prop-value="3"]')).toHaveAttribute('aria-pressed', 'true');
  const low = await bears(page);
  expect(low, 'a storey lower than it was').toBeLessThan(high - 6);
  await expect(page.locator('#plan')).toHaveAttribute('data-lower-roofs', '1');
  // ON THE 2ND FL PLAN too, where the drafter works the walls round it.
  expect(await page.evaluate(() => { goToLevel(5); return roofs().map(r => r.id); })).toEqual(['roof-1']);
  // And back up, and one UNDO from there puts it down again.
  await page.evaluate(() => goToLevel(7));
  await page.mouse.click(...at(15, 10));
  await sits(page).locator('[data-prop-value="top"]').click();
  expect(await roofNow(page)).toEqual({ drawnOn: null, sourceLevelId: 5 });
  expect(await bears(page)).toBeCloseTo(high, 2);
  await page.keyboard.press('Control+z');
  expect(await roofNow(page)).toEqual({ drawnOn: 5, sourceLevelId: 3 });
});

test('a one-storey house offers no SITS ON: there is nothing to drop to', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  const f = drawing();
  f.walls = f.walls.filter(w => w.levelId === 3);
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=7&left=1&lpane=drafting');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(15, 10));
  await expect(page.locator('[data-roof-edge-label]')).toBeVisible();
  await expect(sits(page)).toHaveCount(0);
});
