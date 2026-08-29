// The FREE-BONE wallet (board #261, Phase 1): every new browser seeds 3
// bones, one drips in hourly up to 10, and the red BUILD HOUSE bone spends
// one per build that fires. The bone button is the gauge — balance in
// white on the bone, greying to a countdown when the wallet runs dry.
// These tests opt OUT of the helpers' fat test wallet to exercise the
// real product economy.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const HOUR = 60 * 60 * 1000;

async function drawOutlineRect(page) {
  await h.selectTool(page, 'Outline');
  await h.clickWorld(page, -8, -6);
  await h.clickWorld(page, 8, -6);
  await h.clickWorld(page, 8, 6);
  await h.clickWorld(page, -8, 6);
  await page.keyboard.press('Enter');
  await h.waitForSaved(page);
  await h.climbTourToMain(page);
}

async function buildHouse(page) {
  await h.selectTool(page, 'Outline');
  await page.getByRole('button', { name: 'BUILD HOUSE' }).click();
  await page.waitForTimeout(400);
  await h.waitForSaved(page);
}

const walletInStorage = page => page.evaluate(() =>
  JSON.parse(localStorage.getItem('draft-bone-wallet')));

const setWallet = (page, balance) => page.evaluate(b =>
  localStorage.setItem('draft-bone-wallet',
    JSON.stringify({ balance: b, lastDripAt: Date.now(), createdAt: Date.now() })), balance);

test('the drip math holds: hourly grants, the cap, the parked clock, no double grants', async ({ page }) => {
  await h.openModel(page, { boneWallet: false });
  const verdicts = await page.evaluate(HOUR => {
    const W = window.DraftBoneWallet;
    const t = 1_000_000_000_000;
    localStorage.removeItem(W.STORAGE_KEY);
    const out = {};
    out.seed = W.read(t).balance;                       // fresh browser
    out.afterHour = W.read(t + HOUR).balance;           // +1
    out.afterMore = W.read(t + 3.5 * HOUR).balance;     // +2 more, fraction kept
    out.noDouble = W.read(t + 3.5 * HOUR).balance;      // same instant = a reload
    out.fraction = W.read(t + 3.5 * HOUR).nextDripMs;   // half hour carried
    out.overnight = W.read(t + 100 * HOUR).balance;     // caps at 10
    out.atCapWait = W.read(t + 100 * HOUR).nextDripMs;  // null at the cap
    W.spend(1, t + 150 * HOUR);                         // spend from the parked cap
    out.afterSpend = W.read(t + 150 * HOUR).balance;
    out.freshHour = W.read(t + 150 * HOUR).nextDripMs;  // a full hour — nothing banked
    out.refuse = W.spend(99, t + 150 * HOUR);           // more than the balance
    out.untouched = W.read(t + 150 * HOUR).balance;
    // A clock set backwards can't freeze the faucet.
    localStorage.setItem(W.STORAGE_KEY, JSON.stringify({ balance: 2, lastDripAt: t + 999 * HOUR, createdAt: t }));
    out.clamped = W.read(t).nextDripMs;
    return out;
  }, HOUR);
  expect(verdicts.seed).toBe(3);
  expect(verdicts.afterHour).toBe(4);
  expect(verdicts.afterMore).toBe(6);
  expect(verdicts.noDouble).toBe(6);
  expect(verdicts.fraction).toBe(HOUR / 2);
  expect(verdicts.overnight).toBe(10);
  expect(verdicts.atCapWait).toBe(null);
  expect(verdicts.afterSpend).toBe(9);
  expect(verdicts.freshHour).toBe(HOUR);
  expect(verdicts.refuse).toBe(false);
  expect(verdicts.untouched).toBe(9);
  expect(verdicts.clamped).toBe(HOUR);
});

test('a fresh browser seeds 3, shows it white on the bone, and a build spends one', async ({ page }) => {
  await h.openModel(page, { boneWallet: false });
  const overlay = page.locator('[data-bone-balance]');
  await expect(overlay).toHaveText('3');
  await expect(overlay).toHaveCSS('color', 'rgb(255, 255, 255)');

  await drawOutlineRect(page);
  await buildHouse(page);
  await expect(overlay).toHaveText('2');
  const saved = await h.savedDrawing(page);
  expect(saved.walls.length).toBeGreaterThan(0); // the build really fired
  expect((await walletInStorage(page)).balance).toBe(2);

  // The balance survives a reload — no re-seed, no double drip.
  await page.reload();
  await h.waitForModelReady(page);
  await expect(overlay).toHaveText('2');
});

test('an empty wallet greys the bone, counts down, and refuses the build kindly', async ({ page }) => {
  await h.openModel(page, { boneWallet: false });
  await drawOutlineRect(page);
  await setWallet(page, 1);
  await page.reload();
  await h.waitForModelReady(page);

  await buildHouse(page); // spends the last bone
  const overlay = page.locator('[data-bone-balance]');
  await expect(overlay).toHaveText(/^0 · \d+m$|^0 · <1m$/);
  const filter = await page.locator('[data-build-house]').getAttribute('style');
  expect(filter).toContain('grayscale');

  // Pressing again refuses before anything else: the wallet gate runs
  // first (Devin's ruling), so the message is the kind out-of-bones line
  // and the drawing stands exactly as it was.
  const before = await h.savedDrawing(page);
  await page.locator('[data-build-house]').click();
  await page.waitForTimeout(400);
  await expect(page.locator('[data-model-drawing-message]'))
    .toContainText(/Out of bones — the next free bone lands in/);
  const after = await h.savedDrawing(page);
  expect(after.walls.length).toBe(before.walls.length);
  expect((await walletInStorage(page)).balance).toBe(0);
});

test('free presses stay free: no outline, and a press where every shell already stands', async ({ page }) => {
  await h.openModel(page, { boneWallet: false });

  // No outline: the bone points at the type buttons and charges nothing.
  await page.locator('[data-build-house]').click();
  await page.waitForTimeout(300);
  await expect(page.locator('[data-model-drawing-message]')).toContainText(/Nothing to build yet/);
  await expect(page.locator('[data-bone-balance]')).toHaveText('3');

  // A real build spends one; the second press finds every shell standing,
  // builds nothing, and stays free (Devin's ruling on the third outcome).
  await drawOutlineRect(page);
  await buildHouse(page);
  await expect(page.locator('[data-bone-balance]')).toHaveText('2');
  await buildHouse(page);
  await expect(page.locator('[data-model-drawing-message]')).toContainText(/already has its shell/);
  await expect(page.locator('[data-bone-balance]')).toHaveText('2');
});

test('the digit ladder keeps 3- and 5-digit balances inside the bone', async ({ page }) => {
  await h.openModel(page, { boneWallet: false });
  const fits = async () => {
    const button = await page.locator('[data-build-house]').boundingBox();
    const text = await page.locator('[data-bone-balance]').boundingBox();
    return text.x >= button.x && text.y >= button.y
      && text.x + text.width <= button.x + button.width + 0.5
      && text.y + text.height <= button.y + button.height + 0.5;
  };
  await setWallet(page, 999);
  await page.reload();
  await h.waitForModelReady(page);
  await expect(page.locator('[data-bone-balance]')).toHaveText('999');
  expect(await fits()).toBe(true);

  await setWallet(page, 99999);
  await page.reload();
  await h.waitForModelReady(page);
  await expect(page.locator('[data-bone-balance]')).toHaveText('99999');
  expect(await fits()).toBe(true);
});
