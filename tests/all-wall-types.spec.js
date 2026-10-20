// EVERY WALL TYPE ON EVERY FLOOR (Movie, 20 Oct).
//
// "i need ALL the walltypes on ALL floors (the 2x4 and 2x6 in the foundation
// and the ICF walls 11.25 6"core and 13.25: 8" core and the regular 8" conc.
// just put ALL walls available for all floors" -- "i need to make the ext
// shell the same wall type so they will match up". A selected wall's TYPE
// row offered only its context's kind: the framed assemblies on a floor, the
// concrete and ICF in the foundation. It offers the whole table now, its own
// kind first.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, extra) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  refLine: 'center', ...extra });
const drawing = () => ({
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3, nextDrawingItemId: 20,
  walls: [W('main', [-8, 0], [8, 0], { levelId: 3, view: 'plan', wallType: 'stud_2x6' }),
    W('fdn', [-8, 0], [8, 0], { levelId: 1, view: 'foundation', wallType: 'concrete_8', baseHeight: 0, topHeight: 8 })],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], fixtures: [],
  outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
async function open(page, url) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  return h.planFrame(page);
}
const chips = page => page.locator('#props-slot [data-prop-row="type"] [data-prop-value]');
const chip = (page, id) => page.locator(`#props-slot [data-prop-row="type"] [data-prop-value="${id}"]`);
const ids = async page => (await chips(page).evaluateAll(els => els.map(el => el.dataset.propValue)));
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const FRAMED = ['stud_2x4', 'stud_2x6', 'stud_2x8', 'insulation_6', 'guardrail'];
const STRUCTURAL = ['concrete_8', 'icf', 'icf_13', 'pt_wood_fdn'];

test('a MAIN FL wall offers the concrete and ICF assemblies after the framed ones, and takes ICF', async ({ page }) => {
  const { at } = await open(page, '/MODEL.html?left=1&right=1&level=3');
  await page.mouse.click(...at(0, 0));
  await expect(page.locator('#props-slot')).toBeVisible();
  expect(await ids(page), 'the whole table, the studs first').toEqual([...FRAMED, ...STRUCTURAL]);
  await chip(page, 'icf').click();
  await page.waitForTimeout(100);
  const d = await saved(page);
  expect(d.walls.find(w => w.id === 'main').wallType, 'an ICF wall on the floor').toBe('icf');
  expect(d.walls.find(w => w.id === 'fdn').wallType, 'the foundation wall untouched').toBe('concrete_8');
});

test('a FOUNDATION wall offers the studs after the structural ones, and takes 2x6', async ({ page }) => {
  const { at } = await open(page, '/MODEL.html?left=1&right=1&level=1&view=foundation');
  await page.mouse.click(...at(0, 0));
  await expect(page.locator('#props-slot')).toBeVisible();
  expect(await ids(page), 'the whole table, concrete and ICF first').toEqual([...STRUCTURAL, ...FRAMED]);
  await chip(page, 'stud_2x6').click();
  await page.waitForTimeout(100);
  const d = await saved(page);
  expect(d.walls.find(w => w.id === 'fdn').wallType, 'a framed wall in the foundation').toBe('stud_2x6');
  expect(d.walls.find(w => w.id === 'fdn').view, 'still a foundation wall').toBe('foundation');
});
