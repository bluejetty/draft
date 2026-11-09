// DOOR AND WINDOW SCHEDULES, AND THE TYPICAL WALL SECTION WITH ITS DETAILS,
// IN THE BASE SET (jb, 9 Nov).
//
// jb, from his draftsman's review: "Window and door schedules and a wall
// section cut in the base set. we should work on these". Asked where the
// schedules go: "will you put the window schedules in the ESTIMATES
// section? ... and doors". On the section: "so the wall section is basically
// taken from the PROJECT information right". And on what a detail shows:
// "when i do details i usually show where the exterior walls meet the floor,
// and where it meets the roof and also the footing".
//
// So four things are held here:
//   1. the deal puts a WALL SECTION sheet after the SECTIONS (the section
//      and the eave, floor and footing details) and a SCHEDULES sheet after
//      the basement, before ELECTRIC;
//   2. a schedule has no scale -- pif 1, NTS on the titleblock -- and its
//      rows carry the marks ESTIMATES prints under 8-A / 8-B;
//   3. the section is drawn from PROJECT's numbers: change the pitch in the
//      file and the callout follows;
//   4. the viewports survive a reload through the layout reader.
//
// Mutation gate: proto/schedules-wall-section-mutants.js.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BUCKET = 'model-drawing';
// THE TWO-STOREY WITH 21 WINDOWS AND A GARAGE DOOR the window tags are
// measured on (proto/repro-movie-bands.draft): a house with enough openings
// to group, and a full stack for the section.
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));
const house = (patch = {}) => {
  const saved = JSON.parse(JSON.stringify(REPRO));
  delete saved.layout;           // so the page deals its own set on entry
  return { ...saved, ...patch };
};

async function openLayout(page, drawing) {
  page.__errors = [];
  page.on('pageerror', err => page.__errors.push(String(err)));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  // The deal on entry lands on the first idle frame after the file loads.
  await page.waitForFunction(() => page.state.sheets.length > 1);
}
test.afterEach(async ({ page }) => { expect(page.__errors || [], 'no page errors').toEqual([]); });

const layoutState = page => page.evaluate(() => ({
  sheets: page.state.sheets.map(sheet => sheet.title),
  viewports: page.state.viewports.map(({ id, kind, sheet, pif, table, detail }) =>
    ({ id, kind, sheet, pif, ...(table ? { table } : {}), ...(detail ? { detail } : {}) })),
}));

test('the deal puts a WALL SECTION sheet after the sections and a SCHEDULES sheet before ELECTRIC', async ({ page }) => {
  await openLayout(page, house());
  const { sheets, viewports } = await layoutState(page);
  const at = title => sheets.indexOf(title) + 1;
  expect(at('WALL SECTION')).toBe(at('SECTIONS') + 1);
  // This house has no basement walls and no electric, so the SCHEDULES are
  // the last sheet; layout-compose.spec.js holds their place between the
  // BASEMENT PLAN and the ELECTRIC PLAN on a house that has both.
  expect(at('SCHEDULES')).toBe(sheets.length);
  expect(at('SCHEDULES')).toBeGreaterThan(at('WALL SECTION'));
  // The section and its three details, in jb's order, on the one sheet.
  const details = viewports.filter(v => v.kind === 'detail' && v.sheet === at('WALL SECTION'));
  expect(details.map(v => v.detail)).toEqual(['wallsection', 'eave', 'floor', 'footing']);
  // THE SECTION NO BIGGER THAN 1/2", THE DETAILS NO BIGGER THAN 1", and the
  // three details share one rung -- a set of details at three scales
  // reads as three drawings, not one wall.
  const section = details.find(v => v.detail === 'wallsection');
  expect(section.pif).toBeLessThanOrEqual(1 / 2);
  const blown = details.filter(v => v.detail !== 'wallsection');
  expect(new Set(blown.map(v => v.pif)).size).toBe(1);
  expect(blown[0].pif).toBeLessThanOrEqual(1);
  expect(blown[0].pif).toBeGreaterThan(section.pif);
  // The door schedule over the window schedule, each at pif 1: a table
  // has no scale.
  const schedules = viewports.filter(v => v.kind === 'schedule' && v.sheet === at('SCHEDULES'));
  expect(schedules.map(v => [v.table, v.pif])).toEqual([['door', 1], ['window', 1]]);
});

test('a schedule prints its rows under the marks ESTIMATES prints, and the sheet reads NTS', async ({ page }) => {
  await openLayout(page, house());
  const rows = await page.evaluate(() => {
    const s = page._schedules();
    return {
      windows: s.windows.map(r => [r.mark, r.qty, r.size, r.casementWord, r.sill, r.levels.join('/')]),
      doors: s.doors.map(r => [r.mark, r.qty, r.size, r.kindWord, r.styleWord]),
      table: window.DraftSchedules.scheduleTable(s, 'window'),
    };
  });
  // Eighteen 48 x 50 singles across both floors are ONE row, W1, QTY 18,
  // the narrowest first; the three 66 x 36 doubles are W2.
  expect(rows.windows).toEqual([
    ['W1', 18, '48 x 50"', 'SINGLE', '2\'-10"', '2ND FL/MAIN FL'],
    ['W2', 3, '66 x 36"', 'DOUBLE', '4\'-0"', '2ND FL'],
  ]);
  // Doors D1.. from the narrowest; the overhead door is G1 in feet.
  expect(rows.doors).toEqual([
    ['D1', 1, '30 x 80"', 'INTERIOR', 'SINGLE'],
    ['D2', 1, '36 x 80"', 'INTERIOR', 'SINGLE'],
    ['G1', 1, '16\'-0" x 7\'-0"', 'OVERHEAD', 'SECTIONAL'],
  ]);
  expect(rows.table.columns.map(c => c.head)).toEqual(['MARK', 'QTY', 'SIZE (W x H)', 'TYPE', 'SILL HT', 'LEVEL', 'REMARKS']);
  expect(rows.table.rows[0][0]).toBe('W1');
  // The titleblock of the SCHEDULES sheet: no scale to print.
  const scale = await page.evaluate(() => {
    const sheet = page.state.sheets.findIndex(s => s.title === 'SCHEDULES') + 1;
    return page._titleblockInfo(sheet).scale;
  });
  expect(scale).toBe('NTS');
  // And the same marks on ESTIMATES, beside the item.
  await page.goto('/ESTIMATES.html');
  await expect(page.locator('[data-section="8-B"]')).toBeVisible();
  await expect(page.locator('[data-row="8-B:48x50"] [data-mark]')).toHaveText('W1');
  await expect(page.locator('[data-row="8-A:garage:192x84"] [data-mark]')).toHaveText('G1');
});

