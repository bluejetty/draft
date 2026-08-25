// The left tool rail keeps one stable set of command names on every level and
// layer set: the context decides where geometry saves, never what a command is
// called. Walls save to PLAN (or FOUNDATION when drawn there) and floor
// outlines to FLOOR, staying visible where drawn until the layer set changes.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const WALL_STROKE = [29, 31, 32]; // #1d1f20, committed wall boundary color

async function switchLayerView(page, label) {
  await page.locator('.level-row.active').getByRole('button', { name: label, exact: true }).click();
  await page.waitForTimeout(400);
}

async function switchLevel(page, name) {
  await page.locator('.level-row')
    .filter({ has: page.locator('.level-name', { hasText: name }) })
    .locator('.level-name').click();
  await page.waitForTimeout(300);
}

async function drawWall(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Wall');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function drawDimension(page, x1, z1, x2, z2) {
  await h.selectTool(page, 'Dimension');
  await h.clickWorld(page, x1, z1);
  await h.clickWorld(page, x2, z2);
  await h.waitForSaved(page);
}

async function drawTriangle(page) {
  await h.clickWorld(page, -10, -10);
  await h.clickWorld(page, 10, -10);
  await h.clickWorld(page, 10, 10);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function wallStrokeCount(page, x, z) {
  const p = await h.worldToClient(page, x, z);
  const pixels = await h.overlayPixels(page, p.x, p.y);
  return h.countColor(pixels, WALL_STROKE);
}

async function toolRailLabels(page) {
  return page.locator('[data-model-left] .tool-key .tool-key-name').allTextContents();
}

test('tool names stay the same on every layer set', async ({ page }) => {
  await h.openModel(page);
  const expected = ['SELECT', 'LINE', 'NODE / ARC', 'WALL', 'FLOOR', 'DIMENSION', 'EXTEND', 'TRIM'];
  for (const view of ['PLAN', 'FLOOR', 'ELECTRIC']) {
    await switchLayerView(page, view);
    const labels = (await toolRailLabels(page))
      .map(label => label.trim().toUpperCase());
    for (const name of expected) expect(labels).toContain(name);
    // No context-prefixed variants anywhere in the rail.
    expect(labels.some(label => /^(PLAN|FLOOR|ELECTRIC|FOUNDATION) /.test(label))).toBe(false);
  }
});

test('Cut has no button anywhere; the [C] key still activates it', async ({ page }) => {
  await h.openModel(page);
  const railCut = page.locator('[data-model-left]').getByRole('button', { name: /\bCut\b/i });
  await expect(railCut).toHaveCount(0);
  await expect(page.getByRole('button', { name: /ELEV\/SEC CUT/i })).toHaveCount(0);

  await page.keyboard.press('c');
  await expect(page.locator('[data-tool-strip]')).toContainText(/ELEV\/SEC CUT/i);
});

test('the rail groups tools under DRAW / EDIT and BUILD', async ({ page }) => {
  await h.openModel(page);
  const groups = await page.evaluate(() => {
    const rail = document.querySelector('[data-model-left]');
    const out = {}; let current = null;
    rail.querySelectorAll('div, button').forEach(el => {
      const text = (el.firstChild?.nodeValue || el.textContent || '').trim().toUpperCase();
      if (el.tagName === 'DIV' && (text === 'DRAW / EDIT' || text === 'BUILD')) { current = text; out[current] = []; }
      else if (el.tagName === 'BUTTON' && el.classList.contains('tool-key') && current) {
        out[current].push(el.querySelector('.tool-key-name').textContent.trim().toUpperCase());
      }
    });
    return out;
  });
  for (const name of ['SELECT', 'EXTEND', 'TRIM', 'NODE / ARC', 'LINE', 'OUTLINE', 'SHAPE', 'DIMENSION', 'ANNOTATION']) {
    expect(groups['DRAW / EDIT']).toContain(name);
  }
  for (const name of ['WALL', 'FENESTRATION', 'FLOOR', 'ROOF', 'COLUMN', 'BEAM', 'STAIR']) {
    expect(groups['BUILD']).toContain(name);
  }
});

test('the tool strip shows only the active tool\'s options', async ({ page }) => {
  await h.openModel(page);
  const strip = page.locator('[data-tool-strip]');

  await h.selectTool(page, 'Line');
  await expect(strip.getByRole('button', { name: 'DRAFT', exact: true })).toBeVisible();
  await expect(strip.getByRole('button', { name: /Wall Type/i })).toHaveCount(0);

  await h.selectTool(page, 'Wall');
  await expect(strip.getByText('Wall Type')).toBeVisible();
  await expect(strip.getByRole('button', { name: 'DRAFT', exact: true })).toHaveCount(0);

  await h.selectTool(page, 'Trim');
  await expect(strip).toContainText(/no tool options/i);
});

test('the DRAFT / NO-DRAFT choice lives in the Line tool menu', async ({ page }) => {
  await h.openModel(page);
  await expect(page.getByRole('button', { name: 'DRAFT', exact: true })).toHaveCount(0);

  await h.selectTool(page, 'Line');
  await expect(page.getByRole('button', { name: 'DRAFT', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'NO-DRAFT', exact: true })).toBeVisible();
});

test('the Select menu offers rectangle selection options', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Select');
  await expect(page.getByRole('button', { name: 'ITEMS' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'WINDOW' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ALL LEVELS' })).toBeVisible();
});

test('a wall drawn from FLOOR saves to PLAN and stays visible until the layer set changes', async ({ page }) => {
  await h.openModel(page);
  await switchLayerView(page, 'FLOOR');
  await drawWall(page, -10, 0, 10, 0);

  const walls = h.allWalls(await h.savedDrawing(page));
  expect(walls).toHaveLength(1);
  expect(walls[0].view).toBe('plan');

  // Full-strength in FLOOR until the layer set changes…
  expect(await wallStrokeCount(page, 5, 0)).toBeGreaterThan(0);

  // …then it becomes the usual faded PLAN reference.
  await switchLayerView(page, 'PLAN');
  await switchLayerView(page, 'FLOOR');
  expect(await wallStrokeCount(page, 5, 0)).toBe(0);
});

test('a wall drawn from ELECTRIC saves to PLAN and shows through the shared layers', async ({ page }) => {
  await h.openModel(page);
  await switchLayerView(page, 'ELECTRIC');
  await drawWall(page, -10, 0, 10, 0);

  const walls = h.allWalls(await h.savedDrawing(page));
  expect(walls).toHaveLength(1);
  expect(walls[0].view).toBe('plan');

  // ELECTRIC shares PLAN walls at full strength, so it renders right away.
  expect(await wallStrokeCount(page, 5, 0)).toBeGreaterThan(0);
});

test('a wall drawn on FOUNDATION is a foundation wall living in that layer set', async ({ page }) => {
  await h.openModel(page);
  await switchLevel(page, 'FOUNDATION');
  await switchLayerView(page, 'FOUNDATION');
  await drawWall(page, -10, 0, 10, 0);

  const walls = h.allWalls(await h.savedDrawing(page));
  expect(walls).toHaveLength(1);
  expect(walls[0].view).toBe('foundation');

  expect(await wallStrokeCount(page, 5, 0)).toBeGreaterThan(0);

  // The foundation PLAN shows the concrete walls as a shared reference, so
  // the int stud / insul walls draw against the poured structure.
  await switchLayerView(page, 'PLAN');
  expect(await wallStrokeCount(page, 5, 0)).toBeGreaterThan(0);
});

test('ROOF and SITE are whole-level contexts with every command available', async ({ page }) => {
  await h.openModel(page);
  const rail = page.locator('[data-model-left]');
  for (const level of ['ROOF', 'SITE']) {
    await switchLevel(page, level);
    for (const name of ['Line', 'Node / Arc', 'Wall', 'Floor', 'Fenestration', 'Dimension']) {
      await expect(rail.getByRole('button', { name: new RegExp(`\\b${name}\\b`, 'i') })).toBeEnabled();
    }
  }

  // Drawing works: a wall on ROOF saves, renders, and hosts an opening.
  await switchLevel(page, 'ROOF');
  await drawWall(page, -10, 0, 10, 0);
  expect(await wallStrokeCount(page, 5, 0)).toBeGreaterThan(0);
  await h.selectTool(page, 'Fenestration');
  await h.clickWorld(page, 2, 0);
  await h.waitForSaved(page);
  await drawDimension(page, -10, 5, 10, 5);

  const drawing = await h.savedDrawing(page);
  expect(h.allWalls(drawing)).toHaveLength(1);
  expect(drawing.fenestrations).toHaveLength(1);
  expect(drawing.dimensions).toHaveLength(1);
});

test('dimensions can be placed on any layer set and save with it', async ({ page }) => {
  await h.openModel(page);
  await switchLayerView(page, 'ELECTRIC');
  await drawDimension(page, -10, -5, 10, -5);

  await switchLevel(page, 'FOUNDATION');
  await switchLayerView(page, 'FOUNDATION');
  await drawDimension(page, -10, 5, 10, 5);

  const drawing = await h.savedDrawing(page);
  const views = drawing.dimensions.map(dimension => dimension.view).sort();
  expect(views).toEqual(['e-power', 'foundation']);
});

test('a floor drawn from PLAN saves to the FLOOR layer set', async ({ page }) => {
  await h.openModel(page);
  await switchLayerView(page, 'PLAN');
  await h.selectTool(page, 'Floor');
  await drawTriangle(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.floors).toHaveLength(1);
  expect(drawing.floors[0].view).toBe('floor');
  expect(drawing.floors[0].structure).toBe('floor');
});

test('the Floor tool SLAB setting saves concrete slab outlines', async ({ page }) => {
  await h.openModel(page);
  await switchLayerView(page, 'FLOOR');
  await h.selectTool(page, 'Floor');
  await page.getByRole('button', { name: 'SLAB', exact: true }).click();
  await drawTriangle(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.floors).toHaveLength(1);
  expect(drawing.floors[0].structure).toBe('slab');
  expect(drawing.floors[0].thickness * 12).toBeCloseTo(4, 5);
});
