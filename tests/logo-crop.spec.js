// CROPPING A LOGO, AGAINST THE TITLEBLOCK IT IS GOING INTO.
//
// Movie, 14 Oct, looking at his own first upload on the live sheet: "for LOGO
// when they upload can you offer them a CROP option and show them what it will
// look like in the current TB selection", then "the one i uploaded had too much
// boarder", then "change its name to COMPANY 01 (not LOGO) (and allow others to
// have 02 03 04 etc", then "allow them to remane COMPANY 01 if they would like
// by clicking one it once they upload a logo, next one will still be named
// COMPANY 02 etc".
//
// THE BORDER IS THE WHOLE POINT. The strip scales the WHOLE FILE into the
// mark's cell, so a letterhead PNG's margin takes the cell and the mark comes
// out small with air around it. Every fixture here is a small square of ink
// inside a large field of background, which is that file.
const { test, expect } = require('@playwright/test');

// A PICTURE MADE BY THE BROWSER, because a hand-rolled PNG in this file would
// be a second encoder to get wrong. The page draws it, hands back a data URL,
// and the test turns that into the file the input is given.
async function pictureFile(page, { w = 200, h = 120, ink = { x: 80, y: 50, w: 40, h: 20 }, bg = 'transparent' } = {}) {
  const url = await page.evaluate(({ w, h, ink, bg }) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (bg !== 'transparent') { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
    ctx.fillStyle = '#1d1f20';
    ctx.fillRect(ink.x, ink.y, ink.w, ink.h);
    return c.toDataURL('image/png');
  }, { w, h, ink, bg });
  return { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(url.split(',')[1], 'base64') };
}

const openStandards = async page => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/STANDARDS.html');
  await expect(page.locator('[data-logo-file]')).toBeVisible();
};

const cropRect = page => page.evaluate(() => {
  const note = document.querySelector('[data-crop-note]').textContent;
  const m = /(\d+)\s*×\s*(\d+)/.exec(note);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
});

test('the crop opens on the artwork, not on the file — the border is already off',
  async ({ page }) => {
    await openStandards(page);
    // 200 x 120 of nothing with a 40 x 20 mark in the middle of it: the exact
    // shape of the complaint.
    await page.locator('[data-logo-file]').setInputFiles(await pictureFile(page));
    await expect(page.locator('[data-crop-back]')).toBeVisible();
    // TRIMMED ALREADY, with no press: cropping is what he asked for, so it is
    // the state the dialog opens in rather than a button he has to find.
    expect(await cropRect(page), 'the crop opened on the whole file, border and all')
      .toEqual({ w: 40, h: 20 });

    // AND THE WHOLE FILE IS ONE PRESS AWAY, for a mark that wants its margin.
    await page.locator('[data-crop-all]').click();
    expect(await cropRect(page)).toEqual({ w: 200, h: 120 });
    await page.locator('[data-crop-trim]').click();
    expect(await cropRect(page)).toEqual({ w: 40, h: 20 });
  });

test('a picture that bleeds to its edge is left whole', async ({ page }) => {
  await openStandards(page);
  // THE CORNERS DISAGREE, so there is no border to find and nothing is taken
  // off. Guessing here would eat the edge of a mark that fills its own file.
  const url = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 60; c.height = 40;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1d1f20'; ctx.fillRect(0, 0, 60, 40);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 30, 20);
    return c.toDataURL('image/png');
  });
  await page.locator('[data-logo-file]').setInputFiles({
    name: 'full.png', mimeType: 'image/png', buffer: Buffer.from(url.split(',')[1], 'base64'),
  });
  await expect(page.locator('[data-crop-back]')).toBeVisible();
  expect(await cropRect(page), 'a full-bleed mark was cropped anyway').toEqual({ w: 60, h: 40 });
});

test('the preview is the real titleblock, and it follows the crop', async ({ page }) => {
  await openStandards(page);
  await page.locator('[data-logo-file]').setInputFiles(await pictureFile(page));
  await expect(page.locator('[data-crop-back]')).toBeVisible();

  // INK ON BOTH PREVIEWS. They are painted by DraftTitleblock.draw, the same
  // call the sheet makes -- so an empty canvas here means the painter was
  // handed something it could not read, which is exactly what happened before
  // it learned to take a canvas as well as an <img>.
  const darkness = () => page.evaluate(() => {
    const count = sel => {
      const c = document.querySelector(sel);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n += 1;
      return n;
    };
    return { cell: count('[data-crop-cell]'), whole: count('[data-crop-whole]') };
  });
  const trimmed = await darkness();
  expect(trimmed.cell, 'the mark cell preview is blank').toBeGreaterThan(0);
  expect(trimmed.whole, 'the whole-titleblock preview is blank').toBeGreaterThan(0);

  // THE CROP CHANGES WHAT IS PREVIEWED. With the border back on, the same mark
  // is scaled into the same cell with its margin, so it covers LESS of the
  // cell -- which is the thing he was looking at when he said "too much
  // boarder", measured.
  await page.locator('[data-crop-all]').click();
  const whole = await darkness();
  expect(whole.cell, 'the border made no difference to the mark in its cell')
    .toBeLessThan(trimmed.cell);
});

