// TITLEBLOCK picker (boards #285/#286): the 11×17 sheet carries a real
// company strip — BLUEJETTY or ROUGH DRAFTER, one block per company — with
// the project's words from the drawing and the drafter's identity from the
// personal settings package. The primary composition runs down the RIGHT
// edge (the CLAY sheet positions) — BLUEJETTY inside a rounded-corner
// border, ROUGH DRAFTER inside a sharp one; each company's BAND alternate
// keeps the original bottom strip. The pick persists on the drawing's
// layout and rides the settings package for the next drawing; the letter
// sheet keeps the plain placeholder strip and no picker. The north arrow
// answers the sidebar toggle: off by default, any sheet may fly it.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';

// Landscape 11x17 sheet in paper inches and the fit margin — the specs
// recompute the sheet transform from these, same as layout-viewports.spec.
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

// The vertical strip: 1.15" wide against the right 0.5" margin, sections
// laid down the 10" inner height (mirrors titleblock.js drawRight).
const STRIP_X = PW - 0.5 - 1.15 / 2; // strip centreline
const INNER_H = PH - 1;
const ARROW_MID_Y = 0.5 + INNER_H * 0.05; // inside the north-arrow cell
const WORDS_MID_Y = 0.5 + INNER_H * ((0.44 + 0.62) / 2);
const SHEET_MID_Y = 0.5 + INNER_H * ((0.92 + 1) / 2);

// The BAND alternate: bottom 1.5" inside the 0.5" margin.
const STRIP_TOP = PH - 0.5 - 1.5;
const STRIP_MID_Y = STRIP_TOP + 0.75;

const point = (x, z) => ({ x, y: 0, z });

function houseDrawing() {
  const wall = (id, sx, sz, ex, ez) => ({
    id,
    start: point(sx, sz),
    end: point(ex, ez),
    levelId: 1,
    view: 'plan',
    wallType: 'stud_2x6',
    baseHeight: 0,
    topHeight: 8,
    refLine: 'left',
  });
  return {
    version: 1,
    levels: [
      { id: 0, name: 'FOUNDATION', elev: -8 },
      { id: 1, name: 'MAIN FL', elev: 0 },
    ],
    walls: [
      wall(1, 0, 0, 24, 0),
      wall(2, 24, 0, 24, 16),
      wall(3, 24, 16, 0, 16),
      wall(4, 0, 16, 0, 0),
    ],
    fenestrations: [],
  };
}

async function openLayout(page, drawing = null) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  if (drawing) {
    await page.evaluate(async ({ bucket, saved }) => {
      const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
      await window.SharedFileStore.saveSharedFile(file, bucket);
    }, { bucket: BUCKET, saved: drawing });
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  }
}

async function savedDrawing(page) {
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return file ? JSON.parse(await file.text()) : null;
  }, BUCKET);
}

async function withLayoutSave(page, action) {
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await action();
  await page.waitForFunction(
    prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev,
    seq,
  );
}

async function sheetMetrics(page) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return {
    box,
    zoom,
    panX: (box.width - PW * zoom) / 2,
    panY: (box.height - PH * zoom) / 2,
  };
}

// Non-white pixels in a square around a sheet point — enough to tell a drawn
// titleblock cell from bare paper.
async function inkAround(page, xIn, yIn, radiusIn = 0.5) {
  const m = await sheetMetrics(page);
  return page.evaluate(({ cx, cy, r }) => {
    const canvas = document.querySelector('[data-layout-canvas]');
    const data = canvas.getContext('2d').getImageData(
      Math.round(cx - r), Math.round(cy - r), Math.round(r * 2), Math.round(r * 2),
    ).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) ink += 1;
    }
    return ink;
  }, { cx: m.panX + xIn * m.zoom, cy: m.panY + yIn * m.zoom, r: radiusIn * m.zoom });
}

