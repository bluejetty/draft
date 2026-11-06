// A SHAPE'S HATCH, LINETYPE, LABEL, AREA AND FLOORING (jb, 6 Nov).
//
// "we need to add some additional properties for AREA / SHAPE -- we need to
// be able to control the shading of what is inside the box and we should
// also allow different types of hatches ... for now put in hatch types
// black, grey, light grey, white, transparent. we will add EARTH hatch
// later. do a newspaper type dot shading hatch with about 25% shading" --
// "also another properties to change for the user is LINETYPE for the
// exterior line. offer all the linetypes we have already" -- "it will double
// as area measurement / room label / flooring which can be turned on and off
// too" -- "room / site label" -- "we have the exterior elevations hatching
// those can go into the 'area' hatches too".
//
// The SHAPE panel offers all of it, a change writes every selected shape in
// one undo, the hatch and linetype picked last are the next shape's, and a
// shape from before today carries none of it and draws as it did.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const square = (x, z, w, d) => [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }];
const S = (id, pts, extra = {}) => ({ id, points: pts, levelId: 3, layer: 'SHAPE', ...extra });
const drawing = (shapes = []) => ({
  version: 1, board: 'drafting', planTurn: 0, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  nextDrawingItemId: 50,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes, surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
const URL = '/MODEL.html?mode=day&level=3&left=1&lpane=drafting';

async function open(page, f, { keepStorage = false } = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f, keep }) => {
    if (!keep) { try { localStorage.removeItem('draft-skin'); } catch { /* fine */ } }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f, keep: keepStorage });
  await page.goto(URL);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function zoomTo(page, target) {
  const box = await page.locator('#plan').boundingBox();
  const { scale } = await h.planFrame(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -Math.log(target / scale) / 0.0015);
  await page.waitForTimeout(120);
  const frame = await h.planFrame(page);
  expect(Math.abs(frame.scale - target)).toBeLessThan(target * 0.05);
  return frame;
}
const saved = async page => {
  await page.keyboard.press('Escape');
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const undo = async page => { await page.keyboard.press('Escape'); await page.locator('#model-undo').click(); await page.waitForTimeout(80); };
// Pick a shape by pressing inside it with SELECT, and wait for its panel.
async function selectShape(page, at, x, z) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(120);
  await expect(page.locator('[data-shape-hatch]').first()).toBeVisible();
}
// THE INK INSIDE: the pixels of a box around a world point, as a count of
// those that are dark (under 90 on every channel), light (over 220 on every
// channel), and the average of the middle pixel. The page's ground is
// sampled well away from everything for the TRANSPARENT check.
const inside = (page, x, z, half) => page.evaluate(([wx, wz, hw]) => {
  const c = document.getElementById('plan');
  const [cx, cz, scale] = c.getAttribute('data-view').trim().split(/\s+/).map(Number);
  const r = c.getBoundingClientRect();
  const dpr = c.width / r.width;
  const px = Math.round(((wx - cx) * scale + r.width / 2) * dpr);
  const py = Math.round(((wz - cz) * scale + r.height / 2) * dpr);
  const g = c.getContext('2d');
  const size = Math.round(hw * dpr);
  const d = g.getImageData(px - size, py - size, size * 2 + 1, size * 2 + 1).data;
  const ground = g.getImageData(4, Math.round(r.height * dpr) - 4, 1, 1).data;
  let dark = 0, light = 0, n = 0, same = 0, ink = 0;
  for (let i = 0; i < d.length; i += 4) {
    n += 1;
    ink += 1 - (d[i] + d[i + 1] + d[i + 2]) / (3 * 255);
    if (d[i] < 90 && d[i + 1] < 90 && d[i + 2] < 90) dark += 1;
    if (d[i] > 220 && d[i + 1] > 220 && d[i + 2] > 220) light += 1;
    if (Math.abs(d[i] - ground[0]) + Math.abs(d[i + 1] - ground[1]) + Math.abs(d[i + 2] - ground[2]) < 12) same += 1;
  }
  const mid = (size * (size * 2 + 1) + size) * 4;
  // `tone` is the mean darkness, 0 for white paper and 1 for solid black:
  // the figure a quarter-ink screen is a quarter of.
  return { dark: dark / n, light: light / n, same: same / n, tone: ink / n, mid: [d[mid], d[mid + 1], d[mid + 2]] };
}, [x, z, half]);

