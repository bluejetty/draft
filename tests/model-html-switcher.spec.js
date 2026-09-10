// TIER 3b — the level switcher and the view switcher on MODEL.html.
//
// The page has painted any level correctly since tier 2a, but only `?level=`
// could change which one. A URL is not a drafter. These are chrome: they
// change what is LOOKED AT and nothing that is saved.
//
// THE TEST THAT CAN ACTUALLY FAIL IS THE THIRD ONE. In DEFAULT_LEVELS the
// ids run 8, 7, 5, 3, 1 at indexes 0..4 — so index 3 holds id 3, and MAIN FL
// is the ONE level whose id and index coincide (MODEL.dc.html:2767). A
// switcher built on the index passes every test written against a default
// drawing and paints the wrong level the first time anybody inserts one.
// Broken and passing look identical until real use, so the inserted-level
// case is built by hand here rather than hoped for.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const MAIN_FL = 3, SECOND_FL = 5, FOUNDATION = 1;

const readout = page => page.locator('#readout');
const countOf = async (page, what) => {
  const text = await readout(page).textContent();
  const hit = text.match(new RegExp(`${what} (\\d+)/(\\d+)`));
  return hit ? { shown: Number(hit[1]), total: Number(hit[2]) } : null;
};

// Four walls on MAIN FL, two on 2ND FL, and one floor on MAIN FL carrying the
// view every floor carries ('floor', not 'plan' — MODEL.dc.html:2905). The
// counts are deliberately DIFFERENT per level and per view: equal counts would
// let a switcher that changes nothing pass.
const FIXTURE = `
  const wall = (id, levelId, x) => ({
    id, levelId, view: 'plan', wallType: 'stud_2x6',
    start: { x, y: 0, z: 0 }, end: { x: x + 6, y: 0, z: 0 },
  });
  d.walls = [
    wall('m1', ${MAIN_FL}, 0), wall('m2', ${MAIN_FL}, 8),
    wall('m3', ${MAIN_FL}, 16), wall('m4', ${MAIN_FL}, 24),
    wall('s1', ${SECOND_FL}, 0), wall('s2', ${SECOND_FL}, 8),
  ];
  // POINTS, not 'outline', and three at minimum: drawing-format.js:411 drops
  // a floor with fewer, and a dropped floor reads exactly like a view filter
  // that works. Caught by the total reading 0/0 instead of 0/1.
  d.floors = [{
    id: 'f1', levelId: ${MAIN_FL}, view: 'floor',
    points: [{ x: 0, y: 0, z: 0 }, { x: 20, y: 0, z: 0 },
             { x: 20, y: 0, z: 12 }, { x: 0, y: 0, z: 12 }],
  }];
  d.lines = []; d.dimensions = []; d.roofs = []; d.shapes = []; d.outlines = [];
  return d;`;

// An extra level SPLICED IN AT THE FRONT, which is what breaks the
// id/index coincidence: ids become 9, 8, 7, 5, 3, 1 at indexes 0..5, so
// MAIN FL (id 3) moves from index 3 to index 4 and index 3 now holds 2ND FL.
const INSERT_LEVEL = `
  d.levels = [{ id: 9, name: 'ATTIC', elev: 27, visible: true }, ...(d.levels || [])];
  return d;`;

async function writeFixture(page, src) {
  await page.evaluate(async ({ bucket, src }) => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    // eslint-disable-next-line no-new-func
    const out = new Function('d', src)(drawing) || drawing;
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(out)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, src });
}

async function seed(page, extra = null) {
  // MODEL.dc.html is only here to put a drawing in the store on this origin;
  // everything asserted below is MODEL.html's.
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async bucket => {
    const seedDrawing = { format: 'draft-drawing', version: 1, levels: [
      { id: 8, name: 'SITE', elev: 0, visible: true },
      { id: 7, name: 'ROOF', elev: 18, visible: true },
      { id: 5, name: '2ND FL', elev: 9, visible: true },
      { id: 3, name: 'MAIN FL', elev: 0, visible: true },
      { id: 1, name: 'FOUNDATION', elev: -10, visible: true },
    ], walls: [], lines: [], floors: [], roofs: [], shapes: [], outlines: [],
      dimensions: [], notes: [], underlays: [], fixtures: [], stairs: [] };
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(seedDrawing)], 'drawing.json', { type: 'application/json' }),
      bucket);
  }, BUCKET);
  await writeFixture(page, FIXTURE);
  if (extra) await writeFixture(page, extra);
}

