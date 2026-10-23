// ZOOM TO FILL, AND THE NORTH ARROW IN A BOX (Movie, 23 Oct, with a mockup):
// "update the NORTH arrow make it look like the other button" and "add a
// ZOOM TO FILL - fill the screen with the OBJECTS DRAWN and add 20% padding
// without dimensions (from the building) and 10% if dimensions (from the
// dimensions)".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const W = (id, a, b) => ({ id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [] };
// A 40 x 30 house; the sheet is wider than it is tall, so its HEIGHT is what
// the fill is bound by, and the air above it is what the specs measure.
const HOUSE = [W('n', [0, 0], [40, 0]), W('e', [40, 0], [40, 30]), W('s', [40, 30], [0, 30]), W('w', [0, 30], [0, 0])];
// A hand string along the north wall, end to start, so its line stands off
// ABOVE the wall (drawDimension2D stands the line left of start->end).
const NORTH_DIM = { id: 31, levelId: 3, view: 'plan', auto: false,
  start: { x: 40, y: 0, z: 0 }, end: { x: 0, y: 0, z: 0 } };
const drawing = (walls = HOUSE, dimensions = []) => ({ version: 1, board: 'drafting', levels: LEVELS,
  activeLevelIdx: 2, ...EMPTY, walls, dimensions, nextDrawingItemId: 40 });

async function open(page, f = drawing()) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.goto('/MODEL.html?level=3&right=1&left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#strip-fill')).toBeVisible();
}
const mid = async loc => { const b = await loc.boundingBox(); return { cx: b.x + b.width / 2, cy: b.y + b.height / 2, w: b.width, h: b.height }; };
// The air above the drawing's top edge down from the top bar, as a share of
// the framed height on the sheet.
async function airAbove(page, topWorldY, spanPx) {
  const bar = await page.locator('#strip').boundingBox();
  return (topWorldY - (bar.y + bar.height)) / spanPx;
}

test('the three chips stand in a row of one size: north over the first column, ZOOM TO FILL over the second, HOUSE turn between', async ({ page }) => {
  await open(page);
  const seats = await page.locator('[data-seat]').evaluateAll(els => els.slice(0, 2)
    .map(s => { const r = s.getBoundingClientRect(); return r.x + r.width / 2; }).sort((a, b) => a - b));
  expect(seats, 'the rail never came up to line up with').toHaveLength(2);
  const north = await mid(page.locator('#north-hit')), turn = await mid(page.locator('#strip-rotate')), fill = await mid(page.locator('#strip-fill'));
  expect(Math.abs(north.cx - seats[0]), 'the arrow over the first column').toBeLessThanOrEqual(2);
  expect(Math.abs(fill.cx - seats[1]), 'ZOOM TO FILL over the second').toBeLessThanOrEqual(2);
  expect(Math.abs(turn.cx - (north.cx + fill.cx) / 2), 'HOUSE turn halfway').toBeLessThanOrEqual(2);
  expect([north.w, north.h, turn.w, turn.h, fill.w, fill.h].every(v => Math.abs(v - 40) < 1), 'all 40px square').toBe(true);
  expect(Math.abs(north.cy - fill.cy), 'on one line').toBeLessThan(1);
  // THE ARROW WEARS THE SAME BOX AS ITS NEIGHBOURS (23 Oct; it went bare on
  // 14 Oct), and is drawn inside it.
  const [hitBg, turnBg] = await Promise.all([page.locator('#north-hit').evaluate(el => getComputedStyle(el).backgroundColor),
    page.locator('#strip-rotate').evaluate(el => getComputedStyle(el).backgroundColor)]);
  expect(hitBg, 'the arrow has a box of its own again').not.toBe('rgba(0, 0, 0, 0)');
  expect(hitBg).toBe(turnBg);
  const inked = await page.locator('[data-north-face]').evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n += 1;
    return n / (d.length / 4);
  });
  expect(inked, 'the needle is painted on the face').toBeGreaterThan(0.01);
});

