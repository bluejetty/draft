// THE PLAN LOCK (jb, 27 Nov 2026): "all the same scale plans (usually floor
// plans / floor layouts, foundation, and basement plan) ... can you make a
// LOCK that starts default LOCKED for all these viewport windows and has them
// all lined up perfectly. if the user need to move it they all move and stay
// lined up perfectly on each page (or ... unlock a page to move it as needed
// (if they press lock again go back to the position of the other LOCKED
// items or if none, lock the next item based on its position". Not the site,
// roof or electric plans, not elevations or sections.
//
// LINED UP = the same point of the house on the same paper point on every
// locked sheet: `_lockOrigin` (where the model's origin lands) is equal.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

const point = (x, z) => ({ x, y: 0, z });
const STACK = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];

function box(levelId, view, x0, z0, x1, z1, first) {
  const wall = (id, sx, sz, ex, ez) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId, view,
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  });
  return [wall(first, x0, z0, x1, z0), wall(first + 1, x1, z0, x1, z1),
    wall(first + 2, x1, z1, x0, z1), wall(first + 3, x0, z1, x0, z0)];
}

// Three plans of one house, each a different outline, laid by hand off one
// another; an ELECTRIC PLAN of the main floor, which the lock leaves alone.
function houseDrawing(layout) {
  return {
    version: 1,
    levels: STACK,
    walls: [
      ...box(3, 'plan', 0, 0, 24, 16, 1),
      ...box(5, 'plan', 4, 0, 20, 12, 11),
      ...box(1, 'foundation', -2, -1, 30, 17, 21),
    ],
    ...(layout ? { layout } : {}),
  };
}

const HAND = {
  paperKey: '11x17', orientation: 'landscape', auto: false, nextViewportId: 5,
  sheets: [{ title: 'MAIN FL PLAN' }, { title: '2ND FL PLAN' }, { title: 'FOUNDATION' }, { title: 'ELECTRIC PLAN' }],
  viewports: [
    { id: 1, kind: 'plan', levelId: 3, view: 'plan', pif: 0.25, xIn: 7, yIn: 5, sheet: 1 },
    { id: 2, kind: 'plan', levelId: 5, view: 'plan', pif: 0.25, xIn: 8.5, yIn: 5.5, sheet: 2 },
    { id: 3, kind: 'plan', levelId: 1, view: 'foundation', pif: 0.25, xIn: 7.5, yIn: 4.5, sheet: 3 },
    { id: 4, kind: 'plan', levelId: 3, view: 'plan', pif: 0.25, xIn: 9, yIn: 6, sheet: 4 },
  ],
};

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

async function withLayoutSave(page, action) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await action();
  await page.waitForFunction(prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
}

async function sheetToClient(page, xIn, yIn) {
  const b = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((b.width - FIT_MARGIN * 2) / PW, (b.height - FIT_MARGIN * 2) / PH);
  return { x: b.x + (b.width - PW * zoom) / 2 + xIn * zoom, y: b.y + (b.height - PH * zoom) / 2 + yIn * zoom };
}

async function dragSheet(page, from, to) {
  const a = await sheetToClient(page, from.xIn, from.yIn);
  const b = await sheetToClient(page, to.xIn, to.yIn);
  await withLayoutSave(page, async () => {
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
  });
}

const showSheet = (page, sheet) => page.evaluate(n => new Promise(done => {
  const app = globalThis.eval('page');
  app.setState({ activeSheet: n, selectedViewportId: null }, () => { app._draw(); done(); });
}), sheet);

// Each viewport as the page holds it: where the model's origin prints, its
// window, whether it is locked, whether it can be.
const lockState = page => page.evaluate(() => {
  const app = globalThis.eval('page');
  return Object.fromEntries(app.state.viewports.map(v => [v.id, {
    lockable: app._lockable(v), locked: app._isLocked(v), unlocked: v.unlocked === true,
    origin: app._lockable(v) ? app._lockOrigin(v) : null, window: app._viewportRectIn(v), pif: v.pif,
  }]));
});

const savedViewports = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return Object.fromEntries(JSON.parse(await file.text()).layout.viewports.map(v => [v.id, v]));
}, BUCKET);

const expectLinedUp = (state, ids) => {
  const [first, ...rest] = ids;
  rest.forEach(id => {
    expect(state[id].origin.xIn, `plan ${id} lines up with plan ${first}`).toBeCloseTo(state[first].origin.xIn, 4);
    expect(state[id].origin.yIn).toBeCloseTo(state[first].origin.yIn, 4);
  });
};

