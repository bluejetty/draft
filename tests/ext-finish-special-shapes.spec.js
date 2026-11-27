// SPECIAL FINISH SHAPES, DRAWN ON THE WALL.
//
// jb, 27 Nov 2026, EXT. FINISH: "i'd like to make a little RECTANGLE and
// cover the fasicia stucco finish with PFM for a small area... basically it
// would be even better if the user could DRAW A SHAPE and place the
// finishing they would like on the surface". SPECIAL, his word. He picked
// the shape BELONGING TO THE WALL under it, so it moves with the wall, and
// he matches a corner by hand: "i will just place the pattern to the edge of
// the EXT FINISH and then when i go on side view draw to the same edge at
// the corner to match them up" -- so a shape snaps dead on the wall's end
// and onto the floor / sill / plate lines.
//
// THE RECORD is `wall.finishSpecials`: [{ id, finishId, pts: [{ s, h }] }],
// s along the wall from its start, h up from the face's floor, in feet.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');
const H = require('../proto/harness-env.js');

const BUCKET = 'model-drawing';
const FIXTURE = path.join(__dirname, '..', 'proto', 'repro-jb-floor-strip-jog.draft');
const REPRO = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
const copy = (mutate = () => {}) => { const c = JSON.parse(JSON.stringify(REPRO)); mutate(c); return c; };
const WALL = 'wall-14';    // the front wall: start at u 0, end at u -41.5 on E1
const wallOf = d => Object.values(d.walls).find(w => w.id === WALL);

const paint = (saved, id = 'E1') => {
  const win = H.loadDraftModules();
  const env = H.buildEnv(win, saved);
  const cut = H.standardElevationCuts(env).find(c => c.id === id);
  const faceOutlines = [];
  const view = H.paintElevation(win, env, cut, { finishes: true, faceOutlines });
  return { view, faceOutlines, env };
};
// Strokes clipped to the box u0..u1 (by its corners), e0..e1.
const clippedTo = (view, u0, u1, e0, e1) => view.strokes.filter(s => s.clip && s.clip.length >= 3
  && Math.abs(Math.min(...s.clip.map(p => p.u)) - Math.min(u0, u1)) < 0.01
  && Math.abs(Math.max(...s.clip.map(p => p.u)) - Math.max(u0, u1)) < 0.01
  && Math.abs(Math.min(...s.clip.map(p => p.e)) - e0) < 0.02
  && Math.abs(Math.max(...s.clip.map(p => p.e)) - e1) < 0.02);
const RECT = (finishId, s0, s1, h0, h1) => ({ id: 'sp1', finishId,
  pts: [{ s: s0, h: h0 }, { s: s1, h: h0 }, { s: s1, h: h1 }, { s: s0, h: h1 }] });

test('a SPECIAL on the wall paints its finish inside its shape, and travels with the wall', () => {
  const base = paint(REPRO);
  expect(clippedTo(base.view, -10, -20, 1, 5), 'nothing there before').toEqual([]);
  const withSp = paint(copy(d => { wallOf(d).finishSpecials = [RECT('ledgestone', 10, 20, 1, 5)]; }));
  // s runs from the wall's START (u 0) toward its END (u -41.5).
  const hits = clippedTo(withSp.view, -10, -20, 1, 5);
  expect(hits.length, 'ledgestone strokes clipped to the special').toBeGreaterThan(0);
  hits.forEach(s => s.pts.forEach(p => {
    expect(p.u).toBeGreaterThanOrEqual(-20.01); expect(p.u).toBeLessThanOrEqual(-9.99);
  }));
  // OUTLINED: a 1 px ink line round it.
  const outline = withSp.view.strokes.filter(s => s.w === 1 && s.pts.length >= 4
    && s.pts.some(p => Math.abs(p.u + 20) < 0.01 && Math.abs(p.e - 5) < 0.02)
    && s.pts.some(p => Math.abs(p.u + 10) < 0.01 && Math.abs(p.e - 1) < 0.02));
  expect(outline.length, 'outline round the special').toBeGreaterThan(0);

  // MOVE THE WALL 3 FT ALONG ITSELF (both ends): the shape goes with it.
  const moved = paint(copy(d => {
    const w = wallOf(d);
    w.finishSpecials = [RECT('ledgestone', 10, 20, 1, 5)];
    w.start = { ...w.start, x: w.start.x - 3 };
    w.end = { ...w.end, x: w.end.x - 3 };
  }));
  const o = moved.faceOutlines.find(x => x.wallId === WALL && !x.gable);
  const u = s => o.u1 + (o.u2 - o.u1) * s / 41.5;
  expect(clippedTo(moved.view, u(10), u(20), 1, 5).length, 'special moved with the wall').toBeGreaterThan(0);
});

