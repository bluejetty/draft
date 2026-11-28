// THE SAVED FORMAT'S KEY NAMES, PINNED ON PURPOSE -- on MODEL.html.
//
// Deep-clean item 6, moved off the old page 28 Nov 2026. Other pages read
// MODEL's drawing file (LAYOUT, PROJECT, SPECS), and LAYOUT and SPECS also
// write their own keys INTO it (`layout`, `specs`). Renaming or dropping one
// of those does not break MODEL at all; it breaks the other page, quietly,
// on a drawing that still opens fine. So:
//
//   1. THE CROSS-PAGE KEYS -- a file that carries them still carries them,
//      spelled the same, after MODEL.html edits and saves it.
//   2. THE `layout` AND `specs` ROUND TRIPS -- the ones that cost a drafter
//      real work: a MODEL save must never delete the sheet set or the
//      project's spec sections.
//   3. NOTHING MODEL.html DOES NOT KNOW IS LOST -- a key it has no use for
//      (a newer page's, a sister page's) rides through a save untouched.
//   4. buildType -- the shared reader normalises what it does not know.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Each cross-page key, with the page that reads it.
const CROSS_PAGE = {
  lines: ['MODEL.html'],
  walls: ['LAYOUT', 'PROJECT', 'MODEL.html'],
  floors: ['LAYOUT', 'MODEL.html'],
  roofs: ['LAYOUT'],
  fenestrations: ['LAYOUT'],
  projectInfo: ['SPECS'],
  boneyardShelves: ['LAYOUT'],
  boneyardOutlines: ['LAYOUT'],
  outlines: ['LAYOUT'],
  levels: ['LAYOUT', 'PROJECT', 'MODEL.html'],
  units: ['LAYOUT'],
  activeWallType: ['PROJECT'],
  levelAssemblies: ['LAYOUT', 'PROJECT'],
  elevationDatum: ['LAYOUT'],
  cuts: ['LAYOUT'],
};

const P = (x, z) => ({ x, y: 0, z });
const SQUARE = [P(0, 0), P(24, 0), P(24, 20), P(0, 20)];
const LAYOUT = {
  paperKey: '11x17', orientation: 'landscape', titleblock: 'bluejetty-band',
  northArrow: false, auto: true, nextViewportId: 2,
  viewports: [{ id: 1, kind: 'plan', pif: 1 / 8, xIn: 4, yIn: 3, sheet: 1, levelId: 3 }],
  sheets: [{ title: 'SITE PLAN' }, { title: 'ELECTRIC PLAN' }],
};
const SPECS = {
  sections: [
    { id: '06-10-00', off: true },
    { id: '07-21-00', body: 'Batt insulation to R-24 in all exterior walls.' },
    { id: '99-01-00', added: true, div: 6, kind: 'notes',
      title: 'SITE-SPECIFIC CARPENTRY', body: 'Stair stringers cut on site.' },
  ],
};
const house = (extra = {}) => ({
  version: 1,
  levels: [
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 1,
  walls: SQUARE.map((pt, i) => ({
    id: 100 + i, start: pt, end: SQUARE[(i + 1) % 4], levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], shapes: [], stairs: [],
  notes: [], roomTags: [], columns: [], beams: [], groups: [], levelLocks: [], underlays: [],
  outlines: [{ id: 1, levelId: 3, points: SQUARE, garage: false }],
  boneyardShelves: [{ id: 1, name: 'SHELF 1' }],
  boneyardOutlines: [],
  projectInfo: { client: 'A. Client', address: '1 Test Street' },
  units: 'imperial',
  activeWallType: 'stud_2x6',
  levelAssemblies: {},
  elevationDatum: 'local',
  cuts: [],
  ...extra,
});

// An edit, then SAVE: what is in the store afterwards is what MODEL.html's
// writer produced, not the file the test seeded.
async function editAndSave(page, file) {
  await h.openEditor(page, { drawing: file, url: '/MODEL.html?left=1&lpane=drafting&level=3' });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const { at } = await h.planFrame(page);
  await page.keyboard.press('l');
  await page.mouse.click(...at(4, 6)); await page.waitForTimeout(60);
  await page.mouse.click(...at(14, 6)); await page.waitForTimeout(60);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  const saved = await h.savedDrawing(page);
  expect((saved.lines || []).length, 'MODEL never saved the edit, so nothing was measured')
    .toBe((file.lines || []).length + 1);
  return saved;
}

test('the fifteen cross-page keys are still there, spelled as their readers expect', async ({ page }) => {
  const saved = await editAndSave(page, house());
  for (const [key, readers] of Object.entries(CROSS_PAGE)) {
    expect(saved, `${key} is read by ${readers.join(', ')}`).toHaveProperty(key);
  }
});

test('a key MODEL.html does not use rides through a save untouched', async ({ page }) => {
  const saved = await editAndSave(page, house({ zzFromANewerPage: { kept: [1, 2, 3] } }));
  expect(saved.zzFromANewerPage).toEqual({ kept: [1, 2, 3] });
});

test("MODEL saving does not delete LAYOUT's sheets", async ({ page }) => {
  const saved = await editAndSave(page, house({ layout: LAYOUT }));
  expect(saved.layout, "LAYOUT's layout key was dropped by a MODEL save").toBeTruthy();
  expect(saved.layout.viewports).toHaveLength(1);
  expect(saved.layout.viewports[0].levelId).toBe(3);
  expect(saved.layout.paperKey).toBe('11x17');
  expect(saved.layout.titleblock, 'the titleblock id LAYOUT chose').toBe('bluejetty-band');
  expect(saved.layout.auto).toBe(true);
  expect(saved.layout.sheets).toEqual([{ title: 'SITE PLAN' }, { title: 'ELECTRIC PLAN' }]);
});

test("MODEL saving does not delete SPECS' project sections", async ({ page }) => {
  const saved = await editAndSave(page, house({ specs: SPECS }));
  expect(saved.specs, "SPECS' project sections were dropped by a MODEL save").toBeTruthy();
  const byId = Object.fromEntries((saved.specs.sections || []).map(s => [s.id, s]));
  expect(Object.keys(byId)).toHaveLength(3);
  expect(byId['06-10-00'].off).toBe(true);
  expect(byId['07-21-00'].body, "the drafter's wording, not the master's").toContain('R-24');
  expect(byId['99-01-00']).toMatchObject({
    added: true, div: 6, title: 'SITE-SPECIFIC CARPENTRY',
  });
  expect(byId['99-01-00'].body).toContain('Stair stringers');
});

test('buildType: the reader normalises what it does not know', async ({ page }) => {
  await h.openEditor(page, { drawing: house() });
  expect(await page.evaluate(() => {
    const f = window.DraftDrawingFormat;
    return {
      vocabulary: f.BUILD_TYPES,
      unknown: ['castle', 'HOUSE', 'split', 0, {}].map(v => f.buildType(v)),
      rows: f.BUILD_TYPES.map(t => f.sectionRowForBuildType(t)),
      upper: f.BUILD_TYPES.map(t => f.upperFloorForBuildType(t)),
      none: [f.sectionRowForBuildType(null), f.upperFloorForBuildType(null)],
    };
  })).toEqual({
    vocabulary: ['bungalow', 'twoStorey', 'bilevel', 'modifiedBilevel'],
    unknown: [null, null, null, null, null],
    rows: ['house', 'house', 'bilevel', 'modifiedBilevel'],
    upper: [false, true, null, null],
    none: [null, null],
  });
});
