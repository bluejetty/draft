// CLICK AGAIN FOR WHAT IS UNDERNEATH (Movie, 6 Nov: "when 2 things are on
// top of each other when i select it the 2nd time i'd like to scroll the
// selection to pick the 2nd item or third etc").
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const FIXTURE = {
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [],
  // FOUR LINES ON ONE EDGE OF AN OUTLINE: a lone one first in the list,
  // then an assembly of three, two of which (l-top, l-twin) lie on the same
  // run -- so the click-again has to step INSIDE the assembly as well as
  // between it, the lone line and the outline.
  lines: [
    { id: 'l-under', start: V(-6, -10), end: V(6, -10), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 },
    { id: 'l-top', start: V(-4, -10), end: V(4, -10), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 },
    { id: 'l-leg', start: V(4, -10), end: V(4, -2), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 },
    { id: 'l-twin', start: V(-3, -10), end: V(3, -10), levelId: 3, view: 'plan', layer: 'draft', bulge: 0 },
  ],
  outlines: [{ id: 'o-1', levelId: 3, view: 'plan', points: [V(-10, -10), V(10, -10), V(10, 10), V(-10, 10)] }],
  groups: [{ id: 'g-1', name: 'LINES 1', fixed: true, stretchBehavior: 'rigid',
    members: [{ type: 'line', id: 'l-top' }, { type: 'line', id: 'l-leg' }, { type: 'line', id: 'l-twin' }] }],
  floors: [], roofs: [], fenestrations: [], dimensions: [],
  shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [],
  columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  levelLocks: [], underlays: [],
  board: 'drafting',
};

async function open(page, saved = FIXTURE) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, file }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(file)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, file: saved });
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('[data-sel-mode]').first()).toBeVisible();
}
const at = async (page, x, z) => {
  const box = await page.locator('#plan').boundingBox();
  const scale = await page.evaluate(() => Number(
    /scale ([\d.]+) px\/ft/.exec(document.getElementById('readout').textContent)[1]));
  return [box.x + box.width / 2 + x * scale, box.y + box.height / 2 + z * scale];
};
const picked = page => page.evaluate(() => selection.map(s => `${s.type}:${s.item.id}`).sort());

const strip = page => page.evaluate(() => stripNotice);
const objTitle = page => page.locator('[data-objprop-title]').textContent();

test('click again on the same spot steps through every stacked thing, lines of the same kind and of the same assembly included, and round again', async ({ page }) => {
  await open(page);
  await page.keyboard.press('s');
  const { at: f } = await h.planFrame(page);
  const [x, y] = f(0, -10);
  const GROUP = ['line:l-leg', 'line:l-top', 'line:l-twin'];
  // OBJ / PROP open, so each step can be read off it (Movie, 6 Nov).
  await page.locator('#objprop-tab').click();
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  // The line painted last (the last record) is on top, so it is first --
  // and it brings its assembly.
  expect(await picked(page)).toEqual(GROUP);
  expect(await strip(page)).toContain('1 OF 4 HERE: LINE');
  expect(await objTitle(page)).toContain('LINE');
  // A HAND'S SECOND CLICK LANDS A FEW PIXELS OFF: still the same spot. The
  // next one down is the assembly's other line on this run: the same hand,
  // and the strip says the cycle moved.
  await page.mouse.click(x + 6, y - 5);
  await page.waitForTimeout(150);
  expect(await picked(page), 'the same assembly, by its other line').toEqual(GROUP);
  expect(await strip(page)).toContain('2 OF 4 HERE: LINE');
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  expect(await picked(page), 'the lone line under them').toEqual(['line:l-under']);
  expect(await strip(page)).toContain('3 OF 4 HERE: LINE');
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  expect(await picked(page)).toEqual(['outline:o-1']);
  expect(await strip(page)).toContain('4 OF 4 HERE: OUTLINE');
  expect(await objTitle(page), 'OBJ / PROP names a kind with no panel').toContain('OUTLINE');
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  expect(await picked(page), 'and round to the first again').toEqual(GROUP);
  expect(await strip(page)).toContain('1 OF 4 HERE: LINE');
  // SOMEWHERE ELSE IS A FRESH CLICK: the top thing there.
  const [x2, y2] = f(4, -6);
  await page.mouse.click(x2, y2);
  await page.waitForTimeout(150);
  expect(await picked(page)).toEqual(GROUP);
});

test('ORDER: TO FRONT paints the held thing last of its kind and a click takes it first; TO BACK the reverse; UNDO puts the order back', async ({ page }) => {
  await open(page);
  await page.keyboard.press('s');
  const { at: f } = await h.planFrame(page);
  const order = () => page.evaluate(() => drawing.lines.map(l => l.id));
  const [x, y] = f(0, -10);
  // Step down to the lone line, which is first in the list -- under the lot.
  for (let i = 0; i < 3; i += 1) { await page.mouse.click(x, y); await page.waitForTimeout(150); }
  expect(await picked(page)).toEqual(['line:l-under']);
  await expect(page.locator('#model-order')).toBeVisible();
  await page.locator('#model-order').click();
  await expect(page.locator('#order-bar')).toBeVisible();
  await page.locator('[data-order-front]').click();
  await page.waitForTimeout(100);
  expect(await order()).toEqual(['l-top', 'l-leg', 'l-twin', 'l-under']);
  expect(await strip(page)).toContain('to the front');
  // A FRESH CLICK where they stack now takes it first.
  // (z = -4 is on the sheet: the view sits on the drawn bounds, and z = 0 is below the foot.)
  const [x2, y2] = f(0, -4);
  await page.mouse.click(x2, y2);
  await page.waitForTimeout(100);
  expect(await picked(page), 'the empty click put the selection down').toEqual([]);
  await page.mouse.click(x, y);
  await page.waitForTimeout(150);
  expect(await picked(page)).toEqual(['line:l-under']);
  await page.locator('#model-order').click();
  await page.locator('[data-order-back]').click();
  await page.waitForTimeout(100);
  expect(await order()).toEqual(['l-under', 'l-top', 'l-leg', 'l-twin']);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  expect(await order()).toEqual(['l-top', 'l-leg', 'l-twin', 'l-under']);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(100);
  expect(await order()).toEqual(['l-under', 'l-top', 'l-leg', 'l-twin']);
});
