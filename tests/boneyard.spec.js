// THE BONEYARD / WIREFRAME PAGE, PR 1: the bones in 3D, and the tab.
//
// Movie, 1 Oct: a 3D wireframe of "only the exterior-wall outline of each
// level ... house and garage both", "FOUNDATION purple, MAIN FLOOR red, 2ND FL
// green, ROOF orange", isometric, turned in 15-degree steps; "tap a loop and
// the 2D window switches to that level". 2 Oct: "only 1 loops per floor and
// one for the roof which will be at highest floor ceiling (none for ceiling)".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const empty = () => ({
  version: 1, planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});

async function seed(page, drawing) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: drawing });
}

// A 2 STOREY + GARAGE off the drive-thru, saved, then the boneyard opened on it.
async function boneyardOfTwoStorey(page) {
  await seed(page, empty());
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await h.openDriveThru(page);
  await page.locator('#dt-tiles [data-build-family="bungalow"]').click();
  await page.locator('#dt-tiles [data-build-entry="twoStorey-garage"]').click();
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.locator('#save').click();
  await h.waitForSaved(page);
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
}

const bones = async page => JSON.parse(await page.locator('#bones3d').getAttribute('data-bones'));

test('one loop per floor, the foundation under them and the roof at the top ceiling',
  async ({ page }) => {
    await boneyardOfTwoStorey(page);
    const b = await bones(page);
    expect(b.map(l => l.name), 'bottom to top').toEqual(['FOUNDATION', 'MAIN FL', '2ND FL', 'ROOF']);
    expect(b.map(l => l.color), 'purple, red, green, orange')
      .toEqual(['#9b6bd6', '#e0453a', '#3fae5a', '#ff8c1a']);
    const [fdn, main, second, roof] = b;
    expect(fdn.elev, 'the foundation loop sits at the bottom of the foundation wall').toBeLessThan(-7);
    expect(main.elev).toBeLessThan(second.elev);
    expect(roof.elev - second.elev, 'the roof at the 2ND FL ceiling, a wall height above its floor')
      .toBeGreaterThan(7);
    expect(main.loops, 'MAIN FL carries the house and the garage').toBe(2);
    // Movie, 16 Oct: "the foundation doesn't show the garage outline, but it
    // should show that (like the main floor does)". It used to carry the
    // house only, on the reading that a garage stands on a slab; the garage's
    // grade beam, thickened slab or frost wall is a line of concrete too.
    expect(fdn.loops, 'the foundation carries the house and the garage, as MAIN does').toBe(2);
    expect(roof.loops, 'the roof carries the house only').toBe(1);
  });

test('the foundation\'s garage loop is the floor\'s, solid, and not doubled under one the drafter drew',
  async ({ page }) => {
    // THE LOOP BUILDER IS PURE, so the two cases a built house cannot show
    // are asked of it directly: a garage with no foundation outline of its
    // own takes the floor's loop; a garage whose foundation outline the
    // drafter drew himself keeps his line and gets no second one under it.
    await boneyardOfTwoStorey(page);
    const out = await page.evaluate(() => {
      const BL = window.DraftBoneyardLoops;
      const sq = (x, z, s) => [{ x, z }, { x: x + s, z }, { x: x + s, z: z + s }, { x, z: z + s }];
      const stack = { floors: [{ id: 3, name: 'MAIN FL', floorTop: 0, wallTop: 8 }],
        foundation: { wallBottom: -8 } };
      const house = { id: 'h', levelId: 3, points: sq(0, 0, 30) };
      const garage = { id: 'g', levelId: 3, garage: true, points: sq(30, 0, 24) };
      const bare = { outlines: [house, garage], walls: [], roofs: [], fenestrations: [] };
      const own = { outlines: [house, garage, { id: 'fg', levelId: 1, garage: true, points: sq(30, 2, 24) }],
        walls: [], roofs: [], fenestrations: [] };
      const fdn = d => BL.boneLevels(d, stack).find(l => l.kind === 'foundation');
      const a = fdn(bare), b = fdn(own);
      return {
        bare: a.loops.map(l => ({ garage: l.garage === true, id: l.id, openings: !!l.openings,
          z0: Math.min(...l.points.map(p => p.z)) })),
        own: b.loops.map(l => ({ garage: l.garage === true, id: l.id })),
        elev: a.elev,
      };
    });
    expect(out.bare.map(l => l.garage), 'house, then the garage').toEqual([false, true]);
    expect(out.bare[1].id, 'the floor\'s own garage loop').toBe('g');
    expect(out.bare[1].openings, 'solid -- the foundation has no doors').toBe(false);
    expect(out.bare[1].z0, 'at the garage\'s own corner').toBe(0);
    expect(out.elev, 'and the foundation\'s height').toBe(-8);
    expect(out.own, 'his own foundation outline stands alone').toEqual([{ garage: true, id: 'fg' }]);
  });