// ── ONE LIST BECAME TWO MENUS, 14 OCT ──────────────────────────────────
// Movie: "put a button up beside TITLEBLOCK title ... and then that TB will
// accept the LOGO which will be a new area below TITLBLOCK". The four styles
// answered both questions at once -- a rounded frame came with BLUEJETTY's
// logo welded in -- so every check below that used to press one button now
// sets one of the two menus.
const frameMenu = page => page.locator('[data-layout-frame]');
const markMenu = page => page.locator('[data-layout-mark]');

test('the sheet offers the three frames that fit it, and ROUGH DRAFTER is the default mark', async ({ page }) => {
  await openLayout(page, houseDrawing());
  // HIS OWN NAMES (14 Oct): "TBs so far : LSQUARE01 , LBAND01 , LROUND01".
  // Twelve frames exist; a drafter is offered the three for the sheet he is
  // standing on, which is what keeps this list the exact three he wrote down.
  await expect(frameMenu(page).locator('option')).toHaveText(['LSQUARE01', 'LBAND01', 'LROUND01']);
  await expect(frameMenu(page)).toHaveValue('LSQUARE01');
  await expect(markMenu(page)).toHaveValue('roughdrafter');
  // The default strip runs down the right edge: the sheet-number cell inks
  // its big numeral at the bottom of the strip.
  expect(await inkAround(page, STRIP_X, SHEET_MID_Y, 0.3)).toBeGreaterThan(30);
  // The default pick lands on the drawing with the first persisted write.
  await withLayoutSave(page, () => frameMenu(page).selectOption('LSQUARE01'));
  expect((await savedDrawing(page)).layout.titleblock).toBe('LSQUARE01');
  expect((await savedDrawing(page)).layout.titleblockMark).toBe('roughdrafter');
});

test('the frame and the mark are two choices now, and neither drags the other', async ({ page }) => {
  // THE WHOLE POINT OF THE SPLIT, and the thing that could not be done before
  // it: his rounded frame, with his own company's logo in it rather than
  // BLUEJETTY's.
  await openLayout(page, houseDrawing());
  await withLayoutSave(page, () => frameMenu(page).selectOption('LROUND01'));
  await expect(markMenu(page), 'changing the frame moved the logo').toHaveValue('roughdrafter');
  await withLayoutSave(page, () => markMenu(page).selectOption('bluejetty'));
  await expect(frameMenu(page), 'changing the logo moved the frame').toHaveValue('LROUND01');
  const saved = (await savedDrawing(page)).layout;
  expect(saved.titleblock).toBe('LROUND01');
  expect(saved.titleblockMark).toBe('bluejetty');
});

test('LSQUARE01 wears sharp corners, LROUND01 the rounded ones; the arrow cell starts bare', async ({ page }) => {
  await openLayout(page, houseDrawing());
  // The default ROUGH DRAFTER border turns a square 90° corner: ink sits
  // right at the margin corner point.
  expect(await inkAround(page, 0.5 + 0.02, 0.5 + 0.02, 0.06)).toBeGreaterThan(0);
  // BLUEJETTY's quite-rounded corners leave the sharp corner point bare
  // while the arc's midpoint carries ink.
  await withLayoutSave(page, () => frameMenu(page).selectOption('LROUND01'));
  const r = 0.35;
  const arcMid = r - r / Math.SQRT2 + 0.02;
  expect(await inkAround(page, 0.5 + 0.02, 0.5 + 0.02, 0.06)).toBe(0);
  expect(await inkAround(page, 0.5 + arcMid, 0.5 + arcMid, 0.08)).toBeGreaterThan(0);
  // The north-arrow corner stays bare until the toggle raises it. Only a
  // SITE PLAN sheet flies it by convention (Movie, 16 Oct: "north arrow ON
  // by default"), and this drawing deals none: it is the house alone, with
  // no sheets dealt.
  expect(await inkAround(page, STRIP_X, ARROW_MID_Y, 0.25)).toBe(0);
});

