// The garage roof DROP rule (board #245): when the house stands taller
// than the one-storey garage zone (more than one floor level in the
// stack), the attached garage stops sharing the house roof — it gets a
// detached-style roof at its own plate, ridge perpendicular to the shared
// wall, normal overhang on the three free sides, and ZERO on the house
// side: the roof plane runs right TO the upper-storey wall face and
// stops. A single-storey house (2ND FL card deleted) keeps today's
// spliced single roof.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawHouseOutline(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
}

async function drawGarageOutline(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
  await page.keyboard.press('Enter'); // the professor's lesson steps aside
  for (const [x, z] of [[8, -4], [20, -4], [20, 4], [8, 4]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);
}

test('a two-storey house drops the garage to its own roof, flush at the upper wall face', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page); // default stack: MAIN + 2ND FL — the house is taller
  await drawGarageOutline(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  expect(saved.roofs).toHaveLength(2);

  // The house roof no longer reaches over the garage — it stops at its own
  // overhang past the shared wall.
  const houseRoof = saved.roofs.find(roof => !roof.garage);
  expect(houseRoof).toBeTruthy();
  expect(Math.max(...houseRoof.points.map(point => point.x))).toBeLessThan(11);

  // The garage roof: its own plate, and the FLUSH CUT — the house-side
  // edge lands exactly on the upper-storey wall face at x = 8, no
  // overshoot, no gap, while the three free sides carry normal overhang.
  const garageRoof = saved.roofs.find(roof => roof.garage);
  expect(garageRoof).toBeTruthy();
  expect(garageRoof.plateHeightFt).toBeGreaterThan(0);
  const xs = garageRoof.points.map(point => point.x);
  expect(Math.min(...xs)).toBeCloseTo(8, 5);
  expect(Math.max(...xs)).toBeGreaterThan(20); // street side overhangs
  const zs = garageRoof.points.map(point => point.z);
  expect(Math.min(...zs)).toBeLessThan(-4);    // side eaves overhang
  expect(Math.max(...zs)).toBeGreaterThan(4);

  // Ridge perpendicular to the shared wall: the two edges parallel to the
  // house line (the flush cut and the street face) read GABLE, the legs
  // read EAVE — the planes drain away from the house, no valley.
  const points = garageRoof.points;
  const kinds = garageRoof.edges.map((kind, index) => {
    const a = points[index], b = points[(index + 1) % points.length];
    return { kind, vertical: Math.abs(a.x - b.x) < 0.01 };
  });
  kinds.forEach(edge => expect(edge.kind).toBe(edge.vertical ? 'gable' : 'eave'));
  expect(garageRoof.edges.filter(kind => kind === 'gable')).toHaveLength(2);
});

test('a bungalow (2ND FL deleted) keeps the spliced single roof over house + garage', async ({ page }) => {
  await h.openModel(page);
  page.on('dialog', dialog => dialog.accept(''));
  await drawHouseOutline(page);

  await page.locator('.level-row')
    .filter({ has: page.locator('.level-name', { hasText: '2ND FL' }) })
    .locator('.level-del').click();
  await h.waitForSaved(page);

  await drawGarageOutline(page);
  await buildHouse(page);

  const saved = await h.savedDrawing(page);
  expect(saved.roofs).toHaveLength(1);
  const roof = saved.roofs[0];
  expect(roof.garage).toBeFalsy();
  expect(Math.max(...roof.points.map(point => point.x))).toBeGreaterThan(20);
});

