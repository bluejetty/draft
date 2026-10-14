// THE OFFICE'S OWN LOGO, UPLOADED IN COMPANY STANDARDS.
//
// Movie, 14 Oct: "for the LOGO - i set it up temporary with te BLUEJETTY logo
// as an option for everyone, but it should only be for ME (my company)... I'd
// like to make a section at the top of COMPANY STANDARDS, where they can
// upload a logo which will be placed on the drawings (if they choose it)...
// (allow them to upload multiple logos for each COMPANY STANDARDS area", and
// "can we save all that information onto a file that users can reupload if the
// information gets reloaded and delted" / "(will contain their logos too".
//
// WHAT THIS FILE WATCHES is the seam between two pages that never talk: a logo
// is uploaded on STANDARDS and has to turn up in LAYOUT's TITLEBLOCK list,
// which it can only do through the standards package. Every check below goes
// the long way round -- upload on one page, then ask the OTHER page what it
// offers -- because a test that asked STANDARDS whether it had saved a logo
// would pass with the far end unwired.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';

// A 2x2 PNG. Small enough to read in a diff, real enough that the browser
// decodes it and `shrink` has something to draw: a file that failed to decode
// would make every check below pass for the wrong reason.
const PNG_2PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8z8DwnwEJMKFyaS'
  + 'EAAEWPAwjbWcWfAAAAAElFTkSuQmCC', 'base64');

const point = (x, z) => ({ x, y: 0, z });

// The same shape layout-titleblock.spec.js builds: four walls on FOUNDATION,
// enough for LAYOUT to have something to put on a sheet.
function houseDrawing() {
  const wall = (id, sx, sz, ex, ez) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId: 1, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  });
  return {
    format: 'draft-drawing', version: 1,
    levels: [{ id: 1, name: 'FOUNDATION', elev: 0 }],
    walls: [wall('w1', -12, -9, 12, -9), wall('w2', 12, -9, 12, 9),
      wall('w3', 12, 9, -12, 9), wall('w4', -12, 9, -12, -9)],
  };
}

const freshStorage = page => page.addInitScript(() => {
  if (sessionStorage.getItem('draft-test-storage-cleared')) return;
  sessionStorage.setItem('draft-test-storage-cleared', '1');
  indexedDB.deleteDatabase('pdf-img-mgr-shared');
  localStorage.clear();
});

async function openStandards(page) {
  await freshStorage(page);
  await page.goto('/STANDARDS.html');
  await expect(page.locator('[data-logo-file]')).toBeVisible();
}

// THE CROP DIALOG STANDS BETWEEN THE FILE AND THE LIST since 14 Oct (Movie:
// "can you offer them a CROP option"), so every upload here presses through
// it. What the crop itself does is tests/logo-crop.spec.js's question; this
// file only needs the logo to land.
async function addLogo(page, name = 'MY COMPANY.png') {
  const before = await page.locator('[data-logo-list] [data-logo-label]').count();
  await page.locator('[data-logo-file]').setInputFiles({
    name, mimeType: 'image/png', buffer: PNG_2PX,
  });
  await expect(page.locator('[data-crop-back]')).toBeVisible();
  await page.locator('[data-crop-use]').click();
  await expect(page.locator('[data-logo-list] [data-logo-label]')).toHaveCount(before + 1);
}

async function openLayoutWithHouse(page) {
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: houseDrawing() });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  // THE PICKER IS AN 11x17 FEATURE and 11x17 is the page's own default, so
  // nothing has to be pressed to reach it -- but the wait is not optional:
  // the list is built on the first render and every check below asks what is
  // in it.
  await expect(page.locator('[data-layout-mark]')).toBeVisible();
}

test('a logo uploaded in COMPANY STANDARDS joins the TITLEBLOCK list', async ({ page }) => {
  await openStandards(page);
  // NOTHING YET, and the page says so rather than showing an empty box.
  await expect(page.locator('[data-logo-list]')).toContainText('NONE YET');
  await addLogo(page, 'HARBOUR DRAFTING.png');

  // THE NAME IS A SLOT, NOT THE FILENAME (Movie, 14 Oct: "change its name to
  // COMPANY 01 (not LOGO)"). His own file was called logo.png, so the
  // TITLEBLOCK list read LOGO -- which says nothing about whose it is. The
  // field beside the row is where a real name goes.
  await expect(page.locator('[data-logo-list] [data-logo-label]'))
    .toHaveValue('COMPANY 01');

  await openLayoutWithHouse(page);
  // THE LOGO MENU, which is its own control since the frame/mark split (14
  // Oct): the uploaded mark joins the two that ship rather than replacing a
  // whole titleblock style.
  await expect(page.locator('[data-layout-mark] option'),
    'the uploaded logo never reached the LOGO menu')
    .toHaveText(['ROUGH DRAFTER', 'BLUEJETTY', 'COMPANY 01']);
});

