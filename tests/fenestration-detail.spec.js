// First-pass fenestration detail (#270): plan doors wear a leaf and swing
// arc, windows draw a double-glazed unit, and the projected views show the
// flat slab door (round knob) and the framed window without falling over.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Thin strokes antialias below full ink strength, so count any pixel
// clearly darker than the paper.
async function inkAt(page, x, z, radius = 4) {
  const p = await h.worldToClient(page, x, z);
  const pixels = await h.overlayPixels(page, p.x, p.y, radius);
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 200) continue;
    if (pixels[i] < 170 && pixels[i + 1] < 170 && pixels[i + 2] < 170) count += 1;
  }
  return count;
}

async function drawWall(page) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -10, 0);
  await h.clickWorld(page, 10, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

async function overlayInk(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-model-overlay]');
    const { data } = canvas.getContext('2d')
      .getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) ink += 1;
    }
    return ink;
  });
}

test('a plan door wears its leaf and quarter swing arc', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);

  // Default 3' door centred on (2, 0): hinge jamb at x=0.5, latch at x=3.5.
  // The leaf stands open perpendicular to the wall — ink along x=0.5.
  expect(await inkAt(page, 0.5, 1.5)).toBeGreaterThan(0);
  // The swing arc passes its 45° point at hinge + 3'·(cos45, sin45).
  expect(await inkAt(page, 0.5 + 3 * Math.SQRT1_2, 3 * Math.SQRT1_2, 5)).toBeGreaterThan(0);
  // Inside the swing there is nothing — no fill, no stray strokes.
  expect(await inkAt(page, 1.6, 1.4, 2)).toBe(0);
});

test('a plan window keeps glazing ink on the wall centreline', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawWall(page);
  await h.selectTool(page, 'Fenestration');
  await page.getByRole('button', { name: 'WINDOW', exact: true }).click();
  await h.clickWorld(page, -3, 0);
  await h.waitForSaved(page);

  // Default 4' window centred on (-3, 0): the double glazing runs the
  // centreline; away from the centre grab dot the panes still ink.
  expect(await inkAt(page, -4, 0, 3)).toBeGreaterThan(0);
  // A window never wears a swing arc.
  expect(await inkAt(page, -4, 2, 3)).toBe(0);
});

test('elevations and sections carry the detailed openings without breaking', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await drawOutlineRect(page);
  await buildHouse(page);
  await h.waitForSaved(page);

  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 0, 6);        // door on the front wall
  await page.getByRole('button', { name: 'WINDOW', exact: true }).click();
  await h.clickWorld(page, 4, 6);        // window beside it
  await page.getByRole('button', { name: 'DOOR', exact: true }).click();
  await h.clickWorld(page, 8, 0);        // door on the right wall for the cut
  await h.waitForSaved(page);

  // E1 projects the front face: slab door + knob and the framed window.
  await page.locator('.cut-row', { hasText: 'E1' }).click({ position: { x: 18, y: 8 } });
  await page.waitForTimeout(500);
  expect(await overlayInk(page)).toBeGreaterThan(1500);

  // Back to plan, then a section straight through the right-wall door: the
  // crossed wall paints the flat slab standing in its opening.
  await page.locator('.level-row').first().locator('.level-body').click();
  await page.waitForTimeout(400);
  await page.keyboard.press('c');
  await h.clickWorld(page, -12, 0);
  await h.clickWorld(page, 12, 0);
  await h.clickWorld(page, 0, -6);
  await page.waitForTimeout(400);
  await page.locator('.cut-row', { hasText: 'S1' }).click();
  await page.waitForTimeout(500);
  expect(await overlayInk(page)).toBeGreaterThan(1500);
});
