// The view galleries (boards #265 / #291): a two-column wall of little
// TV screens down the right canvas edge. Fixed seating — E1|E3, E2|E4,
// ROOF PLAN|SITE PLAN, each floor's PLAN (walls) beside its LAYOUT
// (floor), the concrete FOUNDATION plan beside BASEMENT (walls), then
// sections filling left-then-right — E1-E4 and two section seats hold
// empty screens until their views exist — plus the finale's curtain
// moment. The open LEVELS panel covers only the outer column; the 3D
// screen stands top-left where the open toolbox covers it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(300);
}

// Cuts name themselves S1, S2, ... — no naming prompt.
async function placeCut(page, z) {
  await page.keyboard.press('c');
  await h.clickWorld(page, -12, z);
  await h.clickWorld(page, 12, z);
  await h.clickWorld(page, 0, z - 6);
  await page.waitForTimeout(400);
}

function innerLabels(page) {
  return page.locator('[data-view-rail-inner] .view-thumb-label').allTextContents();
}

function outerLabels(page) {
  return page.locator('[data-view-rail-outer-cards] .view-thumb-label').allTextContents();
}

// Hand-cut sections key by numeric id; find their screens by label instead.
function thumbByLabel(page, column, label) {
  return page.locator(`${column} .view-thumb`)
    .filter({ has: page.locator('.view-thumb-label', { hasText: label }) });
}

