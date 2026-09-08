// THE WRITE TIER'S PROOF. MODEL.html can save now, and this spec is the
// acceptance test the tier plan named: a save through the new page must equal
// the save the old page wrote, key for key, under deep comparison.
//
// The new page's save is load → normalise → store: it re-emits what it
// loaded through the same drawing-format rules the old page saves through,
// and edits nothing. So "equal" here is not approximately-equal or
// same-count — it is toEqual on the whole parsed drawing, every one of the
// 65 persisted keys plus the layout/specs passthroughs, because any key the
// round trip loses is work a drafter loses the moment this page becomes a
// door they save through.
//
// THE FIXTURE IS A REAL HOUSE, NOT A HANDMADE OBJECT. The bone builds it on
// the old page exactly as a first-time user does, which is what makes the
// comparison honest: bone-built walls carry srcId/offX/offZ source links,
// the drawing carries floors, roofs, stairs, dims, fenestrations — the
// fields a synthetic fixture forgets are exactly the ones a save silently
// drops. The spec asserts the fixture's reach before trusting it.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const readout = page => page.locator('#readout');
const saveButton = page => page.locator('#save');

// The bone house, plus the two conditional passthroughs injected the way
// their owning pages write them — LAYOUT's sheet key and SPECS' project
// sections. Without them the passthrough half of the comparison would be
// vacuously green: a drawing with no layout key cannot lose one.
async function houseWithPassthroughs(page) {
  await h.openModel(page, { webgl: false, rails: false, entryCoach: true });
  await expect(page.locator('[data-entry-coach]')).toBeVisible({ timeout: 4000 });
  await page.locator('[data-first-bone-press]').click();
  await h.waitForSaved(page);
  const saved = await h.savedDrawing(page);

  const levelId = saved.levels[0].id;
  await page.evaluate(async ({ bucket, levelId }) => {
    const store = window.SharedFileStore;
    const at = await store.loadSharedFileAt(bucket);
    const drawing = JSON.parse(await at.file.text());
    drawing.layout = {
      paperKey: '11x17', orientation: 'landscape', titleblock: 'bluejetty-band',
      northArrow: false, auto: true, nextViewportId: 2,
      viewports: [{ id: 1, kind: 'plan', pif: 1 / 8, xIn: 4, yIn: 3, sheet: 1, levelId }],
    };
    drawing.specs = { sections: [{ id: 'off-1', division: 6, off: true }] };
    const file = new File([JSON.stringify(drawing)], 'model-drawing.json',
      { type: 'application/json' });
    await store.saveSharedFile(file, bucket, { ifRev: at.rev });
  }, { bucket: h.STORAGE_BUCKET, levelId });

  return page.evaluate(async bucket => {
    const store = window.SharedFileStore;
    const at = await store.loadSharedFileAt(bucket);
    return { drawing: JSON.parse(await at.file.text()), rev: at.rev };
  }, h.STORAGE_BUCKET);
}

test.describe('MODEL.html write tier', () => {
  test('a save through the new page equals the save the old page wrote, key for key', async ({ page }) => {
    const before = await houseWithPassthroughs(page);
    const legacy = before.drawing;

    // THE FIXTURE'S REACH, ASSERTED BEFORE IT IS TRUSTED. Each of these is a
    // field the round trip could lose silently; a fixture without them
    // proves nothing about them.
    expect(legacy.walls.length).toBeGreaterThan(0);
    expect(legacy.walls.some(w => w.start.srcId || w.end.srcId),
      'no wall carries a source link, so the srcId path is untested').toBe(true);
    expect((legacy.lines || []).length,
      'no lines, so layer preservation is untested').toBeGreaterThan(0);
    expect(legacy.lines.some(l => l.layer !== 'draft'),
      'every line is on draft, so a save that flattens layers would pass').toBe(true);
    expect((legacy.floors || []).length).toBeGreaterThan(0);
    expect((legacy.roofs || []).length).toBeGreaterThan(0);
    expect((legacy.dimensions || []).length).toBeGreaterThan(0);
    expect(legacy.layout, 'the LAYOUT passthrough is missing from the fixture').toBeTruthy();
    expect(legacy.specs, 'the SPECS passthrough is missing from the fixture').toBeTruthy();

    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 5000 });
    await expect(saveButton(page)).toHaveClass(/show/);

    await saveButton(page).click();
    await expect(saveButton(page)).toHaveText('SAVED', { timeout: 5000 });

    // THE CONTROL. Asserting the end state proves nothing unless the save
    // ran — persisted-format.spec.js learned that by mutation. The store's
    // revision counter only moves on a real write, so this is the proof the
    // comparison below is comparing a NEW save and not reading back the
    // legacy file untouched.
    const after = await page.evaluate(async bucket => {
      const store = window.SharedFileStore;
      const at = await store.loadSharedFileAt(bucket);
      return { drawing: JSON.parse(await at.file.text()), rev: at.rev };
    }, h.STORAGE_BUCKET);
    expect(after.rev, 'the new page never wrote the bucket').toBeGreaterThan(before.rev);

    // The tier's acceptance line: every key equal, deep.
    expect(after.drawing).toEqual(legacy);
  });

  test('a stale save is refused, and the other page\'s write survives untouched', async ({ page }) => {
    await houseWithPassthroughs(page);

    await page.goto('/MODEL.html');
    await expect(readout(page)).toContainText('walls', { timeout: 5000 });

    // Another page saves AFTER this one loaded — the exact race the ifRev
    // guard exists for. The intruding write marks itself so the assertion
    // below can tell whose bytes are in the bucket.
    const intruded = await page.evaluate(async bucket => {
      const store = window.SharedFileStore;
      const at = await store.loadSharedFileAt(bucket);
      const drawing = JSON.parse(await at.file.text());
      drawing.projectName = 'THE OTHER PAGE GOT HERE FIRST';
      const file = new File([JSON.stringify(drawing)], 'model-drawing.json',
        { type: 'application/json' });
      const rev = await store.saveSharedFile(file, bucket, { ifRev: at.rev });
      return rev;
    }, h.STORAGE_BUCKET);

    await saveButton(page).click();

    // Refused, and SAID so — a guard that fails silently is the audit rule's
    // first shape. The button goes back to SAVE, not SAVED.
    await expect(page.locator('#notice')).toHaveClass(/show/, { timeout: 5000 });
    await expect(page.locator('#notice')).toContainText('changed underneath');
    await expect(saveButton(page)).toHaveText('SAVE');

    // And the store still holds the other page's work: same revision, same
    // marker. Nothing was written on top of it.
    const after = await page.evaluate(async bucket => {
      const store = window.SharedFileStore;
      const at = await store.loadSharedFileAt(bucket);
      return { drawing: JSON.parse(await at.file.text()), rev: at.rev };
    }, h.STORAGE_BUCKET);
    expect(after.rev).toBe(intruded);
    expect(after.drawing.projectName).toBe('THE OTHER PAGE GOT HERE FIRST');
  });
});
