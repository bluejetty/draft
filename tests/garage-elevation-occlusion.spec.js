// An attached garage stands BEHIND the house from the far side, and the
// elevation has to say so. The roof passes stroke edges over paper they
// never fill, so the only thing that had ever hidden a roof edge was a
// nearer ROOF — walls and rim bands paint opaque white and were not
// consulted. The dropped garage roof (board #245) therefore drew its far
// eave, its fascia and its rakes straight through the two-storey house
// wall standing in front of it, on the very side where the roof dies into
// that wall and nothing of it can be seen.
//
// The case is the plain one: a rectangular house with a garage hung off
// its east wall. E2 · LEFT looks at the house with the garage entirely
// behind it; E1 · FRONT looks along the shared wall, where the garage
// projects into open air and every line of it is real.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function buildHouseWithGarage(page) {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-8, -6], [8, -6], [8, 6], [-8, 6]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);

  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: /MARK ATTACHED GARAGE/ }).click();
  await page.keyboard.press('Enter');
  for (const [x, z] of [[8, -4], [20, -4], [20, 4], [8, 4]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);

  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);
}

async function showElevation(page, id) {
  await page.locator('.cut-row', { hasText: id }).click({ position: { x: 18, y: 8 } });
  await page.waitForTimeout(600);
  await expect(page.locator('[data-model-title-detail]').last()).toHaveText(id);
}

// Reads the painted elevation as the house body and what lies outside it.
//
// The body is bounded by the two tall wall verticals and, below, by the
// grade line — the longest dark run on the sheet. Everything is found on
// the paper, so no model-to-pixel transform is needed.
async function bodyScan(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-model-overlay]');
    const W = canvas.width, H = canvas.height;
    const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
    const dark = (x, y) => {
      const i = (y * W + x) * 4;
      return data[i + 3] > 150 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
    };
    let gradeY = 0, gradeLen = 0;
    for (let y = 18; y < H; y++) {
      let run = 0, best = 0;
      for (let x = 0; x < W; x++) { if (dark(x, y)) { run += 1; if (run > best) best = run; } else run = 0; }
      if (best > gradeLen) { gradeLen = best; gradeY = y; }
    }
    // The wall verticals: columns carrying a tall unbroken run of ink
    // ending at grade. Storey height is the yardstick, so half the drop
    // from the eave to grade is more than enough to exclude a door jamb.
    const columns = [];
    for (let x = 0; x < W; x++) {
      let run = 0;
      for (let y = 18; y < gradeY; y++) {
        if (dark(x, y)) { run += 1; } else if (run) { columns.push({ x, top: y - run, run }); run = 0; }
      }
      if (run) columns.push({ x, top: gradeY - run, run });
    }
    const tall = columns.filter(c => c.run > (gradeY - 18) * 0.5);
    const wallL = Math.min(...tall.map(c => c.x)), wallR = Math.max(...tall.map(c => c.x));
    const eaveY = Math.min(...tall.map(c => c.top));
    let inside = 0, right = 0, rightRun = 0;
    for (let y = eaveY + 6; y < gradeY - 4; y++) {
      for (let x = wallL + 6; x <= wallR - 6; x++) if (dark(x, y)) inside += 1;
      let run = 0;
      for (let x = wallR + 6; x < W; x++) {
        if (dark(x, y)) { right += 1; run += 1; if (run > rightRun) rightRun = run; } else run = 0;
      }
    }
    return { gradeY, wallL, wallR, eaveY, inside, right, rightRun, W };
  });
}

test.describe('An attached garage hides behind the house it is attached to', () => {
  test('E2 draws no garage roof through the house standing in front of it', async ({ page }) => {
    await buildHouseWithGarage(page);
    await showElevation(page, 'E2');

    const scan = await bodyScan(page);
    // The house really painted: two wall verticals a room apart, and a
    // storey's worth of paper between the eave and grade.
    expect(scan.wallR - scan.wallL).toBeGreaterThan(120);
    expect(scan.gradeY - scan.eaveY).toBeGreaterThan(120);
    // And nothing inside it. The garage eave, its fascia and its rakes
    // used to run across this field, out of one wall and into the other.
    expect(scan.inside).toBe(0);
    // Nor is it hiding off the sides: from here the garage is behind the
    // house end to end, so the sheet carries the house and nothing else.
    expect(scan.right).toBe(0);
  });

  test('E1 still draws the garage where it projects past the house', async ({ page }) => {
    await buildHouseWithGarage(page);
    await showElevation(page, 'E1');

    const scan = await bodyScan(page);
    // The guard against over-hiding: looking along the shared wall, the
    // garage stands clear of the house in open air, roof and all.
    expect(scan.right).toBeGreaterThan(400);
    // Its eave runs as a long unbroken line rather than surviving as
    // scattered ink — the fascia band, drawn its full length.
    expect(scan.rightRun).toBeGreaterThan(100);
  });
});
