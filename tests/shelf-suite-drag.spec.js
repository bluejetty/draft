// A SHELF SQUARE DRAGGED ONTO THE PLAN, AND THE TWO BUTTONS BESIDE THE TAB
// (Movie, 23 Oct): "ADD 2 buttons ... on either side of the SHELF tab (about
// the same size) the left one says OPEN SUITE and right one SAVE AS SUITE"
// -- "will only be on when they are in a SHELF view in the main area" --
// "and if they click and hold to drag one a suite layout view, can we allow
// them to DRAG that suite (when they are on a FLOOR PLAN main view - not
// ELEVATIONS) DRAG the suite and position it on the plan they are viewing"
// -- "the DRAG won't work unless they are in a FLOOR PLAN type main area".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], holograms: [] };
// 2x4 centred walls: 3.5" thick, each outside face 1.75" off the line.
const F = 1.75 / 12;
const W = (id, a, b, levelId) => ({ id, start: P(...a), end: P(...b), levelId, view: 'plan',
  wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 });
const box = (id, x, z, w, d, levelId) => [W(`${id}n`, [x, z], [x + w, z], levelId), W(`${id}e`, [x + w, z], [x + w, z + d], levelId),
  W(`${id}s`, [x + w, z + d], [x, z + d], levelId), W(`${id}w`, [x, z + d], [x, z], levelId)];
// The house on MAIN FL; 1BDEN (a 20 x 12 box) on shelf 1, 2BD on shelf 2.
const drawing = () => ({ version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [...box('h', 0, 0, 60, 40, 3), ...box('s1', 100, 40, 20, 12, -1), ...box('s2', 0, 0, 24, 12, -2)],
  boneyardShelves: [{ id: 1, name: '1BDEN' }, { id: 2, name: '2BD' }],
  nextBoneyardShelfId: 3, activeBoneyardShelfId: 1, nextDrawingItemId: 60 });

async function open(page, url = '/MODEL.html?level=3&right=1') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  if (await page.locator('#shelf-previews').isHidden()) await page.locator('#shelf-tab').click();
  await expect(page.locator('.shelf-preview')).toHaveCount(2);
}
const square = (page, i) => page.locator('.shelf-preview').nth(i);
const centre = async loc => { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
// Press and hold a square, then carry it to a screen point and let go.
async function drag(page, i, to, { release = true } = {}) {
  const [sx, sy] = await centre(square(page, i));
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 10, sy - 10, { steps: 3 });
  await page.mouse.move(to[0], to[1], { steps: 8 });
  await page.waitForTimeout(80);
  if (release) { await page.mouse.up(); await page.waitForTimeout(120); }
}

test('OPEN SUITE and SAVE AS SUITE stand either side of the SHELVES tab, its size, only while the sheet shows a shelf', async ({ page }) => {
  await open(page);
  const openB = page.locator('#shelf-open-suite'), saveB = page.locator('#shelf-save-suite'), tab = page.locator('#shelf-tab');
  await expect(openB, 'not on MAIN FL').toBeHidden();
  await expect(saveB).toBeHidden();
  await square(page, 0).click();
  await expect(page.locator('[data-shelf="1"]')).toHaveAttribute('data-active', '');
  await expect(openB).toBeVisible();
  await expect(saveB).toBeVisible();
  await expect(openB).toHaveText('OPEN SHELF');
  await expect(saveB).toHaveText('SAVE SHELF');
  // + ADD SHELF SQUEEZED IN between OPEN SHELF and the tab (jb, 10 Nov),
  // the LEVELS pane's + SHELF press: a new shelf, stood on.
  const addB = page.locator('#shelf-add');
  await expect(addB).toHaveText('+ ADD SHELF');
  const [ab, tb0] = await Promise.all([addB.boundingBox(), tab.boundingBox()]);
  expect(ab.x, 'right of OPEN SHELF').toBeGreaterThanOrEqual((await openB.boundingBox()).x);
  expect(ab.x + ab.width, 'left of the tab').toBeLessThanOrEqual(tb0.x);
  const before = await page.locator('[data-shelf]').count();
  await addB.click();
  await expect(page.locator('[data-shelf]')).toHaveCount(before + 1);
  await expect(page.locator('[data-shelf]').last(), 'the new shelf, stood on').toHaveAttribute('data-active', '');
  await square(page, 0).click();
  await expect(page.locator('[data-shelf="1"]')).toHaveAttribute('data-active', '');
  const [o, t, s, bone] = await Promise.all([openB.boundingBox(), tab.boundingBox(), saveB.boundingBox(), page.locator('#bone').boundingBox()]);
  expect(o.x + o.width, 'OPEN SUITE left of the tab').toBeLessThanOrEqual(t.x);
  expect(s.x, 'SAVE AS SUITE right of it').toBeGreaterThanOrEqual(t.x + t.width);
  expect(Math.abs(o.height - t.height), 'the tab\'s own height').toBeLessThan(1);
  expect(Math.abs(s.height - t.height)).toBeLessThan(1);
  expect(Math.abs((t.x + t.width / 2) - (bone.x + bone.width / 2)), 'the tab still centred on the bone').toBeLessThan(2);
  // THE PRESSES ARE THE RAIL'S OWN: the kind question, and a file picker.
  await saveB.click();
  await expect(page.locator('#shelf-suite')).toBeVisible();
  await expect(page.locator('[data-shelf-suite-name]')).toHaveText('1BDEN');
  await page.locator('[data-shelf-suite-cancel]').click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), openB.click()]);
  expect(chooser).toBeTruthy();
});

