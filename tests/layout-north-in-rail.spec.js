// NORTH AT THE HEAD OF THE SHEET RAIL (Movie, 17 Oct, drawn in GIMP over
// CONSTRUCTION LAYOUT: a red arrow from the bottom bar's NORTH button up to
// the top of the sheet rail): "on construction layout move the North arrow
// up here".
//
// The button the bar seated left of REAL ESTATE PLAN since 1 Oct moves up
// into the rail, above the first sheet; it is the same button -- the same
// popup on the same layout record (model-north.spec.js pins that) -- and the
// sheets still fit under it, because the rail's thumbnail sizing takes the
// head's row off the top first.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });

// A two-storey house with the flag up, so the rail has a full set to fit.
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
      { id: 7, name: 'ROOF', elev: 18 },
      { id: 5, name: '2ND FL', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [...ring(0, 5, 'plan', 8.09), ...ring(10, 3, 'plan', 8.09), ...ring(20, 1, 'foundation', 8)],
    roofs: [], cuts: [], fenestrations: [],
    layout: { auto: true, north: { cn: 1, tn: -3 } },
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
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
}

test('NORTH stands at the head of the sheet rail, not in the bottom bar, and the sheets fit under it',
  async ({ page }) => {
    await openLayout(page, house());

    // ONE button, in the rail, none left in the bar.
    await expect(page.locator('[data-north-button]')).toHaveCount(1);
    await expect(page.locator('#lay-rail [data-north-button]')).toHaveCount(1);
    await expect(page.locator('#sheet-row [data-north-button]')).toHaveCount(0);

    const rail = await page.locator('#lay-rail').boundingBox();
    const north = await page.locator('[data-north-button]').boundingBox();
    const thumbs = await page.locator('.lay-thumb').evaluateAll(
      els => els.map(el => el.getBoundingClientRect().toJSON()));
    expect(thumbs.length).toBeGreaterThan(2);
    // UP HERE: inside the rail, above every sheet.
    expect(north.x).toBeGreaterThanOrEqual(rail.x);
    expect(north.x + north.width).toBeLessThanOrEqual(rail.x + rail.width);
    thumbs.forEach(t => expect(north.y + north.height).toBeLessThanOrEqual(t.y + 1));
    // AND THE SET STILL FITS: the last sheet's bottom inside the rail, with
    // the head's row taken off the top -- the rail scrolls only below a
    // floor the sizing already guards.
    const last = thumbs.reduce((a, b) => (b.y + b.height > a.y + a.height ? b : a));
    expect(last.y + last.height).toBeLessThanOrEqual(rail.y + rail.height + 1);

    // THE SAME BUTTON: it opens the two-norths popup on the layout record.
    await page.locator('[data-north-button]').click();
    const pop = page.locator('[data-north-popup]');
    await expect(pop).toBeVisible();
    await expect(pop.locator('[data-north-value="cn"]')).toHaveText('90°');
  });
