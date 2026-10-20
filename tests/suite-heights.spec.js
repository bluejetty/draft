// A SUITE'S HEIGHTS: a stand-in while it is drawn on the boneyard, and the
// floor's own floor-to-ceiling height once it is placed.
//
// Movie, 20 Oct: "the HEIGHTS won't really need to be determined until it is
// place onto a plan and it will take the floor and ceiling height and fit
// itself into that height. What do you advice we show the height on the
// 'boneyard" area as... ?" -- a stand-in, 8'-0" residential and 10'-0"
// commercial, marked in PROPERTIES as set when placed.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
  { id: 1, name: 'FOUNDATION', elev: -8 }];
const drawing = extra => ({
  version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});
const W = (id, a, b, levelId, top = 8) => ({ id, start: P(...a), end: P(...b), levelId, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: top });

async function open(page, f) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?left=1&lpane=build');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(150);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

for (const [kind, ft, said] of [['residential', 8, "8'-0\""], ['commercial', 10, "10'-0\""]]) {
  test(`a ${kind} suite's walls are drawn at ${said} on the BONEYARD, and PROPERTIES says the floor sets it`, async ({ page }) => {
    await open(page, drawing({ suiteKind: kind }));
    const { at } = await h.planFrame(page);
    await h.armFromRail(page, 'wall');
    await page.mouse.click(...at(-4, 0));
    await page.mouse.click(...at(4, 0));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const d = await saved(page);
    expect(d.walls).toHaveLength(1);
    expect(d.walls[0].levelId, 'drawn on the boneyard').toBeLessThan(0);
    expect(d.walls[0].topHeight, `the ${said} stand-in`).toBe(ft);
    await h.armFromRail(page, 'select');
    await page.mouse.click(...at(0, 0));
    await page.locator('#props-tab').click();
    await expect(page.locator('[data-suite-height-note]')).toContainText('SET WHEN PLACED');
    await expect(page.locator('[data-suite-height-note]')).toContainText(said);
  });
}

test('a wall in a house file keeps the 8\'-0" it always had, and no note', async ({ page }) => {
  await open(page, drawing());
  const { at } = await h.planFrame(page);
  await h.armFromRail(page, 'wall');
  await page.mouse.click(...at(-4, 0));
  await page.mouse.click(...at(4, 0));
  await page.keyboard.press('Escape');
  const d = await saved(page);
  expect(d.walls[0].topHeight).toBe(8);
  expect(d.walls[0].levelId).toBe(3);
});

// THE FIT, asked of the hologram's own cut painter: what it hands the cut
// builder is what every elevation and section of the suite is stacked from.
const handedToCut = (page, host) => page.evaluate(host => {
  // THE MODULE IS FROZEN, so it is swapped whole for the one call.
  const real = window.DraftCutViewEnv;
  const seen = [];
  window.DraftCutViewEnv = { ...real, buildCutViewEnv: (source, levels) => {
    seen.push({ assemblies: source.levelAssemblies ?? null, levelIds: levels.map(l => l.id) });
    return null;
  } };
  try {
    const c = document.createElement('canvas');
    c.width = 200; c.height = 100;
    window.DraftHologram.paintCut(c.getContext('2d'), 200, 100,
      { name: 'E1', kind: 'elevation' }, host, { x: 0, y: 0, w: 200, h: 100 });
  } finally { window.DraftCutViewEnv = real; }
  return seen;
}, host);

const HOST_ASSEMBLIES = { 3: { wallHeightFt: 10 } };
const SUITE_ASSEMBLIES = { 3: { wallHeightFt: 7 } };
const suiteSource = extra => drawing({ levelAssemblies: SUITE_ASSEMBLIES,
  walls: [W('s1', [0, 0], [12, 0], 3, 7)], ...extra });

test('PLACED AS A SUITE it is stacked on the house floor\'s heights, not its own file\'s', async ({ page }) => {
  await open(page, drawing());
  const host = drawing({ levelAssemblies: HOST_ASSEMBLIES,
    holograms: [{ id: 'h1', name: 'unit', x: 0, z: 0, angleDeg: 0, pivotX: 0, pivotZ: 0, mode: 'suite',
      source: suiteSource(), layer: 'HOLOGRAM' }] });
  const seen = await handedToCut(page, host);
  expect(seen.length, 'the suite went to the cut builder').toBeGreaterThan(0);
  expect(seen[0].assemblies, 'the house floor\'s 10\' walls').toEqual(HOST_ASSEMBLIES);
});

test('A SUITE FILE STILL BLUE fits the floor too; a plain hologram keeps its own heights', async ({ page }) => {
  await open(page, drawing());
  const holo = (id, source) => ({ id, name: id, x: 0, z: 0, angleDeg: 0, pivotX: 0, pivotZ: 0,
    source, layer: 'HOLOGRAM' });
  const blueSuite = await handedToCut(page, drawing({ levelAssemblies: HOST_ASSEMBLIES,
    holograms: [holo('cafe', suiteSource({ suiteKind: 'commercial' }))] }));
  expect(blueSuite[0].assemblies).toEqual(HOST_ASSEMBLIES);
  const plain = await handedToCut(page, drawing({ levelAssemblies: HOST_ASSEMBLIES,
    holograms: [holo('old-house', suiteSource())] }));
  expect(plain[0].assemblies, 'an existing house shown under this one is its own').toEqual(SUITE_ASSEMBLIES);
});
