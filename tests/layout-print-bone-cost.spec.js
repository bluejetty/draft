// LAYOUT'S TWO PRINT PRESSES COST BONES, AND THE HOUSE PRESS SHOWS THE WALLET.
//
// jb, 11 Nov 2026: "the number isn't showing in the HOUSE blue button in
// the construction page layout, can we put that in there and make it 3
// bones to print a PDF", "lets make a PDF 5 bones (not 3)", then "make
// paper print cost 2 bone". The browser's print window cannot tell a
// printer from its own Save as PDF, so paper and PDF are two presses:
// PRINT (the browser's window) costs 2, SAVE PDF (a file this page writes,
// pdf-writer.js) costs 5. Each names its price, is greyed at fewer (like
// SAVE AS at 0, PR #978), and is paid once the sheets are drawn and the
// window opens or the file is down -- a sheet that will not draw costs
// nothing.
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
const pdf = page => page.locator('[data-print-pdf]');

test('the HOUSE press on LAYOUT shows the bone count, and the title names the price of a package', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await bones(page, 9);
  await expect(page.locator('#bone-balance')).toHaveText('9');
  await expect(page.locator('#bone')).toHaveAttribute('title', /9 bones/);
  await expect(page.locator('#bone')).toHaveAttribute('title', /PRINT 2 bones, SAVE PDF 5 bones/);
  await expect(page.locator('#bone')).not.toHaveAttribute('data-broke', '');
  // An empty wallet shows the countdown and greys the press, as on MODEL.
  await bones(page, 0);
  await expect(page.locator('#bone-balance')).toHaveText(/^0 · /);
  await expect(page.locator('#bone')).toHaveAttribute('data-broke', '');
});

test('PRINT names both prices, takes 2 bones once the package goes to the print window, and the press repaints', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await bones(page, 7);
  await capturePrints(page);
  await page.locator('#bone').click();
  await expect(page.locator('#lay-print-scrim')).toBeVisible();
  await expect(toll(page)).toHaveText('PRINT costs 2 bones, SAVE PDF costs 5 bones (you have 7).');
  await expect(go(page)).toBeEnabled();
  await expect(pdf(page)).toBeEnabled();
  await go(page).click();
  await page.waitForFunction(() => window.__captured, null, { timeout: 30000 });
  expect((await page.evaluate(() => window.__captured)).sheets.length).toBeGreaterThan(0);
  expect(await balance(page), 'two bones for the paper package').toBe(5);
  await expect(page.locator('#bone-balance')).toHaveText('5');
  await expect(page.locator('#lay-print-scrim')).toBeHidden();
});

test('SAVE PDF writes a PDF of the ticked sheets at the paper size, takes 5 bones, and offers the backup email', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await bones(page, 7);
  await page.evaluate(() => {
    window.__pdf = null;
    window.__draftPdfCapture = async ({ blob, name, sheets }) => {
      const buf = new Uint8Array(await blob.arrayBuffer());
      const text = new TextDecoder('latin1').decode(buf);
      window.__pdf = { name, sheets, size: buf.length, head: text.slice(0, 8), tail: text.slice(-6).trim(),
        pages: (text.match(/\/Type \/Page\b/g) || []).length,
        widths: (text.match(/\/Width (\d+)/g) || []), boxes: (text.match(/\/MediaBox \[[^\]]+\]/g) || []),
        filters: (text.match(/\/Filter \/(\w+)/g) || []) };
    };
  });
  await page.locator('#bone').click();
  await page.locator('[data-print-sheet="2"]').uncheck();
  await pdf(page).click();
  await page.waitForFunction(() => window.__pdf, null, { timeout: 60000 });
  const got = await page.evaluate(() => window.__pdf);
  expect(got.head).toBe('%PDF-1.4');
  expect(got.tail).toBe('%%EOF');
  expect(got.sheets, 'sheet 2 left out').not.toContain(2);
  expect(got.pages, 'one page per ticked sheet').toBe(got.sheets.length);
  expect(got.widths.every(w => w === '/Width 5100'), '300 dpi across 17 in').toBe(true);
  expect(got.boxes.every(b => b === '/MediaBox [0 0 1224.00 792.00]'), '17 x 11 in pages').toBe(true);
  expect(got.filters.every(f => f === '/Filter /FlateDecode'), 'lossless').toBe(true);
  expect(got.name).toMatch(/sheets .*\.pdf$/);
  expect(got.size).toBeGreaterThan(10000);
  expect(await balance(page), 'five bones for the PDF').toBe(2);
  await expect(page.locator('#bone-balance')).toHaveText('2');
  await expect(page.locator('#lay-print-scrim')).toBeHidden();
  await expect(page.locator('[data-layout-status]')).toHaveText(/SAVED \d SHEETS AS PDF/);
  await expect(page.locator('[data-backup-email]')).toContainText('1 bone more (you have 2)');
});