test('picking it sticks, and the strip draws the uploaded mark', async ({ page }) => {
  await openStandards(page);
  await addLogo(page);
  await openLayoutWithHouse(page);

  const uploaded = await page.locator('[data-layout-mark] option').evaluateAll(
    options => options.map(option => option.value).find(value => value.startsWith('logo:')));
  expect(uploaded, 'the uploaded logo never reached the LOGO menu').toBeTruthy();
  await page.locator('[data-layout-mark]').selectOption(uploaded);
  await expect(page.locator('[data-layout-mark]')).toHaveValue(uploaded);

  // AND THE PAINTER GOT AN IMAGE FOR IT. `_logos` is keyed by style id and
  // filled from the same list the picker is built from; a logo offered with
  // no picture behind it is the failure this catches -- the strip would draw
  // its box and nothing in it.
  const image = await page.evaluate(id => {
    // `page` is LAYOUT's own component instance -- a top-level const in a
    // classic script, so it answers to its name here. The pictures are keyed
    // by MARK id now: one logo serves all twelve frames.
    const img = page._logos && page._logos[id];
    return img ? { complete: img.complete, data: img.src.startsWith('data:image/') } : null;
  }, uploaded);
  expect(image, 'the painter holds no image for the uploaded logo').not.toBeNull();
  expect(image.data, 'the loaded logo is not the uploaded data URL').toBe(true);
  expect(image.complete, 'the logo image never finished loading').toBe(true);
});

test('several logos can stand in one standard, and one can be taken off again',
  async ({ page }) => {
    // "allow them to upload multiple logos for each COMPANY STANDARDS area".
    await openStandards(page);
    await addLogo(page, 'FIRST.png');
    await addLogo(page, 'SECOND.png');
    await expect(page.locator('[data-logo-list] [data-logo-label]')).toHaveCount(2);

    await openLayoutWithHouse(page);
    await expect(page.locator('[data-layout-mark] option')).toHaveCount(4);

    // OFF AGAIN, and the picker loses it. A logo that could be added and not
    // removed is the one state a drafter cannot get out of.
    await page.goto('/STANDARDS.html');
    await expect(page.locator('[data-logo-list] [data-logo-label]')).toHaveCount(2);
    await page.locator('[data-logo-remove]').first().click();
    await expect(page.locator('[data-logo-list] [data-logo-label]')).toHaveCount(1);

    await openLayoutWithHouse(page);
    await expect(page.locator('[data-layout-mark] option')).toHaveText(
      ['ROUGH DRAFTER', 'BLUEJETTY', 'COMPANY 02']);
  });

test('the logo rides the standards file, there and back', async ({ page }) => {
  // "can we save all that information onto a file that users can reupload if
  // the information gets reloaded and delted ... (will contain their logos too
  // and all the infor they entered".
  //
  // THE FILE IS BUILT THE WAY THE BUTTON BUILDS IT and read back the way the
  // upload reads it, so what this proves is that a logo survives the round
  // trip -- not that two helpers in this spec agree.
  await openStandards(page);
  await addLogo(page, 'ROUND TRIP.png');
  const saved = await page.evaluate(() =>
    JSON.stringify(window.DraftProfileManager.getActive('standards')));
  expect(JSON.parse(saved).content.model.companyLogos, 'the logo is not in the package')
    .toHaveLength(1);

  // A BROWSER THAT LOST EVERYTHING, which is the case he described.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('[data-logo-list]')).toContainText('NONE YET');

  await page.locator('[data-upload-file]').setInputFiles({
    name: 'office.draft.standards', mimeType: 'application/json', buffer: Buffer.from(saved),
  });
  await expect(page.locator('[data-logo-list] [data-logo-label]')).toHaveValue('COMPANY 01');
  await openLayoutWithHouse(page);
  await expect(page.locator('[data-layout-mark] option'),
    'the restored logo never reached the LOGO menu').toHaveCount(3);
});

test('a file that is not an image is refused, and says so', async ({ page }) => {
  await openStandards(page);
  await page.locator('[data-logo-file]').setInputFiles({
    name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('this is not a png'),
  });
  // THE PAGE SAYS WHAT HAPPENED. A silent no-op on a file picker reads as a
  // broken button -- the drafter tries the same file three more times.
  await expect(page.locator('#status')).toHaveClass(/warning/);
  await expect(page.locator('[data-logo-list]')).toContainText('NONE YET');
});
