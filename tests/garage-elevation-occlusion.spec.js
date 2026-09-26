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

  // ── A VERTICAL THAT IS MOSTLY THERE HAS TO BE ALL THERE ──────────────
  //
  // Movie, 25 Sep, on E1 of a 1 STOREY + GARAGE: "the missing line near
  // middle" ... "garage wall left side bottom".
  //
  // WHAT WAS MISSING WAS HALF OF A CLIP. The house's rim band is the floor
  // package seen flat, and it learned to stop where a garage stands in front
  // of it -- the fill did. The vertical EDGES that close the band did not:
  // they went on being drawn at the run's own ends, which by then were behind
  // the garage. Measured on that build, the house's faces run u -20..20 and
  // the garage's -46..-19, so the band was painted from -19 and its closing
  // edge drawn at -20, a foot inside the garage wall and invisible there.
  //
  // SO THE GARAGE'S LEFT EDGE CAME DOWN FROM THE ROOF, STOPPED AT THE BAND,
  // AND PICKED UP AGAIN BELOW IT -- a gap exactly the floor package deep, in
  // a line that is continuous everywhere else on the sheet.
  //
  // THAT SHAPE IS WHAT THIS MEASURES, rather than the band's coordinates. A
  // column carrying ink over most of the drop from eave to grade is a line
  // the drawing means to be there; a line the drawing means to be there must
  // not have a hole in it. Stated that way the check needs no model-to-pixel
  // transform and no knowledge of where the band sits -- and it fails on the
  // defect for the same reason a drafter's eye does.
  test('no wall line stops at the floor band and starts again below it',
    async ({ page }) => {
      // THE PREMADE, NOT THE HAND-DRAWN SHAPE ABOVE. buildHouseWithGarage
      // hangs the garage off the house's east wall so the two ABUT at u=8;
      // the band's run therefore ends exactly where the garage begins and
      // nothing clips it, which is the one arrangement this defect cannot
      // occur in. 1 STOREY + GARAGE is the build Movie was looking at, and
      // its garage LAPS the house -- u -46..-19 against -20..20 -- which is
      // what makes the band's painted end differ from its run's end.
      await h.openModel(page, { webgl: false });
      await h.openDriveThru(page);
      await page.locator('[data-build-family="bungalow"]').click();
      await page.locator('[data-build-entry="bungalow-garage"]').click();
      await page.locator('#dt-bone').click();
      await page.waitForTimeout(600);
      await h.waitForSaved(page);
      await showElevation(page, 'E1');

      const worst = await page.evaluate(() => {
        const canvas = document.querySelector('[data-model-overlay]');
        const W = canvas.width, H = canvas.height;
        const { data } = canvas.getContext('2d').getImageData(0, 0, W, H);
        const dark = (x, y) => {
          const i = (y * W + x) * 4;
          return data[i + 3] > 150 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120;
        };
        // Grade is the longest dark run on the sheet; the eave is the top of
        // the tallest column. Both found on the paper, as bodyScan does.
        let gradeY = 0, gradeLen = 0;
        for (let y = 18; y < H; y++) {
          let run = 0, best = 0;
          for (let x = 0; x < W; x++) { if (dark(x, y)) { run += 1; if (run > best) best = run; } else run = 0; }
          if (best > gradeLen) { gradeLen = best; gradeY = y; }
        }
        let eaveY = gradeY;
        for (let x = 0; x < W; x++) {
          for (let y = 18; y < gradeY; y++) {
            if (dark(x, y)) { if (y < eaveY) eaveY = y; break; }
          }
        }
        const drop = gradeY - eaveY;
        let worstGap = 0, worstX = -1, worstAt = -1;
        for (let x = 0; x < W; x++) {
          let ink = 0, gap = 0, biggest = 0, biggestAt = -1, seen = false;
          for (let y = eaveY; y <= gradeY; y++) {
            if (dark(x, y)) {
              ink += 1;
              if (seen && gap > biggest) { biggest = gap; biggestAt = y - gap; }
              gap = 0; seen = true;
            } else if (seen) gap += 1;
          }
          // A LINE THE DRAWING MEANS TO BE THERE: two thirds of the drop.
          // Below that it is a door jamb, a window edge or a band's own end,
          // none of which claims to reach grade.
          if (ink < drop * 0.66) continue;
          if (biggest > worstGap) { worstGap = biggest; worstX = x; worstAt = biggestAt; }
        }
        return { worstGap, worstX, worstAt, drop, gradeY, eaveY };
      });

      // FOUR PIXELS OF SLACK, for the antialiasing where a 1.25px stroke
      // crosses a fill edge -- not for a missing segment. The gap this was
      // written for is the floor package, which on this sheet is an order of
      // magnitude more than that.
      expect(worst.drop, 'the scan found no house to measure').toBeGreaterThan(40);
      expect(worst.worstGap,
        `a wall line at x=${worst.worstX} runs from the eave to grade but breaks `
        + `for ${worst.worstGap}px at y=${worst.worstAt} -- the floor band's own `
        + 'edge, drawn behind the garage instead of where the band stops')
        .toBeLessThan(4);
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