test('the section is drawn from PROJECT\'s numbers: the pitch callout follows the file', async ({ page }) => {
  await openLayout(page, house({ roofPitch: 6, roofOverhang: 1.5 }));
  const labels = await page.evaluate(() => page._wallSection().labels.map(l => l.text));
  expect(labels).toContain('6:12');
  expect(labels).toContain('1\'-6" O/H');
  expect(labels).toContain('20" x 8" CONC. FOOTING');
  expect(labels).toContain('8\'-0" HIGH');
  // The section's window reaches from under the footing to over the ridge
  // line; each detail is a 4 1/2 x 3 1/2 ft window inside it.
  const windows = await page.evaluate(() => page._wallSection().windows);
  ['eave', 'floor', 'footing'].forEach(id => {
    expect(windows[id].maxX - windows[id].minX).toBeCloseTo(4.5, 6);
    expect(windows[id].maxY - windows[id].minY).toBeCloseTo(3.5, 6);
    expect(windows[id].minY).toBeGreaterThanOrEqual(windows.wallsection.minY - 1e-9);
    expect(windows[id].maxY).toBeLessThanOrEqual(windows.wallsection.maxY + 1e-9);
  });
  // The eave window holds the eave; the footing window holds the footing;
  // the floor window holds the sill. In the section's own feet, 0 is the
  // top of the main floor sheathing.
  expect(windows.eave.minY).toBeGreaterThan(windows.floor.maxY);
  expect(windows.floor.minY).toBeLessThan(0);
  expect(windows.floor.maxY).toBeGreaterThan(0);
  expect(windows.footing.maxY).toBeLessThan(windows.floor.minY);
});

test('the printed WALL SECTION sheet has ink in every one of its four windows', async ({ page }) => {
  await openLayout(page, house());
  const inks = await page.evaluate(() => {
    const sheet = page.state.sheets.findIndex(s => s.title === 'WALL SECTION') + 1;
    const { canvas } = page._printSheetCanvas(sheet, 72);
    const ctx = canvas.getContext('2d');
    return page.state.viewports.filter(v => v.sheet === sheet).map(v => {
      const r = page._viewportRectIn(v);
      const data = ctx.getImageData(Math.round(r.xIn * 72), Math.round(r.yIn * 72),
        Math.round(r.wIn * 72), Math.round(r.hIn * 72)).data;
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 128 && data[i + 3] > 0) ink += 1;
      return [v.detail, ink];
    });
  });
  inks.forEach(([detail, ink]) => expect(ink, `${detail} draws`).toBeGreaterThan(200));
});

test('+ ADD VIEWPORT offers the schedules and the details, and a placed schedule survives a reload', async ({ page }) => {
  await openLayout(page, house());
  await page.locator('[data-layout-add-viewport]').click();
  await expect(page.locator('.lay-add-head')).toContainText(['SCHEDULES', 'DETAILS']);
  await expect(page.locator('[data-add-pick^="schedule:"]')).toHaveText(['DOOR SCHEDULE', 'WINDOW SCHEDULE']);
  await expect(page.locator('[data-add-pick^="detail:"]')).toHaveText(
    ['TYP. WALL SECTION', 'EAVE DETAIL', 'FLOOR DETAIL', 'FOOTING DETAIL']);
  // Put the window schedule on sheet 1 by hand.
  await page.evaluate(() => page._setActiveSheet(1));
  await page.locator('[data-add-pick="schedule:window"]').click();
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await page.evaluate(() => page._placeViewport({ xIn: 8, yIn: 5 }));
  await page.waitForFunction(prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
  const placed = await page.evaluate(() => page.state.viewports.find(v => v.sheet === 1 && v.kind === 'schedule'));
  expect(placed).toMatchObject({ kind: 'schedule', table: 'window', pif: 1, xIn: 8, yIn: 5 });
  // Its frame is the table's own size, whatever rung the sheet is on.
  const frame = await page.evaluate(id => page._naturalRectIn(page.state.viewports.find(v => v.id === id)), placed.id);
  expect(frame.wIn).toBeCloseTo(7.4, 3);
  // THE READER KEEPS IT: a reload finds the schedule and every detail
  // still seated, with their references.
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const after = await layoutState(page);
  expect(after.viewports.find(v => v.id === placed.id)).toMatchObject({ kind: 'schedule', table: 'window', sheet: 1 });
  expect(after.viewports.filter(v => v.kind === 'detail').map(v => v.detail))
    .toEqual(['wallsection', 'eave', 'floor', 'footing']);
});
