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
  await expect(mainLayers).toHaveText(['ELECTRIC', 'PLAN', 'FLOOR', 'STAIR']);
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
  expect(Math.abs(sectionMarks.minX - planMarks.minX)).toBeLessThanOrEqual(2);
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
