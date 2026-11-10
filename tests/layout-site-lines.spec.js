// A SITE PLAN DRAWN BY HAND IS ON THE SHEET.
//
// Movie, 6 Nov: "it only offers me ELEVATIONS for the viewpoint. i have some
// lines draws on the SITE PLAN i need to show" -- and, on the plan to offer
// what has something on it: "put all the possible viewports as available even
// if nothing is drawn please Sir".
//
// Two things were wrong on a drawing that is a site plan and nothing else.
// + ADD VIEWPORT listed the levels WITH WALLS, so with no house it listed
// nothing but ELEVATIONS. And the SITE PLAN viewport painted the lot, the
// footprint and the setback rows -- the lines he drew on the SITE level
// reached the Model Space's screen and never the sheet.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const SITE = 8;

// NO WALLS, NO LOT, NO ROOF: a red line and a note on the SITE level, and
// a line on the ROOF level, which has no walls either.
function siteOnlyDrawing() {
  return {
    version: 1,
    levels: [
      { id: 8, name: 'SITE', elev: 0 },
      { id: 7, name: 'ROOF', elev: 9 },
      { id: 5, name: '2ND FL', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [],
    lines: [
      { id: 1, start: point(0, 0), end: point(60, 0), levelId: SITE, view: 'plan', layer: 'draft', color: '#ff0000', weight: 6 },
      { id: 2, start: point(60, 0), end: point(60, 40), levelId: SITE, view: 'plan', layer: 'draft', color: '#ff0000', weight: 6 },
      { id: 3, start: point(0, 0), end: point(30, 0), levelId: 7, view: 'plan', layer: 'draft', color: '#ff0000', weight: 6 },
    ],
    notes: [{ id: 1, levelId: SITE, view: 'plan', anchor: point(30, 20), text: point(40, 30), body: 'DRIVEWAY', end: 'arrow' }],
    layout: { auto: true },
  };
}

async function openLayout(page, saved) {
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
  }, { bucket: BUCKET, saved });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForTimeout(400);
}

const savedLayout = page => page.evaluate(async () => {
  const at = await window.SharedFileStore.loadSharedFileAt('model-drawing');
  return JSON.parse(await at.file.text()).layout || {};
});

// RED PIXELS ON THE SHEET: the titleblock and the frame are black and grey,
// so red is the drafter's line and nothing else.
const redOnSheet = page => page.evaluate(() => {
  const canvas = document.querySelector('[data-layout-canvas]');
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let red = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) red += 1;
  return red;
});

// The desk point of a sheet-inch position, read off the page's own view.
async function deskPoint(page, xIn, yIn) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const [zoom, panX, panY] = (await page.evaluate(() => document.body.dataset.layoutView)).split(',').map(Number);
  return [box.x + panX + xIn * zoom, box.y + panY + yIn * zoom];
}

test('+ ADD VIEWPORT offers every level with nothing drawn, and a SITE PLAN placed by hand carries the lines drawn on the site', async ({ page }) => {
  const d = siteOnlyDrawing();
  d.layout = { auto: false, viewports: [], sheets: [] };
  await openLayout(page, d);
  await page.locator('[data-layout-add-viewport]').click();
  // AND THE SCHEDULES AND DETAILS since 9 Nov (jb), offered like every
  // other view whether or not anything is drawn yet.
  await expect(page.locator('.lay-add-head')).toHaveText(['PLANS', 'FLOOR LAYOUTS', 'ELEVATIONS', 'SCHEDULES', 'DETAILS']);
  await expect(page.locator('[data-add-pick]')).toHaveText(['SITE PLAN', 'ROOF PLAN', '2ND FL PLAN', 'MAIN FL PLAN',
    'FOUNDATION PLAN', 'BASEMENT PLAN', '2ND FL FLOOR LAYOUT', 'MAIN FL FLOOR LAYOUT',
    'ELEVATION E1', 'ELEVATION E2', 'ELEVATION E3', 'ELEVATION E4',
    'DOOR SCHEDULE', 'WINDOW SCHEDULE',
    'TYP. WALL SECTION', 'EAVE DETAIL', 'FLOOR DETAIL', 'FOOTING DETAIL']);
  await expect(page.locator('[data-add-pick="plan:1:foundation"]')).toHaveText('FOUNDATION PLAN');
  await expect(page.locator('[data-add-pick="plan:3:floor"]')).toHaveText('MAIN FL FLOOR LAYOUT');
  const before = await redOnSheet(page);
  expect(before, 'nothing red on an empty sheet').toBe(0);
  await page.locator('[data-add-pick="plan:8"]').click();
  await page.mouse.click(...await deskPoint(page, 7, 5));
  await expect.poll(() => savedLayout(page).then(l => (l.viewports || []).map(v => `${v.kind}:${v.levelId}`)))
    .toEqual(['plan:8']);
  await page.waitForTimeout(300);
  expect(await redOnSheet(page), 'the red site lines are on the sheet').toBeGreaterThan(50);
  // AN EMPTY LEVEL STILL COMES IN: a 2" frame, which fills in as the drawing does.
  await page.locator('[data-rail-add-page]').click();
  await page.locator('[data-layout-add-viewport]').click();
  await page.locator('[data-add-pick="plan:3:floor"]').click();
  await page.mouse.click(...await deskPoint(page, 7, 5));
  await expect.poll(() => savedLayout(page).then(l => (l.viewports || []).map(v => `${v.kind}:${v.levelId}:${v.view || ''}`)))
    .toEqual(['plan:8:', 'plan:3:floor']);
});

// A fresh build's layout carries `auto: true`, and the set is dealt on entry.
test('the dealt set puts a site drawn by hand on the SITE PLAN sheet, and the ROOF level\'s own lines reach its sheet', async ({ page }) => {
  await openLayout(page, siteOnlyDrawing());
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
  const layout = await savedLayout(page);
  const site = (layout.sheets || []).findIndex(s => /SITE/i.test(s.title || ''));
  expect(site, 'a SITE PLAN sheet is dealt').toBeGreaterThanOrEqual(0);
  expect((layout.viewports || []).filter(v => v.sheet === site + 1).map(v => `${v.kind}:${v.levelId}`),
    'with the site on it').toEqual(['plan:8']);
  await page.locator(`[data-layout-sheet="${site + 1}"]`).click();
  await page.waitForTimeout(300);
  expect(await redOnSheet(page), 'the drafter\'s red lines print on the site sheet').toBeGreaterThan(50);
  // And a ROOF PLAN placed by hand on a new page draws the roof level's line
  // although the level has no roof yet.
  await page.locator('[data-rail-add-page]').click();
  await page.locator('[data-layout-add-viewport]').click();
  await page.locator('[data-add-pick="plan:7"]').click();
  await page.mouse.click(...await deskPoint(page, 7, 5));
  await page.waitForTimeout(300);
  expect(await redOnSheet(page), 'the roof level\'s own line is on its sheet').toBeGreaterThan(20);
});
