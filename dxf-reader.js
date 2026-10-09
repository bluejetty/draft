// READING A DXF -- the drawing file every CAD program can save -- into lines
// the plan can lay under a drawing to trace over.
//
// Movie, 9 Oct: "how about the ability to view DXF", then "do viewing first".
// TRACE already takes a PDF page or a photo; a DXF is the third kind, and the
// one that needs no SCALE and no CALIBRATE, because a DXF is drawn full size
// in real units.
//
// WHAT COMES OUT, in the file's own units (the page scales by `unitFt`):
//   paths  -- polylines, each { layer, color, pts: [x0, y0, x1, y1, ...],
//             closed, box: [minX, minY, maxX, maxY] }. LINE, LWPOLYLINE,
//             POLYLINE, ARC, CIRCLE, ELLIPSE, SPLINE, SOLID, 3DFACE and
//             LEADER all arrive as one of these; a curve is cut into short
//             straight runs fine enough to read as a curve.
//   texts  -- { layer, color, x, y, h, rot, lines, align, baseline } for TEXT,
//             MTEXT and the ATTRIBs an INSERT carries.
//   layers -- every layer the file names, its colour, whether the file has it
//             off, and how many pieces sit on it.
//   bounds -- the box round everything drawn.
// BLOCKS ARE OPENED UP: an INSERT draws its block's pieces where it stands,
// scaled and turned, nested as deep as the file goes (to a limit), and a
// DIMENSION draws the picture the CAD program saved for it. A piece on layer
// 0 inside a block takes the layer of the INSERT that placed it, and a
// BYBLOCK colour its colour -- the CAD rule, so the lines land on the layers
// a drafter would expect to switch.
//
// LEFT OUT, and said so in `skipped`: HATCH and WIPEOUT fills, POINTs, images,
// 3D solids and meshes, and anything in paper space. They are counted, never
// silently dropped.
//
// A PURE MODULE: text in, plain objects out. It reads no page, no store and
// no other module, so the harness runs it as it is.
if (!window.DraftDxfReader) {
(() => {
  // $INSUNITS -> feet. 0 is "unitless", which the page has to ask about.
  const UNITS = Object.freeze({
    in: { label: 'INCHES', ft: 1 / 12 },
    ft: { label: 'FEET', ft: 1 },
    mm: { label: 'MILLIMETRES', ft: 1 / 304.8 },
    cm: { label: 'CENTIMETRES', ft: 1 / 30.48 },
    m: { label: 'METRES', ft: 1 / 0.3048 },
  });
  const INSUNITS = { 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' };

  const MAX_DEPTH = 16;            // nested INSERTs deeper than this are a loop
  const MAX_POINTS = 3000000;      // past this the file is cut short, and says so
  const ARC_STEP = Math.PI / 36;   // 5 degrees a run: a curve, not a polygon

  // ── THE AUTOCAD COLOUR INDEX ────────────────────────────────────────────
  // 1-9 are the named ones; 10-249 run round the hue circle in 24 steps of
  // ten shades each; 250-255 are greys. 7 is "white on black, black on white"
  // and is handed back as null so the page can draw it in its own ink.
  const ACI_BASE = ['', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', null,
    '#808080', '#c0c0c0'];
  const hex = (r, g, b) => `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v)))
    .toString(16).padStart(2, '0')).join('')}`;
  function aciColor(index) {
    const i = Math.abs(Math.trunc(Number(index)));
    if (!Number.isFinite(i) || i === 0 || i === 7 || i === 256 || i > 255) return null;
    if (i < 10) return ACI_BASE[i];
    if (i >= 250) { const g = 51 + (i - 250) * 40.8; return hex(g, g, g); }
    const hue = Math.floor((i - 10) / 10) * 15;
    const shade = (i - 10) % 10;
    const value = [1, 1, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.3, 0.3][shade];
    const sat = shade % 2 ? 0.5 : 1;
    const c = value * sat, x = c * (1 - Math.abs(((hue / 60) % 2) - 1)), m = value - c;
    const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x]
      : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
    return hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  // ── GROUP CODES ─────────────────────────────────────────────────────────
  // A DXF is pairs of lines: a number saying what the next line is, then the
  // value. Every object starts at a 0.
  function pairsOf(text) {
    const lines = String(text).split(/\r\n|\r|\n/);
    const out = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const code = parseInt(lines[i].trim(), 10);
      if (!Number.isFinite(code)) {
        throw new Error(`line ${i + 1} should be a group code and reads "${lines[i].trim().slice(0, 20)}"`);
      }
      out.push([code, lines[i + 1].replace(/\s+$/, '')]);
    }
    return out;
  }

  // The pairs cut into objects: { type, codes } where codes keeps every pair
  // after the 0 in order, since some codes repeat (a polyline's vertices).
  function objectsOf(pairs) {
    const objects = [];
    let cur = null;
    pairs.forEach(([code, value]) => {
      if (code === 0) {
        cur = { type: value.trim(), codes: [] };
        objects.push(cur);
      } else if (cur) {
        cur.codes.push([code, value]);
      }
    });
    return objects;
  }

  const first = (obj, code, fallback = null) => {
    const hit = obj.codes.find(([c]) => c === code);
    return hit ? hit[1] : fallback;
  };
  const num = (obj, code, fallback = 0) => {
    const v = parseFloat(first(obj, code, ''));
    return Number.isFinite(v) ? v : fallback;
  };
  const all = (obj, code) => obj.codes.filter(([c]) => c === code).map(([, v]) => v);

  // ── 2D AFFINE TRANSFORMS, [a, b, c, d, e, f]: x' = a x + c y + e ────────
  const IDENTITY = [1, 0, 0, 1, 0, 0];
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const translate = (x, y) => [1, 0, 0, 1, x, y];
  const rotate = r => [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
  const scale = (sx, sy) => [sx, 0, 0, sy, 0, 0];
  // A 2D entity drawn with its extrusion pointing down (a mirrored block in
  // most files) has its own x running the other way.
  const ocs = obj => (num(obj, 230, 1) < 0 ? [-1, 0, 0, 1, 0, 0] : IDENTITY);

  // ── CURVES AS RUNS ──────────────────────────────────────────────────────
  function arcPts(cx, cy, r, a0, a1) {
    let sweep = a1 - a0;
    while (sweep <= 0) sweep += Math.PI * 2;
    const n = Math.max(2, Math.ceil(sweep / ARC_STEP));
    const pts = [];
    for (let i = 0; i <= n; i += 1) {
      const t = a0 + (sweep * i) / n;
      pts.push(cx + r * Math.cos(t), cy + r * Math.sin(t));
    }
    return pts;
  }
  // A polyline segment with a bulge is an arc: bulge = tan(sweep / 4), the
  // sign saying which way round.
  function bulgeArc(x0, y0, x1, y1, bulge) {
    const sweep = 4 * Math.atan(bulge);
    const chord = Math.hypot(x1 - x0, y1 - y0);
    if (!chord || Math.abs(sweep) < 1e-9) return null;
    const r = chord / (2 * Math.sin(Math.abs(sweep) / 2));
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const h = Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2));
    const ux = (x1 - x0) / chord, uy = (y1 - y0) / chord;
    const side = (bulge > 0) === (Math.abs(sweep) < Math.PI) ? 1 : -1;
    const cx = mx - uy * h * side, cy = my + ux * h * side;
    return { cx, cy, r, a0: Math.atan2(y0 - cy, x0 - cx), sweep };
  }
  function bulgePts(x0, y0, x1, y1, bulge) {
    const arc = bulgeArc(x0, y0, x1, y1, bulge);
    if (!arc) return [x1, y1];
    const { cx, cy, r, a0, sweep } = arc;
    const n = Math.max(2, Math.ceil(Math.abs(sweep) / ARC_STEP));
    const pts = [];
    for (let i = 1; i <= n; i += 1) {
      const t = a0 + (sweep * i) / n;
      pts.push(cx + r * Math.cos(t), cy + r * Math.sin(t));
    }
    pts[pts.length - 2] = x1; pts[pts.length - 1] = y1;
    return pts;
  }
  // ── CURVES AS PIECES, for a drawing to EDIT ─────────────────────────────
  // A piece is one segment of the drafter's own LINE: its two ends and, for
  // a curve, the point halfway round it. The plan draws a curved line as a
  // quadratic through that midpoint, which an arc of 45 degrees or less
  // matches to a hair -- so an arc is cut into as many of those as it takes.
  const PIECE_SWEEP = Math.PI / 4;
  function arcPieces(cx, cy, r, a0, sweep) {
    const n = Math.max(1, Math.ceil(Math.abs(sweep) / PIECE_SWEEP - 1e-9));
    const at = t => [cx + r * Math.cos(a0 + sweep * t), cy + r * Math.sin(a0 + sweep * t)];
    const out = [];
    for (let i = 0; i < n; i += 1) out.push({ a: at(i / n), b: at((i + 1) / n), mid: at((i + 0.5) / n) });
    return out;
  }
  // Straight pieces along a run of points, closing it if asked.
  function runPieces(raw, closed) {
    const out = [];
    for (let i = 2; i < raw.length; i += 2) {
      out.push({ a: [raw[i - 2], raw[i - 1]], b: [raw[i], raw[i + 1]], mid: null });
    }
    if (closed && raw.length >= 6) {
      out.push({ a: [raw[raw.length - 2], raw[raw.length - 1]], b: [raw[0], raw[1]], mid: null });
    }
    return out;
  }
  // A polyline's pieces: straight between its vertices, or round an arc
  // where the vertex carries a bulge -- with the ends exactly the vertices.
  function polyPieces(verts, closed) {
    const out = [];
    const step = (p, q) => {
      const arc = p.bulge ? bulgeArc(p.x, p.y, q.x, q.y, p.bulge) : null;
      if (!arc) { out.push({ a: [p.x, p.y], b: [q.x, q.y], mid: null }); return; }
      const pieces = arcPieces(arc.cx, arc.cy, arc.r, arc.a0, arc.sweep);
      pieces[0].a = [p.x, p.y];
      pieces[pieces.length - 1].b = [q.x, q.y];
      out.push(...pieces);
    };
    for (let i = 1; i < verts.length; i += 1) step(verts[i - 1], verts[i]);
    if (closed && verts.length >= 2) step(verts[verts.length - 1], verts[0]);
    return out;
  }

  // A B-spline by de Boor, sampled evenly in its knot span; with no knots
  // the control polygon is the best there is.
  function splinePts(degree, knots, ctrl, weights) {
    const n = ctrl.length;
    if (n < 2) return [];
    const p = Math.max(1, Math.min(degree || 3, n - 1));
    if (knots.length !== n + p + 1) return ctrl.flat();
    const w = weights.length === n ? weights : ctrl.map(() => 1);
    const t0 = knots[p], t1 = knots[n];
    const samples = Math.max(8, (n - p) * 8);
    const out = [];
    for (let s = 0; s <= samples; s += 1) {
      const t = s === samples ? t1 - 1e-9 * (t1 - t0) : t0 + ((t1 - t0) * s) / samples;
      let k = p;
      while (k < n - 1 && t >= knots[k + 1]) k += 1;
      const d = [];
      for (let j = 0; j <= p; j += 1) {
        const i = k - p + j, wi = w[i];
        d.push([ctrl[i][0] * wi, ctrl[i][1] * wi, wi]);
      }
      for (let r = 1; r <= p; r += 1) {
        for (let j = p; j >= r; j -= 1) {
          const i = k - p + j;
          const den = knots[i + p - r + 1] - knots[i];
          const a = den ? (t - knots[i]) / den : 0;
          d[j] = [0, 1, 2].map(q => (1 - a) * d[j - 1][q] + a * d[j][q]);
        }
      }
      out.push(d[p][0] / d[p][2], d[p][1] / d[p][2]);
    }
    return out;
  }

  // A spline saved as the points it passes through, with no control points:
  // a Catmull-Rom curve through them, which bends the way the CAD one does
  // rather than cutting straight from point to point.
  function throughPts(fit) {
    if (fit.length < 3) return fit.flat();
    const P = [fit[0], ...fit, fit[fit.length - 1]];
    const out = [...fit[0]];
    for (let i = 1; i < P.length - 2; i += 1) {
      const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
      for (let s = 1; s <= 8; s += 1) {
        const t = s / 8, t2 = t * t, t3 = t2 * t;
        out.push(...[0, 1].map(q => 0.5 * (2 * p1[q] + (p2[q] - p0[q]) * t
          + (2 * p0[q] - 5 * p1[q] + 4 * p2[q] - p3[q]) * t2 + (3 * p1[q] - p0[q] - 3 * p2[q] + p3[q]) * t3)));
      }
    }
    return out;
  }

  // ── TEXT ─────────────────────────────────────────────────────────────────
  // MTEXT carries its formatting inline: \P a new line, {\fArial|b0;...} a
  // font, \H2.5x; a height, \S1/2; a stacked fraction. Kept: the words.
  const SPECIAL = { c: '⌀', d: '°', p: '±', '%': '%' };
  function plainText(raw) {
    return String(raw)
      .replace(/%%([cdp%])/gi, (_, k) => SPECIAL[k.toLowerCase()])
      .replace(/%%u|%%o/gi, '')
      .replace(/\\U\+([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/\\P/g, '\n')
      .replace(/\\S([^;]*?)[\^/#]([^;]*?);/g, '$1/$2')
      .replace(/\\[ACFHQTWfhqtwacp][^;\\{}]*;/g, '')
      .replace(/\\[LlOoKkNn]/g, '')
      .replace(/\\~/g, ' ')
      .replace(/\\([\\{}])/g, '$1')
      .replace(/[{}]/g, '');
  }

  // `segments: true` also hands back every line as the pieces a drawing can
  // EDIT -- see `addPieces` -- which TRACE's EDITABLE asks for.
  function parse(text, { segments: wantSegments = false } = {}) {
    if (/^AutoCAD Binary DXF/.test(String(text).slice(0, 22))) {
      throw new Error('this is a binary DXF; save it as an ASCII DXF');
    }
    const objects = objectsOf(pairsOf(text));
    if (!objects.length) throw new Error('there is nothing in it a DXF would hold');

    // SECTIONS: the HEADER's units, the LAYER table, the BLOCKS, ENTITIES.
    let section = null;
    let units = null;
    const layerTable = new Map();
    const blocks = new Map();
    const entities = [];
    let block = null;
    let tableType = null;
    objects.forEach(obj => {
      if (obj.type === 'SECTION') {
        section = first(obj, 2, '').trim();
        // The header has no objects of its own: its variables are 9s inside
        // the SECTION, each one's value in the pair after it.
        if (section === 'HEADER') obj.codes.forEach(([code, value], i) => {
          if (code === 9 && value.trim() === '$INSUNITS') {
            const next = obj.codes[i + 1];
            if (next && next[0] === 70) units = INSUNITS[parseInt(next[1], 10)] || null;
          }
        });
        return;
      }
      if (obj.type === 'ENDSEC') { section = null; return; }
      if (section === 'TABLES') {
        if (obj.type === 'TABLE') { tableType = first(obj, 2, '').trim(); return; }
        if (obj.type === 'ENDTAB') { tableType = null; return; }
        if (tableType === 'LAYER' && obj.type === 'LAYER') {
          const name = first(obj, 2, '').trim();
          const color = parseInt(first(obj, 62, '7'), 10);
          const flags = parseInt(first(obj, 70, '0'), 10) || 0;
          const truecolor = parseInt(first(obj, 420, ''), 10);
          layerTable.set(name, {
            name,
            color: Number.isFinite(truecolor) ? hex((truecolor >> 16) & 255, (truecolor >> 8) & 255, truecolor & 255)
              : aciColor(color),
            off: color < 0 || Boolean(flags & 1),
          });
        }
        return;
      }
      if (section === 'BLOCKS') {
        if (obj.type === 'BLOCK') {
          block = { name: first(obj, 2, '').trim(), base: [num(obj, 10), num(obj, 20)], entities: [] };
          blocks.set(block.name, block);
          return;
        }
        if (obj.type === 'ENDBLK') { block = null; return; }
        if (block) block.entities.push(obj);
        return;
      }
      if (section === 'ENTITIES') entities.push(obj);
    });

    const paths = [];
    const segments = [];
    const texts = [];
    const counts = new Map();
    const skipped = {};
    let points = 0;
    let truncated = false;
    const skip = type => { skipped[type] = (skipped[type] || 0) + 1; };

    // The layer and colour a piece draws in, after the block rules.
    const layerOf = (obj, parent) => {
      const own = (first(obj, 8, '0') || '0').trim();
      return own === '0' && parent ? parent.layer : own;
    };
    const colorOf = (obj, parent, layer) => {
      const truecolor = parseInt(first(obj, 420, ''), 10);
      if (Number.isFinite(truecolor)) return hex((truecolor >> 16) & 255, (truecolor >> 8) & 255, truecolor & 255);
      const aci = parseInt(first(obj, 62, '256'), 10);
      if (aci === 0 && parent) return parent.color;
      if (aci !== 256 && aci !== 0 && Number.isFinite(aci)) return aciColor(aci);
      const row = layerTable.get(layer);
      return row ? row.color : null;
    };
    const count = layer => counts.set(layer, (counts.get(layer) || 0) + 1);

    const addPath = (m, raw, closed, layer, color) => {
      if (truncated || raw.length < 4) return;
      if (points + raw.length / 2 > MAX_POINTS) { truncated = true; return; }
      const pts = new Array(raw.length);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < raw.length; i += 2) {
        const [x, y] = apply(m, raw[i], raw[i + 1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        pts[i] = x; pts[i + 1] = y;
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      points += raw.length / 2;
      paths.push({ layer, color, pts, closed: Boolean(closed), box: [x0, y0, x1, y1] });
      count(layer);
    };

    // THE SAME LINES AS PIECES, for a drawing to edit: in world space, each
    // with its layer and colour. Only when asked: a file only viewed never
    // pays for them.
    const addPieces = (m, pieces, layer, color) => {
      if (!wantSegments || truncated) return;
      pieces.forEach(pc => {
        const a = apply(m, pc.a[0], pc.a[1]), b = apply(m, pc.b[0], pc.b[1]);
        if (![...a, ...b].every(Number.isFinite)) return;
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-9) return;
        segments.push({ layer, color, a, b, mid: pc.mid ? apply(m, pc.mid[0], pc.mid[1]) : null });
      });
    };

    // A text's height and turn under a block's transform: the height scales
    // by the transform's size, the turn adds its own.
    const addText = (m, obj, layer, color, x, y, h, rot, raw, align, baseline) => {
      const lines = plainText(raw).split('\n');
      if (!lines.some(s => s.trim())) return;
      const [tx, ty] = apply(m, x, y);
      const size = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1;
      const turn = Math.atan2(m[1], m[0]);
      texts.push({ layer, color, x: tx, y: ty, h: h * size, rot: rot + turn, lines, align, baseline });
      count(layer);
    };

    const H_ALIGN = ['left', 'center', 'right', 'left', 'center', 'left'];
    const V_BASE = ['alphabetic', 'bottom', 'middle', 'top'];
    const MTEXT_ATTACH = {
      1: ['left', 'top'], 2: ['center', 'top'], 3: ['right', 'top'],
      4: ['left', 'middle'], 5: ['center', 'middle'], 6: ['right', 'middle'],
      7: ['left', 'bottom'], 8: ['center', 'bottom'], 9: ['right', 'bottom'],
    };

    // The list of objects inside a POLYLINE..SEQEND or an INSERT's ATTRIBs,
    // walked as one: `list` is the run of objects, `i` where this one is.
    function draw(list, m, parent, depth) {
      for (let i = 0; i < list.length; i += 1) {
        if (truncated) return;
        const obj = list[i];
        if (first(obj, 67, '0').trim() === '1') { skip('paper space'); continue; }
        const layer = layerOf(obj, parent);
        const color = colorOf(obj, parent, layer);
        const om = mul(m, ocs(obj));
        switch (obj.type) {
          case 'LINE': {
            const raw = [num(obj, 10), num(obj, 20), num(obj, 11), num(obj, 21)];
            addPath(m, raw, false, layer, color);
            addPieces(m, runPieces(raw, false), layer, color);
            break;
          }
          case 'LWPOLYLINE': {
            const raw = [];
            const verts = [];
            let x = null, bulge = 0, firstPt = null;
            obj.codes.forEach(([code, value]) => {
              if (code === 10) x = parseFloat(value);
              else if (code === 20 && x !== null) {
                const y = parseFloat(value);
                if (verts.length) verts[verts.length - 1].bulge = bulge;
                verts.push({ x, y, bulge: 0 });
                if (!raw.length) { raw.push(x, y); firstPt = [x, y]; }
                else if (bulge) raw.push(...bulgePts(raw[raw.length - 2], raw[raw.length - 1], x, y, bulge));
                else raw.push(x, y);
                bulge = 0;
                x = null;
              } else if (code === 42) bulge = parseFloat(value) || 0;
            });
            if (verts.length) verts[verts.length - 1].bulge = bulge;
            const closed = (parseInt(first(obj, 70, '0'), 10) || 0) & 1;
            if (closed && firstPt && bulge) {
              raw.push(...bulgePts(raw[raw.length - 2], raw[raw.length - 1], firstPt[0], firstPt[1], bulge));
            }
            addPath(om, raw, closed && !bulge, layer, color);
            addPieces(om, polyPieces(verts, closed), layer, color);
            break;
          }
          case 'POLYLINE': {
            const flags = parseInt(first(obj, 70, '0'), 10) || 0;
            const verts = [];
            let j = i + 1;
            for (; j < list.length && list[j].type === 'VERTEX'; j += 1) verts.push(list[j]);
            if (j < list.length && list[j].type === 'SEQEND') j += 1;
            i = j - 1;
            if (flags & (16 | 64)) { skip('POLYLINE mesh'); break; }
            const raw = [];
            const pverts = [];
            let bulge = 0;
            verts.forEach(v => {
              if ((parseInt(first(v, 70, '0'), 10) || 0) & 16) return;   // spline frame point
              const x = num(v, 10), y = num(v, 20);
              pverts.push({ x, y, bulge: num(v, 42, 0) });
              if (!raw.length) raw.push(x, y);
              else if (bulge) raw.push(...bulgePts(raw[raw.length - 2], raw[raw.length - 1], x, y, bulge));
              else raw.push(x, y);
              bulge = num(v, 42, 0);
            });
            const closed = flags & 1;
            if (closed && raw.length >= 4 && bulge) {
              raw.push(...bulgePts(raw[raw.length - 2], raw[raw.length - 1], raw[0], raw[1], bulge));
            }
            addPath(flags & 8 ? m : om, raw, closed && !bulge, layer, color);
            addPieces(flags & 8 ? m : om, polyPieces(pverts, closed), layer, color);
            break;
          }
          case 'ARC': {
            const r = num(obj, 40);
            if (r > 0) {
              const a0 = (num(obj, 50) * Math.PI) / 180, a1 = (num(obj, 51) * Math.PI) / 180;
              addPath(om, arcPts(num(obj, 10), num(obj, 20), r, a0, a1), false, layer, color);
              let sweep = a1 - a0;
              while (sweep <= 0) sweep += Math.PI * 2;
              addPieces(om, arcPieces(num(obj, 10), num(obj, 20), r, a0, sweep), layer, color);
            }
            break;
          }
          case 'CIRCLE': {
            const r = num(obj, 40);
            if (r > 0) {
              addPath(om, arcPts(num(obj, 10), num(obj, 20), r, 0, Math.PI * 2), true, layer, color);
              addPieces(om, arcPieces(num(obj, 10), num(obj, 20), r, 0, Math.PI * 2), layer, color);
            }
            break;
          }
          case 'ELLIPSE': {
            const cx = num(obj, 10), cy = num(obj, 20), mx = num(obj, 11), my = num(obj, 21);
            const ratio = num(obj, 40, 1);
            let t0 = num(obj, 41, 0), t1 = num(obj, 42, Math.PI * 2);
            while (t1 <= t0) t1 += Math.PI * 2;
            const n = Math.max(8, Math.ceil((t1 - t0) / ARC_STEP));
            const raw = [];
            for (let k = 0; k <= n; k += 1) {
              const t = t0 + ((t1 - t0) * k) / n;
              const c = Math.cos(t), s = Math.sin(t);
              raw.push(cx + c * mx - s * ratio * my, cy + c * my + s * ratio * mx);
            }
            addPath(om, raw, false, layer, color);
            addPieces(om, runPieces(raw, false), layer, color);
            break;
          }
          case 'SPLINE': {
            const xs10 = all(obj, 10).map(parseFloat), ys20 = all(obj, 20).map(parseFloat);
            const xs11 = all(obj, 11).map(parseFloat), ys21 = all(obj, 21).map(parseFloat);
            const ctrl = xs10.map((x, k) => [x, ys20[k]]);
            const raw = ctrl.length >= 2
              ? splinePts(parseInt(first(obj, 71, '3'), 10), all(obj, 40).map(parseFloat), ctrl,
                all(obj, 41).map(parseFloat))
              : throughPts(xs11.map((x, k) => [x, ys21[k]]));
            const closed = (parseInt(first(obj, 70, '0'), 10) || 0) & 1;
            addPath(m, raw, closed, layer, color);
            addPieces(m, runPieces(raw, closed), layer, color);
            break;
          }
          case 'SOLID':
          case 'TRACE':
          case '3DFACE': {
            // SOLID and TRACE list their corners in Z order: 1, 2, 4, 3.
            const c = [[10, 20], [11, 21], [12, 22], [13, 23]].map(([a, b]) => [num(obj, a), num(obj, b)]);
            const ring = obj.type === '3DFACE' ? c : [c[0], c[1], c[3], c[2]];
            addPath(obj.type === '3DFACE' ? m : om, ring.flat(), true, layer, color);
            addPieces(obj.type === '3DFACE' ? m : om, runPieces(ring.flat(), true), layer, color);
            break;
          }
          case 'LEADER': {
            const xs = all(obj, 10).map(parseFloat), ys = all(obj, 20).map(parseFloat);
            addPath(m, xs.flatMap((x, k) => [x, ys[k]]), false, layer, color);
            addPieces(m, runPieces(xs.flatMap((x, k) => [x, ys[k]]), false), layer, color);
            break;
          }
          case 'TEXT':
          case 'ATTRIB': {
            if (obj.type === 'ATTRIB' && ((parseInt(first(obj, 70, '0'), 10) || 0) & 1)) break;
            const h = parseInt(first(obj, 72, '0'), 10) || 0;
            const v = parseInt(first(obj, obj.type === 'TEXT' ? 73 : 74, '0'), 10) || 0;
            const aligned = h || v;
            const x = aligned ? num(obj, 11, num(obj, 10)) : num(obj, 10);
            const y = aligned ? num(obj, 21, num(obj, 20)) : num(obj, 20);
            const [ox, oy] = apply(ocs(obj), x, y);
            addText(m, obj, layer, color, ox, oy, num(obj, 40, 1), (num(obj, 50) * Math.PI) / 180,
              first(obj, 1, ''), H_ALIGN[h] || 'left', h === 4 ? 'middle' : V_BASE[v] || 'alphabetic');
            break;
          }
          case 'MTEXT': {
            const raw = all(obj, 3).join('') + (first(obj, 1, '') || '');
            const [align, baseline] = MTEXT_ATTACH[parseInt(first(obj, 71, '1'), 10)] || MTEXT_ATTACH[1];
            const dir = first(obj, 11) !== null ? Math.atan2(num(obj, 21), num(obj, 11)) : null;
            addText(m, obj, layer, color, num(obj, 10), num(obj, 20), num(obj, 40, 1),
              dir !== null ? dir : (num(obj, 50) * Math.PI) / 180, raw, align, baseline);
            break;
          }
          case 'INSERT':
          case 'DIMENSION': {
            const name = first(obj, 2, '').trim();
            const target = blocks.get(name);
            // An INSERT's ATTRIBs follow it to a SEQEND; they are in world
            // space already and draw as text where they stand.
            if (obj.type === 'INSERT' && first(obj, 66, '0').trim() === '1') {
              const attribs = [];
              let j = i + 1;
              for (; j < list.length && list[j].type === 'ATTRIB'; j += 1) attribs.push(list[j]);
              if (j < list.length && list[j].type === 'SEQEND') j += 1;
              i = j - 1;
              draw(attribs, m, { layer, color }, depth);
            }
            if (!target) { if (name) skip(`${obj.type} of a missing block`); break; }
            if (depth >= MAX_DEPTH) { skip('blocks nested too deep'); break; }
            if (obj.type === 'DIMENSION') {
              // The block a DIMENSION names is its picture, already in place.
              draw(target.entities, m, { layer, color }, depth + 1);
              break;
            }
            const sx = num(obj, 41, 1), sy = num(obj, 42, 1);
            const rot = (num(obj, 50) * Math.PI) / 180;
            const cols = Math.max(1, parseInt(first(obj, 70, '1'), 10) || 1);
            const rows = Math.max(1, parseInt(first(obj, 71, '1'), 10) || 1);
            const dc = num(obj, 44), dr = num(obj, 45);
            for (let r = 0; r < rows; r += 1) {
              for (let c = 0; c < cols; c += 1) {
                const place = mul(om, mul(translate(num(obj, 10), num(obj, 20)),
                  mul(rotate(rot), mul(translate(c * dc, r * dr),
                    mul(scale(sx, sy), translate(-target.base[0], -target.base[1]))))));
                draw(target.entities, place, { layer, color }, depth + 1);
              }
            }
            break;
          }
          case 'VERTEX':
          case 'SEQEND':
          case 'ATTDEF':
          case 'VIEWPORT':
            break;
          default:
            skip(obj.type);
        }
      }
    }
    draw(entities, IDENTITY, null, 0);

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    paths.forEach(p => {
      if (p.box[0] < minX) minX = p.box[0]; if (p.box[1] < minY) minY = p.box[1];
      if (p.box[2] > maxX) maxX = p.box[2]; if (p.box[3] > maxY) maxY = p.box[3];
    });
    texts.forEach(t => {
      if (t.x < minX) minX = t.x; if (t.y < minY) minY = t.y;
      if (t.x > maxX) maxX = t.x; if (t.y + t.h > maxY) maxY = t.y + t.h;
    });
    if (!Number.isFinite(minX)) throw new Error('nothing in it is drawn in model space');

    // Every layer the file names, then any a piece used that the table did
    // not (a file is allowed to skip the table).
    const layers = [...layerTable.values()].map(row => ({ ...row, count: counts.get(row.name) || 0 }));
    counts.forEach((n, name) => {
      if (!layerTable.has(name)) layers.push({ name, color: null, off: false, count: n });
    });

    return {
      units,
      bounds: { minX, minY, maxX, maxY },
      paths,
      ...(wantSegments ? { segments } : {}),
      texts,
      layers,
      skipped,
      truncated,
    };
  }

  // THE PIECES AS THE DRAWING'S OWN LINES. `toWorld([x, y])` places a file
  // point on the plan ({ x, z }); each piece becomes { start, end, bulge,
  // layer } with `bulge` in the plan's own sense -- feet off the chord's
  // midpoint along its left normal, to the control point of a quadratic --
  // set so the curve passes through the arc's true midpoint, which a
  // quadratic does halfway out to its control point.
  function piecesToLines(pieces, toWorld) {
    return (pieces || []).map(pc => {
      const start = toWorld(pc.a), end = toWorld(pc.b);
      const dx = end.x - start.x, dz = end.z - start.z;
      const len = Math.hypot(dx, dz);
      if (!(len > 1e-9)) return null;
      let bulge = 0;
      if (pc.mid) {
        const m = toWorld(pc.mid);
        const off = (m.x - (start.x + end.x) / 2) * (-dz / len) + (m.z - (start.z + end.z) / 2) * (dx / len);
        bulge = Math.abs(off) > 1e-9 ? 2 * off : 0;
      }
      return { start, end, bulge, layer: pc.layer };
    }).filter(Boolean);
  }

  window.DraftDxfReader = Object.freeze({ UNITS, aciColor, plainText, parse, piecesToLines });
})();
}
