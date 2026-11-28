// DECK POSTS: AUTO FOOTING, ELEPHANT FOOT (jb, 27 Nov 2026).
//
// "deck posts over 6ft from grade need pile and under 6ft only need
// 'elephant foot' concrete post support dug into the ground couple inches
// for lat. support", and "make those default but allow the user to change
// the foundation support type (pile/ footing etc)". Nothing is placed for
// the drafter: a column placed on the FOUNDATION plan under a deck comes in
// AUTO, its footing answered by the deck's height; the FOOTING row offers
// AUTO and ELEPHANT FOOT beside the pads and piles; a column with nothing
// over it stays a 36" pad.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-timberhouse-jog-fascia.draft'), 'utf8'));
// The back deck (floor-113) is on MAIN FL, low to the ground. A second deck
// up on 2ND FL, out past the first, stands a post well over 6 ft.
const HIGH_DECK = { ...HOUSE.floors.find(f => f.id === 'floor-113'), id: 'floor-900', levelId: 5, deck: true,
  points: [{ x: -62, y: 0, z: -4 }, { x: -54, y: 0, z: -4 }, { x: -54, y: 0, z: -14 }, { x: -62, y: 0, z: -14 }] };
const SAVED = { ...HOUSE, columns: [], floors: [...HOUSE.floors, HIGH_DECK] };

async function open(page) {
  await h.openEditor(page, { drawing: SAVED, bucket: BUCKET, url: '/MODEL.html?left=1&right=1&level=1&view=foundation', webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const placeAt = (page, x, z) => page.evaluate(([x, z]) => {
  const c = placeColumn({ x, z });
  return { footing: c.footing, footingAuto: c.footingAuto === true, view: c.view };
}, [x, z]);

test('a post placed under a low deck is AUTO on an elephant foot, under a high one on a pile', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await open(page);
  expect(await placeAt(page, -45.5, -9)).toEqual({ footing: 'efoot', footingAuto: true, view: 'foundation' });
  await expect(page.locator('[data-prop-row="footing"] [data-prop-value="auto"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-prop-row="footing"] [data-prop-value="auto"]')).toHaveText('AUTO · EF');
  expect(await placeAt(page, -58, -9)).toEqual({ footing: 'pile10', footingAuto: true, view: 'foundation' });
  // Nothing over it: a pad, as before.
  expect(await placeAt(page, 20, 20)).toEqual({ footing: 'pad36', footingAuto: false, view: 'foundation' });
  expect(errors).toEqual([]);
});

test('AUTO follows the deck, a pick takes it off, and the file keeps both', async ({ page }) => {
  await open(page);
  await placeAt(page, -58, -9);
  // The high deck drops to MAIN FL: the post now holds a low deck.
  await page.evaluate(() => {
    drawing.floors.find(f => f.id === 'floor-900').levelId = 3;
    markDirty();
  });
  await page.waitForFunction(() => drawing.columns[0].footing === 'efoot');
  // ELEPHANT FOOT picked by hand: AUTO is off, the pick stays.
  await page.locator('[data-prop-row="footing"] [data-prop-value="pile12"]').click();
  let col = await page.evaluate(() => ({ ...drawing.columns[0] }));
  expect(col.footing).toBe('pile12');
  expect(col.footingAuto).toBeUndefined();
  await page.locator('[data-prop-row="footing"] [data-prop-value="efoot"]').click();
  await page.locator('[data-prop-row="footing"] [data-prop-value="auto"]').click();
  await page.locator('#save').click();
  await page.waitForTimeout(400);
  const read = await page.evaluate(async bucket => {
    const f = await window.SharedFileStore.loadSharedFile(bucket);
    const raw = JSON.parse(await f.text());
    const ids = new Set(raw.levels.map(l => Number(l.id)));
    return window.DraftDrawingFormat.columns(raw.columns, ids)[0];
  }, BUCKET);
  expect(read.footing).toBe('efoot');
  expect(read.footingAuto).toBe(true);
});

test('the 3D viewer stands the post on an elephant foot set 2" into grade', async ({ page }) => {
  await page.goto('/viewer/index.html?painter=plain');
  await page.waitForSelector('body[data-ready="1"]');
  const r = await page.evaluate(s => {
    const built = DraftViewer.loadDrawing(s, 'test');
    const grade = built.stack.foundation.grade;
    const near = f => f.pts.every(p => Math.abs(p.x + 45.5) < 1 && Math.abs(p.z + 9) < 1);
    const feet = built.faces.filter(f => f.kind === 'footing' && near(f));
    const posts = built.faces.filter(f => f.kind === 'post' && near(f));
    const ys = fs => fs.flatMap(f => f.pts.map(p => p.y));
    return { grade, feet: feet.length, low: Math.min(...ys(feet)), high: Math.max(...ys(feet)),
      postLow: Math.min(...ys(posts)), posts: posts.length };
  }, { ...SAVED, columns: [{ id: 1, point: { x: -45.5, y: 0, z: -9 }, levelId: 1, view: 'foundation', footing: 'efoot', footingAuto: true }] });
  expect(r.feet).toBe(6);
  expect(r.posts).toBe(6);
  expect(r.low).toBeCloseTo(r.grade - 2 / 12, 3);
  expect(r.high).toBeCloseTo(r.grade + 8 / 12, 3);
  expect(r.postLow).toBeCloseTo(r.high, 3);
});
