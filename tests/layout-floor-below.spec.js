// AN UPPER FLOOR'S PLAN SHOWS THE STOREY UNDER IT (Movie, 12 Oct): "we should
// also show a very lightweight line that shows that ext wall outlines of the
// wlls below and then adjust the scale so the larger plan with the extra
// lightweight lines fits on the upper floors (which are smaller without the
// background lines)" -- "it gives the user a better visual underatanding of
// what they are looking at".
//
// WHAT THIS SPEC IS FOR, and what it deliberately leaves alone. The rule
// itself -- which level is "below", that the half-floor is skipped, that the
// ghost is drawn faint and underneath, and that planBounds grows to hold it --
// is pinned exactly in proto/layout-plan-harness.js, with a mutation row for
// each. None of that needs a browser.
//
// THE LINK THIS PINS IS THE ONE ONLY THE PAGE HAS: LAYOUT picks a viewport's
// SCALE by stepping down from the active one until the footprint fits the
// sheet (`_placementPif`), and that footprint is the one that just grew. That
// is the second half of what he asked for -- "adjust the scale so the larger
// plan ... fits" -- and no harness can see it, because the scale ladder and
// the compose region live on the page.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';

const point = (x, z) => ({ x, y: 0, z });

// A MAIN FLOOR MUCH WIDER THAN THE SECOND, which is Movie's case: the upper
// floor is the smaller drawing, and the ghost of the floor below is what makes
// its sheet need more room than its own walls do.
//
// 64 ft against 24 is far enough apart to cross more than one step of the
// scale ladder, so the assertion is not reading a rounding.
const MAIN_W = 64;
const UPPER_W = 24;
const DEPTH = 24;

function rect(w, d) {
  return [point(0, 0), point(w, 0), point(w, d), point(0, d)];
}

function wallsOf(levelId, startId, w, d) {
  const pts = rect(w, d);
  return pts.map((pt, i) => ({
    id: startId + i,
    start: pt,
    end: pts[(i + 1) % pts.length],
    levelId,
    view: 'plan',
    wallType: 'stud_2x6',
    baseHeight: 0,
    topHeight: 8,
    refLine: 'left',
  }));
}

// `ghost: false` takes the floor below away and changes nothing else, which is
// what makes the comparison below a measurement of the ghost rather than of
// two different drawings.
function twoStoreyDrawing({ ghost = true } = {}) {
  return {
    version: 1,
    levels: [
      { id: 1, name: 'FOUNDATION', elev: -8 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 5, name: '2ND FL', elev: 9 },
    ],
    walls: [...wallsOf(3, 100, MAIN_W, DEPTH), ...wallsOf(5, 200, UPPER_W, DEPTH)],
    fenestrations: [],
    outlines: [
      ...(ghost ? [{ id: 1, levelId: 3, points: rect(MAIN_W, DEPTH) }] : []),
      { id: 2, levelId: 5, points: rect(UPPER_W, DEPTH) },
    ],
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

async function withLayoutSave(page, action) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await action();
  await page.waitForFunction(
    prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
}

// Place a viewport of one level and hand back the record that was written.
// The level is picked by `data-layout-level="<id>"`, the handle the page's own
// specs use — its LABEL is derived from level-assembly.js's storey table ("1
// MAIN FL"), so matching on the text would couple this spec to a naming rule
// that has nothing to do with what it is testing.
async function placedPif(page, levelId) {
  await page.locator(`[data-layout-level="${levelId}"]`).click();
  await page.locator('[data-layout-add-viewport]').click();
  await expect(page.locator('[data-layout-add-viewport]')).toContainText('CLICK THE SHEET');
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  await withLayoutSave(page, () =>
    page.mouse.click(box.x + box.width / 2, box.y + box.height / 2));
  const saved = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()) : null;
  }, BUCKET);
  const placed = (saved.layout?.viewports || []);
  return placed.length ? placed[placed.length - 1] : null;
}

test('a 2ND FL viewport is scaled to hold the floor below it', async ({ page }) => {
  await openLayout(page, twoStoreyDrawing());
  const withGhost = await placedPif(page, 5);
  expect(withGhost).toBeTruthy();
  expect(withGhost.levelId).toBe(5);

  // THE SAME PLACEMENT ON THE SAME SHEET WITH NO FLOOR BELOW. Without this
  // half the test would be asserting that 24 ft of house gets some scale or
  // other, which it would at any ladder step.
  await openLayout(page, twoStoreyDrawing({ ghost: false }));
  const withoutGhost = await placedPif(page, 5);
  expect(withoutGhost).toBeTruthy();

  // A SMALLER pif IS A SMALLER DRAWING ON THE PAPER: paper inches per model
  // foot, stepped down until the thing fits. The upper floor's own walls are
  // 24 ft; with the 64 ft floor below ghosted behind them the sheet has to
  // hold nearly three times the width, so the scale has to come down.
  expect(withGhost.pif).toBeLessThan(withoutGhost.pif);
});

test('a MAIN FL viewport is not scaled down for a foundation it does not ghost', async ({ page }) => {
  // THE CONTROL, and it is the one that would catch a rule that ghosted
  // ANYTHING below rather than the storey below. FOUNDATION carries no storey
  // number -- "a number here means a floor to stand on and they are not
  // floors" -- so it is never the floor below, and a main floor's scale must
  // be the same whether the drawing has a foundation outline or not.
  const withFoundation = twoStoreyDrawing();
  withFoundation.outlines.push({
    id: 3, levelId: 1, points: rect(MAIN_W * 2, DEPTH * 2),
  });
  await openLayout(page, withFoundation);
  const a = await placedPif(page, 3);

  await openLayout(page, twoStoreyDrawing());
  const b = await placedPif(page, 3);

  expect(a).toBeTruthy();
  expect(b).toBeTruthy();
  expect(a.levelId).toBe(3);
  expect(a.pif).toBe(b.pif);
});
