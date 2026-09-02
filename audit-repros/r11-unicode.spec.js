const { test } = require('@playwright/test');
const h = require('../tests/helpers.js');
test('R11: iOS smart punctuation defeats the length grammar', async ({ page }) => {
  await h.openModel(page);
  const out = await page.evaluate(() => {
    const p = window.DraftFormatters.parseArchitecturalLength;
    const cases = ["12'-6\"", "12’-6”", "12′-6″", "12’", "8’11 1/2”", '12-6', '12'];
    return cases.map(c => [c, JSON.stringify(p(c))]);
  });
  out.forEach(([c, r]) => console.log(JSON.stringify(c), '->', r));
});
