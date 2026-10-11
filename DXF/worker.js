// RoughDrafter DXF converter -- the part that does the converting.
//
// Copyright (c) 2026 bluejetty.
// This file is part of the RoughDrafter DXF converter, which is free software:
// you can redistribute it and/or modify it under the terms of the GNU General
// Public License as published by the Free Software Foundation, either version
// 3 of the License, or (at your option) any later version. See LICENSE.txt in
// this folder. It is a separate program from RoughDrafter itself; the two
// share no code and talk only by handing a finished DXF file across.
//
// RUNS OFF THE PAGE'S THREAD, so a big drawing never freezes the page while
// it converts. One message in -- { id, name, bytes } -- and one out:
//   { id, ok: true, dxf, info, preview }   or   { id, ok: false, error }
//
// THE DXF IS LIBREDWG'S OWN. libredwg writes the whole file -- every layer,
// block, hatch, dimension and table -- in the same DXF version as the DWG it
// came from. Nothing here re-draws the drawing; the preview below is the only
// thing this file draws, and it is only a picture for the list.
import { LibreDwg, Dwg_File_Type } from './vendor/libredwg-web/dist/libredwg-web.js';

let ready = null;
const libredwg = () => {
  if (!ready) {
    const wasmDir = new URL('./vendor/libredwg-web/wasm', import.meta.url).href;
    ready = LibreDwg.create(wasmDir);
  }
  return ready;
};

// DWG VERSION NAMES, from the file's first six bytes.
const VERSIONS = {
  AC1012: 'AutoCAD R13', AC1014: 'AutoCAD R14', AC1015: 'AutoCAD 2000',
  AC1018: 'AutoCAD 2004', AC1021: 'AutoCAD 2007', AC1024: 'AutoCAD 2010',
  AC1027: 'AutoCAD 2013', AC1032: 'AutoCAD 2018',
};
const versionOf = bytes => String.fromCharCode(...bytes.slice(0, 6));

// ── THE PREVIEW ─────────────────────────────────────────────────────────────
// Model space as short straight runs, blocks opened up where they stand, in a
// box no bigger than PREVIEW_MAX runs. Infinite lines (XLINE, RAY) are left
// out: they would stretch the picture to nothing.
const PREVIEW_MAX = 60000;
const MAX_DEPTH = 8;
const STEP = Math.PI / 18;

const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const mul = (a, b) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];

function arcPoints(cx, cy, r, a0, a1) {
  let sweep = a1 - a0;
  while (sweep <= 0) sweep += Math.PI * 2;
  const n = Math.max(2, Math.ceil(sweep / STEP));
  const pts = [];
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + (sweep * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// A polyline vertex's bulge is the tangent of a quarter of its arc's angle.
function bulgePoints(p, q, bulge) {
  if (!bulge) return [q];
  const theta = 4 * Math.atan(bulge);
  const chord = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (chord < 1e-12) return [q];
  const r = chord / (2 * Math.sin(Math.abs(theta) / 2));
  const mx = (p[0] + q[0]) / 2;
  const my = (p[1] + q[1]) / 2;
  const d = Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2)) * Math.sign(bulge) * (Math.abs(theta) > Math.PI ? -1 : 1);
  const ux = -(q[1] - p[1]) / chord;
  const uy = (q[0] - p[0]) / chord;
  const cx = mx + ux * d;
  const cy = my + uy * d;
  const a0 = Math.atan2(p[1] - cy, p[0] - cx);
  const n = Math.max(2, Math.ceil(Math.abs(theta) / STEP));
  const out = [];
  for (let i = 1; i <= n; i += 1) {
    const a = a0 + (theta * i) / n;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

// ── LAYERS THAT ARE ON STAY ON ──────────────────────────────────────────────
// libredwg 0.13's DXF writer puts every layer's colour (group 62) out
// negative, and a negative colour is how a DXF says "this layer is off". So
// every converted drawing opened with all its layers switched off. Found on
// Movie's own ArchiCAD files, 11 Oct: MAIN_FL_PLAN has two layers off
// (E-POWER, MARK-SECT) and the DXF said twelve.
//
// The fix reads each layer's real on/off and frozen state from the DWG and
// sets the LAYER table to match. It touches only group 62's sign and group
// 70's frozen bit, in place, and works on the bytes one to one so nothing
// else in the file -- whatever its code page -- moves.
const toText = bytes => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return s;
};
const toBytes = text => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) out[i] = text.charCodeAt(i);
  return out;
};
export function fixLayerStates(dxf, layers) {
  const state = new Map(layers.map(l => [l.name, l]));
  const lines = toText(dxf).split('\n');
  const val = i => lines[i].replace(/\r$/, '');
  const put = (i, v) => {
    const cr = lines[i].endsWith('\r') ? '\r' : '';
    const width = val(i).length;
    lines[i] = String(v).padStart(width) + cr;
  };
  let inLayerTable = false;
  let record = null;
  let changed = 0;
  const settle = () => {
    if (!record || record.name == null) return;
    const want = state.get(record.name);
    if (!want) return;
    if (record.color != null) {
      const c = Math.abs(parseInt(val(record.color), 10)) || 7;
      const next = want.off ? -c : c;
      if (parseInt(val(record.color), 10) !== next) { put(record.color, next); changed += 1; }
    }
    if (record.flags != null) {
      const f = parseInt(val(record.flags), 10) || 0;
      const next = want.frozen ? f | 1 : f & ~1;
      if (f !== next) { put(record.flags, next); changed += 1; }
    }
  };
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = val(i).trim();
    const value = val(i + 1).trim();
    if (code === '0') {
      settle();
      record = null;
      if (value === 'TABLE') inLayerTable = val(i + 3)?.trim() === 'LAYER';
      else if (value === 'ENDTAB') inLayerTable = false;
      else if (inLayerTable && value === 'LAYER') record = {};
      else if (value === 'ENDSEC' || value === 'EOF') inLayerTable = false;
    } else if (record) {
      if (code === '2' && record.name == null) record.name = val(i + 1);
      else if (code === '62' && record.color == null) record.color = i + 1;
      else if (code === '70' && record.flags == null) record.flags = i + 1;
    }
  }
  settle();
  return changed ? toBytes(lines.join('\n')) : dxf;
}

