// A SHEET SET SAVED BEFORE THE PORT MUST OPEN AFTER IT.
//
// RD-DOCUMENTS/ORDER-construction-layouts.md names this as Stage 2's single
// highest risk. Thirteen spec files drive the Construction Layout and every
// one of them starts the page empty and composes its own record, so not one
// can tell a reader that lost a field from a reader that never had one.
//
// proto/layout-record-harness.js asks the question in Node -- does the RECORD
// survive the validator -- and that is the cheap half. This is the other
// half, and the one a drafter would recognise: put a sheet set the page wrote
// yesterday into the store, open the page, and see whether the drawings are
// still on the sheets they were left on.
//
// PAGE-AGNOSTIC ON PURPOSE. It opens whichever construction layout page is on
// disk, so it guards LAYOUT.dc.html today and LAYOUT.html the moment the port
// lands, with nothing to remember to update. That is the whole point of
// writing it before the port rather than after.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BUCKET = 'model-drawing';
const PW = 17;
const PH = 11;
const FIT_MARGIN = 60;

const PAGE = ['LAYOUT.html', 'LAYOUT.dc.html']
  .find(f => fs.existsSync(path.join(__dirname, '..', f)));

// THE FIXTURE, READ OFF DISK RATHER THAN TYPED. It is the bytes the store held
// after LAYOUT.dc.html was driven in a browser on 23 Sep 2026 -- dealt with
// DEAL SHEETS, then given a drafter's hand: the BLUEJETTY BAND strip, the
// north arrow raised, E1 nudged 1.25" across its sheet. Seven viewports, five
// sheets, all three kinds. See proto/layout-record-harness.js for the rest.
const FIXTURE = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'proto', 'layout-record-dc.draft'), 'utf8'));
const SAVED = FIXTURE.layout;

async function openWithRecord(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto(`/${PAGE}`);
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json',
      { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: FIXTURE });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

const savedLayout = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return file ? JSON.parse(await file.text()).layout : null;
}, BUCKET);

async function sheetMetrics(page) {
  const box = await page.locator('[data-layout-canvas]').boundingBox();
  const zoom = Math.min((box.width - FIT_MARGIN * 2) / PW, (box.height - FIT_MARGIN * 2) / PH);
  return { box, zoom, panX: (box.width - PW * zoom) / 2, panY: (box.height - PH * zoom) / 2 };
}

async function sheetToClient(page, xIn, yIn) {
  const m = await sheetMetrics(page);
  return { x: m.box.x + m.panX + xIn * m.zoom, y: m.box.y + m.panY + yIn * m.zoom };
}

// Non-white pixels in a square around a sheet point -- enough to tell a drawn
// view from bare paper.
async function inkAround(page, xIn, yIn, radiusIn) {
  const m = await sheetMetrics(page);
  return inkIn(page, m.panX + xIn * m.zoom - radiusIn * m.zoom,
    m.panY + yIn * m.zoom - radiusIn * m.zoom,
    radiusIn * 2 * m.zoom, radiusIn * 2 * m.zoom);
}

// And over the whole sheet, which is how a sheet is asked whether it drew
// anything at all -- see the test at the foot of this file for why a point
// probe cannot answer that for a plan.
//
// `drawingOnly` LEAVES THE TITLEBLOCK OUT, and it is not a nicety: the band
// prints the SHEET NUMERAL, so two sheets showing an identical picture still
// differ by a handful of pixels. A check comparing whole sheets for sameness
// is defeated by the digit -- which is how the broken-filter mutant in
// proto/layout-record-spec-mutants.js escaped its own test and was caught by
// another one instead. The band's height comes off the shared module rather
// than a literal, so a page that stops loading DraftTitleblock says so here.
async function sheetInk(page, { drawingOnly = false } = {}) {
  const m = await sheetMetrics(page);
  const bandIn = drawingOnly
    ? await page.evaluate(() => window.DraftTitleblock?.BAND_H_IN ?? null) : 0;
  expect(bandIn, 'the titleblock module is not loaded').not.toBeNull();
  return inkIn(page, m.panX, m.panY, PW * m.zoom, (PH - bandIn) * m.zoom);
}