test.describe('MODEL.html level + view switchers', () => {
  test('switching level repaints that level, and the URL follows', async ({ page }) => {
    await seed(page);
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('MAIN FL', { timeout: 6000 });
    expect(await countOf(page, 'walls')).toEqual({ shown: 4, total: 6 });

    await page.locator('[data-level-pick]').selectOption(String(SECOND_FL));
    await expect(readout(page)).toContainText('2ND FL');

    // THE CONTROL: 2 differs from 4, so "it repainted" cannot be satisfied by
    // a switcher that repaints the same level.
    expect(await countOf(page, 'walls')).toEqual({ shown: 2, total: 6 });
    expect(page.url()).toContain(`level=${SECOND_FL}`);

    // And back, so the switch is not one-way.
    await page.locator('[data-level-pick]').selectOption(String(MAIN_FL));
    await expect(readout(page)).toContainText('MAIN FL');
    expect(await countOf(page, 'walls')).toEqual({ shown: 4, total: 6 });
  });

  test('switching view changes WHICH DRAWING of the level is shown', async ({ page }) => {
    await seed(page);
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('MAIN FL', { timeout: 6000 });

    // Opens on the walls plan: four walls, and the floor is on another view.
    expect(await countOf(page, 'walls')).toEqual({ shown: 4, total: 6 });
    expect(await countOf(page, 'floors')).toEqual({ shown: 0, total: 1 });

    await page.locator('[data-view-pick]').selectOption('floor');
    await expect(readout(page)).toContainText('view floor');

    // The floor layout is a different drawing OF THE SAME LEVEL: the floor
    // appears and the walls go. Both halves matter — a view switch that only
    // added would pass while filtering nothing.
    expect(await countOf(page, 'floors')).toEqual({ shown: 1, total: 1 });
    expect(await countOf(page, 'walls')).toEqual({ shown: 0, total: 6 });
    expect(page.url()).toContain('view=floor');
  });

  test('a level whose id is not its index still paints the right one', async ({ page }) => {
    await seed(page, INSERT_LEVEL);
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('MAIN FL', { timeout: 6000 });

    // THE TRAP, stated so the test explains itself when it fails: after the
    // splice, levels[3] is 2ND FL and levels[4] is MAIN FL. A switcher that
    // handed the index onward would paint 2ND FL's two walls here.
    const order = await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return JSON.parse(await file.text()).levels.map(level => Number(level.id));
    }, BUCKET);
    expect(order[3], 'the fixture must break the id/index coincidence')
      .not.toBe(MAIN_FL);
    expect(order[4]).toBe(MAIN_FL);

    await page.locator('[data-level-pick]').selectOption(String(MAIN_FL));
    await expect(readout(page)).toContainText('MAIN FL');
    expect(await countOf(page, 'walls'),
      'index-carrying switcher would paint 2ND FL here').toEqual({ shown: 4, total: 6 });

    // The inserted level itself is reachable and holds nothing — which is a
    // fact about the drawing, not a failed paint.
    await page.locator('[data-level-pick]').selectOption('9');
    await expect(readout(page)).toContainText('ATTIC');
    expect(await countOf(page, 'walls')).toEqual({ shown: 0, total: 6 });
  });

  test('a level with no layer views offers no view picker', async ({ page }) => {
    await seed(page);
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('MAIN FL', { timeout: 6000 });
    await expect(page.locator('[data-view-pick]')).toBeVisible();

    // ROOF (7) and SITE (8) have no layer views: the filter switches itself
    // off and they show everything they hold, so a picker there would offer a
    // choice that changes nothing.
    await page.locator('[data-level-pick]').selectOption('7');
    await expect(readout(page)).toContainText('ROOF');
    await expect(page.locator('[data-view-pick]')).toBeHidden();
    await expect(readout(page)).toContainText('view all');
  });

  test('?level= still works, and the switcher agrees with it', async ({ page }) => {
    await seed(page);
    await page.goto(`/MODEL.html?level=${FOUNDATION}`);
    await expect(readout(page)).toContainText('FOUNDATION', { timeout: 6000 });
    await expect(page.locator('[data-level-pick]'))
      .toHaveValue(String(FOUNDATION));
  });
});
