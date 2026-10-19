// A LINE'S WEIGHT, COLOUR AND STYLE REACH THE SHEET AND THE DXF (Movie,
// 19 Oct, after #811 gave the LINE its properties): "do your line stuff".
//
// #811 made a line's weight, colour and style the Model Space's; the sheet
// still stroked every line at one width in one ink, so what printed was
// not what was drawn, and SAVE DXF -- which records what the sheet
// strokes -- handed the engineer a plain CONTINUOUS line. plan-composition's
// strokeLines reads the same table now, and the DXF names what it was
// given: the linetype off the dash, the colour on the entity.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('@playwright/test');

const BUCKET = 'model-drawing';
const point = (x, z) => ({ x, y: 0, z });
const L = (id, a, b, extra = {}) => ({ id, start: point(...a), end: point(...b), levelId: 1, view: 'plan', layer: 'draft', ...extra });
function drawing(lines) {
  const wall = (id, sx, sz, ex, ez) => ({
    id, start: point(sx, sz), end: point(ex, ez), levelId: 1, view: 'plan',
    wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left',
  });
  return {
    version: 1,
    levels: [{ id: 0, name: 'FOUNDATION', elev: -8 }, { id: 1, name: 'MAIN FL', elev: 0 }],
    walls: [wall(1, 0, 0, 24, 0), wall(2, 24, 0, 24, 16), wall(3, 24, 16, 0, 16), wall(4, 0, 16, 0, 0)],
    lines,
    fenestrations: [],
    layout: {
      auto: false, nextViewportId: 2, sheets: [{ title: '' }],
      viewports: [{ id: 1, kind: 'plan', levelId: 1, pif: 0.25, xIn: 8, yIn: 5, sheet: 1 }],
    },
  };
}
async function openLayout(page, saved) {
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
  }, { bucket: BUCKET, saved });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForTimeout(400);
}
// RED PIXELS ON THE SHEET, counted over the whole canvas: the walls and the
// titleblock are black and grey, so red is the line and nothing else.
const redOnSheet = page => page.evaluate(() => {
  const canvas = document.querySelector('[data-layout-canvas]');
  const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let red = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) red += 1;
  return red;
});
function unzipStored(buf) {
  const files = {};
  let at = 0;
  while (buf.readUInt32LE(at) === 0x04034b50) {
    const size = buf.readUInt32LE(at + 18);
    const nameLen = buf.readUInt16LE(at + 26), extra = buf.readUInt16LE(at + 28);
    const name = buf.slice(at + 30, at + 30 + nameLen).toString('utf8');
    const start = at + 30 + nameLen + extra;
    files[name] = buf.slice(start, start + size).toString('utf8');
    at = start + size;
  }
  return files;
}
const reader = (() => {
  const win = {};
  const sandbox = { window: win, Math, Number, String, Object, Array, JSON, Map, Set, parseFloat, parseInt, isFinite };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'dxf-reader.js'), 'utf8'), sandbox);
  return win.DraftDxfReader;
})();

test('a red XTRA-BOLD dot-dash line prints red on the sheet, and a plain line prints as it always did', async ({ page }) => {
  await openLayout(page, drawing([L('plain', [2, 2], [22, 2])]));
  const before = await redOnSheet(page);
  expect(before).toBe(0);
  await openLayout(page, drawing([L('plain', [2, 2], [22, 2]), L('hot', [2, 8], [22, 8], { weight: 6, style: 'dotdash', color: '#ff0000' })]));
  const after = await redOnSheet(page);
  expect(after, 'the red line is on the sheet').toBeGreaterThan(40);
});

test('SAVE DXF names the dot dash CENTER and carries the red on the line; the plain line stays CONTINUOUS on its layer\'s colour', async ({ page }, info) => {
  await openLayout(page, drawing([L('plain', [2, 2], [22, 2]), L('hot', [2, 8], [22, 8], { weight: 6, style: 'dotdash', color: '#ff0000' })]));
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-layout-dxf]').click()]);
  const file = info.outputPath('sheets.zip');
  await download.saveAs(file);
  const files = unzipStored(fs.readFileSync(file));
  const plan = Object.keys(files).find(n => / MAIN FL PLAN\.dxf$/.test(n));
  expect(plan, `a MAIN FL PLAN among ${Object.keys(files).join(', ')}`).toBeTruthy();
  const text = files[plan];
  expect(text, 'the CENTER linetype is in the table').toMatch(/\r\nLTYPE\r\n2\r\nCENTER\r\n/);
  // The red line: a LINE on DRAFT with linetype CENTER and colour 1 (red).
  expect(text).toMatch(/\r\nLINE\r\n8\r\nDRAFT\r\n6\r\nCENTER\r\n62\r\n1\r\n/);
  // The plain line: a LINE on DRAFT with neither.
  expect(text).toMatch(/\r\nLINE\r\n8\r\nDRAFT\r\n10\r\n/);
  expect(() => reader.parse(text), 'the file reads back').not.toThrow();
});
