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
    // INK INSIDE, BY ROW. `inside` alone cannot say WHOSE ink it is, and
    // after 97a82c9 there is one line in there that belongs to the house:
    // the top of its own foundation wall, 14" above grade, which used to sit
    // exactly on the rim band's bottom edge and be covered by its fill.
    // A row spanning the whole field is a datum line like that one; a garage
    // roof showing through is a slope, a fascia and two rakes, and cannot be
    // one full-width row.
    const insideRows = [];
    for (let y = eaveY + 6; y < gradeY - 4; y++) {
      let n = 0;
      for (let x = wallL + 6; x <= wallR - 6; x++) if (dark(x, y)) n += 1;
      if (n) insideRows.push({ y, n });
    }
    const fieldW = (wallR - 6) - (wallL + 6) + 1;
    return { gradeY, wallL, wallR, eaveY, inside, right, rightRun, W,
      insideRows, fieldW };
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
    // And no GARAGE inside it. The garage eave, its fascia and its rakes used
    // to run across this field, out of one wall and into the other.
    //
    // THIS SAID `inside === 0` UNTIL 97a82c9, and the change that broke it is
    // a correction rather than a regression -- so the claim is narrowed to
    // what it was always about instead of the threshold being loosened.
    //
    // WHAT ARRIVED. The foundation's base was being derived by subtracting
    // the POUR from the BEARING line, one sill plate short, so every
    // foundation face drew a plate too tall and topped out exactly at the rim
    // band's bottom edge -- covered by its fill, invisible. Corrected, the
    // house's own top of concrete stands where it belongs, 14" above grade,
    // and is a line on the sheet. Measured here: one row, y=474 against a
    // grade of 490, spanning all 158px of the field.
    //
    // A GARAGE ROOF CANNOT BE THAT. It comes in as a slope, a fascia and two
    // rakes -- ink that climbs, and never one row edge to edge. So the test
    // is that nothing inside this field is anything BUT a full-width
    // horizontal, which refuses everything it refused before and admits the
    // one line the house is entitled to.
    const partial = scan.insideRows.filter(row => row.n < scan.fieldW - 2);
    expect(partial.map(r => `y=${r.y} (${r.n}px)`),
      'ink inside the house body that is not a full-width datum line -- a '
      + 'garage eave, fascia or rake showing through').toEqual([]);
    expect(scan.insideRows.length,
      `${scan.insideRows.length} full-width lines inside the house body; the `
      + 'foundation top is the only one it is entitled to').toBeLessThanOrEqual(1);
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
