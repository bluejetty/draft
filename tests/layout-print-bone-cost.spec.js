// A PRINT PACKAGE FROM LAYOUT COSTS BONES, AND THE PRESS SHOWS THE WALLET.
//
// jb, 11 Nov 2026: "the number isn't showing in the HOUSE blue button in
// the construction page layout, can we put that in there and make it 5
// bones to print a PDF", then "lets make a PDF 5 bones (not 3)". The browser's print window is where both the
// printer and Save as PDF live and the page cannot tell them apart, so the
// PRINT press is what is priced: the card names the price, refuses at fewer
// (like SAVE AS at 0, PR #978), and the toll is taken once every sheet is
// drawn and the window opens -- a sheet that will not draw costs nothing.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
function boneDrawing() {
  const wall = (id, levelId, view, sx, sz, ex, ez, top) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId, view,
    wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6',
    baseHeight: 0, topHeight: top, refLine: 'left',
  });
  const ring = (idBase, levelId, view, top) => [
    wall(idBase + 1, levelId, view, 0, 0, 36, 0, top),
    wall(idBase + 2, levelId, view, 36, 0, 36, 26, top),
    wall(idBase + 3, levelId, view, 36, 26, 0, 26, top),
    wall(idBase + 4, levelId, view, 0, 26, 0, 0, top),
  ];
  return {
    version: 1,
    levels: [
      { id: 8, name: 'SITE', elev: 0 },
      { id: 7, name: 'ROOF', elev: 9 },
      { id: 3, name: 'MAIN FL', elev: 0 },
      { id: 1, name: 'FOUNDATION', elev: -9 },
    ],
    walls: [...ring(0, 3, 'plan', 8.09), ...ring(10, 1, 'foundation', 8)],
    roofs: [{
      id: 1, levelId: 7, pitch: 4, overhang: 1.5,
      points: [
        { x: -1.5, z: -1.5 }, { x: 37.5, z: -1.5 },
        { x: 37.5, z: 27.5 }, { x: -1.5, z: 27.5 },
      ],
      edges: ['eave', 'gable', 'eave', 'gable'],
    }],
    cuts: [], fenestrations: [],
    layout: { auto: true },
  };
}
async function openLayout(page, drawing) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, saved }) => {
    const file = new File([JSON.stringify(saved)], 'model-drawing.json', { type: 'application/json' });
    await window.SharedFileStore.saveSharedFile(file, bucket);
  }, { bucket: BUCKET, saved: drawing });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
}
const bones = (page, n) => page.evaluate(n => {
  localStorage.setItem('draft-bone-wallet',
    JSON.stringify({ balance: n, lastDripAt: Date.now(), createdAt: Date.now() }));
  window.dispatchEvent(new CustomEvent('draft-bones-changed'));
}, n);
const balance = page => page.evaluate(() => window.DraftBoneWallet.read().balance);
const capturePrints = page => page.evaluate(() => {
  window.__captured = null;
  window.__draftPrintCapture = ({ sheets, done }) => { window.__captured = { sheets }; done(); };
});
const toll = page => page.locator('[data-print-toll]');
const go = page => page.locator('[data-print-go]');

test('the HOUSE press on LAYOUT shows the bone count, and the title names the price of a package', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await bones(page, 9);
  await expect(page.locator('#bone-balance')).toHaveText('9');
  await expect(page.locator('#bone')).toHaveAttribute('title', /9 bones/);
  await expect(page.locator('#bone')).toHaveAttribute('title', /PRINT .* costs 5 bones/);
  await expect(page.locator('#bone')).not.toHaveAttribute('data-broke', '');
  // An empty wallet shows the countdown and greys the press, as on MODEL.
  await bones(page, 0);
  await expect(page.locator('#bone-balance')).toHaveText(/^0 · /);
  await expect(page.locator('#bone')).toHaveAttribute('data-broke', '');
});

test('PRINT names its price, takes 5 bones once the package goes to the print window, and the press repaints', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await bones(page, 7);
  await capturePrints(page);
  await page.locator('#bone').click();
  await expect(page.locator('#lay-print-scrim')).toBeVisible();
  await expect(toll(page)).toHaveText('Costs 5 bones (you have 7).');
  await expect(go(page)).toBeEnabled();
  await go(page).click();
  await page.waitForFunction(() => window.__captured, null, { timeout: 30000 });
  expect((await page.evaluate(() => window.__captured)).sheets.length).toBeGreaterThan(0);
  expect(await balance(page), 'five bones for the package').toBe(2);
  await expect(page.locator('#bone-balance')).toHaveText('2');
  await expect(page.locator('#lay-print-scrim')).toBeHidden();
});

test('fewer than 5 bones: the card says so in red, PRINT is greyed, and nothing prints', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await bones(page, 4);
  await capturePrints(page);
  await page.locator('[data-layout-print]').click();
  await expect(page.locator('#lay-print-scrim')).toBeVisible();
  await expect(toll(page)).toHaveText('A print package costs 5 bones and you have 4. A free bone drips in every hour.');
  await expect(go(page)).toBeDisabled();
  // A press that got through anyway is refused by the package itself.
  await page.evaluate(() => document.querySelector('[data-print-go]').removeAttribute('disabled'));
  await go(page).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__captured)).toBeNull();
  expect(await balance(page), 'nothing spent').toBe(4);
  await expect(page.locator('#lay-print-scrim')).toBeVisible();
});

test('a sheet that will not draw costs nothing', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await bones(page, 7);
  await capturePrints(page);
  await page.evaluate(() => {
    window.__layoutPage._printSheetCanvas = () => { throw new Error('no ink'); };
  });
  await page.locator('#bone').click();
  await go(page).click();
  await expect(page.locator('[data-print-message]')).toContainText('Could not prepare the package: no ink.');
  expect(await page.evaluate(() => window.__captured)).toBeNull();
  expect(await balance(page), 'a failed print spends nothing').toBe(7);
  await expect(page.locator('#bone-balance')).toHaveText('7');
});
