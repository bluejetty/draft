// THE LAYOUT DESK, TIDIED (Movie, 26 Oct).
//
// "in the layout area i can 're-arrange' the layouts by dragging their
// position (in the right menu with the small viewports showing the layouts)"
// -- "when i click in the title block area where it says NEW HOME ... allow
// the user to click on it to change it, and also change it in the project
// information area too" -- "we shouldn't need the left area menu SHEET,
// because we have the layout viewports on the right side that does all the
// same stuff" -- and PLAN LEVEL, "think it doesn't do anything".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

const point = (x, z) => ({ x, y: 0, z });

// A saved drawing the way the bone leaves one: a 36' x 26' main floor over a
// foundation, an all-covering gable roof, one drawn section, and the flag up.
function boneDrawing({ auto = true, layout = undefined } = {}) {
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
    roofs: [{
      id: 1, levelId: 7, pitch: 4, overhang: 1.5,
      points: [
        { x: -1.5, z: -1.5 }, { x: 37.5, z: -1.5 },
        { x: 37.5, z: 27.5 }, { x: -1.5, z: 27.5 },
      ],
      edges: ['eave', 'gable', 'eave', 'gable'],
    }],
    cuts: [{
      id: 1, name: 'S1', elev: 0, levelId: 3,
      startPt: { x: 18, z: -4 }, endPt: { x: 18, z: 30 },
      dirVec: { x: 1, z: 0 },
    }],
    fenestrations: [
      { id: 1, levelId: 3, wallId: 1, type: 'door', offset: 6, width: 3 },
    ],
    layout: layout !== undefined ? layout : { auto },
  };
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

// The composer persists from inside the load callback; reads wait for its
// write to land instead of racing it.
async function waitForCompose(page) {
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
}

async function savedLayout(page) {
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()).layout : null;
  }, BUCKET);
}


// A paper-inch point on the desk, through the view the page reports.
async function deskPoint(page, xIn, yIn) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const [zoom, panX, panY] = (await page.evaluate(() => document.body.dataset.layoutView)).split(',').map(Number);
  return [box.x + panX + xIn * zoom, box.y + panY + yIn * zoom];
}
const hitOf = (page, key) => page.evaluate(k => JSON.parse(document.body.dataset[k] || 'null'), key);
const centre = r => [r.xIn + r.wIn / 2, r.yIn + r.hIn / 2];
const saveSeq = page => page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
const savedAfter = async (page, after) => {
  await page.waitForFunction(p => Number(document.body.dataset.layoutSaveSeq || 0) > p, after);
  return savedLayout(page);
};

const titles = page => page.locator('[data-sheet-thumb] [data-sheet-name]').allTextContents();
async function dragThumb(page, from, to) {
  const a = await page.locator(`[data-sheet-thumb="${from}"] canvas`).boundingBox();
  const b = await page.locator(`[data-sheet-thumb="${to}"] canvas`).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('a page dragged on the rail takes its place in the set; what is on each page goes with it', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const before = await titles(page);
  const dealt = await savedLayout(page);
  const onSheet = (layout, n) => layout.viewports.filter(v => (v.sheet || 1) === n).map(v => v.id).sort();
  const third = onSheet(dealt, 3);
  const seq = await saveSeq(page);
  await dragThumb(page, 3, 1);
  const saved = await savedAfter(page, seq);
  const name = t => t.replace(/^\d+\s+/, '');
  const after = (await titles(page)).map(name);
  expect(after, 'the third page is first, the rest close up behind it')
    .toEqual([before[2], before[0], before[1], ...before.slice(3)].map(name));
  expect(saved.sheets.map(s => s.title)).toEqual(dealt.sheets.length ? [dealt.sheets[2], dealt.sheets[0], dealt.sheets[1], ...dealt.sheets.slice(3)].map(s => s.title) : []);
  expect(onSheet(saved, 1), 'its drawings came with it').toEqual(third);
  // A press that does not travel is still a click: it opens the page.
  await page.locator('[data-sheet-thumb="2"] canvas').click();
  await expect(page.locator('[data-sheet-thumb="2"]')).toHaveClass(/\bon\b/);
  await expect(page.locator('#lay-rename')).toHaveCount(0);
});

