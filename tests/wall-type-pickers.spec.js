// Wall type configuration (16 Sep ruling): the FOUNDATION WALL TYPE is a
// PROJECT-page choice — 8" concrete, ICF, or 2×8 PT wood — and each floor's
// exterior wall defaults to the house's shared type with a rare per-floor
// override, because the main and second floors "are usually the same but the
// odd time they might be different 1% of the time". The choices live on
// levelAssemblies so they ride the key both pages already share, and the
// bone frames its generated shell from them.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function openProjectPage(page) {
  await page.locator('[data-project-open]').click();
  await page.waitForURL(/PROJECT\.html/);
  await expect(page.locator('[data-detail-input="pitch"]')).toBeVisible();
}

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

test('the FOUNDATION WALL TYPE picker offers the ruled set and its choice persists', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  // The ruled set, in the registry's ids: 8" conc, the two ICFs, PT wood.
  // The insul wall LINES a foundation wall rather than being one, so it is
  // not offered.
  const picker = page.locator('[data-detail-input="fdnWallType"]');
  await expect(picker).toBeVisible();
  const ids = await picker.locator('option').evaluateAll(
    options => options.map(option => option.value));
  expect(ids).toEqual(['concrete_8', 'icf', 'icf_13', 'pt_wood_fdn']);

  // A drawing that never chose reads the old default.
  await expect(picker).toHaveValue('concrete_8');
  const thickness = page.locator('[data-detail-chip="fdnThickness"]');
  await expect(thickness).toHaveText('8"');

  // The choice leads the derived thickness the moment it lands...
  await picker.selectOption('icf');
  await expect(page.locator('#status')).toContainText('saved');
  await expect(thickness).toHaveText('11 1/4"');

  // ...and it is stored on the FOUNDATION level's assembly, so it survives
  // a reload.
  await page.reload();
  await expect(page.locator('[data-detail-input="fdnWallType"]')).toHaveValue('icf');
  const saved = await h.savedDrawing(page);
  expect(saved.levelAssemblies['1'].wallType).toBe('icf');
});

test('a floor defaults to SAME AS HOUSE and only a deliberate pick stores its own', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  // Both floors inherit the shared type: no stored override, blank pick.
  const main = page.locator('[data-detail-input="wallType-3"]');
  const second = page.locator('[data-detail-input="wallType-5"]');
  await expect(main).toHaveValue('');
  await expect(second).toHaveValue('');

  // The 1% case: the second floor splits off to 2×4 while MAIN FL keeps
  // riding the house's shared answer.
  await second.selectOption('stud_2x4');
  await expect(page.locator('#status')).toContainText('saved');
  await page.reload();
  await expect(page.locator('[data-detail-input="wallType-3"]')).toHaveValue('');
  await expect(page.locator('[data-detail-input="wallType-5"]')).toHaveValue('stud_2x4');

  const saved = await h.savedDrawing(page);
  expect(saved.levelAssemblies['5'].wallType).toBe('stud_2x4');
  expect(saved.levelAssemblies['3']?.wallType ?? null).toBe(null);
});

test('BUILD HOUSE frames each level from the chosen wall types', async ({ page }) => {
  await h.openModel(page);
  await drawOutlineRect(page);

  // The PROJECT page's choices, written the way that page stores them: the
  // foundation type and the second floor's rare split on levelAssemblies,
  // the shared exterior type on activeWallType.
  await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    const drawing = JSON.parse(await file.text());
    drawing.activeWallType = 'stud_2x6';
    drawing.levelAssemblies = {
      ...(drawing.levelAssemblies || {}),
      1: { ...(drawing.levelAssemblies?.[1] || {}), wallType: 'pt_wood_fdn' },
      5: { ...(drawing.levelAssemblies?.[5] || {}), wallType: 'stud_2x4' },
    };
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(drawing)], file.name, { type: 'application/json' }),
      bucket);
  }, h.STORAGE_BUCKET);
  await page.reload();
  await h.waitForModelReady(page);

  await buildHouse(page);
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  // FOUNDATION pours the chosen PT wood wall, not the concrete fallback.
  const fdnWalls = saved.walls.filter(wall => wall.levelId === 1);
  expect(fdnWalls).toHaveLength(4);
  fdnWalls.forEach(wall => expect(wall.wallType).toBe('pt_wood_fdn'));

  // MAIN FL frames the shared 2×6; 2ND FL frames its own split.
  const shell = levelId => saved.walls.filter(wall =>
    wall.levelId === levelId && (wall.view || 'plan') === 'plan'
    && wall.refLine === 'left');
  const mainWalls = shell(3);
  expect(mainWalls).toHaveLength(4);
  mainWalls.forEach(wall => expect(wall.wallType).toBe('stud_2x6'));
  const secondWalls = shell(5);
  expect(secondWalls).toHaveLength(4);
  secondWalls.forEach(wall => expect(wall.wallType).toBe('stud_2x4'));
});