test('the NORTH ARROW toggle inks the arrow cell and persists on the drawing', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await expect(page.locator('[data-layout-north]')).toContainText('Off');
  await withLayoutSave(page, () => page.locator('[data-layout-north]').click());
  await expect(page.locator('[data-layout-north]')).toContainText('On');
  expect(await inkAround(page, STRIP_X, ARROW_MID_Y, 0.25)).toBeGreaterThan(20);
  expect((await savedDrawing(page)).layout.northArrow).toBe(true);
  // The raised arrow survives a reload.
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await expect(page.locator('[data-layout-north]')).toContainText('On');
  expect(await inkAround(page, STRIP_X, ARROW_MID_Y, 0.25)).toBeGreaterThan(20);
});

test('the BAND frame keeps the original bottom strip', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await withLayoutSave(page, () => frameMenu(page).selectOption('LBAND01'));
  expect((await savedDrawing(page)).layout.titleblock).toBe('LBAND01');
  // The band inks its sheet numeral in the bottom-right cell again.
  expect(await inkAround(page, 0.5 + 16 * 0.94, STRIP_MID_Y, 0.6)).toBeGreaterThan(30);
});

test('a pick persists on the drawing and survives a reload', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await withLayoutSave(page, () => frameMenu(page).selectOption('LROUND01'));
  expect((await savedDrawing(page)).layout.titleblock).toBe('LROUND01');
  // The pick also rides the personal settings package for the next drawing.
  expect(await page.evaluate(() =>
    window.DraftProfileManager.getActive('settings')?.content?.layout?.titleblock)).toBe('LROUND01');
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await expect(frameMenu(page), 'the reload lost the frame').toHaveValue('LROUND01');
});

test('a drawing saved before the split still comes up wearing what it was given',
  async ({ page }) => {
    // 'bluejetty' was one id meaning BOTH answers: the rounded frame AND
    // BLUEJETTY's logo. Every drawing and settings package in the field holds
    // one of the four, and a drawing that is never saved again still has to
    // open right -- so the id is read through pickFrom rather than migrated.
    await openLayout(page, houseDrawing());
    await page.evaluate(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      const saved = JSON.parse(await file.text());
      saved.layout = { ...(saved.layout || {}), titleblock: 'bluejetty' };
      delete saved.layout.titleblockMark;
      await window.SharedFileStore.saveSharedFile(
        new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' }), bucket);
    }, BUCKET);
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
    await expect(frameMenu(page), 'the old BLUEJETTY lost its rounded frame').toHaveValue('LROUND01');
    await expect(markMenu(page), 'the old BLUEJETTY lost its logo').toHaveValue('bluejetty');
  });

test('the letter sheet gets a block of its own, measured for it', async ({ page }) => {
  // IT USED TO GET NONE (Movie, 14 Oct: "make sets that will fit on the
  // different sizes for each of those"). There is a set for each of the four
  // sheets now, so the picker stays up and the shape is carried across --
  // what changes is the frame, because a 1.15" strip is 13.5% of an 8.5"
  // sheet against 6.8% of a 17" one.
  await openLayout(page, houseDrawing());
  await withLayoutSave(page, () => frameMenu(page).selectOption('LROUND01'));
  await withLayoutSave(page, () => page.getByRole('button', { name: '8.5 × 11' }).click());
  await expect(frameMenu(page).locator('option')).toHaveText(['LSQUARE02', 'LBAND02', 'LROUND02']);
  await expect(frameMenu(page), 'the letter sheet lost his rounded shape').toHaveValue('LROUND02');
});

