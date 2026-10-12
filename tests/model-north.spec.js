// THE TWO NORTHS, set by pressing the arrow on the plan (12 Oct; a bottom-bar
// button before that).
//
// Movie, 1 Oct: REAL ESTATE PLAN moves to the right-hand row, left of
// CONSTRUCTION LAYOUT; HOUSE ROTATE comes down beside it at 150%; and left of
// that a NORTH button whose popup holds "true north on left and construction
// north on right" -- "constuction north 90 True North 1" -- with the true
// north arrow "slightly greyer". The layout page gets the NORTH button only,
// doing the same thing on the same record.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const wall = (id, x0, z0, x1, z1) => ({
  id, levelId: 3, view: 'plan', wallType: 'stud_2x6', refLine: 'center',
  baseHeight: 0, topHeight: 8, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 },
});
const HOUSE = {
  format: 'draft-drawing', version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 18 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -10 },
  ],
  walls: [wall('n', -10, -8, 10, -8), wall('e', 10, -8, 10, 8), wall('s', 10, 8, -10, 8), wall('w', -10, 8, -10, -8)],
  board: 'drafting',
};

const seed = async (page, saved) => {
  await page.goto('/MODEL.dc.html');
  await page.waitForFunction(() => !!window.SharedFileStore, null, { timeout: 10000 });
  await page.evaluate(async ({ bucket, saved }) => {
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(saved)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, saved });
};
const stored = page => page.evaluate(async bucket => {
  const file = await window.SharedFileStore.loadSharedFile(bucket);
  return JSON.parse(await file.text());
}, BUCKET);

test('the north arrow is the button, and HOUSE ROTATE stands beside it', async ({ page }) => {
  // Movie, 12 Oct: "when you click on the Actual NORTH arrow area it opens the
  // adjustement window ... than we can remove the bottom bar button", and
  // "move the PAGE ROTATION button to the right side of where the north arrow
  // is located (centered up down on the north arrow and lines circle / text".
  await seed(page, HOUSE);
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  const order = await page.locator('#sheet-row > *').evaluateAll(els => els.map(el => el.textContent.trim()));
  expect(order).toEqual(['REAL ESTATE PLAN', 'CONSTRUCTION LAYOUT', 'SPECIFICATIONS', 'ESTIMATES']);
  await expect(page.locator('#sheet-row [data-north-button], #sheet-row [data-mode-rotate]')).toHaveCount(0);
  await expect(page.locator('#strip [data-mode-rotate]'), 'nor on the top strip').toHaveCount(0);
  const hit = await page.locator('#north-hit').boundingBox();
  const rotate = await page.locator('#strip-rotate').boundingBox();
  expect(rotate.x, 'rotate stands right of the arrow').toBeGreaterThan(hit.x + hit.width);
  expect(Math.abs((rotate.y + rotate.height / 2) - (hit.y + hit.height / 2)), 'centred up and down on it').toBeLessThan(1.5);
  const canvas = await page.locator('#plan').boundingBox();
  expect(rotate.x + rotate.width, 'and stays on the plan').toBeLessThanOrEqual(canvas.x + canvas.width);
  // WHILE A TOOL IS ARMED A PRESS THERE IS A CORNER, not the popup.
  const h = require('./helpers');
  await h.armWall(page);
  await expect.poll(() => page.evaluate(() => {
    const b = document.getElementById('north-hit').getBoundingClientRect();
    return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.id;
  })).toBe('plan');
  await page.keyboard.press('Escape');
  // AN ELEVATION DRAWS NO ARROW, so its hand and HOUSE ROTATE go with it.
  await page.locator('.seat[data-seat="E1"]').click();
  await expect(page.locator('#north-hit')).toBeHidden();
  await expect(page.locator('#strip-rotate')).toBeHidden();
});

test('MODEL: construction north by 90, true north by 1, saved for the layout to read', async ({ page }) => {
  await seed(page, HOUSE);
  await page.goto('/MODEL.html?mode=night');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.locator('[data-north-button]').click();
  const pop = page.locator('[data-north-popup]');
  await expect(pop).toBeVisible();
  // TRUE NORTH ON THE LEFT, CONSTRUCTION NORTH ON THE RIGHT.
  const tnBox = await pop.locator('[data-north-value="tn"]').boundingBox();
  const cnBox = await pop.locator('[data-north-value="cn"]').boundingBox();
  expect(tnBox.x).toBeLessThan(cnBox.x);
  await pop.locator('[data-north="cn-right"]').click();
  await expect(pop.locator('[data-north-value="cn"]')).toHaveText('90°');
  for (let i = 0; i < 3; i += 1) await pop.locator('[data-north="tn-left"]').click();
  await expect(pop.locator('[data-north-value="tn"]')).toHaveText('3° L');
  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);
  await page.locator('[data-model-save]').click();
  await expect(page.locator('[data-model-save]')).toHaveText(/saved/i, { timeout: 6000 });
  expect((await stored(page)).layout.north).toEqual({ cn: 1, tn: -3 });
  // A FULL TURN COMES BACK ROUND: four presses of 90 is where it started.
  await page.locator('[data-north-button]').click();
  for (let i = 0; i < 3; i += 1) await pop.locator('[data-north="cn-right"]').click();
  await expect(pop.locator('[data-north-value="cn"]')).toHaveText('0°');
});

test('LAYOUT: the same NORTH button, on the same record, and no HOUSE ROTATE', async ({ page }) => {
  await seed(page, { ...HOUSE, layout: { north: { cn: 1, tn: -3 } } });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await expect(page.locator('#sheet-row [data-mode-rotate]')).toHaveCount(0);
  await page.locator('[data-north-button]').click();
  const pop = page.locator('[data-north-popup]');
  await expect(pop.locator('[data-north-value="cn"]')).toHaveText('90°');
  await expect(pop.locator('[data-north-value="tn"]')).toHaveText('3° L');
  const seq = await page.evaluate(() => Number(document.body.dataset.layoutSaveSeq || 0));
  await pop.locator('[data-north="tn-right"]').click();
  await page.waitForFunction(prev => Number(document.body.dataset.layoutSaveSeq || 0) > prev, seq);
  expect((await stored(page)).layout.north).toEqual({ cn: 1, tn: -2 });
});
