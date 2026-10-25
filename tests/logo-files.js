// LOGO FIXTURES IN THE OTHER FORMATS (Movie, 25 Oct: PDF, BMP, ICO, AVIF
// join PNG/JPG/GIF/WEBP/SVG). Built here, byte by byte, so a check holds the
// whole file in a few lines and no binary sits in the repo.

// A one-page PDF, 300 x 200 pt, white, with a 200 x 100 blue block in the
// middle. The xref offsets are worked out, not hand-counted.
function pdfBytes() {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R >>',
  ];
  const stream = '0.12 0.31 0.63 rg 50 50 200 100 re f';
  objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let out = '%PDF-1.4\n';
  const offsets = [];
  objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
    + offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
    + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// A 24-bit BMP, 60 x 40, white, with a 20 x 10 red block at (20, 15).
function bmpBytes() {
  const w = 60, h = 40, row = Math.ceil((w * 3) / 4) * 4;
  const buf = Buffer.alloc(54 + row * h, 0);
  buf.write('BM', 0, 'latin1');
  buf.writeUInt32LE(buf.length, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(w, 18);
  buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(row * h, 34);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const top = h - 1 - y; // rows run bottom-up
      const red = x >= 20 && x < 40 && top >= 15 && top < 25;
      const at = 54 + y * row + x * 3;
      buf[at] = red ? 0 : 255;       // B
      buf[at + 1] = red ? 0 : 255;   // G
      buf[at + 2] = 255;             // R
    }
  }
  return buf;
}

module.exports = { pdfBytes, bmpBytes };
