// A BLANK LAYOUT OVER A BUILT HOUSE IS DEALT ON THE WAY IN (Movie, 17 Oct,
// on a CONSTRUCTION LAYOUT showing one empty sheet beside a house he had
// already built):
//
//   "if the user created a house already, when they go into the CONSTRUCTION
//    LAYOUT area, can you automatically DEAL the sheets when they enter so
//    they all pop up"
//
//   "oh ya, check to make sure the sheets haven't been dealed yet first, if
//    they have been dealed already don't do anything"
//
//   "if its blank and there is a house in the model space, make a DEAL"
//
// So three shapes, pinned here: blank sheets over walls deal themselves on
// entry, with no press and no dialog; anything already on the sheets -- a
// dealt set, a viewport someone placed by hand -- loads exactly as saved and
// writes nothing; and a drawing with no walls deals nothing, because every
// sheet it dealt would be a name over an empty page.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });

// A saved drawing with a house in it: a 36' x 26' main floor over a
// foundation, the way the bone leaves one, and NO layout key at all.
function house() {
  const wall = (id, levelId, view, sx, sz, ex, ez, top) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId, view,
    wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
    baseHeight: 0, topHeight: top, refLine: 'left',
  });
  const ring = (idBase, levelId, view, top) => [
    wall(idBase + 1, levelId, view, 0, 0, 36, 0, top),
    wall(idBase + 2, levelId, view, 36, 0, 36, 26, top),
    wall(idBase + 3, levelId, view, 36, 26, 0, 26, top),
    wall(idBase + 4, levelId, view, 0, 26, 0, 0, top),
  ];
  return {
    version: 1,
    levels: [
      { id: 8, name: 'SITE', elev: 0 },
      { id: 7, name: 'ROOF', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [...ring(0, 3, 'plan', 8.09), ...ring(10, 1, 'foundation', 8)],
    roofs: [], cuts: [], fenestrations: [],
  };
}

// The same house with ONE viewport a drafter placed, and the flag off.
function houseArrangedByHand() {
  const d = house();
  d.layout = {
    paperKey: '11x17', orientation: 'landscape', auto: false, nextViewportId: 2,
    sheets: [{ title: 'MINE' }],
    viewports: [{ id: 1, kind: 'elevation', elevId: 'E1', pif: 0.25, xIn: 8.5, yIn: 5.5, sheet: 1 }],
  };
  return d;
}

async function openLayout(page, drawing) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

const saveSeq = page => page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));

async function savedLayout(page) {
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()).layout : null;
  }, BUCKET);
}

test('a blank layout over a built house is dealt on entry, with no press and no dialog',
  async ({ page }) => {
    // NO DIALOG HANDLER ON PURPOSE: a confirm raised on load would hang the
    // wait below, so a pass here means none was asked.
    await openLayout(page, house());
    await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
      && document.body.dataset.layoutSaveDirty !== '1');

    const layout = await savedLayout(page);
    expect(layout.auto).toBe(true);
    expect(layout.viewports.length).toBeGreaterThan(1);
    expect(layout.sheets.length).toBeGreaterThan(1);
    // THE SET, not a sheet: the elevations paired on their own pages, and a
    // plan page for the floor and the foundation after them.
    const kinds = layout.viewports.map(v => v.kind);
    expect(kinds.filter(k => k === 'elevation')).toHaveLength(4);
    expect(kinds).toContain('plan');
    await expect(page.locator('[data-layout-sheet]')).not.toHaveCount(1);
    // And the button now names the re-deal, because there is a set to replace.
    await expect(page.locator('[data-layout-deal-sheets]')).toContainText(/Re-deal/i);
  });

test('sheets already dealt or arranged by hand are left exactly as saved, and nothing is written',
  async ({ page }) => {
    const mine = houseArrangedByHand();
    await openLayout(page, mine);
    await expect(page.locator('[data-layout-sheet]')).toHaveCount(1);
    // Give a compose every chance to land before reading.
    await page.waitForTimeout(500);
    expect(await saveSeq(page), 'entry wrote the layout back').toBe(0);
    const layout = await savedLayout(page);
    expect(layout.auto).toBe(false);
    expect(layout.viewports).toEqual(mine.layout.viewports);
    expect(layout.sheets).toEqual(mine.layout.sheets);
    await expect(page.locator('[data-layout-deal-sheets]')).toContainText(/Re-deal/i);
  });

test('a drawing with no walls deals nothing on entry', async ({ page }) => {
  const bare = house();
  bare.walls = [];
  await openLayout(page, bare);
  await expect(page.locator('[data-layout-sheet]')).toHaveCount(1);
  await page.waitForTimeout(500);
  expect(await saveSeq(page), 'entry wrote the layout back').toBe(0);
  expect(await savedLayout(page)).toBeFalsy();
  // The verb is still there for whoever wants named empty sheets anyway.
  await expect(page.locator('[data-layout-deal-sheets]')).toBeEnabled();
  await expect(page.locator('[data-layout-deal-sheets]')).toContainText(/^Deal Sheets$/i);
});
