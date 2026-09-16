// THE BUILD BAR on MODEL.html — the house types, BONE, and the seam.
//
// Work order part 5. The shape is MODEL.dc.html's row — "three families
// between the turtle and the bone", each opening ONE submenu (Movie, 6 Sep) —
// and the data is the same data, lifted into build-menu.js so the two pages
// cannot disagree about what houses the office builds.
//
// THE SEAM IS THE POINT OF THE WHOLE ITEM. Devin: "the button says which type
// was chosen, something else decides what geometry that produces. If you find
// yourself deciding where a bedroom goes, you have crossed the seam." The
// drafter is moving to a premade design per house type in place of generated
// rooms, so anything wired to today's generator is built twice. The test that
// matters most here is the one asserting the bar draws NOTHING.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const REPRO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'repro-garage-house.draft'), 'utf8'));

async function openBar(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved: REPRO });
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  // THE TYPES MOVED ONTO THE SIGN (Movie, 15 Sep). Same chips, same data,
  // same seam -- they are tiles on the drive-thru board now instead of a row
  // on the foot, so the order starts by pulling up to the window.
  await h.openDriveThru(page);
}

const wallCount = page => page.evaluate(() => Number(
  /walls \d+\/(\d+)/.exec(document.getElementById('readout').textContent)[1]));

test('the families are the module\'s, not a copy of them', async ({ page }) => {
  await openBar(page);

  // ASSERTED AGAINST THE MODULE, not against a list written out here. A
  // hardcoded expectation would pass just as well if the bar held its own
  // copy of the data — which is the thing the lift out of MODEL.dc.html
  // existed to prevent, and how the level lookup came to have four homes.
  const fromModule = await page.evaluate(() =>
    window.DraftBuildMenu.BUILD_MENU.map(f => f.label));
  expect(await page.locator('#build-families button').allTextContents()).toEqual(fromModule);

  // And the submenu is that family's own entries, in its own order.
  await page.locator('[data-build-family="bungalow"]').click();
  await page.waitForTimeout(150);
  const entries = await page.evaluate(() =>
    window.DraftBuildMenu.familyById('bungalow').entries.map(e => e.label));
  expect(await page.locator('#build-entries button').allTextContents()).toEqual(entries);

  // ONE SUBMENU AT A TIME, which is Movie's "only 1 submenu each".
  await page.locator('[data-build-family="bilevel"]').click();
  await page.waitForTimeout(150);
  const bilevel = await page.evaluate(() =>
    window.DraftBuildMenu.familyById('bilevel').entries.map(e => e.label));
  expect(await page.locator('#build-entries button').allTextContents()).toEqual(bilevel);
});

test('THE SEAM: choosing a house draws nothing at all', async ({ page }) => {
  await openBar(page);
  const before = await wallCount(page);

  await page.locator('[data-build-family="bungalow"]').click();
  await page.waitForTimeout(120);
  await page.locator('[data-build-entry="twoStorey-garage"]').click();
  await page.waitForTimeout(200);

  // NOT ONE WALL. This is the assertion the whole item rests on: the bar
  // records a choice and produces no geometry, so the premade-design work
  // that replaces today's generator has something to attach to rather than
  // something to undo.
  expect(await wallCount(page), 'the build bar drew geometry — it crossed the seam')
    .toBe(before);

  // Pressing BONE draws nothing either. "The bone builds it" is the old
  // page's phrase, and here the bone only says so. BOTH BONES: the one on
  // the sign's post is the easy place to quietly wire a generator in, which
  // is why it is asserted rather than assumed.
  await page.locator('#dt-bone').click();
  await page.waitForTimeout(300);
  expect(await wallCount(page), 'the sign\'s BONE drew geometry')
    .toBe(before);

  // And the one on the foot, which is only reachable with the sign down --
  // the board covers it, deliberately.
  await page.locator('[data-drivethru-close]').click();
  await page.locator('#bone').click();
  await page.waitForTimeout(300);
  expect(await wallCount(page), 'BONE drew geometry — the generator is wired in')
    .toBe(before);
});

test('the seam hands over the entry, and BONE fires even with nothing picked',
  async ({ page }) => {
    await openBar(page);

    const seen = await page.evaluate(async () => {
      const log = [];
      window.ModelBuild.onChoose(p => log.push(`choose:${p?.entry?.id ?? 'null'}`));
      window.ModelBuild.onBuild(p => log.push(`build:${p?.entry?.id ?? 'null'}`));

      // The board is up from openBar and covers the foot's bone -- disabled
      // under it, deliberately -- so it is dropped before the bone is
      // pressed. The tiles stay wired either way.
      document.getElementById('dt-close').click();

      // BONE with nothing chosen this session: fires with null rather than
      // swallowing the press. What an empty press means is the geometry
      // side's call, so it has to be told the press happened.
      document.getElementById('bone').click();
      await new Promise(r => setTimeout(r, 80));

      document.querySelector('[data-build-family="bilevel"]').click();
      await new Promise(r => setTimeout(r, 80));
      document.querySelector('[data-build-entry="modifiedBilevel"]').click();
      await new Promise(r => setTimeout(r, 120));
      document.getElementById('bone').click();
      await new Promise(r => setTimeout(r, 80));
      return { log, chosen: window.ModelBuild.chosen()?.entry?.id ?? null };
    });

    expect(seen.log).toEqual([
      'build:null', 'choose:modifiedBilevel', 'build:modifiedBilevel',
    ]);
    expect(seen.chosen).toBe('modifiedBilevel');
  });

test('the chosen type reaches the file, and the garage does not', async ({ page }) => {
  await openBar(page);

  await page.locator('[data-build-family="bungalow"]').click();
  await page.waitForTimeout(120);
  await page.locator('[data-build-entry="twoStorey-garage"]').click();
  await page.waitForTimeout(200);

  // The type is an edit, so the page says so before anything is written.
  await expect(page.locator('[data-model-save]')).toHaveText(/unsaved/i);
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });

  const saved = await page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, BUCKET);

  // `type` is the persisted vocabulary and the only thing on the entry that
  // reaches the file. 2 STOREY + GARAGE stores twoStorey: build-menu.js says
  // why in Movie's words — a garage is an outline carrying garage:true, so
  // storing the word would put a claim in the file its own geometry could
  // contradict.
  expect(saved.buildType).toBe('twoStorey');
  expect(Object.keys(saved), 'the entry\'s garage flag must not become a key')
    .not.toContain('garage');
  expect(Object.keys(saved)).not.toContain('overGarage');
});

test('a detached-garage entry stores no type, because it says nothing about the house',
  async ({ page }) => {
    await openBar(page);

    await page.locator('[data-build-family="detachedGarage"]').click();
    await page.waitForTimeout(120);
    await page.locator('[data-build-entry="detached-frostwall"]').click();
    await page.waitForTimeout(200);

    // build-menu.js, carried across from the old page: "No `type`: a detached
    // garage says nothing about what house it stands beside, and may stand
    // beside none." So the press is a real choice the seam hears about, and
    // the file learns nothing from it.
    const chosen = await page.evaluate(() => window.ModelBuild.chosen()?.entry);
    expect(chosen.id).toBe('detached-frostwall');
    expect(chosen.foundation).toBe('frostwall');
    expect(chosen.type).toBeUndefined();
    await expect(page.locator('[data-model-save]'),
      'a detached garage choice wrote a build type').not.toHaveText(/unsaved/i);
  });
