// The default sheet set (board #168): a successful BUILD HOUSE raises
// layout.auto, and LAYOUT answers the flag by dealing every plan with walls,
// every drawn section, and the four standard elevations onto sheets — each at
// the largest drafting scale that fits, E1+E2 on one page and E3+E4 on the
// next. Any hand on the sheets takes the flag off; a drawing arranged by hand
// loads exactly as saved.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;
const SCALE_LADDER = [1 / 16, 1 / 8, 3 / 16, 1 / 4, 3 / 8, 1 / 2, 3 / 4, 1];

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
  await page.goto('/LAYOUT.dc.html');
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

async function sheetMetrics(page) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return { box, zoom, panX: (box.width - PW * zoom) / 2, panY: (box.height - PH * zoom) / 2 };
}

async function inkAround(page, xIn, yIn, radiusIn) {
  const m = await sheetMetrics(page);
  return page.evaluate(({ cx, cy, r }) => {
    const canvas = document.querySelector('[data-layout-canvas]');
    const data = canvas.getContext('2d').getImageData(
      Math.round(cx - r), Math.round(cy - r), Math.round(r * 2), Math.round(r * 2),
    ).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) ink += 1;
    }
    return ink;
  }, { cx: m.panX + xIn * m.zoom, cy: m.panY + yIn * m.zoom, r: radiusIn * m.zoom });
}

test('the flag deals plans, the section, and E1-E4 onto sheets', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const layout = await savedLayout(page);

  // The flag survives the compose: the sheets stay the composer's.
  expect(layout.auto).toBe(true);

  // Every plan with walls, the drawn section, and all four elevations.
  const kinds = kind => layout.viewports.filter(viewport => viewport.kind === kind);
  expect(kinds('plan').map(viewport => viewport.levelId).sort()).toEqual([1, 3]);
  expect(kinds('section').map(viewport => viewport.cutId)).toEqual([1]);
  expect(kinds('elevation').map(viewport => viewport.elevId).sort())
    .toEqual(['E1', 'E2', 'E3', 'E4']);

  // Every scale comes off the drafting ladder, and every centre is on paper.
  layout.viewports.forEach(viewport => {
    expect(SCALE_LADDER.some(pif => Math.abs(pif - viewport.pif) < 1e-9)).toBe(true);
    expect(viewport.sheet).toBeGreaterThanOrEqual(1);
    expect(viewport.xIn).toBeGreaterThan(0);
    expect(viewport.xIn).toBeLessThan(PW);
    expect(viewport.yIn).toBeGreaterThan(0);
    expect(viewport.yIn).toBeLessThan(PH);
  });

  // E1+E2 share a page, E3+E4 the next — never four-up by default.
  const elev = id => kinds('elevation').find(viewport => viewport.elevId === id);
  expect(elev('E1').sheet).toBe(elev('E2').sheet);
  expect(elev('E3').sheet).toBe(elev('E4').sheet);
  expect(elev('E3').sheet).toBe(elev('E1').sheet + 1);
  // A pair prints at one honest scale.
  expect(elev('E1').pif).toBe(elev('E2').pif);
  expect(elev('E3').pif).toBe(elev('E4').pif);

  // Movie's set order (board NEW-2 part 2): the ELEVATIONS lead the set, then
  // the plans, then the sections. This reverses what the composer did before
  // -- it dealt plans bottom-up first and the elevations last -- and that
  // reversal is the point of the board, not a regression.
  const elevSheets = kinds('elevation').map(viewport => viewport.sheet);
  [...kinds('plan'), ...kinds('section')].forEach(viewport => {
    expect(viewport.sheet).toBeGreaterThan(Math.max(...elevSheets));
  });
  expect(Math.min(...elevSheets)).toBe(1);
  expect(layout.viewports.some(viewport => viewport.sheet === 1)).toBe(true);
});

test('the dealt sheets carry real ink: plan, section, and elevation pages', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const layout = await savedLayout(page);
  const byKind = kind => layout.viewports.find(viewport => viewport.kind === kind);
  for (const viewport of [byKind('plan'), byKind('section'), byKind('elevation')]) {
    await page.locator(`[data-layout-sheet="${viewport.sheet}"]`).click();
    await page.waitForTimeout(200);
    expect(await inkAround(page, viewport.xIn, viewport.yIn, 3.5)).toBeGreaterThan(50);
  }
});

test('a manual touch takes the sheets over, and a reload leaves them alone', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const dealt = await savedLayout(page);
  const target = dealt.viewports.find(viewport => viewport.sheet === 1);

  // Drag the first sheet's viewport a little: the flag comes off.
  const m = await sheetMetrics(page);
  const from = {
    x: m.box.x + m.panX + target.xIn * m.zoom,
    y: m.box.y + m.panY + target.yIn * m.zoom,
  };
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + m.zoom, from.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(
    prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
  const touched = await savedLayout(page);
  expect(touched.auto).toBe(false);

  // A fresh visit composes nothing: the moved sheet set loads exactly as saved.
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForTimeout(400);
  expect(await savedLayout(page)).toEqual(touched);
});

test('a drawing arranged by hand loads exactly as saved', async ({ page }) => {
  const manual = {
    paperKey: '11x17',
    orientation: 'landscape',
    viewports: [{ id: 1, kind: 'plan', levelId: 3, pif: 0.25, xIn: 8, yIn: 5, sheet: 1 }],
    nextViewportId: 2,
  };
  await openLayout(page, boneDrawing({ layout: manual }));
  await page.waitForTimeout(400);
  const layout = await savedLayout(page);
  expect(layout.viewports).toHaveLength(1);
  expect(layout.viewports[0]).toMatchObject({ kind: 'plan', levelId: 3, xIn: 8, yIn: 5 });
  expect(layout.auto ?? false).toBe(false);
});