async function padlock(page, id) {
  const p = await page.evaluate(vid => {
    const app = globalThis.eval('page');
    const box = app._lockIconPx(app.state.viewports.find(v => v.id === vid));
    const r = document.querySelector('[data-layout-canvas]').getBoundingClientRect();
    return { x: r.left + box.x + box.w / 2, y: r.top + box.y + box.h / 2 };
  }, id);
  await withLayoutSave(page, () => page.mouse.click(p.x, p.y));
}

test('a set laid out before the lock opens lined up; a grown window stays, a fitted one travels', async ({ page }) => {
  // Sheet 3's window grown to most of the sheet, the way a dealt plan's is.
  const crop = { l: -2, r: -2, t: -1, b: -1 };
  const hand = { ...HAND, viewports: HAND.viewports.map(v => (v.id === 3 ? { ...v, crop } : v)) };
  await openLayout(page, houseDrawing(hand));
  const s = await lockState(page);
  expect([1, 2, 3].map(id => s[id].locked)).toEqual([true, true, true]);
  expect(s[4].lockable, 'the ELECTRIC PLAN is not locked').toBe(false);
  expectLinedUp(s, [1, 2, 3]);
  // The first sheet is the spot: its plan has not moved at all.
  expect(s[1].window.xIn + s[1].window.wIn / 2).toBeCloseTo(7, 4);
  // A FITTED WINDOW goes with its drawing: no crop, so nothing slid out.
  const vps = await page.evaluate(() => globalThis.eval('page').state.viewports);
  expect(vps.find(v => v.id === 2).crop).toBeUndefined();
  // A GROWN WINDOW stays where it was laid, centred on 7.5, 4.5 (the crop
  // was symmetrical), and the drawing slid inside it.
  expect(s[3].window.xIn + s[3].window.wIn / 2).toBeCloseTo(7.5, 4);
  expect(s[3].window.yIn + s[3].window.hIn / 2).toBeCloseTo(4.5, 4);
  // The electric sheet keeps its own spot.
  expect(s[4].window.xIn + s[4].window.wIn / 2).toBeCloseTo(9, 4);
});

test('moving or panning a locked plan moves every locked plan, and they stay lined up', async ({ page }) => {
  await openLayout(page, houseDrawing(HAND));
  const before = await lockState(page);
  const w = before[1].window;
  // THE BORDER: the whole window, on every locked sheet.
  const edge = { xIn: w.xIn + w.wIn / 4, yIn: w.yIn + w.hIn - 0.03 };
  await dragSheet(page, edge, { xIn: edge.xIn + 1, yIn: edge.yIn + 0.5 });
  const moved = await lockState(page);
  expectLinedUp(moved, [1, 2, 3]);
  [1, 2, 3].forEach(id => {
    expect(moved[id].window.xIn - before[id].window.xIn, `window ${id} moved`).toBeCloseTo(1, 1);
    expect(moved[id].window.yIn - before[id].window.yIn).toBeCloseTo(0.5, 1);
  });
  expect(moved[4].window.xIn, 'the electric plan stays').toBeCloseTo(before[4].window.xIn, 4);
  const saved = await savedViewports(page);
  const held = await page.evaluate(() => globalThis.eval('page').state.viewports.find(v => v.id === 2).xIn);
  expect(saved[2].xIn, 'the move is saved').toBeCloseTo(held, 6);

  // THE BODY: every drawing pans, every window stays.
  const c = { xIn: moved[1].window.xIn + moved[1].window.wIn / 2, yIn: moved[1].window.yIn + moved[1].window.hIn / 2 };
  await dragSheet(page, c, { xIn: c.xIn - 0.75, yIn: c.yIn });
  const panned = await lockState(page);
  expectLinedUp(panned, [1, 2, 3]);
  [1, 2, 3].forEach(id => {
    expect(panned[id].window.xIn, `window ${id} stays`).toBeCloseTo(moved[id].window.xIn, 3);
    expect(panned[id].origin.xIn - moved[id].origin.xIn).toBeCloseTo(-0.75, 1);
  });
});