test('press and hold a square and drag it onto MAIN FL: the suite comes down by its gold corner where the hand lets go; one UNDO takes it off; the sheet stays on MAIN FL', async ({ page }) => {
  await open(page);
  const { at, cx, cz, scale, box } = await h.planFrame(page);
  const to = at(30, 20);
  await drag(page, 0, to);
  await expect(page.locator('#strip-message')).toContainText('is down');
  await expect(page.locator('[data-shelf="1"]'), 'the press did not enter the shelf').not.toHaveAttribute('data-active', '');
  const d = await saved(page);
  expect(d.holograms).toHaveLength(1);
  expect(d.holograms[0].name).toBe('1BDEN');
  const nodes = await page.evaluate(hg => window.DraftHologram.suiteSuperNodes(hg, 3), d.holograms[0]);
  expect(nodes, 'a suite, with its four corners').toHaveLength(4);
  const gold = nodes.find(n => n.registration);
  expect(gold, 'one of them the registration corner').toBeTruthy();
  const world = { x: (to[0] - box.x - box.width / 2) / scale + cx, z: (to[1] - box.y - box.height / 2) / scale + cz };
  expect(Math.abs(gold.point.x - world.x), 'carried by its gold corner').toBeLessThan(0.05);
  expect(Math.abs(gold.point.z - world.z)).toBeLessThan(0.05);
  await page.keyboard.press('Control+z');
  expect((await saved(page)).holograms, 'one UNDO and it is off').toHaveLength(0);
});

test('on an elevation or standing on a shelf, the drag does nothing and the strip says stand on a level', async ({ page }) => {
  await open(page);
  await page.locator('.seat[data-seat="E1"]').click();
  await expect(page.locator('#north-hit')).toBeHidden();
  await drag(page, 0, [640, 300]);
  await expect(page.locator('#strip-message')).toContainText('stand on a level');
  expect((await saved(page)).holograms).toHaveLength(0);
  await open(page);
  await square(page, 0).click();
  await expect(page.locator('[data-shelf="1"]')).toHaveAttribute('data-active', '');
  await drag(page, 1, [640, 300]);
  await expect(page.locator('#strip-message')).toContainText('stand on a level');
  expect((await saved(page)).holograms).toHaveLength(0);
});

// jb, 11 Nov 2026: "could we make an additional option to add a 'hologram'
// by grabbing a 'shelf' and dragging it into the model space and dropping
// it". A suite's shelf dragged onto the SITE (any level that is not one of
// the house's floors) comes down as a generic HOLOGRAM where the hand lets
// go, no floor rules; one UNDO takes it off.
test('on the SITE a suite shelf drops as a HOLOGRAM where the hand lets go', async ({ page }) => {
  await open(page, '/MODEL.html?level=8&right=1');
  const { at } = await h.planFrame(page);
  await drag(page, 0, at(30, 20), { release: false });
  await expect(page.locator('#strip-message')).toContainText('HOLOGRAM');
  await page.mouse.up();
  await page.waitForTimeout(120);
  const file = await saved(page);
  expect(file.holograms).toHaveLength(1);
  const [holo] = file.holograms;
  expect(holo.name).toBe('1BDEN');
  expect(holo.source.suiteKind, 'the generic kind: no suite rules').toBeUndefined();
  expect(holo.source.shelfKind).toBe('hologram');
  expect(holo.source.walls.map(w => w.id).sort()).toEqual(['s1e', 's1n', 's1s', 's1w']);
  // IT IS ON THE SITE, carried by the middle of its walls (no gold corner on
  // a generic hologram): the 20 x 12 box at (100..120, 40..52) lands centred
  // on the hand at (30, 20).
  expect(holo.levelMap).toEqual({ '-1': 8 });
  expect(holo.x).toBeCloseTo(30 - 110, 1);
  expect(holo.z).toBeCloseTo(20 - 46, 1);
  // AND ITS WALLS ARE DRAWN THERE: the SITE pass never drew a wall before,
  // so a shelf of walls came down invisible. Pixels on its north wall that
  // are not the paper's (the paper read a few feet above the wall, whatever
  // the skin), in either theme.
  const ink = await page.evaluate(() => {
    const c = document.getElementById('plan');
    const [cx, cz, scale] = c.dataset.view.trim().split(/\s+/).map(Number);
    const sx = x => c.width / 2 + (x - cx) * scale, sz = z => c.height / 2 + (z - cz) * scale;
    const g = c.getContext('2d');
    const paper = Array.from(g.getImageData(Math.round(sx(30)), Math.round(sz(8)), 1, 1).data);
    const d = g.getImageData(Math.round(sx(30)) - 2, Math.round(sz(14)) - 2, 5, 5).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - paper[0]) + Math.abs(d[i + 1] - paper[1]) + Math.abs(d[i + 2] - paper[2]) > 60) n++;
    }
    return n;
  });
  expect(ink, 'the north wall is inked').toBeGreaterThan(0);
  await page.keyboard.press('Control+z');
  expect((await saved(page)).holograms, 'one UNDO and it is off').toHaveLength(0);
});

test('Esc while it is in hand takes it back off the sheet', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await drag(page, 0, at(30, 20), { release: false });
  await expect(page.locator('#strip-message')).toContainText('in hand');
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await page.waitForTimeout(120);
  expect((await saved(page)).holograms).toHaveLength(0);
});
