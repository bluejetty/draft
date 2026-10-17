// THE D SHEETS ON THE CONSTRUCTION LAYOUT (Movie, 17 Oct, redrawing the
// North Point building: "we will need to make pages sizes the same as i made
// for that other project 11X17 won't be big enough, i think they are 22X 34
// or something??"). His set is 24 x 36 (ARCH D); 22 x 34 (ANSI D) comes
// with it. What only the page can show: the size is offered, the sheet
// takes it and reads it back after a reload, the titleblock picker moves to
// the D set, and the file keeps the key.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });

function houseDrawing() {
  const wall = (id, sx, sz, ex, ez) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId: 1, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  });
  return {
    version: 1,
    levels: [{ id: 0, name: 'FOUNDATION', elev: -8 }, { id: 1, name: 'MAIN FL', elev: 0 }],
    walls: [wall(1, 0, 0, 24, 0), wall(2, 24, 0, 24, 16), wall(3, 24, 16, 0, 16), wall(4, 0, 16, 0, 0)],
    fenestrations: [],
    layout: {
      auto: false, nextViewportId: 2, sheets: [{ title: '' }],
      viewports: [{ id: 1, kind: 'plan', levelId: 1, pif: 0.25, xIn: 8, yIn: 5, sheet: 1 }],
    },
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
}

async function savedDrawing(page) {
  return page.evaluate(async bucket => {
    const file = await window.SharedFileStore.loadSharedFile(bucket);
    return JSON.parse(await file.text());
  }, BUCKET);
}

const ready = page => page.waitForFunction(() => document.body.dataset.layoutReady === '1');

test('24 x 36 is offered, the sheet takes it and reads it back, and the frames move to the D set', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await expect(page.getByText('17" × 11"')).toBeVisible();
  await page.getByRole('button', { name: '24 × 36' }).click();
  await expect(page.getByText('36" × 24"')).toBeVisible();
  await expect.poll(async () => (await savedDrawing(page)).layout.paperKey).toBe('24x36');
  // The titleblock offered is the D set, same shape as before.
  const frames = await page.locator('[data-layout-frame] option').allTextContents();
  expect(frames).toEqual(['LSQUARE03', 'LBAND03', 'LROUND03']);
  // A fresh visit reads the sheet back at 24 x 36 -- FROM THE FILE. The
  // page also remembers the last paper in a local profile, which would hand
  // the size back whatever the file said; cleared here so the file's own
  // key is what comes back.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await ready(page);
  await expect(page.getByText('36" × 24"')).toBeVisible();
  expect((await savedDrawing(page)).layout.paperKey).toBe('24x36');
});

test('22 x 34 is the other D sheet, and portrait turns it up', async ({ page }) => {
  await openLayout(page, houseDrawing());
  await page.getByRole('button', { name: '22 × 34' }).click();
  await expect(page.getByText('34" × 22"')).toBeVisible();
  await page.getByRole('button', { name: 'PORT', exact: true }).click();
  await expect(page.getByText('22" × 34"')).toBeVisible();
  await expect.poll(async () => (await savedDrawing(page)).layout.paperKey).toBe('22x34');
  const frames = await page.locator('[data-layout-frame] option').allTextContents();
  expect(frames).toEqual(['PSQUARE04', 'PBAND04', 'PROUND04']);
});
