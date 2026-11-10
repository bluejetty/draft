// A SHELF SAVED AS A HOLOGRAM, THE GENERIC KIND (jb, 10 Nov 2026).
//
// "i tried to draw the 'building outline' on a shelf saved it as a
// residential suite and then want to bring it in as a hologram, but doesn't
// seem to show on the site plan" -- "residential suite and commercial suite
// are designed to do a certain thing" -- "how about instead of 'suite we
// call it a 'HOLOGRAM' ... they can create whatever they want and place it
// whereever they want 'generic version'" -- "options for SHELF so far:
// Residential Suite / Commercial Suite / Hologram that's it right".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], holograms: [] };
// A BUILDING OUTLINE TRACED ON SHELF 1: a master on the shelf (what the
// OUTLINE tool writes there), with its copies on the drawing's levels.
const MASTER = { id: 'm1', shelfId: 1, sourceLevelId: -1, garage: false, open: false, detached: false, foundation: null,
  points: [{ id: 'p1', x: 10, z: 10 }, { id: 'p2', x: 50, z: 10 }, { id: 'p3', x: 50, z: 40 }, { id: 'p4', x: 10, z: 40 }], marks: [] };
const copy = level => ({ id: `c${level.id}`, masterId: 'm1', levelId: level.id, garage: false, open: false, detached: false,
  foundation: null, points: MASTER.points.map(p => ({ x: p.x, y: level.elev, z: p.z, srcId: p.id, bulge: 0, attach: null })),
  overriddenSrcIds: [], layer: 'OUTLINE' });
const LOT = { id: 'lot', masterId: null, levelId: 8, garage: false, site: true, detached: false, foundation: null,
  points: [P(0, 0), P(100, 0), P(100, 120), P(0, 120)], overriddenSrcIds: [] };
// A standalone SITE PLAN with the lot, and the outline drawn on SHELF 1.
const sitePlan = () => ({ version: 1, planTurn: 0, levels: LEVELS, activeLevelIdx: 0, standalone: 'site', ...EMPTY,
  outlines: [LOT, ...LEVELS.map(copy)], boneyardOutlines: [MASTER],
  lines: [{ id: 'l1', start: P(10, 50), end: P(50, 50), levelId: -1, view: 'plan' }],
  boneyardShelves: [{ id: 1, name: 'SHELF 1' }], nextBoneyardShelfId: 2, activeBoneyardShelfId: 1, nextDrawingItemId: 60 });

async function open(page, f, url) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.addInitScript(() => { try { delete window.showSaveFilePicker; } catch { window.showSaveFilePicker = undefined; } });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
// STAND ON SHELF 1 (its square on the strip), SAVE it as `kind`, and read
// the file back.
async function saveShelfAs(page, kind) {
  if (await page.locator('#shelf-previews').isHidden()) await page.locator('#shelf-tab').click();
  await page.locator('.shelf-preview').first().click();
  await expect(page.locator('#shelf-save-suite')).toBeVisible();
  await page.locator('#shelf-save-suite').click();
  await expect(page.locator('#shelf-suite')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator(`[data-shelf-suite-kind="${kind}"]`).click(),
  ]);
  return JSON.parse(require('fs').readFileSync(await download.path(), 'utf8'));
}
async function bringIn(page, file, name = 'SHELF 1.draft') {
  await page.locator('[data-mode-hologram]').click();
  await page.locator('[data-hologram-ask-upload]').click();
  await page.locator('[data-hologram-file]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
}
// Ink along the outline's top edge on the plan canvas (it is a dashed
// stroke, not a fill), as the share of pixels that are not the paper's.
const inkInside = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const [cx, cz, scale] = c.dataset.view.trim().split(/\s+/).map(Number);
  const dpr = c.width / c.clientWidth;
  const at = (x, z) => ({ x: (c.clientWidth / 2 + (x - cx) * scale) * dpr, y: (c.clientHeight / 2 + (z - cz) * scale) * dpr });
  const a = at(12, 8.5), b = at(48, 11.5);
  const ctx = c.getContext('2d');
  const img = ctx.getImageData(Math.round(a.x), Math.round(a.y), Math.max(1, Math.round(b.x - a.x)), Math.max(1, Math.round(b.y - a.y))).data;
  const paper = ctx.getImageData(Math.round(at(2, 2).x), Math.round(at(2, 2).y), 1, 1).data;
  let dark = 0;
  for (let i = 0; i < img.length; i += 4) {
    if (Math.abs(img[i] - paper[0]) + Math.abs(img[i + 1] - paper[1]) + Math.abs(img[i + 2] - paper[2]) > 60) dark++;
  }
  return dark / (img.length / 4);
});

