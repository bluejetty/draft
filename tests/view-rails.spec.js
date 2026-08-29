// The view galleries (board #265): little TV-screen viewports down the
// canvas edges — the four standard elevations on the left, hand-cut S
// sections on the right stacked above the 3D screen — plus the stretched
// level cards behind them and the finale's curtain moment.
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
  await h.climbTourToMain(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

// Cuts name themselves S1, S2, ... — no naming prompt.
async function placeCut(page, z) {
  await page.keyboard.press('c');
  await h.clickWorld(page, -12, z);
  await h.clickWorld(page, 12, z);
  await h.clickWorld(page, 0, z - 6);
  await page.waitForTimeout(400);
}

test.describe('Stretched level cards', () => {
  test('cards reach the rail edge and the summaries share one width', async ({ page }) => {
    await h.openModel(page, { webgl: false });

    // Every level card spans the rail — no unused strip on the right.
    const rail = await page.locator('[data-model-right]').boundingBox();
    const rows = page.locator('.level-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(2);
    for (let i = 0; i < count; i++) {
      const row = await rows.nth(i).boundingBox();
      // The rail pads 12px and may wear a scrollbar; the old gap was ~57px.
      expect(rail.x + rail.width - (row.x + row.width)).toBeLessThan(32);
    }

    // WALL PLAN / FLOOR PLAN sit on one line, and every grey summary box is
    // the same short width instead of eating half the row.
    const summaries = page.locator('[data-assembly-summary]');
    const sCount = await summaries.count();
    expect(sCount).toBeGreaterThan(2);
    const widths = [];
    for (let i = 0; i < sCount; i++) {
      const box = await summaries.nth(i).boundingBox();
      widths.push(box.width);
      expect(box.width).toBeLessThan(60);
    }
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);

    for (const name of ['WALL PLAN', 'FLOOR PLAN']) {
      const label = page.locator('.level-layer', { hasText: name }).first();
      const box = await label.boundingBox();
      expect(box.height).toBeLessThan(20); // a wrap would double it
    }
  });
});

test.describe('View galleries', () => {
  test('E1-E4 thumbs stand down the left; empty right shows only the 3D screen', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false });

    // Nothing built — no elevation thumbs, no section thumbs, no fakes.
    await expect(page.locator('[data-view-rail-left] .view-thumb')).toHaveCount(0);
    await expect(page.locator('[data-view-rail-sections] .view-thumb')).toHaveCount(0);
    await expect(page.locator('[data-view-rail-3d]')).toBeVisible();

    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);
    await page.waitForTimeout(400);

    const left = page.locator('[data-view-rail-left] .view-thumb');
    await expect(left).toHaveCount(4);
    for (const name of ['E1', 'E2', 'E3', 'E4']) {
      await expect(page.locator(`[data-view-rail-left] [data-cut-id="${name}"]`)).toBeVisible();
    }
    // Still no section fakes on the right.
    await expect(page.locator('[data-view-rail-sections] .view-thumb')).toHaveCount(0);

    // Each little screen carries real ink — a true miniature, not a blank.
    const ink = await page.evaluate(() => {
      const canvas = document.querySelector('[data-view-rail-left] [data-cut-id="E1"] canvas');
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) count += 1;
      }
      return count;
    });
    expect(ink).toBeGreaterThan(200);

    // Tapping a thumb brings that view center.
    await page.locator('[data-view-rail-left] [data-cut-id="E2"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E2');
    await expect(page.locator('[data-view-rail-left] [data-cut-id="E2"]')).toHaveClass(/active/);
  });

  test('a hand-cut section joins the right rail above the 3D screen', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    await placeCut(page, 0);
    await page.waitForTimeout(400);

    const thumb = page.locator('[data-view-rail-sections] [data-cut-id]').first();
    await expect(thumb).toBeVisible();
    await expect(page.locator('[data-view-rail-sections] .view-thumb')).toHaveCount(1);

    // The section stacks ABOVE the 3D screen — new cuts push it down.
    const thumbBox = await thumb.boundingBox();
    const threeD = await page.locator('[data-view-rail-3d]').boundingBox();
    expect(thumbBox.y + thumbBox.height).toBeLessThanOrEqual(threeD.y + 1);

    // Tapping it brings the section center.
    await thumb.click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('S1');

    // Deleting the cut clears its screen from the rail. The delete row
    // lives on the LEVELS panel, so pull the rails out for it.
    await h.openRails(page);
    await page.locator('.level-row').first().locator('.level-body').click();
    await page.waitForTimeout(300);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('.cut-row', { hasText: 'S1' }).locator('.cut-del').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-view-rail-sections] .view-thumb')).toHaveCount(0);
  });

  test('the inner plan column lists every level and brings its plan center', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false });

    // One little screen per level, top-down, from the start.
    const plans = page.locator('[data-view-rail-plans] .view-thumb-plan');
    await expect(plans).toHaveCount(5);
    const names = ['SITE', 'ROOF', '2ND FL', 'MAIN FL', 'FOUNDATION'];
    for (let i = 0; i < names.length; i++) {
      await expect(plans.nth(i).locator('.view-thumb-label')).toHaveText(names[i]);
    }
    // The plan column stands inward of the sections column, on smaller screens.
    const planBox = await plans.first().boundingBox();
    const threeD = await page.locator('[data-view-rail-3d]').boundingBox();
    expect(planBox.x + planBox.width).toBeLessThanOrEqual(threeD.x + 1);
    expect(planBox.width).toBeLessThan(threeD.width);

    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);
    await page.waitForTimeout(400);

    // Built plans carry real ink in their miniatures.
    const ink = await page.evaluate(() => {
      const canvas = document.querySelector('[data-view-rail-plans] [data-level-id="3"] canvas');
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) count += 1;
      }
      return count;
    });
    expect(ink).toBeGreaterThan(100);

    // From an elevation, tapping a plan thumb brings that plan back center.
    await page.locator('[data-view-rail-left] [data-cut-id="E1"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');
    await page.locator('[data-view-rail-plans] [data-level-id="3"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).not.toHaveText('E1');
    await expect(page.locator('[data-view-rail-plans] [data-level-id="3"]')).toHaveClass(/active/);
  });

  test('open side panels cover the elevation and section screens; the plans keep their seat', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);
    await page.waitForTimeout(400);

    // Rails tucked: the full TV wall stands.
    await expect(page.locator('[data-view-rail-left] [data-cut-id="E1"]')).toBeVisible();
    await expect(page.locator('[data-view-rail-3d]')).toBeVisible();

    // Panels out: only the little plan screens stay on stage.
    await h.openRails(page);
    await page.waitForTimeout(300);
    await expect(page.locator('[data-view-rail-left]')).toBeHidden();
    await expect(page.locator('[data-view-rail-3d]')).toBeHidden();
    await expect(page.locator('[data-view-rail-plans] .view-thumb-plan').first()).toBeVisible();

    // Tuck them again — every screen returns.
    await page.locator('[data-left-rail-tab]').click();
    await page.locator('[data-right-rail-tab]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-view-rail-left] [data-cut-id="E1"]')).toBeVisible();
    await expect(page.locator('[data-view-rail-3d]')).toBeVisible();
  });
});

