// GENERATED ELEVATIONS — a wing standing in front of another one hides it.
//
// Walls hide each other by the painter's algorithm: the faces are sorted
// far-first and each is filled opaque white before it is stroked, so a
// nearer wall simply paints over a farther one. Roofs never joined that
// scheme — the roof passes stroke edges and fill nothing — so no wall was
// ever hidden by a roof. A far wing's gable-end wall therefore climbed its
// triangle straight over the wing standing in front of it, and the slope
// ran down out of the ridge and stopped in open air at the wall's corner.
//
// The occlusion geometry itself is pinned offline, in model feet, by
// proto/elevation-harness.js (run with node) — it reads the same repro
// drawing this spec seeds. These specs pin the commit layer: that the
// screens really paint through the fixed painter, on the real overlay.
//
// The repro is an L: two wings whose ridges run at right angles, so half
// the views put one mass behind another. A single rectangular footprint
// never does, which is how this survived the suite it already had.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const REPRO = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'proto', 'repro-L-house.draft'), 'utf8'));

async function openRepro(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: h.STORAGE_BUCKET, saved: REPRO });
  await page.reload();
  // Not a bare ready-flag wait: the reload tucks both side rails back behind
  // their tabs, and the elevation rows live in one of them.
  await h.waitForModelReady(page);
}

async function showElevation(page, id) {
  await page.locator('.cut-row', { hasText: id }).click({ position: { x: 18, y: 8 } });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-model-title-detail]').last()).toHaveText(id);
}

// Reads the painted elevation back as three things: the ridge line, the eave
// line under it, and any ink lying BETWEEN them.
//
// A roof plane seen from outside projects as blank paper — the ridge bounds
// it above, the eave below, and nothing crosses the field between. That is
// the stretch the far wing's wall used to be stroked across, so counting its
// ink needs no model-to-pixel transform: both bounds are found on the sheet.
//
// Only the plateau views are read this way. In E1 and E4 the near wing's own
// gable rakes legitimately cross the same band, so blankness is not the rule
// there; the harness covers those in model feet instead.
async function roofFieldScan(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-model-overlay]');
    const W = canvas.width, H = canvas.height;
    const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
    const dark = (x, y) => {
      const i = (y * W + x) * 4;
      return data[i + 3] > 150 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
    };
    // The longest unbroken dark run on a row, and where it lies.
    const runOn = y => {
      let run = 0, best = 0, end = 0;
      for (let x = 0; x < W; x++) {
        if (dark(x, y)) { run += 1; if (run > best) { best = run; end = x; } } else run = 0;
      }
      return { len: best, x0: end - best + 1, x1: end };
    };
    // The ridge: the first long horizontal below the header. The eave: the
    // next one clear of it — the fascia's top line, not its heavy shadow, so
    // the eave itself never counts as ink lying in the field.
    let ridgeY = null, ridge = null;
    for (let y = 18; y < H * 0.4; y++) {
      const r = runOn(y);
      if (r.len > W * 0.2) { ridgeY = y; ridge = r; break; }
    }
    let eaveY = null;
    if (ridgeY !== null) {
      for (let y = ridgeY + 8; y < H * 0.45; y++) {
        if (runOn(y).len > W * 0.4) { eaveY = y; break; }
      }
    }
    if (ridgeY === null || eaveY === null) return { ridgeY, eaveY, field: null };
    // Held clear of both ends of the ridge, where the roof turns down its own
    // end edge — that vertical is the field's boundary, not something in it.
    const inset = Math.max(6, Math.round(W * 0.01));
    let field = 0;
    for (let y = ridgeY + 4; y < eaveY - 4; y++) {
      for (let x = ridge.x0 + inset; x <= ridge.x1 - inset; x++) if (dark(x, y)) field += 1;
    }
    return { ridgeY, eaveY, ridgeLen: ridge.len, field };
  });
}

test.describe('Elevations hide what a nearer wing stands in front of', () => {
  // E2 · LEFT and E3 · BACK both look at a gable-end wall from behind the
  // other wing. Every foot of the triangle that wall climbs is hidden, so
  // the roof field between ridge and eave is blank paper.
  for (const id of ['E2', 'E3']) {
    test(`${id} draws no wall through the wing standing in front of it`, async ({ page }) => {
      await openRepro(page);
      await showElevation(page, id);

      const scan = await roofFieldScan(page);
      // Both bounds were found: the elevation really painted a roof.
      expect(scan.ridgeY).not.toBeNull();
      expect(scan.eaveY).not.toBeNull();
      expect(scan.eaveY).toBeGreaterThan(scan.ridgeY + 8);
      // The ridge runs across a real stretch of the sheet — the guard that
      // says this was not "fixed" by hiding the wing in front as well.
      expect(scan.ridgeLen).toBeGreaterThan(120);
      // And the field under it carries nothing. Before the fix the far
      // wall's gable slope ran down through here and stopped in open air.
      expect(scan.field).toBe(0);
    });
  }

  // The mirror case, and the guard against over-hiding: in E4 the same
  // gable-end wall is the NEAREST thing on the sheet. Its own roof stands
  // nearer than it and higher than its plate, and must not be read as
  // standing in front of it — the wall still climbs to its ridge.
  test('E4 still climbs the near gable-end wall to its ridge', async ({ page }) => {
    await openRepro(page);
    await showElevation(page, 'E4');

    const peak = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const W = canvas.width, H = canvas.height;
      const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
      const dark = (x, y) => {
        const i = (y * W + x) * 4;
        return data[i + 3] > 150 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
      };
      // Topmost ink per column below the header — the drawn skyline.
      const tops = [];
      for (let x = 0; x < W; x++) {
        for (let y = 18; y < H; y++) if (dark(x, y)) { tops.push({ x, y }); break; }
      }
      const apex = tops.reduce((a, b) => (b.y < a.y ? b : a));
      // The plateau is the far wing's ridge, level across its stretch; the
      // near wing's gable stands above it. Measure the drop from the apex to
      // the flattest, most common skyline row.
      const rows = {};
      tops.forEach(t => { rows[t.y] = (rows[t.y] || 0) + 1; });
      const plateau = Number(Object.keys(rows).reduce((a, b) => (rows[b] > rows[a] ? b : a)));
      return { apexY: apex.y, apexX: apex.x, plateau, W };
    });
    // The gable peaks a clear distance above the plateau, and does so inside
    // the sheet rather than at either margin — a gable, not a cropped edge.
    expect(peak.plateau - peak.apexY).toBeGreaterThan(8);
    expect(peak.apexX).toBeGreaterThan(peak.W * 0.15);
    expect(peak.apexX).toBeLessThan(peak.W * 0.95);
  });
});
