// THE LEVELS / LAYERS PANEL on MODEL.html — the rail's editor.
//
// Work order: SKIPPER-LEVELS-AND-RAIL-WORKORDER. Movie: "i will also need the
// LEVELS / LAYERS menu too", and "the level layers should be a tab on the
// right side like in the DC files".
//
// THE PANEL IS A THIRD CONTROL ON ONE PIECE OF STATE, and that is the whole
// risk in it. goToView's own comment already said it for the rail and the
// picker -- "two controls on ONE piece of state, and a seat that left the
// picker behind would put two answers on screen at once" -- and the panel was
// written one function below that warning and broke it anyway: clicking a
// layer row on another level moved the URL, the plan and the picker to STAIR
// while the panel went on lighting PLAN. It looked correct in a screenshot.
// That is what the agreement check below is for.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
// MOVIE'S OWN HOUSE, because the panel is a view of HIS level list: five
// levels, two of them (SITE, ROOF) carrying no layer views at all. A fixture
// where every level looked alike could not tell a derived panel from a
// hard-coded one. proto/README.md says what this file is and is not.
const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'perf-bungalow.draft'), 'utf8'));

async function openPanel(page, query = '') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: HOUSE });
  await page.goto(`/MODEL.html?mode=night&right=1${query}`);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

test('a card per level, and the layer rows are the module\'s not a copy', async ({ page }) => {
  await openPanel(page);

  // ASSERTED AGAINST drawing.levels AND THE MODULE, never against a list
  // written out here. A hardcoded expectation would pass just as well on a
  // panel holding its own copy of the level table -- which is how that lookup
  // came to have four homes (#325), and what this panel must not become.
  // SCOPED TO `[data-level]`, because the panel now holds a card that is NOT
  // a level: the BONEYARD, which is storage outside the stack. This check's
  // claim is "a card per LEVEL" and the selector says so now, rather than
  // meaning it only while nothing else happened to be a .lv-card.
  const names = await page.locator('.lv-card[data-level] .lv-name').allTextContents();
  expect(names).toEqual(HOUSE.levels.map(l => l.name));

  // ROOF AND SITE HAVE NO LAYER VIEWS and must therefore show no rows. This
  // is the same fact that seats them together in one rail row rather than
  // giving each a PLAN/LAYOUT pair, so a panel that invented rows for them
  // would be disagreeing with the rail it edits.
  const rows = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.lv-card[data-level]').forEach(card => {
      out[card.querySelector('.lv-name').textContent] =
        [...card.querySelectorAll('.lv-layer')].map(r => r.textContent);
    });
    return out;
  });
  const fromModule = await page.evaluate(ids => {
    const LV = window.DraftLayerViews;
    const out = {};
    ids.forEach(([id, name]) => {
      out[name] = LV.layerViewsForLevelId(id).map(v => v.label || v.id);
    });
    return out;
  }, HOUSE.levels.map(l => [l.id, l.name]));
  expect(rows).toEqual(fromModule);
  expect(rows.SITE, 'SITE has no layer views and must show no rows').toEqual([]);
  expect(rows.ROOF, 'ROOF has no layer views and must show no rows').toEqual([]);
});

test('THE AGREEMENT: a layer row moves the level, the view, the readout and the panel together',
  async ({ page }) => {
    await openPanel(page);

    // A ROW ON A LEVEL THE DRAFTER IS NOT STANDING ON. The bug this catches
    // needed both halves -- a level change AND a view change -- because
    // goToLevel rebuilt the panel before goToView had set the view, so the
    // panel lit that level's DEFAULT while everything else showed the view
    // actually asked for. Clicking a row on the active level would have
    // passed throughout.
    const target = await page.evaluate(() => {
      const card = [...document.querySelectorAll('.lv-card')]
        .find(c => !c.hasAttribute('data-active') && c.querySelector('.lv-layer'));
      return card.querySelector('.lv-layer:last-child').dataset.layer;
    });
    const [levelId, viewId] = target.split(':');
    await page.locator(`[data-layer="${target}"]`).click();
    await page.waitForTimeout(250);

    // FOUR READINGS, ONE ANSWER. The two SELECTs §7 deleted were two of them;
    // the readout is what a drafter reads instead, so it takes their place
    // rather than the check losing half its subject.
    expect(new URL(page.url()).searchParams.get('level')).toBe(levelId);
    expect(new URL(page.url()).searchParams.get('view')).toBe(viewId);
    expect(await h.modelLevelId(page)).toBe(levelId);
    expect(await h.modelViewId(page)).toBe(viewId);
    expect(await page.locator('.lv-layer[data-active]')
      .evaluateAll(els => els.map(e => e.dataset.layer)),
    'the panel lit a different row than the page is showing').toEqual([target]);
    // And exactly one card is marked, on the level actually being shown.
    expect(await page.locator('.lv-card[data-active] .lv-name').allTextContents())
      .toEqual([HOUSE.levels.find(l => String(l.id) === levelId).name]);
  });

