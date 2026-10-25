// SUITES DO NOT BLANK THE ELEVATIONS (Movie, 25 Oct: "something is the matter
// with the elevations, they were showing earlier i think, and then i only say
// part of 1 of the elevations and now i can't see any elevations (in the
// LAYOUT area"). A suite hologram behind the house is drawn in its own pass
// onto the sheet's canvas, and that pass left its margin clip standing: each
// suite one more clip, until the house's own lines -- and every viewport
// drawn after it -- were cut away. Twenty-two suites in his drawing, no
// elevations. The elevations with suites inside the house must carry the
// house's ink.
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

async function sheetMetrics(page) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return { box, zoom, panX: (box.width - PW * zoom) / 2, panY: (box.height - PH * zoom) / 2 };
}



// SIX SUITES OF FOUR WALLS, inside the 36' x 26' house on MAIN FL: behind its
// faces in every elevation, so each is drawn in the underlay pass.
const withSuites = () => {
  const d = boneDrawing();
  const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
    baseHeight: 0, topHeight: 8, start: point(a[0], a[1]), end: point(b[0], b[1]) });
  const box = [W('s1', [0, 0], [10, 0]), W('s2', [10, 0], [10, 8]), W('s3', [10, 8], [0, 8]), W('s4', [0, 8], [0, 0])];
  d.holograms = [0, 1, 2].flatMap(i => [0, 1].map(j => ({
    id: `hologram-${i}${j}`, name: 'SUITE A', mode: 'suite', x: 3 + i * 11, z: 3 + j * 11,
    angleDeg: 0, pivotX: 0, pivotZ: 0, source: { version: 1, levels: d.levels, walls: box },
  })));
  return d;
};
// THE INK IN EACH ELEVATION'S FRAME on the open sheet, the sheet's paper
// white left out.
async function elevationInk(page) {
  const frames = JSON.parse(await page.locator('[data-layout-canvas]').getAttribute('data-layout-frames'))
    .filter(f => f.kind === 'elevation');
  const m = await sheetMetrics(page);
  return page.evaluate(({ frames, m }) => {
    const c = document.querySelector('[data-layout-canvas]');
    const dpr = c.width / c.getBoundingClientRect().width;
    const ctx = c.getContext('2d');
    return frames.map(f => {
      const x = Math.round((m.panX + f.xIn * m.zoom) * dpr), y = Math.round((m.panY + f.yIn * m.zoom) * dpr);
      const w = Math.max(1, Math.round(f.wIn * m.zoom * dpr)), hh = Math.max(1, Math.round(f.hIn * m.zoom * dpr));
      const d = ctx.getImageData(x, y, w, hh).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 140 && d[i + 1] < 140 && d[i + 2] < 140 && d[i + 3] > 0) n += 1;
      return n;
    });
  }, { frames, m });
}
async function inkOnElevationSheet(page, drawing) {
  await openLayout(page, drawing);
  await waitForCompose(page);
  const layout = await savedLayout(page);
  const sheet = layout.viewports.find(v => v.kind === 'elevation').sheet || 1;
  await page.locator(`[data-layout-sheet="${sheet}"]`).click();
  await page.waitForTimeout(400);
  return elevationInk(page);
}

test('suites inside the house leave its elevations drawn: every elevation frame carries the house\'s ink', async ({ page }) => {
  const bare = await inkOnElevationSheet(page, boneDrawing());
  expect(bare.length, 'elevations on the sheet').toBeGreaterThan(0);
  bare.forEach(n => expect(n, 'the house draws').toBeGreaterThan(200));
  const suited = await inkOnElevationSheet(page, withSuites());
  expect(suited.length).toBe(bare.length);
  suited.forEach((n, i) => expect(n, `elevation ${i + 1} keeps its lines with the suites behind it`).toBeGreaterThan(bare[i] * 0.8));
});