test('the PDF opens in pdf.js with the right page count', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await bones(page, 7);
  await page.evaluate(() => {
    window.__pdf = null;
    window.__draftPdfCapture = async ({ blob }) => { window.__pdfBytes = new Uint8Array(await blob.arrayBuffer()); window.__pdf = 1; };
  });
  await page.locator('#bone').click();
  await pdf(page).click();
  await page.waitForFunction(() => window.__pdf, null, { timeout: 60000 });
  const pages = await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script'); s.src = './vendor/pdf-3.11.174.min.js';
      s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
    });
    const lib = window.pdfjsLib || window['pdfjs-dist/build/pdf'];
    lib.GlobalWorkerOptions.workerSrc = './vendor/pdf-3.11.174.worker.min.js';
    const doc = await lib.getDocument({ data: window.__pdfBytes }).promise;
    const first = await doc.getPage(1);
    const view = first.getViewport({ scale: 1 });
    return { count: doc.numPages, w: view.width, h: view.height };
  });
  expect(pages.count).toBeGreaterThan(2);
  expect([pages.w, pages.h]).toEqual([1224, 792]);
});

test('4 bones: SAVE PDF is greyed and refused, PRINT still goes; 1 bone greys both', async ({ page }) => {
  await openLayout(page, boneDrawing());
  await bones(page, 4);
  await capturePrints(page);
  await page.evaluate(() => { window.__pdf = null; window.__draftPdfCapture = () => { window.__pdf = 1; }; });
  await page.locator('[data-layout-print]').click();
  await expect(page.locator('#lay-print-scrim')).toBeVisible();
  await expect(toll(page)).toHaveText('PRINT costs 2 bones, SAVE PDF costs 5 bones (you have 4). A free bone drips in every hour.');
  await expect(pdf(page)).toBeDisabled();
  await expect(go(page)).toBeEnabled();
  // A press that got through anyway is refused by the package itself.
  await page.evaluate(() => document.querySelector('[data-print-pdf]').removeAttribute('disabled'));
  await pdf(page).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__pdf)).toBeNull();
  expect(await balance(page), 'nothing spent').toBe(4);
  await expect(page.locator('#lay-print-scrim')).toBeVisible();
  await bones(page, 1);
  await page.locator('[data-print-all]').click();
  await expect(go(page)).toBeDisabled();
  await expect(pdf(page)).toBeDisabled();
  await page.evaluate(() => document.querySelector('[data-print-go]').removeAttribute('disabled'));
  await go(page).click();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__captured)).toBeNull();
  expect(await balance(page), 'nothing spent').toBe(1);
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
  // The same for the PDF press, and for a writer that fails.
  await page.locator('#lay-print-close').click();
  await page.locator('#bone').click();
  await pdf(page).click();
  await expect(page.locator('[data-print-message]')).toContainText('Could not prepare the package: no ink.');
  expect(await balance(page)).toBe(7);
  await page.evaluate(() => {
    delete window.__layoutPage._printSheetCanvas;
    window.DraftPdfWriter = { write: async () => { throw new Error('no paper'); } };
  });
  await page.locator('#lay-print-close').click();
  await page.locator('#bone').click();
  await pdf(page).click();
  await expect(page.locator('[data-print-message]')).toContainText('Could not write the PDF: no paper.');
  expect(await balance(page), 'a failed PDF spends nothing').toBe(7);
});
