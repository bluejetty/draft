// The STAIR layer set (below FLOOR on every floor card) opens a locked,
// framed workspace around the level's stair: the auto-generated carpenter
// section on top, the down-view plan below, sharing one horizontal scale so
// the nosings line up. Clicking a pane fills the screen with it; clicking
// again restores the split. The stair stays one semantic unit on A-STR —
// nothing draws or edits here.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const STAIR_STROKE = [93, 74, 138];  // #5d4a8a
const EMPHASIS = [176, 64, 80];      // #b04050 opening edge + landing marks

function levelRow(page, name) {
  return page.locator('.level-row').filter({ has: page.locator('.level-name', { hasText: name }) });
}

async function useLayerView(page, level, view) {
  await levelRow(page, level).locator('.level-body').click();
  await levelRow(page, level).locator('.level-layer', { hasText: view }).first().click();
}

async function placeStair(page, level = 'MAIN FL') {
  await useLayerView(page, level, 'PLAN');
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, 0, 0);
  await h.clickWorld(page, 5, 0);
  await h.waitForSaved(page);
}

// Colour counting over a whole region of the overlay canvas (client coords).
async function regionColor(page, [r, g, b], x0, y0, x1, y1, tol = 26) {
  return page.evaluate(({ r, g, b, x0, y0, x1, y1, tol }) => {
    const canvas = document.querySelector('[data-model-overlay]');
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px0 = Math.max(0, Math.round((x0 - rect.left) * scaleX));
    const py0 = Math.max(0, Math.round((y0 - rect.top) * scaleY));
    const pw = Math.min(canvas.width - px0, Math.round((x1 - x0) * scaleX));
    const ph = Math.min(canvas.height - py0, Math.round((y1 - y0) * scaleY));
    const data = canvas.getContext('2d').getImageData(px0, py0, pw, ph).data;
    let count = 0, minX = null;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      if (Math.abs(data[i] - r) <= tol && Math.abs(data[i + 1] - g) <= tol
        && Math.abs(data[i + 2] - b) <= tol) {
        count += 1;
        const x = (i / 4) % pw;
        if (minX === null || x < minX) minX = x;
      }
    }
    return { count, minX };
  }, { r, g, b, x0, y0, x1, y1, tol });
}

test('floor cards get a STAIR layer set below FLOOR; FOUNDATION does not', async ({ page }) => {
  await h.openModel(page);
  const mainLayers = levelRow(page, 'MAIN FL').locator('.level-layer');
  await expect(mainLayers).toHaveText(['ELECTRIC', 'FLOOR PLAN (WALLS)', 'FLOOR LAYOUT (FLOOR)', 'STAIR']);
  await expect(levelRow(page, '2ND FL').locator('.level-layer', { hasText: 'STAIR' })).toHaveCount(1);
  await expect(levelRow(page, 'FOUNDATION').locator('.level-layer', { hasText: 'STAIR' })).toHaveCount(0);
});

test('the STAIR workspace locks drawing tools and reports the empty level', async ({ page }) => {
  await h.openModel(page);
  await useLayerView(page, 'MAIN FL', 'STAIR');
  for (const tool of ['Wall', 'Stair', 'Line', 'Dimension']) {
    await expect(page.getByRole('button', { name: new RegExp(`\\b${tool}\\b`, 'i') }).first()).toBeDisabled();
  }
  // No stair yet: no stair linework and no emphasis marks drawn.
  const box = await page.locator('[data-model-canvas]').boundingBox();
  const all = await regionColor(page, STAIR_STROKE, box.x, box.y, box.x + box.width, box.y + box.height);
  expect(all.count).toBe(0);
});

test('section over plan: both panes drawn with the opening edge aligned', async ({ page }) => {
  await h.openModel(page);
  await placeStair(page);
  await useLayerView(page, 'MAIN FL', 'STAIR');
  const box = await page.locator('[data-model-canvas]').boundingBox();
  const midY = box.y + box.height / 2;

  // Section pane (top half): stair linework plus the emphasised opening edge
  // and landing surface.
  const sectionStair = await regionColor(page, STAIR_STROKE, box.x, box.y, box.x + box.width, midY);
  const sectionMarks = await regionColor(page, EMPHASIS, box.x, box.y, box.x + box.width, midY);
  expect(sectionStair.count).toBeGreaterThan(0);
  expect(sectionMarks.count).toBeGreaterThan(0);

  // Plan pane (bottom half): same, framed to the same horizontal scale.
  const planStair = await regionColor(page, STAIR_STROKE, box.x, midY, box.x + box.width, box.y + box.height);
  const planMarks = await regionColor(page, EMPHASIS, box.x, midY, box.x + box.width, box.y + box.height);
  expect(planStair.count).toBeGreaterThan(0);
  expect(planMarks.count).toBeGreaterThan(0);

  // The opening-edge marks start at the same x in both panes — the shared
  // horizontal scale keeps the nosings lined up between section and plan.
  // Read above the floor below: its line runs the pane's whole width now
  // (jb, 19 Nov: "draw the slab all the way").
  const sectionEdge = await regionColor(page, EMPHASIS, box.x, box.y, box.x + box.width, box.y + (midY - box.y) * 0.6);
  expect(sectionEdge.count).toBeGreaterThan(0);
  expect(Math.abs(sectionEdge.minX - planMarks.minX)).toBeLessThanOrEqual(2);
});