test('PFM paints a plain fill (no hatch) over the wall\'s siding', () => {
  const before = paint(REPRO).view;
  const { view } = paint(copy(d => { wallOf(d).finishSpecials = [RECT('pfm', 10, 20, 1, 5)]; }));
  // ONE NEW FILL, the special's box: 10 ft by 4 ft at this sheet's 40 px/ft.
  const seen = new Set(before.fills.map(f => JSON.stringify({ ...f, seq: 0 })));
  const added = view.fills.filter(f => !seen.has(JSON.stringify({ ...f, seq: 0 })));
  expect(added.length).toBe(1);
  const xs = added[0].clip.map(p => p.x), ys = added[0].clip.map(p => p.y);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(10 * view.pxPerFt, 0);
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(4 * view.pxPerFt, 0);
  // LAID OVER THE SIDING: every course crossing u -15 inside the box was
  // drawn before it, and PFM adds no hatch of its own.
  const crossing = view.strokes.filter(st => st.ink === '#1d1f20' && st.pts.some((p, i) => {
    if (!i || p.move) return false;
    const q = st.pts[i - 1];
    return Math.abs(p.e - q.e) < 1e-3 && p.e > 1.2 && p.e < 4.8 && -15 >= Math.min(p.u, q.u) && -15 <= Math.max(p.u, q.u);
  }));
  expect(crossing.length, 'siding courses under the box').toBeGreaterThan(0);
  crossing.forEach(st => expect(st.seq).toBeLessThan(added[0].seq));
  expect(clippedTo(view, -10, -20, 1, 5).filter(st => st.ink === '#1d1f20' && st.w !== 1), 'PFM draws no hatch').toEqual([]);
});

test('the file keeps good specials and drops bad ones', () => {
  const win = H.loadDraftModules();
  const FORMAT = win.DraftDrawingFormat;
  const WT = win.DraftWallTypes;
  const wall = { ...wallOf(REPRO), finishSpecials: [
    RECT('shake', 1, 2, 1, 2),
    { id: 'p', finishId: 'pfm', pts: [{ s: 0, h: 0 }, { s: 1, h: 0 }, { s: 1, h: 1 }] },
    { id: 'bad1', finishId: 'nope', pts: [{ s: 0, h: 0 }, { s: 1, h: 0 }, { s: 1, h: 1 }] },
    { id: 'bad2', finishId: 'shake', pts: [{ s: 0, h: 0 }, { s: 1, h: 0 }] },
    { id: 'bad3', finishId: 'shake', pts: [{ s: 0, h: 0 }, { s: NaN, h: 0 }, { s: 1, h: 1 }] },
  ] };
  const out = FORMAT.walls([wall], new Set([3]), {
    wallTypes: WT.WALL_TYPES, legacyWallTypes: WT.LEGACY_WALL_TYPES,
    finishIds: WT.EXTERIOR_FINISHES.map(f => f.id), legacyFinishes: WT.LEGACY_FINISH_IDS,
    finishAnchors: WT.FINISH_ANCHORS, defaultWallTopFt: 8,
  });
  expect(out[0].finishSpecials.map(x => x.id)).toEqual(['sp1', 'p']);
});

