// Global drawing shortcuts must not fire while a form control has focus, so
// choosing a file extension (or typing in a box) cannot silently switch the
// active tool. Moved onto MODEL.html 28 Nov 2026.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const P = (x, z) => ({ x, y: 0, z });
const SQUARE = [P(0, 0), P(20, 0), P(20, 16), P(0, 16)];
const drawing = () => ({
  version: 1,
  levels: [{ id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 0,
  walls: SQUARE.map((pt, i) => ({
    id: 100 + i, start: pt, end: SQUARE[(i + 1) % 4], levelId: 3, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [],
  stairs: [], notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  boneyardShelves: [], groups: [], levelLocks: [], underlays: [],
});

const wallArmed = page => page.locator('[data-tool-key="wall"]').getAttribute('aria-pressed');

async function open(page) {
  await h.openEditor(page, { drawing: drawing(), url: '/MODEL.html?left=1&lpane=drafting' });
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  expect(await wallArmed(page)).not.toBe('true');
}

test('a focused select keeps the keys the user is typing', async ({ page }) => {
  await open(page);
  await page.locator('#file-ext').focus();
  await page.keyboard.press('w');
  await page.waitForTimeout(200);
  expect(await wallArmed(page)).not.toBe('true');
});

test('a focused text box keeps the keys too', async ({ page }) => {
  await open(page);
  // A box made for the purpose: whatever text field the page shows, the
  // rule is the same -- focus in a text control means the keys are typing.
  await page.evaluate(() => {
    const box = document.createElement('input');
    box.id = 'zz-typing'; box.type = 'text';
    document.body.appendChild(box);
  });
  await page.locator('#zz-typing').focus();
  await page.keyboard.type('w');
  await page.waitForTimeout(200);
  expect(await wallArmed(page)).not.toBe('true');
  await expect(page.locator('#zz-typing')).toHaveValue('w');
});

test('the plan still answers shortcuts', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await page.mouse.move(...at(10, 8));
  await page.keyboard.press('w');
  await page.waitForTimeout(200);
  expect(await wallArmed(page)).toBe('true');
});
