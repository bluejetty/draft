// TRACE: A PHOTO OR A PDF UNDER THE PLAN, ON MODEL.html.
//
// Movie, 7 Oct: "make it an INSTRUMENT PANEL. when you press it it turn ON and
// if there is images already loaded it will show them, click it again and it
// turns off the images turn off. when it is turned on, popup should ask the
// user if they would like to upload another image" -- "the previous version
// model.dc.html could scale PDF plans if there was info, can we add that too"
// -- "also can do that identify line length scal for non pdf stuff".
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

const BUCKET = 'model-drawing';
const BLANK = {
  version: 1, board: 'drafting', planTurn: 0,
  levels: [{ id: 8, name: 'SITE', elev: 0 }, { id: 7, name: 'ROOF', elev: 0 },
    { id: 5, name: '2ND FL', elev: 9 }, { id: 3, name: 'MAIN FL', elev: 0 },
    { id: 1, name: 'FOUNDATION', elev: -8 }],
  activeLevelIdx: 3,
  walls: [], lines: [], floors: [], roofs: [], fenestrations: [], dimensions: [],
  outlines: [], shapes: [], surfaceOpenings: [], stairs: [], notes: [],
  roomTags: [], columns: [], beams: [], boneyardOutlines: [],
  groups: [], levelLocks: [], underlays: [],
};

// A one-page US-letter PDF with a printed scale on it, written out by hand so
// the spec needs no fixture file: 8 1/2" wide at 1/4" = 1'-0" is 34 ft.
function scaledPdf() {
  const stream = 'BT /F1 18 Tf 72 700 Td (SCALE 1/4" = 1\'-0") Tj ET\n'
    + '0 0 0 RG 72 400 m 540 400 l S\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach(off => { out += `${String(off).padStart(10, '0')} 00000 n \n`; });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

async function open(page) {
  await h.openModel(page, { webgl: false });
  await page.evaluate(async ({ bucket, f }) => {
    try { localStorage.removeItem('draft.trace.on'); } catch { /* fine */ }
    await window.SharedFileStore.saveSharedFile(
      new File([JSON.stringify(f)], 'drawing.json', { type: 'application/json' }), bucket);
  }, { bucket: BUCKET, f: BLANK });
  await page.goto('/MODEL.html?level=3');
  await expect(page.locator('#readout')).toContainText('walls', { timeout: 10000 });
}
const chip = page => page.locator('[data-mode-trace]');
const card = page => page.locator('#trace-insert');
const savedUnderlays = async page => {
  await page.locator('#save').click();
  await h.waitForSaved(page);
  return (await h.savedDrawing(page)).underlays || [];
};

test('the chip turns TRACE on, asks to upload, and turns it off again', async ({ page }) => {
  await open(page);
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'false');
  await chip(page).click();
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#trace-ask')).toBeVisible();
  await expect(page.locator('[data-trace-count]')).toContainText('No images on');
  await page.locator('[data-trace-later]').click();
  await expect(page.locator('#trace-ask')).toBeHidden();
  await chip(page).click();
  await expect(chip(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#trace-ask')).toBeHidden();
});

test('a photo comes in at the length CALIBRATE gives it, and hides with TRACE off', async ({ page }) => {
  await open(page);
  // A 400 x 200 picture, made by photographing a corner of the page.
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 400, height: 200 } });
  await chip(page).click();
  await page.locator('[data-trace-upload]').click();
  await page.locator('[data-trace-file]').setInputFiles({ name: 'site.png', mimeType: 'image/png', buffer: png });
  await expect(card(page).locator('[data-trace-go]')).toBeVisible({ timeout: 10000 });
  await expect(card(page).locator('[data-trace-verdict]')).toHaveText(/PHOTO/);
  // A photo has no paper scale -- it gets a width.
  await expect(card(page).locator('[data-trace-scale-row]')).toBeHidden();

  // CALIBRATE: the two ends of a line a quarter of the picture long, 10 ft.
  await card(page).locator('[data-trace-calibrate]').click();
  const img = card(page).locator('[data-trace-preview]');
  const box = await img.boundingBox();
  const natural = await img.evaluate(el => ({ w: el.naturalWidth, h: el.naturalHeight }));
  const k = Math.min(box.width / natural.w, box.height / natural.h);
  const left = box.x + (box.width - natural.w * k) / 2, top = box.y + (box.height - natural.h * k) / 2;
  await page.mouse.click(left + natural.w * k * 0.25, top + natural.h * k * 0.5);
  await page.mouse.click(left + natural.w * k * 0.5, top + natural.h * k * 0.5);
  await card(page).locator('[data-trace-cal-length]').fill(`10'`);
  await card(page).locator('[data-trace-cal-apply]').click();
  await expect(card(page).locator('[data-trace-width]')).toHaveValue(/^(39|40|41)'/);
  await card(page).locator('[data-trace-go]').click();
  await expect(card(page)).toBeHidden();

  const u = await savedUnderlays(page);
  expect(u).toHaveLength(1);
  expect(u[0].levelId).toBe(3);
  expect(u[0].kind).toBe('image');
  expect(Math.abs(u[0].widthFt - 40)).toBeLessThan(1);
  expect(Math.abs(u[0].heightFt - u[0].widthFt / 2)).toBeLessThan(0.5);
  await expect(page.locator('#readout')).not.toContainText('hidden');

  // OFF hides it, and the readout says so rather than looking like a loss.
  await chip(page).click();
  await expect(page.locator('#readout')).toContainText('1 tracing image hidden');
});

test('a PDF with a printed scale comes in at that scale', async ({ page }) => {
  await open(page);
  await chip(page).click();
  await page.locator('[data-trace-upload]').click();
  await page.locator('[data-trace-file]').setInputFiles({ name: 'plan.pdf', mimeType: 'application/pdf', buffer: scaledPdf() });
  await expect(card(page).locator('[data-trace-go]')).toBeVisible({ timeout: 20000 });
  await expect(card(page).locator('[data-trace-scale-chip]').first()).toHaveText(`1/4" = 1'-0"`);
  await expect(card(page).locator('[data-trace-width-row]')).toBeHidden();
  await card(page).locator('[data-trace-go]').click();
  await expect(card(page)).toBeHidden();
  const u = await savedUnderlays(page);
  expect(u).toHaveLength(1);
  expect(u[0].scaleRaw).toBe(`1/4" = 1'-0"`);
  expect(Math.round(u[0].widthFt * 100) / 100).toBe(34);
  expect(Math.round(u[0].heightFt * 100) / 100).toBe(44);
});