test('it previews in the titleblock that is actually current', async ({ page }) => {
  // "show them what it will look like in the current TB selection". The frame
  // is picked in Construction Layout and the dialog reads it -- it does not
  // offer the choice a second time, which would be a second control on
  // somebody else's answer.
  await openStandards(page);
  await page.locator('[data-logo-file]').setInputFiles(await pictureFile(page));
  await expect(page.locator('[data-crop-back]')).toBeVisible();
  // A BROWSER THAT HAS NEVER OPENED LAYOUT opens on the frame every drawing
  // opens on.
  await expect(page.locator('[data-crop-frame]')).toHaveText('LSQUARE01');
  await page.locator('[data-crop-cancel]').click();

  // AND IT FOLLOWS THE FRAME, rather than assuming the strip: with the band
  // picked, the preview is the band.
  await page.evaluate(() => {
    const manager = window.DraftProfileManager;
    manager.saveActive(manager.createPackage('settings', 'mine', { layout: { titleblock: 'LBAND01' } }));
  });
  await page.locator('[data-logo-file]').setInputFiles(await pictureFile(page));
  await expect(page.locator('[data-crop-frame]'), 'the preview ignored the current frame')
    .toHaveText('LBAND01');
});

test('COMPANY 01, then 02 — and renaming one does not reset the count', async ({ page }) => {
  await openStandards(page);
  await page.locator('[data-logo-file]').setInputFiles(await pictureFile(page));
  await page.locator('[data-crop-use]').click();
  await expect(page.locator('[data-logo-label]')).toHaveValue('COMPANY 01');

  // RENAMED, which he asked for outright: the name is the drafter's.
  await page.locator('[data-logo-label]').fill('BLUEJETTY');
  await page.locator('[data-logo-label]').dispatchEvent('change');
  await expect(page.locator('[data-logo-label]')).toHaveValue('BLUEJETTY');

  // AND THE NEXT ONE IS STILL 02. This is the check the whole `seq` field
  // exists for: read the number back off the LABELS and this comes out
  // COMPANY 01 a second time, because nothing is called COMPANY 01 any more.
  await page.locator('[data-logo-file]').setInputFiles(await pictureFile(page));
  await page.locator('[data-crop-use]').click();
  await expect(page.locator('[data-logo-label]')).toHaveCount(2);
  await expect(page.locator('[data-logo-label]').nth(1),
    'the second logo did not take the next slot').toHaveValue('COMPANY 02');

  // A SLOT THAT IS FREED IS FILLED, rather than counting past it for ever.
  await page.locator('[data-logo-remove]').first().click();
  await expect(page.locator('[data-logo-label]')).toHaveCount(1);
  await page.locator('[data-logo-file]').setInputFiles(await pictureFile(page));
  await page.locator('[data-crop-use]').click();
  const names = await page.locator('[data-logo-label]').evaluateAll(els => els.map(el => el.value));
  expect(names, 'the freed slot was not reused').toContain('COMPANY 01');
});

test('a logo already in the list can be cropped again', async ({ page }) => {
  // His own first upload is already saved with its border on, so the fix has
  // to reach a logo that is already there and not only the next one.
  await openStandards(page);
  await page.locator('[data-logo-file]').setInputFiles(await pictureFile(page));
  await page.locator('[data-crop-all]').click();          // keep the border
  await page.locator('[data-crop-use]').click();
  const before = await page.evaluate(() =>
    window.DraftProfileManager.getActive('standards').content.model.companyLogos[0].dataUrl);

  await page.locator('[data-logo-crop]').click();
  await expect(page.locator('[data-crop-back]')).toBeVisible();
  // IT OPENS ON THE ARTWORK AGAIN -- the stored picture still has the border,
  // so there is still something to trim.
  expect(await cropRect(page)).toEqual({ w: 40, h: 20 });
  await page.locator('[data-crop-use]').click();

  const after = await page.evaluate(() =>
    window.DraftProfileManager.getActive('standards').content.model.companyLogos[0].dataUrl);
  expect(after, 'the re-crop changed nothing').not.toBe(before);
  expect(after.length, 'the cropped picture is not smaller than the one with its border on')
    .toBeLessThan(before.length);
});

test('CANCEL leaves the list alone', async ({ page }) => {
  await openStandards(page);
  await page.locator('[data-logo-file]').setInputFiles(await pictureFile(page));
  await expect(page.locator('[data-crop-back]')).toBeVisible();
  await page.locator('[data-crop-cancel]').click();
  await expect(page.locator('[data-crop-back]')).toBeHidden();
  // NOTHING WAS FILED. A cancel that quietly saved would be worse than a
  // dialog that would not close.
  await expect(page.locator('[data-logo-list]')).toContainText('NONE YET');
});