test.describe('The curtain moment', () => {
  test('the finale bone opens both rails and holds a beat before the house grows', async ({ page }) => {
    await h.openModel(page);

    // The guided tour up to the finale: trace, stairs, rooms, roof, bone.
    await page.locator('[data-select-house]').click();
    await page.keyboard.press('Enter');
    await h.clickWorld(page, -8, -6);
    await h.clickWorld(page, 8, -6);
    await h.clickWorld(page, 8, 6);
    await h.clickWorld(page, -8, 6);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    await page.locator('[data-tour-popup]').click(); // FOUNDATION DONE → MAIN
    await h.selectTool(page, 'Stair');
    await h.clickWorld(page, 2, -2);
    await h.clickWorld(page, 2, 4);
    await h.waitForSaved(page);
    await page.keyboard.press('Enter');
    await page.locator('[data-tour-popup]').click(); // → the rooms pause (#198)
    await page.keyboard.press('Enter'); // the always-lit rooms gate
    await page.locator('[data-tour-popup] [data-tour-next-roof]').click();
    await expect(page.locator('[data-tour-gable]')).toBeVisible();
    await page.locator('[data-tour-next]').click(); // PRESS ▲ BONE
    await page.keyboard.press('Enter');

    // Tuck both rails away — the reveal must open them itself.
    await page.locator('[data-left-rail-tab]').click();
    await expect(page.locator('[data-model-left]')).toBeHidden();
    await page.locator('[data-right-rail-tab]').click();
    await expect(page.locator('[data-model-right]')).toBeHidden();

    await page.locator('[data-build-house]').click();

    // The rails slide open around the stage and E1 takes the center seat.
    await expect(page.locator('[data-model-left]')).toBeVisible();
    await expect(page.locator('[data-model-right]')).toBeVisible();
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');

    // The held beat: half a second in, the mask still covers the sheet —
    // no dark elevation ink has appeared yet.
    await page.waitForTimeout(500);
    const early = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) ink += 1;
      }
      return ink;
    });
    expect(early).toBeLessThan(200); // header text at most

    // After the hold and the climb, the house stands in full ink.
    await page.waitForTimeout(3800);
    const after = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) ink += 1;
      }
      return ink;
    });
    expect(after).toBeGreaterThan(1200);
    await h.waitForSaved(page);
  });
});