function inkIn(page, x, y, w, h) {
  return page.evaluate(({ px, py, pw, ph }) => {
    const canvas = document.querySelector('[data-layout-canvas]');
    const data = canvas.getContext('2d').getImageData(
      Math.round(px), Math.round(py), Math.round(pw), Math.round(ph)).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 240 || data[i + 1] < 240 || data[i + 2] < 240) ink += 1;
    }
    return ink;
  }, { px: x, py: y, pw: w, ph: h });
}

// THE FIXTURE IS WORTH OPENING. Both assertions guard the same thing from
// opposite ends: an `auto` record is RE-DEALT on load, so the page writes it
// again rather than carrying it and every check below passes over a record
// this test never measured. The harness refuses one too; it is the mistake
// that made the first attempt at this measurement useless.
test('the fixture is a hand-arranged set, which is the only kind that tests a reader', () => {
  expect(SAVED.auto, 'an auto record is re-dealt on load and proves nothing').toBe(false);
  expect(new Set(SAVED.viewports.map(v => v.sheet)).size).toBeGreaterThan(1);
  expect([...new Set(SAVED.viewports.map(v => v.kind))].sort())
    .toEqual(['elevation', 'plan', 'section']);
});

test('the sheet set opens on the sheets it was left on, and the page holds all of it',
  async ({ page }) => {
    await openWithRecord(page);

    // What the drafter sees before touching anything: five sheets in the
    // list, the strip they picked, the arrow they raised.
    await expect(page.locator('[data-layout-sheet]')).toHaveCount(
      new Set(SAVED.viewports.map(v => v.sheet)).size);
    await expect(page.locator('[data-layout-north]')).toContainText('On');
    await expect(page.locator('[data-layout-titleblock="bluejetty-band"]')).toBeVisible();

    // AND THE PAGE IS HOLDING THE WHOLE RECORD, not just the parts it shows.
    // One viewport is nudged, which is the page's own save path, and what
    // comes back out must be everything that went in -- including
    // nextViewportId and the six viewports nothing on screen was touching.
    //
    // A read without a write would prove nothing: the record in the bucket
    // would still be the one this test put there.
    const target = SAVED.viewports[0];
    const from = await sheetToClient(page, target.xIn, target.yIn);
    const to = await sheetToClient(page, target.xIn - 1.5, target.yIn + 0.75);
    const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(p => Number(document.body.dataset.layoutSaveSeq || 0) > p, seq);

    const after = await savedLayout(page);
    expect(after.viewports[0].xIn).toBeCloseTo(target.xIn - 1.5, 1);
    expect(after.viewports[0].yIn).toBeCloseTo(target.yIn + 0.75, 1);

    // AND THE INK WENT WITH IT. The record agreeing is not the same claim as
    // the sheet agreeing: a page that reads xIn and yIn faithfully and draws
    // from somewhere else would satisfy every line above. E1 is an elevation,
    // which is solid through its middle, so a point probe answers here -- it
    // would not on a plan, and the test at the foot of this file says why.
    expect(await inkAround(page, target.xIn - 1.5, target.yIn + 0.75, 0.75))
      .toBeGreaterThan(50);
    expect(await inkAround(page, target.xIn, target.yIn, 0.4)).toBeLessThan(50);

    // EVERY OTHER SEAT UNMOVED, named by what it looks at rather than counted
    // -- a count of seven is also what a page that repointed them all at one
    // plan would report.
    //
    // `view` IS PART OF THE SEAT. It says which drawing OF a level a plan
    // viewport is, and it was being dropped on load until 23 Sep -- which
    // made the FOUNDATION sheet and the basement sheet two copies of one
    // drawing. The fixture carries it on both its plan viewports, so a reader
    // that goes back to throwing it away fails here.
    const seat = v => [v.id, v.kind, v.sheet, v.pif, v.xIn, v.yIn,
      v.kind === 'plan' ? `${v.levelId}:${v.view || '-'}`
        : v.kind === 'section' ? v.cutId : v.elevId].join('/');
    expect(after.viewports.slice(1).map(seat)).toEqual(SAVED.viewports.slice(1).map(seat));
    expect(after.viewports.filter(v => v.kind === 'plan').map(v => v.view).sort())
      .toEqual(['foundation', 'plan']);
    expect([after.paperKey, after.orientation, after.titleblock,
      after.northArrow, after.nextViewportId])
      .toEqual([SAVED.paperKey, SAVED.orientation, SAVED.titleblock,
        SAVED.northArrow, SAVED.nextViewportId]);
    // The hand stays on the sheets: a set arranged by hand is never re-dealt.
    expect(after.auto).toBe(false);
  });