test('the SHAPE panel offers fourteen hatches, four linetypes, a label, SHOW AREA and the floorings; each writes the shape and one UNDO takes it back', async ({ page }) => {
  await open(page, drawing([S('s1', square(0, 0, 10, 8))]));
  const { at } = await zoomTo(page, 40);
  await selectShape(page, at, 5, 4);
  // NONE and the fourteen: the five jb named, the dots, and the eight
  // exterior finishes that put a mark on the sheet.
  await expect(page.locator('[data-shape-hatch]')).toHaveCount(15);
  await expect(page.locator('[data-shape-hatch="dots"]')).toContainText('DOTS 25%');
  await expect(page.locator('[data-shape-hatch="brick"]')).toContainText('BRICK');
  await expect(page.locator('[data-shape-style]')).toHaveCount(4);
  await expect(page.locator('[data-shape-flooring]')).toHaveCount(5);
  await expect(page.locator('[data-shape-label]')).toHaveValue('');
  // A shape from before carries none of it, and reads as what it draws as.
  await expect(page.locator('[data-shape-hatch="none"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-shape-style="dashed"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-shape-area]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-shape-flooring="none"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-shape-hatch="black"]').click();
  await page.locator('[data-shape-style="dotted"]').click();
  await page.locator('[data-shape-area]').click();
  await page.locator('[data-shape-flooring="tile"]').click();
  await page.locator('[data-shape-label]').fill('kitchen');
  await page.locator('[data-shape-label]').press('Enter');
  await page.waitForTimeout(80);
  let d = await saved(page);
  let shape = d.shapes[0];
  expect([shape.hatch, shape.style, shape.showArea, shape.flooring, shape.label, shape.layer])
    .toEqual(['black', 'dotted', true, { type: 'tile', thicknessIn: 3 / 8 }, 'KITCHEN', 'A-FL-FLOORING']);
  // AND THE FILE READ BACK KEEPS THEM: opened afresh, the chips say so.
  await open(page, d, { keepStorage: true });
  const again = await zoomTo(page, 40);
  await selectShape(page, again.at, 5, 4);
  await expect(page.locator('[data-shape-hatch="black"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-shape-style="dotted"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-shape-area]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-shape-flooring="tile"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-shape-label]')).toHaveValue('KITCHEN');
  // Written out again from the file as read, every field is still there.
  shape = (await saved(page)).shapes[0];
  expect([shape.hatch, shape.style, shape.showArea, shape.label]).toEqual(['black', 'dotted', true, 'KITCHEN']);
  // UNDO, one change at a time, back to a shape with none of it.
  await open(page, drawing([S('s1', square(0, 0, 10, 8))]), { keepStorage: true });
  const first = await zoomTo(page, 40);
  await selectShape(page, first.at, 5, 4);
  await page.locator('[data-shape-hatch="grey"]').click();
  await page.locator('[data-shape-style="solid"]').click();
  // NONE TAKES THE HATCH OFF THE RECORD, not to a value spelled 'none'.
  await page.locator('[data-shape-hatch="none"]').click();
  shape = (await saved(page)).shapes[0];
  expect('hatch' in shape).toBe(false);
  await undo(page);
  shape = (await saved(page)).shapes[0];
  expect([shape.hatch, shape.style]).toEqual(['grey', 'solid']);
  await undo(page);
  shape = (await saved(page)).shapes[0];
  expect([shape.hatch, shape.style]).toEqual(['grey', undefined]);
  await undo(page);
  shape = (await saved(page)).shapes[0];
  expect('hatch' in shape || 'style' in shape).toBe(false);
});

test('the ink follows: BLACK is black, WHITE is white, TRANSPARENT is the page, DOTS are a quarter ink, BRICK is coursed', async ({ page }) => {
  await open(page, drawing([
    S('s1', square(0, 0, 10, 8), { hatch: 'black' }),
    S('s2', square(12, 0, 10, 8), { hatch: 'white' }),
    S('s3', square(24, 0, 10, 8), { hatch: 'transparent' }),
    S('s4', square(0, 10, 10, 8), { hatch: 'dots' }),
    // A TRIANGLE, so its bounding box has a corner the shape does not cover.
    S('s5', [{ x: 12, z: 10 }, { x: 22, z: 10 }, { x: 12, z: 18 }], { hatch: 'brick' }),
    S('s6', square(24, 10, 10, 8)),
  ]));
  await zoomTo(page, 20);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const black = await inside(page, 5, 4, 15);
  expect(black.dark, 'BLACK fills solid').toBeGreaterThan(0.98);
  const white = await inside(page, 17, 4, 15);
  expect(white.light, 'WHITE fills solid').toBeGreaterThan(0.98);
  const clear = await inside(page, 29, 4, 15);
  // The page's own grid runs through it, so not every pixel is the ground.
  expect(clear.same, 'TRANSPARENT leaves the page').toBeGreaterThan(0.8);
  // The wash a shape had before today is neither: tinted, not the ground.
  const wash = await inside(page, 29, 14, 15);
  expect(wash.same, 'NONE keeps the tint').toBeLessThan(0.5);
  expect(wash.dark, 'NONE is a tint, not ink').toBeLessThan(0.1);
  // A QUARTER INK: pi r^2 over a 6 px cell, read as the mean darkness so
  // the anti-aliased rims count for what they cover. What it must not be
  // is a wash (no tone) or a block (all tone).
  const dots = await inside(page, 5, 14, 30);
  expect(dots.tone).toBeGreaterThan(0.18);
  expect(dots.tone).toBeLessThan(0.32);
  expect(dots.dark, 'the dots are dots, not a grey').toBeGreaterThan(0.04);
  // Brick at 20 px/ft: 2-5/8" courses are 4.4 px apart, over the gate, so
  // there is ink -- courses, joints and their relief shadow, as the
  // elevation draws them -- and it is not a block.
  const brick = await inside(page, 15, 13, 20);
  expect(brick.same).toBeLessThan(0.7);
  expect(brick.tone, 'brick is darker than bare page').toBeGreaterThan(clear.tone + 0.05);
  expect(brick.tone).toBeLessThan(0.6);
  // AND CLIPPED TO THE SHAPE: the corner of its box the triangle leaves
  // uncovered is bare page.
  const beyond = await inside(page, 20, 16, 10);
  expect(beyond.same, 'no brick outside the triangle').toBeGreaterThan(0.8);
});

test('the label and the area read on the sheet; SHOW AREA off hides the figure', async ({ page }) => {
  await open(page, drawing([
    S('s1', square(0, 0, 10, 8), { label: 'LOT 12', showArea: true }),
    S('s2', square(12, 0, 10, 8), { flooring: { type: 'tile', thicknessIn: 3 / 8 } }),
    S('s3', square(24, 0, 10, 8), { flooring: { type: 'tile', thicknessIn: 3 / 8 }, showArea: false }),
  ]));
  await zoomTo(page, 20);
  const texts = await page.evaluate(() => {
    const seen = [];
    const g = CanvasRenderingContext2D.prototype;
    const was = g.fillText;
    g.fillText = function (text, ...rest) { seen.push(String(text)); return was.call(this, text, ...rest); };
    try { paint(); } finally { g.fillText = was; }
    return seen;
  });
  expect(texts).toContain('LOT 12');
  expect(texts.filter(t => /80 SQ FT/.test(t)), 'the lot and the tile area say 80, the silenced one does not').toHaveLength(2);
  expect(texts.filter(t => /^TILE/.test(t))).toHaveLength(2);
});

test('two shapes picked together take one hatch in one undo, and the next shape drawn is born with it', async ({ page }) => {
  await open(page, drawing([S('s1', square(0, 0, 10, 8)), S('s2', square(12, 0, 10, 8))]));
  // 15 px/ft keeps the third shape, drawn below the two, inside the glass.
  const { at } = await zoomTo(page, 15);
  await selectShape(page, at, 5, 4);
  await page.locator('[data-shape-hatch="black"]').click();
  // THE SECOND ONE JOINS IT, as a window-select would put them together.
  await page.evaluate(() => {
    setSelection(shapes().map(item => ({ type: 'shape', item })));
    showSelectionProps();
  });
  // ONE BLACK AND ONE BARE: no hatch chip is lit, because the chips speak
  // for every shape in hand and the two disagree.
  await expect(page.locator('[data-shape-hatch="black"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-shape-hatch="none"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#props-slot [data-prop-span]')).toHaveText(/TOTAL AREA 160 SQ FT/);
  await page.locator('[data-shape-hatch="lightgrey"]').click();
  let d = await saved(page);
  expect(d.shapes.map(s => s.hatch)).toEqual(['lightgrey', 'lightgrey']);
  await undo(page);
  d = await saved(page);
  expect(d.shapes.map(s => s.hatch)).toEqual(['black', undefined]);
  // THE LAST PICK IS THE NEXT SHAPE'S, as a LINE's weight is: picked again
  // on one shape, then a third shape drawn by hand carries it.
  await selectShape(page, at, 5, 4);
  await page.locator('[data-shape-hatch="dots"]').click();
  await page.locator('[data-shape-style="dotdash"]').click();
  await page.keyboard.press('Escape');
  await h.armFromRail(page, 'shape');
  for (const [x, z] of [[0, 10], [10, 10], [10, 16], [0, 16], [0, 10]]) {
    const [px, py] = at(x, z);
    const under = await page.evaluate(({ px, py }) => document.elementFromPoint(px, py)?.id, { px, py });
    expect(under, `world (${x}, ${z}) must land on the canvas`).toBe('plan');
    await page.mouse.click(px, py);
    await page.waitForTimeout(60);
  }
  d = await saved(page);
  expect(d.shapes).toHaveLength(3);
  expect([d.shapes[2].hatch, d.shapes[2].style]).toEqual(['dots', 'dotdash']);
});