// Movie, 16 Oct: "in the 3D Iso rotation control up near middle of screen
// put in up and down arrows over the rotation and 15 degree iterations in
// those directions too".
test('it tips up and down a rung at a time: ISO is a rung, a plan and an elevation are the ends',
  async ({ page }) => {
    await boneyardOfTwoStorey(page);
    const c3 = page.locator('#bones3d');
    const start = await bones(page);
    await expect(c3).toHaveAttribute('data-tilt', '35.26');
    await expect(page.locator('#tilt')).toHaveText('35°');
    await page.locator('#tip-up').click();
    await expect(c3, 'ISO to the next rung up, 45').toHaveAttribute('data-tilt', '45');
    expect((await bones(page))[1].at, 'the picture moved').not.toEqual(start[1].at);
    // 45, 60, 75, 90: three more rungs to the top.
    for (let i = 0; i < 3; i += 1) await page.locator('#tip-up').click();
    await expect(c3, 'a plan is the top of the ladder, and it stays there').toHaveAttribute('data-tilt', '90');
    await expect(page.locator('#tip-up'), 'nothing above a plan').toBeDisabled();
    await expect(page.locator('#tip-down')).toBeEnabled();
    // Seven rungs down: 75, 60, 45, ISO, 30, 15, 0.
    for (let i = 0; i < 7; i += 1) await page.locator('#tip-down').click();
    await expect(c3, 'an elevation is the bottom').toHaveAttribute('data-tilt', '0');
    await expect(page.locator('#tip-down'), 'nothing below an elevation').toBeDisabled();
    await page.locator('#tip-up').click();
    await page.locator('#tip-up').click();
    await page.locator('#tip-up').click();
    await expect(c3, 'and ISO is a rung on the way back up').toHaveAttribute('data-tilt', '35.26');
    // The turn still turns, tipped or not.
    await page.locator('#turn-right').click();
    await expect(c3).toHaveAttribute('data-angle', '60');
  });

test('tipped flat the bones are an elevation; tipped straight down they are a plan',
  async ({ page }) => {
    // Pure: the projection at the two ends of the ladder. At 0° every point
    // of a loop lands at the loop's own height whatever its plan position --
    // the bone is a flat line, which is what an elevation of an outline is.
    // At 90° a point's screen position is its plan position, whatever its
    // height -- which is a plan.
    await boneyardOfTwoStorey(page);
    const out = await page.evaluate(() => {
      const BL = window.DraftBoneyardLoops;
      const P = (pt, elev, tilt) => BL.project(pt, elev, 0, tilt);
      return {
        flatA: P({ x: 0, z: 0 }, 8, 0).y, flatB: P({ x: 20, z: 15 }, 8, 0).y,
        flatLower: P({ x: 20, z: 15 }, 0, 0).y,
        planA: P({ x: 20, z: 15 }, 8, 90), planB: P({ x: 20, z: 15 }, 0, 90),
        ladder: BL.TILT_LADDER, iso: BL.ISO_TILT_DEG,
        // The ends of the ladder hold. The page's arrows are dead there, so
        // only the step itself can say whether a step past a plan is a plan
        // or wraps round to an elevation.
        pastTop: BL.stepTilt(90, 1), pastBottom: BL.stepTilt(0, -1),
        upFromIso: BL.stepTilt(BL.ISO_TILT_DEG, 1), downFromIso: BL.stepTilt(BL.ISO_TILT_DEG, -1),
      };
    });
    expect(out.flatA, 'at 0°, height only').toBeCloseTo(out.flatB, 9);
    expect(out.flatLower - out.flatA, 'and a lower loop sits lower by its height').toBeCloseTo(8, 9);
    expect(out.planA.y, 'at 90°, plan only').toBeCloseTo(out.planB.y, 9);
    expect(out.planA.y, 'z straight down the screen').toBeCloseTo(15, 9);
    expect(out.ladder, 'every 15°, with ISO its own rung').toEqual([0, 15, 30, out.iso, 45, 60, 75, 90]);
    expect(out.iso).toBeCloseTo(35.264, 2);
    expect(out.pastTop, 'a step past a plan is still a plan').toBe(90);
    expect(out.pastBottom, 'a step past an elevation is still an elevation').toBe(0);
    expect([out.upFromIso, out.downFromIso], 'ISO steps to 45 and to 30').toEqual([45, 30]);
  });