// ── ON THE PAGE ───────────────────────────────────────────────────────
async function openPage(page, saved = REPRO, elev = 'E1') {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, drawing }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, drawing: saved });
  await page.goto(`/EXTFINISH.html?elev=${elev}`);
  await page.waitForFunction(() => !!window.__extFinishFrame && window.__extFinishFaceOutlines().length > 0,
    null, { timeout: 10000 });
}
const screenAt = (page, u, e) => page.evaluate(([u, e]) => {
  const f = window.__extFinishFrame;
  const c = document.getElementById('elev');
  const box = c.getBoundingClientRect();
  return { x: box.left + (f.x0 + (u - f.uMin) * f.pxPerFt) * box.width / c.width,
    y: box.top + (f.y0 + (f.yTop - e) * f.pxPerFt) * box.height / c.height };
}, [u, e]);
// ON THE PAGE'S E1 (the front): wall-19 runs from its start at u 13 to its
// end at u 0, 13 ft, floor at 0 -- so s runs LEFTWARD, u = 13 - s.
const PAGE_WALL = 'wall-19';
const stored = page => page.evaluate(async ({ bucket, wallId }) => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const walls = JSON.parse(await file.text()).walls;
  const w = Object.values(walls).find(x => String(x.id) === wallId);
  return w ? (w.finishSpecials || []) : null;
}, { bucket: BUCKET, wallId: PAGE_WALL });
const round = sp => sp.map(x => ({ finishId: x.finishId,
  pts: x.pts.map(q => ({ s: Math.round(q.s * 100) / 100, h: Math.round(q.h * 100) / 100 })) }));
const pick = async (page, u, e) => { const at = await screenAt(page, u, e); await page.mouse.click(at.x, at.y); };

test('+ Special rectangle: type W x H, it follows the mouse, a click places it; resize, move, delete', async ({ page }) => {
  await openPage(page);
  await pick(page, 6.5, 3);                     // the front wall
  await expect(page.locator('#special-area')).toBeVisible();
  await page.locator('#special-finish').selectOption('pfm');
  await page.fill('#special-w', '3');
  await page.fill('#special-h', '2');
  await page.click('#special-rect');
  await expect(page.locator('#special-rect')).toContainText('Click to place');
  // THE MOUSE IS THE BOTTOM-LEFT CORNER AS SEEN: u 8 is s 5, and the wall
  // runs leftward here, so the rectangle reaches back to s 2.
  const at = await screenAt(page, 8, 2);
  await page.mouse.move(at.x, at.y);
  await page.mouse.click(at.x, at.y);
  // A MOUSE EVENT LANDS ON A WHOLE PIXEL (here about 1/12 ft), so where it
  // falls is good to the inch -- and off the lines it lands ON an inch.
  const onInch = v => expect(Math.abs(v * 12 - Math.round(v * 12))).toBeLessThan(0.005);
  await expect.poll(async () => (await stored(page)).length).toBe(1);
  let sp = (await stored(page))[0];
  expect(sp.finishId).toBe('pfm');
  const [a, b, c, d] = sp.pts;
  expect(a.s).toBeGreaterThan(2 - 0.09); expect(a.s).toBeLessThan(2 + 0.09);
  expect(a.h).toBeGreaterThan(2 - 0.09); expect(a.h).toBeLessThan(2 + 0.09);
  onInch(a.s); onInch(a.h);
  expect(round([sp])[0].pts).toEqual(round([{ pts: [a, { s: a.s + 3, h: a.h }, { s: a.s + 3, h: a.h + 2 },
    { s: a.s, h: a.h + 2 }] }])[0].pts);
  expect(b.s - a.s).toBeCloseTo(3, 3); expect(c.h - b.h).toBeCloseTo(2, 3); expect(d.s).toBe(a.s);
  await expect(page.locator('#special-list')).toContainText('SPECIAL');
  // PICKED, so the rail shows its size; a new W resizes it, the bottom-left
  // corner as seen (the high s) held.
  await expect(page.locator('#special-w')).toHaveValue('3');
  await page.fill('#special-w', '4');
  await page.locator('#special-w').dispatchEvent('change');
  const right = b.s;
  await expect.poll(async () => round(await stored(page))[0].pts.map(q => q.s))
    .toEqual(round([{ pts: [{ s: right - 4, h: 0 }, { s: right, h: 0 }, { s: right, h: 0 }, { s: right - 4, h: 0 }] }])[0].pts.map(q => q.s));

  // DRAG IT 2 FT LEFT ON SCREEN (u -2, s +2), in inch steps.
  const from = await screenAt(page, 10, 3);
  const to = await screenAt(page, 8, 3);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
  await expect.poll(async () => (await stored(page))[0].pts[1].s).not.toBe(right);
  sp = (await stored(page))[0];
  expect(sp.pts[1].s - right).toBeGreaterThan(2 - 0.09);
  expect(sp.pts[1].s - right).toBeLessThan(2 + 0.09);
  expect(sp.pts[0].h).toBeCloseTo(a.h, 6);
  onInch(sp.pts[1].s - right);

  // DELETE takes it off.
  await page.keyboard.press('Delete');
  await expect.poll(() => stored(page)).toEqual([]);
});

