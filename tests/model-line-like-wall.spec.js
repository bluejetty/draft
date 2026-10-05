// LINE DRAWS THE WAY WALL DOES, AND THE PROTRACTOR HOLDS A RUN TO AN ANGLE.
//
// Movie, 5 Oct: "make the line act like the WALL everything the same WALL
// works good", then "can we press the protractor and enter a number into the
// ANGLE textbox and force the line to travel in that angle" -- "for LINE
// WALLS and other similar commands (Outline)" -- with "allow them to enter an
// angle but don't engage unless they light up the protractor", "when the
// protractor is lit the T square should be UNLIT" and "only ... if not in TOY
// mode".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MAIN_FL = 3;
const EMPTY = {
  version: 1, planTurn: 0, board: 'drafting',
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
};

async function open(page) {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: EMPTY });
  await page.goto(`/MODEL.html?mode=night&level=${MAIN_FL}`);
  await expect(page.locator('#readout')).toContainText('scale', { timeout: 10000 });
}

async function save(page) {
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, BUCKET);
}

const pixelOf = async (page, x, z) => {
  const scale = Number((await page.locator('#readout').textContent()).match(/scale ([\d.]+) px\/ft/)[1]);
  const box = await page.locator('#plan').boundingBox();
  return { px: box.x + box.width / 2 + x * scale, py: box.y + box.height / 2 + z * scale };
};
async function tapWorld(page, x, z) {
  const { px, py } = await pixelOf(page, x, z);
  await page.mouse.move(px, py);
  await page.mouse.click(px, py);
  await page.waitForTimeout(60);
}
async function hover(page, x, z) {
  const { px, py } = await pixelOf(page, x, z);
  await page.mouse.move(px, py);
  await page.waitForTimeout(60);
}
const bearing = l => {
  const deg = Math.atan2(-(l.end.z - l.start.z), l.end.x - l.start.x) * 180 / Math.PI;
  return deg <= -90 ? deg + 180 : (deg > 90 ? deg - 180 : deg);
};

test('LINE chains like WALL: each press starts the next line, Escape ends the run', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  await tapWorld(page, 2, 2);
  await tapWorld(page, 8, 2);
  await tapWorld(page, 8, 6);
  await page.keyboard.press('Escape');
  await tapWorld(page, 12, 6);   // a fresh start, not a third line
  const saved = await save(page);
  expect(saved.lines, 'two pieces of one run').toHaveLength(2);
  const [a, b] = saved.lines;
  expect(Math.hypot(a.end.x - b.start.x, a.end.z - b.start.z), 'the corner is shared').toBeLessThan(1e-6);
  expect(saved.walls, 'a LINE writes lines, not walls').toHaveLength(0);
});

test('LINE takes a typed LENGTH the way WALL does', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  await tapWorld(page, 2, 2);
  await hover(page, 9, 2);
  const box = page.locator('#frozen-length');
  await expect(box).toBeEnabled();
  await box.fill(`12'`);
  await box.press('Enter');
  const saved = await save(page);
  expect(saved.lines).toHaveLength(1);
  const [l] = saved.lines;
  expect(Math.hypot(l.end.x - l.start.x, l.end.z - l.start.z)).toBeCloseTo(12, 3);
});

test('a typed ANGLE is kept, and only a lit PROTRACTOR holds the run to it', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'line');
  const angle = page.locator('#frozen-angle');
  await expect(angle, 'an angle can be typed before the first press').toBeEnabled();
  await angle.fill('30');
  await angle.press('Enter');
  // Unlit: the angle is kept and engages nothing.
  await tapWorld(page, 0, 0);
  await tapWorld(page, 6, 0);
  await page.keyboard.press('Escape');
  // Lit: the T-square goes out, and the run travels at 30°.
  await page.locator('[data-mode-tsquare]').click();
  await expect(page.locator('[data-mode-tsquare]')).toHaveClass(/lit/);
  await page.locator('[data-mode-protractor]').click();
  await expect(page.locator('[data-mode-protractor]')).toHaveClass(/lit/);
  await expect(page.locator('[data-mode-tsquare]'), 'one instrument holds the run').not.toHaveClass(/lit/);
  await tapWorld(page, 0, 4);
  await tapWorld(page, 6, 4);   // straight across, but the lock turns it
  await page.keyboard.press('Escape');
  const saved = await save(page);
  expect(saved.lines).toHaveLength(2);
  expect(bearing(saved.lines[0]), 'unlit: drawn where pressed').toBeCloseTo(0, 3);
  expect(bearing(saved.lines[1]), 'lit: held to the typed 30°').toBeCloseTo(30, 3);
  // And the T-square lit again puts the protractor out.
  await page.locator('[data-mode-tsquare]').click();
  await expect(page.locator('[data-mode-protractor]')).not.toHaveClass(/lit/);
});

test('the lock holds a WALL too', async ({ page }) => {
  await open(page);
  await h.armFromRail(page, 'wall');
  const angle = page.locator('#frozen-angle');
  await angle.fill('45');
  await angle.press('Enter');
  await page.locator('[data-mode-protractor]').click();
  await tapWorld(page, 0, 0);
  await tapWorld(page, 8, 0);
  await page.keyboard.press('Escape');
  const saved = await save(page);
  expect(saved.walls).toHaveLength(1);
  expect(bearing(saved.walls[0])).toBeCloseTo(45, 3);
});
