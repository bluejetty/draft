// EXPORTS -- the house as files other programs open. Open formats only.
//
// jb, 25 Nov 2026: "ok do as many 'open' filetypes as you can, don't worry
// about 'closed' formats", and each export costs 1 bone (viewing is free).
// So: glTF / GLB, OBJ + MTL, STL, 3MF, PLY, COLLADA (DAE), X3D, VRML and a
// DXF of 3DFACEs. No FBX, DWG or SKP.
//
// EVERY WRITER READS THE SAME FACE LIST the two painters draw
// (house-mesh.js), never a three.js scene, so an export works on jb's PC
// with no WebGL just as well as on a graphics card. What is written is what
// is on screen: the levels switched on and the section as it is cut.
//
// THE MODEL IS IN FEET, y up, x and z the plan's own axes (right-handed, the
// same frame as three.js and glTF). Each writer scales to the unit asked for
// (glTF is always metres, its own rule) and turns z up for the formats whose
// programs expect it (STL, 3MF, PLY, DXF: x stays, plan z becomes -y, up
// becomes z -- still right-handed, so nothing is mirrored).
//
// Pure: faces in, { name, mime, blob } out. Only zip-bundle.js's writeZip is
// borrowed, for the two formats that are a folder in one file (OBJ + MTL,
// and 3MF, which is a zip by definition).
(function () {
  'use strict';
  if (window.DraftExportWriters) return;

  const UNITS = Object.freeze({
    m: { perFt: 0.3048, label: 'METRES', threeMf: 'meter', dae: ['meter', 1] },
    mm: { perFt: 304.8, label: 'MILLIMETRES', threeMf: 'millimeter', dae: ['millimeter', 0.001] },
    ft: { perFt: 1, label: 'FEET', threeMf: 'foot', dae: ['foot', 0.3048] },
    in: { perFt: 12, label: 'INCHES', threeMf: 'inch', dae: ['inch', 0.0254] },
  });

  // ── THE SHARED PREPARATION ─────────────────────────────────────────────
  // Faces grouped by what they are made of (kind + colour + two-sided), each
  // group's polygons and triangles in the asked unit and axis order.
  function prepare(faces, unit, zUp) {
    const M = window.DraftHouseMesh;
    const k = (UNITS[unit] || UNITS.m).perFt;
    const tx = zUp ? (p => [p.x * k, -p.z * k, p.y * k]) : (p => [p.x * k, p.y * k, p.z * k]);
    const groups = new Map();
    faces.forEach(f => {
      if (!f || !Array.isArray(f.pts) || f.pts.length < 3) return;
      const rgb = (f.colour || [200, 200, 200]).map(v => Math.max(0, Math.min(255, Math.round(v))));
      const hex = rgb.map(v => v.toString(16).padStart(2, '0')).join('');
      const kind = String(f.kind || 'part').replace(/[^a-z0-9]/gi, '_');
      const key = `${kind}_${hex}${f.twoSided ? '_2s' : ''}`;
      if (!groups.has(key)) groups.set(key, { name: key, kind, rgb, twoSided: !!f.twoSided, polys: [], tris: [], pieces: [] });
      const g = groups.get(key);
      const pts = f.pts.map(tx);
      const own = [];
      const ft = f.pts.map(p => [p.x, p.y, p.z]);
      M.triangulate(f.pts).forEach(([a, b, c]) => {
        // A triangle with no area is left out: 3MF and many slicers refuse
        // one. Judged in feet, so every unit writes the same triangles.
        const n = cross(sub(ft[b], ft[a]), sub(ft[c], ft[a]));
        if (Math.hypot(n[0], n[1], n[2]) > 1e-10) own.push([pts[a], pts[b], pts[c]]);
      });
      // Polygon formats (OBJ, X3D, VRML, DXF) get the face whole only when
      // it is convex: most programs fan a polygon into triangles, which
      // folds a concave one (an L floor, a wall round a window) wrong. A
      // concave face goes out as its own triangles instead.
      const whole = own.length === ft.length - 2 && convex(ft);
      const polys = whole ? [pts] : own;
      polys.forEach(q => g.polys.push(q));
      own.forEach(t => g.tris.push(t));
      g.pieces.push({ polys, tris: own });
    });
    const list = [...groups.values()].filter(g => g.tris.length);
    const triCount = list.reduce((s, g) => s + g.tris.length, 0);
    return { groups: list, triCount };
  }
  // Convex and planar enough to fan: every corner turns the same way as
  // the face's normal (a straight-through corner is allowed).
  function convex(q) {
    const n = q.length;
    let nx = 0, ny = 0, nz = 0;
    for (let i = 0; i < n; i += 1) {
      const a = q[i], b = q[(i + 1) % n];
      nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) return false;
    for (let i = 0; i < n; i += 1) {
      const a = q[(i + n - 1) % n], b = q[i], c = q[(i + 1) % n];
      const t = cross(sub(b, a), sub(c, b));
      if ((t[0] * nx + t[1] * ny + t[2] * nz) / len < -1e-9) return false;
    }
    return true;
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unitNormal = (A, B, C) => {
    const n = cross(sub(B, A), sub(C, A));
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  };
  const num = v => (Math.abs(v) < 1e-9 ? '0' : String(Math.round(v * 1e6) / 1e6));
  const xml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const srgbToLinear = c => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const textBlob = (text, mime) => new Blob([text], { type: mime });

  // ── glTF 2.0 (.glb binary and .gltf with the buffer inside) ────────────
  // One mesh, one primitive per material; flat normals (every triangle its
  // own three corners), metres, y up.
  function gltfParts(faces) {
    const { groups } = prepare(faces, 'm', false);
    const chunks = [];
    let length = 0;
    const bufferViews = [], accessors = [], materials = [], primitives = [];
    const addView = (array, target) => {
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      const pad = (4 - (length % 4)) % 4;
      if (pad) { chunks.push(new Uint8Array(pad)); length += pad; }
      bufferViews.push({ buffer: 0, byteOffset: length, byteLength: bytes.length, target });
      chunks.push(bytes);
      length += bytes.length;
      return bufferViews.length - 1;
    };
    groups.forEach((g, gi) => {
      const pos = new Float32Array(g.tris.length * 9), nor = new Float32Array(g.tris.length * 9);
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      g.tris.forEach((t, i) => {
        const n = unitNormal(t[0], t[1], t[2]);
        t.forEach((p, j) => {
          for (let a = 0; a < 3; a += 1) {
            pos[i * 9 + j * 3 + a] = p[a];
            nor[i * 9 + j * 3 + a] = n[a];
            lo[a] = Math.min(lo[a], Math.fround(p[a])); hi[a] = Math.max(hi[a], Math.fround(p[a]));
          }
        });
      });
      const pv = addView(pos, 34962), nv = addView(nor, 34962);
      accessors.push({ bufferView: pv, componentType: 5126, count: g.tris.length * 3, type: 'VEC3', min: lo, max: hi });
      accessors.push({ bufferView: nv, componentType: 5126, count: g.tris.length * 3, type: 'VEC3' });
      materials.push({ name: g.name, doubleSided: g.twoSided,
        pbrMetallicRoughness: { baseColorFactor: [...g.rgb.map(srgbToLinear), 1], metallicFactor: 0, roughnessFactor: 0.9 } });
      primitives.push({ attributes: { POSITION: accessors.length - 2, NORMAL: accessors.length - 1 }, material: gi, mode: 4 });
    });
    const bin = new Uint8Array(length);
    let at = 0;
    chunks.forEach(c => { bin.set(c, at); at += c.length; });
    const json = {
      asset: { version: '2.0', generator: 'RUFF 3D / ROUGH 3D (Rough Drafter)' },
      scene: 0, scenes: [{ name: 'house', nodes: [0] }], nodes: [{ name: 'house', mesh: 0 }],
      meshes: [{ name: 'house', primitives }], materials, accessors, bufferViews,
      buffers: [{ byteLength: length }],
    };
    return { json, bin };
  }
  function glb(faces, name) {
    const { json, bin } = gltfParts(faces);
    const enc = new TextEncoder();
    let jsonBytes = enc.encode(JSON.stringify(json));
    const jPad = (4 - (jsonBytes.length % 4)) % 4;
    if (jPad) { const j = new Uint8Array(jsonBytes.length + jPad).fill(0x20); j.set(jsonBytes); jsonBytes = j; }
    const bPad = (4 - (bin.length % 4)) % 4;
    const binBytes = new Uint8Array(bin.length + bPad); binBytes.set(bin);
    const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
    dv.setUint32(12, jsonBytes.length, true); dv.setUint32(16, 0x4E4F534A, true);
    out.set(jsonBytes, 20);
    const b0 = 20 + jsonBytes.length;
    dv.setUint32(b0, binBytes.length, true); dv.setUint32(b0 + 4, 0x004E4942, true);
    out.set(binBytes, b0 + 8);
    return { name: `${name}.glb`, mime: 'model/gltf-binary', blob: new Blob([out], { type: 'model/gltf-binary' }) };
  }
  function base64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function gltf(faces, name) {
    const { json, bin } = gltfParts(faces);
    json.buffers[0].uri = `data:application/octet-stream;base64,${base64(bin)}`;
    return { name: `${name}.gltf`, mime: 'model/gltf+json', blob: textBlob(JSON.stringify(json), 'model/gltf+json') };
  }

  // ── OBJ + MTL, in one zip ──────────────────────────────────────────────
  // Polygons as drawn (a wall face stays a quad), a group per kind of part
  // and a material per colour. y up, as OBJ programs expect.
  async function obj(faces, name, unit) {
    const { groups } = prepare(faces, unit, false);
    const lines = [`# ${name} -- RUFF 3D / ROUGH 3D (Rough Drafter), units: ${(UNITS[unit] || UNITS.m).label}`, `mtllib ${name}.mtl`];
    const mtl = [`# materials for ${name}.obj`];
    let base = 1;
    groups.forEach(g => {
      lines.push(`g ${g.kind}`, `usemtl ${g.name}`);
      g.polys.forEach(poly => {
        poly.forEach(p => lines.push(`v ${num(p[0])} ${num(p[1])} ${num(p[2])}`));
        lines.push(`f ${poly.map((_, i) => base + i).join(' ')}`);
        base += poly.length;
      });
      mtl.push(`newmtl ${g.name}`, `Kd ${g.rgb.map(v => num(v / 255)).join(' ')}`, 'Ka 0 0 0', 'Ks 0 0 0', 'd 1', 'illum 1', '');
    });
    const zip = await window.DraftZipBundle.writeZip([
      { name: `${name}.obj`, data: `${lines.join('\n')}\n` },
      { name: `${name}.mtl`, data: `${mtl.join('\n')}\n` },
    ]);
    return { name: `${name}-obj.zip`, mime: 'application/zip', blob: zip };
  }

  // ── STL (binary) ───────────────────────────────────────────────────────
  // Triangles only, no colour; z up, for slicers and 3D printers.
  function stl(faces, name, unit) {
    const { groups, triCount } = prepare(faces, unit, true);
    const out = new ArrayBuffer(84 + triCount * 50);
    const dv = new DataView(out);
    const head = `RUFF 3D ${name} ${(UNITS[unit] || UNITS.m).label}`.slice(0, 79);
    for (let i = 0; i < head.length; i += 1) dv.setUint8(i, head.charCodeAt(i) & 127);
    dv.setUint32(80, triCount, true);
    let at = 84;
    groups.forEach(g => g.tris.forEach(t => {
      const n = unitNormal(t[0], t[1], t[2]);
      [n, t[0], t[1], t[2]].forEach(v => { for (let a = 0; a < 3; a += 1) { dv.setFloat32(at, v[a], true); at += 4; } });
      dv.setUint16(at, 0, true); at += 2;
    }));
    return { name: `${name}.stl`, mime: 'model/stl', blob: new Blob([out], { type: 'model/stl' }) };
  }

  // ── 3MF (the printers' own open format: a zip with an XML model) ───────
  // Colour per triangle through one basematerials table; z up.
  async function threeMf(faces, name, unit) {
    const { groups } = prepare(faces, unit, true);
    const u = UNITS[unit] || UNITS.m;
    const verts = [], tris = [];
    groups.forEach((g, gi) => g.tris.forEach(t => {
      const i = verts.length;
      t.forEach(p => verts.push(`<vertex x="${num(p[0])}" y="${num(p[1])}" z="${num(p[2])}"/>`));
      tris.push(`<triangle v1="${i}" v2="${i + 1}" v3="${i + 2}" pid="1" p1="${gi}"/>`);
    }));
    const bases = groups.map(g => `<base name="${xml(g.name)}" displaycolor="#${g.rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase()}FF"/>`);
    const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="${u.threeMf}" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">${xml(name)}</metadata>
<metadata name="Application">RUFF 3D / ROUGH 3D (Rough Drafter)</metadata>
<resources>
<basematerials id="1">${bases.join('')}</basematerials>
<object id="2" type="model" name="${xml(name)}" pid="1" pindex="0"><mesh>
<vertices>${verts.join('')}</vertices>
<triangles>${tris.join('')}</triangles>
</mesh></object>
</resources>
<build><item objectid="2"/></build>
</model>
`;
    const zip = await window.DraftZipBundle.writeZip([
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>\n' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>\n' },
      { name: '3D/3dmodel.model', data: model },
    ]);
    return { name: `${name}.3mf`, mime: 'model/3mf', blob: new Blob([zip], { type: 'model/3mf' }) };
  }

  // ── PLY (binary, little endian, a colour on every corner) ──────────────
  function ply(faces, name, unit) {
    const { groups, triCount } = prepare(faces, unit, true);
    const header = `ply\nformat binary_little_endian 1.0\ncomment RUFF 3D ${name}, units ${(UNITS[unit] || UNITS.m).label}, z up\n`
      + `element vertex ${triCount * 3}\nproperty float x\nproperty float y\nproperty float z\n`
      + 'property uchar red\nproperty uchar green\nproperty uchar blue\n'
      + `element face ${triCount}\nproperty list uchar int vertex_indices\nend_header\n`;
    const head = new TextEncoder().encode(header);
    const body = new DataView(new ArrayBuffer(triCount * 3 * 15 + triCount * 13));
    let at = 0;
    groups.forEach(g => g.tris.forEach(t => t.forEach(p => {
      body.setFloat32(at, p[0], true); body.setFloat32(at + 4, p[1], true); body.setFloat32(at + 8, p[2], true);
      body.setUint8(at + 12, g.rgb[0]); body.setUint8(at + 13, g.rgb[1]); body.setUint8(at + 14, g.rgb[2]);
      at += 15;
    })));
    for (let i = 0; i < triCount; i += 1) {
      body.setUint8(at, 3); body.setInt32(at + 1, i * 3, true); body.setInt32(at + 5, i * 3 + 1, true); body.setInt32(at + 9, i * 3 + 2, true);
      at += 13;
    }
    return { name: `${name}.ply`, mime: 'application/octet-stream', blob: new Blob([head, body.buffer], { type: 'application/octet-stream' }) };
  }

  // ── COLLADA 1.4.1 (.dae) ───────────────────────────────────────────────
  function dae(faces, name, unit) {
    const { groups } = prepare(faces, unit, false);
    const u = UNITS[unit] || UNITS.m;
    const effects = [], mats = [], geoms = [], binds = [];
    groups.forEach((g, i) => {
      const id = `m${i}`;
      effects.push(`<effect id="${id}-fx"><profile_COMMON><technique sid="common"><lambert><diffuse><color>${g.rgb.map(v => num(v / 255)).join(' ')} 1</color></diffuse></lambert></technique>${g.twoSided ? '<extra><technique profile="GOOGLEEARTH"><double_sided>1</double_sided></technique></extra>' : ''}</profile_COMMON></effect>`);
      mats.push(`<material id="${id}" name="${xml(g.name)}"><instance_effect url="#${id}-fx"/></material>`);
      const pos = g.tris.flatMap(t => t.flatMap(p => p.map(num)));
      const count = g.tris.length * 3;
      geoms.push(`<geometry id="g${i}" name="${xml(g.name)}"><mesh>`
        + `<source id="g${i}-pos"><float_array id="g${i}-pos-a" count="${pos.length}">${pos.join(' ')}</float_array>`
        + `<technique_common><accessor source="#g${i}-pos-a" count="${count}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source>`
        + `<vertices id="g${i}-v"><input semantic="POSITION" source="#g${i}-pos"/></vertices>`
        + `<triangles material="${id}" count="${g.tris.length}"><input semantic="VERTEX" source="#g${i}-v" offset="0"/><p>${Array.from({ length: count }, (_, k) => k).join(' ')}</p></triangles>`
        + '</mesh></geometry>');
      binds.push(`<node id="n${i}" name="${xml(g.name)}"><instance_geometry url="#g${i}"><bind_material><technique_common><instance_material symbol="${id}" target="#${id}"/></technique_common></bind_material></instance_geometry></node>`);
    });
    const now = new Date().toISOString();
    const text = `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
<asset><contributor><authoring_tool>RUFF 3D / ROUGH 3D (Rough Drafter)</authoring_tool></contributor><created>${now}</created><modified>${now}</modified><unit name="${u.dae[0]}" meter="${u.dae[1]}"/><up_axis>Y_UP</up_axis></asset>
<library_effects>${effects.join('')}</library_effects>
<library_materials>${mats.join('')}</library_materials>
<library_geometries>${geoms.join('')}</library_geometries>
<library_visual_scenes><visual_scene id="house" name="${xml(name)}">${binds.join('')}</visual_scene></library_visual_scenes>
<scene><instance_visual_scene url="#house"/></scene>
</COLLADA>
`;
    return { name: `${name}.dae`, mime: 'model/vnd.collada+xml', blob: textBlob(text, 'model/vnd.collada+xml') };
  }

  // ── X3D (XML) and VRML 2.0 (.wrl), the web's own 3D formats ────────────
  function shapesOf(faces, unit) {
    const { groups } = prepare(faces, unit, false);
    return groups.map(g => {
      const pts = [], idx = [];
      g.polys.forEach(poly => {
        const start = pts.length;
        poly.forEach(p => pts.push(p.map(num).join(' ')));
        idx.push(...poly.map((_, i) => start + i), -1);
      });
      return { g, pts, idx, colour: g.rgb.map(v => num(v / 255)).join(' ') };
    });
  }
  function x3d(faces, name, unit) {
    const shapes = shapesOf(faces, unit).map(s => `<Shape DEF="${xml(s.g.name)}"><Appearance><Material diffuseColor="${s.colour}"/></Appearance>`
      + `<IndexedFaceSet solid="${s.g.twoSided ? 'false' : 'true'}" ccw="true" convex="false" coordIndex="${s.idx.join(' ')}"><Coordinate point="${s.pts.join(', ')}"/></IndexedFaceSet></Shape>`);
    const text = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE X3D PUBLIC "ISO//Web3D//DTD X3D 3.3//EN" "http://www.web3d.org/specifications/x3d-3.3.dtd">
<X3D profile="Interchange" version="3.3">
<head><meta name="title" content="${xml(name)}"/><meta name="generator" content="RUFF 3D / ROUGH 3D (Rough Drafter)"/><meta name="units" content="${(UNITS[unit] || UNITS.m).label}"/></head>
<Scene>
${shapes.join('\n')}
</Scene>
</X3D>
`;
    return { name: `${name}.x3d`, mime: 'model/x3d+xml', blob: textBlob(text, 'model/x3d+xml') };
  }
  function vrml(faces, name, unit) {
    const shapes = shapesOf(faces, unit).map(s => `DEF ${s.g.name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1')} Shape {
  appearance Appearance { material Material { diffuseColor ${s.colour} } }
  geometry IndexedFaceSet {
    solid ${s.g.twoSided ? 'FALSE' : 'TRUE'}
    convex FALSE
    coord Coordinate { point [ ${s.pts.join(', ')} ] }
    coordIndex [ ${s.idx.join(' ')} ]
  }
}`);
    const text = `#VRML V2.0 utf8\n# ${name} -- RUFF 3D / ROUGH 3D (Rough Drafter), units: ${(UNITS[unit] || UNITS.m).label}\n${shapes.join('\n')}\n`;
    return { name: `${name}.wrl`, mime: 'model/vrml', blob: textBlob(text, 'model/vrml') };
  }

  // ── DXF (AutoCAD R12, 3DFACEs) ─────────────────────────────────────────
  // The house as 3D faces any CAD opens, z up, a layer per kind of part
  // (3D-WALL, 3D-ROOF...) in the nearest of AutoCAD's colours.
  const ACI = [[1, [255, 0, 0]], [2, [255, 255, 0]], [3, [0, 255, 0]], [4, [0, 255, 255]], [5, [0, 0, 255]],
    [6, [255, 0, 255]], [7, [255, 255, 255]], [8, [128, 128, 128]], [9, [192, 192, 192]],
    [30, [255, 127, 0]], [32, [165, 82, 0]], [34, [127, 63, 0]], [40, [255, 191, 0]], [42, [165, 124, 0]],
    [44, [127, 95, 0]], [52, [165, 165, 0]], [150, [0, 127, 255]], [152, [0, 82, 165]], [250, [51, 51, 51]],
    [251, [80, 80, 80]], [252, [105, 105, 105]], [253, [130, 130, 130]], [254, [190, 190, 190]], [255, [255, 255, 255]]];
  const nearestAci = rgb => ACI.reduce((best, [n, c]) => {
    const d = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2;
    return d < best.d ? { n, d } : best;
  }, { n: 7, d: Infinity }).n;
  function dxf(faces, name, unit) {
    const { groups } = prepare(faces, unit, true);
    const out = [];
    const put = (code, value) => { out.push(String(code), String(value)); };
    const layers = new Map();
    groups.forEach(g => {
      const layer = `3D-${g.kind.toUpperCase()}`.slice(0, 31);
      if (!layers.has(layer)) layers.set(layer, nearestAci(g.rgb));
    });
    put(0, 'SECTION'); put(2, 'HEADER'); put(9, '$ACADVER'); put(1, 'AC1009'); put(0, 'ENDSEC');
    put(0, 'SECTION'); put(2, 'TABLES');
    put(0, 'TABLE'); put(2, 'LTYPE'); put(70, 1);
    put(0, 'LTYPE'); put(2, 'CONTINUOUS'); put(70, 0); put(3, 'Solid line'); put(72, 65); put(73, 0); put(40, 0);
    put(0, 'ENDTAB');
    put(0, 'TABLE'); put(2, 'LAYER'); put(70, layers.size);
    layers.forEach((colour, layer) => { put(0, 'LAYER'); put(2, layer); put(70, 0); put(62, colour); put(6, 'CONTINUOUS'); });
    put(0, 'ENDTAB'); put(0, 'ENDSEC');
    put(0, 'SECTION'); put(2, 'BLOCKS'); put(0, 'ENDSEC');
    put(0, 'SECTION'); put(2, 'ENTITIES');
    groups.forEach(g => {
      const layer = `3D-${g.kind.toUpperCase()}`.slice(0, 31);
      // A flat convex quad goes out as one face; anything else as its
      // triangles (a 3DFACE has four corners, the fourth repeating the
      // third on a triangle).
      const write = corners => {
        put(0, '3DFACE'); put(8, layer);
        const c = corners.length === 3 ? [...corners, corners[2]] : corners;
        c.forEach((p, i) => { put(10 + i, num(p[0])); put(20 + i, num(p[1])); put(30 + i, num(p[2])); });
      };
      g.pieces.forEach(({ polys, tris }) => {
        if (polys.length === 1 && polys[0].length === 4 && planar(polys[0])) write(polys[0]);
        else tris.forEach(write);
      });
    });
    put(0, 'ENDSEC'); put(0, 'EOF');
    return { name: `${name}.dxf`, mime: 'application/dxf', blob: textBlob(`${out.join('\n')}\n`, 'application/dxf') };
  }
  const planar = poly => {
    const n = unitNormal(poly[0], poly[1], poly[2]);
    const d = n[0] * poly[0][0] + n[1] * poly[0][1] + n[2] * poly[0][2];
    return Math.abs(n[0] * poly[3][0] + n[1] * poly[3][1] + n[2] * poly[3][2] - d) < 1e-6;
  };
  // ── THE MENU ───────────────────────────────────────────────────────────
  const FORMATS = Object.freeze([
    { id: 'glb', label: 'GLB', note: 'glTF binary: web, Blender, phones (metres)', write: (f, n) => glb(f, n), metresOnly: true },
    { id: 'gltf', label: 'glTF', note: 'glTF text with the geometry inside (metres)', write: (f, n) => gltf(f, n), metresOnly: true },
    { id: 'obj', label: 'OBJ', note: 'OBJ + MTL colours, in a zip: nearly every 3D program', write: obj },
    { id: 'stl', label: 'STL', note: 'triangles for 3D printing and slicers, z up', write: stl },
    { id: '3mf', label: '3MF', note: 'the printers\' format, with colours, z up', write: threeMf },
    { id: 'ply', label: 'PLY', note: 'triangles with colours, z up', write: ply },
    { id: 'dae', label: 'DAE', note: 'COLLADA: SketchUp, Blender and most CAD', write: dae },
    { id: 'x3d', label: 'X3D', note: 'the web\'s 3D standard (XML)', write: x3d },
    { id: 'wrl', label: 'VRML', note: 'VRML 2.0 (.wrl), the older web 3D', write: vrml },
    { id: 'dxf', label: 'DXF', note: '3DFACEs in AutoCAD R12, a layer per part, z up', write: dxf },
  ]);

  async function exportAs(id, faces, name, unit = 'm') {
    const format = FORMATS.find(f => f.id === id);
    if (!format) throw new Error(`No such export: ${id}`);
    return format.write(faces, name, unit);
  }

  window.DraftExportWriters = Object.freeze({ UNITS, FORMATS, exportAs, prepare, nearestAci });
})();
