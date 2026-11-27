// THE LISTING PLAN: what a buyer reads, and nothing a framer does.
//
// Movie, 1 Oct: "on REAL ESTATE LAYOUTS we should NOT show the dimensions at
// all, but they should show ROOM TAGS with approx size (5X8) (feet) and the
// floor areas and total house area on main and above levels and area for
// foundation area", "the walls should be SOLID FILL on the REAL ESTATE PLANS",
// and window/door/equipment sizes "not on any real estate plans".
//
// THE TEXT THE CANVAS IS ASKED TO PAINT is what is counted, with the
// transform at the moment of the call so a rotated string is placed right --
// a picture of the sheet looked much the same with and without each of these.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-movie-bands.draft'), 'utf8'));
// TWO TAGS ON MAIN FL, one with a size and one without, placed where the
// fixture's own plan is.
const TAGGED = {
  ...REPRO,
  roomTags: [
    { id: 1, at: { x: 0, z: 0 }, levelId: 3, view: 'plan', name: 'LIVING', size: '14X16',
      areaSqFt: 0, stamped: true, layer: 'ROOM-IDS-AREA' },
    { id: 2, at: { x: 4, z: 2 }, levelId: 3, view: 'plan', name: 'DEN',
      areaSqFt: 0, stamped: true, layer: 'ROOM-IDS-AREA' },
  ],
  nextRoomTagId: 3,
};

const DIMENSION = /^\d+'-\d+(?: \d+\/\d+)?"$/;
const SIZE_TAG = /^(W \d+ X \d+|\d+ X \d+|D\d+|ED\d+|DD\d+|G .+)$/;

async function sheetText(page, saved, paperId) {
  await h.suppressEntryCoach(page);
  await page.goto('/REALESTATEPLAN.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 15000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: h.STORAGE_BUCKET, saved });
  await page.goto('/REALESTATEPLAN.html');
  await page.evaluate(() => {
    window.__ink = [];
    const P = CanvasRenderingContext2D.prototype;
    const fillText = P.fillText;
    P.fillText = function (text) {
      window.__ink.push(String(text));
      return fillText.apply(this, arguments);
    };
  });
  if (paperId) await page.selectOption('#paper', paperId);
  await page.setViewportSize({ width: 1360, height: 764 });
  await page.waitForFunction(() => (window.__ink || []).length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(300);
  return page.evaluate(() => ({ ink: window.__ink, areas: window.__rpAreas || [] }));
}

test('no dimension string and no size tag reaches a listing plan', async ({ page }) => {
  // THE FIXTURE HAS NINETY-FOUR dimension records and two dozen openings, so
  // an empty result is the page leaving them off, not a drawing with none.
  expect(REPRO.dimensions.length).toBeGreaterThan(10);
  for (const paper of [null, 'letter-port']) {
    const { ink } = await sheetText(page, TAGGED, paper);
    expect(ink.length, 'the sheet painted text at all').toBeGreaterThan(0);
    expect(ink.filter(t => DIMENSION.test(t)), `${paper || 'default'}: dimension strings`).toEqual([]);
    expect(ink.filter(t => SIZE_TAG.test(t)), `${paper || 'default'}: size tags`).toEqual([]);
  }
});

test('room tags print their name, and the size under it when there is one', async ({ page }) => {
  const { ink } = await sheetText(page, TAGGED);
  expect(ink).toContain('LIVING');
  expect(ink, 'the size line is printed exactly as typed').toContain('14X16');
  expect(ink).toContain('DEN');
});

// THE AREA BOX STARTS OFF (jb, 27 Nov 2026: "no FLOOR AREAS ... we might
// put those elsewhere on here in a bit"); a tick puts it on the sheet.
async function areasOn(page) {
  await page.locator('.seat', { hasText: 'FLOOR AREAS' }).locator('input').check();
  await page.waitForFunction(() => (window.__rpAreas || []).length > 0);
  return page.evaluate(() => window.__rpAreas);
}

test('the area box: each floor, the house total, the foundation on its own', async ({ page }) => {
  await sheetText(page, TAGGED);
  const areas = await areasOn(page);
  const names = areas.map(row => row.replace(/ (?:[\d,]+ SQ FT|NO FLOOR DRAWN)$/, ''));
  // TOP DOWN, the total under the levels at grade and above, and the level
  // below grade after it -- never inside it.
  expect(names).toEqual(['2ND FL', 'MAIN FL', 'TOTAL HOUSE', 'FOUNDATION']);
  const value = name => {
    const row = areas.find(r => r.startsWith(`${name} `));
    const m = row && row.match(/([\d,]+) SQ FT$/);
    return m ? Number(m[1].replace(/,/g, '')) : null;
  };
  expect(value('MAIN FL'), 'MAIN FL measured').toBeGreaterThan(0);
  expect(value('2ND FL'), '2ND FL measured').toBeGreaterThan(0);
  expect(value('TOTAL HOUSE'), 'the house is MAIN and above, and nothing else')
    .toBe(value('MAIN FL') + value('2ND FL'));
  expect(value('FOUNDATION')).toBeGreaterThan(0);
});

test('the area box starts off, goes on with a tick, and comes off like a plan', async ({ page }) => {
  const { areas } = await sheetText(page, TAGGED);
  expect(areas, 'off on a new sheet').toEqual([]);
  const box = page.locator('.seat', { hasText: 'FLOOR AREAS' }).locator('input');
  await expect(box).not.toBeChecked();
  await areasOn(page);
  await expect(box).toBeChecked();
  // UNTICKED FIRST, THEN CLEARED: the sheet repaints on its own (fonts, the
  // 3D views landing), and a repaint still in flight from the tick could set
  // the rows again between clearing them and unticking. Cleared after the
  // untick has settled, any later paint that still drew the box would show.
  await box.uncheck();
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__rpAreas = null; });
  await page.locator('.seat', { hasText: 'FLOOR AREAS' }).locator('input').dispatchEvent('change');
  await page.waitForTimeout(300);
  await expect(box).not.toBeChecked();
  expect(await page.evaluate(() => window.__rpAreas)).toBe(null);
});
