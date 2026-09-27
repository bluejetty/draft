// THE ROOF AREA on EXT. FINISH — what a roof wears, and how its gable ends.
//
// Movie, 27 Sep: *"we should make a special ROOF area with the roof corners in
// there and the ROOFING TYPE"*, then, asked where it goes: *"over where the
// ROOF CORNERS are for now (might change it later) in the 'EXT FINISH' tab"*.
//
// WHAT IS WORTH TESTING HERE is not that two dropdowns rendered. The rail
// writes through a normaliser that DROPS both new keys unless the page hands
// it the two vocabularies, and this page has already been bitten by exactly
// that once -- the finishes came up blank because the wall normaliser was not
// told the finish ids. A rail that looks right and saves nothing is the
// failure this file exists to catch, so the claims are:
//
//   THE PICK REACHES A ROOF          the list is the drawing's roofs
//   THE CHOICE IS STORED             it survives a reload, not just a repaint
//   THE DEFAULT IS STORED AS NOTHING a roof in asphalt carries no key
//   THE CORNER FOLLOWS THE OFFICE    until it is set, and then it does not
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

async function openPage(page) {
  await h.suppressEntryCoach(page);
  await page.goto('/EXTFINISH.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/EXTFINISH.html');
  await expect(page.locator('#roof-list [data-roof]').first()).toBeVisible({ timeout: 10000 });
}

// WHAT THE STORE HOLDS, which is the only thing that outlives the page. Read
// back through the store rather than off the page's own state, because the
// page's state is what looks right in the failure this file is about.
const storedRoofs = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  const saved = JSON.parse(await file.text());
  return (saved.roofs || []).map(r => ({ id: String(r.id),
    roofing: r.roofing ?? null, gableCorner: r.gableCorner ?? null }));
}, BUCKET);

test('the roof area lists the drawing\'s roofs, and a pick opens its two choices',
  async ({ page }) => {
    await openPage(page);
    const roofs = page.locator('#roof-list [data-roof]');
    // THE FIXTURE'S OWN REACH FIRST: a house with no roofs passes every claim
    // below while proving nothing.
    const n = await roofs.count();
    expect(n, 'the garage house has roofs to pick from').toBeGreaterThan(0);
    await expect(page.locator('#roof-props')).toBeHidden();
    await roofs.first().click();
    await expect(page.locator('#roof-props')).toBeVisible();
    // THE WHOLE TABLE IS OFFERED -- ten materials, which is the answer Movie
    // gave when asked which of them to carry.
    await expect(page.locator('#roofing option')).toHaveCount(10);
    // AND THE CORNER OFFERS FOUR PLUS "follows the office", which is five
    // options for four styles: the fifth is the absence, and it has to be
    // reachable or per-roof control has no off switch.
    await expect(page.locator('#gable-corner option')).toHaveCount(5);
    await expect(page.locator('#gable-corner option').first()).toHaveText(/Office/);
  });

test('what a roof wears is written to the drawing, not just to the screen',
  async ({ page }) => {
    await openPage(page);
    await page.locator('#roof-list [data-roof]').first().click();
    const id = await page.locator('#roof-list [data-roof]').first().getAttribute('data-roof');

    // ASPHALT IS STORED AS NOTHING, which is the record's rule: a roof wearing
    // the default carries no key, so opening an old drawing is not a migration.
    let before = await storedRoofs(page);
    expect(before.find(r => r.id === id).roofing,
      'a roof nobody has touched carries no roofing key').toBeNull();

    await page.locator('#roofing').selectOption('concrete_tile');
    await expect(page.locator('#roof-weight')).toContainText('psf');
    await page.waitForFunction(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return JSON.stringify(JSON.parse(await file.text()).roofs || []).includes('concrete_tile');
    }, BUCKET, { timeout: 5000 });

    // AND IT IS STILL THERE AFTER A RELOAD, which is the claim that separates
    // "the rail works" from "the rail appears to work".
    await page.reload();
    await expect(page.locator('#roof-list [data-roof]').first()).toBeVisible();
    const after = await storedRoofs(page);
    expect(after.find(r => r.id === id).roofing).toBe('concrete_tile');

    // THE HEAVY WARNING IS SAID OUT LOUD where the choice is made: concrete
    // tile is four times asphalt, which is a truss somebody designs.
    await page.locator('#roof-list [data-roof]').first().click();
    await expect(page.locator('#roof-weight')).toContainText('heavy');

    // AND BACK TO THE DEFAULT REMOVES THE KEY rather than storing the word.
    await page.locator('#roofing').selectOption('asphalt');
    await page.waitForFunction(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return !JSON.stringify(JSON.parse(await file.text()).roofs || []).includes('roofing');
    }, BUCKET, { timeout: 5000 });
    before = await storedRoofs(page);
    expect(before.find(r => r.id === id).roofing,
      'a roof put back to asphalt carries no key again').toBeNull();
  });

test('a roof follows the office corner until it is given one of its own',
  async ({ page }) => {
    await openPage(page);
    await page.locator('#roof-list [data-roof]').first().click();
    const id = await page.locator('#roof-list [data-roof]').first().getAttribute('data-roof');

    // FOLLOWING IS AN ABSENCE, not a copy of what the office says today --
    // which is the whole of what "allow them to change each iduvidually"
    // needs, since a copy would stop moving when STANDARDS moves.
    expect((await storedRoofs(page)).find(r => r.id === id).gableCorner).toBeNull();
    await expect(page.locator('#gable-corner')).toHaveValue('');

    await page.locator('#gable-corner').selectOption('porkchop');
    await page.waitForFunction(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return JSON.stringify(JSON.parse(await file.text()).roofs || []).includes('porkchop');
    }, BUCKET, { timeout: 5000 });
    await page.reload();
    await expect(page.locator('#roof-list [data-roof]').first()).toBeVisible();
    expect((await storedRoofs(page)).find(r => r.id === id).gableCorner).toBe('porkchop');

    // AND ONE ROOF ONLY. "don't worry about changing all" -- so the other
    // roofs on the house are untouched, which a rail wired to the office
    // standard by mistake would fail.
    const others = (await storedRoofs(page)).filter(r => r.id !== id);
    expect(others.length, 'the house has more than one roof to leave alone')
      .toBeGreaterThan(0);
    expect(others.every(r => r.gableCorner === null),
      'no other roof was changed').toBe(true);

    // BACK TO THE OFFICE removes the key, so it starts following again.
    await page.locator('#roof-list [data-roof]').first().click();
    await page.locator('#gable-corner').selectOption('');
    await page.waitForFunction(async bucket => {
      const file = await window.SharedFileStore.loadSharedFile(bucket);
      return !JSON.stringify(JSON.parse(await file.text()).roofs || []).includes('porkchop');
    }, BUCKET, { timeout: 5000 });
    expect((await storedRoofs(page)).find(r => r.id === id).gableCorner).toBeNull();
  });