test.describe('Stretched level cards', () => {
  test('cards reach the rail edge and layer labels sit on one line', async ({ page }) => {
    await h.openModel(page, { webgl: false });

    // Every level card spans the rail — no unused strip on the right.
    const rail = await page.locator('[data-model-right]').boundingBox();
    const rows = page.locator('.level-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(2);
    for (let i = 0; i < count; i++) {
      const row = await rows.nth(i).boundingBox();
      // The rail pads 12px and may wear a scrollbar; the old gap was ~57px.
      expect(rail.x + rail.width - (row.x + row.width)).toBeLessThan(32);
    }

    for (const name of ['FLOOR PLAN (WALLS)', 'FLOOR LAYOUT (FLOOR)']) {
      const label = page.locator('.level-layer', { hasText: name }).first();
      const box = await label.boundingBox();
      expect(box.height).toBeLessThan(20); // a wrap would double it
    }
  });
});

test.describe('View galleries', () => {
  test('the fixed seating chart fills both columns; E1-E4 arrive with the build', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false });

    // Nothing built — every seat is taken: empty E and S screens hold
    // their chairs, and the plans keep theirs.
    expect(await innerLabels(page)).toEqual([
      'E1 · FRONT', 'E2 · LEFT', 'ROOF PLAN',
      '2ND FL PLAN (WALLS)', 'MAIN FL PLAN (WALLS)', 'FOUNDATION', 'S1',
    ]);
    expect(await outerLabels(page)).toEqual([
      'E3 · BACK', 'E4 · RIGHT', 'SITE PLAN',
      '2ND FL LAYOUT (FLOOR)', 'MAIN FL LAYOUT (FLOOR)', 'BASEMENT (WALLS)', 'S2',
    ]);
    // The empty elevation seats are placeholders — E1-E4 cut themselves
    // with the build, so tapping one would draw a second front. The section
    // seats are the offer: nothing cuts an S1 but a hand.
    await expect(page.locator('[data-rail-key="empty:E1"]')).toHaveClass(/empty/);
    await expect(page.locator('[data-rail-key="empty:E1"]')).not.toHaveClass(/offer/);
    await expect(page.locator('[data-rail-key="empty:S1"]')).toHaveClass(/empty/);
    await expect(page.locator('[data-rail-key="empty:S1"]')).toHaveClass(/offer/);
    await expect(page.locator('[data-view-rail-3d]')).toBeVisible();

    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);
    await page.waitForTimeout(400);

    // E1|E3 and E2|E4 take the top rows for real — live screens now, not
    // placeholders — and the plans keep their seats below.
    await expect(page.locator('[data-rail-key="cut:E1"]')).toBeVisible();
    await expect(page.locator('[data-rail-key="empty:E1"]')).toHaveCount(0);
    const inner = await innerLabels(page);
    const outer = await outerLabels(page);
    expect(inner[0]).toContain('E1');
    expect(inner[1]).toContain('E2');
    expect(inner[2]).toBe('ROOF PLAN');
    expect(outer[0]).toContain('E3');
    expect(outer[1]).toContain('E4');
    expect(outer[2]).toBe('SITE PLAN');

    // Each little screen carries real ink — a true miniature, not a blank.
    const ink = await page.evaluate(() => {
      const canvas = document.querySelector('[data-rail-key="cut:E1"] canvas');
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) count += 1;
      }
      return count;
    });
    expect(ink).toBeGreaterThan(200);

    // Tapping a thumb brings that view center.
    await page.locator('[data-rail-key="cut:E2"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E2');
    await expect(page.locator('[data-rail-key="cut:E2"]')).toHaveClass(/active/);
  });

  test('a hand-cut section starts the next row, left cell first', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);

    await placeCut(page, 0);
    await page.waitForTimeout(400);

    // Both columns seat 6 fixed cards; S1 lands as the inner column's 7th,
    // a live screen where the placeholder held its chair.
    const thumb = thumbByLabel(page, '[data-view-rail-inner]', 'S1');
    await expect(thumb).toBeVisible();
    await expect(thumb).not.toHaveClass(/empty/);
    const inner = await innerLabels(page);
    expect(inner[inner.length - 1]).toBe('S1');

    // A second cut fills the right cell of the same row.
    await placeCut(page, 2);
    await page.waitForTimeout(400);
    const s2Thumb = thumbByLabel(page, '[data-view-rail-outer-cards]', 'S2');
    await expect(s2Thumb).toBeVisible();
    await expect(s2Thumb).not.toHaveClass(/empty/);

    // Tapping S1 brings the section center.
    await thumb.click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('S1');

    // Deleting the cuts clears their screens from the rail. The delete rows
    // live on the LEVELS panel, so pull the rails out for them.
    await h.openRails(page);
    await page.waitForTimeout(300);
    for (const name of ['S2', 'S1']) {
      page.once('dialog', dialog => dialog.accept());
      await page.locator('.cut-row', { hasText: name }).locator('.cut-del').click();
      await page.waitForTimeout(400);
    }
    // The placeholders take the chairs back — empty screens, not live cuts.
    // S2's seat sits in the outer column, behind the open LEVELS panel.
    await expect(page.locator('[data-rail-key="empty:S1"]')).toBeVisible();
    await expect(page.locator('[data-rail-key="empty:S2"]')).toHaveCount(1);
    await expect(thumbByLabel(page, '.view-rail-right', 'S1')).toHaveClass(/empty/);
    await expect(thumbByLabel(page, '.view-rail-right', 'S2')).toHaveClass(/empty/);
  });

  test('tapping the empty S1 seat starts the cut, the same as pressing C', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);
    await page.waitForTimeout(400);

    // The build leaves an elevation center stage; the seat has to bring the
    // plan back, because a section line is drawn in plan.
    await expect(page.locator('[data-model-title-detail]').last()).not.toHaveText('E1');
    await page.locator('[data-rail-key="cut:E1"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');

    await page.locator('[data-rail-key="empty:S1"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).not.toHaveText('E1');
    // It says what to do next and names the seat it will fill.
    await expect(page.locator('[data-model-drawing-message]'))
      .toHaveText(/^S1: click where the section line starts/);

    // The three clicks a C-key cut takes, with no key pressed.
    await h.clickWorld(page, -12, 0);
    await h.clickWorld(page, 12, 0);
    await h.clickWorld(page, 0, -6);
    await page.waitForTimeout(400);

    const thumb = thumbByLabel(page, '.view-rail-right', 'S1');
    await expect(thumb).toBeVisible();
    await expect(thumb).not.toHaveClass(/empty/);
  });

  test('the BASEMENT and FOUNDATION seats show different layer views', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);
    await page.waitForTimeout(400);

    // Built plans carry real ink in their miniatures.
    const ink = await page.evaluate(() => {
      const canvas = document.querySelector('[data-rail-key="plan:3:plan"] canvas');
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) count += 1;
      }
      return count;
    });
    expect(ink).toBeGreaterThan(100);

    // From an elevation, tapping a plan thumb brings that plan back center.
    await page.locator('[data-rail-key="cut:E1"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');
    await page.locator('[data-rail-key="plan:3:plan"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-model-title-detail]').last()).not.toHaveText('E1');
    await expect(page.locator('[data-rail-key="plan:3:plan"]')).toHaveClass(/active/);

    // The FOUNDATION seat opens the concrete foundation view; the BASEMENT
    // seat opens the same level's wall plan.
    await page.locator('[data-rail-key="plan:1:foundation"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-rail-key="plan:1:foundation"]')).toHaveClass(/active/);
    await expect(page.locator('[data-rail-key="plan:1:plan"]')).not.toHaveClass(/active/);
    await page.locator('[data-rail-key="plan:1:plan"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[data-rail-key="plan:1:plan"]')).toHaveClass(/active/);
    await expect(page.locator('[data-rail-key="plan:1:foundation"]')).not.toHaveClass(/active/);
  });

  test('the FOUNDATION level lands on the concrete plan by default', async ({ page }) => {
    await h.openModel(page, { webgl: false });

    await page.locator('.level-row')
      .filter({ has: page.locator('.level-name', { hasText: 'FOUNDATION' }) })
      .locator('.level-name').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.level-row.active .level-layer.active')).toHaveText('FOUNDATION');
  });

  test('the 3D screen stands top-left; the open toolbox covers it', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false });

    // Rails tucked: the 3D screen sits in the canvas's top-left corner.
    const threeD = page.locator('[data-view-rail-3d]');
    await expect(threeD).toBeVisible();
    const canvasBox = await page.locator('[data-model-container]').boundingBox();
    const box = await threeD.boundingBox();
    expect(box.x - canvasBox.x).toBeLessThan(60);
    expect(box.y - canvasBox.y).toBeLessThan(30);

    // The toolbox pull-out covers the 3D screen; tucking it brings it back.
    await page.locator('[data-left-rail-tab]').click();
    await expect(page.locator('[data-model-left]')).toBeVisible();
    await expect(threeD).toBeHidden();
    await page.locator('[data-left-rail-tab]').click();
    await expect(threeD).toBeVisible();
  });

  test('the open LEVELS panel covers only the outer column; the inner keeps its seat', async ({ page }) => {
    await h.openModel(page, { webgl: false, rails: false });
    await drawOutlineRect(page);
    await buildHouse(page);
    await h.waitForSaved(page);
    await page.waitForTimeout(400);

    // Rails tucked: the full TV wall stands.
    await expect(page.locator('[data-rail-key="cut:E1"]')).toBeVisible();
    await expect(page.locator('[data-rail-key="cut:E3"]')).toBeVisible();
    await expect(page.locator('[data-view-rail-3d]')).toBeVisible();

    // Panels out: the outer column steps aside; the inner column stays.
    await h.openRails(page);
    await page.waitForTimeout(300);
    await expect(page.locator('[data-view-rail-outer]')).toBeHidden();
    await expect(page.locator('[data-view-rail-3d]')).toBeHidden();
    await expect(page.locator('[data-rail-key="cut:E1"]')).toBeVisible();
    await expect(page.locator('[data-rail-key="plan:3:plan"]')).toBeVisible();

    // Tuck them again — every screen returns.
    await page.locator('[data-left-rail-tab]').click();
    await page.locator('[data-right-rail-tab]').click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-rail-key="cut:E3"]')).toBeVisible();
    await expect(page.locator('[data-view-rail-3d]')).toBeVisible();
  });
});

