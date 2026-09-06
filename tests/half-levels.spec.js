// THE HALF-LEVELS — ENTRY and OVER GARAGE, the levels a bilevel needs and no
// other house does (RD-DOCUMENTS/ORDER-inbetween-levels.md, Movie 6 Sep).
//
// They sit half a storey off the floors around them, which is too far for a
// ceiling to absorb, so they are LEVELS rather than cards. The numbering left
// room on purpose — floors odd, these even — and PROJECT.html has hardcoded
// ENTRY_LEVEL_ID = 2 all along.
//
// THE RULE THESE SPECS EXIST TO PROTECT: a slot that has not been added IS NOT
// A RECORD. It has no id, no elevation and no row in the file, so a drawing
// saved with the row on screen is identical to one saved without it. That is
// what lets this land beside the Write Tier, whose whole acceptance is a
// deep-compare between two serializers — and it is the first thing that would
// quietly stop being true if a slot ever started writing itself down.
//
// THE SECOND RULE, and it is the safety of the whole design: the build type
// gates what can be ADDED, never what can be SEEN. A half-level someone has
// drawn on stays on the panel whatever lamp is lit. Hiding it would be the
// id-9 failure in reverse — geometry in the drawing that its own panel will
// not show.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const levelNames = page => page.$$eval('.level-row .level-name', els =>
  els.map(el => el.textContent.trim()).filter(name => name !== 'BONEYARD'));

const addButtons = page => page.$$eval('[data-add-half-level]', els =>
  els.map(el => el.getAttribute('data-add-half-level')));

test.describe('The half-level slots', () => {
  test('the build type decides which slots the panel offers', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await h.openRails(page);

    // A drawing with no type chosen offers nothing: buildType is null for every
    // file older than the key and for anyone who skipped the build row.
    expect(await levelNames(page)).toEqual(['SITE', 'ROOF', '2ND FL', 'MAIN FL', 'FOUNDATION']);
    expect(await addButtons(page)).toEqual([]);

    // A BUNGALOW has neither. Its garage ceiling is raised until the deck runs
    // continuous with the floor over the main area, so a storey over the garage
    // is the ordinary upper floor reaching across — one level, one roof.
    await h.pickBuild(page, 'bungalow');
    expect(await levelNames(page)).toEqual(['SITE', 'ROOF', '2ND FL', 'MAIN FL', 'FOUNDATION']);
    expect(await addButtons(page)).toEqual([]);

    // A BILEVEL has an ENTRY, and it sits between MAIN FL and FOUNDATION.
    await h.pickBuild(page, 'bilevel');
    expect(await levelNames(page)).toEqual(['SITE', 'ROOF', '2ND FL', 'MAIN FL', 'ENTRY', 'FOUNDATION']);
    expect(await addButtons(page)).toEqual(['2']);

    // MODIFIED BILEVEL is the one with the storey over the garage — that is
    // what the .5 counts — so it gets both, OVER GARAGE between 2ND and MAIN.
    await h.pickBuild(page, 'modifiedBilevel');
    expect(await levelNames(page)).toEqual([
      'SITE', 'ROOF', '2ND FL', 'OVER GARAGE', 'MAIN FL', 'ENTRY', 'FOUNDATION',
    ]);
    expect(await addButtons(page)).toEqual(['4', '2']);
  });

  test('an offered slot is not in the drawing until ADD is pressed', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await h.openRails(page);

    await h.pickBuild(page, 'modifiedBilevel');
    await h.waitForSaved(page);

    // Both rows are on screen. THE FILE HAS NEITHER.
    expect(await addButtons(page)).toEqual(['4', '2']);
    const before = await h.savedDrawing(page);
    expect(before.levels.map(level => level.id)).not.toContain(2);
    expect(before.levels.map(level => level.id)).not.toContain(4);

    // And the same for the rest of it: a slot on screen changes nothing a
    // serializer can see. Compared whole rather than key by key, because the
    // claim is that NOTHING moved, and naming the keys would only prove the
    // ones that were named.
    await h.pickBuild(page, 'bilevel');
    await h.waitForSaved(page);
    const after = await h.savedDrawing(page);
    expect(JSON.stringify(after.levels)).toBe(JSON.stringify(before.levels));
  });

  test('ADD puts the level at its own fixed id, halfway between its neighbours', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await h.openRails(page);
    await h.pickBuild(page, 'bilevel');

    const before = await h.savedDrawing(page);
    const main = before.levels.find(level => level.name === 'MAIN FL');
    const foundation = before.levels.find(level => level.name === 'FOUNDATION');

    await page.locator('[data-add-half-level="2"]').click();
    await h.waitForSaved(page);

    const saved = await h.savedDrawing(page);
    const entry = saved.levels.find(level => level.id === 2);
    expect(entry).toBeTruthy();
    expect(entry.name).toBe('ENTRY');

    // ID 2 IS A CONSTANT, NOT THE COUNTER. _addLevel hands out nextLevelId,
    // which starts at 9 — so a drafter who typed ENTRY into it would get a
    // level PROJECT.html cannot find and a stair would sort past. Pressing ADD
    // must not consume a counter value either: the counter belongs to floors
    // added on top.
    expect(saved.nextLevelId).toBe(before.nextLevelId);

    // Halfway between the floors either side, which is what "half-level" means
    // and needs nothing invented — both neighbours are real levels.
    expect(entry.elev).toBeCloseTo((main.elev + foundation.elev) / 2, 4);

    // The row stops being a slot once it is a level: no ADD left on it.
    expect(await addButtons(page)).toEqual([]);
    expect(await levelNames(page)).toEqual(['SITE', 'ROOF', '2ND FL', 'MAIN FL', 'ENTRY', 'FOUNDATION']);
  });

  test('the gate hides SLOTS, never LEVELS', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await h.openRails(page);

    await h.pickBuild(page, 'bilevel');
    await page.locator('[data-add-half-level="2"]').click();
    await h.waitForSaved(page);
    expect(await levelNames(page)).toContain('ENTRY');

    // Now say the house is a bungalow. A bungalow offers no ENTRY slot — but
    // this ENTRY is a LEVEL, in the file, and a drafter may have drawn on it.
    // Hiding it would leave geometry its own panel will not show.
    await h.pickBuild(page, 'bungalow');
    expect(await levelNames(page)).toContain('ENTRY');
    expect(await addButtons(page)).toEqual([]);
    expect((await h.savedDrawing(page)).levels.map(level => level.id)).toContain(2);
  });

  test('a slot row is not a level: it carries no delete and cannot be switched to', async ({ page }) => {
    await h.openModel(page, { webgl: false });
    await h.openRails(page);
    await h.pickBuild(page, 'modifiedBilevel');

    // Five real levels have a delete; the two slots do not, because there is
    // nothing there to delete.
    await expect(page.locator('.level-row .level-del')).toHaveCount(5);
    await expect(page.locator('.level-slot')).toHaveCount(2);
    await expect(page.locator('.level-slot .level-del')).toHaveCount(0);
  });
});
