// TIER 2a — MODEL.html paints ONE level, not five stacked.
//
// Tier 1 drew every level at once. That is not a drawing, it is five drawings
// on top of each other, and it was the first thing tier 2 owed. See
// RD-DOCUMENTS/SPEC-model-html-tiers.md.
//
// The filter is FIVE RULES, not one, measured out of MODEL.dc.html:6505 rather
// than guessed:
//
//   walls / lines / floors   level AND view
//   roofs / outlines         level ONLY -- no view filter
//   and the view filter switches ITSELF OFF on a level with no layer views
//   (ROOF id 7, SITE id 8), which show everything they hold.
//
// Each test below is written to fail if the filter were deleted, not merely to
// pass while it happens to be there.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// The rule, longhand. Deliberately NOT layer-views.js: asking the module the
// same question the page asks it would let a wrong answer agree with itself.
const MAIN_FL = 3, FOUNDATION = 1;
const onLevel = (item, levelId, viewId) => Number(item.levelId) === levelId
  && (item.view || 'plan') === viewId;

const readout = page => page.locator('#readout');
const wallCount = async page => Number(
  (await readout(page).textContent()).match(/walls (\d+)\//)?.[1] ?? -1);

async function houseOnOldPage(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
}

test.describe('MODEL.html levels', () => {
  test('it opens on MAIN FL and paints that level only', async ({ page }) => {
    const saved = await houseOnOldPage(page);
    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('MAIN FL', { timeout: 5000 });

    const expected = saved.walls.filter(w => onLevel(w, MAIN_FL, 'plan')).length;

    // THE CONTROL. Without these two the test passes on a page that ignores
    // the filter entirely: if every wall happened to be on MAIN FL, "shows
    // the right number" and "shows all of them" are the same assertion.
    expect(expected, 'the fixture must put walls on MAIN FL').toBeGreaterThan(0);
    expect(expected, 'and must ALSO put walls elsewhere, or nothing is filtered')
      .toBeLessThan(saved.walls.length);

    expect(await wallCount(page)).toBe(expected);
  });

  test('a different level is a different drawing', async ({ page }) => {
    const saved = await houseOnOldPage(page);

    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('MAIN FL', { timeout: 5000 });
    const onMain = await wallCount(page);

    await page.goto(`/MODEL.html?level=${FOUNDATION}`);
    await expect(readout(page)).toContainText('FOUNDATION', { timeout: 5000 });
    const onFoundation = await wallCount(page);

    // FOUNDATION opens on the concrete plan, not the walls plan -- its default
    // layer view is 'foundation'. So this is not only a different level, it is
    // a different DRAWING of it, which is the whole point of layer-views.js.
    await expect(readout(page)).toContainText('foundation');
    expect(onFoundation).toBe(
      saved.walls.filter(w => onLevel(w, FOUNDATION, 'foundation')).length);
    expect(onMain + onFoundation,
      'two levels together must still be fewer than the whole drawing, or '
      + 'nothing is being held back')
      .toBeLessThan(saved.walls.length);
  });

  test('ROOF has no layer views, so it holds nothing back', async ({ page }) => {
    const saved = await houseOnOldPage(page);
    await page.goto('/MODEL.html?level=7');
    await expect(readout(page)).toContainText('ROOF', { timeout: 5000 });

    // The third rule: a level with no layer views shows everything ON it, with
    // no view filter at all. The readout says `all` rather than a view name.
    await expect(readout(page)).toContainText('all');
    expect(await wallCount(page))
      .toBe(saved.walls.filter(w => Number(w.levelId) === 7).length);
  });

  test('an unknown ?level falls back to MAIN FL and says so', async ({ page }) => {
    await houseOnOldPage(page);
    const warnings = [];
    page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });

    await page.goto('/MODEL.html?level=99');
    await expect(readout(page)).toContainText('MAIN FL', { timeout: 5000 });
    expect(warnings.join(' '), 'a bad level must not blank the page silently')
      .toContain('99');
  });

  // ── tier 2b: roofs and shapes ───────────────────────────────────────────
  //
  // Both painters already exist in render-2d.js -- drawRoof2D and drawShape2D
  // were extracted for the sheet composer -- so this tier wires them up and
  // supplies the `env` they read, rather than writing a painter.

  test('the roof paints, and it lives on ROOF rather than the floor below',
    async ({ page }) => {
      const saved = await houseOnOldPage(page);

      // Measured, not assumed: the bone press puts exactly one roof on level 7.
      const roofsOnRoofLevel = (saved.roofs || []).filter(r => Number(r.levelId) === 7);
      expect(roofsOnRoofLevel.length, 'the fixture must build a roof').toBe(1);

      // MAIN FL does not show it. Rule four says roofs filter by LEVEL, so a
      // roof on 7 is absent from 3 -- and if roofs were painted unfiltered the
      // way tier 1 painted everything, this is the assertion that catches it.
      await page.goto('/MODEL.html');
      await expect(readout(page)).toContainText('MAIN FL', { timeout: 5000 });
      await expect(readout(page)).toContainText('roofs 0/');

      await page.goto('/MODEL.html?level=7');
      await expect(readout(page)).toContainText('ROOF', { timeout: 5000 });
      await expect(readout(page)).toContainText('roofs 1/');

      // And it is INK, not just a count. drawRoof2D strokes the draw-roof role
      // and fills a wash derived from it; nothing else on this page is brown,
      // so red>green>blue with a real red channel isolates it.
      //
      // DELIBERATELY A FAMILY, NOT A VALUE. The role is #7a4a21 on day and
      // #c4915a on night, and both satisfy this predicate -- so a skin change
      // cannot turn this red for a non-defect, while a roof that stops being
      // painted still does. The named hex used to be in this comment and it
      // went stale the moment the night value was added; the comment is the
      // only place it lived, which is why nothing failed.
      const brown = await page.evaluate(() => {
        const c = document.getElementById('plan');
        const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 90 && data[i] > data[i + 1] + 12 && data[i + 1] > data[i + 2] + 6) n += 1;
        }
        return n;
      });
      expect(brown, 'the roof must be painted, not merely counted').toBeGreaterThan(200);
    });

  test('a shape drawn on the old page paints on the new one', async ({ page }) => {
    // Drawn with the REAL tool rather than seeded into the store: the whole
    // claim of this page is that it reads what MODEL.dc.html actually saves,
    // and a hand-written fixture would not test that. Nothing in the tour makes
    // a shape, which is why this one is drawn by hand.
    await h.openModel(page, { webgl: false, rails: false });
    await h.waitForModelReady(page);
    await h.selectTool(page, 'Shape');
    await h.clickWorld(page, -8, -6);
    await h.clickWorld(page, 8, -6);
    await h.clickWorld(page, 8, 6);
    await h.clickWorld(page, -8, 6);
    await page.keyboard.press('Enter');
    await h.waitForSaved(page);

    const saved = await h.savedDrawing(page);
    expect(saved.shapes, 'the shape tool must have committed one').toHaveLength(1);
    const shapeLevel = Number(saved.shapes[0].levelId);

    await page.goto(`/MODEL.html?level=${shapeLevel}`);
    await expect(readout(page)).toContainText('shapes 1/', { timeout: 5000 });

    // drawShape2D takes its colour from env.shapeColor, which this page feeds
    // from the palette -- so this also proves the env is wired, not just the
    // painter. Teal: green and blue both well above red.
    const teal = await page.evaluate(() => {
      const c = document.getElementById('plan');
      const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 1] > data[i] + 20 && data[i + 1] > 90 && data[i + 2] > data[i] + 10) n += 1;
      }
      return n;
    });
    expect(teal, 'the shape must be painted in the palette\'s shape colour')
      .toBeGreaterThan(100);
  });

  // ── the regression tier 2a shipped ──────────────────────────────────────
  //
  // Tier 2a defaulted the layer view and gave no way to change it. MAIN FL
  // defaults to the walls plan; a floor saves with `view: 'floor'`; so every
  // floor was filtered out of every reachable view and paintFloors() drew
  // nothing at all. It went unnoticed because the level specs asserted WALLS.
  // Movie spotted `floors 0` on the live page.

  test('a level is not one drawing: ?view= reaches the floor layout',
    async ({ page }) => {
      const saved = await houseOnOldPage(page);

      // THE CONTROL. Without it this passes on a drawing with no floors at
      // all, which is exactly the ambiguity the live screenshot had.
      const floorsHere = (saved.floors || [])
        .filter(f => Number(f.levelId) === MAIN_FL).length;
      expect(floorsHere, 'the fixture must put a floor on MAIN FL, or this '
        + 'test cannot tell "filtered out" from "not there"').toBeGreaterThan(0);

      // The walls plan legitimately hides them — that is the rule, not a bug.
      await page.goto('/MODEL.html?level=3');
      await expect(readout(page)).toContainText('plan', { timeout: 5000 });
      await expect(readout(page)).toContainText('floors 0/');

      // The floor layout shows them. Before ?view= existed there was no URL
      // that could reach this state.
      await page.goto('/MODEL.html?level=3&view=floor');
      await expect(readout(page)).toContainText('floor', { timeout: 5000 });
      await expect(readout(page)).toContainText(`floors ${floorsHere}/`);

      // And the floors are INK, not a count. The wash is a low-alpha blue-grey
      // over the ground, so it reads as pixels that are off-ground but nowhere
      // near wall-bright.
      const wash = await page.evaluate(() => {
        const c = document.getElementById('plan');
        const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
        let n = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 34 && data[i] < 90 && data[i + 2] > data[i]) n += 1;
        }
        return n;
      });
      expect(wash, 'the floor must be painted, not merely counted')
        .toBeGreaterThan(500);
    });

  test('an unknown ?view falls back to the level default and says so',
    async ({ page }) => {
      await houseOnOldPage(page);
      const warnings = [];
      page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });

      await page.goto('/MODEL.html?level=3&view=elevation');
      await expect(readout(page)).toContainText('plan', { timeout: 5000 });
      expect(warnings.join(' ')).toContain('elevation');
    });
});
