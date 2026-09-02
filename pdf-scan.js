// PDF / photo scan-and-convert machinery for the INSERT flow, extracted so
// it can stand alone (board #183): hand it a File on a `scan` record, get
// back the 4-tier verdict, per-page details, detected scales, and one-time
// converted output. Dependencies: window.pdfjsLib and the canvas the
// rasterizer needs — no component state, no DC framework, no file store,
// no persistence. The record splits into two kinds of fields:
//   report-safe (plain JSON, shaped to become the per-project scan report,
//   board #182): kind, pageCount, tier, isVector, textChars, pathOps,
//   imageOps, pageDims, imgWidth/imgHeight, scalesByPage (plain object
//   keyed by page number), selectedScale;
//   transient handles (never persist): file, pdfDoc, pageCanvas,
//   convertedBlob, previewUrl.
// CALIBRATION EXPECTS A POSITIVE REAL LENGTH. `calibrateScale` does not check
// `realInches`: zero gives a zero-width sheet and a negative gives a NEGATIVE
// one, both reported as `{ ok: true }`, and every measurement taken off that
// underlay afterwards is wrong with nothing on screen to say so.
//
// The guard lives in the caller -- `MODEL.dc.html`'s `_applyInsertCalibration`
// refuses anything not positive before this is reached. A second caller must
// bring its own; it cannot borrow that one.
if (!window.DraftPdfScan) {
(() => {
    async function inspectPdf(scan) {
      if (!window.pdfjsLib) throw new Error('the PDF library is unavailable');
      const buf = await scan.file.arrayBuffer();
      scan.pdfDoc = await window.pdfjsLib.getDocument({ data: buf }).promise;
      scan.pageCount = scan.pdfDoc.numPages;
      await inspectPdfPage(scan, 1);
    }

    async function inspectPdfPage(scan, pageNum) {
      const page = await scan.pdfDoc.getPage(pageNum);
      const viewport1 = page.getViewport({ scale: 1 });
      scan.pageDims = { w: viewport1.width, h: viewport1.height };
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str).join(' ');
      scan.textChars = text.replace(/\s+/g, '').length;
      if (!scan.scalesByPage[pageNum]) {
        scan.scalesByPage[pageNum] = detectScalesInText(text);
      }
      const ops = await page.getOperatorList();
      const OPS = window.pdfjsLib.OPS;
      let pathOps = 0, imageOps = 0, textRenderMode = 0;
      let visibleText = false, invisibleText = false;
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (fn === OPS.constructPath) pathOps += 1;
        else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject
          || fn === OPS.paintImageXObjectRepeat || fn === OPS.paintInlineImageXObject) imageOps += 1;
        else if (fn === OPS.setTextRenderingMode) textRenderMode = ops.argsArray[i][0];
        else if (fn === OPS.showText || fn === OPS.showSpacedText
          || fn === OPS.nextLineShowText || fn === OPS.nextLineSetSpacingShowText) {
          if (textRenderMode === 3) invisibleText = true;
          else visibleText = true;
        }
      }
      scan.pathOps = pathOps;
      scan.imageOps = imageOps;
      const liveChars = visibleText ? scan.textChars : 0;
      const drawn = pathOps + liveChars > 0 && (imageOps === 0 || pathOps >= imageOps * 4);
      scan.tier = drawn && imageOps === 0 ? 'vector'
        : drawn || (imageOps > 0 && (visibleText || pathOps >= 8)) ? 'hybrid'
        : invisibleText && !visibleText && imageOps > 0 ? 'ocr'
        : imageOps > 0 ? 'image'
        : 'vector';
      scan.isVector = scan.tier === 'vector' || scan.tier === 'hybrid';
      const scale = Math.min(2.6, 2200 / viewport1.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      scan.pageCanvas = canvas;
      if (scan.previewUrl) URL.revokeObjectURL(scan.previewUrl);
      scan.previewUrl = '';
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.8));
      scan.convertedBlob = blob;
      scan.previewUrl = URL.createObjectURL(blob);
    }

    async function inspectImage(scan) {
      const bitmap = await createImageBitmap(scan.file).catch(() => null);
      if (!bitmap) throw new Error('unsupported image format');
      scan.imgWidth = bitmap.width;
      scan.imgHeight = bitmap.height;
      // Photos convert once to the project's compressed image form: capped to
      // 2200px on the long side and stored as quality-0.8 WEBP.
      const cap = 2200;
      const shrink = Math.min(1, cap / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * shrink));
      canvas.height = Math.max(1, Math.round(bitmap.height * shrink));
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      scan.pageCanvas = canvas;
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.8));
      if (!blob) throw new Error('image conversion failed');
      scan.convertedBlob = blob;
      scan.previewUrl = URL.createObjectURL(blob);
    }

    function detectScalesInText(text) {
      const found = [];
      const seen = new Set();
      const fracRe = /(\d+\/\d+|\d+)\s*"\s*=\s*(\d+)\s*['\u2019]\s*-?\s*(\d+)?["\u201d]?/gi;
      let m;
      while ((m = fracRe.exec(text))) {
        const val = m[1].includes('/')
          ? (Number(m[1].split('/')[1]) ? Number(m[1].split('/')[0]) / Number(m[1].split('/')[1]) : 0)
          : parseFloat(m[1]);
        const feet = parseInt(m[2], 10) || 0;
        const inches = m[3] ? parseInt(m[3], 10) : 0;
        const totalInches = feet * 12 + inches;
        if (!val || !totalInches) continue;
        const raw = `${m[1]}" = ${feet}'-${inches}"`;
        if (seen.has(raw)) continue;
        seen.add(raw);
        found.push({ raw, ratio: totalInches / val, unit: 'imperial' });
      }
      const ratioRe = /\b1\s*:\s*(\d{1,4})\b/g;
      while ((m = ratioRe.exec(text))) {
        const n = parseInt(m[1], 10);
        if (!n || n === 1) continue;
        const raw = `1:${n}`;
        if (seen.has(raw)) continue;
        seen.add(raw);
        found.push({ raw, ratio: n, unit: 'ratio' });
      }
      return found;
    }

    function parseScaleEntry(value) {
      const trimmed = String(value || '').trim();
      if (!trimmed) return null;
      const fm = trimmed.match(/(\d+\/\d+|\d+)\s*"\s*=\s*(\d+)\s*['\u2019]\s*-?\s*(\d+)?["\u201d]?/i);
      if (fm) {
        const val = fm[1].includes('/')
          ? (Number(fm[1].split('/')[1]) ? Number(fm[1].split('/')[0]) / Number(fm[1].split('/')[1]) : 0)
          : parseFloat(fm[1]);
        const feet = parseInt(fm[2], 10) || 0;
        const inches = fm[3] ? parseInt(fm[3], 10) : 0;
        const totalInches = feet * 12 + inches;
        if (val && totalInches) return { raw: `${fm[1]}" = ${feet}'-${inches}"`, ratio: totalInches / val, unit: 'imperial' };
      }
      const rm = trimmed.match(/1\s*:\s*(\d{1,4})/);
      if (rm && parseInt(rm[1], 10) > 1) return { raw: `1:${rm[1]}`, ratio: parseInt(rm[1], 10), unit: 'ratio' };
      return null;
    }

  // Two-point CALIBRATE: two picked marks (fractions of the displayed
  // image), the rasterized canvas size, and a typed real-world length give
  // the scale — a paper ratio for PDFs, a plan width for photos.
  function calibrateScale({ marks, canvasWidth, canvasHeight, kind, pageDims, realInches }) {
    const dx = (marks[1].fx - marks[0].fx) * canvasWidth;
    const dy = (marks[1].fy - marks[0].fy) * canvasHeight;
    const distPx = Math.hypot(dx, dy);
    if (distPx < 4) return { ok: false, error: 'The two marks are too close together.' };
    if (kind === 'pdf' && pageDims) {
      const pxPerPaperInch = canvasWidth / pageDims.w * 72;
      const ratio = realInches * pxPerPaperInch / distPx;
      return { ok: true, scale: { raw: `calibrated \u2248 1:${Math.round(ratio)}`, ratio, unit: 'ratio' } };
    }
    return { ok: true, widthFt: canvasWidth / distPx * realInches / 12 };
  }

  // World footprint: with a scale, the paper size speaks for itself (paper
  // inches \u00d7 real inches per paper inch); without one, the typed plan
  // width sets it and the height follows the aspect.
  function worldSizeFromScan({ kind, pageDims, imgWidth, imgHeight, selectedScale, typedWidthFt }) {
    const aspect = kind === 'pdf'
      ? (pageDims ? pageDims.h / pageDims.w : 1)
      : (imgWidth ? imgHeight / imgWidth : 1);
    if (kind === 'pdf' && selectedScale && pageDims) {
      // Both scale kinds boil down to real inches per paper inch: 1/4"=1'-0"
      // stores 48, and 1:50 is unit-agnostic so the bare 50 works directly.
      const paperInchesW = pageDims.w / 72;
      const paperInchesH = pageDims.h / 72;
      return { widthFt: paperInchesW * selectedScale.ratio / 12, heightFt: paperInchesH * selectedScale.ratio / 12 };
    }
    return { widthFt: typedWidthFt, heightFt: typedWidthFt * aspect };
  }

  window.DraftPdfScan = Object.freeze({
    inspectPdf,
    inspectPdfPage,
    inspectImage,
    detectScalesInText,
    parseScaleEntry,
    calibrateScale,
    worldSizeFromScan,
  });
})();
}
