// THE FLOOR KEY'S THREE CHOICES (jb, 27 Nov 2026).
//
// jb: "on the FLOOR button can we make it so when a user scrolls over it it
// shows 3 choices - FLOOR - FLOORING - and DECK". Hovering the key puts the
// pop-up (#floor-pop) beside it. FLOOR arms the FLOOR tool as it always was;
// DECK arms it with every floor it closes written `deck: true`; FLOORING
// draws a loop with the SHAPE tool's corners and closes it into a ROOM TAG
// laying a floor finish (jb: "keep room tag with flooring").
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const MAIN_FL = 3;
const FILE = {
  version: 1,
  levels: [{ id: 1, name: 'FOUNDATION', elev: -8 }, { id: MAIN_FL, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 1,
  board: 'drafting',
  walls: [
    ['n', V(-10, -10), V(10, -10)], ['e', V(10, -10), V(10, 10)],
    ['s', V(10, 10), V(-10, 10)], ['w', V(-10, 10), V(-10, -10)],
  ].map(([id, start, end]) => ({ id, start, end, levelId: MAIN_FL, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
};

async function open(page, view) {
  await h.openEditor(page, { drawing: FILE, bucket: BUCKET, url: `/MODEL.html?level=${MAIN_FL}&view=${view}&left=1&lpane=build`, webgl: false });
  await expect(page.locator('#readout')).toContainText('floors', { timeout: 10000 });
  await expect(page.locator('[data-tool-key="floor"]')).toBeVisible();
}

const pop = page => page.locator('#floor-pop');
const choice = (page, id) => page.locator(`[data-floor-pop-choice="${id}"]`);
const tool = page => page.evaluate(() => activeTool);

async function draw(page, corners) {
  const frame = await h.planFrame(page);
  for (const [x, z] of [...corners, corners[0]]) {
    const [px, py] = frame.at(x, z);
    await page.mouse.click(px, py);
    await page.waitForTimeout(100);
  }
}

test('hovering FLOOR shows FLOOR, FLOORING and DECK beside the key; leaving puts it away', async ({ page }) => {
  await open(page, 'floor');
  await expect(pop(page)).toBeHidden();
  await page.locator('[data-tool-key="floor"]').hover();
  await expect(pop(page)).toBeVisible();
  await expect(pop(page).locator('button')).toHaveText(['FLOOR', 'FLOORING', 'DECK']);
  // Beside the key, not over it.
  const key = await page.locator('[data-tool-key="floor"]').boundingBox();
  const box = await pop(page).boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(key.x + key.width);
  // The pointer can cross into the pop-up without it going.
  await choice(page, 'deck').hover();
  await page.waitForTimeout(400);
  await expect(pop(page)).toBeVisible();
  await page.mouse.move(700, 400);
  await expect(pop(page)).toBeHidden({ timeout: 2000 });
  // Esc puts it away too.
  await page.locator('[data-tool-key="floor"]').hover();
  await expect(pop(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pop(page)).toBeHidden();
});

test('pressing the FLOOR key itself still arms FLOOR, and a floor inside the walls is not a deck', async ({ page }) => {
  await open(page, 'floor');
  await page.locator('[data-tool-key="floor"]').click();
  expect(await tool(page)).toBe('floor');
  await page.mouse.move(700, 400);
  await draw(page, [[-6, -5], [6, -5], [6, 5], [-6, 5]]);
  const floor = await page.evaluate(() => drawing.floors[drawing.floors.length - 1]);
  expect(floor).toBeTruthy();
  expect(floor.deck).toBeUndefined();
});

test('DECK arms the FLOOR tool and every floor it closes is a deck', async ({ page }) => {
  await open(page, 'floor');
  await page.locator('[data-tool-key="floor"]').hover();
  await choice(page, 'deck').click();
  await expect(pop(page)).toBeHidden();
  expect(await tool(page)).toBe('floor');
  await expect(page.locator('[data-tool-key="floor"]')).toHaveAttribute('data-floor-choice', 'deck');
  await page.mouse.move(700, 400);
  await draw(page, [[-6, -5], [6, -5], [6, 5], [-6, 5]]);
  const floor = await page.evaluate(() => drawing.floors[drawing.floors.length - 1]);
  expect(floor.deck).toBe(true);
  await expect(page.locator('#strip, [data-strip], body').first()).toContainText('Deck drawn.');
  // Put down with its tool: SELECT, then FLOOR again is the plain FLOOR.
  await page.keyboard.press('s');
  await page.locator('[data-tool-key="floor"]').click();
  expect(await page.evaluate(() => floorChoice)).toBe('floor');
  await expect(page.locator('[data-tool-key="floor"]')).not.toHaveAttribute('data-floor-choice', /./);
});

test('FLOORING draws a room tag that lays the floor finish, and the FLOOR key is the one lit', async ({ page }) => {
  await open(page, 'plan');
  await page.locator('[data-tool-key="floor"]').hover();
  await choice(page, 'flooring').click();
  expect(await tool(page)).toBe('shape');
  await expect(page.locator('[data-tool-key="floor"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-tool-key="shape"]')).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.move(700, 400);
  await draw(page, [[-8, -8], [0, -8], [0, 0], [-8, 0]]);
  const out = await page.evaluate(() => ({
    tags: drawing.roomTags.length, shapes: (drawing.shapes || []).length,
    tag: drawing.roomTags[drawing.roomTags.length - 1],
    picked: selection.map(s => s.type),
  }));
  expect(out.tags).toBe(1);
  expect(out.shapes).toBe(0);
  expect(out.tag.flooring).toEqual({ type: 'tile' });
  expect(out.tag.points).toHaveLength(4);
  expect(out.tag.at.x).toBeCloseTo(-4, 3);
  expect(out.tag.at.z).toBeCloseTo(-4, 3);
  expect(out.picked).toEqual(['roomtag']);
  // The finish picked on its panel is the next FLOORING's.
  await page.locator('[data-room-flooring="hardwood"]').click();
  await draw(page, [[2, 2], [8, 2], [8, 8], [2, 8]]);
  const next = await page.evaluate(() => drawing.roomTags[drawing.roomTags.length - 1]);
  expect(next.flooring).toEqual({ type: 'hardwood' });
  // SHAPE armed on its own (A, its letter) is the plain SHAPE again.
  await page.keyboard.press('s');
  await page.keyboard.press('a');
  expect(await tool(page)).toBe('shape');
  expect(await page.evaluate(() => floorChoice)).toBe('floor');
});
