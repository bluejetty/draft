// The stored-drawing readers are pure, so they are exercised directly rather
// than through the drafting UI.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.DraftDrawingFormat);
});

test('only a drawing of the current version is accepted', async ({ page }) => {
  const results = await page.evaluate(() => {
    const f = window.DraftDrawingFormat;
    const ok = { version: f.VERSION, levels: [] };
    return {
      current: f.checkEnvelope(ok),
      newer:   f.checkEnvelope({ ...ok, version: f.VERSION + 1 }),
      older:   f.checkEnvelope({ ...ok, version: 0 }),
      noLevels: f.checkEnvelope({ version: f.VERSION }),
      notAnObject: f.checkEnvelope('{}'),
      nothing: f.checkEnvelope(null),
    };
  });

  expect(results.current).toEqual({ ok: true, reason: 'loaded' });
  expect(results.newer).toEqual({ ok: false, reason: 'version' });
  expect(results.older).toEqual({ ok: false, reason: 'invalid' });
  expect(results.noLevels).toEqual({ ok: false, reason: 'invalid' });
  expect(results.notAnObject).toEqual({ ok: false, reason: 'invalid' });
  expect(results.nothing).toEqual({ ok: false, reason: 'invalid' });
});

test('points and level ids are only accepted when usable', async ({ page }) => {
  const results = await page.evaluate(() => {
    const f = window.DraftDrawingFormat;
    const levelIds = new Set([3, 4]);
    return {
      full:     f.point({ x: 1, y: 2, z: 3 }),
      missingY: f.point({ x: 1, z: 3 }),
      textual:  f.point({ x: '1.5', z: '-2' }),
      noZ:      f.point({ x: 1 }),
      known:    f.levelId('3', levelIds),
      unknown:  f.levelId(9, levelIds),
    };
  });

  expect(results.full).toEqual({ x: 1, y: 2, z: 3 });
  expect(results.missingY).toEqual({ x: 1, y: 0, z: 3 });
  expect(results.textual).toEqual({ x: 1.5, y: 0, z: -2 });
  expect(results.noZ).toBeNull();
  expect(results.known).toBe(3);
  expect(results.unknown).toBeNull();
});

test('cuts keep their level, normalise direction and drop duplicates', async ({ page }) => {
  const cuts = await page.evaluate(() => window.DraftDrawingFormat.cuts([
    { id: 1, name: 'north', startPt: { x: 0, z: 0 }, endPt: { x: 10, z: 0 }, dirVec: { x: 0, z: 5 }, elev: 0, levelId: 3 },
    { id: 1, name: 'duplicate id', startPt: { x: 0, z: 0 }, endPt: { x: 1, z: 0 }, dirVec: { x: 0, z: 1 }, elev: 0, levelId: 3 },
    { id: 2, name: 'unowned', startPt: { x: 0, z: 0 }, endPt: { x: 1, z: 0 }, dirVec: { x: 1, z: 0 }, elev: 9, levelId: 99 },
    { id: 3, name: 'no direction', startPt: { x: 0, z: 0 }, endPt: { x: 1, z: 0 }, dirVec: { x: 0, z: 0 }, elev: 0, levelId: 3 },
  ], new Set([3])));

  expect(cuts).toHaveLength(2);
  expect(cuts[0]).toMatchObject({ id: 1, name: 'NORTH', dirVec: { x: 0, z: 1 }, levelId: 3 });
  // An unknown owner stays null: levels can share an elevation, so guessing
  // one could delete the wrong section later.
  expect(cuts[1]).toMatchObject({ id: 2, levelId: null });
});

test('background levels exclude the active level and cap at two', async ({ page }) => {
  const ids = await page.evaluate(() => window.DraftDrawingFormat
    .backgroundLevelIds([1, 2, 2, 3, 4, 99], new Set([1, 2, 3, 4]), 1));
  expect(ids).toEqual([2, 3]);
});
