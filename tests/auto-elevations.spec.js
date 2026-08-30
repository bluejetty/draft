const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const CUT_RED = [176, 64, 96];

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await h.clickWorld(page, -8, -6);
  await page.waitForTimeout(300);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

test.describe('Standard E1-E4 elevations', () => {
  test('the four elevations place themselves around the built house', async ({ page }) => {
    await h.openModel(page, { webgl: false });

    // No walls yet — no marks.
    expect(await page.locator('.cut-row').count()).toBe(0);

    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    const sides = { E1: 'FRONT', E2: 'LEFT', E3: 'BACK', E4: 'RIGHT' };
    for (const [name, side] of Object.entries(sides)) {
      const row = page.locator('.cut-row', { hasText: name });
      await expect(row).toHaveCount(1);
      // Each row wears its office side name as a plain label — renaming
      // lives in COMPANY STANDARDS.
      await expect(row.locator('.cut-side')).toHaveText(side);
      // Standard elevations aren't deletable — the × stays hidden.
      await expect(row.locator('.cut-del')).toBeHidden();
    }

    // They are generated, not stored: the saved drawing has no cuts.
    const saved = await h.savedDrawing(page);
    expect(saved.cuts).toEqual([]);
  });

  test('E1 sits below the plan looking up; E4 right looking left', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    // E1's cut line runs along the bottom of the model area (larger z in
    // world terms) with the viewer standing south of it. The marks stand
    // 2' outside the outermost dimension string on their side (board #263)
    // — clear of the strings, unlike the tucked S marks.
    const saved = await h.savedDrawing(page);
    const dimS = Math.max(...saved.dimensions.flatMap(d => [d.start.z, d.end.z]));
    const dimE = Math.max(...saved.dimensions.flatMap(d => [d.start.x, d.end.x]));
    expect(dimS).toBeGreaterThan(6);
    expect(dimE).toBeGreaterThan(8);

    const south = await h.worldToClient(page, 0, dimS + 2);
    const pixels = await h.overlayPixels(page, south.x, south.y, 8);
    expect(h.countColor(pixels, CUT_RED)).toBeGreaterThan(0);

    const east = await h.worldToClient(page, dimE + 2, 0);
    const eastPixels = await h.overlayPixels(page, east.x, east.y, 8);
    expect(h.countColor(eastPixels, CUT_RED)).toBeGreaterThan(0);

    // And the old tucked spot inside the strings is clear of cut ink now.
    const tucked = await h.worldToClient(page, 0, 6.75);
    const tuckedPixels = await h.overlayPixels(page, tucked.x, tucked.y, 8);
    expect(h.countColor(tuckedPixels, CUT_RED)).toBe(0);

    // Opening E1 renders a generated elevation with real ink.
    await page.locator('.cut-row', { hasText: 'E1' }).click({ position: { x: 18, y: 8 } });
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');
    const census = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const { data } = canvas.getContext('2d')
        .getImageData(0, 0, canvas.width, canvas.height);
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) ink += 1;
      }
      return ink;
    });
    expect(census).toBeGreaterThan(1200);
  });

  test('E4 fills the gable-end wall up to the rakes', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await page.waitForTimeout(1200);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await h.waitForSaved(page);

    // Tag the RIGHT roof edge GABLE — the rectangle's roof edge stands one
    // 2' overhang past the x=8 wall.
    await page.locator('.level-row', { hasText: 'ROOF' }).locator('.level-name').click();
    await page.waitForTimeout(300);
    await h.selectTool(page, 'Roof');
    await h.clickWorld(page, 10, 0);
    await h.waitForSaved(page);

    await page.locator('.cut-row', { hasText: 'E4' }).click({ position: { x: 18, y: 8 } });
    await page.waitForTimeout(600);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E4');

    // The gable-end wall climbs to the roof: the pure-white face (#fff,
    // apart from the #fafafa sheet) peaks just under the ridge instead of
    // stopping at the plate and leaving sky beneath the rakes.
    const tops = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const { width, height } = canvas;
      const { data } = canvas.getContext('2d').getImageData(0, 0, width, height);
      let inkTop = null, whiteTop = null;
      // Start below the header text; ink is the ridge, white the wall peak.
      for (let y = 30; y < height && (inkTop === null || whiteTop === null); y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (data[i + 3] === 0) continue;
          const r = data[i], g = data[i + 1], b = data[i + 2];
          if (inkTop === null && r < 120 && g < 120 && b < 120) inkTop = y;
          if (whiteTop === null && r >= 253 && g >= 253 && b >= 253) whiteTop = y;
        }
      }
      return { inkTop, whiteTop };
    });
    expect(tops.inkTop).not.toBeNull();
    expect(tops.whiteTop).not.toBeNull();
    // Before the fix the wall stopped a whole gable rise below the ridge —
    // roughly 70px of bare sheet; the filled gable leaves only line widths.
    expect(tops.whiteTop - tops.inkTop).toBeLessThan(25);
  });

  test('a click anywhere on the row opens the view — even on the side name', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    // The side name covers most of the row; a click on it opens the view
    // like the rest of the row does — it's a label, not a text box.
    const side = page.locator('.cut-row', { hasText: 'E2' }).locator('.cut-side');
    await side.click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E2');
  });

  test('clicking the active level card leaves a cut view back to plan', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    await page.locator('.cut-row', { hasText: 'E1' }).click({ position: { x: 18, y: 8 } });
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');

    await page.locator('.level-row.active').locator('.level-body').click();
    await expect(page.locator('[data-model-title-detail]').last()).not.toHaveText('E1');
  });

  test('turning the standard off in COMPANY STANDARDS removes the marks', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);
    await expect(page.locator('.cut-row')).toHaveCount(4);

    await page.goto('/STANDARDS.html');
    const toggle = page.locator('[data-auto-elevations]');
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await expect(page.locator('#status')).toContainText('Standard elevations are off');

    await page.goto('/MODEL.dc.html');
    await expect(page.locator('[data-model-canvas]')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator('.cut-row')).toHaveCount(0);
  });

  test('STANDARDS sets the office default side names', async ({ page }) => {
    await page.goto('/STANDARDS.html');
    const e1 = page.locator('[data-elevation-name="E1"]');
    await expect(e1).toHaveValue('FRONT');
    await e1.fill('SOUTH');
    await e1.press('Enter');
    await expect(page.locator('#status')).toContainText('E1 is the SOUTH elevation');

    await page.reload();
    await expect(page.locator('[data-elevation-name="E1"]')).toHaveValue('SOUTH');

    await page.locator('#reset').click();
    await expect(page.locator('[data-elevation-name="E1"]')).toHaveValue('FRONT');
  });
});

