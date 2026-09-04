// The PROJECT page's SECTION TABLE: one row per build type, one column per
// measured item. HOUSE is the drawing's live assembly, so the table and the
// wall-section detail can never disagree; the other rows carry their own
// numbers, inherit where they have none, and hatch out the items their type
// has no use for. Wall heights are entered as a stud and read back as the
// wall that stud makes.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function openProjectPage(page) {
  await page.locator('[data-project-open]').click();
  await page.waitForURL(/PROJECT\.html/);
  await expect(page.locator('#section-table')).toBeVisible();
}

const cell = (page, key) => page.locator(`[data-section-cell="${key}"]`);

test('HOUSE is the live assembly — the table and the detail move together', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  const detail = page.locator('[data-detail-input="fdnHeight"]');
  const table = cell(page, 'house.fdnWall');
  await expect(table).toHaveValue(await detail.inputValue());

  await table.fill(`6'-0"`);
  await table.dispatchEvent('change');
  await expect(page.locator('#status')).toContainText('saved');
  await expect(detail).toHaveValue(`6'-0"`);

  // The small print under the cell is the height the framer needs: the wall
  // plus the sill it bears on.
  await expect(page.locator('[data-section-note="house.fdnWall"]')).toHaveText(`6'-1 1/2" TO SILL`);
});

test('a wall is entered as a stud and reads back as the wall that stud makes', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  const stud = cell(page, 'house.mainStud');
  await stud.fill('104 5/8"');
  await stud.dispatchEvent('change');
  // 104 5/8" of stud + two top plates and a bottom plate (4 1/2").
  await expect(page.locator('[data-section-note="house.mainStud"]')).toHaveText(`9'-1 1/8"`);
  await expect(page.locator('[data-detail-input="wallHeight-3"]')).toHaveValue(`9'-1 1/8"`);
});

test('SPLIT defaults to a 5\'-0" pour and keeps its own number once typed', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  const split = cell(page, 'split.fdnWall');
  await expect(split).toHaveValue(`5'-0"`);
  await expect(split).toHaveClass(/inherited/);
  await expect(page.locator('[data-section-note="split.fdnWall"]')).toHaveText(`5'-1 1/2" TO SILL`);

  // The house's foundation is not the split's: editing one leaves the other.
  const house = cell(page, 'house.fdnWall');
  await house.fill(`7'-0"`);
  await house.dispatchEvent('change');
  await expect(split).toHaveValue(`5'-0"`);

  await split.fill(`5'-6"`);
  await split.dispatchEvent('change');
  await expect(split).not.toHaveClass(/inherited/);

  await page.reload();
  await expect(cell(page, 'split.fdnWall')).toHaveValue(`5'-6"`);
  await expect(cell(page, 'house.fdnWall')).toHaveValue(`7'-0"`);
});

test('the split fills to the ceiling with half a precut', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  // 5'-0" pour + 1 1/2" sill, then a fill wall of half a 92 5/8" precut
  // (46 1/4" once the saw takes its kerf) and its 4 1/2" of plates.
  await expect(cell(page, 'split.woodFill')).toHaveValue(`4'-2 3/4"`);
  await expect(page.locator('[data-section-note="split.woodFill"]')).toHaveText('46 1/4" STUD');
  // Standing height down there: everything framed on the pour, less the slab
  // poured against the bottom of it.
  await expect(page.locator('[data-section-cell="split.basementClg"]')).toHaveText(`9'-1 1/4"`);
});

test('a type only shows the items it uses', async ({ page }) => {
  await h.openModel(page);
  await openProjectPage(page);

  // A bilevel has no second floor. It DOES have a wood fill wall, and this
  // test used to say otherwise -- Movie, 4 Sep: "both SPLIT have default 5ft
  // con foundation with 4ft infill wall default". A SPLIT is not a third
  // build type, it is the family name for the two, and both pour the same
  // 5'-0" wall and make the rest of the basement height up in wood above it.
  // What a MOD BILEVEL adds to a BILEVEL is the storey over the garage, not
  // the fill wall.
  //
  // The hatched cell was the defect: not blank, not an error, a plausible
  // "this type has no use for it" that nobody squints at.
  await expect(page.locator('[data-section-blank="bilevel.upperStud"]')).toHaveCount(1);
  await expect(cell(page, 'bilevel.woodFill')).toHaveCount(1);
  await expect(cell(page, 'modifiedBilevel.upperStud')).toHaveCount(1);
  await expect(cell(page, 'modifiedBilevel.woodFill')).toHaveCount(1);
  await expect(cell(page, 'split.woodFill')).toHaveCount(1);

  // A garage has no floor framing over a basement and no second storey.
  await expect(page.locator('[data-section-blank="detachedGarage.mainJoists"]')).toHaveCount(1);
  await expect(page.locator('[data-section-blank="attachedGarage.upperStud"]')).toHaveCount(1);
});
