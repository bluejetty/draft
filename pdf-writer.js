// A PDF OF THE SHEETS, WRITTEN HERE (jb, 11 Nov 2026: "make paper print
// cost 2 bone" -- which only works if paper and PDF are two different
// presses, and the browser's print window is one press for both). So the
// print card's SAVE PDF draws each sheet at 300 dpi, the same canvas the
// printer gets, and writes it into a PDF of its own: one image to a page at
// the paper's size. No library: a PDF of full-page images is a catalog, a
// page tree, and per page a Page, a content stream of one `Do`, and an image
// XObject -- plus the cross-reference table, which is the only part that
// needs care (byte offsets, so everything is counted in bytes, not chars).
//
// THE PIXELS GO IN LOSSLESS. A sheet is line work and small text, where a
// JPEG rings; the image is raw RGB under FlateDecode, which the browser's
// CompressionStream('deflate') writes as the zlib stream PDF wants. Line
// drawings deflate to a few hundred kilobytes a sheet. Where there is no
// CompressionStream (none of the tested browsers), a JPEG at 0.95 under
// DCTDecode stands in, so the press still works.
//
// Pure: canvases in, a Blob out. Nothing here touches the page.
if (!window.DraftPdfWriter) {
(() => {
  const enc = new TextEncoder();
  const bytes = s => enc.encode(s);

  // Raw RGB off the canvas, deflated. RGBA -> RGB drops a quarter of it
  // before the compressor sees it; the alpha of a painted sheet is 255.
  const flateImage = async canvas => {
    const { width, height } = canvas;
    const rgba = canvas.getContext('2d').getImageData(0, 0, width, height).data;
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      rgb[j] = rgba[i]; rgb[j + 1] = rgba[i + 1]; rgb[j + 2] = rgba[i + 2];
    }
    const stream = new Blob([rgb]).stream().pipeThrough(new CompressionStream('deflate'));
    const data = new Uint8Array(await new Response(stream).arrayBuffer());
    return { width, height, data, filter: 'FlateDecode' };
  };
  const jpegImage = async canvas => {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    if (!blob) throw new Error('the sheet could not be encoded');
    const data = new Uint8Array(await blob.arrayBuffer());
    return { width: canvas.width, height: canvas.height, data, filter: 'DCTDecode' };
  };
  const encodeImage = canvas => (typeof CompressionStream === 'function'
    ? flateImage(canvas) : jpegImage(canvas));

  // pages: [{ canvas, widthIn, heightIn }] -- the canvas is read here and
  // may be released by the caller afterwards. title: the document's name.
  const write = async ({ pages, title = 'Sheets' }) => {
    if (!pages?.length) throw new Error('no sheets to write');
    const images = [];
    for (const page of pages) images.push(await encodeImage(page.canvas));

    // Objects by number: 1 catalog, 2 pages, 3 info, then per page three
    // (page, content, image). The parts are byte chunks; offsets are summed
    // as they are pushed so the xref is right by construction.
    const chunks = [];
    const offsets = [];
    let length = 0;
    const push = part => {
      const b = part instanceof Uint8Array ? part : bytes(part);
      chunks.push(b);
      length += b.length;
    };
    const object = (n, body) => {
      offsets[n] = length;
      push(`${n} 0 obj\n`);
      if (Array.isArray(body)) body.forEach(push); else push(body);
      push('\nendobj\n');
    };
    const pageObj = i => 4 + i * 3;
    const safe = s => String(s).replace(/[\\()]/g, m => `\\${m}`).replace(/[^\x20-\x7e]/g, '');

    push('%PDF-1.4\n%âãÏÓ\n');
    object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>`);
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    object(3, `<< /Title (${safe(title)}) /Producer (ROUGH-DRAFTER) /CreationDate (D:${stamp}) >>`);
    pages.forEach((page, i) => {
      const n = pageObj(i);
      const img = images[i];
      const w = (page.widthIn * 72).toFixed(2);
      const h = (page.heightIn * 72).toFixed(2);
      object(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] `
        + `/Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>`);
      const content = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
      object(n + 1, `<< /Length ${bytes(content).length} >>\nstream\n${content}\nendstream`);
      object(n + 2, [
        `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} `
        + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${img.filter} /Length ${img.data.length} >>\nstream\n`,
        img.data,
        '\nendstream',
      ]);
    });
    const count = 4 + pages.length * 3;
    const xref = length;
    push(`xref\n0 ${count}\n0000000000 65535 f \n`);
    for (let n = 1; n < count; n += 1) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks, { type: 'application/pdf' });
  };

  window.DraftPdfWriter = Object.freeze({ write });
})();
}
