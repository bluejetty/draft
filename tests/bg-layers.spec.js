// BG: ANOTHER LAYER DRAWN FADED BEHIND THE ONE IN VIEW, AND ITS NODES SNAP.
//
// Movie, 21 Oct: "to creat the ROOF i need to see the BG of the main floor
// walls (BACKGROUND) can you put a little BG button in each of the LAYOUT
// preview viewports and if somebody click the BG (to make it light up) the
// BACKGROUND will show that story BEHIND the current floor and slightly
// faded"; "we can turn on an off multiple at a time is ok"; "i would like
// the NODES to work in the BG".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b, levelId) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const box = (p, x0, x1, z0, z1, lv) => [W(`${p}1`, [x0, z0], [x1, z0], lv), W(`${p}2`, [x1, z0], [x1, z1], lv),
  W(`${p}3`, [x1, z1], [x0, z1], lv), W(`${p}4`, [x0, z1], [x0, z0], lv)];
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
  { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
// MAIN FL 30 x 20; 2ND FL only over its z 10..20 half.
const drawing = () => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50,
  walls: [...box('m', 0, 30, 0, 20, 3), ...box('u', 0, 30, 10, 20, 5)],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], fixtures: [],
  boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    localStorage.removeItem('draft-bg-layers');
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?level=5&view=plan');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  await h.openModelRail(page);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const bgOf = (page, seat) => page.locator(`[data-seat="${seat}"] [data-seat-bg]`);
// INK ALONG THE MAIN FLOOR'S FRONT WALL, z = 0, where the 2nd floor has none.
const inkAtFront = (page, at) => page.evaluate(([x, y]) => {
  const c = document.getElementById('plan');
  const r = c.getBoundingClientRect();
  const k = c.width / r.width;
  const ctx = c.getContext('2d');
  const bg = ctx.getImageData(5, 5, 1, 1).data;
  let n = 0;
  for (let dx = -40; dx <= 40; dx += 2) {
    for (let dy = -4; dy <= 4; dy += 1) {
      const p = ctx.getImageData(Math.round((x + dx - r.left) * k), Math.round((y + dy - r.top) * k), 1, 1).data;
      if (Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > 24) n += 1;
    }
  }
  return n;
}, at(15, 0));

test('every plan card carries BG; a press lights it and leaves the page where it is', async ({ page }) => {
  await open(page);
  await expect(bgOf(page, '3:plan')).toBeVisible();
  await expect(page.locator('[data-seat="E1"] [data-seat-bg]'), 'an elevation card has none').toBeHidden();
  await bgOf(page, '3:plan').click();
  await expect(bgOf(page, '3:plan')).toHaveAttribute('data-lit', '');
  await expect(page.locator('#readout')).toContainText('5/', { timeout: 2000 }).catch(() => {});
  expect(page.url(), 'still on the 2nd floor').toContain('level=5');
  // MORE THAN ONE AT ONCE.
  await bgOf(page, '1:foundation').click();
  await expect(bgOf(page, '1:foundation')).toHaveAttribute('data-lit', '');
  await expect(bgOf(page, '3:plan')).toHaveAttribute('data-lit', '');
  // AND OFF AGAIN.
  await bgOf(page, '3:plan').click();
  await expect(bgOf(page, '3:plan')).not.toHaveAttribute('data-lit', '');
});

test('lit, the main floor\'s walls are drawn behind the 2nd floor, faded', async ({ page }) => {
  const { at } = await open(page);
  const before = await inkAtFront(page, at);
  await bgOf(page, '3:plan').click();
  await page.waitForTimeout(200);
  const after = await inkAtFront(page, at);
  expect(after, 'the main floor front wall shows behind').toBeGreaterThan(before + 20);
  // FADED: fainter than the 2nd floor's own wall, z = 10.
  const fade = await page.evaluate(([[x0, y0], [x1, y1]]) => {
    const c = document.getElementById('plan');
    const r = c.getBoundingClientRect();
    const k = c.width / r.width;
    const ctx = c.getContext('2d');
    const bg = ctx.getImageData(5, 5, 1, 1).data;
    const most = (x, y) => {
      let m = 0;
      for (let dy = -6; dy <= 6; dy += 1) {
        const p = ctx.getImageData(Math.round((x - r.left) * k), Math.round((y + dy - r.top) * k), 1, 1).data;
        m = Math.max(m, Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]));
      }
      return m;
    };
    return { behind: most(x0, y0), own: most(x1, y1) };
  }, [at(15, 0), at(15, 10)]);
  expect(fade.behind, 'the background is fainter than the floor in view').toBeLessThan(fade.own);
});

test('it stays lit across a reload, in this browser', async ({ page }) => {
  await open(page);
  await bgOf(page, '3:plan').click();
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openModelRail(page);
  await expect(bgOf(page, '3:plan')).toHaveAttribute('data-lit', '');
});

// A WALL STARTED A HAIR OFF THE MAIN FLOOR'S CORNER, on the 2nd floor.
async function startNearCorner(page, at) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('w');
  await expect(page.locator('[data-tool-key="wall"]')).toHaveAttribute('aria-pressed', 'true');
  for (const pt of [[0.06, 0.05], [-6, 0.05]]) {
    await page.mouse.move(...at(...pt));
    await page.waitForTimeout(60);
    await page.mouse.click(...at(...pt));
    await page.waitForTimeout(60);
  }
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  const d = await h.savedDrawing(page);
  const drawn = d.walls.find(w => !/^[mu]\d$/.test(w.id));
  expect(drawn, 'a wall was drawn').toBeTruthy();
  expect(drawn.levelId).toBe(5);
  return [drawn.start.x, drawn.start.z].map(v => Number(v.toFixed(3)));
}

test('the background\'s nodes snap: a wall started by its corner lands on that corner', async ({ page }) => {
  const { at } = await open(page);
  await bgOf(page, '3:plan').click();
  const [x, z] = await startNearCorner(page, at);
  // THE CORNER OR THE FACE CORNER BESIDE IT -- the magnet's own order, as it
  // is for the floor's own walls -- and not where it was pressed.
  expect([0, 0.229]).toContain(x);
  expect(z, 'square on the corner, both ways').toBe(x);
});

test('with BG off the same press stays where it was pressed', async ({ page }) => {
  const { at } = await open(page);
  // x squares to the 2nd floor's own corner at x = 0 (TRACK); nothing on
  // this floor stands at z = 0, so z is the press.
  const [, z] = await startNearCorner(page, at);
  expect(z).toBe(0.05);
});
