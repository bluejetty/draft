// PRINT ON LAYOUT: THE PACKAGE.
//
// Movie, 9 Oct: "we should do the PRINT function for LAYOUT for PDF and
// actual printing too" -- "allow the user to select which layouts to print in
// their 'package'" -- "300 DPi good". The bone opens a list of every sheet,
// ticked; PRINT draws the ticked ones at 300 dpi, one to a page at the
// paper's size, and hands them to the browser's print window (which is also
// where Save as PDF lives). No script can drive that window, so these checks
// take the package through the page's capture hook instead of a printer.
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
function boneDrawing({ auto = true, layout = undefined } = {}) {
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
    cuts: [{
      id: 1, name: 'S1', elev: 0, levelId: 3,
      startPt: { x: 18, z: -4 }, endPt: { x: 18, z: 30 },
      dirVec: { x: 1, z: 0 },
    }],
    fenestrations: [
      { id: 1, levelId: 3, wallId: 1, type: 'door', offset: 6, width: 3 },
    ],
    layout: layout !== undefined ? layout : { auto },
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
async function waitForCompose(page) {
  await page.waitForFunction(() => Number(document.body.dataset.layoutSaveSeq || 0) > 0
    && document.body.dataset.layoutSaveDirty !== '1');
}

// Take the next package instead of printing it: each page's size, and how
// much of it is ink (drawn small to count quickly).
async function capturePrints(page) {
  await page.evaluate(() => {
    window.__captured = null;
    window.__draftPrintCapture = ({ doc, sheets, done }) => {
      const pages = [...doc.images].map(img => {
        const c = document.createElement('canvas');
        c.width = 340; c.height = 220;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, c.width, c.height);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let ink = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) ink += 1;
        const corner = g.getImageData(1, 1, 1, 1).data;
        return { w: img.naturalWidth, h: img.naturalHeight, ink, corner: [...corner].slice(0, 3) };
      });
      window.__captured = { sheets, pages, css: doc.querySelector('style').textContent };
      done();
    };
  });
}

test('the bone opens the package, every sheet ticked; PRINT sends the ticked ones at 300 dpi', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  const count = await page.evaluate(() => document.querySelectorAll('[data-layout-sheet-thumb], [data-sheet-thumb]').length);
  await capturePrints(page);

  await page.locator('#bone').click();
  await expect(page.locator('#lay-print-scrim')).toBeVisible();
  const boxes = page.locator('[data-print-sheet]');
  const n = await boxes.count();
  expect(n, 'one row per sheet in the set').toBeGreaterThan(2);
  if (count) expect(n).toBe(count);
  for (let i = 0; i < n; i += 1) await expect(boxes.nth(i)).toBeChecked();
  await expect(page.locator('[data-print-go]')).toHaveText(`PRINT ${n} SHEETS`);

  // Sheet 2 out of the package.
  await page.locator('[data-print-sheet="2"]').uncheck();
  await expect(page.locator('[data-print-go]')).toHaveText(`PRINT ${n - 1} SHEETS`);
  await page.locator('[data-print-go]').click();
  await page.waitForFunction(() => window.__captured, null, { timeout: 30000 });
  const got = await page.evaluate(() => window.__captured);

  expect(got.sheets, 'the ticked sheets, in order').toEqual(
    Array.from({ length: n }, (_, i) => i + 1).filter(s => s !== 2));
  expect(got.css, 'one sheet to a page at the paper size, no margin').toContain('@page{size:17in 11in;margin:0}');
  got.pages.forEach((p, i) => {
    expect([p.w, p.h], `sheet ${got.sheets[i]} at 300 dpi`).toEqual([5100, 3300]);
    expect(p.corner, 'white paper to the edge, no desk').toEqual([255, 255, 255]);
    expect(p.ink, `sheet ${got.sheets[i]} has its border and titleblock`).toBeGreaterThan(100);
  });
  // The dealt SITE PLAN has nothing on it in this drawing; the plan and
  // elevation sheets carry their drawings too.
  const inks = got.pages.map(p => p.ink);
  expect(Math.max(...inks), 'the drawn sheets carry their drawings').toBeGreaterThan(Math.min(...inks) * 1.5);
  await expect(page.locator('#lay-print-scrim')).toBeHidden();
  await expect(page.locator('[data-print-frame]'), 'and the print page is cleared away').toHaveCount(0);
});

test('NONE leaves nothing to print; ALL puts every sheet back', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await waitForCompose(page);
  await page.locator('#bone').click();
  await page.locator('[data-print-none]').click();
  await expect(page.locator('[data-print-go]')).toBeDisabled();
  await expect(page.locator('[data-print-go]')).toHaveText('PRINT 0 SHEETS');
  await page.locator('[data-print-all]').click();
  const n = await page.locator('[data-print-sheet]').count();
  await expect(page.locator('[data-print-go]')).toHaveText(`PRINT ${n} SHEETS`);
  await page.locator('#lay-print-close').click();
  await expect(page.locator('#lay-print-scrim')).toBeHidden();
});
