// THE GARAGE SLAB ON THE CONSTRUCTION LAYOUT, as MODEL draws it.
//
// Movie, 16 Oct, reading the SECTIONS sheet of his two-storey detached garage
// against the model: "the slab shows in model space but not on the
// construction plan layout".
//
// The sheet paints through cut-view-env.js, and that env answered which
// foundation a garage has from the outline and its BONEYARD master alone --
// never from PROJECT's section table, which is where the build files the
// drafter's choice. A frost-walled garage named only there read as a grade
// beam on the sheet, and neither of the painter's two floor passes drew for
// it. The rule is cut-view.js garageFoundationKind now, and every env asks it.
// proto/garage-slab-sheet-harness.js is this change's engine (and its gate,
// under --mutate); this spec is the page itself, in the browser he saw it on.
const { test, expect } = require('@playwright/test');

const FIXTURE = '/proto/repro-detached-2storey-frostwall.draft';
const CONCRETE = 'rgba(150,150,155,0.35)';   // weight(C.concrete, 0.35): a slab in section
const ASSEMBLY = 'rgba(89,128,166,0.15)';    // the floor assembly band
const S1 = { id: 901, name: 'S1', startPt: { x: -18, z: 0 }, endPt: { x: 18, z: 0 }, dirVec: { x: 0, z: 1 }, elev: 0, levelId: 3 };
const S2 = { id: 902, name: 'S2', startPt: { x: 0, z: -21 }, endPt: { x: 0, z: 21 }, dirVec: { x: 1, z: 0 }, elev: 0, levelId: 3 };

// Paint one cut through the page's own env and count the fills laid in each ink.
const fillsOn = (page, fixture, cut) => page.evaluate(async ({ fixture: at, cut: c }) => {
  const s = await (await fetch(at)).json();
  const env = window.DraftCutViewEnv.buildCutViewEnv(s, s.levels);
  const garage = env.garageOutlines(3)[0];
  const canvas = document.createElement('canvas');
  canvas.width = 1600; canvas.height = 1000;
  const ctx = canvas.getContext('2d');
  const inks = {};
  // A real canvas hands an rgba() back with spaces after its commas; the
  // painter's weight() writes it without. Counted as written.
  const count = () => { const ink = String(ctx.fillStyle).replace(/\s+/g, ''); inks[ink] = (inks[ink] || 0) + 1; };
  const fill = ctx.fill.bind(ctx), fillRect = ctx.fillRect.bind(ctx);
  ctx.fill = (...a) => { count(); return fill(...a); };
  ctx.fillRect = (...a) => { count(); return fillRect(...a); };
  window.DraftCutView.drawCutView(env, ctx, 1600, 1000, c, { pxPerFt: 40 });
  return { foundation: env.garageFoundation(garage), inks, floorIds: env.floors().map(f => f.id) };
}, { fixture, cut });

for (const pageName of ['LAYOUT.html', 'MODEL.html']) {
  test(`${pageName}: a frost-walled garage the PROJECT table names draws its slab on the section`, async ({ page }) => {
    await page.goto(`/${pageName}`);
    await page.waitForFunction(() => window.DraftCutView && window.DraftCutViewEnv);
    for (const cut of [S1, S2]) {
      const seen = await fillsOn(page, FIXTURE, cut);
      // "the slab shows in model space but not on the construction plan layout"
      expect(seen.foundation).toBe('frostwall');
      expect(seen.inks[CONCRETE] || 0).toBeGreaterThanOrEqual(1);
    }
  });
}

test('LAYOUT.html: the floor band over the garage breaks at the stair opening, as MODEL\'s does', async ({ page }) => {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => window.DraftCutView && window.DraftCutViewEnv);
  const seen = await fillsOn(page, '/proto/repro-movie-detached-2storey.draft', S2);
  // The painter asks env.floorOpenings(floor.id); the sheet's floor record
  // carried no id, so its band ran unbroken across the stair.
  expect(seen.floorIds).toEqual(['floor-15', 'floor-29']);
  expect(seen.inks[ASSEMBLY]).toBe(2);
});
