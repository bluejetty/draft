// ATTACH TO BACK / LEFT / RIGHT (jb, 27 Nov 2026): "when it attached to the
// wall can we have a popup that says ATTACH TO BACK / LEFT / RIGHT" -- "and
// it they press thru button mouse click or space enter it will take BACK as
// default" -- "they will need to press R or L to choose side" -- "or press
// the onscreen button in the popup" -- "once its placed also have an option
// in the OBJ PROP to allow the user to repostion to R / L or BACK when its
// already stuck".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
// A 30" x 24" sink base on wall a, its middle 9' along.
const SINK = () => ({ id: 's', wallId: 'a', levelId: 3, view: 'plan', kind: 'sinkbase', offset: 9, width: 2.5, depth: 2, side: 1 });
const drawing = (fixtures = []) => ({
  version: 1, board: 'drafting', levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [W('a', [0, 0], [16, 0]), W('b', [0, 10], [16, 10])],
  fixtures,
  fenestrations: [], lines: [], floors: [], roofs: [], dimensions: [], outlines: [], shapes: [], groups: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
});
async function open(page, d, url = '/MODEL.html?level=3') {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), d);
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(250);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const sinkNow = page => page.evaluate(() => {
  const f = drawing.fixtures.find(x => x.kind === 'sinkbase');
  const g = window.DraftFixtureGeometry.fixtureGeometry(drawing.walls, f);
  const xs = g.corners.map(p => p.x), zs = g.corners.map(p => p.z);
  return { attach: f.attach ?? null, wallId: f.wallId, width: f.width, depth: f.depth,
    alongFt: Math.max(...xs) - Math.min(...xs), offFt: Math.max(...zs) - Math.min(...zs),
    // the piece's own front, as a world direction
    front: g.piece ? { x: g.piece.frame.nx, z: g.piece.frame.nz } : null };
});
const card = page => page.locator('#attach-ask');

async function pressSink(page, at) {
  // THE SINK CHIP: a press arms the SINK CABINET (jb, 27 Nov 2026).
  await page.locator('[data-fixture-pop="sink"]').click();
  // On the room side of wall a (z > 0), a foot off it.
  const [x, y] = at(9, 1);
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
  await expect(card(page)).toBeVisible();
  await expect(card(page)).toContainText('ATTACH TO');
}

test('pressed onto a wall, the card asks; R stands it on its right side, one UNDO puts its back to the wall', async ({ page }) => {
  const { at } = await open(page, drawing(), '/MODEL.html?level=3&left=1&lpane=build');
  await pressSink(page, at);
  await page.keyboard.press('r');
  await expect(card(page)).toBeHidden();
  const s = await sinkNow(page);
  expect(s.attach).toBe('right');
  // Its depth along the wall, its width off it (the half inch to the face too).
  expect(s.alongFt).toBeCloseTo(s.depth, 3);
  expect(s.offFt).toBeCloseTo(s.width, 3);
  // Its right side on the wall, so its front faces +x (right on the sheet):
  // the drafter at its front looks -x into it, the wall (up the sheet) on
  // their right.
  expect(s.front.x).toBeCloseTo(1, 6);
  await page.keyboard.press('Control+z');
  const back = await sinkNow(page);
  expect(back.attach).toBeNull();
  expect(back.alongFt).toBeCloseTo(back.width, 3);
});

test('Enter, Space or a press elsewhere take BACK; L and the LEFT button take its left', async ({ page }) => {
  const { at } = await open(page, drawing(), '/MODEL.html?level=3&left=1&lpane=build');
  await pressSink(page, at);
  await page.keyboard.press('Enter');
  await expect(card(page)).toBeHidden();
  expect((await sinkNow(page)).attach).toBeNull();
  await page.keyboard.press('Control+z'); // the press
  await pressSink(page, at);
  await page.locator('#attach-ask [data-attach="left"]').click();
  await expect(card(page)).toBeHidden();
  const s = await sinkNow(page);
  expect(s.attach).toBe('left');
  expect(s.front.x).toBeCloseTo(-1, 6);
});

test('OBJ / PROP: ATTACH TO L / R / BACK on a piece already on its wall, kept through a save', async ({ page }) => {
  const { at } = await open(page, drawing([SINK()]));
  await page.keyboard.press('s');
  await page.mouse.click(...at(9, 1.2));
  const row = page.locator('[data-prop-row="attach to"]:visible');
  await expect(row).toBeVisible();
  await row.locator('[data-prop-value="left"]').click();
  expect((await sinkNow(page)).attach).toBe('left');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  expect((await h.savedDrawing(page)).fixtures[0].attach).toBe('left');
  await page.locator('[data-prop-row="attach to"]:visible [data-prop-value="back"]').click();
  expect((await sinkNow(page)).attach).toBeNull();
  await page.keyboard.press('Control+z');
  expect((await sinkNow(page)).attach).toBe('left');
});

test('pulled off its wall and let go against another, the card asks there too', async ({ page }) => {
  const { at } = await open(page, drawing([SINK()]));
  await page.keyboard.press('s');
  const from = at(9, 1.2);
  await page.mouse.click(...from);
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.mouse.move(from[0] + 4, from[1], { steps: 2 });
  await page.mouse.move(...at(6, 8.6), { steps: 12 });
  await page.mouse.up();
  await expect(card(page)).toBeVisible();
  await page.keyboard.press('l');
  const s = await sinkNow(page);
  expect(s.wallId).toBe('b');
  expect(s.attach).toBe('left');
});