test('ZOOM TO FILL with no dimensions: the building fills the sheet with a fifth of its span clear each side', async ({ page }) => {
  await open(page);
  await page.keyboard.press('0');
  await page.waitForTimeout(150);
  const before = (await h.planFrame(page)).scale;
  await page.locator('#strip-fill').click();
  await page.waitForTimeout(200);
  const { at, scale, box } = await h.planFrame(page);
  expect(scale, 'the view moved').not.toBeCloseTo(before, 2);
  const [left, top] = at(0, 0), [right, bottom] = at(40, 30);
  expect(Math.abs((left - box.x) - (box.x + box.width - right)), 'centred across').toBeLessThan(2);
  const spanPx = bottom - top;
  expect(await airAbove(page, top, spanPx), 'a fifth of the height above').toBeCloseTo(0.2, 1);
  expect((left - box.x) / (right - left), 'and at least a fifth at the sides').toBeGreaterThanOrEqual(0.2);
});

// A SUITE ON ANOTHER LEVEL IS NOT ON THIS SHEET (Movie, 23 Oct: "when i
// press the full zoom button in upper right ... they should be centered but
// they come up like this off to the left"): a placed suite far off on the
// FOUNDATION pulled MAIN FL's frame out to it, and the house sat small in a
// corner. The frame is what this level draws: the house and its own suite.
const suite = (id, levelId, x, z) => ({ id, name: id.toUpperCase(), x, z, angleDeg: 0, pivotX: 0, pivotZ: 0,
  hidden: false, flip: false, colour: 0, layer: 'A-HOLO',
  source: { version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
    walls: [{ ...W(`${id}n`, [0, 0], [10, 0]), levelId }, { ...W(`${id}e`, [10, 0], [10, 8]), levelId },
      { ...W(`${id}s`, [10, 8], [0, 8]), levelId }, { ...W(`${id}w`, [0, 8], [0, 0]), levelId }] } });
test('ZOOM TO FILL frames this level\'s own suite and not one standing on another level', async ({ page }) => {
  const f = drawing();
  // One suite beside the house on MAIN FL; another 400 ft away on FOUNDATION.
  f.holograms = [suite('here', 3, 45, 0), suite('below', 1, 400, 300)];
  await open(page, f);
  await page.locator('#strip-fill').click();
  await page.waitForTimeout(200);
  const { at, box } = await h.planFrame(page);
  const [left] = at(0, 0), [right] = at(55, 0);
  expect(Math.abs((left - box.x) - (box.x + box.width - right)), 'the house and its suite centred across').toBeLessThan(2);
  expect((right - left) / box.width, 'and filling the sheet, not a corner of it').toBeGreaterThan(0.5);
});

test('with a dimension string showing, the frame is the string\'s and a tenth is clear round it', async ({ page }) => {
  await open(page, drawing(HOUSE, [NORTH_DIM]));
  await page.locator('#strip-fill').click();
  await page.waitForTimeout(200);
  const { at, scale } = await h.planFrame(page);
  const [, wallTop] = at(0, 0), [, bottom] = at(40, 30);
  // THE LINE STANDS 19px OFF THE WALL and its figure past that: the frame's
  // top edge is 32px above the wall.
  const frameTop = wallTop - 32;
  const bar = await page.locator('#strip').boundingBox();
  expect(frameTop, 'the string is on the sheet').toBeGreaterThan(bar.y + bar.height);
  expect(await airAbove(page, frameTop, bottom - frameTop), 'a tenth clear above the string').toBeCloseTo(0.1, 1);
  // Tighter than the building alone would be framed.
  await page.evaluate(() => { try { localStorage.setItem('model.dimsHidden', JSON.stringify({ auto: false, hand: true })); } catch (e) {} });
  await page.reload();
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.locator('#strip-fill').click();
  await page.waitForTimeout(200);
  expect((await h.planFrame(page)).scale, 'the hidden string is not framed').toBeLessThan(scale);
});

test('nothing drawn: the strip says so and the view stays', async ({ page }) => {
  await open(page, drawing([]));
  const before = await page.locator('#plan').getAttribute('data-view');
  await page.locator('#strip-fill').click();
  await expect(page.locator('#strip-message')).toContainText('nothing drawn');
  expect(await page.locator('#plan').getAttribute('data-view')).toBe(before);
});

test('the north chip still opens the norths\' popup, and lights green under the hand', async ({ page }) => {
  await open(page);
  const hit = page.locator('#north-hit');
  const green = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.style.color = 'var(--draw-site-datum)';
    document.body.append(probe);
    const c = getComputedStyle(probe).color; probe.remove(); return c;
  });
  await hit.hover();
  await expect(hit).toHaveCSS('border-color', green);
  await hit.click();
  await expect(page.locator('[data-north-popup]')).toBeVisible();
});
