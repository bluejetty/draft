// A FILE DROPPED ON THE SHEET COMES IN TO TRACE OVER (Movie, 23 Oct, dragging
// a PDF from his file manager onto the sheet): "if a user is in their file
// with pdfs or image and want to DRAG and DROP on onto the model space area,
// can we allow them to bring it in as a background image/pdf?"
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const V = (x, z) => ({ x, y: 0, z });
const house = () => ({ version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 }, { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 2,
  walls: [['n', V(0, 0), V(40, 0)], ['e', V(40, 0), V(40, 30)], ['s', V(40, 30), V(0, 30)], ['w', V(0, 30), V(0, 0)]]
    .map(([id, start, end]) => ({ id, start, end, levelId: 3, view: 'plan', wallType: 'stud_2x6', baseHeight: 0, topHeight: 8, refLine: 'left' })),
  lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [], outlines: [], shapes: [], surfaceOpenings: [], stairs: [],
  notes: [], roomTags: [], columns: [], beams: [], boneyardOutlines: [], boneyardShelves: [], groups: [], levelLocks: [], underlays: [], nextDrawingItemId: 20 });

async function open(page, url = '/MODEL.html?level=3') {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft.trace.on'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: house() });
  await page.goto(url);
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
  await page.waitForTimeout(150);
}
const card = page => page.locator('#trace-insert');
// A DRAG EVENT CARRYING A FILE, made in the page the way a file manager's
// drop arrives: a DataTransfer with the file in it, let go at a point.
// `name` and `type` say what the file is; the bytes are a small picture.
const dropFile = (page, selector, kind, point, { name = 'plan.png', type = 'image/png', text = null } = {}) =>
  page.evaluate(async ({ selector, kind, point, name, type, text }) => {
    const bytes = text != null ? new Blob([text], { type }) : await new Promise(res => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 200;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 200);
      g.fillStyle = '#000'; g.fillRect(20, 20, 360, 160);
      c.toBlob(res, 'image/png');
    });
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], name, { type }));
    const el = document.querySelector(selector);
    const ev = new DragEvent(kind, { dataTransfer: dt, bubbles: true, cancelable: true, clientX: point[0], clientY: point[1] });
    const notCancelled = el.dispatchEvent(ev);
    return { defaultPrevented: !notCancelled };
  }, { selector, kind, point, name, type, text });
const saved = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return h.savedDrawing(page);
};

test('a photo dropped on the sheet opens the trace card, and INSERT lands it centred where it was let go', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  const point = at(60, 10);
  await dropFile(page, '#plan', 'drop', point);
  await expect(card(page)).toBeVisible();
  await expect(card(page).locator('[data-trace-go]')).toBeVisible({ timeout: 10000 });
  await expect(card(page).locator('[data-trace-verdict]')).toHaveText(/PHOTO/);
  await card(page).locator('[data-trace-width]').fill("20'");
  await card(page).locator('[data-trace-go]').click();
  await expect(card(page)).toBeHidden();
  const d = await saved(page);
  expect(d.underlays).toHaveLength(1);
  expect(d.underlays[0].levelId).toBe(3);
  expect(d.underlays[0].x, 'centred where it was let go').toBeCloseTo(60, 1);
  expect(d.underlays[0].z).toBeCloseTo(10, 1);
  expect(d.underlays[0].widthFt).toBeCloseTo(20, 1);
});

test('a file let go on a panel, not the sheet, does nothing -- and the browser does not open it', async ({ page }) => {
  await open(page, '/MODEL.html?level=3&left=1');
  const rail = await page.locator('#left-rail').boundingBox();
  const { defaultPrevented } = await dropFile(page, '#left-rail', 'drop', [rail.x + rail.width / 2, rail.y + rail.height / 2]);
  expect(defaultPrevented, 'the page takes the drop so the browser does not').toBe(true);
  await page.waitForTimeout(200);
  await expect(card(page)).toBeHidden();
  expect((await saved(page)).underlays).toHaveLength(0);
});

test('a file the sheet cannot trace over is refused with a word on the strip', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  await dropFile(page, '#plan', 'drop', at(20, 15), { name: 'notes.txt', type: 'text/plain', text: 'hello' });
  await expect(page.locator('#strip-message')).toContainText('PDF, a photo');
  await expect(card(page)).toBeHidden();
});

test('held over the sheet the sheet says it will take it; off the sheet it stops', async ({ page }) => {
  await open(page);
  const { at } = await h.planFrame(page);
  const { defaultPrevented } = await dropFile(page, '#plan', 'dragover', at(20, 15));
  expect(defaultPrevented, 'dragover is taken, or no drop can follow').toBe(true);
  await expect(page.locator('#plan')).toHaveClass(/drop-here/);
  await dropFile(page, '#plan', 'dragleave', at(20, 15));
  await expect(page.locator('#plan')).not.toHaveClass(/drop-here/);
});

test('the picker after a drop lands its file where the view looks, not at the last drop', async ({ page }) => {
  await open(page);
  const { at, cx, cz } = await h.planFrame(page);
  await dropFile(page, '#plan', 'drop', at(60, 10));
  await expect(card(page).locator('[data-trace-go]')).toBeVisible({ timeout: 10000 });
  await card(page).locator('[data-trace-cancel]').click();
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 200 } });
  await page.locator('[data-trace-file]').setInputFiles({ name: 'site.png', mimeType: 'image/png', buffer: png });
  await expect(card(page).locator('[data-trace-go]')).toBeVisible({ timeout: 10000 });
  await card(page).locator('[data-trace-width]').fill("20'");
  await card(page).locator('[data-trace-go]').click();
  const d = await saved(page);
  expect(d.underlays).toHaveLength(1);
  expect(d.underlays[0].x).toBeCloseTo(cx, 1);
  expect(d.underlays[0].z).toBeCloseTo(cz, 1);
});