test('every chrome hook is still exactly one control', async ({ page }) => {
  await openPanel(page);

  // ONE SELECTOR, ONE CONTROL. The panel's level buttons were first given
  // `data-level-pick` -- the attribute the chrome bar's select carried, and
  // the one model-html-switcher.spec.js drove it by. `[data-level-pick]`
  // then resolved to six elements and four switcher tests failed on strict
  // mode, nineteen minutes into CI, because no spec here had ever run
  // alongside that one.
  //
  // The select is gone and the collision with it cannot recur, but the rule
  // it taught outlived it: a hook a spec drives by must name one thing. The
  // list is the hooks the shell left standing, DELETE among them -- §7a gave
  // the one button two attributes for a while, which is the same fault in
  // the other direction.
  for (const sel of ['[data-model-save]', '[data-file-new]', '[data-file-open]',
    '[data-file-save-as]', '[data-file-ext]', '[data-delete]',
    '[data-tool-key="wall"]', '[data-props-slot]', '[data-levels-panel]']) {
    expect(await page.locator(sel).count(), `${sel} is no longer unique`).toBe(1);
  }
});

test('the panel is in the right-edge group, and collapsing it keeps the level names',
  async ({ page }) => {
    await openPanel(page);
    await expect(page.locator('#levels-panel')).toBeVisible();
    await expect(page.locator('.lv-datum')).toBeVisible();

    // ONE TAB GROUP, NOT TWO. Devin's ruling: LEVELS/LAYERS is a third pane
    // beside VIEWS and PROPERTIES rather than a second rotated tab on the
    // same edge, because two tabs on one edge is how #389's chrome-on-chrome
    // collisions happened. So it collapses with the panel that holds it.
    //
    // WHAT COLLAPSING NO LONGER DOES IS HIDE IT (§7c). While the chrome bar
    // had a level select, the panel was the SECOND way to change level and
    // could go away with the rail; §7 deleted the select, so a collapsed
    // rail that hid the cards would leave the page with no way to change
    // level at all. Collapsed is the NAMES ONLY -- same buttons, same hook.
    await page.locator('#right-tab').click();
    await page.waitForTimeout(200);
    await expect(page.locator('.lv-datum'), 'collapsed must drop the editing furniture')
      .toBeHidden();
    await expect(page.locator('.lv-layer').first()).toBeHidden();
    const rows = page.locator('[data-level-row]');
    await expect(rows.first(), 'a collapsed rail left no way to change level')
      .toBeVisible();

    // Reachable, not merely present: the switch still works from here.
    const target = await page.evaluate(() => [...document.querySelectorAll('.lv-card')]
      .find(c => !c.hasAttribute('data-active')).dataset.level);
    await page.locator(`[data-level-row="${target}"]`).click();
    await page.waitForTimeout(250);
    expect(await h.modelLevelId(page)).toBe(target);

    // The seats stay: reachable means one click, not simultaneously visible.
    await expect(page.locator('.seat').first()).toBeVisible();
  });

test('+ ADD appends a real level, and the panel grows by one card', async ({ page }) => {
  await openPanel(page);
  const before = await page.locator('.lv-card').count();

  // The old page asks for a name and an elevation; both prompts are answered
  // here so the test drives the same path a drafter does rather than calling
  // an internal.
  await page.evaluate(() => {
    window.prompt = q => (/Level name/.test(q) ? 'ATTIC' : '20');
  });
  await page.locator('[data-add-level]').click();
  await page.waitForTimeout(250);

  expect(await page.locator('.lv-card').count()).toBe(before + 1);
  const names = await page.locator('.lv-card .lv-name').allTextContents();
  expect(names, 'the new level must be named from the prompt').toContain('ATTIC');

  // ABOVE THE TOP FLOOR AND BELOW ROOF — the old page's stacking rule, and the
  // reason the seating chart puts it where it does. Appending at the end would
  // read as correct on a count and be wrong on the rail.
  expect(names.indexOf('ATTIC')).toBeLessThan(names.indexOf('2ND FL'));
  expect(names.indexOf('ATTIC')).toBeGreaterThan(names.indexOf('ROOF'));

  // It is an EDIT, so the page says so before anything is written.
  await expect(page.locator('[data-model-save]')).toHaveText(/unsaved/i);
});

