// NO LOT CARD ON THE SITE PLAN SHEET (jb, 9 Nov 2026): "i am in the SITE PLAN
// (only site plan drawing) and when i go to the site plan area its asking me
// if i want a site plan. can we take that out, maybe don't need it at all
// for the other drawings too the user should figure it out".
//
// The HOW BIG IS THE LOT? card LAYOUT raised on arriving at a SITE PLAN sheet
// with no lot in the drawing (Movie, 13 Oct) is gone, for every drawing: a
// standalone site plan and a house alike. The lot is drawn in the Model
// Space with the OUTLINE and TRACE tools, and this page draws whatever is
// there.
//
// Two arrivals are checked, because the two drawings reached the sheet by
// different doors: a standalone site plan opens on SITE PLAN as its only
// sheet, and a house's dealt set puts SITE PLAN first.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const SITE = 8;

// The blank the page itself opens on, marked as a standalone site plan.
const standaloneBlank = () => ({
  version: 1, planTurn: 0, board: 'drafting', standalone: 'site',
  levels: [{ id: SITE, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 }],
  activeLevelIdx: 0,
  walls: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
  lines: [{ id: 'fence', levelId: SITE, view: 'plan', layer: 'draft',
    start: { x: -40, y: 0, z: -30 }, end: { x: 40, y: 0, z: -30 } }],
});

// THE NAME EVERY LOT CARD CARRIED, on either page. Asked of the DOM rather
// than of an id, so a card put back under a new id is still caught.
const lotCard = page => page.locator('[data-lot-pick], #lay-lot');

async function openLayoutOn(page, drawing) {
  await page.goto('/LAYOUT.html');
  await page.evaluate(async saved => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, 'model-drawing');
  }, drawing);
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
}

// A STANDALONE SITE PLAN WITH A LINE DRAWN AND NO LOT: where jb was when the
// card asked him for a lot he had come to draw himself. The line is what
// gets the sheet dealt (a set with nothing to show is not composed).
test('a standalone site plan with no lot opens on SITE PLAN and is not asked for one',
  async ({ page }) => {
    await openLayoutOn(page, standaloneBlank());
    await page.evaluate(() => page._composeDefaultSet());
    await page.waitForTimeout(500);
    const titles = await page.evaluate(() => page.state.sheets.map(sheet => sheet.title));
    expect(titles, 'the one sheet is SITE PLAN').toEqual(['SITE PLAN']);
    await expect(lotCard(page), 'the lot card is gone').toHaveCount(0);
    // AND NOTHING STANDS ON THE SHEET where a drafter works: the card used to
    // take the press that PLACES A VIEWPORT (layout-lot-card.spec.js, now
    // retired, existed to prove it stood clear).
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    const under = await page.evaluate(({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      return el ? `${el.tagName}${el.id ? `#${el.id}` : ''}` : 'nothing';
    }, { x: box.x + box.width * 0.4, y: box.y + box.height * 0.45 });
    expect(under).toBe('CANVAS#lay-canvas');
  });

// A HOUSE AND NO LOT: the other drawing the card used to come up on.
test('a house with no lot is not asked for one on its SITE PLAN sheet either', async ({ page }) => {
  await h.openModel(page);
  await h.selectTool(page, 'Outline');
  for (const [x, z] of [[-12, -9], [12, -9], [12, 9], [-12, 9]]) await h.clickWorld(page, x, z);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
  await page.locator('[data-build-house]').click();
  await h.waitForSaved(page);
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  const hasLot = await page.evaluate(async () => {
    const at = await window.SharedFileStore.loadSharedFileAt('model-drawing');
    const saved = JSON.parse(await at.file.text());
    return (saved.outlines || []).some(o => o.site);
  });
  expect(hasLot, 'the fixture must have no lot or this proves nothing').toBe(false);
  await expect(lotCard(page)).toHaveCount(0);
  // THE PAGE NO LONGER LOADS THE LOT TABLE AT ALL: nothing on this page asks
  // which lot a house fits on.
  expect(await page.evaluate(() => typeof window.DraftLotSizes)).toBe('undefined');
});
