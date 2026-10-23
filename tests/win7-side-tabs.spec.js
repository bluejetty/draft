// THE SIDE TABS' WORDS TURN ON AN OLD BROWSER TOO (Movie, 23 Oct, from his
// Windows 7 machine): "the side tabs DRAFTING BUILD PROPERTIES & LEVELS/LAYERS
// NOTES/CALC UNDO/REDO the text isn't turned 90, its typed left to right
// rather than up down and the tabs stick kindof far onto the screen on each
// side".
//
// A <button> only honours a vertical writing-mode from Chromium 120 (late
// 2023), and Windows 7's last Chromium is 109: there the button laid its
// word out flat and grew as wide as the word. The word now sits in a block
// of its own inside the button, which turns on every build. THE BROWSER THAT
// SHOWED THE FAULT CANNOT RUN HERE, so what these specs can hold is the
// shape of the fix: every tab's word in its block, and the block's own rule
// naming the turn (the button's rule, which the old build ignores, is not
// enough on its own).
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const LEFT = ['left-tab', 'build-tab', 'props-tab'], RIGHT = ['right-tab', 'notes-tab', 'history-tab'];
// What the stylesheets themselves declare for a selector, read off the CSSOM.
const declared = (page, selector, prop) => page.evaluate(({ selector, prop }) => {
  const out = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      if (rule.selectorText && rule.selectorText.split(',').map(s => s.trim()).includes(selector)) {
        const v = rule.style.getPropertyValue(prop); if (v) out.push(v.trim());
      }
    }
  }
  return out;
}, { selector, prop });

test('MODEL: each of the six tabs holds its word in a block that declares the turn itself; the tabs stay narrow', async ({ page }) => {
  await h.openModel(page);
  await page.goto('/MODEL.html?left=1&right=1');
  await expect(page.locator('#left-tab')).toBeVisible();
  for (const id of [...LEFT, ...RIGHT]) {
    const block = page.locator(`#${id} > .rail-tab-text`);
    await expect(block, `${id} has its word in a block`).toHaveCount(1);
    await expect(block).toHaveCSS('display', 'block');
    await expect(block).toHaveCSS('writing-mode', LEFT.includes(id) ? 'vertical-rl' : 'vertical-lr');
    const box = await page.locator(`#${id}`).boundingBox();
    expect(box.width, `${id} is a narrow tab, not a wide one`).toBeLessThan(44);
    expect(box.height, `${id} runs down the edge`).toBeGreaterThan(box.width);
  }
  // THE BLOCK'S OWN RULE, not the turn it would inherit from the button on
  // a new build: that is the part the old build needs.
  expect(await declared(page, '.rail-tab-text', 'writing-mode')).toContain('vertical-rl');
  expect(await declared(page, '#right-tab .rail-tab-text', 'writing-mode')).toContain('vertical-lr');
  // And the words still read as the buttons' names.
  await expect(page.getByRole('button', { name: 'LEVELS / LAYERS', exact: true })).toHaveId('right-tab');
  await expect(page.locator('#notes-tab')).toHaveText('NOTES / CALC');
});

test('a page whose tab the shared bars build gets the block too', async ({ page }) => {
  await page.goto('/PROJECT.html');
  const blocks = page.locator('.rail-tab > .rail-tab-text');
  await expect(blocks.first()).toBeAttached();
  expect(await blocks.count()).toBeGreaterThan(0);
  expect(await page.locator('.rail-tab').count(), 'every tab has one').toBe(await blocks.count());
});

test('the old page\'s two tabs hold their words in blocks', async ({ page }) => {
  await page.goto('/MODEL.dc.html');
  await expect(page.locator('[data-left-rail-tab] > .rail-tab-text')).toHaveText('ROUGHDRAFTER - LITE - DRAFTING TOOLS');
  await expect(page.locator('[data-right-rail-tab] > .rail-tab-text')).toHaveText('LEVELS - LAYERS');
});
