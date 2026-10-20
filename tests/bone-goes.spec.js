// THE BONE ON AN ELEVATION GOES TO EXT FINISH; ON A SECTION, TO PROJECT.
//
// Movie, 20 Oct: "maybe pressing the BONE in elevations should take them over
// to the EXT FINISH area ... the autohouse BONE in the ELEVATIONS doesn't seem
// right", and "take them over to PROJECT fom SECTIONS if they press the bone
// in the sections area". An empty file keeps the drive-thru ("good idea"),
// and EXT FINISH opens on the elevation the bone was pressed on ("ok").
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const W = (id, a, b) => ({ id, start: P(...a), end: P(...b), levelId: 3, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const drawing = walls => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  walls,
  cuts: [{ id: 'S1', name: 'S1', elev: 0, levelId: null,
    startPt: { x: -20, z: 5 }, endPt: { x: 20, z: 5 }, dirVec: { x: 0, z: 1 } }],
  fenestrations: [], lines: [], fixtures: [], dimensions: [], floors: [], roofs: [], outlines: [],
  shapes: [], surfaceOpenings: [], notes: [], stairs: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});
const HOUSE = [W('n', [0, 0], [20, 0]), W('e', [20, 0], [20, 10]), W('s', [20, 10], [0, 10]), W('w', [0, 10], [0, 0])];

async function openOn(page, view, walls = HOUSE) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing(walls) });
  await page.goto(`/MODEL.html?view=${encodeURIComponent(view)}`);
  await expect(page.locator('#readout')).not.toHaveText('', { timeout: 10000 });
  await page.waitForTimeout(300);
}

test('on E3 the bone wears EXT. FINISH and walks there, onto E3', async ({ page }) => {
  await openOn(page, 'cut:E3');
  const bone = page.locator('#bone');
  await expect(bone).toHaveAttribute('data-bone-goes', 'EXT. FINISH');
  await bone.click();
  await page.waitForURL(/EXTFINISH\.html\?elev=E3/);
  await expect(page.locator('[data-elev="E3"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-elev="E1"]')).toHaveAttribute('aria-pressed', 'false');
});

test('on a section the bone walks to PROJECT', async ({ page }) => {
  await openOn(page, 'cut:S1');
  const bone = page.locator('#bone');
  await expect(bone).toHaveAttribute('data-bone-goes', 'PROJECT');
  await bone.click();
  await page.waitForURL(/PROJECT\.html/);
});

test('on the plan the bone is the drive-thru as it always was', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing(HOUSE) });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const bone = page.locator('#bone');
  await expect(bone).not.toHaveAttribute('data-bone-goes', /.*/);
  await bone.click();
  await page.waitForTimeout(400);
  expect(page.url()).toContain('/MODEL.html');
});

test('back on the plan from an elevation, the tag comes off', async ({ page }) => {
  await openOn(page, 'cut:E1');
  const bone = page.locator('#bone');
  await expect(bone).toHaveAttribute('data-bone-goes', 'EXT. FINISH');
  await h.pickModelLevel(page, 3);
  await expect(bone).not.toHaveAttribute('data-bone-goes', /.*/);
});

test('an empty file still gets the drive-thru, even on a section -- nothing to finish yet', async ({ page }) => {
  await openOn(page, 'cut:S1', []);
  const bone = page.locator('#bone');
  await expect(bone).not.toHaveAttribute('data-bone-goes', /.*/);
  await bone.click();
  await page.waitForTimeout(400);
  expect(page.url()).toContain('/MODEL.html');
});

test('EXT FINISH ignores an elevation it does not know and opens on E1', async ({ page }) => {
  await openOn(page, 'cut:E1');
  await page.goto('/EXTFINISH.html?elev=E9');
  await expect(page.locator('[data-elev="E1"]')).toHaveAttribute('aria-pressed', 'true');
});