test('a page let go on itself goes nowhere', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const before = await titles(page);
  const a = await page.locator('[data-sheet-thumb="2"] canvas').boundingBox();
  await page.mouse.move(a.x + 5, a.y + 5);
  await page.mouse.down();
  await page.mouse.move(a.x + 30, a.y + 20, { steps: 5 });
  await page.mouse.up();
  expect(await titles(page)).toEqual(before);
});

test('the project name on the titleblock is a text box on a press, and the drawing -- so PROJECT -- takes it', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const hit = await hitOf(page, 'layoutProjectHit');
  expect(hit, 'the strip says where the project name is').toBeTruthy();
  await page.mouse.click(...await deskPoint(page, ...centre(hit)));
  await expect(page.locator('#lay-rename[data-project-rename]')).toBeVisible();
  const seq = await saveSeq(page);
  await page.locator('#lay-rename').fill('Maple Court');
  await page.keyboard.press('Enter');
  await page.waitForFunction(p => Number(document.body.dataset.layoutSaveSeq || 0) > p, seq);
  const stored = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, BUCKET);
  expect(stored.projectInfo.name).toBe('Maple Court');
  expect(stored.layout, 'the sheets were kept').toBeTruthy();
  // PROJECT reads the same box.
  await page.goto('/PROJECT.html');
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('input')]
    .some(i => i.value === 'Maple Court')), { timeout: 10000 }).toBe(true);
});

test('no SHEET list and no PLAN LEVEL list on the left; the rail is the sheet list', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  await expect(page.locator('[data-sheet-list]')).toHaveCount(0);
  await expect(page.locator('[data-layout-add-sheet]')).toHaveCount(0);
  await expect(page.locator('[data-level-list]')).toHaveCount(0);
  const count = await page.locator('[data-sheet-thumb]').count();
  await page.locator('[data-rail-add-page]').click();
  await expect(page.locator('[data-sheet-thumb]')).toHaveCount(count + 1);
});

// THE SITE SHEET'S ROWS AT THE SITE SHEET'S SCALE (Movie, 26 Oct: "the
// dimensions are too close together due to the scale and size"). Each
// viewport hands the rows its own scale, and its frame keeps paper for them.
test('a site viewport lays its rows out at its own scale, and its frame has paper room for them', async ({ page }) => {
  const lot = { id: 'lot', site: true, levelId: 8,
    points: [{ x: -40, z: -60 }, { x: 80, z: -60 }, { x: 80, z: 90 }, { x: -40, z: 90 }] };
  await openLayout(page, { ...boneDrawing(), outlines: [lot] });
  await waitForCompose(page);
  const got = await page.evaluate(() => {
    const LP = window.DraftLayoutPlan;
    const seen = [];
    window.DraftLayoutPlan = { ...LP, drawPlan: (...a) => { if (Number(a[3]) === 8) seen.push(a[4]?.pif); return LP.drawPlan(...a); } };
    const site = page.state.viewports.find(v => v.kind === 'plan' && Number(v.levelId) === 8);
    page.setState({ activeSheet: site.sheet || 1 }, () => page._draw());
    const foot = page._viewFootprintFt(site);
    const rect = page._naturalRectIn(site);
    window.DraftLayoutPlan = LP;
    return { seen, pif: site.pif, wFt: foot.wFt, wIn: rect.wIn };
  });
  expect(got.seen.length, 'the site was drawn').toBeGreaterThan(0);
  expect(got.seen.every(p => p === got.pif), 'with its own scale').toBe(true);
  // 3/8" + 3/8" + 1/4" of figures, both sides.
  expect(got.wIn - got.wFt * got.pif).toBeCloseTo(2, 6);
});
