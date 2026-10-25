// COPY AND PASTE A VIEWPORT IN THE LAYOUT (Movie, 25 Oct): "IN THE LAYOUT
// Area i'd like to copy a layout viewport from one page and then paste it on a
// different page". COPY (or Ctrl+C) with a viewport selected; PASTE (or
// Ctrl+V) on whichever sheet is open puts a new viewport there -- the same
// drawing, scale, window and place -- selected; one UNDO takes it off.
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


async function pickViewport(page, vp) {
  await page.locator(`[data-layout-sheet="${vp.sheet || 1}"]`).click();
  const m = await sheetMetrics(page);
  await page.mouse.click(m.box.x + m.panX + vp.xIn * m.zoom, m.box.y + m.panY + vp.yIn * m.zoom);
  await expect(page.locator('[data-delete-viewport]')).toBeVisible();
}
const saveSeq = page => page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
const saved = async (page, after) => {
  await page.waitForFunction(p => Number(document.body.dataset.layoutSaveSeq || 0) > p, after);
  return savedLayout(page);
};
const same = v => { const { id, sheet, ...rest } = v; return rest; };

test('COPY on a selected viewport, PASTE on another sheet: the same viewport there, a new id, selected; UNDO takes it off', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const dealt = await savedLayout(page);
  const plan = dealt.viewports.find(v => v.kind === 'plan' && v.levelId === 3);
  const other = dealt.viewports.map(v => v.sheet || 1).find(s => s !== (plan.sheet || 1));
  await expect(page.locator('[data-paste-viewport]'), 'nothing held yet').toBeHidden();
  await pickViewport(page, plan);
  await expect(page.locator('[data-copy-viewport]')).toBeVisible();
  await page.locator('[data-copy-viewport]').click();
  await expect(page.locator('[data-paste-viewport]')).toBeVisible();
  await page.locator(`[data-layout-sheet="${other}"]`).click();
  const seq = await saveSeq(page);
  await page.locator('[data-paste-viewport]').click();
  const after = await saved(page, seq);
  expect(after.viewports).toHaveLength(dealt.viewports.length + 1);
  const pasted = after.viewports.find(v => !dealt.viewports.some(d => d.id === v.id));
  expect(pasted.sheet, 'on the sheet that is open').toBe(other);
  expect(same(pasted), 'the same drawing, scale, window and place').toEqual(same(plan));
  expect(pasted.id).toBeGreaterThan(Math.max(...dealt.viewports.map(v => v.id)));
  expect(after.viewports.find(v => v.id === plan.id), 'the first stays where it was').toEqual(plan);
  await expect(page.locator('[data-delete-viewport]'), 'the pasted one is selected').toBeVisible();
  const seq2 = await saveSeq(page);
  await page.keyboard.press('Escape');
  await page.locator('[data-undo]').click();
  expect((await saved(page, seq2)).viewports).toHaveLength(dealt.viewports.length);
});

test('Ctrl+C and Ctrl+V do the same; pasted onto its own sheet it stands half an inch off the one it copies', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const dealt = await savedLayout(page);
  const plan = dealt.viewports.find(v => v.kind === 'plan' && v.levelId === 3);
  await pickViewport(page, plan);
  await page.keyboard.press('Control+c');
  const seq = await saveSeq(page);
  await page.keyboard.press('Control+v');
  const after = await saved(page, seq);
  const pasted = after.viewports.find(v => !dealt.viewports.some(d => d.id === v.id));
  expect(pasted.sheet || 1).toBe(plan.sheet || 1);
  expect(pasted.xIn).toBeCloseTo(plan.xIn + 0.5, 6);
  expect(pasted.yIn).toBeCloseTo(plan.yIn + 0.5, 6);
  // AND AGAIN: the next one steps on past it.
  const seq2 = await saveSeq(page);
  await page.keyboard.press('Control+v');
  const again = (await saved(page, seq2)).viewports;
  expect(again).toHaveLength(dealt.viewports.length + 2);
  expect(Math.max(...again.map(v => v.xIn - plan.xIn))).toBeCloseTo(1, 6);
});

// LEFT OF THE BONE (Movie, 25 Oct, marked in GIMP): the commands that come
// up with a selected viewport -- and UNDO / REDO with them -- stand on the
// status row just left of the bone trio, not out at the right.
test('the commands stand on the status row just left of the bone, clear of it', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const plan = (await savedLayout(page)).viewports.find(v => v.kind === 'plan' && v.levelId === 3);
  await pickViewport(page, plan);
  await page.locator('[data-copy-viewport]').click();
  const box = sel => page.locator(sel).boundingBox();
  const [trio, row, undo, paste, edit] = await Promise.all([box('#dt-trio'), box('#lay-status-bar'),
    box('[data-undo]'), box('[data-paste-viewport]'), box('[data-edit-in-model]')]);
  const gap = trio.x - (paste.x + paste.width);
  expect(gap, 'the last command ends just short of the bone').toBeGreaterThanOrEqual(4);
  expect(gap).toBeLessThanOrEqual(30);
  expect(undo.x, 'UNDO leads the cluster').toBeLessThan(edit.x);
  for (const b of [undo, paste]) {
    expect(b.y + b.height / 2).toBeGreaterThan(row.y);
    expect(b.y + b.height / 2).toBeLessThan(row.y + row.height);
  }
  expect(undo.x, 'and clear of SAVED at the left').toBeGreaterThan(row.x + 120);
});
