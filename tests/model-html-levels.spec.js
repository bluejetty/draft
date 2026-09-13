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
  const names = await page.locator('.lv-card .lv-name').allTextContents();
  expect(names).toEqual(HOUSE.levels.map(l => l.name));

  // ROOF AND SITE HAVE NO LAYER VIEWS and must therefore show no rows. This
  // is the same fact that seats them together in one rail row rather than
  // giving each a PLAN/LAYOUT pair, so a panel that invented rows for them
  // would be disagreeing with the rail it edits.
  const rows = await page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.lv-card').forEach(card => {
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

test('THE AGREEMENT: a layer row moves the level, the view, the picker and the panel together',
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

    // FOUR CONTROLS, ONE ANSWER.
    expect(new URL(page.url()).searchParams.get('level')).toBe(levelId);
    expect(new URL(page.url()).searchParams.get('view')).toBe(viewId);
    expect(await page.locator('#level-pick').inputValue()).toBe(levelId);
    expect(await page.locator('#view-pick').inputValue()).toBe(viewId);
    expect(await page.locator('.lv-layer[data-active]')
      .evaluateAll(els => els.map(e => e.dataset.layer)),
    'the panel lit a different row than the page is showing').toEqual([target]);
    // And exactly one card is marked, on the level actually being shown.
    expect(await page.locator('.lv-card[data-active] .lv-name').allTextContents())
      .toEqual([HOUSE.levels.find(l => String(l.id) === levelId).name]);
  });

test('the panel is in the right-edge group and goes away with it', async ({ page }) => {
  await openPanel(page);
  await expect(page.locator('#levels-panel')).toBeVisible();

  // ONE TAB GROUP, NOT TWO. Devin's ruling: LEVELS/LAYERS is a third pane
  // beside VIEWS and PROPERTIES rather than a second rotated tab on the same
  // edge, because two tabs on one edge is how #389's chrome-on-chrome
  // collisions happened. So it collapses with the panel that holds it.
  await page.locator('#right-tab').click();
  await page.waitForTimeout(200);
  await expect(page.locator('#levels-panel')).toBeHidden();
  // The seats stay: reachable means one click, not simultaneously visible.
  await expect(page.locator('.seat').first()).toBeVisible();
});