test('GABLE CORNER treatments add their metal linework to the E4 corners (board #252)', async ({ page }) => {
  // One scenario, three finishes: build the E4 gable once, then re-open it
  // under each corner standard and census the drawing ink. FLAT CLOSE is
  // the baseline; PORK CHOP adds the two wall seams; FULL BOXED RAKE adds
  // the inner soffit lines running the whole rake — each strictly more ink.
  await h.openModel(page, { webgl: false });
  await drawOutlineRect(page);
  await buildHouse(page);
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await h.waitForSaved(page);
  await page.locator('.level-row', { hasText: 'ROOF' }).locator('.level-name').click();
  await page.waitForTimeout(300);
  await h.selectTool(page, 'Roof');
  await h.clickWorld(page, 10, 0);
  await h.waitForSaved(page);

  const inkFor = async style => {
    await page.evaluate(s => {
      const m = window.DraftProfileManager;
      m.saveActive(m.createPackage('standards', 'test', { model: { structureStandards: { gableCorner: s } } }));
    }, style);
    await page.reload();
    await h.waitForModelReady(page);
    await page.locator('.cut-row', { hasText: 'E4' }).click({ position: { x: 18, y: 8 } });
    await page.waitForTimeout(700);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E4');
    return page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const { width, height } = canvas;
      const { data } = canvas.getContext('2d').getImageData(0, 0, width, height);
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) ink += 1;
      }
      return ink;
    });
  };

  const flat = await inkFor('flat');
  const porkchop = await inkFor('porkchop');
  const boxed = await inkFor('boxed');
  expect(porkchop).toBeGreaterThan(flat + 10);   // the two wall seams
  expect(boxed).toBeGreaterThan(porkchop + 100); // the full inner rake lines
});