function previewOf(db) {
  // An off or frozen layer is not in the picture -- in CAD it is not on the
  // screen, and ArchiCAD parks whole layers of it a long way from the plan.
  const hidden = new Set((db.tables?.LAYER?.entries || [])
    .filter(l => l.off || l.frozen).map(l => l.name));
  const blocks = new Map();
  (db.tables?.BLOCK_RECORD?.entries || []).forEach(b => blocks.set(b.name, b));
  const runs = [];
  let count = 0;
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (m, pts, closed) => {
    if (count > PREVIEW_MAX || pts.length < 2) return;
    const out = [];
    for (const [x, y] of pts) {
      const [X, Y] = apply(m, x, y);
      if (!Number.isFinite(X) || !Number.isFinite(Y)) return;
      out.push(X, Y);
      if (X < box[0]) box[0] = X; if (Y < box[1]) box[1] = Y;
      if (X > box[2]) box[2] = X; if (Y > box[3]) box[3] = Y;
    }
    if (closed) out.push(out[0], out[1]);
    runs.push(out);
    count += out.length / 2;
  };
  const walk = (entities, m, depth) => {
    for (const e of entities || []) {
      if (count > PREVIEW_MAX) return;
      if (e.isInPaperSpace || e.isVisible === false || hidden.has(e.layer)) continue;
      switch (e.type) {
        case 'LINE':
          add(m, [[e.startPoint.x, e.startPoint.y], [e.endPoint.x, e.endPoint.y]]);
          break;
        case 'LWPOLYLINE': {
          const v = e.vertices || [];
          if (v.length < 2) break;
          const closed = (e.flag & 1) === 1;
          const pts = [[v[0].x, v[0].y]];
          const last = closed ? v.length : v.length - 1;
          for (let i = 0; i < last; i += 1) {
            const p = v[i]; const q = v[(i + 1) % v.length];
            pts.push(...bulgePoints([p.x, p.y], [q.x, q.y], p.bulge || 0));
          }
          add(m, pts);
          break;
        }
        case 'POLYLINE2D':
        case 'POLYLINE3D': {
          const v = (e.vertices || []).map(p => [p.point?.x ?? p.x, p.point?.y ?? p.y]);
          add(m, v, (e.flag & 1) === 1);
          break;
        }
        case 'ARC':
          add(m, arcPoints(e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle));
          break;
        case 'CIRCLE':
          add(m, arcPoints(e.center.x, e.center.y, e.radius, 0, Math.PI * 2));
          break;
        case 'ELLIPSE': {
          const ax = e.majorAxisEndPoint.x; const ay = e.majorAxisEndPoint.y;
          const r1 = Math.hypot(ax, ay); const r2 = r1 * e.axisRatio; const rot = Math.atan2(ay, ax);
          let a0 = e.startAngle; let a1 = e.endAngle;
          if (a1 <= a0) a1 += Math.PI * 2;
          const n = Math.max(8, Math.ceil((a1 - a0) / STEP));
          const pts = [];
          for (let i = 0; i <= n; i += 1) {
            const t = a0 + ((a1 - a0) * i) / n;
            const x = r1 * Math.cos(t); const y = r2 * Math.sin(t);
            pts.push([e.center.x + x * Math.cos(rot) - y * Math.sin(rot), e.center.y + x * Math.sin(rot) + y * Math.cos(rot)]);
          }
          add(m, pts);
          break;
        }
        case 'SPLINE': {
          const pts = (e.fitPoints?.length ? e.fitPoints : e.controlPoints || []).map(p => [p.x, p.y]);
          add(m, pts);
          break;
        }
        case 'SOLID':
        case '3DFACE': {
          const c = e.corner1 ? [e.corner1, e.corner2, e.corner4 || e.corner3, e.corner3] : (e.points || []);
          add(m, c.filter(Boolean).map(p => [p.x, p.y]), true);
          break;
        }
        case 'INSERT':
        case 'DIMENSION': {
          if (depth >= MAX_DEPTH) break;
          const block = blocks.get(e.name);
          if (!block) break;
          if (e.type === 'DIMENSION') { walk(block.entities, m, depth + 1); break; }
          const sx = e.xScale ?? 1; const sy = e.yScale ?? 1; const rot = e.rotation || 0;
          const c = Math.cos(rot); const s = Math.sin(rot);
          const base = block.basePoint || { x: 0, y: 0 };
          const cols = Math.max(1, e.columnCount || 1); const rows = Math.max(1, e.rowCount || 1);
          for (let r = 0; r < rows; r += 1) {
            for (let k = 0; k < cols; k += 1) {
              const ox = k * (e.columnSpacing || 0); const oy = r * (e.rowSpacing || 0);
              const local = [sx * c, sx * s, -sy * s, sy * c,
                e.insertionPoint.x + ox * c - oy * s, e.insertionPoint.y + ox * s + oy * c];
              const shifted = mul(local, [1, 0, 0, 1, -base.x, -base.y]);
              walk(block.entities, mul(m, shifted), depth + 1);
            }
          }
          break;
        }
        default:
          break;
      }
    }
  };
  walk(db.entities, [1, 0, 0, 1, 0, 0], 0);
  if (!runs.length) return null;
  return { runs, box };
}

