// GROUP A — BEAM AND COLUMN IN MODEL.html: THE PAINTER COMES FIRST.
//
// The measurement this rests on (#390): all seven small tools already preserve
// their data through a MODEL.html open-and-save, so no format work comes first
// and nothing here touches drawing-format.js. What MODEL.html does NOT do is
// draw beams or columns — there is no drawBeam2D and no drawColumn2D anywhere
// in the tree — so a palette entry for either would arm a tool that places an
// entity nobody can see.
//
// AND THAT MAKES THEM URGENT RATHER THAN MERELY MISSING. The old page generates
// beams and teleposts BY ITSELF: a clear span over 19' lands a mid-span beam
// with columns under it, and BUILD HOUSE writes them. So every built house in
// the store already contains structure that MODEL.html holds faithfully and
// does not draw. That is not a missing tool — it is structure a drafter cannot
// see on the page we intend to make the only page.
//
// THE ACCEPTANCE TEST IS THE AUTO ENTITIES, NOT THE DRAWN ONES. Open a house
// BUILD HOUSE made on the old page, open it in MODEL.html, and the mid-span
// beam and its teleposts must appear BEFORE anything has been drawn.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// Painter spy. DraftRender2D is frozen — writable:false, configurable:false —
// so patching its properties after the fact silently does nothing (measured in
// #390). The instrument installs at ASSIGNMENT time and substitutes an unfrozen
// wrapped copy, and records WHICH entity reached each painter, because ids are
// unique within a collection and not across it: a beam, a column and a note can
// all be id 1.
const SPY = `
  window.__paintCalls = {};
  window.__spyState = 'waiting';
  let real = undefined;
  Object.defineProperty(window, 'DraftRender2D', {
    configurable: true,
    get() { return real; },
    set(value) {
      if (!value || typeof value !== 'object') { real = value; return; }
      const copy = {};
      let wrapped = 0;
      for (const name of Object.keys(value)) {
        const member = value[name];
        if (typeof member === 'function' && /^draw/.test(name)) {
          wrapped += 1;
          copy[name] = function (...args) {
            const ids = args.flatMap(a => {
              if (Array.isArray(a)) return a.map(i => i && i.id).filter(v => v != null);
              return (a && typeof a === 'object' && a.id != null) ? [a.id] : [];
            });
            (window.__paintCalls[name] = window.__paintCalls[name] || []).push(ids);
            return member.apply(this, args);
          };
        } else copy[name] = member;
      }
      window.__spyState = 'wrapped ' + wrapped;
      real = copy;
    },
  });
`;

