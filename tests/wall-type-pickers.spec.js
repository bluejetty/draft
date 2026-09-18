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
  //
  // AND GRADE BEAM, LAST. Movie, 17 Sep: "it will be part of the foundation
  // dropdown because the grade beam will replace the foundation wall". It is
  // not a wall type and is not in wall-types.js -- it is the answer that says
  // none of these -- so it sits after the walls it replaces.
  const picker = page.locator('[data-detail-input="fdnWallType"]');
  await expect(picker).toBeVisible();
  const ids = await picker.locator('option').evaluateAll(
    options => options.map(option => option.value));
  expect(ids).toEqual(['concrete_8', 'icf', 'icf_13', 'pt_wood_fdn', 'gradebeam']);

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

test('GRADE BEAM replaces the foundation wall: 8" thick, 32" floor, no footing', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  const picker = page.locator('[data-detail-input="fdnWallType"]');
  const thickness = page.locator('[data-detail-chip="fdnThickness"]');
  const height = page.locator('[data-detail-input="fdnHeight"]');

  // A GRADE BEAM IS 8", whatever wall type the drafter had picked. Choosing a
  // 13 1/4" ICF first is what makes this a real test: if the thickness still
  // came off wallType the beam would draw 13 1/4" wide.
  await picker.selectOption('icf_13');
  await expect(thickness).toHaveText('13 1/4"');
  await picker.selectOption('gradebeam');
  await expect(thickness).toHaveText('8"');

  // An 8 ft basement wall switched to a beam is not an 8 ft grade beam:
  // Movie, "make min. 32"", so the pour comes down on the way in.
  await expect(height).toHaveValue('2\'-8"');

  // No footing under it -- it hangs off piles -- so the two footing rows go
  // with the part, the same rule that hides any row the drawing has nothing
  // to point at.
  await expect(page.locator('[data-sched-row="footingWidth"]')).toBeHidden();
  await expect(page.locator('[data-sched-row="footingDepth"]')).toBeHidden();

  // And the space under the house is a crawl space now, not a basement.
  await expect(page.locator('th[data-section-col="basementClg"]'))
    .toHaveText('CRAWL CLG HT');

  // The floor is a refusal, not a clamp: a typed 2'-0" leaves the cell where
  // it was and says why.
  await height.fill('2\'-0"');
  await height.blur();
  await expect(page.locator('#status')).toContainText('at least 32"');
  await expect(height).toHaveValue('2\'-8"');

  // Stored on the FOUNDATION level beside wallType -- two keys, because a
  // beam is a kind of foundation and not a material -- so the wall type the
  // drafter had is still there to come back to.
  await page.reload();
  await expect(page.locator('[data-detail-input="fdnWallType"]')).toHaveValue('gradebeam');
  const saved = await h.savedDrawing(page);
  expect(saved.levelAssemblies['1'].foundationKind).toBe('gradebeam');
  expect(saved.levelAssemblies['1'].wallType).toBe('icf_13');
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
