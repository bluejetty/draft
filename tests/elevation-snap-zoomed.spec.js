// THE SNAP STILL CATCHES THE HOUSE ON A ZOOMED-IN ELEVATION.
//
// jb, 14 Nov 2026: "on the sections and elevations can we have 'node snap'
// on the corners intersections etc ... so i can draw overtop to fix small
// problems quickly". And 23 Oct, of zooming: "once the user is in the
// elevation can they zoom in to look at details they'l like to see closer".
//
// THE TWO DID NOT WORK TOGETHER, and nothing said so. A small problem is
// fixed zoomed in, and zoomed in the snap had lost the house: on this
// elevation it kept 5 pieces of the 244 it has at the fit, the five being
// the level lines. The snap reads the painter's ink and leaves out anything
// drawn inside a clip smaller than the glass, because that is how hatch is
// drawn; a zoomed elevation clips the whole drawing to the room between the
// rails, after ruling its level lines, and that room is well under the
// glass. So the whole house read as hatch. Found 20 Nov 2026 while testing
// the DETAIL SNAPSHOT camera; the painter now names that clip as its
// viewport (cut-view.js `snapFrameClip`) and the snap leaves it out of the
// rule (elev-snap.js). proto/elev-snap-harness.js holds the recorder's half.
//
// WHAT IS CHECKED: the house's own corners are still in the snap's record
// after a zoom; a hand a hair off one lights the node ring ON it; and a line
// drawn from there starts on the corner exactly, in the saved drawing.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-jb-fdn-tee.draft'), 'utf8'));
const URL = '/MODEL.html?theme=rough&mode=day&level=3&lpane=drafting&left=1&view=cut%3AE1';

async function openE1(page) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const f = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(f, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: HOUSE });
  await page.goto(URL);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForFunction(() => !!window.__elevFrame);
  await page.waitForTimeout(300);
}
// What the snap has to catch, in the view's own feet, and where the frame
// puts a foot on the page.
const snapState = page => page.evaluate(() => {
  const f = elevFrame;
  const r = document.getElementById('plan').getBoundingClientRect();
  return { pinned: elevPinned(activeCut()), pxPerFt: f.pxPerFt,
    frame: { x0: f.x0, y0: f.y0, pxPerFt: f.pxPerFt, uMin: f.uMin, yTop: f.yTop, left: r.left, top: r.top },
    segs: elevInkFeet().map(s => ({ a: { u: s.a.u, e: s.a.e }, b: { u: s.b.u, e: s.b.e } })) };
});
const toClient = (f, p) => ({ x: f.left + f.x0 + (p.u - f.uMin) * f.pxPerFt,
  y: f.top + f.y0 + (f.yTop - p.e) * f.pxPerFt });
const snapNow = page => page.evaluate(() => {
  const raw = document.getElementById('plan').dataset.elevSnap;
  return raw ? JSON.parse(raw) : null;
});
// A CORNER OF THE HOUSE WORTH AIMING AT: the end of a piece over two feet
// long, in the open part of the view, with no other end within 14 px except
// ones on top of it -- so a hand beside it can only mean that corner. (The
// zoom about it then opens that 14 px out to twenty and more.)
const loneCorner = st => {
  const ends = st.segs.flatMap(s => [s.a, s.b]);
  const long = st.segs.filter(s => Math.hypot(s.b.u - s.a.u, s.b.e - s.a.e) > 2);
  const px = p => toClient(st.frame, p);
  return long.flatMap(s => [s.a, s.b]).map(p => ({ p, c: px(p) }))
    .filter(({ c }) => c.x > 480 && c.x < 980 && c.y > 170 && c.y < 540)
    .find(({ c }) => !ends.some(q => {
      const d = Math.hypot(px(q).x - c.x, px(q).y - c.y);
      return d < 14 && d > 1.5;
    }));
};

