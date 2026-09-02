// The SPECS page: the written half of the set.
//
// What these pin, in order of how much they'd hurt to get wrong:
//   - only the DIFFERENCES from the office master save with the drawing. A
//     project that agrees with the master stores nothing, so a master fixed
//     next year fixes every job that never touched that section. Storing the
//     whole master per drawing would freeze each job at the master it started
//     from, and that failure is silent — the file still opens, it just never
//     improves again.
//   - the columns FILL before they break. Breaking at a section start is what
//     leaves a quarter-empty page and a spec twice as long as it needs to be.
//   - a section heading never sits alone at the foot of a column.
//   - the page writes `specs` and nothing else: geometry drawn in another tab
//     while this one sits open survives a save here.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const openSpecs = async page => {
  await page.goto('/SPECS.html');
  await expect(page.locator('body')).toHaveAttribute('data-specs-ready', '1');
};

const editSection = async (page, id, text) => {
  await page.locator(`[data-toc-row="${id}"]`).click();
  await page.locator('[data-section-body]').fill(text);
  await page.locator('[data-save-body]').click();
  await expect(page.locator('#status')).toContainText('saved with the drawing');
};

test.describe('SPECS page', () => {
  test('the office master prints as flowed pages of numbered sections', async ({ page }) => {
    await openSpecs(page);

    // Every division that has sections gets its rule, and the sections read
    // by the numbers the trades use.
    await expect(page.locator('.spec-div').first()).toContainText('1. GENERAL NOTES');
    await expect(page.locator('.sheet')).not.toHaveCount(0);
    await expect(page.locator('.spec-head', { hasText: '8-B  WINDOWS' })).toHaveCount(1);

    // Three columns to a sheet, every sheet.
    const columns = await page.locator('.sheet').first().locator('.sheet-col').count();
    expect(columns).toBe(3);
  });

  test('the columns fill before they break, and no heading sits alone', async ({ page }) => {
    await openSpecs(page);

    const sheets = page.locator('.sheet');
    const sheetCount = await sheets.count();
    // The column the document ENDS in is exempt from the fill rule: nothing
    // follows it, so there is nothing it failed to pull up. That column is
    // NOT always the third of the last sheet. The spec runs out where it runs
    // out, and a last sheet holding one part-filled column and two empty ones
    // is a correct set, not an under-packed one. Asserting otherwise held the
    // tail column to a rule that only means something when text follows it.
    const lastFilled = await page.evaluate(() => {
      const columns = Array.from(document.querySelectorAll('.sheet-col'));
      for (let i = columns.length - 1; i >= 0; i -= 1) {
        if (columns[i].querySelector('.spec-item')) return i;
      }
      return -1;
    });
    for (let s = 0; s < sheetCount; s += 1) {
      const columns = sheets.nth(s).locator('.sheet-col');
      // Three to a sheet on every sheet, which is what makes the flat index
      // below line up with the one `lastFilled` counted.
      expect(await columns.count()).toBe(3);
      for (let c = 0; c < 3; c += 1) {
        const column = columns.nth(c);
        const items = column.locator('.spec-item');
        const count = await items.count();
        if (count === 0) continue;

        // A heading is never the last thing in a column.
        const last = items.nth(count - 1);
        const lastIsHeading = await last.evaluate(node =>
          node.classList.contains('spec-head') || node.classList.contains('spec-div'));
        expect(lastIsHeading).toBe(false);

        // The column is filled: what follows it could not have fitted here.
        // Only checked where there IS something following.
        if (s * 3 + c === lastFilled) continue;
        const used = await column.evaluate(node =>
          Array.from(node.children).reduce((sum, child) => sum + child.getBoundingClientRect().height, 0));
        const columnHeight = await column.evaluate(node => node.getBoundingClientRect().height);
        // Slack is measured in whole items rather than pixels: a column that
        // stops early because the next block would not fit is correct, one
        // that stops early for any other reason is the bug.
        expect(used).toBeGreaterThan(columnHeight * 0.55);
      }
    }
  });

  test('only the differences from the master save with the drawing', async ({ page }) => {
    await openSpecs(page);

    // Untouched: the drawing carries no spec sections at all.
    await page.locator('[data-toc-row="3-A"]').click();
    let saved = await h.savedDrawing(page);
    expect(saved?.specs?.sections ?? []).toEqual([]);

    await editSection(page, '9-A', 'INTERIOR WALLS TO BE 1/2" GYPSUM BOARD, TAPED AND SANDED.');
    saved = await h.savedDrawing(page);
    expect(saved.specs.sections).toHaveLength(1);
    expect(saved.specs.sections[0]).toMatchObject({
      id: '9-A',
      body: 'INTERIOR WALLS TO BE 1/2" GYPSUM BOARD, TAPED AND SANDED.',
    });
    // The master's own words are not copied into the file.
    expect(JSON.stringify(saved.specs)).not.toContain('DAMP PROOFING');

    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-specs-ready', '1');
    await page.locator('[data-toc-row="9-A"]').click();
    await expect(page.locator('[data-section-body]'))
      .toHaveValue('INTERIOR WALLS TO BE 1/2" GYPSUM BOARD, TAPED AND SANDED.');
  });

  test('a section switched off leaves the pages and comes back', async ({ page }) => {
    await openSpecs(page);

    await expect(page.locator('.spec-head', { hasText: '10-A  FIREPLACE' })).toHaveCount(1);
    await page.locator('[data-toc-row="10-A"]').click();
    await page.locator('[data-toggle-off]').click();
    await expect(page.locator('#status')).toContainText('left off this set');

    await expect(page.locator('.spec-head', { hasText: '10-A  FIREPLACE' })).toHaveCount(0);
    const saved = await h.savedDrawing(page);
    expect(saved.specs.sections).toEqual([{ id: '10-A', off: true }]);

    await page.locator('[data-toggle-off]').click();
    await expect(page.locator('.spec-head', { hasText: '10-A  FIREPLACE' })).toHaveCount(1);
    expect((await h.savedDrawing(page)).specs.sections).toEqual([]);
  });

  test('BACK TO MASTER drops the job wording rather than re-typing it', async ({ page }) => {
    await openSpecs(page);

    await editSection(page, '14-A', 'PLUMBER TO CONFIRM FIXTURE LIST WITH THE OWNER.');
    await page.locator('[data-reset-section]').click();
    await expect(page.locator('#status')).toContainText('back to the office master');
    await expect(page.locator('[data-toc-row="14-A"] .dot.edited')).toHaveCount(0);
    expect((await h.savedDrawing(page)).specs.sections).toEqual([]);
    // And the master's words are back on the page.
    await page.locator('[data-toc-row="14-A"]').click();
    await expect(page.locator('[data-section-body]'))
      .not.toHaveValue('PLUMBER TO CONFIRM FIXTURE LIST WITH THE OWNER.');
  });

  test('a job may add a section the office master does not have', async ({ page }) => {
    await openSpecs(page);

    await page.locator('[data-add-section]').click();
    await page.locator('[data-section-title]').fill('SOLAR ROUGH-IN');
    await page.locator('[data-section-body]').fill('CONDUIT FROM ROOF TO ELECTRICAL PANEL.');
    await page.locator('[data-save-body]').click();

    await expect(page.locator('.spec-head', { hasText: 'J1  SOLAR ROUGH-IN' })).toHaveCount(1);
    const saved = await h.savedDrawing(page);
    expect(saved.specs.sections[0]).toMatchObject({
      id: 'J1', added: true, title: 'SOLAR ROUGH-IN', body: 'CONDUIT FROM ROOF TO ELECTRICAL PANEL.',
    });

    await page.locator('[data-delete-section]').click();
    await expect(page.locator('.spec-head', { hasText: 'J1  SOLAR ROUGH-IN' })).toHaveCount(0);
  });

  test('saving here leaves the rest of the drawing alone', async ({ page }) => {
    // The defect this closes: a page that writes the whole file as it read it
    // erases whatever another tab drew in the meantime.
    await openSpecs(page);
    await page.evaluate(async () => {
      const store = window.SharedFileStore;
      const at = await store.loadSharedFileAt('model-drawing');
      const base = at.file ? JSON.parse(await at.file.text()) : { version: 1 };
      base.walls = [{ id: 77, x1: 0, z1: 0, x2: 20, z2: 0 }];
      const file = new File([JSON.stringify(base)], 'model-drawing.json', { type: 'application/json' });
      await store.saveSharedFile(file, 'model-drawing', { ifRev: at.rev });
    });

    await editSection(page, '2-A', 'STRIP TOPSOIL AND STOCKPILE ON SITE.');
    const saved = await h.savedDrawing(page);
    expect(saved.walls).toHaveLength(1);
    expect(saved.specs.sections[0].id).toBe('2-A');
  });

  test('the nav cluster reaches SPECS from MODEL', async ({ page }) => {
    await h.openModel(page);
    await page.click('[data-nav-specs]');
    await expect(page).toHaveURL(/SPECS\.html/);
    await expect(page.locator('body')).toHaveAttribute('data-specs-ready', '1');
  });
});
