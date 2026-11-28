// THE SPLIT'S HALF-FLOORS SHOW THROUGH, ON MODEL.html (Movie, 7 Oct): "on
// the 2nd floor the 1.5 floor info should show ... but only be editable on
// the 1.5 floor", "same for 1st floor and 0.5 floor", and in MODEL space
// "make them even lighter like about half the opacity". Both ways: MAIN FL
// shows the 0.5 floor, and the 0.5 floor shows MAIN FL.
//
// The sheets' side is pinned offline by proto/layout-plan-harness.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const BUNGALOW = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'perf-bungalow.draft'), 'utf8'));
const ENTRY = { id: 2, name: 'ENTRY', elev: -4 };
// MAIN FL's stairs moved down to a 0.5 floor, so MAIN FL itself draws none.
const SPLIT = {
  ...BUNGALOW,
  levels: [...BUNGALOW.levels.filter(l => l.id !== 2), ENTRY],
  stairs: BUNGALOW.stairs.filter(st => st.levelId !== 5).map(st => ({ ...st, levelId: st.levelId === 3 ? 2 : st.levelId })),
};

async function load(page, drawing, level) {
  await h.openEditor(page, { drawing: drawing, bucket: BUCKET, url: `/MODEL.html?level=${level}`, webgl: false });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(400);
}

// Stair ink, faded or not: purple, well clear of the paper and the black walls.
const stairInk = page => page.evaluate(() => {
  const c = document.getElementById('plan');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 2] - d[i + 1] > 20 && d[i] - d[i + 1] > 4) n += 1;
  }
  return n;
});

test('MAIN FL shows the 0.5 floor\'s stairs, lighter', async ({ page }) => {
  await load(page, { ...SPLIT, stairs: [] }, 3);
  const none = await stairInk(page);
  await load(page, SPLIT, 3);
  expect(await stairInk(page)).toBeGreaterThan(none + 100);
});

test('the 0.5 floor shows MAIN FL\'s walls, which it cannot pick', async ({ page }) => {
  const entryOnly = { ...SPLIT, stairs: [] };
  const ink = () => page.evaluate(() => {
    const c = document.getElementById('plan');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const k = (Math.floor(c.height / 2) * c.width + 4) * 4;   // the paper, off the left edge
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - d[k]) + Math.abs(d[i + 1] - d[k + 1]) + Math.abs(d[i + 2] - d[k + 2]) > 30) n += 1;
    }
    return n;
  });
  await load(page, { ...entryOnly, walls: entryOnly.walls.filter(w => w.levelId !== 3) }, 2);
  const bare = await ink();
  await load(page, entryOnly, 2);
  expect(await ink()).toBeGreaterThan(bare + 200);
  // Nothing on this floor to select: the walls seen are MAIN FL's.
  await expect(page.locator('#readout')).toContainText(/walls 0\b/);
});

// RE-PINNED (17 Oct): this used to assert MAIN FL's stair ink did not move
// when the 2ND FL's stair was present, because the 2ND FL is not a half-floor
// partner to ghost. It still is not -- but a floor now shows the stair that
// LANDS on it, going UP, at full weight (Movie, 16 Oct: "MAIN shows main->2nd
// and any main->basement"; tests/stairs-per-floor.spec.js), so the 2ND FL's
// stair adds ink here. What the half-level rule must still not do is ghost
// it: the ink gained is a whole stair's, not a faded one's.
//
// RE-PINNED AGAIN (25 Nov 2026): the margin used to be `own + 100` pixels,
// and most of those 100 were the UP tag's `UP — 14R @ 7 9/16"`. The plan now
// says a bare UP (jb: the counts live on the stair section), and in this
// house the two stairs stack, so the Z break keeps only the DN flight's top
// and the UP flight's foot -- the net ink barely moves. What says "drawn,
// and drawn as a stair landing here" is the UP tag itself: a ghost (or a
// stair below) carries no tag at all.
test('a house with no half-floor: MAIN FL draws the 2ND FL stair landing on it, not as a ghost', async ({ page }) => {
  await page.addInitScript(() => {
    window.__planText = [];
    const proto = CanvasRenderingContext2D.prototype;
    const onPlan = ctx => ctx.canvas && ctx.canvas.id === 'plan';
    const clearRect = proto.clearRect;
    proto.clearRect = function (...args) {
      if (onPlan(this)) window.__planText = [];
      return clearRect.apply(this, args);
    };
    const fillText = proto.fillText;
    proto.fillText = function (text, ...rest) {
      if (onPlan(this)) window.__planText.push(String(text));
      return fillText.call(this, text, ...rest);
    };
  });
  const tags = () => page.evaluate(() => window.__planText.filter(t => t === 'UP' || t === 'DN').sort());
  await load(page, { ...BUNGALOW, stairs: BUNGALOW.stairs.filter(st => st.levelId === 3) }, 3);
  const own = await stairInk(page);
  expect(await tags(), 'MAIN FL alone: its own stair, going DN').toEqual(['DN']);
  await load(page, BUNGALOW, 3);
  expect(await tags(), 'the 2ND FL stair lands here, tagged UP like a stair, not a ghost').toEqual(['DN', 'UP']);
  expect(await stairInk(page), 'and it adds ink of its own').toBeGreaterThan(own);
});

