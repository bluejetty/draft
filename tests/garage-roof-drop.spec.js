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