test('the front elevation shows the garage roof band low with house ink standing above it', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);
  await buildHouse(page);

  // FRONT elevation: house (left) and attached garage (right) share the wall.
  await page.locator('.cut-row', { hasText: 'E1' }).click({ position: { x: 18, y: 8 } });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');

  const scan = await page.evaluate(() => {
    const canvas = document.querySelector('[data-model-overlay]');
    const W = canvas.width, H = canvas.height;
    const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
    const dark = (x, y) => {
      const i = (y * W + x) * 4;
      return data[i + 3] > 200 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
    };
    // Grade: the lowest row where a dark run crosses most of the sheet.
    let gradeY = 0;
    for (let y = 0; y < H; y++) {
      let run = 0, best = 0;
      for (let x = 0; x < W; x++) {
        run = dark(x, y) ? run + 1 : 0;
        best = Math.max(best, run);
      }
      if (best > W * 0.6) gradeY = y;
    }
    // Topmost ink per column, well above grade — the roofline of whatever
    // stands there (the floor band hugging grade doesn't count).
    const rises = [];
    for (let x = 0; x < W; x++) {
      let top = null;
      for (let y = 24; y < gradeY - 60; y++) {
        if (dark(x, y)) { top = y; break; }
      }
      rises.push(top == null ? null : gradeY - top);
    }
    return { gradeY, rises };
  });

  // One building silhouette, two heights: the tall house plateau and the
  // low garage band beside it — each holding for a real run of columns.
  const inked = scan.rises.filter(rise => rise != null);
  expect(inked.length).toBeGreaterThan(200);
  const tall = Math.max(...inked);
  const tallRun = scan.rises.filter(rise => rise != null && rise > tall * 0.85).length;
  const lowRun = scan.rises.filter(rise => rise != null && rise < tall * 0.6 && rise > tall * 0.15).length;
  expect(tallRun).toBeGreaterThan(60);  // the two-storey house stands full height
  expect(lowRun).toBeGreaterThan(60);   // the garage roof band sits at its own height
});

test('the garage roof band butts the house without welding: one fascia, a bare ridge line', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);
  await buildHouse(page);

  // FRONT elevation: the garage eave faces the viewer, its ridge runs
  // toward the house. The ridge spans gable-to-gable, so it is NOT a
  // rake: it must read as ONE thin line, with the only heavy fascia ink
  // sitting at the eave band — no second fascia dressed onto the ridge.
  await page.locator('.cut-row', { hasText: 'E1' }).click({ position: { x: 18, y: 8 } });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');

  const scan = await page.evaluate(() => {
    const canvas = document.querySelector('[data-model-overlay]');
    const W = canvas.width, H = canvas.height;
    const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
    const dark = (x, y) => {
      const i = (y * W + x) * 4;
      return data[i + 3] > 200 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
    };
    // Grade: the lowest row where a dark run crosses most of the sheet.
    let gradeY = 0;
    for (let y = 0; y < H; y++) {
      let run = 0, best = 0;
      for (let x = 0; x < W; x++) {
        run = dark(x, y) ? run + 1 : 0;
        best = Math.max(best, run);
      }
      if (best > W * 0.6) gradeY = y;
    }
    // Column heights above grade tell the house plateau from the garage band.
    const rises = [];
    for (let x = 0; x < W; x++) {
      let top = null;
      for (let y = 24; y < gradeY - 60; y++) {
        if (dark(x, y)) { top = y; break; }
      }
      rises.push(top == null ? null : gradeY - top);
    }
    const tall = Math.max(...rises.filter(rise => rise != null));
    // The garage band columns: standing ink, but well under the house.
    const bandCols = rises
      .map((rise, x) => ({ rise, x }))
      .filter(c => c.rise != null && c.rise < tall * 0.6 && c.rise > tall * 0.15);
    if (!bandCols.length) return { bands: null };
    // Probe the middle of the garage band: count the distinct dark bands
    // from its roofline down to just above the wall plate, and how thick
    // each one runs.
    const mid = bandCols[Math.floor(bandCols.length / 2)];
    const topY = gradeY - mid.rise;
    const bands = [];
    let inBand = false;
    for (let y = topY - 4; y < gradeY - 60; y++) {
      if (dark(mid.x, y)) {
        if (!inBand) bands.push({ y0: y, y1: y });
        else bands[bands.length - 1].y1 = y;
        inBand = true;
      } else inBand = false;
    }
    return { bands, midX: mid.x, topY };
  });

  expect(scan.bands).toBeTruthy();
  // From the ridge down to the plate the probe crosses: the ridge line,
  // the fascia top, and the heavy fascia base — three bands. The welded
  // rendering dressed the ridge as a rake fascia, doubling it into a
  // fourth heavy band.
  expect(scan.bands.length).toBe(3);
  // The ridge stays a bare line, not a fascia stripe.
  expect(scan.bands[0].y1 - scan.bands[0].y0).toBeLessThan(4);
});

