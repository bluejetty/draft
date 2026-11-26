// PRINT MODEL -- the house for a 3D printer (RUFF 3D phase 6).
//
// jb, 26 Nov 2026: "go Sir !!" on the planned phase 6: a scale, the thin
// parts thickened so they print, the house in pieces that lift off (the
// foundation, each storey, the roof), a file a slicer reads.
//
// house-mesh.js builds the print house (build(saved, { print })): every part
// a closed solid, the openings open, roofs as slabs, walls and roofs no
// thinner than MIN_MM at the scale. This file cuts that house into pieces,
// scales it to millimetres, stands each piece on the bed (z up, its lowest
// point on z = 0) and lays the pieces out in a row, then writes them:
//   3MF -- one object per piece, each in the house's colours, one file;
//   STL -- one file per piece (a zip when there is more than one).
// What prints is the levels switched on; a SECTION cut is not printed (a
// cut house is open, and a slicer cannot fill an open shell).
(function () {
  'use strict';
  if (window.DraftPrintModel) return;

  // Architectural model scales: the two imperial ones a drafter prints at,
  // and their metric neighbours.
  const SCALES = Object.freeze([
    { id: '48', ratio: 48, label: '1/4" = 1\'' },
    { id: '96', ratio: 96, label: '1/8" = 1\'' },
    { id: '100', ratio: 100, label: '1:100' },
    { id: '200', ratio: 200, label: '1:200' },
  ]);
  const MIN_MM = 1.2;      // three lines of a 0.4 mm nozzle: the thinnest wall that prints solid
  const BED_MM = 250;      // a common printer bed; a piece bigger than this is called out
  const GAP_MM = 10;       // between pieces on the bed
  const MM_PER_FT = 304.8;

  const mmPerFt = ratio => MM_PER_FT / ratio;
  // The minimum, in the model's own feet.
  const minFtAt = ratio => MIN_MM / mmPerFt(ratio);

  // The print house's faces, the hidden levels left out, in pieces.
  // split 'one': one piece; 'lift': a piece for each level (foundation,
  // storeys, roof) in the order they stack. A face with no level rides with
  // the first piece.
  function pieces(built, hidden, split) {
    const off = hidden || new Set();
    const faces = built.faces.filter(f => !f.group || !off.has(f.group));
    if (split !== 'lift') return faces.length ? [{ id: 'house', name: 'HOUSE', faces }] : [];
    const order = (built.groups || []).filter(g => !off.has(g.id));
    const list = order.map(g => ({ id: g.id, name: g.name, faces: [] }));
    if (!list.length) return [];
    const byId = new Map(list.map(p => [p.id, p]));
    faces.forEach(f => (byId.get(f.group) || list[0]).faces.push(f));
    return list.filter(p => p.faces.length);
  }

  // Each piece as triangles in mm, z up, stood on the bed, packed in rows.
  function place(list, ratio) {
    const M = window.DraftHouseMesh;
    const k = mmPerFt(ratio);
    // Shelf packing: pieces left to right, a new row when the next would
    // run past the bed, so the slicer opens them on the plate.
    let x = 0, y = 0, rowDeep = 0;
    return list.map(piece => {
      const tris = [];
      piece.faces.forEach(f => {
        const ft = f.pts;
        const rgb = (f.colour || [200, 200, 200]).map(v => Math.max(0, Math.min(255, Math.round(v))));
        M.triangulate(ft).forEach(([a, b, c]) => {
          const A = ft[a], B = ft[b], C = ft[c];
          // A sliver along a straight run of corners is KEPT: its edges
          // pair with the neighbour's, and dropping it leaves the shell
          // open. Only a triangle with two corners on one point goes.
          const same = (P, Q) => Math.hypot(P.x - Q.x, P.y - Q.y, P.z - Q.z) < 1e-9;
          if (same(A, B) || same(B, C) || same(A, C)) return;
          // y up, plan z toward the viewer -> z up: (x, -z, y), right-handed.
          tris.push({ p: [A, B, C].map(q => [q.x * k, -q.z * k, q.y * k]), rgb });
        });
      });
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      tris.forEach(t => t.p.forEach(q => { for (let i = 0; i < 3; i += 1) { lo[i] = Math.min(lo[i], q[i]); hi[i] = Math.max(hi[i], q[i]); } }));
      const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
      if (x > 0 && x + size[0] > BED_MM) { x = 0; y += rowDeep + GAP_MM; rowDeep = 0; }
      const shift = [x - lo[0], y - lo[1], -lo[2]];
      tris.forEach(t => { t.p = t.p.map(q => [q[0] + shift[0], q[1] + shift[1], q[2] + shift[2]]); });
      x += size[0] + GAP_MM;
      rowDeep = Math.max(rowDeep, size[1]);
      return { id: piece.id, name: piece.name, tris, size, fits: size.every(v => v <= BED_MM) };
    }).filter(p => p.tris.length);
  }

  const num = v => (Math.abs(v) < 1e-9 ? '0' : String(Math.round(v * 1e4) / 1e4));
  const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hex = rgb => rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const safe = s => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'piece';

  // One 3MF, one object per piece. Each object's corners are welded (shared
  // by index), which is how a slicer knows the shell is closed.
  async function write3mf(placed, name) {
    const colours = new Map();
    placed.forEach(pc => pc.tris.forEach(t => { const h = hex(t.rgb); if (!colours.has(h)) colours.set(h, colours.size); }));
    const objects = placed.map((pc, i) => {
      const index = new Map(), verts = [], tris = [];
      const vid = q => {
        const key = q.map(num).join(' ');
        if (!index.has(key)) { index.set(key, verts.length); verts.push(`<vertex x="${num(q[0])}" y="${num(q[1])}" z="${num(q[2])}"/>`); }
        return index.get(key);
      };
      pc.tris.forEach(t => {
        const [a, b, c] = t.p.map(vid);
        if (a === b || b === c || a === c) return;
        tris.push(`<triangle v1="${a}" v2="${b}" v3="${c}" pid="1" p1="${colours.get(hex(t.rgb))}"/>`);
      });
      return `<object id="${i + 2}" type="model" name="${xml(pc.name)}" pid="1" pindex="0"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`;
    });
    const bases = [...colours.keys()].map(h => `<base name="#${h}" displaycolor="#${h}FF"/>`);
    const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${xml(name)}</metadata>
<metadata name="Application">RUFF 3D / ROUGH 3D (Rough Drafter)</metadata>
<resources>
<basematerials id="1">${bases.join('')}</basematerials>
${objects.join('\n')}
</resources>
<build>${placed.map((_, i) => `<item objectid="${i + 2}"/>`).join('')}</build>
</model>
`;
    const zip = await window.DraftZipBundle.writeZip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>\n' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>\n' },
      { name: '3D/3dmodel.model', data: model },
    ]);
    return { name: `${name}-print.3mf`, mime: 'model/3mf', blob: new Blob([zip], { type: 'model/3mf' }) };
  }

  // A binary STL of one piece, in mm.
  function stlBytes(pc, title) {
    const out = new ArrayBuffer(84 + pc.tris.length * 50);
    const dv = new DataView(out);
    const head = `RUFF 3D ${title} MILLIMETRES`.slice(0, 79);
    for (let i = 0; i < head.length; i += 1) dv.setUint8(i, head.charCodeAt(i) & 127);
    dv.setUint32(80, pc.tris.length, true);
    let at = 84;
    pc.tris.forEach(({ p: [A, B, C] }) => {
      const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      [[n[0] / len, n[1] / len, n[2] / len], A, B, C].forEach(q => { for (let a = 0; a < 3; a += 1) { dv.setFloat32(at, q[a], true); at += 4; } });
      dv.setUint16(at, 0, true); at += 2;
    });
    return new Uint8Array(out);
  }

  // One STL for one piece; a zip of an STL per piece for more.
  async function writeStl(placed, name) {
    if (placed.length === 1) {
      return { name: `${name}-print.stl`, mime: 'model/stl', blob: new Blob([stlBytes(placed[0], name)], { type: 'model/stl' }) };
    }
    const zip = await window.DraftZipBundle.writeZip(placed.map((pc, i) => ({
      name: `${name}-${String(i + 1).padStart(2, '0')}-${safe(pc.name)}.stl`, data: stlBytes(pc, `${name} ${pc.name}`),
    })));
    return { name: `${name}-print-stl.zip`, mime: 'application/zip', blob: new Blob([zip], { type: 'application/zip' }) };
  }

  // The whole job: build the print house at the scale, cut it, lay it out.
  function prepare(saved, { ratio = 96, split = 'lift', hidden = null } = {}) {
    const built = window.DraftHouseMesh.build(saved, { print: { minFt: minFtAt(ratio) } });
    return place(pieces(built, hidden, split), ratio);
  }

  async function write(placed, name, format) {
    return format === 'stl' ? writeStl(placed, name) : write3mf(placed, name);
  }

  window.DraftPrintModel = Object.freeze({ SCALES, MIN_MM, BED_MM, GAP_MM, mmPerFt, minFtAt, pieces, place, prepare, write });
})();