// THE BASEMENT PLAN SHOWS THE FOUNDATION IT STANDS IN (Movie, 7 Oct): "show
// the FOUNDATION WALL (slightly lighter and not editable) (don't show
// footings, but show where columns are located on the basement plan too".
test('the basement plan shows the foundation walls and posts, which it cannot pick', async ({ page }) => {
  const ink = () => page.evaluate(() => {
    const c = document.getElementById('plan');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const k = (Math.floor(c.height / 2) * c.width + 4) * 4;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - d[k]) + Math.abs(d[i + 1] - d[k + 1]) + Math.abs(d[i + 2] - d[k + 2]) > 30) n += 1;
    }
    return n;
  });
  const bare = { ...BUNGALOW, walls: BUNGALOW.walls.filter(w => w.view !== 'foundation'), columns: [] };
  await load(page, bare, '1&view=plan');
  const none = await ink();
  await load(page, { ...bare, columns: BUNGALOW.columns }, '1&view=plan');
  const posts = await ink();
  expect(posts, 'the posts').toBeGreaterThan(none + 30);
  await load(page, BUNGALOW, '1&view=plan');
  expect(await ink(), 'and the foundation walls').toBeGreaterThan(posts + 200);
  await expect(page.locator('#readout')).toContainText(/walls 0\b/);
});

// AND ON THE FLOOR LAYOUT, THE PAIR'S FLOOR AREA (Movie, 7 Oct): "we should
// also show the 0.5 FLOOR in the 1 FLOOR", lighter than the 1 floor's own.
test('the 1 FLOOR layout shows the 0.5 floor\'s floor area, lighter', async ({ page }) => {
  const paper = () => page.evaluate(() => {
    const c = document.getElementById('plan');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const k = (Math.floor(c.height / 2) * c.width + 4) * 4;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - d[k]) + Math.abs(d[i + 1] - d[k + 1]) + Math.abs(d[i + 2] - d[k + 2]) > 6) n += 1;
    }
    return n;
  });
  const main = BUNGALOW.floors.find(f => Number(f.levelId) === 3 && f.view === 'floor')
    || { id: 'f3', levelId: 3, view: 'floor', points: [{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 30, z: 20 }, { x: 0, z: 20 }] };
  const xs = main.points.map(p => p.x), zs = main.points.map(p => p.z);
  const x1 = Math.max(...xs), z0 = Math.min(...zs);
  // A 0.5 floor standing out past MAIN FL's east side, where MAIN has no floor.
  const entryFloor = { id: 'entry-deck', levelId: 2, view: 'floor', structure: 'framed',
    points: [{ x: x1, z: z0 }, { x: x1 + 12, z: z0 }, { x: x1 + 12, z: z0 + 10 }, { x: x1, z: z0 + 10 }] };
  const base = { ...SPLIT, stairs: [], floors: [...(BUNGALOW.floors || []).filter(f => Number(f.levelId) !== 2), main] };
  await load(page, base, '3&view=floor');
  const without = await paper();
  await load(page, { ...base, floors: [...base.floors, entryFloor] }, '3&view=floor');
  expect(await paper()).toBeGreaterThan(without + 500);
});

// THE ROOF PLAN'S WALL TOPS STAY ON THE ROOF PLAN (Movie, 7 Oct): "a ROOM
// was created in the garage under the 2nd storey room, but shouldn't be" --
// the top of the room-over-garage's end wall was drawn on MAIN FL's plan.
test('MAIN FL does not draw the walls of the room over the garage', async ({ page }) => {
  const CORNER = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-movie-corner-garage.draft'), 'utf8'));
  const ink = () => page.evaluate(() => {
    const c = document.getElementById('plan');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 300) n += 1;
    return n;
  });
  await load(page, { ...CORNER, walls: CORNER.walls.filter(w => w.levelId !== 4) }, '3&view=plan');
  const without = await ink();
  await load(page, CORNER, '3&view=plan');
  expect(Math.abs(await ink() - without)).toBeLessThan(40);
});
