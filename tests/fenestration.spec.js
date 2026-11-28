// FENESTRATION on MODEL.html: the pieces model-html-fenestration.spec.js does
// not already hold. The opening's centre is a snap point for a hand
// dimension, a door hosts on a foundation wall, and A-DOOR / A-GLAZ are
// Company Standard Layers.
//
// Moved from the old page (MODEL.dc.html) to MODEL.html, 28 Nov 2026. The
// rest of the old file has MODEL.html twins: placing, sizes, reload and the
// gap in the wall (model-html-fenestration, model-html-openings), and a
// deleted wall taking its door (model-html-draw-delete).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const V = (x, z) => ({ x, y: 0, z });
const base = extra => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  board: 'drafting',
  walls: [{ id: 'w', start: V(-10, 0), end: V(10, 0), levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' }],
  // A FRAME LINE well clear of the wall, so the plan fits wide enough to aim at.
  lines: [{ id: 1, levelId: 3, view: 'plan', start: V(-30, -20), end: V(30, -20) }],
  floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [], beams: [],
  boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function save(page) {
  await page.locator('#save').click();
  await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
  return h.savedDrawing(page);
}

async function press(page, at, x, z) {
  await page.mouse.move(...at(x, z));
  await page.waitForTimeout(60);
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(60);
}

test('the opening centre is a snap point for dimensions', async ({ page }) => {
  // The door's centre sits at x = 2.1, which is OFF the 2" plan grid (2.0 and
  // 2.1667 are on it), so an end landing on 2.1 came from the opening's
  // centre and not from the grid.
  await h.openEditor(page, {
    drawing: base({ fenestrations: [{ id: 1, wallId: 'w', levelId: 3, view: 'plan', type: 'door',
      layer: 'A-DOOR', offset: 12.1, width: 3, sillHeight: 0, headHeight: 6.67 }] }),
    url: '/MODEL.html?left=1&lpane=drafting', webgl: false,
  });
  await expect(page.locator('#readout')).toContainText('openings 1/1');
  const { at } = await h.planFrame(page);

  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('d');
  await press(page, at, 2.12, 0.1);
  await press(page, at, -10, 0);
  await page.keyboard.press('Enter');
  await press(page, at, -4, -3);
  await page.keyboard.press('Enter');

  const drawing = await save(page);
  expect(drawing.dimensions).toHaveLength(1);
  const dimension = drawing.dimensions[0];
  const ends = [dimension.start.x, dimension.end.x];
  expect(ends.some(x => Math.abs(x - 2.1) < 1e-3), `an end on the door centre, got ${ends}`).toBe(true);
  expect(dimension.view).toBe('plan');
  expect(dimension.auto).not.toBe(true);
});

test('a door opening hosts on an S-FDN foundation wall', async ({ page }) => {
  await h.openEditor(page, {
    drawing: base({
      levels: [{ id: 1, name: 'FOUNDATION', elev: -8 }],
      walls: [{ id: 'f', start: V(-10, 0), end: V(10, 0), levelId: 1, view: 'foundation',
        wallType: 'concrete_8', baseHeight: 0, topHeight: 8, refLine: 'left' }],
      lines: [{ id: 1, levelId: 1, view: 'foundation', start: V(-30, -20), end: V(30, -20) }],
    }),
    url: '/MODEL.html?left=1&lpane=build&right=1', webgl: false,
  });
  await expect(page.locator('#readout')).toContainText('view foundation');
  await h.showLeftPane(page, 'build');
  await page.locator('[data-tool-key="fenestration"]').click();
  const { at } = await h.planFrame(page);
  await page.mouse.click(...at(2, 0));
  await page.waitForTimeout(150);

  const drawing = await save(page);
  expect(drawing.fenestrations).toHaveLength(1);
  const opening = drawing.fenestrations[0];
  expect(opening.wallId).toBe('f');
  expect(opening.view).toBe('foundation');
  expect(opening.layer).toBe('A-DOOR');
});

test('A-DOOR and A-GLAZ are Company Standard Layers', async ({ page }) => {
  await page.goto('/STANDARDS.html');
  await expect(page.locator('[data-layer-name="A-DOOR"]')).toBeVisible();
  await expect(page.locator('[data-layer-name="A-GLAZ"]')).toBeVisible();
  await expect(page.locator('[data-layer-print="A-DOOR"]')).toBeChecked();
  await expect(page.locator('[data-layer-print="A-GLAZ"]')).toBeChecked();
});
