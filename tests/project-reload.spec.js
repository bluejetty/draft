// THE BONE RELOADS A STANDING HOUSE (Movie, 20 Oct): "i forgot to enter the
// PROJECT info first. i would like to tranform the existing outline wall and
// roof to the new contstuction type and heights. can we do it ?" ... "to
// reload press the bone in project area once you pick your numbers and kinds
// of stuff youd like" ... "but certain things need to be locked - BUNGALOW /
// number of stories etc" ... "heights and attachement methods should all be
// able to change easily i hope, but the changing storeys of building type
// would be too hard cause problems".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const LOOP = [{ x: 0, z: 0 }, { x: 40, z: 0 }, { x: 40, z: 28 }, { x: 0, z: 28 }];
const wall = (id, a, b, { levelId = 3, view = 'plan', top = 8, type = 'stud_2x6' } = {}) => ({
  id, levelId, view, start: { x: a.x, z: a.z }, end: { x: b.x, z: b.z },
  baseHeight: 0, topHeight: top, wallType: type, refLine: 'left',
});
const ring = (prefix, opts) => LOOP.map((a, i) => wall(`${prefix}${i + 1}`, a, LOOP[(i + 1) % 4], opts));

// A BUNGALOW DRAWN BEFORE THE PROJECT PAGE WAS FILLED IN: the WALL tool's
// 8'-0" 2x6 shell on a traced outline, an interior wall, 8" concrete under
// it, the roof cut at the tool's 4/12 and 2' -- and a 6/12 typed on the
// PROJECT page since, which no save-time follow ever applied to a roof
// that was not standing at the old number.
const drawn = ({ top = 8, fdnTop = 8, pitch = 4, roofPitch = 6 } = {}) => ({
  version: 1, board: 'drafting', planTurn: 0, buildType: 'bungalow', garagePlan: 'none',
  roofPitch,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [
    ...ring('w', { top }),
    wall('mid', { x: 20, z: 0 }, { x: 20, z: 28 }, { top }),
    ...ring('f', { levelId: 1, view: 'foundation', type: 'concrete_8', top: fdnTop }),
  ],
  outlines: [{ id: 'h', levelId: 3, garage: false, points: LOOP.map(p => ({ x: p.x, y: 0, z: p.z })) }],
  roofs: [{ id: 'r1', levelId: 7, follows: 'house', pitch, overhang: 2, edgeOverhang: [2, 2, 2, 2],
    edges: ['eave', 'eave', 'eave', 'eave'],
    points: [{ x: -2, y: 0, z: -2 }, { x: 42, y: 0, z: -2 }, { x: 42, y: 0, z: 30 }, { x: -2, y: 0, z: 30 }] }],
  lines: [], floors: [], fenestrations: [], dimensions: [], shapes: [], surfaceOpenings: [],
  stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function openProject(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/PROJECT.html');
  await expect(page.locator('.type-card[data-type="bungalow"]')).toHaveClass(/\bhome\b/);
}

const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

const typeIn = async (page, key, value) => {
  const box = page.locator(`[data-detail-input="${key}"]`);
  await box.fill(value);
  await box.press('Enter');
};
const r3 = n => Math.round(n * 1000) / 1000;

test('the BONE on a standing house reloads it to the PROJECT numbers', async ({ page }) => {
  await openProject(page, drawn());
  // The page says ICF at 9' on MAIN FL, ICF under it, a 6/12 roof -- and the
  // drawn walls stand at the tool's 8' 2x6 and the roof at 4/12, which no
  // save follows.
  await page.locator('[data-detail-input="wallType-3"]').selectOption('icf');
  await typeIn(page, 'wallHeight-3', `9'-0"`);
  await page.locator('[data-detail-input="fdnWallType"]').selectOption('icf');
  await expect(page.locator('[data-detail-input="pitch"]')).toHaveValue('6');
  await expect.poll(async () => (await stored(page)).levelAssemblies?.[1]?.wallType).toBe('icf');
  let d = await stored(page);
  expect(d.walls.find(w => w.id === 'w1').topHeight).toBe(8);
  expect(d.roofs.find(r => r.id === 'r1').pitch).toBe(4);

  await page.locator('#bone').click();
  await expect(page.locator('#project-reload-ask')).toBeVisible();
  await expect(page.locator('#project-build-ask')).toBeHidden();
  await page.locator('[data-reload-ask="go"]').click();
  await page.waitForURL(/MODEL\.html/);

  d = await stored(page);
  const says = id => { const w = d.walls.find(x => x.id === id); return `${w.wallType}@${r3(w.topHeight)}`; };
  // THE SHELL takes the type and the height; the interior wall rises and
  // keeps its framing; the foundation pours the chosen ICF at its own top.
  ['w1', 'w2', 'w3', 'w4'].forEach(id => expect(says(id)).toBe('icf@9'));
  expect(says('mid')).toBe('stud_2x6@9');
  ['f1', 'f2', 'f3', 'f4'].forEach(id => expect(says(id)).toBe('icf@8.125'));
  expect(d.roofs.find(r => r.id === 'r1').pitch).toBe(6);
  // The type of house is what it was.
  expect(d.buildType).toBe('bungalow');
});

test('while the house stands its type is locked, and the BONE says it reloads', async ({ page }) => {
  await openProject(page, drawn());
  await expect(page.locator('#family-row')).toHaveJSProperty('inert', true);
  await expect(page.locator('#stage-bungalow [data-view-only]')).toContainText(/locked/i);
  await expect(page.locator('#stage-bungalow .card-body')).toHaveJSProperty('inert', false);
  await expect(page.locator('#bone')).toHaveAttribute('title', /reload/i);
  // The numbers stay live.
  await expect(page.locator('[data-detail-input="wallHeight-3"]')).toBeEnabled();

  // AN OUTLINE ALONE IS A PLAN NOT YET RAISED: the row stays open and the
  // BONE still builds.
  const traced = drawn();
  traced.walls = [];
  await openProject(page, traced);
  await expect(page.locator('#family-row')).toHaveJSProperty('inert', false);
  await expect(page.locator('#bone')).not.toHaveAttribute('title', /reload/i);
});

test('CANCEL reloads nothing, and a house already at its numbers says so and stays', async ({ page }) => {
  await openProject(page, drawn());
  await page.locator('#bone').click();
  await expect(page.locator('#project-reload-ask')).toBeVisible();
  await page.locator('[data-reload-ask="cancel"]').click();
  await expect(page.locator('#project-reload-ask')).toBeHidden();
  await expect(page).toHaveURL(/PROJECT\.html/);
  let d = await stored(page);
  expect(d.walls.find(w => w.id === 'w1').topHeight).toBe(8);

  // At the office numbers already: 8'-1 1/8" on MAIN FL, 8'-1 1/2" under
  // it, the roof at the 4/12 the page holds.
  await openProject(page, drawn({ top: 8 + 1.125 / 12, fdnTop: 8.125, roofPitch: 4 }));
  await page.locator('#bone').click();
  await page.locator('[data-reload-ask="go"]').click();
  await expect(page.locator('#status')).toContainText(/nothing to reload/i);
  await expect(page).toHaveURL(/PROJECT\.html/);
  d = await stored(page);
  expect(d.walls.find(w => w.id === 'w1').wallType).toBe('stud_2x6');
});
