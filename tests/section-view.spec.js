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

// Cuts name themselves S1, S2, ... — no naming prompt.
async function placeCut(page, z, viewerZ) {
  await page.keyboard.press('c');
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

    await placeCut(page, 0);
    await page.locator('.cut-row', { hasText: 'S1' }).click();
    await page.waitForTimeout(400);

    // The top bar carries the cut name while the section is open.
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('S1');

    // The drawing has real section ink — walls, floor bands, roof profile,
    // elevation marks — and concrete grays from the foundation stack.
    const census = await overlayCensus(page);
    expect(census.ink).toBeGreaterThan(1500);
    expect(census.concrete).toBeGreaterThan(2000);

    // Back to plan: picking a level card restores the level label.
    await page.locator('.level-row').first().locator('.level-body').click();
    await expect(page.locator('[data-model-title-detail]').last()).not.toHaveText('S1');
  });

  test('a cut standing outside the house renders the elevation', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    // The line sits clear of the plan; the viewer looks back at the house.
    await placeCut(page, 12, 18);
    await page.locator('.cut-row', { hasText: 'S1' }).click();
    await page.waitForTimeout(400);

    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('S1');
    const census = await overlayCensus(page);
    // Wall faces, roof silhouette, grade line, dashed foundation — real ink,
    // but no cut-through concrete fills.
    expect(census.ink).toBeGreaterThan(1200);
    expect(census.concrete).toBeLessThan(500);
  });

  test('the elevation shows floor bands, slab, and a projecting footing', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    await placeCut(page, 12, 18);
    await page.locator('.cut-row', { hasText: 'S1' }).click();
    await page.waitForTimeout(400);

    const scan = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const W = canvas.width, H = canvas.height;
      const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
      const at = (x, y) => (y * W + x) * 4;
      const dark = i => data[i + 3] > 0
        && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
      // Floor assembly bands carry the blue-gray section tint.
      let band = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] > 215 && data[i] < 237
          && data[i + 2] > data[i] + 5) band += 1;
      }
      // Grade line: the lowest full-width dark row on the sheet.
      let gradeY = 0;
      for (let y = 0; y < H; y++) {
        let run = 0, best = 0;
        for (let x = 0; x < W; x++) {
          run = dark(at(x, y)) ? run + 1 : 0;
          best = Math.max(best, run);
        }
        if (best > W * 0.6) gradeY = y;
      }
      // Below grade only the dashed foundation draws: the leftmost ink of
      // each row. The footing rows reach further left than the wall rows.
      const mins = [];
      for (let y = gradeY + 4; y < H; y++) {
        for (let x = 60; x < W; x++) {
          const i = at(x, y);
          if (data[i + 3] > 0 && data[i] < 200 && data[i + 1] < 200) {
            mins.push(x);
            break;
          }
        }
      }
      const overallMin = Math.min(...mins);
      const sorted = [...mins].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      return { band, gradeY, overallMin, median };
    });
    // Floor rims read white like the walls on an elevation — no tinted band.
    expect(scan.band).toBe(0);
    expect(scan.gradeY).toBeGreaterThan(0);
    // The dashed footing pops past the foundation wall face.
    expect(scan.median - scan.overallMin).toBeGreaterThanOrEqual(2);
  });

  test('a garage section hangs the grade beam and beds the slab on gravel', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    // Attached garage: an open run welded onto the house's right edge. Its
    // grade beam hangs (32" + plate, top of plate 1'-0" below the house
    // foundation top) instead of running grade-to-footing.
    await h.selectTool(page, 'Outline');
    await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
    await page.keyboard.press('Enter'); // the professor's lesson steps aside
    await h.clickWorld(page, 8, -4);
    await h.clickWorld(page, 20, -4);
    await h.clickWorld(page, 20, 4);
    await h.clickWorld(page, 8, 4);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    // A vertical cut through the garage only: it crosses the two beam legs.
    await page.keyboard.press('c');
    await h.clickWorld(page, 14, -7);
    await h.clickWorld(page, 14, 7);
    await h.clickWorld(page, 20, 0);
    await page.waitForTimeout(400);
    await page.locator('.cut-row', { hasText: 'S1' }).click();
    await page.waitForTimeout(400);

    const scan = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const W = canvas.width, H = canvas.height;
      const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
      const grayAt = i => data[i + 3] > 0
        && data[i] > 185 && data[i] < 218
        && data[i + 1] > 185 && data[i + 1] < 218
        && data[i + 2] > 185 && data[i + 2] < 220;
      // Concrete fills are thick: demand a 4-pixel vertical gray run so the
      // hairline datum grid lines (2 device px on retina) don't register.
      const gray = i => i >= W * 12 && grayAt(i) && grayAt(i - W * 4)
        && grayAt(i - W * 8) && grayAt(i - W * 12);
      // Gravel dots read as isolated mid-tone pixels (ink at ~0.45 alpha).
      const mid = i => data[i + 3] > 0
        && data[i] > 130 && data[i] < 175
        && Math.abs(data[i] - data[i + 1]) < 12 && Math.abs(data[i] - data[i + 2]) < 12;
      // Census the drawing area only: the sheet title and the datum labels
      // along the left margin letter in the same gray as the concrete.
      let grayCount = 0, midCount = 0, grayTop = H, grayBottom = 0;
      for (let y = Math.floor(H * 0.05); y < H; y++) {
        for (let x = Math.floor(W * 0.25); x < W; x++) {
          const i = (y * W + x) * 4;
          if (gray(i)) { grayCount += 1; grayTop = Math.min(grayTop, y); grayBottom = Math.max(grayBottom, y); }
          else if (mid(i)) midCount += 1;
        }
      }
      return { grayCount, midCount, graySpan: grayBottom - grayTop, H };
    });
    // Concrete shows: the two hung beams plus the slab poured over them.
    expect(scan.grayCount).toBeGreaterThan(300);
    // Hung, not grade-to-footing: all the concrete lives in a shallow band.
    expect(scan.graySpan).toBeLessThan(scan.H * 0.3);
    // Under-slab dashes + gravel dots put mid-tone ink under the slab.
    expect(scan.midCount).toBeGreaterThan(40);
  });

  test('a garage elevation keeps the beam a shallow dashed band, no gravel', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await h.selectTool(page, 'Outline');
    await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
    await page.keyboard.press('Enter'); // the professor's lesson steps aside
    await h.clickWorld(page, 8, -4);
    await h.clickWorld(page, 20, -4);
    await h.clickWorld(page, 20, 4);
    await h.clickWorld(page, 8, 4);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    // The cut spans the garage only, standing south of it looking back —
    // the choose click lands on the garage side, the way the view looks.
    await page.keyboard.press('c');
    await h.clickWorld(page, 9, 8);
    await h.clickWorld(page, 22, 8);
    await h.clickWorld(page, 14, 2);
    await page.waitForTimeout(400);
    await page.locator('.cut-row', { hasText: 'S1' }).click();
    await page.waitForTimeout(400);

    const scan = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const W = canvas.width, H = canvas.height;
      const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
      const at = (x, y) => (y * W + x) * 4;
      const dark = i => data[i + 3] > 0
        && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
      const inked = i => data[i + 3] > 0
        && data[i] < 200 && data[i + 1] < 200 && data[i + 2] < 200;
      const grayAt = i => data[i + 3] > 0
        && data[i] > 185 && data[i] < 218
        && data[i + 1] > 185 && data[i + 1] < 218
        && data[i + 2] > 185 && data[i + 2] < 220;
      const gray = i => grayAt(i) && i >= W * 4 && grayAt(i - W * 4);
      // Grade: the lowest row where a dark run crosses most of the sheet.
      let gradeY = 0;
      for (let y = 0; y < H; y++) {
        let run = 0, best = 0;
        for (let x = 0; x < W; x++) {
          run = dark(at(x, y)) ? run + 1 : 0;
          best = Math.max(best, run);
        }
        if (best > W * 0.6) gradeY = y;
      }
      // Deepest ink below grade, and concrete fills (there must be none).
      let deepest = gradeY, grayCount = 0;
      for (let y = Math.floor(H * 0.05); y < H; y++) {
        for (let x = Math.floor(W * 0.25); x < W; x++) {
          const i = at(x, y);
          if (gray(i)) grayCount += 1;
          if (y > gradeY + 2 && inked(i)) deepest = Math.max(deepest, y);
        }
      }
      return { gradeY, deepest, grayCount, H };
    });
    expect(scan.gradeY).toBeGreaterThan(0);
    // The hung beam's dashed band stops well short of basement depth: the
    // sheet still reserves footing depth, so buried ink stays shallow.
    expect(scan.deepest - scan.gradeY).toBeLessThan((scan.H - scan.gradeY) * 0.6);
    // Elevations carry no concrete fills and no gravel bed.
    expect(scan.grayCount).toBeLessThan(100);
  });

  test('an angled elevation cut keeps the roof silhouette smooth', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    // The cut runs at a slant past the house; the viewer looks back at it.
    await page.keyboard.press('c');
    await h.clickWorld(page, -14, 10);
    await h.clickWorld(page, 14, 16);
    await h.clickWorld(page, 0, 22);
    await page.waitForTimeout(400);
    await page.locator('.cut-row', { hasText: 'S1' }).click();
    await page.waitForTimeout(400);

    const profile = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const W = canvas.width, H = canvas.height;
      const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
      const dark = (x, y) => {
        const i = (y * W + x) * 4;
        return data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
      };
      // Topmost dark pixel per column below the header — the roof profile.
      // Margin columns carry elevation-mark labels, so stay in the middle.
      const tops = [];
      for (let x = Math.floor(W * 0.15); x < W * 0.85; x++) {
        for (let y = 24; y < H; y++) {
          if (dark(x, y)) { tops.push({ x, y }); break; }
        }
      }
      return tops;
    });
    expect(profile.length).toBeGreaterThan(100);
    // A hipped silhouette reads up, across, down — direction flips beyond a
    // 2px hysteresis mean squiggle. Allow a few for antialiased corners.
    let dirChanges = 0, dir = 0, ref = profile[0].y;
    profile.forEach(p => {
      const dy = p.y - ref;
      if (Math.abs(dy) <= 2) return;
      const nd = dy > 0 ? 1 : -1;
      if (dir !== 0 && nd !== dir) dirChanges += 1;
      dir = nd;
      ref = p.y;
    });
    expect(dirChanges).toBeLessThanOrEqual(4);
  });

  test('a cut across empty space explains itself instead of drawing', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await placeCut(page, 0);
    await page.locator('.cut-row', { hasText: 'S1' }).click();
    await page.waitForTimeout(400);

    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('S1');
    const census = await overlayCensus(page);
    // Only the header and the guidance line — no walls, no concrete fills.
    expect(census.concrete).toBeLessThan(500);
    expect(census.ink).toBeLessThan(800);
  });
});