test('the shelf saves as RESIDENTIAL SUITE, COMMERCIAL SUITE or HOLOGRAM, and its outline goes into the file', async ({ page }) => {
  await open(page, sitePlan(), '/MODEL.html?level=8&left=1');
  if (await page.locator('#shelf-previews').isHidden()) await page.locator('#shelf-tab').click();
  await page.locator('.shelf-preview').first().click();
  await page.locator('#shelf-save-suite').click();
  await expect(page.locator('#shelf-suite')).toBeVisible();
  await expect(page.locator('#shelf-suite [data-shelf-suite-kind]')).toHaveText(['RESIDENTIAL SUITE', 'COMMERCIAL SUITE', 'HOLOGRAM']);
  await page.locator('[data-shelf-suite-cancel]').click();
  // HOLOGRAM: the generic kind, no suiteKind at all.
  const holo = await saveShelfAs(page, 'hologram');
  expect(holo.shelfKind).toBe('hologram');
  expect(holo).not.toHaveProperty('suiteKind');
  expect(holo.outlines.map(o => [o.levelId, o.masterId]), 'the shelf\'s traced outline, filed on the shelf, not the lot').toEqual([[-1, 'm1']]);
  expect(holo.outlines[0].points.map(p => [p.x, p.z])).toEqual([[10, 10], [50, 10], [50, 40], [10, 40]]);
  expect(holo.lines.map(l => l.id)).toEqual(['l1']);
  expect(holo.boneyardOutlines).toEqual([]);
  // A SUITE still says its kind, and carries the outline too.
  const suite = await saveShelfAs(page, 'residential');
  expect([suite.shelfKind, suite.suiteKind]).toEqual(['residential', 'residential']);
  expect(suite.outlines.map(o => o.levelId)).toEqual([-1]);
});

test('a HOLOGRAM file brought in on the SITE plan lands on the SITE and is drawn there', async ({ page }) => {
  await open(page, sitePlan(), '/MODEL.html?level=8&left=1');
  const file = await saveShelfAs(page, 'hologram');
  // Into a bare site plan, standing on the SITE level.
  const plan = { ...sitePlan(), outlines: [LOT], boneyardOutlines: [], lines: [] };
  await open(page, plan, '/MODEL.html?level=8&left=1');
  const before = await inkInside(page);
  await bringIn(page, file);
  const d = await saved(page);
  expect(d.holograms).toHaveLength(1);
  expect(d.holograms[0].levelMap, 'its shelf on this SITE').toEqual({ '-1': 8 });
  expect(d.holograms[0].mode).toBeUndefined();
  expect(await inkInside(page), 'the outline is on the screen').toBeGreaterThan(before + 0.01);
  // The card names the level it stands on, with LEVEL ▲▼ to walk the ladder.
  await page.locator('[data-mode-hologram]').click();
  await expect(page.locator('[data-hologram-where]').first()).toContainText('SITE');
  await expect(page.locator('[data-hologram-name]').first()).toContainText('HOLOGRAM · SHELF 1');
  await page.locator('[data-hologram-where]').first().click();
  await expect(page.locator('[data-hologram-floor-up]')).toHaveText('LEVEL ▲');
  await page.screenshot({ path: 'test-results/shelf-hologram-on-site.png' });
  await page.locator('[data-hologram-floor-up]').click();
  await page.locator('#hologram-ask-close').click();
  expect((await saved(page)).holograms[0].levelMap, 'MAIN FL is the next level up (then ROOF)').toEqual({ '-1': 3 });
});

test('the same outline saved as a RESIDENTIAL SUITE stands on a floor, as suites do', async ({ page }) => {
  await open(page, sitePlan(), '/MODEL.html?level=8&left=1');
  const file = await saveShelfAs(page, 'residential');
  const plan = { ...sitePlan(), standalone: undefined, outlines: [LOT], boneyardOutlines: [], lines: [], activeLevelIdx: 2 };
  await open(page, plan, '/MODEL.html?level=3&left=1');
  await bringIn(page, file);
  const d = await saved(page);
  expect(d.holograms[0].source.outlines.map(o => o.levelId), 'moved onto MAIN FL').toEqual([3]);
  expect(d.holograms[0].levelMap).toBeUndefined();
});
