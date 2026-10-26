// THE BONEYARD AS A MINI MODEL AREA: shelves renamed, a shelf saved as its own
// SUITE .draft, and a suite put back on a shelf to change.
//
// Movie, 20 Oct: "can you allow the SHELF 01 ... etc shelfs be RENAMable so if
// i double click on SHELF1 name it will allow me to rename it (2 BEDROOM in
// this case)" -- "ALLOW users to use the BONEYARD - as a little mini model area
// and they can independanatly SAVE whatever is in there as a SUITE. (but a
// draft file) and will only ever be in the SHELVES, so a user can build them in
// any BONEYARD in any draft file, and save them as a DRAFT file... and they can
// also use that area to modify the SUITES for the existing SHELL".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
// THE SHELL on MAIN FL; a 20 x 15 suite drawn on SHELF 1, a window in it;
// and a line parked on SHELF 2 that must not go with SHELF 1.
const drawing = () => ({ version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('a', [0, 0], [60, 0], 3), W('b', [60, 0], [60, 30], 3),
    W('s1', [0, 0], [20, 0], -1), W('s2', [20, 0], [20, 15], -1), W('s3', [20, 15], [0, 15], -1), W('s4', [0, 15], [0, 0], -1)],
  fenestrations: [{ id: 'w1', wallId: 's1', levelId: -1, view: 'plan', type: 'window', offset: 8, width: 4, sillHeight: 3, headHeight: 6.67 },
    { id: 'pub', wallId: 'a', levelId: 3, view: 'plan', type: 'window', offset: 40, width: 4, sillHeight: 3, headHeight: 6.67 }],
  lines: [{ id: 'l2', start: { x: 0, y: 0, z: 40 }, end: { x: 10, y: 0, z: 40 }, levelId: -2, view: 'plan' }],
  boneyardShelves: [{ id: 1, name: 'SHELF 1' }, { id: 2, name: 'SHELF 2' }], nextBoneyardShelfId: 3,
  activeBoneyardShelfId: 1 });

async function open(page, f = drawing()) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  // NO FILE PICKER, so a save is a download the test can read.
  await page.addInitScript(() => { try { delete window.showSaveFilePicker; } catch { window.showSaveFilePicker = undefined; } });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=3&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openModelRail(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
const shelf = (page, id) => page.locator(`[data-shelf="${id}"]`);

test('a double-click on a shelf renames it; ENTER keeps the name, and it saves', async ({ page }) => {
  await open(page);
  await shelf(page, 1).dblclick();
  const box = page.locator('[data-shelf-name="1"]');
  await expect(box).toBeVisible();
  await box.fill('2 bedroom');
  await box.press('Enter');
  await expect(shelf(page, 1)).toHaveText('2 BEDROOM');
  const d = await saved(page);
  expect(d.boneyardShelves.find(s => s.id === 1).name).toBe('2 BEDROOM');
  // Esc keeps the old name.
  await shelf(page, 2).dblclick();
  await page.locator('[data-shelf-name="2"]').fill('NOPE');
  await page.locator('[data-shelf-name="2"]').press('Escape');
  await expect(shelf(page, 2)).toHaveText('SHELF 2');
});

test('SAVE AS SUITE writes only the shelf, as a suite of the kind picked, named for the shelf', async ({ page }) => {
  await open(page);
  await shelf(page, 1).dblclick();
  await page.locator('[data-shelf-name="1"]').fill('2 BEDROOM');
  await page.locator('[data-shelf-name="1"]').press('Enter');
  await shelf(page, 1).click();
  const button = page.locator('[data-save-shelf]');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator('#shelf-suite')).toBeVisible();
  await expect(page.locator('#shelf-suite')).toContainText('2 BEDROOM');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-shelf-suite-kind="residential"]').click(),
  ]);
  expect(download.suggestedFilename()).toBe('2 BEDROOM.draft');
  const file = JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
  expect(file.suiteKind).toBe('residential');
  expect(file.walls.map(w => w.id).sort(), 'the shelf\'s walls only').toEqual(['s1', 's2', 's3', 's4']);
  expect(file.fenestrations.map(o => o.id), 'and its window, not the shell\'s').toEqual(['w1']);
  expect(file.lines, 'nothing from the other shelf').toHaveLength(0);
  expect(file.boneyardShelves).toEqual([{ id: 1, name: '2 BEDROOM' }]);
  expect(file.holograms).toEqual([]);
});

