// Generated elevations and sections are read-only drawings: a click there
// carries view-space world coordinates, so every plan-space tool must refuse
// it the way STAIR always has — no geometry may land on the plan from a cut
// view, whatever tool the drafter left armed.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await h.clickWorld(page, -8, -6);
  await page.waitForTimeout(300);
}

async function buildAndOpenE1(page) {
  await drawOutlineRect(page);
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
  await h.waitForSaved(page);
  await page.locator('.cut-row', { hasText: 'E1' }).click({ position: { x: 18, y: 8 } });
  await page.waitForTimeout(400);
  await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');
}

function schemaCensus(saved) {
  return {
    walls: saved.walls.length,
    lines: saved.lines.length,
    floors: saved.floors.length,
    dimensions: saved.dimensions.length,
    columns: saved.columns.length,
    beams: saved.beams.length,
    fixtures: (saved.fixtures || []).length,
    fenestrations: saved.fenestrations.length,
  };
}

test('every plan-space tool refuses clicks inside a generated elevation', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await buildAndOpenE1(page);
  const before = schemaCensus(await h.savedDrawing(page));

  const tools = [
    ['Wall', /Walls are placed in TOP \/ PLAN view/],
    ['Line', /Lines are placed in TOP \/ PLAN view/],
    ['Floor', /Floors are placed in TOP \/ PLAN view/],
    ['Shape', /Shapes are placed in TOP \/ PLAN view/],
    ['Dimension', /Dimensions are placed in TOP \/ PLAN view/],
    ['Column', /Columns are placed in TOP \/ PLAN view/],
    ['Beam', /Beams are placed in TOP \/ PLAN view/],
    ['Fixture', /Fixtures are placed in TOP \/ PLAN view/],
    ['Node', /Nodes are placed in TOP \/ PLAN view/],
    ['Fenestration', /Openings are placed in TOP \/ PLAN view/],
  ];
  for (const [name, message] of tools) {
    await h.selectTool(page, name);
    await h.clickWorld(page, -4, -3);
    await h.clickWorld(page, 4, 3);
    await expect(page.locator('[data-model-drawing-message]')).toContainText(message);
  }

  // The outline tool arms through the keyboard; same refusal.
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -4, -3);
  await expect(page.locator('[data-model-drawing-message]'))
    .toContainText(/Outlines are placed in TOP \/ PLAN view/);

  // Nothing landed on the plan from any of it.
  const after = schemaCensus(await h.savedDrawing(page));
  expect(after).toEqual(before);
});

test('a wall drawn back in TOP / PLAN still works after a refused cut-view click', async ({ page }) => {
  await h.openModel(page, { webgl: false });
  await buildAndOpenE1(page);

  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, -4, -3);
  await expect(page.locator('[data-model-drawing-message]'))
    .toContainText(/Walls are placed in TOP \/ PLAN view/);

  // Back to the plan through the active level card — the tool draws again.
  await page.locator('.level-row.active').locator('.level-body').click();
  await expect(page.locator('[data-model-title-detail]').last()).not.toHaveText('E1');
  const before = (await h.savedDrawing(page)).walls.length;
  await h.clickWorld(page, -4, 0);
  await h.clickWorld(page, 4, 0);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);
  expect(saved.walls.length).toBe(before + 1);
});

test('the finale reveal stands the drawing tool down before parking in E1', async ({ page }) => {
  await h.openModel(page, { boneReveal: true });

  // The guided tour up to the roof pause, drawing the outline WITH the wall
  // tool armed later: trace, stairs, straight to roof, ROOF DONE, bone.
  await page.locator('[data-select-house]').click();
  await page.keyboard.press('Enter');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await page.locator('[data-tour-popup]').click(); // FOUNDATION DONE → MAIN
  await h.selectTool(page, 'Stair');
  await h.clickWorld(page, 2, -2);
  await h.clickWorld(page, 2, 4);
  await h.waitForSaved(page);
  await page.keyboard.press('Enter');
  await page.locator('[data-tour-popup]').click(); // → the rooms pause (#198)
  await page.keyboard.press('Enter'); // the always-lit rooms gate
  await page.locator('[data-tour-popup] [data-tour-next-roof]').click();
  await expect(page.locator('[data-tour-gable]')).toBeVisible();

  // The drafter's last tool before the finish is WALL — the classic trap.
  await h.selectTool(page, 'Wall');
  await page.locator('[data-tour-next]').click(); // PRESS ▲ BONE
  await page.keyboard.press('Enter');
  await page.locator('[data-build-house]').click();
  await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');
  await page.waitForTimeout(4300); // 1s curtain hold + the ~2.5s reveal
  await h.waitForSaved(page);

  // The reveal disarmed the tool: SELECT holds it, and clicks in the
  // elevation neither place walls nor raise the plan-view refusal.
  const before = (await h.savedDrawing(page)).walls.length;
  await h.clickWorld(page, -4, -3);
  await h.clickWorld(page, 4, 3);
  await page.waitForTimeout(300);
  const saved = await h.savedDrawing(page);
  expect(saved.walls.length).toBe(before);
  const labels = await h.activeToolLabels(page);
  expect(labels.join(' ')).toMatch(/select/i);
});
