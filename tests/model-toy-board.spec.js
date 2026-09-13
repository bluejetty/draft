// THE BOARD BELONGS TO THE DRAWING, not to the browser.
//
// Work order: GILLIGAN-TOY-BONES-WORKORDER §7 and §8, acceptance #11 and #12.
//
// WHY THIS MOVED. MODEL.html kept `board` in the skin key in localStorage —
// per browser, not per file. §7 rules against that in as many words: "the same
// drafter meets it on every file while a second drafter never sees it at all".
// And acceptance #11 asks that "a promoted drawing" reload as DRAFTING, which
// is a fact about ONE FILE and unanswerable from a per-browser flag: promote
// one drawing and every other drawing on that machine would open promoted too.
//
// THE FORMAT LEARNED THE KEY rather than the save being taught to smuggle it,
// because acceptance #12 says "nothing here adds a board-shaped field an older
// page would drop". A key the format normalises and re-emits round-trips; one
// hung off the save does not.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const base = extra => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }],
  activeLevelIdx: 0,
  walls: [{ id: 'w', start: V(-6, 0), end: V(6, 0), levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' }],
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [],
  groups: [], levelLocks: [], underlays: [],
  ...extra,
});

async function open(page, file) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json',
        { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: file });
  await page.goto('/MODEL.html');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}

const boardOf = page => page.evaluate(() => document.body.getAttribute('data-board'));
const stored = page => page.evaluate(async bucket => {
  const f = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await f.text());
}, BUCKET);

test('a drawing that records DRAFTING opens on DRAFTING', async ({ page }) => {
  await open(page, base({ board: 'drafting' }));
  expect(await boardOf(page)).toBe('drafting');
});

test('a drawing that records TOY opens on TOY', async ({ page }) => {
  // Both directions, or "always drafting" would satisfy the check above.
  await open(page, base({ board: 'toy' }));
  expect(await boardOf(page)).toBe('toy');
});

test('a drawing that never chose one opens on the default', async ({ page }) => {
  // An older file has no board. The format says null — it does not invent a
  // choice nobody made — and the page supplies its own default.
  await open(page, base({}));
  expect(await boardOf(page)).toBe('toy');
});

test('switching the board writes it to the drawing and survives reload',
  async ({ page }) => {
    await open(page, base({ board: 'toy' }));
    expect(await boardOf(page)).toBe('toy');

    await page.locator('[data-board="drafting"]').click();
    await page.waitForTimeout(80);
    expect(await boardOf(page)).toBe('drafting');

    // IT IS IN THE FILE, not only on the body. A switch that changed the
    // attribute and nothing else would pass every assertion above.
    await page.locator('#save').click();
    await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
    expect((await stored(page)).board).toBe('drafting');

    await page.reload();
    await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
    expect(await boardOf(page), 'acceptance #11').toBe('drafting');
  });

test('the board round-trips, and a file that never had one still does not',
  async ({ page }) => {
    // ACCEPTANCE #12, both halves. A page may show less than the file
    // contains; it may not save less.
    await open(page, base({ board: 'drafting' }));
    await page.locator('#save').click();
    await expect(page.locator('#save')).toHaveText('SAVED', { timeout: 6000 });
    expect((await stored(page)).board,
      'a recorded board comes back out').toBe('drafting');

    await open(page, base({}));
    await page.locator('[data-draw-wall]').click();   // make it dirty honestly
    await page.locator('[data-draw-wall]').click();
    await page.locator('#save').click();
    await page.waitForTimeout(400);
    const after = await stored(page);
    expect(after.board ?? null,
      'a file that never chose is not given a choice by being opened')
      .toBe(null);
  });

test('a junk board in the file does not reach the switch', async ({ page }) => {
  // The load normalises rather than spreading `...parsed` through. Without
  // that the switch would hold a value BOARDS does not contain, and the
  // markSwitch would light nothing while data-board said "banana".
  await open(page, base({ board: 'banana' }));
  expect(await boardOf(page)).toBe('toy');
  expect(['toy', 'drafting']).toContain(await boardOf(page));
});