test('the garage roof reaches the house wall it butts, under the house overhang', async ({ page }) => {
  await h.openModel(page);
  await drawHouseOutline(page);
  await drawGarageOutline(page);
  await buildHouse(page);

  // The house roof overhangs two feet past the shared wall, high above the
  // garage roof running beneath it. Read as "the taller roof stands in
  // front", that overhang hid the garage roof for its whole width and the
  // elevation showed a garage roof stopping two feet shy of the house.
  await page.locator('.cut-row', { hasText: 'E1' }).click({ position: { x: 18, y: 8 } });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');

  const scan = await page.evaluate(() => {
    const canvas = document.querySelector('[data-model-overlay]');
    const W = canvas.width, H = canvas.height;
    const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
    const dark = (x, y) => {
      const i = (y * W + x) * 4;
      return data[i + 3] > 200 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
    };
    let gradeY = 0;
    for (let y = 0; y < H; y++) {
      let run = 0, best = 0;
      for (let x = 0; x < W; x++) {
        run = dark(x, y) ? run + 1 : 0;
        best = Math.max(best, run);
      }
      if (best > W * 0.6) gradeY = y;
    }
    const rises = [];
    for (let x = 0; x < W; x++) {
      let top = null;
      for (let y = 24; y < gradeY - 60; y++) {
        if (dark(x, y)) { top = y; break; }
      }
      rises.push(top == null ? null : gradeY - top);
    }
    const tall = Math.max(...rises.filter(rise => rise != null));
    const cols = rises.map((rise, x) => ({ rise, x })).filter(c => c.rise != null);
    const bandCols = cols.filter(c => c.rise < tall * 0.6 && c.rise > tall * 0.15);
    const houseCols = cols.filter(c => c.rise > tall * 0.85);
    if (!bandCols.length || !houseCols.length) return null;
    // The tip of the house overhang: the last column whose topmost ink is
    // the house roof, and the column the garage roof used to stop at.
    const overhangTipX = Math.max(...houseCols.map(c => c.x));
    // The garage eave, followed back toward the house from mid-band.
    const mid = bandCols[Math.floor(bandCols.length / 2)];
    const topY = gradeY - mid.rise;
    let eaveY = null;
    for (let y = topY; y < topY + 40 && y < gradeY; y++) if (dark(mid.x, y)) eaveY = y;
    if (eaveY == null) return null;
    const inked = x => dark(x, eaveY) || dark(x, eaveY - 1) || dark(x, eaveY + 1);
    let eaveLeftX = mid.x;
    for (let x = mid.x, gap = 0; x > 0 && gap < 4; x--) {
      if (inked(x)) { eaveLeftX = x; gap = 0; } else gap++;
    }
    // Scale, from the garage roof itself: its far rake sits 12' beyond the
    // house overhang tip in this fixture.
    const bandRightX = Math.max(...bandCols.map(c => c.x));
    return { overhangTipX, eaveLeftX, pxPerFt: (bandRightX - overhangTipX) / 12 };
  });

  expect(scan).toBeTruthy();
  // The eave carries on past the overhang tip and lands on the wall face —
  // two feet further, the width the elevation was dropping.
  expect(scan.overhangTipX - scan.eaveLeftX).toBeGreaterThan(scan.pxPerFt * 1.5);
});