test.describe('The curtain moment', () => {
  test('the finale bone opens both rails and holds a beat before the house grows', async ({ page }) => {
    await h.openModel(page, { boneReveal: true });

    // The guided tour up to the finale: trace, stairs, rooms, roof, bone.
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
    await page.locator('[data-tour-next]').click(); // PRESS ▲ BONE
    await page.keyboard.press('Enter');

    // Tuck both rails away — the reveal must open them itself.
    await page.locator('[data-left-rail-tab]').click();
    await expect(page.locator('[data-model-left]')).toBeHidden();
    await page.locator('[data-right-rail-tab]').click();
    await expect(page.locator('[data-model-right]')).toBeHidden();

    await page.locator('[data-build-house]').click();

    // The rails slide open around the stage and E1 takes the center seat.
    await expect(page.locator('[data-model-left]')).toBeVisible();
    await expect(page.locator('[data-model-right]')).toBeVisible();
    await expect(page.locator('[data-model-title-detail]').last()).toHaveText('E1');

    // The held beat: half a second in, the mask still covers the sheet —
    // no dark elevation ink has appeared yet.
    await page.waitForTimeout(500);
    const early = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) ink += 1;
      }
      return ink;
    });
    expect(early).toBeLessThan(200); // header text at most

    // After the hold and the climb, the house stands in full ink.
    await page.waitForTimeout(3800);
    const after = await page.evaluate(() => {
      const canvas = document.querySelector('[data-model-overlay]');
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) ink += 1;
      }
      return ink;
    });
    expect(after).toBeGreaterThan(1200);
    await h.waitForSaved(page);
  });
});