test('BUILD HOUSE raises the flag, and LAYOUT answers it with the full set', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);

  // The flag rides the same save as the build.
  expect((await h.savedDrawing(page)).layout.auto).toBe(true);

  // LAYOUT reads the flag and deals the set: plans for every built level,
  // and the four standard elevations.
  await page.goto('/LAYOUT.dc.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await waitForCompose(page);
  const layout = await savedLayout(page);
  const kinds = kind => layout.viewports.filter(viewport => viewport.kind === kind);
  expect(kinds('plan').map(viewport => viewport.levelId).sort()).toEqual([1, 3, 5]);
  expect(kinds('elevation').map(viewport => viewport.elevId).sort())
    .toEqual(['E1', 'E2', 'E3', 'E4']);
});

// ── Movie's set order (board NEW-2 part 2) ──────────────────────────────
// A level is not one drawing. A plan viewport now carries WHICH drawing of
// the level it is, so FOUNDATION and the basement plan are two sheets off
// one level, and the set comes out in the order a permit set reads.

function twoStorey() {
  const d = boneDrawing();
  d.levels = [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -9 },
  ];
  const wall = (id, levelId, view, sx, sz, ex, ez, top) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId, view,
    wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
    baseHeight: 0, topHeight: top, refLine: 'left',
  });
  const ring = (b, lvl, view, top) => [
    wall(b + 1, lvl, view, 0, 0, 36, 0, top), wall(b + 2, lvl, view, 36, 0, 36, 26, top),
    wall(b + 3, lvl, view, 36, 26, 0, 26, top), wall(b + 4, lvl, view, 0, 26, 0, 0, top),
  ];
  // Level 1 carries BOTH: basement walls and the concrete under them.
  d.walls = [
    ...ring(0, 3, 'plan', 8.09), ...ring(20, 5, 'plan', 8.09),
    ...ring(10, 1, 'foundation', 8), ...ring(30, 1, 'plan', 8),
  ];
  return d;
}

const sheetOf = (layout, match) => {
  const vp = layout.viewports.find(match);
  return vp ? vp.sheet : null;
};

test("the set deals in Movie's order, elevations first and the basement last", async ({ page }) => {
  await openLayout(page, twoStorey());
  await waitForCompose(page);
  const layout = await savedLayout(page);

  const e1 = sheetOf(layout, v => v.elevId === 'E1');
  const e3 = sheetOf(layout, v => v.elevId === 'E3');
  const second = sheetOf(layout, v => v.kind === 'plan' && v.levelId === 5 && v.view === 'plan');
  const main = sheetOf(layout, v => v.kind === 'plan' && v.levelId === 3 && v.view === 'plan');
  const fdn = sheetOf(layout, v => v.kind === 'plan' && v.levelId === 1 && v.view === 'foundation');
  const sect = sheetOf(layout, v => v.kind === 'section');
  const bsmt = sheetOf(layout, v => v.kind === 'plan' && v.levelId === 1 && v.view === 'plan');

  // Sheets 1-2 elevations; then floors top down; FOUNDATION; sections; the
  // basement plan last. Sheets 3, 4, 6, 8 and 14 of Movie's list are absent
  // on purpose -- SITE and ROOF have no painter, and the floor-layout and
  // electrical sheets have no entities in the drawing format to paint.
  expect(e1).toBe(1);
  expect(e3).toBe(2);
  expect(second).toBeLessThan(main);
  expect(main).toBeLessThan(fdn);
  expect(fdn).toBeLessThan(sect);
  expect(sect).toBeLessThan(bsmt);
});

test('FOUNDATION and the basement plan are two sheets off one level', async ({ page }) => {
  await openLayout(page, twoStorey());
  await waitForCompose(page);
  const layout = await savedLayout(page);
  const onLevel1 = layout.viewports.filter(v => v.kind === 'plan' && v.levelId === 1);
  // Two viewports, same level, different drawings of it -- and each names
  // which. Before this board a plan viewport was only a level, so level 1
  // dealt once and drew basement walls and concrete on top of each other.
  expect(onLevel1.length).toBe(2);
  expect(onLevel1.map(v => v.view).sort()).toEqual(['foundation', 'plan']);
  expect(new Set(onLevel1.map(v => v.sheet)).size).toBe(2);
});

test('a bungalow deals the same order minus the 2ND FL sheet', async ({ page }) => {
  const d = twoStorey();
  d.levels = d.levels.filter(l => l.id !== 5);
  d.walls = d.walls.filter(w => w.levelId !== 5);
  await openLayout(page, d);
  await waitForCompose(page);
  const layout = await savedLayout(page);
  // Never deal a blank sheet: no 2ND FL walls, no 2ND FL sheet.
  expect(layout.viewports.some(v => v.levelId === 5)).toBe(false);
  expect(sheetOf(layout, v => v.elevId === 'E1')).toBe(1);
  expect(sheetOf(layout, v => v.kind === 'plan' && v.levelId === 3)).toBeGreaterThan(2);
});

test('a level with nothing on a view deals no sheet for it', async ({ page }) => {
  // boneDrawing's level 1 carries concrete only -- no basement walls -- so
  // FOUNDATION deals and the basement plan does not.
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const layout = await savedLayout(page);
  const onLevel1 = layout.viewports.filter(v => v.kind === 'plan' && v.levelId === 1);
  expect(onLevel1.length).toBe(1);
  expect(onLevel1[0].view).toBe('foundation');
});
