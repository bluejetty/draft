// SELECT PICKING A KIND: the four main keys over the tabs, and SELECT with a
// tool key picking only that kind for the box.
//
// Movie, 19 Oct: "i'd like the 4 buttons SELECT / ASSEMBLY / TRIM / DIMENSION
// up in that little space over the regular open tab area -- the main reason
// will be so i can have the SELECT button chosen, and also choose the
// FENETRATION (for this example) and instead of doing the TOOLS FUNCTION the
// SELECTION will take over and if a user make a rectangular window it will
// SELECT all the FENSTRATIONS in the rectangle so the user can delete them all
// at once" -- "same with WALLS and LINES", dimensions too ("the SELCT
// rectangle will be able to select dimensions to delete"). "don't move them,
// copy them"; "ONLY 1 at a time"; "escape or press S or SELECT again"; a
// kitchen or bath button picks only its own kind.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const P = (x, z) => ({ x, y: 0, z });
const drawing = () => ({
  version: 1, board: 'drafting',
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0, nextDrawingItemId: 50,
  walls: [{ id: 'n', start: P(-10, 0), end: P(10, 0), levelId: 3, view: 'plan',
    wallType: 'stud_2x4', refLine: 'center', baseHeight: 0, topHeight: 8 }],
  lines: [{ id: 'l1', start: P(-10, 6), end: P(10, 6), levelId: 3, view: 'plan' }],
  fenestrations: [
    { id: 'win-1', wallId: 'n', levelId: 3, view: 'plan', type: 'window', offset: 5, width: 3, sillHeight: 3, headHeight: 6.67 },
    { id: 'win-2', wallId: 'n', levelId: 3, view: 'plan', type: 'window', offset: 15, width: 3, sillHeight: 3, headHeight: 6.67 },
  ],
  fixtures: [
    { id: 'sk', wallId: 'n', levelId: 3, view: 'plan', kind: 'sink', offset: 9, width: 2.5, depth: 2, side: 1 },
    { id: 'loo', wallId: 'n', levelId: 3, view: 'plan', kind: 'toilet', offset: 12, width: 1.7, depth: 2.4, side: 1 },
  ],
  dimensions: [{ id: 41, start: P(-10, -3), end: P(10, -3), levelId: 3, view: 'plan', layer: 'A-DIMS-HAND', auto: false }],
  floors: [], roofs: [], outlines: [], shapes: [], surfaceOpenings: [], notes: [], stairs: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [],
});

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing() });
  await page.goto('/MODEL.html?left=1&lpane=build');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.keyboard.press('0');
  await page.waitForTimeout(200);
  // OUT TO 20-30 PX A FOOT, so the whole drawing sits clear of the open rail.
  const box = await page.locator('#plan').boundingBox();
  for (let i = 0; i < 12; i++) {
    const { scale } = await h.planFrame(page);
    if (scale >= 20 && scale <= 30) break;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, scale > 30 ? 120 : -120);
    await page.waitForTimeout(120);
  }
  return h.planFrame(page);
}
async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}
// THE WHOLE DRAWING IN A BLUE BOX, left to right, from open sheet.
async function boxAll(page, at) {
  const a = at(-13, -6), b = at(13, 9);
  await page.mouse.move(...a);
  await page.mouse.down();
  await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 4 });
  await page.mouse.move(...b, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}
const bar = (page, id) => page.locator(`[data-bar-key="${id}"]`);
const key = (page, id) => page.locator(`[data-tool-key="${id}"]`);

test('the four keys are copied over the tabs, and the DRAFTING pane keeps its own', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-bar-key]')).toHaveCount(4);
  for (const id of ['select', 'assembly', 'dimension', 'trim']) await expect(bar(page, id)).toBeVisible();
  // ON THE BUILD TAB TOO, which is where the drafter opened.
  await expect(key(page, 'fenestration')).toBeVisible();
  await h.showLeftPane(page, 'drafting');
  for (const id of ['select', 'assembly', 'dimension', 'trim']) await expect(key(page, id)).toHaveCount(1);
  // A BAR KEY IS THE SAME TOOL: DIMENSION armed from the bar lights both.
  await bar(page, 'dimension').click();
  await expect(key(page, 'dimension')).toHaveAttribute('aria-pressed', 'true');
  await expect(bar(page, 'dimension')).toHaveAttribute('aria-pressed', 'true');
});

// UNDER THE TOP BAR, FLUSH LEFT (Movie, 20 Oct: "the SELECT ASSEMBLY TRIM
// DIMENSIONS - new buttons overlap the tab - we should push those so they are
// right underneath the top bar and could also be pushed fully to the left (i
// might add more buttons to it"). The bar stood with its foot on the tabs'
// head; now it hangs 4px under the strip on the page's left edge, and a
// fifth key goes beside the fourth rather than into a row that reaches the
// tabs again.
test('the bar hangs under the top bar on the left edge, clear of the tabs, and grows sideways', async ({ page }) => {
  await open(page);
  const box = await page.locator('#select-bar').boundingBox();
  const tab = await page.locator('#left-tab').boundingBox();
  const strip = await page.locator('#strip').boundingBox();
  expect(box.x, 'flush left').toBe(0);
  expect(box.y, 'right under the top bar').toBeGreaterThanOrEqual(strip.y + strip.height);
  // ...and since 24 Oct on the AUTO DIMS row, under the strip's words
  // (select-bar-seat.spec.js): no further down than that row.
  expect(box.y, 'and not far under it').toBeLessThan(strip.y + strip.height + 24);
  expect(box.y + box.height, 'clear of the tabs').toBeLessThanOrEqual(tab.y - 8);
  // A FIFTH KEY GOES BESIDE THE FOURTH.
  await page.evaluate(() => {
    const keys = document.querySelector('#select-bar .tool-keys');
    const more = keys.lastElementChild.cloneNode(true);
    more.dataset.barKey = 'probe';
    keys.append(more);
  });
  const grown = await page.locator('#select-bar').boundingBox();
  expect(grown.height, 'one row still').toBe(box.height);
  expect(grown.width, 'wider by a key').toBeGreaterThan(box.width + 30);
});

