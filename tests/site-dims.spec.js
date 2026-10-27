// THE SITE PLAN'S TWO DIMENSION ROWS, AND THE MARKS OUTSIDE THEM.
//
// Movie, 14 Oct: "and the E1-E4 on the outside can we make it so it is on the
// OUTSIDE of the site lines (and the dimensions which i will also add to the
// outside of the site lines. we need the front to back and side to side FULL
// dimensions of the site on the outmost dimension and on the inner dimension
// we need the location of the hosue from front of site, width of house and
// then to the back of the site and same for hosue position side to side we
// also need on the inside dimention (make it 3ft from the property line on the
// outside for the first dimension position and then 2ft future for the outside
// dimensino line".
//
// FOUR CLAIMS, and each is a number rather than a look: what the rows measure,
// where they stand, that they are built off the lot's own front rather than a
// compass direction, and that the elevation marks clear them. The fixture's
// lot is 50 x 75 with a 40 x 30 house centred on it, so every figure below can
// be read off those two rectangles by hand: 5 either side, 22.5 front and back.
const { test, expect } = require('@playwright/test');

const LOT = { x: 25, z: 37.5 };          // half width, half depth
const HOUSE = { x: 20, z: 15 };
const rect = (half, extra) => ({
  points: [{ x: half.x, z: -half.z }, { x: -half.x, z: -half.z },
    { x: -half.x, z: half.z }, { x: half.x, z: half.z }],
  ...extra,
});
const DRAWING = {
  format: 'draft-drawing', version: 1,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 }],
  outlines: [
    rect(LOT, { id: 'lot', site: true, levelId: 8 }),
    rect(HOUSE, { id: 'house', levelId: 3 }),
  ],
  board: 'drafting',
};

const lengthOf = row => Math.hypot(row.end.x - row.start.x, row.end.z - row.start.z);
const near = (value, want, tol = 0.01) => Math.abs(value - want) < tol;

// The module answers on any page that loads it; LAYOUT is the lighter of the
// two and is the page the sheet is drawn on.
async function rows(page, drawing = DRAWING) {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  return page.evaluate(d => window.DraftLayoutPlan.siteDimStrings(d), drawing);
}

test('the inner row measures the house between the lot lines, both ways', async ({ page }) => {
  const all = await rows(page);
  const inner = all.filter(row => row.row === 'inner');
  // THREE STOPS PER AXIS: lot line to house, the house, house to the far lot
  // line -- "from front of site, width of house and then to the back of the
  // site and same for hosue position side to side".
  expect(inner.filter(row => row.axis === 'z').map(lengthOf).map(v => Number(v.toFixed(2))),
    'front to back: 22.5 to the house, 30 of house, 22.5 to the back')
    .toEqual([22.5, 30, 22.5]);
  expect(inner.filter(row => row.axis === 'x').map(lengthOf).map(v => Number(v.toFixed(2))),
    'side to side: 5, the 40 ft house, 5').toEqual([5, 40, 5]);
});

test('the outer row is the lot itself, front to back and side to side', async ({ page }) => {
  const all = await rows(page);
  const outer = all.filter(row => row.row === 'outer');
  expect(outer).toHaveLength(2);
  const byAxis = Object.fromEntries(outer.map(row => [row.axis, lengthOf(row)]));
  expect(near(byAxis.z, 75), `front to back is ${byAxis.z}, not the lot's 75`).toBe(true);
  expect(near(byAxis.x, 50), `side to side is ${byAxis.x}, not the lot's 50`).toBe(true);
});

// ON PAPER (Movie, 26 Oct: "the dimensions are too close together due to
// the scale and size ... locked in the position and size that they will be
// displayed on paper"). 3/8" of paper to the first row and 3/8" more to the
// second, at whatever scale the sheet is: the ground distance follows it.
const standOffs = (all, row) => all.filter(r => r.row === row).map(r => (r.axis === 'z'
  ? Math.abs(r.start.x) - LOT.x : Math.abs(r.start.z) - LOT.z));
for (const [label, pif, first] of [['1" = 60\'', 1 / 60, 22.5], ['1" = 20\'', 1 / 20, 7.5],
  ['no scale given, the site\'s 1" = 30\'', undefined, 11.25]]) {
  test(`at ${label} they stand 3/8" and 3/4" of paper off the property line`, async ({ page }) => {
    await page.goto('/LAYOUT.html');
    await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
    const all = await page.evaluate(({ d, pif }) => window.DraftLayoutPlan.siteDimStrings(d, pif),
      { d: DRAWING, pif });
    const inner = standOffs(all, 'inner'), outer = standOffs(all, 'outer');
    expect(inner.every(gap => near(gap, first)),
      `the inner row stands at ${inner.map(v => v.toFixed(2)).join(', ')} ft, not ${first}`).toBe(true);
    expect(outer.every(gap => near(gap, 2 * first)),
      `the outer row stands at ${outer.map(v => v.toFixed(2)).join(', ')} ft, not ${2 * first}`).toBe(true);
    expect(await page.evaluate(pif => window.DraftLayoutPlan.siteDimReachFt(pif), pif),
      'what the marks clear is the outer row').toBeCloseTo(2 * first, 6);
  });
}

