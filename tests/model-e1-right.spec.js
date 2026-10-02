// A NEW DRAWING STARTS WITH E1 ON THE RIGHT, and what the drive-thru builds
// faces it.
//
// Movie, 1 Oct: *"i'd like the drawings to start out with E1 on the right side
// looking leftwards towards the house, which will place E2 on the bottom
// looking up etc."*
//
// TWO CLAIMS, and the second is the one that could quietly fail:
//
//   THE BLANK SHEET IS TURNED     three quarters, which is E1's east seat --
//                                 read off the marks the page draws
//   THE BUILDERS FOLLOW E1        a premade house or an ordered garage built
//                                 on a turned drawing is the SAME building as
//                                 on an unturned one, turned with it -- not
//                                 the front-down design dropped in regardless,
//                                 which is what HOUSE ROTATE got until now
//   AND ONE UNDO STILL TAKES IT   the build turns in place so the undo step
//                                 still holds the walls it names
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';

const empty = planTurn => ({
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 },
    { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 },
    { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 },
  ],
  activeLevelIdx: 3,
  planTurn,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function openWith(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

async function order(page, family, entry) {
  await h.openDriveThru(page);
  await page.locator(`#dt-tiles [data-build-family="${family}"]`).click();
  await page.locator(`#dt-tiles [data-build-entry="${entry}"]`).click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
}

async function saved(page) {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, BUCKET);
}

// THE BUILDING AS A SHAPE, wherever it stands: every wall's two ends, turned
// by `turns` more quarters, slid so the lowest corner is at zero, rounded and
// sorted. Two drawings answer the same list when they hold the same building
// standing the same way round.
const shapeOf = (d, turns) => {
  const spin = (p, n) => {
    let x = p.x, z = p.z;
    for (let i = 0; i < n; i += 1) { const was = x; x = -z; z = was; }
    return { x, z };
  };
  const walls = (d.walls || []).map(w => [spin(w.start, turns), spin(w.end, turns), w.view]);
  const minX = Math.min(...walls.flatMap(([a, b]) => [a.x, b.x]));
  const minZ = Math.min(...walls.flatMap(([a, b]) => [a.z, b.z]));
  const key = p => `${(p.x - minX).toFixed(3)},${(p.z - minZ).toFixed(3)}`;
  return walls.map(([a, b, view]) => `${view}:${[key(a), key(b)].sort().join('|')}`).sort();
};

test('a new drawing opens with E1 on the right, looking left at the house',
  async ({ page }) => {
    await h.suppressEntryCoach(page);
    await page.goto('/MODEL.html');
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    // NOTHING STORED, so this is the blank sheet the page makes itself -- and
    // one SAVE cannot write until it has a name, so this reads the marks the
    // page draws rather than the file.
    await order(page, 'bungalow', 'bungalow');
    const marks = JSON.parse(await page.locator('#plan').getAttribute('data-e-marks'));
    const at = id => marks.find(m => m.id === id);
    // `d` IS THE SIDE A MARK STANDS ON, outward from the house (cut-marks.js
    // eMarkDir) -- so E1 on the east reads +x, and looks back the other way.
    expect(at('E1').d[0], 'E1 stands on the east').toBeGreaterThan(0.9);
    expect(at('E2').d[1], 'E2 stands on the south').toBeGreaterThan(0.9);
    expect(Math.min(at('E1').a[0], at('E1').b[0]), 'and E1 stands right of E3')
      .toBeGreaterThan(Math.max(at('E3').a[0], at('E3').b[0]));
    expect(Math.min(at('E2').a[1], at('E2').b[1]), 'E2 below E4')
      .toBeGreaterThan(Math.max(at('E4').a[1], at('E4').b[1]));
  });

for (const [what, family, entry] of [
  ['a premade house', 'bungalow', 'bungalow'],
  ['an ordered garage', 'detachedGarage', 'detached-frostwall'],
]) {
  test(`${what} built on a turned drawing faces E1`, async ({ page }) => {
    await openWith(page, empty(0));
    await order(page, family, entry);
    const straight = await saved(page);
    expect(straight.walls.length, 'the order built something').toBeGreaterThan(0);

    await openWith(page, empty(3));
    await order(page, family, entry);
    const turned = await saved(page);
    expect(turned.planTurn, 'the build leaves the turn where it was').toBe(3);
    // ONE MORE QUARTER IS ROUND TO NONE: turned back, the turned build is the
    // straight one.
    expect(shapeOf(turned, 1), 'the same building, turned with the drawing')
      .toEqual(shapeOf(straight, 0));
    // AND IT IS NOT THE STRAIGHT ONE DROPPED IN UNTURNED -- a square plan
    // would pass the line above either way.
    expect(shapeOf(turned, 0)).not.toEqual(shapeOf(straight, 0));
  });
}

test('one undo still takes a build made on a turned drawing', async ({ page }) => {
  await openWith(page, empty(3));
  await order(page, 'bungalow', 'bungalow');
  expect((await saved(page)).walls.length).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  const after = await saved(page);
  expect(after.walls, 'every wall the press raised went back').toEqual([]);
  expect(after.fenestrations || [], 'with its openings').toEqual([]);
});