test('the saved shelf comes into another plan as a suite, standing on its floor', async ({ page }) => {
  await open(page);
  await shelf(page, 1).click();
  await page.locator('[data-save-shelf]').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-shelf-suite-kind="commercial"]').click(),
  ]);
  const text = require('fs').readFileSync(await download.path(), 'utf8');
  // INTO A PLAN WITH NOTHING ON ITS SHELVES.
  const plan = { ...drawing(), walls: drawing().walls.filter(w => w.levelId === 3), fenestrations: [], lines: [] };
  await open(page, plan);
  await page.locator('[data-mode-hologram]').click();
  await page.locator('[data-hologram-ask-upload]').click();
  await page.locator('[data-hologram-file]').setInputFiles({ name: 'SHELF 1.draft', mimeType: 'application/json', buffer: Buffer.from(text) });
  await page.keyboard.press('Escape');
  const d = await saved(page);
  expect(d.holograms).toHaveLength(1);
  expect(d.holograms[0].source.suiteKind).toBe('commercial');
  expect(d.holograms[0].source.walls.map(w => w.levelId), 'on MAIN FL').toEqual([3, 3, 3, 3]);
});

test('EDIT ON SHELF puts a suite\'s drawing on a new shelf named for it, its window on its wall', async ({ page }) => {
  const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY, suiteKind: 'residential',
    walls: [W('s1', [0, 0], [20, 0], 3), W('s2', [20, 0], [20, 15], 3)],
    fenestrations: [{ id: 'w1', wallId: 's1', levelId: 3, view: 'plan', type: 'window', offset: 8, width: 4, sillHeight: 3, headHeight: 6.67 }] };
  const plan = { ...drawing(), walls: drawing().walls.filter(w => w.levelId === 3), fenestrations: [], lines: [],
    holograms: [{ id: 'h1', name: '2 bedroom', mode: 'suite', x: 0, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 7.5, source: SUITE }] };
  await open(page, plan);
  await page.locator('[data-mode-hologram]').click();
  await page.locator('[data-hologram-edit-shelf="h1"]').click();
  await expect(page.locator('[data-shelf="3"]')).toHaveText('2 BEDROOM');
  const d = await saved(page);
  const onShelf = d.walls.filter(w => w.levelId === -3);
  expect(onShelf).toHaveLength(2);
  const win = d.fenestrations.find(o => o.levelId === -3);
  expect(win, 'its window came').toBeTruthy();
  expect(onShelf.map(w => String(w.id)), 'on its own wall\'s copy').toContain(String(win.wallId));
  expect(d.holograms, 'the hologram stays as it was').toHaveLength(1);
});

// OPEN SUITE (Movie, 21 Oct: "where a suite will open in the shelf and i can
// put all the SUITES in the same file as the SHELL and go into the SHELFS if i
// need to edit them").
test('OPEN SUITE opens a suite file onto a new shelf named for it, kept in this drawing', async ({ page }) => {
  const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY, suiteKind: 'residential',
    walls: [W('s1', [0, 0], [20, 0], 3), W('s2', [20, 0], [20, 15], 3)],
    fenestrations: [{ id: 'w1', wallId: 's1', levelId: 3, view: 'plan', type: 'window', offset: 8, width: 4, sillHeight: 3, headHeight: 6.67 }] };
  await open(page);
  const button = page.locator('[data-open-shelf-suite]');
  await expect(button, 'beside SAVE AS SUITE, even off the BONEYARD').toBeVisible();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()]);
  await chooser.setFiles({ name: '3 bedroom.draft', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(SUITE)) });
  await expect(page.locator('[data-shelf="3"]')).toHaveText('3 BEDROOM');
  await expect(page.locator('[data-shelf="3"]')).toHaveAttribute('data-active', '');
  const d = await saved(page);
  const onShelf = d.walls.filter(w => w.levelId === -3);
  expect(onShelf).toHaveLength(2);
  const win = d.fenestrations.find(o => o.levelId === -3);
  expect(onShelf.map(w => String(w.id)), 'its window on its own wall\'s copy').toContain(String(win && win.wallId));
  expect(d.walls.filter(w => w.levelId === 3), 'the shell untouched').toHaveLength(2);
  expect(d.holograms || [], 'no hologram made').toHaveLength(0);
});
