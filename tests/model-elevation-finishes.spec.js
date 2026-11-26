// THE EXT. FINISH HATCHES SHOW ON MODEL'S ELEVATION VIEWS.
//
// jb, 26 Nov 2026: "can you show the ext finish that is applied in the model
// area too ?" ... "but don't allow editing of it in ther model area yet".
// PR #1123 put the siding, shake, stucco, bands and roofing on the
// CONSTRUCTION LAYOUT's elevations; MODEL's E1-E4 (MODEL.html?view=cut:E1)
// still drew plain white walls. Now they wear them, display only, and layer
// A-ELEV-FIN's Visible tick on STANDARDS turns them off.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const point = (x, z) => ({ x, y: 0, z });

function drawing(finish) {
  const wall = (id, levelId, view, sx, sz, ex, ez, top) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId, view,
    wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
    baseHeight: 0, topHeight: top, refLine: 'left',
    ...(finish && view === 'plan' ? { finish } : {}),
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
      id: 'S1', name: 'S1', elev: 0, levelId: 3,
      startPt: { x: 18, z: -4 }, endPt: { x: 18, z: 30 },
      dirVec: { x: 1, z: 0 },
    }],
  };
}

async function seed(page, saved) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved });
}

// Pixels unlike the canvas's own ground (sampled at the corner), inside the
// frame the painter hands back -- the hatch is light ink, so any ink counts.
async function inkOn(page, view) {
  await page.goto(`/MODEL.html?theme=rough&mode=day&level=3&view=cut%3A${view}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 15000 });
  await page.waitForFunction(() => !!window.__elevFrame);
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    // INK, NOT GROUND: the MODEL page round the drawing is a light grey, so
    // a pixel counts when it is clearly darker than the paper (the hatch is
    // drawn at half strength, the walls and roof outline full).
    const c = document.getElementById('plan');
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0 && data[i] + data[i + 1] + data[i + 2] < 600) n += 1;
    }
    return n;
  });
}

test('MODEL loads the roof patterns the elevation reads', async ({ page }) => {
  await page.goto('/MODEL.html');
  await page.waitForFunction(() => !!window.DraftCutView, null, { timeout: 15000 });
  const loaded = await page.evaluate(() => ({
    walls: typeof window.DraftFinishPatterns?.drawFinish === 'function',
    roofTypes: !!window.DraftRoofTypes,
    roofs: !!window.DraftRoofPatterns,
  }));
  expect(loaded).toEqual({ walls: true, roofTypes: true, roofs: true });
});

test('siding set on EXT. FINISH hatches every MODEL elevation', async ({ page }) => {
  const plain = {};
  const clad = {};
  await seed(page, drawing(null));
  for (const v of ['E1', 'E2', 'E3', 'E4']) plain[v] = await inkOn(page, v);
  await seed(page, drawing('siding_h'));
  for (const v of ['E1', 'E2', 'E3', 'E4']) clad[v] = await inkOn(page, v);
  for (const v of ['E1', 'E2', 'E3', 'E4']) {
    expect(clad[v], `${v} carries the siding courses (${plain[v]} -> ${clad[v]})`)
      .toBeGreaterThan(plain[v] * 1.3);
  }
});

test('a section on MODEL stays line work', async ({ page }) => {
  await seed(page, drawing(null));
  const plain = await inkOn(page, 'S1');
  await seed(page, drawing('siding_h'));
  const clad = await inkOn(page, 'S1');
  expect(Math.abs(clad - plain)).toBeLessThanOrEqual(Math.max(20, plain * 0.02));
});

test('A-ELEV-FIN Visible off on STANDARDS takes them off MODEL', async ({ page }) => {
  await seed(page, drawing(null));
  const plain = await inkOn(page, 'E1');
  await seed(page, drawing('siding_h'));
  const clad = await inkOn(page, 'E1');
  expect(clad).toBeGreaterThan(plain * 1.3);

  await page.goto('/STANDARDS.html');
  await expect(page.locator('#groups .group')).toHaveCount(8);
  await page.locator('[data-layer-visible="A-ELEV-FIN"]').uncheck();
  await expect(page.locator('#status')).toContainText('hidden');

  const off = await inkOn(page, 'E1');
  // The hatch is gone: back to (or under -- the seam rule reads the finish,
  // so a line or two can differ) the plain wall, nowhere near the clad one.
  expect(off, `hidden: ${plain} plain, ${clad} clad, ${off} with the layer off`)
    .toBeLessThanOrEqual(plain * 1.02 + 20);
  expect(off * 1.3).toBeLessThan(clad);
});
