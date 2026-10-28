// THE TOOL KEYS' FACES (Movie, 27 Oct): "on the BUILD buttons can you draw
// little icons for each ... also for the DRAFTING keys. don't put text in the
// box except the letter, just an icon and command letter, and when the user
// scolls over the tool name should be first 'WALL - press W to draw a wall.'"
// -- and "i notice we don't have a MULTIPLE button yet. put a button in the
// DRAFTING menu we can work on it later".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.goto('/MODEL.html?left=1');
  await expect(page.locator('[data-tool-key]').first()).toBeAttached({ timeout: 10000 });
}

test('every key shows its letter and a drawing, and no name on its face', async ({ page }) => {
  await open(page);
  const faces = await page.locator('[data-tool-key]').evaluateAll(els => els.map(el => {
    const name = el.querySelector('[data-tool-name]');
    return {
      id: el.dataset.toolKey,
      icon: !!el.querySelector('[data-tool-icon] svg'),
      nameShows: !!name && name.getBoundingClientRect().width > 2,
    };
  }));
  expect(faces.length).toBeGreaterThan(20);
  expect(faces.filter(f => !f.icon).map(f => f.id), 'a drawing on every key').toEqual([]);
  expect(faces.filter(f => f.nameShows).map(f => f.id), 'no name on any face').toEqual([]);
});

test('the tooltip names the tool first, then its key and what it does', async ({ page }) => {
  await open(page);
  const title = id => page.locator(`[data-tool-key="${id}"]`).getAttribute('title');
  expect(await title('wall')).toBe('WALL — press W to draw a wall.');
  expect(await title('dimension')).toBe('DIMENSION — press D to dimension.');
  // A key with no letter says what it does all the same.
  expect(await title('roomtag')).toBe('ROOM TAG — Place a room tag.');
});

test('MULTIPLE is a key in DRAW / EDIT that says it is coming and arms nothing', async ({ page }) => {
  await open(page);
  const multiple = page.locator('[data-tool-group="draw"] [data-tool-key="multiple"]');
  await expect(multiple).toHaveCount(1);
  await multiple.click({ force: true });
  await expect(page.locator('#strip-message')).toContainText('MULTIPLE is coming soon');
  expect(await page.evaluate(() => activeTool)).toBe('select');
});
