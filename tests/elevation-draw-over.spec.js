// DRAWING OVER AN ELEVATION OR SECTION: the snap, SHAPE and DIMENSION.
//
// jb, 14 Nov 2026: "on the sections and elevations can we have 'node snap'
// on the corners intersections etc, and allow the AREA / SHAPE and
// dimension commands to work on those pages too so i can draw overtop to fix
// small problems quickly". The view keeps no records of its own, so the snap
// reads what the painter drew (elev-snap.js); shapes and dimensions are kept
// with the lines and notes in `elevationMarks`, in the view's own feet, and
// print on LAYOUT's sheets (proto/elevation-harness.js checks that half).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-modbilevel-roof-hood.draft'), 'utf8'));
const URL = '/MODEL.html?theme=rough&mode=day&pane=previews&right=1&level=7&lpane=drafting&left=1&view=cut%3AE2';

async function openE2(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: REPRO });
  await page.goto(URL);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

// The drawing's own ends, in feet and on the screen: every end of a piece the
// painter drew that sits in the open drawing area, with no other end within
// 20 px except ones within a pixel of it (a face filled and then stroked
// lands its corner twice, a half pixel apart) -- so a hover beside it can
// only mean that corner.
const lonelyEnds = page => page.evaluate(() => {
  const f = elevFrame;
  const px = p => ({ x: f.x0 + (p.u - f.uMin) * f.pxPerFt, y: f.y0 + (f.yTop - p.e) * f.pxPerFt });
  const ends = elevInkFeet().flatMap(s => [s.a, s.b]);
  const r = document.getElementById('plan').getBoundingClientRect();
  return ends.map(p => ({ p, s: px(p) }))
    .filter(({ s }) => s.x > 420 && s.x < 1000 && s.y > 150 && s.y < 560)
    .filter(({ s }) => !ends.some(q => {
      const d = Math.hypot(px(q).x - s.x, px(q).y - s.y);
      return d < 20 && d > 1.2;
    }))
    .map(({ p, s }) => ({ u: p.u, e: p.e, x: s.x + r.left, y: s.y + r.top }));
});
const snapNow = page => page.evaluate(() => {
  const raw = document.getElementById('plan').dataset.elevSnap;
  return raw ? JSON.parse(raw) : null;
});
const marksOf = async page => (await h.savedDrawing(page))?.elevationMarks || [];

test('SHAPE on E2: corners catch the drawing\'s own nodes, ENTER closes it, it saves', async ({ page }) => {
  await openE2(page);
  await h.armFromRail(page, 'shape');
  const ends = await lonelyEnds(page);
  expect(ends.length).toBeGreaterThan(2);
  const node = ends[0];
  // A hair off the end: the orange ring takes it, exactly.
  await page.mouse.move(node.x + 2, node.y + 2);
  await expect.poll(() => snapNow(page)).not.toBeNull();
  const lit = await snapNow(page);
  expect(lit.kind).toBe('node');
  expect(Math.hypot(lit.at[0] - node.u, lit.at[1] - node.e)).toBeLessThan(0.15);
  await page.mouse.click(node.x + 2, node.y + 2);
  // Two more corners in open air, then ENTER.
  await page.mouse.click(node.x + 80, node.y + 3);
  await page.mouse.click(node.x + 80, node.y + 60);
  await page.keyboard.press('Enter');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const shapes = (await marksOf(page)).filter(m => m.kind === 'shape');
  expect(shapes.length).toBe(1);
  expect(shapes[0].cut).toBe('E2');
  expect(shapes[0].points.length).toBe(3);
  // The press took the catch, not the hand.
  expect(shapes[0].points[0].u).toBeCloseTo(lit.at[0], 3);
  expect(shapes[0].points[0].e).toBeCloseTo(lit.at[1], 3);
});

test('Ctrl held catches nothing', async ({ page }) => {
  await openE2(page);
  await h.armFromRail(page, 'shape');
  const [node] = await lonelyEnds(page);
  await page.keyboard.down('Control');
  await page.mouse.move(node.x + 2, node.y + 2);
  await page.mouse.move(node.x + 2, node.y + 3);
  expect(await snapNow(page)).toBeNull();
  await page.keyboard.up('Control');
});

test('DIMENSION VERT on E2: two snapped points, ENTER, a press beside them -- the height between', async ({ page }) => {
  await openE2(page);
  await h.armFromRail(page, 'dimension');
  await page.locator('[data-dim-mode="v"]').first().click();
  const ends = await lonelyEnds(page);
  // Two ends at different heights.
  const a = ends[0];
  const b = ends.find(p => Math.abs(p.e - a.e) > 2);
  expect(b).toBeTruthy();
  await page.mouse.move(a.x + 2, a.y - 2);
  const litA = await snapNow(page);
  await page.mouse.click(a.x + 2, a.y - 2);
  await page.mouse.move(b.x - 2, b.y + 2);
  const litB = await snapNow(page);
  await page.mouse.click(b.x - 2, b.y + 2);
  expect(litA?.kind).toBe('node');
  expect(litB?.kind).toBe('node');
  await page.keyboard.press('Enter');
  await expect(page.locator('#strip-message')).toContainText(/where the string stands/i);
  await page.mouse.click(Math.max(a.x, b.x) + 60, (a.y + b.y) / 2);
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const dims = (await marksOf(page)).filter(m => m.kind === 'dim');
  expect(dims.length).toBe(1);
  const d = dims[0];
  // VERT: the line is plumb and as long as the height between the two ends.
  expect(Math.abs(d.la.u - d.lb.u)).toBeLessThan(1e-6);
  expect(Math.abs(d.lb.e - d.la.e)).toBeCloseTo(Math.abs(litB.at[1] - litA.at[1]), 3);
  expect(Math.min(d.a.e, d.b.e)).toBeCloseTo(Math.min(litA.at[1], litB.at[1]), 3);
});

test('a held shape: WHITE masks, Delete removes it, UNDO puts it back', async ({ page }) => {
  await openE2(page);
  await h.armFromRail(page, 'shape');
  await page.mouse.click(560, 300);
  await page.mouse.click(660, 300);
  await page.mouse.click(660, 380);
  await page.mouse.click(560, 380);
  await page.mouse.click(560, 300);          // back on the first corner closes it
  expect(await page.evaluate(() => drawing.elevationMarks.filter(m => m.kind === 'shape').length)).toBe(1);
  await page.keyboard.press('Escape');
  await h.armFromRail(page, 'select');
  await page.mouse.click(610, 340);           // inside it
  const panel = page.locator('[data-elev-shape-props]');
  await expect(panel).toBeVisible();
  await panel.locator('[data-shape-hatch="white"]').click();
  expect(await page.evaluate(() => drawing.elevationMarks.find(m => m.kind === 'shape').hatch)).toBe('white');
  await page.keyboard.press('Delete');
  expect(await page.evaluate(() => drawing.elevationMarks.filter(m => m.kind === 'shape').length)).toBe(0);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => drawing.elevationMarks.filter(m => m.kind === 'shape').length)).toBe(1);
});
