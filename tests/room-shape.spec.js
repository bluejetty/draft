// A ROOM TAG'S SHAPE IS ITS FLOOR (Movie, 23 Oct): "the FLOOR shape and ROOM
// TAG shape can be the same thing, but the FLOOR aspect doesn't always need
// to be turned on (it can just be turned off and the AREA calculated, or the
// user can change the flooring type if they wish for a room (but some users
// - like me won't use this i'll just make a small square for each room and
// turn off the room size)" -- "the user should be able to 'link' the corners
// of the flooring to wall nodes (and delink to move independently if needed
// ... when a user clicks that node, a popup asks, 1. move wall and floor /
// 2. de-link and move only floor)" -- "to calculate estimates for flooring
// i'd turn it on 'the flooring' so i can adjust the shape to get accurate
// estimates".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
// A 12 x 10 room; a BEDROOM tag in it with a 3 ft square (its first corner
// at `corner`); an OLD tag from before shapes existed, a name at a point
// with the area the detector gave it.
const drawing = ({ corner = { x: 4.5, z: 3.5 } } = {}) => ({
  version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, nextDrawingItemId: 50, nextRoomTagId: 3,
  walls: [W('n', [0, 0], [12, 0]), W('e', [12, 0], [12, 10]), W('s', [12, 10], [0, 10]), W('w', [0, 10], [0, 0])],
  roomTags: [
    { id: 1, at: { x: 6, z: 5 }, levelId: 3, view: 'plan', name: 'BEDROOM', areaSqFt: 0, stamped: true,
      points: [corner, { x: 7.5, z: 3.5 }, { x: 7.5, z: 6.5 }, { x: 4.5, z: 6.5 }] },
    { id: 2, at: { x: 20, z: 5 }, levelId: 3, view: 'plan', name: 'OLD', areaSqFt: 50, stamped: true },
  ],
  fixtures: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], columns: [], beams: [], boneyardOutlines: [], levelLocks: [], underlays: [],
});