// THE POINT PROBE CANNOT ASK THIS, and finding that out is why the check
// below is a ratio. A plan of a 36' x 26' house at 1/4" is a HOLLOW rectangle
// 9" x 6.5" on the paper: its walls are on the perimeter and its middle is an
// empty room, so a probe at the viewport's own centre reads zero ink on a
// sheet that is drawing perfectly. Elevations pass it and plans do not, which
// is a check that fails while measuring the wrong thing -- the same family as
// one that passes while measuring nothing.
//
// SO EACH SHEET IS WEIGHED AGAINST A BARE ONE: the same record on the same
// paper with the same company strip and no viewports at all. That makes the
// threshold a RATIO measured on the machine the test is running on, rather
// than a pixel count that drifts with a font or a window size.
//
// MEASURED, 23 Sep 2026, at this viewport: a bare sheet is 5,646 ink pixels
// (the titleblock band and nothing else). The five loaded sheets are 21,059 /
// 21,099 / 14,459 / 23,002 / 21,141 -- the thinnest of them, the MAIN FL
// plan, is 2.56x the bare one. Twice is comfortably clear of both sides.
test('every sheet still carries its drawing, not just its titleblock', async ({ page }) => {
  await openWithRecord(page);
  const sheets = [...new Set(SAVED.viewports.map(v => v.sheet))].sort((a, b) => a - b);
  const loaded = [];
  const drawn = [];
  for (const sheet of sheets) {
    await page.locator(`[data-layout-sheet="${sheet}"]`).click();
    loaded.push(await sheetInk(page));
    drawn.push(await sheetInk(page, { drawingOnly: true }));
  }

  // The same sheet with nothing on it: the floor every one of them must clear.
  await page.evaluate(async ({ bucket, saved }) => {
    const bare = JSON.parse(JSON.stringify(saved));
    bare.layout.viewports = [];
    const file = new File([JSON.stringify(bare)], 'model-drawing.json',
      { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: FIXTURE });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const bare = await sheetInk(page);
  expect(bare, 'a bare sheet should still carry its titleblock').toBeGreaterThan(0);

  sheets.forEach((sheet, i) => {
    expect(loaded[i], `sheet ${sheet} is as empty as a sheet with no viewports on it`)
      .toBeGreaterThan(bare * 2);
  });

  // AND THEY ARE NOT ALL THE SAME PICTURE. The ratio above cannot see a page
  // whose sheet filter stopped filtering: every viewport would draw on every
  // sheet, which puts the ink UP and reads as five healthy sheets. What it
  // cannot fake is five different numbers -- so the check is exact equality
  // rather than a spread, because only that failure makes them identical.
  //
  // COUNTED OVER THE DRAWING AREA ALONE, and the first version was not. It
  // weighed whole sheets and the mutant walked straight through it: the
  // titleblock prints the SHEET NUMERAL, so five identical pictures still
  // came back as five different numbers and the mutation was caught by a
  // different test than the one aimed at it. Measured, 23 Sep -- whole
  // sheets 21,059 / 21,099 / 14,459 / 23,002 / 21,141; drawing areas 16,937
  // / 16,902 / 11,102 / 19,655 / 17,765. Still five, and now for the reason
  // the assertion claims.
  expect(new Set(drawn).size,
    'every sheet drew the same thing -- the sheet filter is not filtering')
    .toBe(sheets.length);
});