test('it turns in 15-degree steps, and a full turn is where it started', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  const start = await bones(page);
  await expect(page.locator('#bones3d')).toHaveAttribute('data-angle', '45');
  await page.locator('#turn-right').click();
  await expect(page.locator('#bones3d')).toHaveAttribute('data-angle', '60');
  expect((await bones(page))[1].at, 'the picture moved').not.toEqual(start[1].at);
  await page.locator('#turn-left').click();
  await page.locator('#turn-left').click();
  await expect(page.locator('#bones3d')).toHaveAttribute('data-angle', '30');
  for (let i = 0; i < 24; i += 1) await page.locator('#turn-right').click();
  await expect(page.locator('#bones3d')).toHaveAttribute('data-angle', '30');
});

test('a tap on a loop shows that level flat on the right', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  await expect(page.locator('#bones2d')).toHaveAttribute('data-level', 'MAIN FL');
  const roof = (await bones(page)).find(l => l.name === 'ROOF');
  const box = await page.locator('#bones3d').boundingBox();
  await page.mouse.click(box.x + roof.at[0], box.y + roof.at[1]);
  await expect(page.locator('#bones2d'), 'the roof loop was tapped').toHaveAttribute('data-level', 'ROOF');
  await page.locator('[data-bone-level="2ND FL"]').click();
  await expect(page.locator('#bones2d')).toHaveAttribute('data-level', '2ND FL');
  await expect(page.locator('#level-title')).toHaveText('2ND FL');
});

// Movie, 3 Oct: "show the doors and window as openings in the outline with a
// dot where their center position is" -- in the bone, 2D and 3D both.
test('every door and window is a gap in the bone with a dot at its centre', async ({ page }) => {
  await boneyardOfTwoStorey(page);
  const saved = await h.savedDrawing(page);
  const doorsOn = id => saved.fenestrations.filter(f => f.type === 'door' && saved.walls
    .some(w => String(w.id) === String(f.wallId) && Number(w.levelId) === id)).length;
  const in3d = JSON.parse(await page.locator('#bones3d').getAttribute('data-openings'));
  const main3d = in3d.filter(o => o.level === 'MAIN FL');
  expect(main3d.filter(o => o.type === 'door').length, 'MAIN FL\'s doors, garage doors too')
    .toBe(doorsOn(3));
  expect(main3d.some(o => o.type === 'window'), 'and its windows').toBe(true);
  expect(in3d.some(o => o.level === '2ND FL' && o.type === 'window'), '2ND FL has its own').toBe(true);
  expect(in3d.some(o => o.level === 'FOUNDATION' || o.level === 'ROOF'), 'the foundation and roof are solid')
    .toBe(false);
  // The 2D window shows the picked level's, the same ones.
  await expect(page.locator('#bones2d')).toHaveAttribute('data-level', 'MAIN FL');
  const in2d = JSON.parse(await page.locator('#bones2d').getAttribute('data-openings'));
  expect(in2d.map(o => o.type).sort()).toEqual(main3d.map(o => o.type).sort());
  // And the dot is drawn: the canvas under a door's dot is the door colour.
  const door = in2d.find(o => o.type === 'door');
  const px = await page.locator('#bones2d').evaluate((c, [x, y]) => {
    const dpr = window.devicePixelRatio || 1;
    return Array.from(c.getContext('2d').getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data.slice(0, 3));
  }, door.at);
  expect(px, 'magenta').toEqual([0xd6, 0x3f, 0xa8]);
});