test('delete cascades: nothing is left pointing at the level that is gone',
  async ({ page }) => {
    await openPanel(page);

    // WHAT THIS ASSERTS AND WHY IT IS NOT THE READOUT. An earlier version
    // checked that the wall and dimension counts fell, and it PASSED with
    // fenestrations, fixtures, stairs, notes and roomTags deleted from the
    // collection list -- which is the exact bug the old page's own comment
    // records having shipped five times. The readout does not carry those
    // five, so the check could not see the thing it was written for.
    //
    // So: take the level's id, delete it, save, and require that NO item in
    // ANY level-owned collection still carries that id. Written over the whole
    // list, so it covers a collection the moment a fixture has one.
    const victim = await page.evaluate(() => {
      const card = [...document.querySelectorAll('.lv-card')]
        .find(c => c.querySelector('.lv-layer'));
      return card.dataset.level;
    });
    const before = await h.savedDrawing(page);
    const owned = ['lines', 'walls', 'floors', 'shapes', 'roofs', 'outlines',
      'surfaceOpenings', 'dimensions', 'columns', 'beams', 'fenestrations',
      'fixtures', 'stairs', 'notes', 'roomTags', 'electricDevices', 'underlays'];
    const countOn = (doc, id) => Object.fromEntries(owned
      .map(k => [k, (doc[k] || []).filter(i => i && String(i.levelId) === String(id)).length])
      .filter(([, n]) => n > 0));
    const had = countOn(before, victim);
    // NOT A VACUOUS PASS: the level must actually have owned something, or
    // "nothing points at it afterwards" is true of an empty level.
    expect(Object.keys(had).length,
      `level ${victim} owns nothing — deleting it would prove nothing`)
      .toBeGreaterThan(2);

    await page.evaluate(() => { window.confirm = () => true; });
    await page.locator(`[data-delete-level="${victim}"]`).click();
    await page.waitForTimeout(300);
    await page.locator('[data-model-save]').click();
    await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

    const after = await h.savedDrawing(page);
    expect(countOn(after, victim),
      `these collections were left pointing at deleted level ${victim} `
      + `(it owned ${JSON.stringify(had)})`).toEqual({});
    expect((after.levels || []).map(l => String(l.id)))
      .not.toContain(String(victim));
  });

test('deleting the level you are STANDING on moves you to a real one',
  async ({ page }) => {
    // The path the fallback does NOT cover: `?level=` naming the level being
    // deleted. Left alone it would point at a level that no longer exists, and
    // the page would warn and quietly show a different one than the URL claims.
    await openPanel(page);
    const standing = await h.modelLevelId(page);
    await page.goto(page.url().replace(/([?&])level=\d+/, '$1') + `&level=${standing}`);
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

    await page.evaluate(() => { window.confirm = () => true; });
    await page.locator(`[data-delete-level="${standing}"]`).click();
    await page.waitForTimeout(300);

    const ids = await page.locator('.lv-card').evaluateAll(els => els.map(e => e.dataset.level));
    expect(ids, 'the deleted level is still in the panel').not.toContain(standing);
    const now = new URL(page.url()).searchParams.get('level');
    if (now !== null) {
      expect(ids, 'the URL still names the level that was just deleted').toContain(now);
    }
    expect(ids).toContain(await h.modelLevelId(page));
  });

test('a cancelled confirm deletes nothing', async ({ page }) => {
  await openPanel(page);
  const before = await page.locator('.lv-card').count();
  await page.evaluate(() => { window.confirm = () => false; });
  await page.locator('[data-delete-level]').first().click();
  await page.waitForTimeout(200);
  expect(await page.locator('.lv-card').count()).toBe(before);
  await expect(page.locator('[data-model-save]'),
    'a cancelled delete marked the drawing dirty').not.toHaveText(/unsaved/i);
});

test('ELEVATIONS are the module\'s four, and pressing one enters that view',
  async ({ page }) => {
    await openPanel(page);
    // FROM autoElevationCuts, the one home for that derivation, so the panel
    // cannot name a different set of elevations than the rail seats.
    const fromPage = await page.evaluate(() => [...document.querySelectorAll('.lv-layer')]
      .map(b => b.textContent).filter(t => /^E\d · /.test(t)));
    expect(fromPage).toHaveLength(4);
    expect(fromPage.map(t => t.split(' · ')[0])).toEqual(['E1', 'E2', 'E3', 'E4']);

    await page.locator('.lv-layer', { hasText: /^E3 · / }).click();
    await page.waitForTimeout(250);
    expect(new URL(page.url()).searchParams.get('view')).toBe('cut:E3');
    // The seat for the same elevation lights too: one piece of state.
    await expect(page.locator('.seat.active')).toHaveCount(1);
  });

