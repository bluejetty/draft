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
  //
  // AND SINCE 24 SEP THAT PRESS IS ANSWERED, WHICH IS WORTH BEING HONEST
  // ABOUT. twoStorey-garage HAS a premade design, and the fixture already
  // holds a house, so this press is exactly what ONE BUILDING PER DRAFT FILE
  // is for: it offers to save this drawing and open a clean one.
  //
  // WHICH MEANS "NOTHING WAS DRAWN" HAS ALWAYS RESTED ON THE CAP HERE, not
  // on the seam. Before the rule changed, the same press met "YOU'VE GOT A
  // HOUSE ALREADY" and drew nothing for that reason; the count below was
  // reading a refusal and reporting a seam. Declining the offer is the same
  // sentence in the new grammar, and it is spelled out rather than left for
  // the next reader to discover the way this change did.
  await page.locator('#dt-bone').click();
  await expect(page.locator('#file-guard'),
    'the press was met by neither a build nor an offer').toBeVisible();
  await page.locator('[data-guard-cancel]').click();
  await expect(page.locator('#file-guard')).toBeHidden();
  await page.waitForTimeout(300);
  expect(await wallCount(page), 'the sign\'s BONE drew geometry')
    .toBe(before);

  // And the one on the foot, which is only reachable with the sign down --
  // the board covers it, deliberately.
  //
  // THE BOARD IS ALREADY DOWN, and this used to press CLOSE to put it there.
  // A house order now takes the sign with it: the bone hands the drafter the
  // armed outline trace and gets out of the way, so CLOSE is no longer on the
  // page to press and the click sat there until the test timed out. The
  // assertion this test exists for is untouched -- handing over a trace draws
  // no geometry, which is exactly what the count below still says.
  // Asked by VISIBILITY, not by count: a shut sign keeps its CLOSE button in
  // the document and merely hides it, so a count check finds one and then
  // waits three minutes for something that is never going to be clickable.
  const close = page.locator('[data-drivethru-close]');
  if (await close.isVisible()) await close.click();
  await page.locator('#bone').click();
  await page.waitForTimeout(300);
  expect(await wallCount(page), 'BONE drew geometry — the generator is wired in')
    .toBe(before);
});

// THE BONE NO LONGER FIRES THE BUILD SEAM ON A PRESS OF ITS OWN. Movie
// ruled it 19 Sep: "on 1st press go to drivethru questions and on 2nd always
// offer choice between drivetrhu or house build". So the press that used to
// hand the geometry side a null order now opens the board, and the press
// that used to hand it the chosen entry now offers the card -- whose BUILD
// is what reaches the seam.
//
// WHAT THIS TEST IS ABOUT DID NOT CHANGE: the TILES hand over the entry, and
// the bone is never silent. Only where the build seam is fired from moved.
test('the seam hands over the entry, and the bone answers an empty press',
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

      // BONE WITH NOTHING CHOSEN: the board, not the seam. It used to fire
      // build:null and open the board only when that served nothing; a press
      // that cannot build should not be asking the geometry side whether it
      // can.
      document.getElementById('bone').click();
      await new Promise(r => setTimeout(r, 80));
      const afterEmpty = log.slice();

      document.querySelector('[data-build-family="bilevel"]').click();
      await new Promise(r => setTimeout(r, 80));
      document.querySelector('[data-build-entry="modifiedBilevel"]').click();
      await new Promise(r => setTimeout(r, 120));
      // The tile press ARMS THE TRACE and shuts nothing, so the board may be
      // back up; drop it, or the next press is the window's build verb.
      document.getElementById('dt-close').click();
      await new Promise(r => setTimeout(r, 80));

      // AND THE SECOND PRESS ASKS. The card's BUILD is what fires the seam.
      document.getElementById('bone').click();
      await new Promise(r => setTimeout(r, 120));
      const cardUp = !document.getElementById('build-choice').hidden;
      const named = document.querySelector('[data-build-choice-house]').textContent;
      document.querySelector('[data-build-choice-build]').click();
      await new Promise(r => setTimeout(r, 120));
      return { log, afterEmpty, cardUp, named,
        chosen: window.ModelBuild.chosen()?.entry?.id ?? null };
    });

    expect(seen.afterEmpty,
      'the empty press reached the build seam instead of opening the board')
      .toEqual([]);
    expect(seen.cardUp, 'the second press did not offer the choice').toBe(true);
    expect(seen.named, 'the card did not name the house it would build')
      .toBe('MODIFIED BILEVEL');
    expect(seen.log).toEqual([
      'choose:modifiedBilevel', 'build:modifiedBilevel',
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