test('SELECT, then FENESTRATION: the box takes only the windows, and DELETE takes them all', async ({ page }) => {
  const { at } = await open(page);
  await bar(page, 'select').click();
  await expect(bar(page, 'select')).toHaveAttribute('data-picking', '');
  await key(page, 'fenestration').click();
  await expect(key(page, 'fenestration'), 'it glows').toHaveAttribute('data-picked', '');
  await expect(key(page, 'fenestration'), 'and is not armed to draw').toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#strip-message')).toContainText('DOORS AND WINDOWS');
  await boxAll(page, at);
  await page.locator('#delete').click();
  const d = await saved(page);
  expect(d.fenestrations, 'both windows gone').toHaveLength(0);
  expect(d.walls.map(w => w.id), 'the wall they were in stays').toEqual(['n']);
  expect(d.lines).toHaveLength(1);
  expect(d.fixtures).toHaveLength(2);
  expect(d.dimensions).toHaveLength(1);
});

test('one kind at a time: another key swaps, the lit one lets go', async ({ page }) => {
  await open(page);
  await bar(page, 'select').click();
  await key(page, 'wall').click();
  await expect(key(page, 'wall')).toHaveAttribute('data-picked', '');
  await h.showLeftPane(page, 'drafting');
  await key(page, 'line').click();
  await expect(key(page, 'line')).toHaveAttribute('data-picked', '');
  await expect(page.locator('[data-picked]'), 'only LINE glows').toHaveCount(1);
  await expect(page.locator('[data-sel-filter="line"]'), 'the LINE chip reads it').toHaveAttribute('aria-pressed', 'true');
  await key(page, 'line').click();
  await expect(page.locator('[data-picked]')).toHaveCount(0);
  await expect(bar(page, 'select'), 'still picking').toHaveAttribute('data-picking', '');
});

// A PLAIN BOX TAKES THE DIMENSIONS TOO (Movie, 25 Oct: "i'd like to be able
// to SELECT the DIMS with the RECTANGULAR selection thingy ,, without needing
// to choose SELECT & DIMENSION"); DIMENSION picked takes them alone.
test('DIMENSION picked: the box takes only the dimensions; a plain box takes them with the rest', async ({ page }) => {
  const { at } = await open(page);
  // A PLAIN BOX FIRST: the dimension goes with everything else.
  await boxAll(page, at);
  await page.locator('#delete').click();
  let d = await saved(page);
  expect(d.dimensions, 'a plain box takes the dimension').toHaveLength(0);
  expect(d.walls).toHaveLength(0);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  d = await saved(page);
  expect(d.dimensions, 'UNDO puts it back').toHaveLength(1);
  await bar(page, 'select').click();
  await bar(page, 'dimension').click();
  await expect(bar(page, 'dimension'), 'the bar key glows too').toHaveAttribute('data-picked', '');
  await boxAll(page, at);
  await page.locator('#delete').click();
  d = await saved(page);
  expect(d.dimensions, 'the dimension boxed and deleted').toHaveLength(0);
  expect(d.walls, 'the wall stays').toHaveLength(1);
  expect(d.lines).toHaveLength(1);
});

test('a kitchen or bath button picks only its own kind; FIXTURE picks them all', async ({ page }) => {
  const { at } = await open(page);
  await bar(page, 'select').click();
  const sink = page.locator('[data-fixture-kind="sink"]');
  await sink.click();
  await expect(sink).toHaveAttribute('data-picked', '');
  await expect(key(page, 'fixture'), 'not every fixture').not.toHaveAttribute('data-picked', '');
  await boxAll(page, at);
  await page.locator('#delete').click();
  let d = await saved(page);
  expect(d.fixtures.map(f => f.kind), 'the sink went, the toilet stays').toEqual(['toilet']);
  await key(page, 'fixture').click();
  await boxAll(page, at);
  await page.locator('#delete').click();
  d = await saved(page);
  expect(d.fixtures).toHaveLength(0);
  expect(d.fenestrations).toHaveLength(2);
});

test('Esc, S, or SELECT again ends it, and the keys draw again', async ({ page }) => {
  await open(page);
  const picking = bar(page, 'select');
  for (const end of ['Escape', 's', 'bar']) {
    await picking.click();
    await key(page, 'wall').click();
    await expect(picking).toHaveAttribute('data-picking', '');
    if (end === 'bar') await picking.click();
    else {
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.keyboard.press(end);
    }
    await expect(picking, `${end} ends it`).not.toHaveAttribute('data-picking', '');
    await expect(page.locator('[data-picked]')).toHaveCount(0);
    await expect(page.locator('[data-sel-filter="wall"]'), 'and lets the kind go').toHaveAttribute('aria-pressed', 'false');
  }
  await key(page, 'wall').click();
  await expect(key(page, 'wall'), 'WALL draws again').toHaveAttribute('aria-pressed', 'true');
});

test('a key with no kind -- TRIM from the bar -- arms its tool and ends the picking', async ({ page }) => {
  await open(page);
  await bar(page, 'select').click();
  await key(page, 'wall').click();
  await bar(page, 'trim').click();
  await expect(bar(page, 'trim')).toHaveAttribute('aria-pressed', 'true');
  await expect(bar(page, 'select')).not.toHaveAttribute('data-picking', '');
  await expect(page.locator('[data-picked]')).toHaveCount(0);
});
