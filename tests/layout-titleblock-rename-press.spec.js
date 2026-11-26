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

// THE PROJECT NAME OPENS PROJECT INFO NOW (jb, 26 Nov 2026): "when the user
// clicks on anything in the titleblock that is referenced from the project
// info tab, open the tab and allow the user to change the info in the tab".
// The crash above was a rename box shut inside its own blur; the project's
// words have no rename box any more, but the sheet title still does, so a
// press on it while a PROJECT INFO box is mid-word must still crash nothing
// and keep the words.
const storedInfo = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text()).projectInfo || {};
}, BUCKET);

test('pressing the project name opens PROJECT INFO on the name box, and a press elsewhere crashes nothing', async ({ page }) => {
  await openLayout(page, boneDrawing());
  const pj = await hitOf(page, 'layoutProjectHit');
  expect(pj, 'the strip says where the project name is').toBeTruthy();
  const at = await deskPoint(page, ...centre(pj));
  await page.mouse.click(...at);
  await expect(page.locator('#projinfo')).toBeVisible();
  await expect(page.locator('#projinfo-tab')).toHaveAttribute('aria-expanded', 'true');
  const box = page.locator('#projinfo [data-pi="name"]');
  await expect(box).toBeFocused();
  await box.fill('Maple Court');
  // The second press, with the box still focused and mid-word.
  await page.mouse.click(...below(at));
  await expect(page.locator('[data-error-report]'), 'no crash card').toHaveCount(0);
  expect(page.errors, 'no uncaught error').toEqual([]);
  await expect(page.locator('#projinfo [data-pi="name"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => storedName(page), { timeout: 10000 }).toBe('Maple Court');
  await expect(page.locator('#lay-rename')).toHaveCount(0);
});

test('pressing the sheet title while a PROJECT INFO box is mid-word keeps the words and opens the title box', async ({ page }) => {
  await openLayout(page, boneDrawing());
  const pj = await hitOf(page, 'layoutProjectHit');
  const t = await hitOf(page, 'layoutTitleHit');
  expect(pj && t, 'the strip says where both names are').toBeTruthy();
  await page.mouse.click(...await deskPoint(page, ...centre(pj)));
  await expect(page.locator('#projinfo [data-pi="name"]')).toBeFocused();
  await page.locator('#projinfo [data-pi="name"]').fill('Elm Street');
  await page.mouse.click(...below(await deskPoint(page, ...centre(t))));
  await expect(page.locator('[data-error-report]'), 'no crash card').toHaveCount(0);
  expect(page.errors, 'no uncaught error').toEqual([]);
  await expect(page.locator('#lay-rename[data-sheet-rename]')).toBeVisible();
  await expect.poll(() => storedName(page), { timeout: 10000 }).toBe('Elm Street');
  await page.keyboard.press('Escape');
  await expect(page.locator('#lay-rename')).toHaveCount(0);
});

test('each PROJECT INFO word on the titleblock opens the tab on its own box; typing repaints, letting go saves', async ({ page }) => {
  await openLayout(page, boneDrawing());
  const hits = await hitOf(page, 'layoutFieldHits');
  const keys = hits.map(r => r.key);
  expect(keys).toEqual(expect.arrayContaining(['address', 'client', 'projectNumber', 'drafterName', 'checkedBy']));
  // Nothing that is not PROJECT INFO's: DATE, SCALE and REVISION fill themselves.
  expect(keys.every(k => ['address', 'client', 'projectNumber', 'drafterName', 'checkedBy'].includes(k))).toBe(true);
  const words = { address: '412 MAPLE CREST BAY', client: 'J. THOMPSON', projectNumber: '2026-014', checkedBy: 'K. LEE' };
  const infoKey = { address: 'address', client: 'owner', projectNumber: 'projectNumber', checkedBy: 'checkedBy', drafterName: 'drafterName' };
  for (const [key, value] of Object.entries(words)) {
    const r = hits.find(h => h.key === key);
    await page.mouse.click(...await deskPoint(page, ...centre(r)));
    const box = page.locator(`#projinfo [data-pi="${key}"]`);
    await expect(box, key).toBeFocused();
    await box.fill(value);
    // LIVE: the sheet reads the words before the box is let go.
    expect(await page.evaluate(k => page._titleblockInfo()[k], infoKey[key])).toBe(value);
    await page.keyboard.press('Enter');
  }
  await expect.poll(async () => {
    const info = await storedInfo(page);
    return [info.address, info.client, info.projectNumber, info.checkedBy];
  }, { timeout: 10000 }).toEqual([words.address, words.client, words.projectNumber, words.checkedBy]);
  // DRAFT BY is SETTINGS': it lands in the settings package, every project.
  const d = hits.find(h => h.key === 'drafterName');
  await page.mouse.click(...await deskPoint(page, ...centre(d)));
  await expect(page.locator('#projinfo [data-pi="drafterName"]')).toBeFocused();
  await page.locator('#projinfo [data-pi="drafterName"]').fill('J. BLUE');
  expect(await page.evaluate(() => page._titleblockInfo().drafterName)).toBe('J. BLUE');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.DraftProfileManager.getActive('settings')?.content?.model?.drafter?.name)).toBe('J. BLUE');
  await expect(page.locator('[data-error-report]')).toHaveCount(0);
  expect(page.errors).toEqual([]);
  // AND PROJECT READS THE SAME WORDS, in the same tab.
  await page.goto('/PROJECT.html?info=1');
  await expect(page.locator('#projinfo [data-pi="client"]')).toHaveValue(words.client);
  await expect(page.locator('#projinfo [data-pi="checkedBy"]')).toHaveValue(words.checkedBy);
});
