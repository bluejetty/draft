// ARROW ENDS ON A LINE (jb, 16 Nov 2026): "can we add a OBJ / PROP part
// for LINE that allows the user to put ARROWS on each one of the lines or
// just one of the ends".
//
// The LINE panel gets an ARROWS row -- NONE / START / END / BOTH, START
// being the end the line was drawn FROM -- writing every picked line in one
// UNDO. The heads draw on the Model Space, on the LAYOUT sheet (and so in
// print and PDF, which paint the sheet), and SAVE DXF keeps them as SOLIDs.
// Arrows are the picked lines' own: the next line drawn has none.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const L = (id, a, b, extra = {}) => ({ id, start: { x: a[0], y: 0, z: a[1] }, end: { x: b[0], y: 0, z: b[1] },
  levelId: 3, view: 'plan', layer: 'draft', ...extra });
const drawing = (lines = []) => ({
  version: 1, board: 'drafting', planTurn: 0, levels: [{ id: 3, name: 'MAIN FL', elev: 0 }], activeLevelIdx: 0,
  nextDrawingItemId: 50,
  walls: [], lines, floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
});
const URL = '/MODEL.html?level=3&left=1&lpane=drafting';

async function open(page, f, { keepStorage = false } = {}) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f, keep }) => {
    if (!keep) { try { localStorage.setItem('draft-skin', JSON.stringify({ tsquare: false, footLight: false })); } catch { /* fine */ } }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f, keep: keepStorage });
  await page.goto(URL);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
async function zoomTo(page, target) {
  const box = await page.locator('#plan').boundingBox();
  const { scale } = await h.planFrame(page);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -Math.log(target / scale) / 0.0015);
  await page.waitForTimeout(120);
  const frame = await h.planFrame(page);
  expect(Math.abs(frame.scale - target)).toBeLessThan(target * 0.05);
  return frame;
}
const saved = async page => {
  await page.keyboard.press('Escape');
  await expect(page.locator('#save')).toBeEnabled({ timeout: 4000 });
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};
const undo = async page => { await page.keyboard.press('Escape'); await page.locator('#model-undo').click(); await page.waitForTimeout(80); };
async function selectLine(page, at, x, z) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await page.mouse.click(...at(x, z));
  await page.waitForTimeout(120);
  await expect(page.locator('[data-line-weight]')).toHaveCount(6);
}
const setColor = async (page, hex) => {
  await page.locator('[data-line-color]').evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, hex);
  await page.waitForTimeout(80);
};
// THE INK ON THE SHEET: pixels in a box around a world point that are not
// the background (sampled well away from any line), and how many are red.
const ink = (page, x, z, halfW, halfH) => page.evaluate(([wx, wz, hw, hh]) => {
  const c = document.getElementById('plan');
  const [cx, cz, scale] = c.getAttribute('data-view').trim().split(/\s+/).map(Number);
  const r = c.getBoundingClientRect();
  const dpr = c.width / r.width;
  const px = Math.round(((wx - cx) * scale + r.width / 2) * dpr);
  const py = Math.round(((wz - cz) * scale + r.height / 2) * dpr);
  const g = c.getContext('2d');
  const bg = g.getImageData(px, py - Math.round(40 * dpr), 1, 1).data;
  const d = g.getImageData(px - hw, py - hh, hw * 2 + 1, hh * 2 + 1).data;
  let on = 0, red = 0;
  for (let i = 0; i < d.length; i += 4) {
    const diff = Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]);
    if (diff > 60) on += 1;
    if (d[i] > 180 && d[i + 1] < 90 && d[i + 2] < 90) red += 1;
  }
  return { on, red };
}, [x, z, halfW, halfH]);
// THE COVERAGE ALONG THE LINE: of N columns between two world points, how
// many carry ink on the line itself.
const coverage = (page, x0, x1, z) => page.evaluate(([ax, bx, wz]) => {
  const c = document.getElementById('plan');
  const [cx, cz, scale] = c.getAttribute('data-view').trim().split(/\s+/).map(Number);
  const r = c.getBoundingClientRect();
  const dpr = c.width / r.width;
  const py = Math.round(((wz - cz) * scale + r.height / 2) * dpr);
  const g = c.getContext('2d');
  const bg = g.getImageData(Math.round(((ax - cx) * scale + r.width / 2) * dpr), py - Math.round(40 * dpr), 1, 1).data;
  let on = 0, n = 0;
  for (let wx = ax; wx <= bx; wx += (bx - ax) / 80) {
    const px = Math.round(((wx - cx) * scale + r.width / 2) * dpr);
    const d = g.getImageData(px, py - 2, 1, 5).data;
    let hit = false;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 60) hit = true;
    }
    n += 1; if (hit) on += 1;
  }
  return on / n;
}, [x0, x1, z]);