test('+ Special shape: click the corners, the first again closes it; corners snap to the wall\'s end and plate', async ({ page }) => {
  await openPage(page);
  await pick(page, 6.5, 3);
  await page.locator('#special-finish').selectOption('shake');
  await page.click('#special-draw');
  // A FEW PIXELS SHY OF THE WALL'S END (u 0) AND ITS PLATE (8.09375): held
  // dead on them, so the side elevation can meet it -- and not on the 1 ft
  // column stub a hair (0.004 ft) off that corner.
  const ppf = await page.evaluate(() => {
    const c = document.getElementById('elev');
    return window.__extFinishFrame.pxPerFt * c.getBoundingClientRect().width / c.width;
  });
  const shy = 4 / ppf;                          // 4 screen px, in feet
  const corners = [[4.3, 1], [shy, 1], [shy, 8.09375 - shy]];
  for (const [u, e] of corners) await pick(page, u, e);
  await pick(page, 4.3, 1);                     // the first corner: closes it
  await expect.poll(async () => (await stored(page)).length).toBe(1);
  const sp = await stored(page);
  expect(sp[0].finishId).toBe('shake');
  expect(sp[0].pts.length).toBe(3);
  expect(sp[0].pts[1].s, 'snapped to the wall\'s end').toBeCloseTo(13, 4);
  expect(sp[0].pts[2].s).toBeCloseTo(13, 4);
  expect(sp[0].pts[2].h, 'snapped to the plate').toBeCloseTo(8.09375, 4);
  // Off the lines it rounds to the inch.
  [sp[0].pts[0].s, sp[0].pts[0].h].forEach(v => expect(Math.abs(v * 12 - Math.round(v * 12))).toBeLessThan(0.005));
  expect(Math.abs(sp[0].pts[0].h - 1)).toBeLessThan(0.09);
});

test('zoomed in: a special lands where the mouse is, and dragging it moves the special, not the view', async ({ page }) => {
  // PR #1148 gave EXT. FINISH a wheel zoom and a drag pan; a special is
  // placed and dragged in the zoomed frame, and a left drag on the picked
  // special is the special's, not a pan.
  await openPage(page);
  const centre = await page.evaluate(() => {
    const f = window.__extFinishFrame;
    return { x: f.x0 + (6.5 - f.uMin) * f.pxPerFt, y: f.y0 + (f.yTop - 3) * f.pxPerFt };
  });
  await page.evaluate(c => window.__extFinishZoom.zoom(c.x, c.y, 3), centre);
  await expect.poll(() => page.evaluate(() => window.__extFinishZoom.pinned())).toBe(true);
  await pick(page, 6.5, 3);
  await page.locator('#special-finish').selectOption('shake');
  await page.fill('#special-w', '3');
  await page.fill('#special-h', '2');
  await page.click('#special-rect');
  const at = await screenAt(page, 8, 2);
  await page.mouse.move(at.x, at.y);
  await page.mouse.click(at.x, at.y);
  await expect.poll(async () => (await stored(page)).length).toBe(1);
  const a = (await stored(page))[0].pts[0];
  // Three times the pixels, so good to a third of an inch's worth of error.
  expect(Math.abs(a.s - 2)).toBeLessThan(0.05);
  expect(Math.abs(a.h - 2)).toBeLessThan(0.05);

  const before = await page.evaluate(() => ({ x0: window.__extFinishFrame.x0, y0: window.__extFinishFrame.y0 }));
  // Inside it (s 2..5 is u 11..8), 1 ft left on screen: s +1.
  const from = await screenAt(page, 9.5, 3);
  const to = await screenAt(page, 8.5, 3);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, from.y);
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
  await expect.poll(async () => (await stored(page))[0].pts[0].s).not.toBe(a.s);
  const moved = (await stored(page))[0].pts[0].s - a.s;
  expect(Math.abs(moved - 1), 'moved 1 ft along the wall').toBeLessThan(0.05);
  const after = await page.evaluate(() => ({ x0: window.__extFinishFrame.x0, y0: window.__extFinishFrame.y0 }));
  expect(after, 'the view did not pan').toEqual(before);
});