test('clicking a pane fills the screen with it; clicking again splits back', async ({ page }) => {
  await h.openModel(page);
  await placeStair(page);
  await useLayerView(page, 'MAIN FL', 'STAIR');
  const box = await page.locator('[data-model-canvas]').boundingBox();
  const topQuarter = () => regionColor(page, EMPHASIS, box.x, box.y, box.x + box.width, box.y + box.height / 4);

  // Split: the section pane's emphasis marks sit in the top quarter.
  expect((await topQuarter()).count).toBeGreaterThan(0);

  // Click the bottom pane: the plan fills the screen, centred — nothing of
  // the section remains up top.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.75);
  await page.waitForTimeout(200);
  expect((await topQuarter()).count).toBe(0);

  // Click again: back to the split with the section on top.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(200);
  expect((await topQuarter()).count).toBeGreaterThan(0);
});

// jb, 19 Nov, on his GIMP markup of the STAIR SECTION: "lengthen the stringers
// lik i show (don't cut them off)", "1/2" nosing then 1.5" backing to the
// stair opening edge". Read off drawFlight's own path with a recording pen.
test('stringers run to the landing underside; the top riser is the 1 1/2" backing under a 1/2" nosing', async ({ page }) => {
  await h.openModel(page);
  const got = await page.evaluate(() => {
    const SS = window.DraftStairSection;
    const SG = window.DraftStairGeometry;
    const layout = SG.stairLayout(9);
    const pen = () => {
      const pts = [], boxes = [];
      let fill = null;
      return { pts, boxes,
        beginPath() {}, closePath() {}, fill() {}, stroke() {},
        moveTo(x, y) { pts.push([x, y]); }, lineTo(x, y) { pts.push([x, y]); },
        fillRect(x, y, w, h) { boxes.push({ fill, x, y, w, h }); }, strokeRect() {},
        set fillStyle(v) { fill = v; }, get fillStyle() { return fill; },
        strokeStyle: '', lineWidth: 1 };
    };
    // 1 px = 1 inch, y = -elevation, so the numbers read in inches.
    const uToX = u => u * 12, yOf = e => -e * 12;
    const riseIn = layout.riserIn;
    const onto = pen();
    SS.drawFlight(onto, { u0: 0, e0: 0, risers: 5, ontoLanding: true }, layout, uToX, yOf, SS.PANE_INKS || {});
    const off = pen();
    SS.drawFlight(off, { u0: 0, e0: 0, risers: 5, offLanding: true }, layout, uToX, yOf, SS.PANE_INKS || {});
    const offB = pen();
    SS.drawFlight(offB, { u0: 0, e0: 0, risers: 5, offLanding: true }, layout, uToX, yOf, {},
      { topBacking: { depthFt: 8 / 12 } });
    const top = pen();
    SS.drawFlight(top, { u0: 0, e0: 0, risers: 5 }, layout, uToX, yOf, {}, { topBacking: { depthFt: 1 } });
    return {
      riseIn,
      ontoLowest: Math.max(...onto.pts.map(p => p[1])),
      ontoEnd: onto.pts.filter(p => Math.abs(p[0] - (5 * 10 - 11 - 0.75)) < 0.01).map(p => +p[1].toFixed(3)),
      offBoxes: offB.boxes.filter(b => b.x < -0.01).map(b => ({ x: +b.x.toFixed(3), w: +b.w.toFixed(3), y: +b.y.toFixed(3), h: +b.h.toFixed(3) })),
      offTopUnderLanding: off.pts.filter(p => Math.abs(p[1] - 8) < 0.01).map(p => p[0]),
      topBoxes: top.boxes.filter(b => b.x < -0.01).map(b => ({ x: +b.x.toFixed(3), w: +b.w.toFixed(3), y: +b.y.toFixed(3), h: +b.h.toFixed(3) })),
    };
  });
  // Onto a landing: the stringer foot reaches the landing's 8" underside.
  expect(got.ontoLowest).toBeCloseTo(5 * got.riseIn + 8, 3);
  // Off a landing: the underside climbs back under the landing to its 8"
  // underside, well behind the first riser's face (-1").
  expect(Math.min(...got.offTopUnderLanding)).toBeLessThan(-5);
  // jb, 19 Nov (green circles): the stringer foot stands back under the last
  // riser, at the landing's end, from its top to its underside...
  expect(got.ontoEnd).toEqual(expect.arrayContaining([+(5 * got.riseIn).toFixed(3), +(5 * got.riseIn + 8).toFixed(3)]));
  // ...and a flight off a landing starts from the landing's own backing and
  // nosing, 8" deep, as the top flight starts from the floor's.
  expect(got.offBoxes).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: -2, w: 1.5, y: 0, h: 8 }),
    expect.objectContaining({ x: -0.5, w: 0.5, y: 0 }),
  ]));
  // The top: backing from the opening edge (-2") to -1/2", a foot deep;
  // the nosing from -1/2" to the nosing line.
  expect(got.topBoxes).toEqual(expect.arrayContaining([
    expect.objectContaining({ x: -2, w: 1.5, y: 0, h: 12 }),
    expect.objectContaining({ x: -0.5, w: 0.5, y: 0 }),
  ]));
});
