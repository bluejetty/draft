// INSERT PHOTO / PDF (#147): the top-bar INSERT button opens an
// inspect-before-convert card. Vector PDFs keep their original bytes (small,
// sharp, re-render at any zoom) with the paper scale read off the titleblock
// text; raster PDFs and photos convert once to a compressed project image.
// The result lands as a non-editable underlay drawn beneath the plan and
// survives a reload from the shared file store's `underlays` bucket.
const { test, expect } = require('@playwright/test');
const h = require('./helpers');

// 16x12 solid (200, 60, 60) red PNG — enough to spot on the overlay canvas.
const RED_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAMCAIAAADkharWAAAAF0lEQVR4nGM8YWPDQApgIkn1'
  + 'qIYRpAEA+wYBWOgi8hcAAAAASUVORK5CYII=',
  'base64',
);

// Hand-built one-page PDFs: makePdf wires the object bodies into a valid
// xref so pdf.js parses them. The vector one carries text (with a titleblock
// scale note) and stroked paths; the raster one is a single image XObject.
function makePdf(objs) {
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i < objs.length; i += 1) {
    offsets[i] = pdf.length;
    pdf += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}

function vectorPdf() {
  const stream = 'BT /F1 14 Tf 72 700 Td (SCALE: 1/4\\" = 1\'-0\\") Tj ET\n'
    + '1 w 72 100 m 500 100 l S 72 120 m 500 120 l S 72 140 m 300 140 l S '
    + '100 200 m 100 600 l S 200 200 m 200 600 l S';
  return makePdf([
    null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]);
}

function rasterPdf() {
  const imgData = Buffer.alloc(3 * 4 * 4, 200).toString('binary');
  const stream = 'q 612 0 0 792 0 0 cm /Im1 Do Q';
  return makePdf([
    null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    `<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${imgData.length} >>\nstream\n${imgData}\nendstream`,
  ]);
}

// A scan wearing an OCR layer: one page-filling image plus INVISIBLE text
// (text rendering mode 3) carrying the titleblock scale note.
function ocrPdf() {
  const imgData = Buffer.alloc(3 * 4 * 4, 200).toString('binary');
  const stream = 'q 612 0 0 792 0 0 cm /Im1 Do Q\n'
    + 'BT 3 Tr /F1 14 Tf 72 700 Td (SCALE: 1/4\\" = 1\'-0\\") Tj ET';
  return makePdf([
    null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> /Font << /F1 6 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    `<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${imgData.length} >>\nstream\n${imgData}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]);
}

// The construction-PDF reality: real vector linework and visible text with
// an embedded raster image riding along.
function hybridPdf() {
  const imgData = Buffer.alloc(3 * 4 * 4, 200).toString('binary');
  const stream = 'BT /F1 14 Tf 72 700 Td (SCALE: 1/4\\" = 1\'-0\\") Tj ET\n'
    + '1 w 72 100 m 500 100 l S 72 120 m 500 120 l S 72 140 m 300 140 l S '
    + '100 200 m 100 600 l S 200 200 m 200 600 l S\n'
    + 'q 100 0 0 100 300 300 cm /Im1 Do Q';
  return makePdf([
    null,
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> /Font << /F1 6 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    `<< /Type /XObject /Subtype /Image /Width 4 /Height 4 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${imgData.length} >>\nstream\n${imgData}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]);
}

async function pickFile(page, name, mimeType, buffer) {
  await page.locator('[data-insert-underlay]').click();
  await page.locator('[data-underlay-import]').setInputFiles({ name, mimeType, buffer });
  await expect(page.locator('[data-insert-verdict]')).toBeVisible({ timeout: 15000 });
}

async function storedUnderlayFiles(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('pdf-img-mgr-shared', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const records = await new Promise((resolve, reject) => {
      const req = db.transaction('files').objectStore('files').get('underlays');
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return records.map(r => ({ name: r.name, type: r.type, size: r.blob.size }));
  });
}

test('vector PDF: inspect card reads the titleblock scale and keeps the original bytes', async ({ page }) => {
  await h.openModel(page);
  await pickFile(page, 'plan.pdf', 'application/pdf', vectorPdf());

  await expect(page.locator('[data-insert-verdict]')).toContainText('VECTOR PDF');
  await expect(page.locator('[data-insert-info]')).toContainText('plan.pdf');
  await expect(page.locator('[data-insert-info]')).toContainText('PAGES');
  // Titleblock scale auto-detected and pre-selected into the scale field.
  await expect(page.locator('[data-insert-scale-input]')).toHaveValue(`1/4" = 1'-0"`);

  await page.locator('[data-insert-confirm]').click();
  await h.waitForSaved(page);
  await expect(page.locator('[data-insert-dialog]')).toHaveCount(0);

  const drawing = await h.savedDrawing(page);
  expect(drawing.underlays).toHaveLength(1);
  const underlay = drawing.underlays[0];
  expect(underlay.kind).toBe('pdf');
  expect(underlay.name).toBe('plan.pdf');
  expect(underlay.layer).toBe('UNDERLAY');
  expect(underlay.scaleRatio).toBe(48);
  // 8.5x11 page at 1/4" = 1'-0" spans 34ft x 44ft of real building.
  expect(h.near(underlay.widthFt, 34, 0.1)).toBe(true);
  expect(h.near(underlay.heightFt, 44, 0.1)).toBe(true);

  // The binary stays the original PDF — no raster conversion.
  const files = await storedUnderlayFiles(page);
  expect(files).toHaveLength(1);
  expect(files[0].type).toBe('application/pdf');
});

test('image-based PDF converts once to a compressed image', async ({ page }) => {
  await h.openModel(page);
  await pickFile(page, 'scan.pdf', 'application/pdf', rasterPdf());

  await expect(page.locator('[data-insert-verdict]')).toContainText('IMAGE-BASED');
  // No titleblock scale to read, so the width fallback sizes the underlay.
  await page.locator('[data-insert-width-input]').fill(`30'`);
  await page.locator('[data-insert-confirm]').click();
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.underlays).toHaveLength(1);
  expect(drawing.underlays[0].kind).toBe('image');
  expect(h.near(drawing.underlays[0].widthFt, 30, 0.1)).toBe(true);

  const files = await storedUnderlayFiles(page);
  expect(files).toHaveLength(1);
  expect(files[0].type).toBe('image/webp');
});

