// A LINE'S WEIGHT, COLOUR AND STYLE (Movie, 19 Oct).
//
// "for the LINE -- it need some PROPERTIES that can change too. put in 5
// line weights from thin to thick (ones that we already use if we already
// have 5, if we have less or more than 5 let me know. also we should allow
// the user to select line color from full spectrum as another property, and
// also if the line is DASHED (stuff above), SOLID, DOT DASHED (property
// lines / beams), etc" -- then "Add 4.5 XTRA-BOLD".
//
// The sheets stroked at a dozen unnamed widths; line-styles.js names six.
// The LINE panel offers them with four styles and the full spectrum, a
// change writes every selected line in one undo, the last choice is the
// next line's default and survives a reload, and a line from before today
// carries none of the three and draws as it did.
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
    if (!keep) { try { localStorage.removeItem('draft-skin'); } catch { /* fine */ } }
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

test('the LINE panel offers six weights, four styles and a colour; each writes the line and one UNDO takes it back', async ({ page }) => {
  await open(page, drawing([L('l1', [0, 0], [10, 0])]));
  const { at } = await zoomTo(page, 40);
  await selectLine(page, at, 5, 0);
  await expect(page.locator('[data-line-weight="6"]')).toContainText('XTRA-BOLD');
  await expect(page.locator('[data-line-style]')).toHaveCount(4);
  await expect(page.locator('[data-line-color]')).toHaveAttribute('type', 'color');
  // A line from before carries none of the three, and reads as what it
  // draws as: FINE, SOLID, in the SKIN's ink.
  await expect(page.locator('[data-line-weight="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-line-style="solid"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-line-color-skin]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-line-weight="6"]').click();
  await page.locator('[data-line-style="dotdash"]').click();
  await setColor(page, '#ff8800');
  let d = await saved(page);
  let line = d.lines[0];
  expect([line.weight, line.style, line.color]).toEqual([6, 'dotdash', '#ff8800']);
  // AND THE FILE READ BACK KEEPS THEM: the saved drawing opened afresh, the
  // chips say so when the line is picked again.
  await open(page, d, { keepStorage: true });
  const again = await zoomTo(page, 40);
  await selectLine(page, again.at, 5, 0);
  await expect(page.locator('[data-line-weight="6"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-line-style="dotdash"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-line-color]')).toHaveValue('#ff8800');
  // Back on the first drawing for the undo: three changes, one at a time.
  await open(page, drawing([L('l1', [0, 0], [10, 0])]), { keepStorage: true });
  const first = await zoomTo(page, 40);
  await selectLine(page, first.at, 5, 0);
  await page.locator('[data-line-weight="6"]').click();
  await page.locator('[data-line-style="dotdash"]').click();
  await setColor(page, '#ff8800');
  await selectLine(page, first.at, 5, 0);
  await expect(page.locator('[data-line-weight="6"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-line-style="dotdash"]')).toHaveAttribute('aria-pressed', 'true');
  // UNDO, one change at a time, back to a line with none of the three.
  await undo(page);
  line = (await saved(page)).lines[0];
  expect([line.weight, line.style, line.color]).toEqual([6, 'dotdash', undefined]);
  await undo(page);
  await undo(page);
  line = (await saved(page)).lines[0];
  expect('weight' in line || 'style' in line || 'color' in line).toBe(false);
});

test('the ink follows: XTRA-BOLD paints thick, DOTTED breaks, red is red', async ({ page }) => {
  await open(page, drawing([L('l1', [0, 0], [10, 0])]));
  const { at } = await zoomTo(page, 40);
  const thin = await ink(page, 5, 0, 1, 6);
  expect(thin.on).toBeGreaterThan(0);
  expect(thin.on).toBeLessThanOrEqual(9);
  expect(thin.red).toBe(0);
  expect(await coverage(page, 1, 9, 0)).toBeGreaterThan(0.9);
  await selectLine(page, at, 5, 0);
  await page.locator('[data-line-weight="6"]').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const bold = await ink(page, 5, 0, 1, 6);
  expect(bold.on, `XTRA-BOLD lays more ink across the line than FINE (${thin.on} -> ${bold.on})`).toBeGreaterThan(thin.on + 6);
  await selectLine(page, at, 5, 0);
  await page.locator('[data-line-style="dotted"]').click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  expect(await coverage(page, 1, 9, 0)).toBeLessThan(0.75);
  await selectLine(page, at, 5, 0);
  await page.locator('[data-line-style="solid"]').click();
  await setColor(page, '#ff0000');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  expect((await ink(page, 5, 0, 1, 6)).red).toBeGreaterThan(6);
});

test('the last choice sticks: the next line drawn takes it, and a reload remembers it', async ({ page }) => {
  await open(page, drawing([L('l1', [0, 0], [10, 0])]));
  const { at } = await zoomTo(page, 40);
  await selectLine(page, at, 5, 0);
  await page.locator('[data-line-weight="5"]').click();
  await page.locator('[data-line-style="dashed"]').click();
  await setColor(page, '#0066ff');
  // Draw another line: it takes the same.
  await page.keyboard.press('Escape');
  await page.keyboard.press('l');
  await page.mouse.click(...at(0, 4));
  await page.mouse.click(...at(10, 4));
  let d = await saved(page);
  const drawn = d.lines.find(l => l.id !== 'l1');
  expect([drawn.weight, drawn.style, drawn.color]).toEqual([5, 'dashed', '#0066ff']);
  // Reload the page (the drawing afresh, the browser's memory kept): the
  // next line still takes it.
  await open(page, drawing([L('l1', [0, 0], [10, 0])]), { keepStorage: true });
  const again = await zoomTo(page, 40);
  await page.keyboard.press('l');
  await page.mouse.click(...again.at(0, 4));
  await page.mouse.click(...again.at(10, 4));
  d = await saved(page);
  const later = d.lines.find(l => l.id !== 'l1');
  expect([later.weight, later.style, later.color]).toEqual([5, 'dashed', '#0066ff']);
});