async function open(page, d = drawing(), query = 'level=3&left=1') {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), d);
  await page.goto(`/MODEL.html?${query}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(250);
  return h.planFrame(page);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const tagNamed = (d, name) => d.roomTags.find(t => t.name === name);
const xz = pts => pts.map(p => [Math.round(p.x * 100) / 100, Math.round(p.z * 100) / 100]);
async function drag(page, at, from, to) {
  const [x0, y0] = at(...from), [x1, y1] = at(...to);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x0 + 6, y0 + 6);
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2);
  await page.mouse.move(x1, y1);
  await page.mouse.up();
  await page.waitForTimeout(120);
}
async function click(page, at, pt) {
  await page.mouse.click(...at(...pt));
  await page.waitForTimeout(100);
}

test('ROOM TAG placed by hand starts as a 3 ft square whose AREA shows; dragging the name carries the square', async ({ page }) => {
  const { at } = await open(page);
  await h.armFromRail(page, 'roomtag');
  await click(page, at, [3, 7]);
  await expect(page.locator('[data-prop-text="name"]')).toBeFocused();
  await expect(page.locator('[data-prop-room-area]')).toHaveText('AREA 9 SQ FT');
  await expect(page.locator('[data-room-area-shown]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-room-flooring="none"]')).toHaveAttribute('aria-pressed', 'true');
  let tag = tagNamed(await saved(page), 'ROOM');
  expect(xz(tag.points)).toEqual([[1.5, 5.5], [4.5, 5.5], [4.5, 8.5], [1.5, 8.5]]);
  expect(tag.areaSqFt).toBe(9);
  expect(tag.flooring).toBeUndefined();
  // THE NAME DRAGGED TAKES ITS SQUARE WITH IT (no corner is a wall's).
  await page.keyboard.press('Escape');
  await h.armFromRail(page, 'select');
  await click(page, at, [3, 7]);
  await drag(page, at, [3, 7], [5, 7]);
  tag = tagNamed(await saved(page), 'ROOM');
  expect(tag.at.x).toBeCloseTo(5, 1);
  expect(xz(tag.points)).toEqual([[3.5, 5.5], [6.5, 5.5], [6.5, 8.5], [3.5, 8.5]]);
  // INSIDE ITS OWN FLOOR THE NAME MOVES ALONE (Movie, 23 Oct: "allow the
  // ROOM TAG to be moved around within the 'flooring' area without changing
  // the flooring"): the square stays where it is.
  await click(page, at, [5, 7]);
  await drag(page, at, [5, 7], [6, 8]);
  tag = tagNamed(await saved(page), 'ROOM');
  expect(tag.at.x).toBeCloseTo(6, 1);
  expect(xz(tag.points), 'the square untouched').toEqual([[3.5, 5.5], [6.5, 5.5], [6.5, 8.5], [3.5, 8.5]]);
  // The OLD tag is as it was: a name at a point, its area kept.
  const old = tagNamed(await saved(page), 'OLD');
  expect(old.points).toBeUndefined();
  expect(old.areaSqFt).toBe(50);
});

test('a corner dragged onto a wall\'s node links there; the node dragged carries the corner, through a reload; UNDO', async ({ page }) => {
  let { at } = await open(page);
  await click(page, at, [6, 5]);
  await expect(page.locator('[data-prop-text="name"]')).toHaveValue('BEDROOM');
  await drag(page, at, [4.5, 3.5], [0, 0]);
  await expect(page.locator('#strip-message')).toContainText('linked');
  let tag = tagNamed(await saved(page), 'BEDROOM');
  expect(xz(tag.points)[0]).toEqual([0, 0]);
  expect(tag.areaSqFt).toBeGreaterThan(9);
  // RELOADED, the corner is still the wall's node: pick the wall, drag its
  // node, and the floor's corner comes with it.
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(250);
  ({ at } = await h.planFrame(page));
  await click(page, at, [6, 0]);
  await expect(page.locator('#props-slot .props-title').first()).toHaveText('WALL');
  await drag(page, at, [0, 0], [-2, 0]);
  let d = await saved(page);
  expect(d.walls.find(w => w.id === 'n').start.x).toBeCloseTo(-2, 2);
  expect(tagNamed(d, 'BEDROOM').points[0].x, 'the floor\'s corner followed the wall\'s node').toBeCloseTo(-2, 2);
  // ONE UNDO puts the node back, the corner with it.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(d.walls.find(w => w.id === 'n').start.x).toBeCloseTo(0, 2);
  expect(tagNamed(d, 'BEDROOM').points[0].x).toBeCloseTo(0, 2);
});

test('a corner dropped on the inside corner of two walls links by its offset off the node; the node dragged carries it; the wall deleted leaves it standing', async ({ page }) => {
  let { at } = await open(page);
  await click(page, at, [6, 5]);
  // The inside corner of the 2x4 walls meeting at (0, 0): 1 3/4" in on each.
  const f = 1.75 / 12;
  await drag(page, at, [4.5, 3.5], [f, f]);
  await expect(page.locator('#strip-message')).toContainText('linked to the wall\u2019s corner');
  let tag = tagNamed(await saved(page), 'BEDROOM');
  expect(tag.points[0].x).toBeCloseTo(f, 3);
  expect(tag.points[0].link).toMatchObject({ wallId: 'n', end: 'start' });
  expect(tag.points[0].link.dx).toBeCloseTo(f, 3);
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(250);
  ({ at } = await h.planFrame(page));
  await click(page, at, [6, 0]);
  await expect(page.locator('#props-slot .props-title').first()).toHaveText('WALL');
  await drag(page, at, [0, 0], [-2, 0]);
  let d = await saved(page);
  expect(d.walls.find(w => w.id === 'n').start.x).toBeCloseTo(-2, 2);
  expect(tagNamed(d, 'BEDROOM').points[0].x, 'the corner kept its offset off the node').toBeCloseTo(-2 + f, 2);
  // THE WALL DELETED: the floor stays where it stood, its corner free.
  await page.keyboard.press('Delete');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(d.walls.map(w => w.id)).not.toContain('n');
  const p0 = tagNamed(d, 'BEDROOM').points[0];
  expect(p0.x).toBeCloseTo(-2 + f, 2);
  expect(p0.link).toBeUndefined();
});

test('a press on a linked corner asks: DE-LINK frees the corner from the wall; MOVE WALL AND FLOOR picks the wall', async ({ page }) => {
  const { at } = await open(page, drawing({ corner: { x: 0, z: 0 } }));
  await click(page, at, [6, 5]);
  await expect(page.locator('[data-prop-text="name"]')).toHaveValue('BEDROOM');
  await click(page, at, [0, 0]);
  const card = page.locator('#room-corner-ask');
  await expect(card).toBeVisible();
  await card.locator('[data-room-corner-free]').click();
  await expect(card).toBeHidden();
  await expect(page.locator('#strip-message')).toContainText('free');
  await drag(page, at, [0, 0], [1, 1]);
  let d = await saved(page);
  expect(xz(tagNamed(d, 'BEDROOM').points)[0]).toEqual([1, 1]);
  expect(d.walls.find(w => w.id === 'n').start, 'the wall stayed').toMatchObject({ x: 0, z: 0 });
  // TWO UNDOS: the drag, then the de-link -- the corner is the node again.
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(xz(tagNamed(d, 'BEDROOM').points)[0]).toEqual([0, 0]);
  await click(page, at, [0, 0]);
  await expect(card).toBeVisible();
  await card.locator('[data-room-corner-wall]').click();
  await expect(card).toBeHidden();
  await expect(page.locator('#strip-message')).toContainText('wall and the floor move together');
  await expect(page.locator('#props-slot .props-title').first()).toHaveText('WALL');
});

test('an edge\'s midpoint pressed grows a corner; a corner dropped on its neighbour is let go', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, [6, 5]);
  await drag(page, at, [6, 3.5], [6, 2]);
  let pts = xz(tagNamed(await saved(page), 'BEDROOM').points);
  expect(pts).toEqual([[4.5, 3.5], [6, 2], [7.5, 3.5], [7.5, 6.5], [4.5, 6.5]]);
  await drag(page, at, [6, 2], [7.5, 3.5]);
  pts = xz(tagNamed(await saved(page), 'BEDROOM').points);
  expect(pts).toEqual([[4.5, 3.5], [7.5, 3.5], [7.5, 6.5], [4.5, 6.5]]);
});

test('SHOW AREA off counts nothing; a FLOORING picks a finish; the file carries the area as the shape stands', async ({ page }) => {
  const { at } = await open(page);
  await click(page, at, [6, 5]);
  await page.locator('[data-room-area-shown]').click();
  let tag = tagNamed(await saved(page), 'BEDROOM');
  expect(tag.areaShown).toBe(false);
  expect(tag.areaSqFt, 'a shape with its area off is not a room in the roll-up').toBe(0);
  await page.locator('[data-room-area-shown]').click();
  tag = tagNamed(await saved(page), 'BEDROOM');
  expect(tag.areaShown).toBeUndefined();
  expect(tag.areaSqFt).toBe(9);
  await page.locator('[data-room-flooring="tile"]').click();
  await expect(page.locator('[data-room-flooring="tile"]')).toHaveAttribute('aria-pressed', 'true');
  tag = tagNamed(await saved(page), 'BEDROOM');
  expect(tag.flooring).toEqual({ type: 'tile' });
  // STRETCHED, the file says the new area: 3 x 6.
  await drag(page, at, [4.5, 3.5], [4.5, 0.5]);
  await drag(page, at, [7.5, 3.5], [7.5, 0.5]);
  tag = tagNamed(await saved(page), 'BEDROOM');
  expect(tag.areaSqFt).toBe(18);
  await expect(page.locator('[data-prop-room-area]')).toHaveText('AREA 18 SQ FT');
  // The format: two corners are no shape; a bad finish is no flooring.
  const out = await page.evaluate(() => window.DraftDrawingFormat.roomTags([
    { id: 1, at: { x: 0, z: 0 }, levelId: 3, name: 'A', points: [{ x: 0, z: 0 }, { x: 1, z: 0 }], flooring: { type: 'tile' } },
    { id: 2, at: { x: 0, z: 0 }, levelId: 3, name: 'B', flooring: { type: 'marble' }, areaShown: false,
      points: [{ x: 0, z: 0, link: { wallId: 'n', end: 'start', dx: 0.15, dz: 0.15 } }, { x: 2, z: 0, link: { wallId: 'n', end: 'middle', dx: 1, dz: 1 } }, { x: 2, z: 2 }] },
  ], new Set([3])));
  expect(out[0].points).toBeUndefined();
  expect(out[0].flooring).toBeUndefined();
  expect(out[1].points).toHaveLength(3);
  expect(out[1].flooring).toBeUndefined();
  expect(out[1].areaShown).toBe(false);
  expect(out[1].areaSqFt).toBe(0);
  // A corner's link to a wall's end is kept; one naming no end is no link.
  expect(out[1].points[0].link).toEqual({ wallId: 'n', end: 'start', dx: 0.15, dz: 0.15 });
  expect(out[1].points[1].link).toBeUndefined();
});

test('a dropped WC brings its tag, shaped to the room\'s inside and tiled; one UNDO takes it with the room', async ({ page }) => {
  const { at } = await open(page, drawing(), 'level=3&left=1&lpane=build');
  const chip = page.locator('[data-washroom="B"]');
  await expect(chip).toBeEnabled();
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  // In the room, clear of its walls: the WC brings its own four.
  await click(page, at, [6, 5]);
  let d = await saved(page);
  const wc = tagNamed(d, 'WC 2');
  expect(wc, 'the WC has its tag').toBeTruthy();
  expect(wc.points.length).toBeGreaterThanOrEqual(4);
  expect(wc.points.every(p => p.link && p.link.wallId), 'every corner linked to a wall of the room').toBe(true);
  expect(wc.flooring).toEqual({ type: 'tile' });
  // 5'-1" x 8'-1" inside.
  expect(wc.areaSqFt).toBeCloseTo((61 / 12) * (97 / 12), 1);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(tagNamed(d, 'WC 2')).toBeUndefined();
  expect(d.walls).toHaveLength(4);
});

test('MOVE on a floor tied to walls that stay takes every corner with it, its area kept; UNDO ties them back', async ({ page }) => {
  // Movie, 25 Oct: "the bathroom floor acting weird" -- a WC's tiled floor
  // moved off its walls tore into a band: the tied corners went back to the
  // walls, the free ones went with the move.
  const d0 = drawing();
  d0.roomTags = [{ id: 1, at: { x: 6, z: 2 }, levelId: 3, view: 'plan', name: 'WC', areaSqFt: 0, stamped: true,
    flooring: { type: 'tile' },
    points: [{ x: 0.15, z: 0.15, link: { wallId: 'n', end: 'start', dx: 0.15, dz: 0.15 } },
      { x: 11.85, z: 0.15, link: { wallId: 'n', end: 'end', dx: -0.15, dz: 0.15 } },
      { x: 11.85, z: 4 }, { x: 0.15, z: 4 }] }];
  const { at } = await open(page, d0);
  await page.keyboard.press('s');
  await click(page, at, [6, 2]);
  await page.locator('#model-move').click();
  await drag(page, at, [6, 2], [6, 22]);
  await page.waitForTimeout(150);
  let tag = tagNamed(await saved(page), 'WC');
  expect(xz(tag.points), 'every corner 20 ft down').toEqual([[0.15, 20.15], [11.85, 20.15], [11.85, 24], [0.15, 24]]);
  expect(tag.points.some(p => p.link), 'let go of the walls that stayed').toBe(false);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  tag = tagNamed(await saved(page), 'WC');
  expect(xz(tag.points)).toEqual([[0.15, 0.15], [11.85, 0.15], [11.85, 4], [0.15, 4]]);
  expect(tag.points[0].link?.wallId, 'tied back').toBe('n');
});

// A WHOLE WC TURNED OR FLIPPED KEEPS ITS FLOOR TIED TO ITS WALLS (Movie, 25
// Oct: "the bathroom floor acting weird"): the floor's corners turn with the
// walls, their offsets off the wall ends turn with them, and a wall of it
// moved afterwards still carries the floor. UNDO puts the ties back as they
// were.
for (const how of ['ROTATE', 'FLIP']) {
  test(`${how} on a whole WC keeps its floor tied to its walls; a wall moved after carries the floor; UNDO`, async ({ page }) => {
    const d0 = drawing(); d0.walls = []; d0.roomTags = [];
    const { at } = await open(page, d0, 'level=3&left=1&lpane=build');
    await page.locator('[data-washroom="B"]').click();
    await click(page, at, [6, 5]);
    await page.keyboard.press('Escape');
    const read = () => page.evaluate(() => {
      const tag = drawing.roomTags.find(t => t.name === 'WC 2');
      return { pts: tag.points.map(p => ({ x: p.x, z: p.z, link: p.link ? { ...p.link } : null })), area: roomTagArea(tag) };
    });
    const before = await read();
    expect(before.pts.every(p => p.link), 'tied before').toBe(true);
    await page.evaluate(how => {
      setSelection([...drawing.walls.map(item => ({ type: 'wall', item })),
        { type: 'roomtag', item: drawing.roomTags.find(t => t.name === 'WC 2') }]);
      if (how === 'ROTATE') rotateSelection(90); else flipSelection('x');
    }, how);
    await page.waitForTimeout(150);
    const after = await read();
    expect(after.pts.every(p => p.link), 'still tied').toBe(true);
    expect(after.area, 'the same floor').toBeCloseTo(before.area, 3);
    // ON ITS WALLS: each tied corner stands its offset off its wall's end.
    const offWalls = await page.evaluate(() => {
      const tag = drawing.roomTags.find(t => t.name === 'WC 2');
      return tag.points.map(p => {
        const w = drawing.walls.find(x => String(x.id) === String(p.link.wallId));
        const v = w[p.link.end];
        return Math.hypot(v.x + p.link.dx - p.x, v.z + p.link.dz - p.z);
      });
    });
    offWalls.forEach(d => expect(d, 'on its wall').toBeLessThan(1e-6));
    // A WALL OF IT MOVED AFTER: the floor follows.
    const moved = await page.evaluate(() => {
      const tag = drawing.roomTags.find(t => t.name === 'WC 2');
      const w = drawing.walls.find(x => String(x.id) === String(tag.points[0].link.wallId));
      const end = w[tag.points[0].link.end];
      const was = tag.points[0].x;
      end.x += 1;
      paint();
      return tag.points[0].x - was;
    });
    expect(moved, 'the floor corner went with its wall').toBeCloseTo(1, 6);
    await page.evaluate(() => { const tag = drawing.roomTags.find(t => t.name === 'WC 2');
      const w = drawing.walls.find(x => String(x.id) === String(tag.points[0].link.wallId));
      w[tag.points[0].link.end].x -= 1; paint(); });
    await page.keyboard.press('Escape');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    const back = await read();
    back.pts.forEach((p, i) => {
      expect(p.x).toBeCloseTo(before.pts[i].x, 6);
      expect(p.z).toBeCloseTo(before.pts[i].z, 6);
      expect(p.link.dx).toBeCloseTo(before.pts[i].link.dx, 6);
      expect(p.link.dz).toBeCloseTo(before.pts[i].link.dz, 6);
    });
  });
}
