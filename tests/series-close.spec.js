// ONCE A NODE, TWICE THE END (Movie, 20 Oct): "when drawing a series of
// LINE, DIMENSION WALL, if the user esc, end the series of items being drawn
// (as it does now) also make the DOUBLE CLICK on mouse close it off in the
// same way. If the user presses one click on mouse it makes a NODE, if
// DOUBLE click it closes.. also make the ENTER and SPACE act in the same way
// where 1 click makes a NODE but a double click for ENTER or SPACE closes the
// series". DIMENSION keeps its own rule from #822 (dim-chains.spec.js); this
// is WALL and LINE.
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
  await page.goto(`/MODEL.html?mode=night&level=${MAIN_FL}&left=1&lpane=drafting`);
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
async function hover(page, x, z) {
  const { px, py } = await pixelOf(page, x, z);
  await page.mouse.move(px, py);
  await page.waitForTimeout(60);
}
async function tapWorld(page, x, z) {
  await hover(page, x, z);
  const { px, py } = await pixelOf(page, x, z);
  await page.mouse.click(px, py);
  await page.waitForTimeout(60);
}
async function dblWorld(page, x, z) {
  await hover(page, x, z);
  const { px, py } = await pixelOf(page, x, z);
  await page.mouse.dblclick(px, py);
  await page.waitForTimeout(80);
}
// WALL is a BUILD key and LINE a DRAFTING one; the helper opens the pane.
async function arm(page, id) {
  await page.evaluate(() => document.activeElement?.blur?.());
  await h.armFromRail(page, id);
}
const r1 = n => Math.round(n * 10) / 10;
const seg = s => [r1(s.start.x), r1(s.start.z), r1(s.end.x), r1(s.end.z)];
// Pressed from the plan, not an input: the run's keys read the cursor.
const key = async (page, name, times = 1) => {
  for (let i = 0; i < times; i += 1) { await page.keyboard.press(name); await page.waitForTimeout(40); }
  await page.waitForTimeout(80);
};

test('a double-click ends a WALL run with its point as the last corner', async ({ page }) => {
  await open(page);
  await arm(page, 'wall');
  await tapWorld(page, 2, 2);
  await tapWorld(page, 8, 2);
  await dblWorld(page, 8, 6);
  await expect(page.locator('#strip-message')).toContainText(/run ended/i);
  // A FRESH RUN after it: the next press is a first point, not a third wall.
  await tapWorld(page, 12, 6);
  await tapWorld(page, 12, 9);
  await page.keyboard.press('Escape');
  const d = await save(page);
  expect(d.walls.map(seg)).toEqual([[2, 2, 8, 2], [8, 2, 8, 6], [12, 6, 12, 9]]);
});

test('ENTER or SPACE once is a corner at the cursor, twice ends the LINE run', async ({ page }) => {
  await open(page);
  await arm(page, 'line');
  await tapWorld(page, 2, 2);
  await hover(page, 8, 2);
  await key(page, 'Enter');
  await hover(page, 8, 6);
  await key(page, 'Enter', 2);
  await expect(page.locator('#strip-message')).toContainText(/run ended/i);
  // SPACE starts a run where the cursor stands, lands the next corner, and
  // twice ends it.
  await hover(page, 12, 6);
  await key(page, ' ');
  await hover(page, 12, 9);
  await key(page, ' ');
  await hover(page, 16, 9);
  await key(page, ' ', 2);
  await expect(page.locator('#strip-message')).toContainText(/run ended/i);
  const d = await save(page);
  expect(d.lines.map(seg)).toEqual([[2, 2, 8, 2], [8, 2, 8, 6], [12, 6, 12, 9], [12, 9, 16, 9]]);
  expect(d.walls, 'a LINE writes lines').toHaveLength(0);
});

test('a second press after a pause, or after the cursor moved on, is not an end', async ({ page }) => {
  await open(page);
  await arm(page, 'wall');
  await tapWorld(page, 2, 2);
  await hover(page, 8, 2);
  await key(page, 'Enter');
  // THE SAME SPOT, BUT LATE: the run stays in hand.
  await page.waitForTimeout(700);
  await key(page, 'Enter');
  await expect(page.locator('#strip-message')).not.toContainText(/run ended/i);
  // QUICK, BUT THE CURSOR MOVED ON: the next corner, not the end.
  await hover(page, 8, 6);
  await key(page, 'Enter');
  await expect(page.locator('#strip-message')).not.toContainText(/run ended/i);
  await page.keyboard.press('Escape');
  const d = await save(page);
  expect(d.walls.map(seg)).toEqual([[2, 2, 8, 2], [8, 2, 8, 6]]);
});

test('SPACE typed in the LENGTH box is a space, not a corner', async ({ page }) => {
  await open(page);
  await arm(page, 'wall');
  await tapWorld(page, 2, 2);
  await hover(page, 8, 2);
  const box = page.locator('#frozen-length');
  await box.click();
  await box.press(' ');
  await box.press(' ');
  await page.keyboard.press('Escape');   // out of the box, the run still in hand
  await page.evaluate(() => document.activeElement?.blur?.());
  await tapWorld(page, 8, 2);
  await page.keyboard.press('Escape');
  const d = await save(page);
  expect(d.walls.map(seg), 'one wall, from the first press').toEqual([[2, 2, 8, 2]]);
});
