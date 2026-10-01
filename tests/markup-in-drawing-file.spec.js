// TEXT FROM A DRAWING FILE IS SHOWN AS TEXT, never parsed as markup.
//
// Audit 8.2. A .draft file can come from someone else, and three strings out
// of one reached innerHTML unescaped: a level name in MODEL.html's readout, a
// parser's error message in its notice (V8 quotes the bad input back), and a
// level name in EXTFINISH.html's roof list. Uppercasing the name did not
// defang it -- HTML is case-insensitive, so `<B DATA-PWN>` is still an element
// and an entity-encoded handler survives toUpperCase.
//
// THE PROBE IS AN ATTRIBUTE, not a script. A page that parses the string
// grows a [data-pwn] element; a page that escapes it shows the angle brackets
// as characters. Both halves are asserted, so a page that simply dropped the
// name would not pass for one that escaped it.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const MARKUP = '<b data-pwn>X</b>';
const HOUSE = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'proto', 'perf-bungalow.draft'), 'utf8'));
// Every level renamed, so whichever one a page shows first carries the probe.
const POISONED = { ...HOUSE, levels: HOUSE.levels.map(l => ({ ...l, name: MARKUP })) };

async function seed(page, text) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, text }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([text], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, text });
}

test('MODEL.html: a level name in the readout is text', async ({ page }) => {
  await seed(page, JSON.stringify(POISONED));
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await expect(page.locator('#readout-text')).toContainText(/<b data-pwn>x<\/b>/i);
  await expect(page.locator('#readout [data-pwn]')).toHaveCount(0);
});

test('MODEL.html: a parser error quoting the file is text', async ({ page }) => {
  await seed(page, MARKUP);
  await page.goto('/MODEL.html?mode=night');
  const notice = page.locator('#notice-body');
  await expect(notice).toContainText('could not be parsed', { timeout: 10000 });
  await expect(notice).toContainText('<b data-pwn>');
  await expect(notice.locator('[data-pwn]')).toHaveCount(0);
});

test('EXTFINISH.html: a level name on a roof button is text', async ({ page }) => {
  await seed(page, JSON.stringify(POISONED));
  await page.goto('/EXTFINISH.html');
  const roofs = page.locator('#roof-list');
  await expect(roofs.locator('[data-roof]').first()).toBeVisible({ timeout: 10000 });
  await expect(roofs).toContainText(/<b data-pwn>x<\/b>/i);
  await expect(page.locator('[data-pwn]')).toHaveCount(0);
});
