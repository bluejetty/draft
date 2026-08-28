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
  await h.climbTourToMain(page);
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
      // Deepest ink below grade, and BURIED concrete fills (there must be
      // none — the beam hangs with no gravel bed). The census stays below
      // grade: above it, the house standing BEHIND the garage legitimately
      // shows its floor-assembly band since the garage roof dropped to its
      // own single-storey height (board #245).
      let deepest = gradeY, grayCount = 0;
      for (let y = gradeY + 2; y < H; y++) {
        for (let x = Math.floor(W * 0.25); x < W; x++) {
          const i = at(x, y);
          if (gray(i)) grayCount += 1;
          if (inked(i)) deepest = Math.max(deepest, y);
        }
      }
      return { gradeY, deepest, grayCount, H };
    });
    expect(scan.gradeY).toBeGreaterThan(0);
    // The hung beam's dashed band stops well short of basement depth: the
    // sheet still reserves footing depth, so buried ink stays shallow.
    expect(scan.deepest - scan.gradeY).toBeLessThan((scan.H - scan.gradeY) * 0.6);
    // No buried concrete fills and no gravel bed under the hung beam.
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

  // House + detached garage, then an elevation looking at both from the
  // south. Returns a census split at the gap between the two buildings:
  // the deepest buried ink under each, exposed concrete-face pixels and
  // buried dashed ink over the garage, and any faint datum-line pixels
  // crossing the gap above grade (the house level lines must stop home).
  async function detachedElevationScan(page, foundation) {
    await h.openModel(page, { webgl: false });
    await drawOutlineRect(page);
    await h.selectTool(page, 'Outline');
    await page.getByRole('button', { name: /DETACHED GARAGE/ }).click();
    await h.clickWorld(page, 14, -5);
    await h.clickWorld(page, 26, -5);
    await h.clickWorld(page, 26, 5);
    await h.clickWorld(page, 14, 5);
    await h.clickWorld(page, 14, -5);
    await expect(page.locator('[data-detached-foundation-prompt]')).toBeVisible();
    await page.locator(foundation === 'thickened'
      ? '[data-detached-thickened-edge]' : '[data-detached-grade-beam]').click();
    await h.waitForSaved(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    // The cut spans house and garage; the side click picks the faces the
    // view looks toward, so the north side keeps the house on the left.
    await page.keyboard.press('c');
    await h.clickWorld(page, -12, 10);
    await h.clickWorld(page, 30, 10);
    await h.clickWorld(page, 9, 4);
    await page.waitForTimeout(400);
    await page.locator('.cut-row', { hasText: 'S1' }).click();
    await page.waitForTimeout(400);

    return page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const W = canvas.width, H = canvas.height;
      const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
      const at = (x, y) => (y * W + x) * 4;
      const dark = i => data[i + 3] > 150
        && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
      const inked = i => data[i + 3] > 0
        && data[i] < 200 && data[i + 1] < 200 && data[i + 2] < 200;
      // Datum lines stroke at 0.25 alpha; buried dashes at 0.5; faces solid.
      const faint = i => data[i + 3] > 0 && data[i + 3] < 100;
      // The exposed concrete face fill (#e8e8ea).
      const face = i => data[i + 3] > 200
        && data[i] > 225 && data[i] < 240 && data[i + 2] > 227 && data[i + 2] < 242;
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
      // Buildings: columns carrying dark ink above grade. The widest break
      // between them is the gap between the house and the garage.
      const cols = [];
      for (let x = Math.floor(W * 0.1); x < W; x++) {
        for (let y = 24; y < gradeY - 4; y++) {
          if (dark(at(x, y))) { cols.push(x); break; }
        }
      }
      let gapLo = 0, gapHi = 0;
      for (let k = 1; k < cols.length; k++) {
        if (cols[k] - cols[k - 1] > gapHi - gapLo) {
          gapLo = cols[k - 1]; gapHi = cols[k];
        }
      }
      // Census each side of the gap below grade, the gap above grade, and
      // the garage band pixels.
      let houseDeepest = gradeY, garageDeepest = gradeY;
      let garageBuried = 0, garageFace = 0, gapFaint = 0;
      for (let y = 24; y < H; y++) {
        for (let x = Math.floor(W * 0.1); x < W; x++) {
          const i = at(x, y);
          if (y > gradeY + 2 && inked(i)) {
            if (x <= gapLo) houseDeepest = Math.max(houseDeepest, y);
            if (x >= gapHi) {
              garageDeepest = Math.max(garageDeepest, y);
              garageBuried += 1;
            }
          }
          if (x >= gapHi && y > gradeY - 14 && y <= gradeY && face(i)) garageFace += 1;
          if (x > gapLo + 6 && x < gapHi - 6 && y < gradeY - 3 && faint(i)) gapFaint += 1;
        }
      }
      return {
        gradeY, gapLo, gapHi, houseDeepest, garageDeepest,
        garageBuried, garageFace, gapFaint, H,
      };
    });
  }

  test('a detached grade-beam garage elevation hangs its band; level lines stop at the house', async ({ page }) => {
    const scan = await detachedElevationScan(page, 'gradebeam');
    expect(scan.gradeY).toBeGreaterThan(0);
    expect(scan.gapHi - scan.gapLo).toBeGreaterThan(20);
    // The garage band exists but hangs shallow, never basement-deep.
    expect(scan.garageBuried).toBeGreaterThan(50);
    expect(scan.garageDeepest - scan.gradeY)
      .toBeLessThan((scan.houseDeepest - scan.gradeY) * 0.5);
    // The beam's exposed face stands on grade.
    expect(scan.garageFace).toBeGreaterThan(50);
    // No house level line runs across the gap to the garage.
    expect(scan.gapFaint).toBeLessThan(10);
  });

  test('a detached thickened-edge garage elevation shows its slab band', async ({ page }) => {
    const scan = await detachedElevationScan(page, 'thickened');
    expect(scan.gradeY).toBeGreaterThan(0);
    expect(scan.gapHi - scan.gapLo).toBeGreaterThan(20);
    // The buried edge is the 1'-0" monolithic edge — barely below grade.
    expect(scan.garageBuried).toBeGreaterThan(30);
    expect(scan.garageDeepest - scan.gradeY)
      .toBeLessThan((scan.houseDeepest - scan.gradeY) * 0.35);
    // The slab face sits proud of grade under the walls.
    expect(scan.garageFace).toBeGreaterThan(30);
    expect(scan.gapFaint).toBeLessThan(10);
  });

  test('an L-house elevation keeps its jog corner line through the floor bands', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    // An L outline whose jog shows from the south: the near wing (x 0..8)
    // stands 6' closer than the far wing (x -8..0), corner at x = 0.
    await h.selectTool(page, 'Outline');
    await h.clickWorld(page, -8, -6);
    await h.clickWorld(page, 8, -6);
    await h.clickWorld(page, 8, 6);
    await h.clickWorld(page, 0, 6);
    await h.clickWorld(page, 0, 0);
    await h.clickWorld(page, -8, 0);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);
    await h.climbTourToMain(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    await page.locator('.cut-row', { hasText: 'E1' }).click({ position: { x: 18, y: 8 } });
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');

    const scan = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const W = canvas.width, H = canvas.height;
      const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
      const at = (x, y) => (y * W + x) * 4;
      const dark = i => data[i + 3] > 150
        && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
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
      // Vertical edge columns: columns whose dark ink covers most of the
      // wall height above grade. Each must be continuous — the floor rim
      // bands may not cut a corner line.
      const columns = [];
      for (let x = Math.floor(W * 0.1); x < W * 0.95; x++) {
        let top = null, bottom = null, count = 0;
        for (let y = 24; y < gradeY - 2; y++) {
          if (!dark(at(x, y))) continue;
          if (top === null) top = y;
          bottom = y; count += 1;
        }
        if (top === null || bottom - top < (gradeY - 24) * 0.5) continue;
        if (count < (bottom - top) * 0.6) continue;
        // The corner line proper starts at the wall top — the first solid
        // dark run — below the roof silhouette hovering over the overhang.
        let wallTop = null;
        for (let y = top, runStart = null; y <= bottom; y++) {
          if (!dark(at(x, y))) { runStart = null; continue; }
          if (runStart === null) runStart = y;
          if (y - runStart >= 20) { wallTop = runStart; break; }
        }
        if (wallTop === null) continue;
        let gap = 0, run = 0;
        for (let y = wallTop; y <= bottom; y++) {
          run = dark(at(x, y)) ? 0 : run + 1;
          gap = Math.max(gap, run);
        }
        columns.push({ x, gap });
      }
      // Cluster adjacent columns into edges, keeping each edge's best
      // (smallest) gap so antialiased neighbours don't count against it.
      const edges = [];
      columns.forEach(col => {
        const last = edges[edges.length - 1];
        if (last && col.x - last.x <= 3) {
          last.x = col.x; last.gap = Math.min(last.gap, col.gap);
        } else edges.push({ x: col.x, gap: col.gap });
      });
      return { gradeY, edges };
    });
    expect(scan.gradeY).toBeGreaterThan(0);
    // Left edge, jog corner, right edge — three tall verticals.
    expect(scan.edges.length).toBeGreaterThanOrEqual(3);
    // And every one runs unbroken through the floor bands.
    scan.edges.forEach(edge => expect(edge.gap).toBeLessThanOrEqual(3));
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
