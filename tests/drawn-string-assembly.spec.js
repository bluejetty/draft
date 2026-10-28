// A STRING DRAWN IN ONE GO IS ONE ASSEMBLY (Movie, 28 Oct).
//
// "when i initially draw a 'string' of lines, id like those string to be
// grouped initially, user would need to BUST it" -- "when you draw a string
// of 3 lines they should be assembled right after you draw them. you would
// need to bust them, and then you could re ASSEMBLY Y them after picking all
// 3 or which ones you want" -- and walls too ("Lines and walls").
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.goto('/MODEL.html?left=1&lpane=drafting');
  await page.waitForFunction(() => typeof drawing !== 'undefined' && drawing);
  await page.waitForTimeout(300);
  return h.planFrame(page);
}
const draw = async (page, at, pts) => {
  for (const [x, z] of pts) { await page.mouse.click(...at(x, z)); await page.waitForTimeout(60); }
};
const groups = page => page.evaluate(() => (drawing.groups || []).map(g => ({ name: g.name, members: g.members.map(m => m.type) })));

test('three lines drawn in one string are one assembly the moment ENTER ends it, and picked as one', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('l');
  await draw(page, at, [[0, 0], [10, 0], [10, 8], [2, 8]]);
  expect(await groups(page), 'not while the string is still being drawn').toEqual([]);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  expect(await groups(page)).toEqual([{ name: 'LINES 1', members: ['line', 'line', 'line'] }]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.mouse.click(...at(5, 40));
  await page.mouse.click(...at(10, 4));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => selection.length), 'one click takes all three').toBe(3);
});

test('a string of walls is one assembly too; a lone line is not', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('w');
  await draw(page, at, [[0, 0], [12, 0], [12, 10]]);
  await page.keyboard.press('Enter');
  await page.keyboard.press('l');
  await draw(page, at, [[0, 20], [10, 20]]);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  expect(await groups(page)).toEqual([{ name: 'WALLS 1', members: ['wall', 'wall'] }]);
});

test('ESC ends a string: each string its own assembly', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('l');
  await draw(page, at, [[0, 0], [10, 0], [10, 8]]);
  await page.keyboard.press('Escape');
  await draw(page, at, [[0, 20], [10, 20], [10, 28]]);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  expect((await groups(page)).map(g => g.members.length)).toEqual([2, 2]);
});

test('ASSEMBLY BUST splits the string; ASSEMBLY (Y) puts any two of them back together', async ({ page }) => {
  const { at } = await open(page);
  await page.keyboard.press('l');
  await draw(page, at, [[0, 0], [10, 0], [10, 8], [2, 8]]);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.mouse.click(...at(10, 4));
  await page.keyboard.press('Control+Shift+g');
  await page.waitForTimeout(150);
  expect(await groups(page), 'busted').toEqual([]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('y');
  // A drafter's two picks, not a double-click (which closes the assembly).
  await page.mouse.click(...at(5, 0));
  await page.waitForTimeout(700);
  await page.mouse.click(...at(6, 8));
  await page.waitForTimeout(700);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  expect((await groups(page)).map(g => g.members.length)).toEqual([2]);
});