// Movie, 3 Oct: "An empty BONEYARD brings up the drive-thru".
test('an empty boneyard, reached from the app, goes on to the drive-thru', async ({ page }) => {
  await seed(page, empty());
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.locator('[data-page="boneyard"]').click();
  await page.waitForURL(/MODEL\.html/, { timeout: 10000 });
  await expect(page.locator('#drivethru'), 'the sign rose to pick a house')
    .not.toHaveAttribute('data-shut', '', { timeout: 10000 });
  expect(new URL(page.url()).searchParams.get('from'), 'the ask is spent').toBeNull();
});

test('an empty boneyard opened on its own stays, and offers the drive-thru', async ({ page }) => {
  await seed(page, empty());
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
  await expect(page.locator('#status')).toContainText('Nothing in the boneyard yet');
  expect(await bones(page)).toEqual([]);
  await page.locator('#to-drivethru').click();
  await page.waitForURL(/MODEL\.html/, { timeout: 10000 });
  await expect(page.locator('#drivethru')).not.toHaveAttribute('data-shut', '', { timeout: 10000 });
});

test('the tab sits between MODEL and EXT. FINISH, named for the skin', async ({ page }) => {
  await seed(page, empty());
  await page.goto('/MODEL.html');
  const row = page.locator('#page-row [data-page]');
  await expect(row).toHaveCount(4);
  expect(await row.evaluateAll(els => els.map(e => e.dataset.page)))
    .toEqual(['project', 'model', 'boneyard', 'ext-finish']);
  await expect(page.locator('[data-page="boneyard"]')).toHaveText('BONEYARD', { useInnerText: true });
  await page.goto('/MODEL.html?theme=rough');
  await expect(page.locator('[data-page="boneyard"]')).toHaveText('WIREFRAME', { useInnerText: true });
  // Empty, so the BONEYARD passes the drafter straight on to the drive-thru.
  await page.locator('[data-page="boneyard"]').click();
  await page.waitForURL(/BONEYARD\.html/);
});

// A BILEVEL's ENTRY is a HALF level: its loop sits 4'-5 3/8" under MAIN FL,
// on the sill atop PROJECT's 5'-0" pour, and the roof is on MAIN's ceiling --
// the same stack the elevations use (cut-view.js splitFloorStack).
test('a BILEVEL stands its ENTRY loop half a level under MAIN FL', async ({ page }) => {
  const box = (x0, z0, x1, z1) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
  const d = empty();
  d.buildType = 'bilevel';
  d.levels.splice(4, 0, { id: 2, name: 'ENTRY', elev: -4 });
  d.outlines = [
    { id: 'o-main', levelId: 3, points: box(0, 0, 40, 32) },
    { id: 'o-entry', levelId: 2, points: box(14, 26, 26, 32) },
  ];
  d.walls = [{ id: 'w1', levelId: 3, start: { x: 0, z: 0 }, end: { x: 40, z: 0 } }];
  await seed(page, d);
  await page.goto('/BONEYARD.html');
  await expect(page.locator('body')).toHaveAttribute('data-boneyard-ready', '1', { timeout: 10000 });
  const b = await bones(page);
  const at = name => b.find(l => l.name === name).elev;
  expect(b.map(l => l.name)).toEqual(['FOUNDATION', 'ENTRY', 'MAIN FL', 'ROOF']);
  expect(at('MAIN FL')).toBeCloseTo(0, 3);
  expect(at('ENTRY'), 'ENTRY deck 4\'-5 3/8" under MAIN').toBeCloseTo(-4.4479, 3);
  expect(at('FOUNDATION'), 'the bottom of a 5\'-0" pour under ENTRY\'s sill').toBeCloseTo(-10.4063, 3);
  expect(at('ROOF'), 'the roof on MAIN\'s 9\'-1 1/8" ceiling').toBeCloseTo(109.125 / 12, 3);
});
