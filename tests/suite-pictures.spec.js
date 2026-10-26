// EACH SUITE A PICTURE OF ITS OWN (Movie, 26 Oct, his 22-suite file: a suite
// drag ran at seven frames a second -- every suite was drawn line by line on
// every move of the mouse). A suite is drawn once onto a canvas of its own
// and laid on after; a pan or a move slides the picture, a change to what it
// shows draws it afresh, a suite off the screen is not drawn, and a sheet or
// a print still draws line by line. The shell's share of the suites' walls
// and windows is worked out once per change, not four times a paint.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, extra = {}) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] }, ...extra });
const WIN = (id, wallId, offset, width = 4) => ({ id, wallId, levelId: 3, view: 'plan', type: 'window',
  offset, width, sillHeight: 3, headHeight: 6.67 });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [], superNodes: [] };
// A 20 x 15 suite with a window on its bottom wall and an inside wall.
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('s1', [0, 0], [20, 0]), W('s2', [20, 0], [20, 15]), W('s3', [20, 15], [0, 15]), W('s4', [0, 15], [0, 0]),
    W('s5', [10, 0], [10, 15], { wallType: 'stud_2x4' })],
  fenestrations: [WIN('w1', 's1', 5)] };
// A 60 x 30 shell; h1 stands half a foot inside its bottom wall, h2 two
// hundred feet away, off any screen that shows the shell.
const SHELL = {
  version: 1, board: 'drafting', planTurn: 0, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  nextDrawingItemId: 20,
  walls: [W('a', [0, 0], [60, 0]), W('b', [60, 0], [60, 30]), W('c', [60, 30], [0, 30]), W('d', [0, 30], [0, 0])],
  holograms: [
    { id: 'h1', name: 'suite-a', mode: 'suite', x: 20, z: 0.5, angleDeg: 0, pivotX: 10, pivotZ: 7.5, source: SUITE },
    { id: 'h2', name: 'suite-b', mode: 'suite', x: 20, z: 200, angleDeg: 0, pivotX: 10, pivotZ: 7.5, source: SUITE },
  ] };

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft-skin'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: SHELL });
  await page.goto('/MODEL.html?level=3&left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // The shell filling the plan, the far suite off it; and a count of the
  // suites drawn line by line.
  await page.evaluate(() => {
    view.cx = 30; view.cz = 15; view.scale = 12;
    const LP = window.DraftLayoutPlan;
    const drawPlan = LP.drawPlan;
    window.__suitesDrawn = 0;
    // (The module is frozen: a copy of it stands in, counting.)
    window.DraftLayoutPlan = { ...LP,
      drawPlan: (...a) => { if (a[4]?.hologram) window.__suitesDrawn += 1; return drawPlan(...a); } };
    paint();
  });
}
// Paint, and how many suites were drawn line by line doing it.
const drawnBy = (page, change = '') => page.evaluate(change => {
  // eslint-disable-next-line no-new-func
  if (change) new Function(change)();
  window.__suitesDrawn = 0;
  paint();
  return window.__suitesDrawn;
}, change);
// The plan as painted, against the same plan with every suite drawn line by
// line: how many pixels differ by more than anti-aliasing.
const differsFromLines = page => page.evaluate(() => {
  const ctx = canvas.getContext('2d');
  paint();
  const kept = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const H = window.DraftHologram, orig = H.paint;
  H.paint = (...a) => { a[4] = { ...a[4], pictures: false }; return orig(...a); };
  try { paint(); } finally { H.paint = orig; }
  const lines = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let off = 0;
  for (let i = 0; i < kept.length; i += 4) {
    if (Math.abs(kept[i] - lines[i]) + Math.abs(kept[i + 1] - lines[i + 1]) + Math.abs(kept[i + 2] - lines[i + 2]) > 24) off += 1;
  }
  paint();
  return off;
});

test('drawn once, then laid on: a paint with nothing changed draws no suite again, and looks as drawn line by line', async ({ page }) => {
  await open(page);
  expect(await drawnBy(page), 'nothing changed, nothing drawn afresh').toBe(0);
  expect(await differsFromLines(page), 'the picture is the drawing').toBe(0);
});

test('a suite off the screen is not drawn; zoomed, the one on it is drawn afresh', async ({ page }) => {
  await open(page);
  expect(await drawnBy(page, 'view.scale = 14;'), 'h1 at the new zoom, h2 not at all').toBe(1);
});

test('a moved suite slides its picture; lined up on the shell, it is drawn afresh without the wall the shell takes', async ({ page }) => {
  await open(page);
  expect(await drawnBy(page, "holograms().find(x => x.id === 'h1').x = 21;"), 'a foot across: slid').toBe(0);
  expect(await differsFromLines(page), 'slid to where it stands').toBe(0);
  // Down the half foot: its bottom wall is the shell's now.
  expect(await drawnBy(page, "holograms().find(x => x.id === 'h1').z = 0;"), 'the shell took a wall').toBe(1);
  expect(await differsFromLines(page)).toBe(0);
});

test('its layers changed, a suite is drawn afresh', async ({ page }) => {
  await open(page);
  // The drawing's main set: the windows off for every suite.
  expect(await drawnBy(page, "drawing.hologramLayers = { off: ['A-GLAZ'] };")).toBe(1);
});

test('a sheet or a print draws every suite line by line, every time', async ({ page }) => {
  await open(page);
  const n = await page.evaluate(() => {
    const scratch = document.createElement('canvas');
    scratch.width = 400; scratch.height = 300;
    const c = scratch.getContext('2d');
    const toS = p => ({ x: (p.x - 30) * 5 + 200, y: (p.z - 15) * 5 + 150 });
    window.__suitesDrawn = 0;
    window.DraftHologram.paint(c, toS, drawing, 3, { view: 'plan', paperColor: '#ffffff' });
    window.DraftHologram.paint(c, toS, drawing, 3, { view: 'plan', paperColor: '#ffffff' });
    return window.__suitesDrawn;
  });
  expect(n, 'both suites, both times').toBe(4);
});

test('the shell\'s windows from a suite follow an edit to the shell, and a change to what is handed out is not kept', async ({ page }) => {
  await open(page);
  const offsets = await page.evaluate(() => {
    const H = window.DraftHologram;
    holograms().find(x => x.id === 'h1').z = 0;
    const of = () => H.hostOpenings(drawing).map(o => [o.wallId, Math.round(o.offset * 100) / 100]);
    const lined = of();
    H.hostOpenings(drawing)[0].offset = 999;
    const after = of();
    // The shell's bottom wall started two feet further left.
    walls().find(w => w.id === 'a').start.x = -2;
    return { lined, after, moved: of() };
  });
  expect(offsets.lined).toEqual([['a', 25]]);
  expect(offsets.after, 'not kept').toEqual([['a', 25]]);
  expect(offsets.moved, 'measured from the wall\'s new start').toEqual([['a', 27]]);
});