test('SECTIONS tells the truth about a page with no cut tool', async ({ page }) => {
  await openPanel(page);

  // THE OLD PAGE SAYS "Press [C] to cut a view". THIS PAGE HAS NO [C].
  // Carrying that hint across would tell a drafter to press a key that does
  // nothing — the same seam the build bar is built on. So the empty state
  // says what is true here, and this asserts BOTH halves: the claim is not
  // made, and the key really does nothing.
  const empty = page.locator('[data-no-sections]');
  await expect(empty).toBeVisible();
  await expect(empty).not.toContainText('[C]');

  const before = await h.savedDrawing(page);
  await page.locator('body').press('c');
  await page.waitForTimeout(200);
  await expect(page.locator('[data-model-save]'),
    'pressing C changed the drawing — this page claims no cut tool').not.toHaveText(/unsaved/i);
  expect((await h.savedDrawing(page)).cuts || []).toEqual(before.cuts || []);
});

test('a stored section gets a row and a delete that works', async ({ page }) => {
  // `cuts` is LAYOUT's to author, so the fixture writes one directly rather
  // than pretending this page can cut.
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    saved.cuts = [{ id: 'S1', name: 'S1', elev: 0, levelId: null,
      startPt: { x: -20, z: 0 }, endPt: { x: 30, z: 0 }, dirVec: { x: 0, z: 1 } }];
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: HOUSE });
  await page.goto('/MODEL.html?mode=night&right=1');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });

  await expect(page.locator('[data-no-sections]')).toHaveCount(0);
  await expect(page.locator('[data-delete-cut="S1"]')).toBeVisible();

  // LOOK AT IT FIRST. Deleting a section the drafter is not on exercises only
  // half the code: the other half moves them off a cut the drawing no longer
  // has, and without this the page goes on painting a deleted section. An
  // earlier version of this test deleted without entering the view and passed
  // with that branch mutated dead.
  await page.locator('[data-delete-cut="S1"]').locator('xpath=preceding-sibling::button[1]').click()
    .catch(async () => { await page.locator('.lv-layer', { hasText: /^S1$/ }).click(); });
  await page.waitForTimeout(250);
  expect(new URL(page.url()).searchParams.get('view'),
    'the test did not actually enter the section view').toBe('cut:S1');

  await page.evaluate(() => { window.confirm = () => true; });
  await page.locator('[data-delete-cut="S1"]').click();
  await page.waitForTimeout(250);
  await expect(page.locator('[data-no-sections]')).toBeVisible();
  await expect(page.locator('[data-model-save]')).toHaveText(/unsaved/i);
  // AND THE DRAFTER IS NO LONGER LOOKING AT IT.
  expect(new URL(page.url()).searchParams.get('view'),
    'the page is still showing a section the drawing no longer has').not.toBe('cut:S1');
});

test('the BONEYARD is a workspace now, and 3D is still a chair', async ({ page }) => {
  await openPanel(page);

  // THIS CHECK ENCODED A RULING THAT HAS BEEN REVERSED, and the reversal is
  // the point rather than a loosening. It read:
  //
  //   expect(await page.locator('[data-add-shelf]').count(),
  //     'a + SHELF button would create something this page cannot reach')
  //     .toBe(0);
  //
  // on the grounds that "the level picker offers no negative pseudo-level, so
  // a + SHELF would write a shelf into the file this page can never open".
  // That was true and is no longer: activeLevelId() answers -shelfId, and a
  // wall parked on a shelf survives the reload (c8654eb). Movie ruled the
  // boneyard back on, 14 Sep.
  //
  // So the claim flips rather than relaxing: the button must EXIST, and the
  // card must be reachable. A page that merely stopped asserting the absence
  // would pass with dead text again.
  expect(await page.locator('[data-shelf]').count(),
    'the fixture has one shelf and the panel must show it').toBe(1);
  expect(await page.locator('[data-add-shelf]').count(),
    'and + SHELF is a real control now').toBe(1);
  await expect(page.locator('[data-boneyard]'),
    'the card selects, rather than printing its shelves as dead text')
    .toHaveCount(1);

  // 3D: a chair, not a button. Movie is leaving 3D to last, and there is no
  // WebGL, three.js or perspective camera in this file at all — so the seat
  // is held without the label promising anything.
  await expect(page.locator('[data-view3d]')).toBeDisabled();
});