const sheetDrawing = lines => {
  const point = (x, z) => ({ x, y: 0, z });
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
};
async function openLayout(page, f) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('draft-test-storage-cleared')) return;
    sessionStorage.setItem('draft-test-storage-cleared', '1');
    indexedDB.deleteDatabase('pdf-img-mgr-shared');
    localStorage.clear();
  });
  await page.goto('/LAYOUT.html');
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.evaluate(async ({ bucket, f }) => {
    await window.SharedFileStore.saveSharedFile(new File([JSON.stringify(f)], 'model-drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f });
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.layoutReady === '1');
  await page.waitForTimeout(400);
}
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

test('ARROWS: NONE / START / END / BOTH on the LINE panel; START is the first-click end; one UNDO each', async ({ page }) => {
  // Drawn from x=0 (START) to x=10 (END).
  await open(page, drawing([L('l1', [0, 0], [10, 0], { color: '#ff0000' })]));
  const { at } = await zoomTo(page, 40);
  const red = async (x) => (await ink(page, x, 0, 4, 8)).on;
  const plainStart = await red(0.15), plainEnd = await red(9.85);
  await selectLine(page, at, 5, 0);
  await expect(page.locator('[data-line-arrows]')).toHaveCount(4);
  await expect(page.locator('[data-line-arrows="none"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-line-arrows-hint]')).toContainText('START = THE END YOU CLICKED FIRST');
  await page.locator('[data-line-arrows="end"]').click();
  await expect(page.locator('[data-line-arrows="end"]')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  expect(await red(9.85), 'a head at the END (x=10)').toBeGreaterThan(plainEnd + 10);
  expect(await red(0.15), 'nothing new at the START (x=0)').toBe(plainStart);
  let d = await saved(page);
  expect(d.lines[0].arrows).toBe('end');
  await selectLine(page, at, 5, 0);
  await page.locator('[data-line-arrows="start"]').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  expect(await red(0.15), 'a head at the START (x=0)').toBeGreaterThan(plainStart + 10);
  expect(await red(9.85)).toBe(plainEnd);
  await selectLine(page, at, 5, 0);
  await page.locator('[data-line-arrows="both"]').click();
  d = await saved(page);
  expect(d.lines[0].arrows).toBe('both');
  // Read back from the file, the chip says so.
  await open(page, d, { keepStorage: true });
  const again = await zoomTo(page, 40);
  await selectLine(page, again.at, 5, 0);
  await expect(page.locator('[data-line-arrows="both"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-line-arrows="none"]').click();
  d = await saved(page);
  expect('arrows' in d.lines[0], 'NONE writes no key').toBe(false);
  await undo(page);
  d = await saved(page);
  expect(d.lines[0].arrows).toBe('both');
});

test('ARROWS write every picked line at once, and the next line drawn has none', async ({ page }) => {
  await open(page, drawing([L('l1', [0, 0], [10, 0]), L('l2', [0, 3], [10, 3])]));
  const { at } = await zoomTo(page, 40);
  await page.keyboard.press('s');
  await page.mouse.click(...at(5, 0));
  await page.keyboard.down('Shift');
  await page.mouse.click(...at(5, 3));
  await page.keyboard.up('Shift');
  await page.waitForTimeout(120);
  await expect(page.locator('[data-line-arrows]')).toHaveCount(4);
  await page.locator('[data-line-arrows="both"]').click();
  let d = await saved(page);
  expect(d.lines.map(l => l.arrows)).toEqual(['both', 'both']);
  await page.keyboard.press('Escape');
  await page.keyboard.press('l');
  await page.mouse.click(...at(0, 6));
  await page.mouse.click(...at(8, 6));
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  d = await saved(page);
  expect(d.lines.length).toBe(3);
  expect('arrows' in d.lines[2]).toBe(false);
});

test('arrow heads print on the LAYOUT sheet and SAVE DXF keeps them as SOLIDs', async ({ page }, info) => {
  const L1 = (id, a, b, extra) => ({ ...L(id, a, b, extra), levelId: 1 });
  await openLayout(page, sheetDrawing([L1('hot', [2, 8], [22, 8], { color: '#ff0000', weight: 6 })]));
  const bare = await redOnSheet(page);
  await openLayout(page, sheetDrawing([L1('hot', [2, 8], [22, 8], { color: '#ff0000', weight: 6, arrows: 'both' })]));
  const headed = await redOnSheet(page);
  expect(headed, `two heads add red (${bare} -> ${headed})`).toBeGreaterThan(bare + 20);
  await page.evaluate(() => localStorage.setItem('draft-bone-wallet',
    JSON.stringify({ balance: 20, lastDripAt: Date.now(), createdAt: Date.now() })));
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-layout-dxf]').click()]);
  const file = info.outputPath('sheets.zip');
  await download.saveAs(file);
  const files = unzipStored(fs.readFileSync(file));
  const plan = Object.keys(files).find(n => / MAIN FL PLAN\.dxf$/.test(n));
  expect(plan).toBeTruthy();
  const solids = (files[plan].match(/\r\nSOLID\r\n8\r\nDRAFT\r\n/g) || []).length;
  expect(solids, 'two arrowheads on the DRAFT layer').toBe(2);
});