test('OCR scan: invisible text layer is caught, scale still read, converts to an image', async ({ page }) => {
  await h.openModel(page);
  await pickFile(page, 'ocr-scan.pdf', 'application/pdf', ocrPdf());

  // The invisible OCR text must not pass for live vector text…
  await expect(page.locator('[data-insert-verdict]')).toContainText('OCR SCAN');
  // …but its titleblock scale note is still read and pre-selected.
  await expect(page.locator('[data-insert-scale-input]')).toHaveValue(`1/4" = 1'-0"`);

  await page.locator('[data-insert-confirm]').click();
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.underlays).toHaveLength(1);
  expect(drawing.underlays[0].kind).toBe('image');
  expect(drawing.underlays[0].scaleRatio).toBe(48);
  expect(h.near(drawing.underlays[0].widthFt, 34, 0.1)).toBe(true);

  const files = await storedUnderlayFiles(page);
  expect(files[0].type).toBe('image/webp');
});

test('hybrid PDF (vector linework + embedded image) keeps the original bytes', async ({ page }) => {
  await h.openModel(page);
  await pickFile(page, 'hybrid.pdf', 'application/pdf', hybridPdf());

  await expect(page.locator('[data-insert-verdict]')).toContainText('HYBRID');
  await page.locator('[data-insert-confirm]').click();
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.underlays[0].kind).toBe('pdf');
  const files = await storedUnderlayFiles(page);
  expect(files[0].type).toBe('application/pdf');
});

test('CALIBRATE: mark a known distance on an image-based PDF to compute the scale', async ({ page }) => {
  await h.openModel(page);
  await pickFile(page, 'scan.pdf', 'application/pdf', rasterPdf());

  await page.locator('[data-insert-calibrate]').click();
  const img = page.locator('[data-insert-cal-img]');
  await expect(img).toBeVisible();
  const box = await img.boundingBox();
  // Marks a quarter in from each side: half the 8.5" page width apart.
  await img.click({ position: { x: box.width * 0.25, y: box.height * 0.5 } });
  await img.click({ position: { x: box.width * 0.75, y: box.height * 0.5 } });
  // 4.25 paper inches representing 17' of building is exactly 1:48.
  await page.locator('[data-insert-cal-length]').fill(`17'`);
  await page.locator('[data-insert-cal-apply]').click();

  await expect(page.locator('[data-insert-scale-input]')).toHaveValue(/calibrated/);
  await page.locator('[data-insert-confirm]').click();
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(h.near(drawing.underlays[0].scaleRatio, 48, 0.5)).toBe(true);
  expect(h.near(drawing.underlays[0].widthFt, 34, 0.4)).toBe(true);
});

test('photo converts to a compressed image, draws under the plan, and survives reload', async ({ page }) => {
  await h.openModel(page);
  await pickFile(page, 'site-photo.png', 'image/png', RED_PNG);

  await expect(page.locator('[data-insert-verdict]')).toContainText('PHOTO / IMAGE');
  await expect(page.locator('[data-insert-info]')).toContainText('16 × 12');
  await page.locator('[data-insert-width-input]').fill(`40'`);
  await page.locator('[data-insert-confirm]').click();
  await h.waitForSaved(page);

  const drawing = await h.savedDrawing(page);
  expect(drawing.underlays).toHaveLength(1);
  expect(drawing.underlays[0].kind).toBe('image');

  // The red image renders on the overlay canvas at the world origin.
  const centre = await h.worldToClient(page, 0, 0);
  const pixels = await h.overlayPixels(page, centre.x, centre.y, 20);
  expect(h.countColor(pixels, [200, 60, 60], 60)).toBeGreaterThan(0);

  await page.reload();
  await expect(page.locator('[data-model-canvas]')).toBeVisible();
  await page.waitForTimeout(1500);
  const restored = await h.savedDrawing(page);
  expect(restored.underlays).toHaveLength(1);
  const after = await h.overlayPixels(page, centre.x, centre.y, 20);
  expect(h.countColor(after, [200, 60, 60], 60)).toBeGreaterThan(0);
});

test('manual scale entry overrides sizing and REMOVE deletes the underlay and its binary', async ({ page }) => {
  await h.openModel(page);
  await pickFile(page, 'plan.pdf', 'application/pdf', vectorPdf());

  // Retype the scale by hand: 1/8" = 1'-0" doubles the real-world span.
  await page.locator('[data-insert-scale-input]').fill(`1/8" = 1'-0"`);
  await page.locator('[data-insert-confirm]').click();
  await h.waitForSaved(page);

  let drawing = await h.savedDrawing(page);
  expect(drawing.underlays[0].scaleRatio).toBe(96);
  expect(h.near(drawing.underlays[0].widthFt, 68, 0.1)).toBe(true);

  // The card lists placed underlays; REMOVE clears metadata and binary.
  await page.locator('[data-insert-underlay]').click();
  await page.locator('[data-insert-remove]').click();
  await h.waitForSaved(page);

  drawing = await h.savedDrawing(page);
  expect(drawing.underlays).toHaveLength(0);
  expect(await storedUnderlayFiles(page)).toHaveLength(0);
});