test('and a turned plan puts them on the turned front, not on a fixed side',
  async ({ page }) => {
    // THE LOT AND THE HOUSE TURN TOGETHER (13 Oct's site rotation), so the
    // rows have to follow E1 rather than "the bottom of the screen". Two
    // turns, read as which EDGE each row stands off.
    const sideOf = row => (row.axis === 'z'
      ? (row.start.x > 0 ? 'E' : 'W') : (row.start.z > 0 ? 'S' : 'N'));
    const at = async planTurn => {
      const all = await rows(page, { ...DRAWING, planTurn });
      return {
        along: [...new Set(all.filter(r => r.axis === 'z').map(sideOf))],
        across: [...new Set(all.filter(r => r.axis === 'x').map(sideOf))],
      };
    };
    const straight = await at(0);
    // Unturned: E1 is the south edge, so the side-to-side row reads from the
    // south and the front-to-back row from the west, which is E2's side.
    expect(straight.across, 'the side-to-side row is not on the front').toEqual(['S']);
    expect(straight.along, 'the front-to-back row is not on the left').toEqual(['W']);
    const turned = await at(1);
    // A quarter turn walks both rows one seat round with the marks.
    expect(turned.along.concat(turned.across),
      'the rows did not follow the turn').not.toEqual(straight.along.concat(straight.across));
  });

test('E1-E4 stand outside the outer row on the site plan, and nowhere else',
  async ({ page }) => {
    // THE RECORD DOES NOT MOVE, only the ring that is drawn -- the elevations
    // are generated from those records, so re-seating them would move every
    // elevation in the file to tidy one view. Both are published, which is
    // what makes the difference readable here.
    await page.goto('/MODEL.dc.html');
    await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
    await page.evaluate(async d => {
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
    }, {
      ...DRAWING,
      // Walls for the marks to be generated off in the first place.
      walls: [[-20, -15, 20, -15], [20, -15, 20, 15], [20, 15, -20, 15], [-20, 15, -20, -15]]
        .map(([x0, z0, x1, z1], i) => ({
          id: `w${i}`, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
          baseHeight: 0, topHeight: 8, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
        })),
    });

    const marksOn = async level => {
      await page.goto(`/MODEL.html?mode=night&level=${level}`);
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
      return page.evaluate(() => ({
        record: JSON.parse(document.getElementById('plan').getAttribute('data-e-marks') || '[]'),
        drawn: JSON.parse(document.getElementById('plan').getAttribute('data-e-marks-drawn') || '[]'),
      }));
    };

    const site = await marksOn(8);
    expect(site.drawn.length, 'the site level drew no marks').toBe(4);
    // E1 looks from +z, so its line stands past the lot's far edge: 37.5 of
    // lot, the rows' 3/4" of paper at the site's 1" = 30' (22.5 ft), and the
    // marks' own clearance.
    const e1 = site.drawn.find(mark => mark.id === 'E1');
    expect(e1.a[1], 'E1 is not outside the lot and its dimension rows')
      .toBeGreaterThan(LOT.z + 22.5);
    site.drawn.forEach(mark => {
      const out = Math.max(Math.abs(mark.a[0]), Math.abs(mark.a[1]));
      expect(out, `${mark.id} is inside the property line`).toBeGreaterThan(Math.min(LOT.x, LOT.z));
    });
    const record = site.record.find(mark => mark.id === 'E1');
    expect(record.a[1], 'the stored elevation moved with the drawn mark')
      .toBeLessThan(LOT.z);

    // AND A FLOOR PLAN IS UNTOUCHED: there the subject is the house, and the
    // marks sit where they always have.
    const main = await marksOn(3);
    expect(main.drawn, 'a floor plan\'s marks moved').toEqual(main.record);
  });

// THE CHIPS ON THE SITE TOO (Movie, 26 Oct: "the dimension scale button
// doesn't show up on the site plan (or the autodim and hand dim buttons)
// could we have those here too"). The rows are drawn off the lot, not
// stored, so AUTO DIMS hides and shows them and DIM SCALE re-spaces them.
test('on the SITE level the chips stand ready: AUTO DIMS hides the rows, DIM SCALE lays them out', async ({ page }) => {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async d => {
    localStorage.clear();
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(d)], 'drawing.json', { type: 'application/json' }), 'model-drawing');
  }, DRAWING);
  await page.goto('/MODEL.html?mode=night&level=8');
  await page.waitForFunction(() => typeof drawing !== 'undefined' && drawing && activeLevelId() === 8, null, { timeout: 10000 });
  await expect(page.locator('[data-dims-show="auto"]')).toBeVisible();
  await expect(page.locator('[data-dim-scale]')).toBeVisible();
  // What MODEL hands the site painter, read off the painter itself.
  const handed = () => page.evaluate(() => {
    const LP = window.DraftLayoutPlan, R = window.DraftRender2D;
    let env = null, drawn = 0;
    window.DraftLayoutPlan = { ...LP, drawSitePlan: (...a) => { env = a[3]; return LP.drawSitePlan(...a); } };
    window.DraftRender2D = { ...R, drawDimension2D: (...a) => { drawn += 1; return R.drawDimension2D(...a); } };
    paint();
    window.DraftLayoutPlan = LP;
    window.DraftRender2D = R;
    return { rows: env && env.siteDims !== false, pif: env && env.pif, drawn };
  });
  const on = await handed();
  expect({ rows: on.rows, pif: on.pif }).toEqual({ rows: true, pif: 1 / 30 });
  expect(on.drawn, 'the rows are drawn').toBeGreaterThan(0);
  await page.locator('[data-dims-show="auto"]').click();
  const off = await handed();
  expect(off.rows, 'AUTO DIMS off: no rows').toBe(false);
  expect(off.drawn, 'and none drawn').toBe(0);
  await page.locator('[data-dims-show="auto"]').click();
  await page.locator('[data-dim-scale]').selectOption(String(1 / 60));
  expect((await handed()).pif).toBe(1 / 60);
});