test('project and drafter words flow into the strip', async ({ page }) => {
  await openLayout(page, houseDrawing());
  const bare = await inkAround(page, STRIP_X, WORDS_MID_Y, 0.55);
  // The PROJECT page's words ride the drawing; the drafter's identity rides
  // the personal settings package the SETTINGS page writes.
  const saved = await savedDrawing(page);
  saved.projectInfo = {
    name: 'MAPLE STREET RESIDENCE',
    client: 'JANE OWNER',
    address: '123 MAPLE STREET',
  };
  await page.evaluate(async ({ bucket, drawing }) => {
    const file = new File([JSON.stringify(drawing)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
    const manager = window.DraftProfileManager;
    manager.saveActive(manager.createPackage('settings', 'seeded', {
      model: { drafter: { name: 'JANE DRAFT', phone: '(555) 555-5555' } },
    }));
  }, { bucket: BUCKET, drawing: saved });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  // The rotated BUILDING ADDRESS / OWNER block carries the new words.
  const worded = await inkAround(page, STRIP_X, WORDS_MID_Y, 0.55);
  expect(worded).toBeGreaterThan(bare + 100);
});

// THIS SHEET ONLY (Movie, 26 Oct: "can we allow the user to change the main
// TB, but also allow a little checkbox to make the page allowed to use a
// different TB type ... I'd like to use the BAND version on the SITE PLAN
// and the SIDE version on the other plans"). Ticked, the menu sets the sheet
// in front of him; the others keep the main frame; unticked, the sheet goes
// back to the main one. Kept in the file, and through a RE-DEAL.
test('THIS SHEET ONLY gives one sheet its own frame; the rest keep the main one', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await withLayoutSave(page, () => frameMenu(page).selectOption('LSQUARE01'));
  const own = page.locator('[data-layout-own-frame]');
  await expect(own).not.toBeChecked();
  await page.locator('[data-layout-sheet="1"]').click();
  await withLayoutSave(page, () => own.check());
  await withLayoutSave(page, () => frameMenu(page).selectOption('LBAND01'));
  let layout = (await savedDrawing(page)).layout;
  expect(layout.titleblock, 'the main frame stays').toBe('LSQUARE01');
  expect(layout.sheets[0].titleblock).toBe('LBAND01');
  // The band on sheet 1: its numeral cell inked at the bottom right.
  expect(await inkAround(page, 0.5 + 16 * 0.94, STRIP_MID_Y, 0.6)).toBeGreaterThan(30);
  // Sheet 2 still wears the side strip, and its box is unticked.
  await page.locator('[data-layout-sheet="2"]').click();
  await expect(own).not.toBeChecked();
  await expect(frameMenu(page)).toHaveValue('LSQUARE01');
  expect(await inkAround(page, STRIP_X, SHEET_MID_Y, 0.4)).toBeGreaterThan(30);
  // Changing the main frame from sheet 2 leaves sheet 1's own alone.
  await withLayoutSave(page, () => frameMenu(page).selectOption('LROUND01'));
  layout = (await savedDrawing(page)).layout;
  expect(layout.titleblock).toBe('LROUND01');
  expect(layout.sheets[0].titleblock).toBe('LBAND01');
  // Kept through a reload and the composer dealing again (DEAL SHEETS is
  // hidden over a dealt set now; a paper change still re-deals one).
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.locator('[data-layout-sheet="1"]').click();
  await expect(own).toBeChecked();
  await expect(frameMenu(page)).toHaveValue('LBAND01');
  await expect(page.locator('[data-layout-deal-sheets]')).toBeHidden();
  await withLayoutSave(page, () => page.evaluate(() => page._composeDefaultSet()));
  layout = (await savedDrawing(page)).layout;
  expect(layout.sheets.find(sh => sh.title === (layout.sheets[0].title))?.titleblock).toBe('LBAND01');
  // Unticked, sheet 1 wears the main frame again.
  await page.locator('[data-layout-sheet="1"]').click();
  await withLayoutSave(page, () => own.uncheck());
  layout = (await savedDrawing(page)).layout;
  expect(layout.sheets[0].titleblock).toBeUndefined();
  await expect(frameMenu(page)).toHaveValue('LROUND01');
});
