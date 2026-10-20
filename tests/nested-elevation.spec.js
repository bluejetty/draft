// A PHASE 1 HOLOGRAM'S OWN SUITES ON THE ELEVATIONS (Movie, 20 Oct).
//
// "it looks like the EXT WALL isn't showing, either of them, maybe cancelling
// each other. I'd like the SUITE EXT wall with the FENSTRATIONS to take over
// from the SHELL ext wall" -- "only showing up on the HOLOGRAM that has a
// HOLOGRAM SHELL - phase 1 and also the SUITES within that shell" -- "working
// on the regular SHELL with SUITES". PHASE 1's shell has to be painted over
// its own suites, as this drawing's shell is over its suites: painted first,
// the suites' back and side walls covered its front face and its windows.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');
const W = (id, a, b, levelId = 3) => ({ id, levelId, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 9, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] } });
const LEVELS = [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 },
  { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }];
const EMPTY = { walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [], roomTags: [], columns: [],
  beams: [], boneyardOutlines: [], groups: [], levelLocks: [], underlays: [] };
const SUITE = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY, suiteKind: 'residential',
  walls: [W('s1', [0, 30], [20, 30]), W('s2', [20, 30], [20, 15]), W('s3', [20, 15], [0, 15]), W('s4', [0, 15], [0, 30])],
  fenestrations: [{ id: 'w1', wallId: 's1', levelId: 3, view: 'plan', type: 'window', offset: 8, width: 4, sillHeight: 3, headHeight: 6.67 }] };
const holo = (id, x) => ({ id, name: 'suite-a', mode: 'suite', x, z: 0, angleDeg: 0, pivotX: 10, pivotZ: 22.5, source: SUITE });
const PHASE1 = { version: 1, levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('a', [0, 0], [60, 0]), W('b', [60, 0], [60, 30]), W('c', [60, 30], [0, 30]), W('d', [0, 30], [0, 0])],
  holograms: [holo('h1', 0), holo('h2', 20), holo('h3', 40)] };
const f = { version: 1, board: 'drafting', levels: LEVELS, activeLevelIdx: 2, ...EMPTY,
  walls: [W('x', [-30, 0], [-5, 0]), W('y', [-30, 30], [-5, 30])],
  holograms: [{ id: 'p1', name: 'PHASE 1', x: 0, z: 0, angleDeg: 0, pivotX: 30, pivotZ: 15, source: PHASE1 }] };

test('on E1, a PHASE 1 hologram\'s suites are painted before its shell, so its shell goes on over them', async ({ page }) => {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await h.openModel(page, { webgl: false });
  await page.evaluate(async f => window.SharedFileStore.saveSharedFile(
    new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), 'model-drawing'), f);
  await page.goto('/MODEL.html?view=cut%3AE1');
  await page.waitForTimeout(800);
  // EVERY ELEVATION PASS, IN ORDER, by the walls it was handed.
  await page.evaluate(() => {
    window.__passes = [];
    const real = window.DraftCutViewEnv;
    window.DraftCutViewEnv = Object.freeze({ ...real, buildCutViewEnv: (saved, levels) => {
      window.__passes.push((saved?.walls || []).map(w => String(w.id)).sort().join(','));
      return real.buildCutViewEnv(saved, levels);
    } });
  });
  await page.keyboard.press('0');
  await page.waitForFunction(() => (window.__passes || []).some(p => p.includes('a,b,c,d')), null, { timeout: 10000 });
  const passes = await page.evaluate(() => window.__passes);
  const shell = passes.findIndex(p => p === 'a,b,c,d');
  const suite = passes.findIndex(p => p === 's2,s3,s4');
  expect(suite, 'a suite of PHASE 1 was painted').toBeGreaterThanOrEqual(0);
  expect(suite, 'before PHASE 1\'s shell').toBeLessThan(shell);
  // AND ITS SHARED WALL IS THE SHELL'S: the suite pass leaves s1 out.
  expect(passes.some(p => p.split(',').includes('s1'))).toBe(false);
  expect(page.__errors).toEqual([]);
});