// A house wide enough that the old page's own rule fires: a clear span over 19'
// lands a mid-span beam with teleposts under it. The fixture is asserted to
// contain both before MODEL.html is asked to draw them — a house with no beam
// would make this spec pass for the one reason it must never pass.
async function builtHouse(page) {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-15, -10], [15, -10], [15, 10], [-15, 10]]) {
    await h.clickWorld(page, x, z);
  }
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);

  await h.pickBuild(page, 'bungalow');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(600);
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test.describe('group A — beams and columns must be drawn before they can be placed', () => {

  test('ACCEPTANCE — a BUILD HOUSE beam and its teleposts appear in MODEL.html before anything is drawn',
    async ({ page }) => {
      test.setTimeout(300_000);
      const built = await builtHouse(page);

      // THE FIXTURE FIRST. The old page must really have generated the
      // structure, or the painter has nothing to fail to draw.
      console.log('AUTO STRUCTURE:', JSON.stringify({
        beams: (built.beams || []).length, columns: (built.columns || []).length,
      }));
      expect((built.beams || []).length,
        'the old page must have landed a mid-span beam on this span, or this '
        + 'spec measures nothing').toBeGreaterThan(0);
      expect((built.columns || []).length,
        'and teleposts under it — the order names both').toBeGreaterThan(0);

      // THE STRUCTURE LIVES ON FOUNDATION, and the page opens on MAIN FL. That
      // is the level-and-view filter doing its job, not a miss — a foundation
      // beam has no business on the main floor's plan. So the test goes where
      // the structure is, which is also what a drafter does, and the level and
      // view are taken FROM THE BEAM rather than assumed.
      const beamHome = { levelId: (built.beams || [])[0].levelId,
        view: (built.beams || [])[0].view };
      console.log('BEAM HOME:', JSON.stringify(beamHome));

      await page.addInitScript(SPY);
      await page.goto('/MODEL.html');
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });

      // FIRST, WHERE THE STRUCTURE DOES NOT BELONG. The page opens on MAIN FL's
      // plan and the beams are FOUNDATION structure, so nothing of theirs may
      // paint here. Without this the filter could be deleted entirely and every
      // assertion below would still pass — measured: removing the level-and-view
      // filter survived this spec until this check existed.
      await page.keyboard.press('0');
      await page.waitForTimeout(300);
      const elsewhere = await page.evaluate(() => window.__paintCalls || {});
      expect((elsewhere.drawBeam2D || []).flat(),
        'a foundation beam must not paint on the main floor plan — a page that '
        + 'draws every level at once is not showing the drafter their level')
        .toEqual([]);

      await page.locator('#level-pick').selectOption(String(beamHome.levelId));
      const viewValues = await page.locator('#view-pick option')
        .evaluateAll(nodes => nodes.map(n => n.value));
      const wanted = viewValues.find(v => v.toLowerCase().includes(String(beamHome.view).toLowerCase()));
      if (wanted) await page.locator('#view-pick').selectOption(wanted);
      console.log('VIEWS OFFERED:', JSON.stringify(viewValues), 'picked:', wanted);
      await page.waitForTimeout(200);
      // Force a paint with the spy live: the page paints once at boot, before
      // an init script's wrapper can be in place for the first frame.
      await page.keyboard.press('0');
      await page.waitForTimeout(400);

      const calls = await page.evaluate(() => window.__paintCalls || {});
      const spyState = await page.evaluate(() => window.__spyState);
      console.log('SPY:', spyState, 'PAINTERS:', JSON.stringify(Object.keys(calls).sort()));

      // THE SPY'S OWN CONTROL — an empty result from an instrument that never
      // installed is not a finding about beams.
      expect(String(spyState)).toMatch(/^wrapped [1-9]/);
      expect(Object.keys(calls).length,
        'the page must have painted something, or the fixture is broken rather '
        + 'than the beams missing').toBeGreaterThan(0);

      const reached = painter => (calls[painter] || []).flat();
      const beamId = (built.beams || [])[0].id;
      const columnId = (built.columns || [])[0].id;

      expect({
        beamPainterCalled: Object.keys(calls).some(n => /beam/i.test(n)),
        beamReached: reached('drawBeam2D').includes(beamId),
        columnPainterCalled: Object.keys(calls).some(n => /column/i.test(n)),
        columnReached: reached('drawColumn2D').includes(columnId),
      }, 'a house the drafter built on the old page must show its structure on '
        + 'the new one').toEqual({
        beamPainterCalled: true, beamReached: true,
        columnPainterCalled: true, columnReached: true,
      });

      // AND IT SURVIVES A RELOAD, which is the other half of the rule: a tool
      // counts as landed when its entity comes back AND comes back painted. A
      // page that draws structure it then fails to re-read would pass every
      // assertion above.
      await page.reload();
      await expect(page.locator('#readout')).toContainText('walls', { timeout: 6000 });
      await page.locator('#level-pick').selectOption(String(beamHome.levelId));
      if (wanted) await page.locator('#view-pick').selectOption(wanted);
      await page.keyboard.press('0');
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => window.__paintCalls || {});
      expect({
        beam: (after.drawBeam2D || []).flat().includes(beamId),
        column: (after.drawColumn2D || []).flat().includes(columnId),
      }, 'the structure must still be painted after a reload').toEqual({
        beam: true, column: true,
      });

      // WHAT THIS CHECK CANNOT SEE, said rather than left implied: it asserts
      // the entity REACHED its painter, not that the painter drew anything. A
      // painter that took the beam and returned without stroking would satisfy
      // every line above. That is the altitude the order asked for — assert the
      // beam, not the ink — and the ink is drawWallSeg2D's own coverage
      // problem, not this test's to solve twice.
    });
});
