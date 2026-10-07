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
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto(`/MODEL.html?level=${level}`);
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

test('a house with no half-floor draws as before: the 2ND FL is not MAIN FL\'s partner', async ({ page }) => {
  await load(page, { ...BUNGALOW, stairs: BUNGALOW.stairs.filter(st => st.levelId === 3) }, 3);
  const own = await stairInk(page);
  await load(page, BUNGALOW, 3);
  expect(Math.abs(await stairInk(page) - own)).toBeLessThan(20);
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
