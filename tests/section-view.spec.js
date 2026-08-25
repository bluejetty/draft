// The cut view renders a GENERATED SECTION from the semantic model: the
// level stack sets the elevations, crossed walls stand as stud / concrete
// rectangles, floor assemblies band between the outer walls, foundation
// walls carry footings and the slab, and the roof planes trace a profile.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

async function placeCut(page, name, z, viewerZ) {
  await page.keyboard.press('c');
  page.once('dialog', dialog => dialog.accept(name));
  await h.clickWorld(page, -12, z);
  await h.clickWorld(page, 12, z);
  await h.clickWorld(page, 0, viewerZ ?? z - 6);
  await page.waitForTimeout(400);
}

// Full-canvas pixel census of the generated drawing: dark section ink and
// the concrete grays of the foundation walls / footings / slab. Concrete
// only counts when the pixel above is gray too, so the one-pixel horizontal
// datum grid lines don't register as fills.
async function overlayCensus(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-model-overlay]');
    const W = canvas.width;
    const { data } = canvas.getContext('2d')
      .getImageData(0, 0, W, canvas.height);
    const gray = i => data[i + 3] > 0
      && data[i] > 185 && data[i] < 218
      && data[i + 1] > 185 && data[i + 1] < 218
      && data[i + 2] > 185 && data[i + 2] < 220;
    let ink = 0, concrete = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < 120 && g < 120 && b < 120) ink += 1;
      else if (gray(i) && i >= W * 4 && gray(i - W * 4)) concrete += 1;
    }
    return { ink, concrete };
  });
}

test.describe('Generated section view', () => {
  test('a cut through the house renders the section from the model', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    await placeCut(page, 'SECTION A-A', 0);
    await page.locator('.cut-row').click();
    await page.waitForTimeout(400);

    // The top bar carries the cut name while the section is open.
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('SECTION A-A');

    // The drawing has real section ink — walls, floor bands, roof profile,
    // elevation marks — and concrete grays from the foundation stack.
    const census = await overlayCensus(page);
    expect(census.ink).toBeGreaterThan(1500);
    expect(census.concrete).toBeGreaterThan(2000);

    // Back to plan: picking a level card restores the level label.
    await page.locator('.level-row').first().locator('.level-body').click();
    await expect(page.locator('[data-model-title-detail]').last()).not.toHaveText('SECTION A-A');
  });

  test('a cut standing outside the house renders the elevation', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    // The line sits clear of the plan; the viewer looks back at the house.
    await placeCut(page, 'REAR ELEVATION', 12, 18);
    await page.locator('.cut-row').click();
    await page.waitForTimeout(400);

    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('REAR ELEVATION');
    const census = await overlayCensus(page);
    // Wall faces, roof silhouette, grade line, dashed foundation — real ink,
    // but no cut-through concrete fills.
    expect(census.ink).toBeGreaterThan(1200);
    expect(census.concrete).toBeLessThan(500);
  });

  test('a cut across empty space explains itself instead of drawing', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await placeCut(page, 'SECTION B-B', 0);
    await page.locator('.cut-row').click();
    await page.waitForTimeout(400);

    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('SECTION B-B');
    const census = await overlayCensus(page);
    // Only the header and the guidance line — no walls, no concrete fills.
    expect(census.concrete).toBeLessThan(500);
    expect(census.ink).toBeLessThan(800);
  });
});
