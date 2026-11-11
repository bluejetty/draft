// THE TITLEBLOCK TEXT BOX, PRESSED AGAIN (jb, 10 Nov 2026): "this note is
// coming up when i click to change something on the text in titleblock,
// and then second time it is clear and seems to work as normal". The note
// was the crash card: "Failed to execute 'remove' on 'Element': The node
// to be removed is no longer a child of this node. Perhaps it was moved in
// a 'blur' event handler?" A press on the titleblock while a text box was
// still open took the old box out with remove(); Chrome blurs the box on
// its way out, the blur handler took it out a second time, and the first
// remove() found nothing left to remove. Now the old box is closed the
// way ENTER closes it (its words kept), and a new box opens clean.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });

function boneDrawing() {
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
      points: [{ x: -1.5, z: -1.5 }, { x: 37.5, z: -1.5 }, { x: 37.5, z: 27.5 }, { x: -1.5, z: 27.5 }],
      edges: ['eave', 'gable', 'eave', 'gable'],
    }],
    cuts: [],
    fenestrations: [],
    layout: { auto: true },
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

async function deskPoint(page, xIn, yIn) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const [zoom, panX, panY] = (await page.evaluate(() => document.body.dataset.layoutView)).split(',').map(Number);
  return [box.x + panX + xIn * zoom, box.y + panY + yIn * zoom];
}
const hitOf = (page, key) => page.evaluate(k => JSON.parse(document.body.dataset[k] || 'null'), key);
const centre = r => [r.xIn + r.wIn / 2, r.yIn + r.hIn / 2];
// The names run up the titleblock's edge and the text box lies across their
// middle, so a second press lands lower down the name, clear of the box.
const below = ([x, y]) => [x, y + 30];

const storedName = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text()).projectInfo?.name || '';
}, BUCKET);

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on('pageerror', err => page.errors.push(String(err && err.message || err)));
});

test('pressing the project name while its text box is open crashes nothing and keeps the words', async ({ page }) => {
  await openLayout(page, boneDrawing());
  const pj = await hitOf(page, 'layoutProjectHit');
  expect(pj, 'the strip says where the project name is').toBeTruthy();
  const at = await deskPoint(page, ...centre(pj));
  await page.mouse.click(...at);
  const box = page.locator('#lay-rename[data-project-rename]');
  await expect(box).toBeVisible();
  await expect(box).toBeFocused();
  await box.fill('Maple Court');
  // The second press, with the first box still open and focused.
  await page.mouse.click(...below(at));
  await expect(page.locator('[data-error-report]'), 'no crash card').toHaveCount(0);
  expect(page.errors, 'no uncaught error').toEqual([]);
  await expect(page.locator('#lay-rename[data-project-rename]')).toBeVisible();
  await expect(page.locator('#lay-rename')).toHaveCount(1);
  await expect.poll(() => storedName(page), { timeout: 10000 }).toBe('Maple Court');
  await expect(page.locator('#lay-rename')).toHaveValue('Maple Court');
});

test('pressing the sheet title while the project name box is open closes one and opens the other', async ({ page }) => {
  await openLayout(page, boneDrawing());
  const pj = await hitOf(page, 'layoutProjectHit');
  const t = await hitOf(page, 'layoutTitleHit');
  expect(pj && t, 'the strip says where both names are').toBeTruthy();
  await page.mouse.click(...await deskPoint(page, ...centre(pj)));
  await expect(page.locator('#lay-rename[data-project-rename]')).toBeFocused();
  await page.locator('#lay-rename').fill('Elm Street');
  await page.mouse.click(...below(await deskPoint(page, ...centre(t))));
  await expect(page.locator('[data-error-report]'), 'no crash card').toHaveCount(0);
  expect(page.errors, 'no uncaught error').toEqual([]);
  await expect(page.locator('#lay-rename[data-sheet-rename]')).toBeVisible();
  await expect(page.locator('#lay-rename')).toHaveCount(1);
  await expect.poll(() => storedName(page), { timeout: 10000 }).toBe('Elm Street');
  await page.keyboard.press('Escape');
  await expect(page.locator('#lay-rename')).toHaveCount(0);
});