test('the padlock lets one sheet go, and locking it again puts it back with the others', async ({ page }) => {
  await openLayout(page, houseDrawing(HAND));
  await showSheet(page, 2);
  const before = await lockState(page);
  await padlock(page, 2);
  expect((await savedViewports(page))[2].unlocked).toBe(true);
  let s = await lockState(page);
  expect(s[2].locked).toBe(false);

  // Unlocked, it moves alone.
  const w = before[2].window;
  const edge = { xIn: w.xIn + w.wIn / 4, yIn: w.yIn + w.hIn - 0.03 };
  await dragSheet(page, edge, { xIn: edge.xIn + 1.5, yIn: edge.yIn - 0.5 });
  s = await lockState(page);
  expect(s[2].window.xIn).toBeCloseTo(w.xIn + 1.5, 1);
  expect(s[1].window.xIn, 'the locked ones did not follow').toBeCloseTo(before[1].window.xIn, 4);

  // LOCK AGAIN: back on the others' spot, window and all.
  await padlock(page, 2);
  s = await lockState(page);
  expect(s[2].locked).toBe(true);
  expectLinedUp(s, [1, 2, 3]);
  expect(s[2].window.xIn).toBeCloseTo(w.xIn, 3);
  expect(s[2].window.yIn).toBeCloseTo(w.yIn, 3);
  expect('unlocked' in (await savedViewports(page))[2]).toBe(false);

  // And the right-click menu says the same.
  const c = await sheetToClient(page, w.xIn + w.wIn / 2, w.yIn + w.hIn / 2);
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await expect(page.locator('[data-context-item="unlock"]')).toBeVisible();
});

test('with none locked, the next one locked stays put and is the spot the rest line up to', async ({ page }) => {
  const hand = { ...HAND, viewports: HAND.viewports.map(v => ({ ...v, unlocked: true })) };
  await openLayout(page, houseDrawing(hand));
  await showSheet(page, 2);
  await padlock(page, 2);
  let s = await lockState(page);
  expect(s[2].locked).toBe(true);
  expect(s[2].window.xIn + s[2].window.wIn / 2, 'it did not move').toBeCloseTo(8.5, 4);
  await showSheet(page, 3);
  await padlock(page, 3);
  s = await lockState(page);
  expectLinedUp(s, [2, 3]);
  expect(s[1].locked).toBe(false);
});

test('a new scale on one locked plan lets it go; the others stay locked', async ({ page }) => {
  await openLayout(page, houseDrawing(HAND));
  await showSheet(page, 2);
  await page.evaluate(() => new Promise(done => {
    const app = globalThis.eval('page');
    app.setState({ selectedViewportId: 2 }, done);
  }));
  // CHANGE SCALE's own step (the card's pick).
  await withLayoutSave(page, () => page.evaluate(() => {
    const app = globalThis.eval('page');
    app.state.editInModel = 2;
    app._rescaleAsked(1 / 8);
  }));
  const s = await lockState(page);
  expect(s[2].pif).toBeCloseTo(1 / 8, 6);
  expect(s[2].locked).toBe(false);
  expect(s[1].locked && s[3].locked).toBe(true);
});

test('a dealt set comes lined up; the site and roof plans are not locked', async ({ page }) => {
  const drawing = houseDrawing(null);
  drawing.roofs = [];
  await openLayout(page, drawing);
  const s = await lockState(page);
  const plans = await page.evaluate(() => globalThis.eval('page').state.viewports
    .filter(v => v.kind === 'plan').map(v => ({ id: v.id, levelId: v.levelId, view: v.view || null })));
  const locked = plans.filter(p => s[p.id].locked).map(p => p.id);
  expect(locked.length, 'main plan, 2nd plan, foundation at least').toBeGreaterThanOrEqual(3);
  expectLinedUp(s, locked);
  plans.filter(p => p.levelId === 7 || p.levelId === 8).forEach(p => expect(s[p.id].lockable).toBe(false));
});

test('a dealt sheet let go, panned and moved, locks back onto the others\' window and spot', async ({ page }) => {
  await openLayout(page, houseDrawing(null));
  const ids = await page.evaluate(() => { const app = globalThis.eval('page');
    return app.state.viewports.filter(v => app._isLocked(v)).map(v => ({ id: v.id, sheet: v.sheet })); });
  const { id, sheet } = ids[1];
  const mate = ids[0].id;
  await showSheet(page, sheet);
  const before = await lockState(page);
  await padlock(page, id);
  const w = before[id].window;
  const c = { xIn: w.xIn + w.wIn / 2, yIn: w.yIn + w.hIn / 2 };
  await dragSheet(page, c, { xIn: c.xIn + 2, yIn: c.yIn - 1 });
  const edge = { xIn: w.xIn + w.wIn / 4, yIn: w.yIn + w.hIn - 0.03 };
  await dragSheet(page, edge, { xIn: edge.xIn - 1, yIn: edge.yIn });
  let s = await lockState(page);
  expect(s[id].window.xIn).toBeCloseTo(w.xIn - 1, 1);
  await padlock(page, id);
  s = await lockState(page);
  expectLinedUp(s, [mate, id]);
  ['xIn', 'yIn', 'wIn', 'hIn'].forEach(k => expect(s[id].window[k], k).toBeCloseTo(s[mate].window[k], 3));
});