test('zoomed in, the snap still has the house: its corners are caught, and a line starts on one exactly', async ({ page }) => {
  await openE1(page);
  const fit = await snapState(page);
  expect(fit.pinned, 'opened at the fit').toBe(false);
  expect(fit.segs.length, 'the house is in the snap\'s record at the fit').toBeGreaterThan(100);
  const corner = loneCorner(fit);
  expect(corner, 'a corner of the house to aim at').toBeTruthy();

  // IN, about that corner, the way he looks closer at a small problem.
  await page.mouse.move(corner.c.x, corner.c.y);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(350);
  const zoomed = await snapState(page);
  expect(zoomed.pinned, 'the view is zoomed by hand').toBe(true);
  expect(zoomed.pxPerFt, 'and closer').toBeGreaterThan(fit.pxPerFt * 1.3);

  // THE HOUSE IS STILL THERE TO CATCH. It was 5 pieces of 244. The same
  // drawing at a closer zoom is cut into pieces a little differently where a
  // run is stepped, so the count is held to most of the fit's, not all.
  expect(zoomed.segs.length, `the snap keeps the house when zoomed: ${zoomed.segs.length} pieces against ${fit.segs.length} at the fit`)
    .toBeGreaterThan(fit.segs.length * 0.6);
  // AND THAT CORNER IS AN END OF ONE OF THEM, where it was, in feet: a tenth
  // of a foot is a pixel and a bit at the fit, which is how finely the fit
  // knew it.
  const ends = zoomed.segs.flatMap(s => [s.a, s.b]);
  const nearest = Math.min(...ends.map(q => Math.hypot(q.u - corner.p.u, q.e - corner.p.e)));
  expect(nearest, 'the corner is still a node of the record').toBeLessThan(0.1);
  const at = ends.find(q => Math.hypot(q.u - corner.p.u, q.e - corner.p.e) === nearest);

  // A HAND A HAIR OFF IT, with LINE up: the ring is the node's, ON the corner.
  await h.armFromRail(page, 'line');
  const c = toClient(zoomed.frame, at);
  await page.mouse.move(c.x + 3, c.y + 2);
  await expect.poll(() => snapNow(page), { message: 'the ring lights beside the corner' }).not.toBeNull();
  const lit = await snapNow(page);
  expect(lit.kind, 'a corner is a node').toBe('node');
  // ON AN END OF THE RECORD, exactly, and that end is this corner. A corner
  // is drawn by more than one stroke and their ends land a pixel apart, so
  // which of them the ring takes is not a claim; that it is one of them is.
  // (To a thousandth of a foot: the page publishes the catch to four places.)
  expect(Math.min(...ends.map(q => Math.hypot(lit.at[0] - q.u, lit.at[1] - q.e))),
    'the ring is on an end the painter drew').toBeLessThan(1e-3);
  expect(Math.hypot(lit.at[0] - corner.p.u, lit.at[1] - corner.p.e), 'and it is this corner').toBeLessThan(0.1);

  // AND A LINE DRAWN FROM THERE STARTS ON THE CORNER, not under the hand.
  await page.mouse.click(c.x + 3, c.y + 2);
  await page.mouse.move(c.x + 90, c.y + 70, { steps: 3 });
  await page.mouse.click(c.x + 90, c.y + 70);
  await page.keyboard.press('Enter');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const lines = ((await h.savedDrawing(page)).elevationMarks || []).filter(m => m.kind === 'line');
  expect(lines.length, 'one line drawn').toBe(1);
  expect(lines[0].a.u, 'it starts on the catch, across').toBeCloseTo(lit.at[0], 3);
  expect(lines[0].a.e, 'and up').toBeCloseTo(lit.at[1], 3);
  // NOT UNDER THE HAND. The press was three pixels off the corner, which at
  // this zoom is this many feet -- and the line starts nowhere near that
  // far from the catch.
  const hand = { u: zoomed.frame.uMin + (c.x + 3 - zoomed.frame.left - zoomed.frame.x0) / zoomed.frame.pxPerFt,
    e: zoomed.frame.yTop - (c.y + 2 - zoomed.frame.top - zoomed.frame.y0) / zoomed.frame.pxPerFt };
  expect(Math.hypot(lines[0].a.u - hand.u, lines[0].a.e - hand.e), 'the line did not start under the hand')
    .toBeGreaterThan(0.05);
});

test('and panned to the side as well, where the drawing runs under the rails', async ({ page }) => {
  await openE1(page);
  const fit = await snapState(page);
  const corner = loneCorner(fit);
  await page.mouse.move(corner.c.x, corner.c.y);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(250);
  // A right-button drag pans the view, as on the plan.
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(corner.c.x + 60, corner.c.y + 30, { steps: 4 });
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(300);
  const panned = await snapState(page);
  expect(panned.pinned).toBe(true);
  expect(panned.segs.length, 'the house is still in the record').toBeGreaterThan(fit.segs.length * 0.6);
  const ends = panned.segs.flatMap(s => [s.a, s.b]);
  const at = ends.reduce((best, q) => (Math.hypot(q.u - corner.p.u, q.e - corner.p.e)
    < Math.hypot(best.u - corner.p.u, best.e - corner.p.e) ? q : best));
  expect(Math.hypot(at.u - corner.p.u, at.e - corner.p.e)).toBeLessThan(0.1);
  await h.armFromRail(page, 'shape');
  const c = toClient(panned.frame, at);
  await page.mouse.move(c.x - 3, c.y + 2);
  await expect.poll(() => snapNow(page), { message: 'SHAPE catches it too' }).not.toBeNull();
  const lit = await snapNow(page);
  expect(lit.kind).toBe('node');
  expect(Math.min(...ends.map(q => Math.hypot(lit.at[0] - q.u, lit.at[1] - q.e)))).toBeLessThan(1e-3);
  expect(Math.hypot(lit.at[0] - corner.p.u, lit.at[1] - corner.p.e)).toBeLessThan(0.1);
});