self.onmessage = async ({ data }) => {
  const { id, name, bytes } = data;
  try {
    const lib = await libredwg();
    const raw = new Uint8Array(bytes);
    const code = versionOf(raw);
    if (!/^AC10\d\d$/.test(code)) throw new Error('this is not a DWG file');
    if (code > 'AC1032') throw new Error(`this DWG version (${code}) is newer than the converter can read yet`);
    const w = lib.wasmInstance;
    const inName = `in-${id}.dwg`;
    const outName = `out-${id}.dxf`;
    w.FS.writeFile(inName, raw);
    let dxf;
    try {
      const rc = w.dwg_write_dxf(inName, outName);
      if (!w.FS.analyzePath(outName, false).exists) throw new Error(`libredwg could not write the DXF (code ${rc})`);
      dxf = w.FS.readFile(outName);
    } finally {
      if (w.FS.analyzePath(inName, false).exists) w.FS.unlink(inName);
      if (w.FS.analyzePath(outName, false).exists) w.FS.unlink(outName);
    }
    // The layer states, the preview and the counts come from a second, typed
    // read. A failure here costs those, never the DXF.
    let preview = null;
    let layers = null;
    let entities = null;
    try {
      const dwg = lib.dwg_read_data(raw, Dwg_File_Type.DWG);
      const db = lib.convert(dwg);
      lib.dwg_free(dwg);
      const table = db.tables?.LAYER?.entries || [];
      layers = table.length || null;
      entities = db.entities?.filter(e => !e.isInPaperSpace).length ?? null;
      dxf = fixLayerStates(dxf, table);
      preview = previewOf(db);
    } catch (error) {
      console.warn('dxf converter: no preview for', name, error);
    }
    self.postMessage({ id, ok: true, dxf,
      info: { version: VERSIONS[code] || code, layers, entities }, preview }, [dxf.buffer]);
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error?.message || error) });
  }
};
