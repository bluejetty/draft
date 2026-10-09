// WRITING A DXF -- the sheets an engineer opens in AutoCAD.
//
// Movie, 9 Oct: "exactly for engineers to have autocad version to manipulate
// as they need too" -- "put all as individual autocad files with each
// layout" -- "all the layers that show on the specific layer should show" --
// "leave out the TB".
//
// THREE PIECES, all pure:
//
//   recorder(opts)  a stand-in for a canvas 2D context. A sheet's painters
//                   draw onto it exactly as they draw onto the screen, and it
//                   keeps what they stroke and letter -- lines, arcs, text,
//                   small solid marks -- in its own pixels, each on the CAD
//                   layer the caller named last (`ctx.dxfLayer`). So the DXF
//                   is the sheet, not a second drawing of it that could drift.
//   write(doc)      those, mapped to drawing units, as an AutoCAD R12 ASCII
//                   DXF: the plainest dialect, which every AutoCAD since opens
//                   (and SAVE AS DWG from there), on layers with colours and a
//                   DASHED linetype for what was drawn dashed.
//   zip(files)      the sheets, one DXF each, in one stored (uncompressed)
//                   ZIP -- one download for a whole set.
//
// WHAT IS LEFT OUT, ON PURPOSE: fills. A wall's poché, a floor's tint, the
// paper's white and every knock-out behind a label are fills, and an
// engineer wants the outlines. Only a fill that is a small dark mark -- an
// arrowhead, a tick, a dot -- is kept, as a SOLID or a CIRCLE. Pictures
// (logos, scanned underlays) are left out too.
if (!window.DraftDxfWriter) {
(() => {
  // ── COLOURS ──────────────────────────────────────────────────────────────
  // Enough of CSS colour to tell paper from ink: #rgb, #rrggbb(aa), rgb(a)
  // and the few names the painters use.
  const NAMED = { white: [255, 255, 255], black: [0, 0, 0], transparent: [0, 0, 0, 0] };
  function parseColor(value) {
    if (typeof value !== 'string') return null;
    const v = value.trim().toLowerCase();
    if (NAMED[v]) return [...NAMED[v], NAMED[v][3] ?? 1];
    let m = v.match(/^#([0-9a-f]{3,8})$/);
    if (m) {
      const h = m[1];
      const full = h.length <= 4 ? h.split('').map(c => c + c).join('') : h;
      const n = full.match(/../g).map(x => parseInt(x, 16));
      return [n[0], n[1], n[2], n.length > 3 ? n[3] / 255 : 1];
    }
    m = v.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    return null;
  }
  // Paper, not ink: near-white, or so faint it is not there.
  const isPaper = (color, alpha) => {
    const c = parseColor(color);
    if (!c) return false;
    const a = c[3] * alpha;
    if (a < 0.08) return true;
    return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.88;
  };

  // ── 2D TRANSFORMS, canvas order: [a, b, c, d, e, f] ─────────────────────
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const invert = m => {
    const det = m[0] * m[3] - m[1] * m[2] || 1e-12;
    return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
      (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
  };
  // A transform that keeps circles circles: no shear, the same scale both ways.
  const similar = m => Math.abs(m[0] - m[3]) < 1e-6 * (Math.abs(m[0]) + 1) && Math.abs(m[1] + m[2]) < 1e-6 * (Math.abs(m[1]) + 1)
    || Math.abs(m[0] + m[3]) < 1e-6 * (Math.abs(m[0]) + 1) && Math.abs(m[1] - m[2]) < 1e-6 * (Math.abs(m[1]) + 1);

  // ── CLIPPING to the axis-aligned box a viewport clips to ────────────────
  // Liang-Barsky, one segment at a time; a run of points comes back as the
  // runs that stay inside.
  function clipSeg(x0, y0, x1, y1, r) {
    let t0 = 0, t1 = 1;
    const dx = x1 - x0, dy = y1 - y0;
    const edges = [[-dx, x0 - r[0]], [dx, r[2] - x0], [-dy, y0 - r[1]], [dy, r[3] - y0]];
    for (const [p, q] of edges) {
      if (p === 0) { if (q < 0) return null; continue; }
      const t = q / p;
      if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
    }
    return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy, t0 > 0, t1 < 1];
  }
  function clipRun(pts, r) {
    if (!r) return [pts];
    const out = [];
    let cur = null;
    for (let i = 2; i < pts.length; i += 2) {
      const c = clipSeg(pts[i - 2], pts[i - 1], pts[i], pts[i + 1], r);
      if (!c) { if (cur) { out.push(cur); cur = null; } continue; }
      if (!cur || c[4]) { if (cur) out.push(cur); cur = [c[0], c[1]]; }
      cur.push(c[2], c[3]);
      if (c[5]) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out.filter(run => run.length >= 4);
  }
  const inside = (x, y, r) => !r || (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]);

  // ── THE RECORDER ─────────────────────────────────────────────────────────
  // Paths are kept as subpaths of points in RECORDER pixels, with the one
  // exception a CAD file cares about: a subpath that is a single circular arc
  // is kept as that arc, so a door swing goes out as an ARC and a dot as a
  // CIRCLE rather than as forty little lines.
  const ARC_STEPS = 48;          // a full turn, when an arc must be cut up
  const CURVE_STEPS = 16;        // a bezier or quadratic
  const SOLID_MAX = 40;          // a filled mark this many pixels or smaller is kept

  function recorder({ width = 1000, height = 1000, layer = '0' } = {}) {
    const entities = [];
    let state = {
      m: [1, 0, 0, 1, 0, 0], clip: null, dash: [], dxfLayer: layer,
      strokeStyle: '#000', fillStyle: '#000', globalAlpha: 1, lineWidth: 1, font: '10px sans-serif',
      textAlign: 'start', textBaseline: 'alphabetic',
    };
    const stack = [];
    // A SUBPATH IS A RUN OF PIECES: straight runs of points, and circular
    // arcs kept as arcs, so a door's leaf and swing go out as a LINE and an
    // ARC rather than one polyline of fifty points.
    let subpaths = [];
    let current = null;
    const devStart = () => current && current.first;
    const lastDev = () => {
      if (!current) return null;
      const seg = current.segs[current.segs.length - 1];
      const k = seg.pts.length;
      return [seg.pts[k - 2], seg.pts[k - 1]];
    };
    const startAt = (x, y) => {
      const p = ap(state.m, x, y);
      current = { segs: [{ t: 'run', pts: [...p] }], closed: false, first: p };
      subpaths.push(current);
    };
    const toDev = (dx, dy) => {
      const seg = current.segs[current.segs.length - 1];
      if (seg.t === 'run') seg.pts.push(dx, dy);
      else { const [lx, ly] = lastDev(); current.segs.push({ t: 'run', pts: [lx, ly, dx, dy] }); }
    };
    const lineAt = (x, y) => {
      if (!current) { startAt(x, y); return; }
      toDev(...ap(state.m, x, y));
    };
    const lastLocal = () => {
      const d = lastDev();
      return d ? ap(invert(state.m), d[0], d[1]) : null;
    };
    const allPts = sp => sp.segs.flatMap(seg => seg.pts);

    const ctx = {
      canvas: { width, height },
      get dxfLayer() { return state.dxfLayer; },
      set dxfLayer(v) { state.dxfLayer = v || layer; },
      save() { stack.push({ ...state, m: [...state.m], dash: [...state.dash] }); },
      restore() { if (stack.length) state = stack.pop(); },
      translate(x, y) { state.m = mul(state.m, [1, 0, 0, 1, x, y]); },
      scale(x, y) { state.m = mul(state.m, [x, 0, 0, y, 0, 0]); },
      rotate(r) { const c = Math.cos(r), s = Math.sin(r); state.m = mul(state.m, [c, s, -s, c, 0, 0]); },
      transform(a, b, c, d, e, f) { state.m = mul(state.m, [a, b, c, d, e, f]); },
      setTransform(a, b, c, d, e, f) {
        if (a && typeof a === 'object') state.m = [a.a, a.b, a.c, a.d, a.e, a.f];
        else state.m = [a, b, c, d, e, f];
      },
      resetTransform() { state.m = [1, 0, 0, 1, 0, 0]; },
      getTransform() {
        const [a, b, c, d, e, f] = state.m;
        return { a, b, c, d, e, f, inverse() { const [ia, ib, ic, id, ie, iff] = invert([a, b, c, d, e, f]); return { a: ia, b: ib, c: ic, d: id, e: ie, f: iff }; } };
      },
      setLineDash(d) { state.dash = Array.isArray(d) ? d.filter(n => n > 0) : []; },
      getLineDash() { return [...state.dash]; },
      beginPath() { subpaths = []; current = null; },
      moveTo(x, y) { startAt(x, y); },
      lineTo(x, y) { lineAt(x, y); },
      closePath() {
        if (!current) return;
        const [fx, fy] = current.first;
        const [lx, ly] = lastDev();
        if (Math.hypot(lx - fx, ly - fy) > 1e-6) toDev(fx, fy);
        current.closed = true;
        current = { segs: [{ t: 'run', pts: [fx, fy] }], closed: false, first: [fx, fy] };
        subpaths.push(current);
      },
      rect(x, y, w, h) {
        startAt(x, y); lineAt(x + w, y); lineAt(x + w, y + h); lineAt(x, y + h);
        ctx.closePath();
      },
      roundRect(x, y, w, h) { ctx.rect(x, y, w, h); },
      arc(cx, cy, r, a0, a1, ccw = false) {
        let sweep = a1 - a0;
        if (!ccw && sweep < 0) sweep = (sweep % (2 * Math.PI)) + 2 * Math.PI;
        if (ccw && sweep > 0) sweep = (sweep % (2 * Math.PI)) - 2 * Math.PI;
        if (Math.abs(a1 - a0) >= 2 * Math.PI - 1e-9) sweep = ccw ? -2 * Math.PI : 2 * Math.PI;
        const n = Math.max(2, Math.ceil((ARC_STEPS * Math.abs(sweep)) / (2 * Math.PI)));
        const [sx, sy] = ap(state.m, cx + r * Math.cos(a0), cy + r * Math.sin(a0));
        if (!current) startAt(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
        else {
          const [lx, ly] = lastDev();
          if (Math.hypot(lx - sx, ly - sy) > 1e-6) toDev(sx, sy);
        }
        const pts = [sx, sy];
        for (let i = 1; i <= n; i += 1) {
          const t = a0 + (sweep * i) / n;
          pts.push(...ap(state.m, cx + r * Math.cos(t), cy + r * Math.sin(t)));
        }
        current.segs.push({ t: 'arc', cx, cy, r, a0, sweep, m: [...state.m], pts });
      },
      ellipse(cx, cy, rx, ry, rot, a0, a1, ccw = false) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(rx, ry);
        ctx.arc(0, 0, 1, a0, a1, ccw); ctx.restore();
      },
      arcTo(x1, y1, x2, y2) { lineAt(x1, y1); lineAt(x2, y2); },
      quadraticCurveTo(cpx, cpy, x, y) {
        const p = lastLocal() || [cpx, cpy];
        for (let i = 1; i <= CURVE_STEPS; i += 1) {
          const t = i / CURVE_STEPS, it = 1 - t;
          lineAt(it * it * p[0] + 2 * it * t * cpx + t * t * x, it * it * p[1] + 2 * it * t * cpy + t * t * y);
        }
      },
      bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
        const p = lastLocal() || [c1x, c1y];
        for (let i = 1; i <= CURVE_STEPS; i += 1) {
          const t = i / CURVE_STEPS, it = 1 - t;
          lineAt(it ** 3 * p[0] + 3 * it * it * t * c1x + 3 * it * t * t * c2x + t ** 3 * x,
            it ** 3 * p[1] + 3 * it * it * t * c1y + 3 * it * t * t * c2y + t ** 3 * y);
        }
      },
      clip() {
        // The box round what was traced, in recorder pixels, narrowed by any
        // clip already in force.
        let box = [Infinity, Infinity, -Infinity, -Infinity];
        subpaths.forEach(sp => { const pts = allPts(sp); for (let i = 0; i < pts.length; i += 2) {
          box = [Math.min(box[0], pts[i]), Math.min(box[1], pts[i + 1]),
            Math.max(box[2], pts[i]), Math.max(box[3], pts[i + 1])];
        } });
        if (!Number.isFinite(box[0])) return;
        state.clip = state.clip ? [Math.max(box[0], state.clip[0]), Math.max(box[1], state.clip[1]),
          Math.min(box[2], state.clip[2]), Math.min(box[3], state.clip[3])] : box;
      },
      stroke() {
        if (isPaper(state.strokeStyle, state.globalAlpha)) return;
        const dashed = state.dash.length > 0;
        const layerNow = state.dxfLayer;
        const runOut = (pts, closed) => {
          if (pts.length < 4) return;
          clipRun(pts, state.clip).forEach(run => {
            const whole = closed && run.length === pts.length;
            entities.push({ type: 'poly', layer: layerNow, dashed,
              pts: whole ? run.slice(0, -2) : run, closed: whole });
          });
        };
        subpaths.forEach(sp => {
          const onlyRun = sp.segs.length === 1 && sp.segs[0].t === 'run';
          sp.segs.forEach(seg => {
            if (seg.t === 'run') { runOut(seg.pts, onlyRun && sp.closed); return; }
            const xs = [], ys = [];
            for (let i = 0; i < seg.pts.length; i += 2) { xs.push(seg.pts[i]); ys.push(seg.pts[i + 1]); }
            const fits = !state.clip || (Math.min(...xs) >= state.clip[0] && Math.max(...xs) <= state.clip[2]
              && Math.min(...ys) >= state.clip[1] && Math.max(...ys) <= state.clip[3]);
            if (fits && similar(seg.m)) {
              const m = seg.m;
              const [cx, cy] = ap(m, seg.cx, seg.cy);
              const det = m[0] * m[3] - m[1] * m[2];
              const flip = det < 0 ? -1 : 1;
              entities.push({ type: 'arc', layer: layerNow, dashed, cx, cy, r: seg.r * Math.sqrt(Math.abs(det)),
                a0: flip * seg.a0 + Math.atan2(m[1], m[0]), sweep: flip * seg.sweep });
            } else {
              runOut(seg.pts, false);
            }
          });
        });
      },
      fill() {
        // Only a small dark mark: an arrowhead, a tick, a dot.
        if (isPaper(state.fillStyle, state.globalAlpha)) return;
        const c = parseColor(state.fillStyle);
        if (c && (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.6) return;
        subpaths.forEach(sp => {
          const pts = allPts(sp);
          if (pts.length < 6) return;
          const xs = [], ys = [];
          for (let i = 0; i < pts.length; i += 2) { xs.push(pts[i]); ys.push(pts[i + 1]); }
          if (Math.max(...xs) - Math.min(...xs) > SOLID_MAX || Math.max(...ys) - Math.min(...ys) > SOLID_MAX) return;
          if (!inside(xs[0], ys[0], state.clip)) return;
          const arcs = sp.segs.filter(seg => seg.t === 'arc');
          if (arcs.length === 1 && Math.abs(arcs[0].sweep) >= 2 * Math.PI - 1e-6 && similar(arcs[0].m)) {
            const m = arcs[0].m;
            const [cx, cy] = ap(m, arcs[0].cx, arcs[0].cy);
            entities.push({ type: 'circle', layer: state.dxfLayer, cx, cy,
              r: arcs[0].r * Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])), filled: true });
            return;
          }
          if (arcs.length) return;
          // The distinct corners of a triangle or a quad.
          const corners = [];
          for (let i = 0; i < xs.length; i += 1) {
            const prev = corners[corners.length - 1];
            if (!prev || Math.hypot(prev[0] - xs[i], prev[1] - ys[i]) > 1e-6) corners.push([xs[i], ys[i]]);
          }
          if (corners.length > 1 && Math.hypot(corners[0][0] - corners[corners.length - 1][0],
            corners[0][1] - corners[corners.length - 1][1]) < 1e-6) corners.pop();
          if (corners.length < 3 || corners.length > 4) return;
          entities.push({ type: 'solid', layer: state.dxfLayer, corners });
        });
      },
      strokeRect(x, y, w, h) { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.stroke(); },
      fillRect() {},
      clearRect() {},
      fillText(text, x, y) {
        const words = String(text ?? '');
        if (!words.trim() || isPaper(state.fillStyle, state.globalAlpha)) return;
        const [px, py] = ap(state.m, x, y);
        if (!inside(px, py, state.clip)) return;
        const size = parseFloat((String(state.font).match(/(\d+(?:\.\d+)?)px/) || [])[1]) || 10;
        const s = Math.sqrt(Math.abs(state.m[0] * state.m[3] - state.m[1] * state.m[2]));
        entities.push({ type: 'text', layer: state.dxfLayer, x: px, y: py,
          // A CAD text height is its capitals; a CSS font size is the em.
          h: size * s * 0.7, rot: Math.atan2(state.m[1], state.m[0]), text: words,
          align: state.textAlign, baseline: state.textBaseline });
      },
      strokeText(text, x, y) { ctx.fillText(text, x, y); },
      measureText(text) {
        const size = parseFloat((String(state.font).match(/(\d+(?:\.\d+)?)px/) || [])[1]) || 10;
        const width = String(text ?? '').length * size * 0.5;
        return { width, actualBoundingBoxAscent: size * 0.7, actualBoundingBoxDescent: size * 0.2 };
      },
      drawImage() {},
      createLinearGradient() { return { addColorStop() {} }; },
      createRadialGradient() { return { addColorStop() {} }; },
      createPattern() { return null; },
      isPointInPath() { return false; },
      entities,
    };
    // The rest of a context's settable state, kept so a painter reading it
    // back gets what it wrote.
    ['strokeStyle', 'fillStyle', 'globalAlpha', 'lineWidth', 'font', 'textAlign', 'textBaseline']
      .forEach(key => Object.defineProperty(ctx, key, {
        get: () => state[key], set: v => { state[key] = v; }, enumerable: true,
      }));
    ['lineCap', 'lineJoin', 'miterLimit', 'lineDashOffset', 'globalCompositeOperation', 'shadowBlur',
      'shadowColor', 'shadowOffsetX', 'shadowOffsetY', 'filter', 'imageSmoothingEnabled', 'direction',
      'letterSpacing', 'fontKerning'].forEach(key => {
      let v;
      Object.defineProperty(ctx, key, { get: () => v, set: x => { v = x; }, enumerable: true });
    });
    return ctx;
  }

  // ── MAPPING: recorder pixels to drawing units ───────────────────────────
  // `map([x, y])` is an affine map with the SAME scale both ways (it may flip
  // y, which a canvas-down to CAD-up map does). Arcs, text heights and turns
  // follow it.
  function mapEntities(entities, map) {
    const o = map([0, 0]), ux = map([1, 0]), uy = map([0, 1]);
    const k = Math.hypot(ux[0] - o[0], ux[1] - o[1]);
    const flip = ((ux[0] - o[0]) * (uy[1] - o[1]) - (ux[1] - o[1]) * (uy[0] - o[0])) < 0 ? -1 : 1;
    const turn = Math.atan2(ux[1] - o[1], ux[0] - o[0]);
    return entities.map(e => {
      if (e.type === 'poly') {
        const pts = [];
        for (let i = 0; i < e.pts.length; i += 2) pts.push(...map([e.pts[i], e.pts[i + 1]]));
        return { ...e, pts };
      }
      if (e.type === 'arc') {
        const [cx, cy] = map([e.cx, e.cy]);
        return { ...e, cx, cy, r: e.r * k, a0: flip * e.a0 + turn, sweep: flip * e.sweep };
      }
      if (e.type === 'circle') {
        const [cx, cy] = map([e.cx, e.cy]);
        return { ...e, cx, cy, r: e.r * k };
      }
      if (e.type === 'solid') return { ...e, corners: e.corners.map(map) };
      if (e.type === 'text') {
        const [x, y] = map([e.x, e.y]);
        // A canvas baseline runs down the page as y grows; mirrored into a
        // CAD file's y-up world, `top` and `bottom` swap their sense not
        // at all -- they are still the text's own top and bottom.
        return { ...e, x, y, h: e.h * k, rot: flip * e.rot + turn };
      }
      return e;
    });
  }

  const bounds = entities => {
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    const add = (x, y) => { b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)]; };
    entities.forEach(e => {
      if (e.type === 'poly') for (let i = 0; i < e.pts.length; i += 2) add(e.pts[i], e.pts[i + 1]);
      else if (e.type === 'arc' || e.type === 'circle') { add(e.cx - e.r, e.cy - e.r); add(e.cx + e.r, e.cy + e.r); }
      else if (e.type === 'solid') e.corners.forEach(([x, y]) => add(x, y));
      else if (e.type === 'text') { add(e.x, e.y); add(e.x, e.y + e.h); }
    });
    return Number.isFinite(b[0]) ? b : [0, 0, 0, 0];
  };

  // ── THE R12 FILE ─────────────────────────────────────────────────────────
  // R12 layer names: capitals, digits, $ - _, up to 31.
  const layerName = name => String(name || '0').toUpperCase().replace(/[^A-Z0-9$_-]/g, '_').slice(0, 31) || '0';
  // What an R12 TEXT can carry: ASCII, AutoCAD's own %% codes for the three
  // drafting marks, and \U+ for the rest.
  const textOf = s => String(s).replace(/%/g, '%%%')
    .replace(/°/g, '%%d').replace(/±/g, '%%p').replace(/[⌀Ø]/g, '%%c')
    .replace(/[^\x20-\x7e]/g, ch => `\\U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
  const H_ALIGN = { left: 0, start: 0, center: 1, right: 2, end: 2 };
  const V_ALIGN = { alphabetic: 0, bottom: 1, ideographic: 1, middle: 2, top: 3, hanging: 3 };
  const n = v => (Math.abs(v) < 1e-9 ? 0 : Number(v.toFixed(6)));

  // A LAYER'S COLOUR, by its family, in AutoCAD's numbers -- the usual
  // office habit, so an engineer can tell walls from doors from dimensions at
  // a glance and switch any of them off.
  const CAD_COLORS = [
    [/^A-WALL/, 7], [/^A-DOOR/, 3], [/^A-GLAZ/, 4], [/^A-FIXT/, 6], [/^A-DIMS/, 1],
    [/^(A-ANNO|ROOM-IDS)/, 2], [/^A-STR/, 5], [/^A-ROOF/, 30], [/^A-FL/, 8], [/^S-/, 140],
    [/^E-/, 210], [/^A-EXST/, 9], [/^A-(SECT|ELEV|PLAN)/, 7],
  ];
  const cadColor = name => (CAD_COLORS.find(([re]) => re.test(layerName(name))) || [null, 7])[1];

  // `doc`: { entities (in drawing units, y up), layers: [{ name, color }],
  //   unitsLabel }. Layer colours are AutoCAD colour numbers.
  function write({ entities = [], layers = [] } = {}) {
    const out = [];
    const put = (code, value) => { out.push(String(code), String(value)); };
    const colorOf = new Map(layers.map(l => [layerName(l.name), l.color || 7]));
    const used = [...new Set(entities.map(e => layerName(e.layer)))];
    used.forEach(name => { if (!colorOf.has(name)) colorOf.set(name, cadColor(name)); });
    const b = bounds(entities);

    put(0, 'SECTION'); put(2, 'HEADER');
    put(9, '$ACADVER'); put(1, 'AC1009');
    put(9, '$INSBASE'); put(10, 0); put(20, 0); put(30, 0);
    put(9, '$EXTMIN'); put(10, n(b[0])); put(20, n(b[1])); put(30, 0);
    put(9, '$EXTMAX'); put(10, n(b[2])); put(20, n(b[3])); put(30, 0);
    // Architectural units to the 1/16": a 1 is an inch and reads 1'-0" as 12.
    put(9, '$LUNITS'); put(70, 4);
    put(9, '$LUPREC'); put(70, 4);
    put(9, '$LTSCALE'); put(40, 1);
    put(0, 'ENDSEC');

    put(0, 'SECTION'); put(2, 'TABLES');
    put(0, 'TABLE'); put(2, 'LTYPE'); put(70, 2);
    put(0, 'LTYPE'); put(2, 'CONTINUOUS'); put(70, 0); put(3, 'Solid line'); put(72, 65); put(73, 0); put(40, 0);
    put(0, 'LTYPE'); put(2, 'DASHED'); put(70, 0); put(3, '__ __ __'); put(72, 65); put(73, 2); put(40, 9);
    put(49, 6); put(49, -3);
    put(0, 'ENDTAB');
    put(0, 'TABLE'); put(2, 'LAYER'); put(70, colorOf.size);
    colorOf.forEach((color, name) => {
      put(0, 'LAYER'); put(2, name); put(70, 0); put(62, color); put(6, 'CONTINUOUS');
    });
    put(0, 'ENDTAB');
    put(0, 'TABLE'); put(2, 'STYLE'); put(70, 1);
    put(0, 'STYLE'); put(2, 'STANDARD'); put(70, 0); put(40, 0); put(41, 1); put(50, 0); put(71, 0);
    put(42, 2.5); put(3, 'txt'); put(4, '');
    put(0, 'ENDTAB');
    put(0, 'ENDSEC');

    put(0, 'SECTION'); put(2, 'BLOCKS'); put(0, 'ENDSEC');

    put(0, 'SECTION'); put(2, 'ENTITIES');
    const deg = r => n((((r * 180) / Math.PI) % 360 + 360) % 360);
    entities.forEach(e => {
      const layer = layerName(e.layer);
      const lt = () => { if (e.dashed) put(6, 'DASHED'); };
      if (e.type === 'poly') {
        if (e.pts.length === 4 && !e.closed) {
          put(0, 'LINE'); put(8, layer); lt();
          put(10, n(e.pts[0])); put(20, n(e.pts[1])); put(30, 0);
          put(11, n(e.pts[2])); put(21, n(e.pts[3])); put(31, 0);
          return;
        }
        put(0, 'POLYLINE'); put(8, layer); lt(); put(66, 1); put(10, 0); put(20, 0); put(30, 0);
        put(70, e.closed ? 1 : 0);
        for (let i = 0; i < e.pts.length; i += 2) {
          put(0, 'VERTEX'); put(8, layer); put(10, n(e.pts[i])); put(20, n(e.pts[i + 1])); put(30, 0);
        }
        put(0, 'SEQEND'); put(8, layer);
      } else if (e.type === 'arc') {
        if (Math.abs(e.sweep) >= 2 * Math.PI - 1e-6) {
          put(0, 'CIRCLE'); put(8, layer); lt(); put(10, n(e.cx)); put(20, n(e.cy)); put(30, 0); put(40, n(e.r));
          return;
        }
        // A DXF arc runs counter-clockwise from its start to its end.
        const a = e.sweep >= 0 ? e.a0 : e.a0 + e.sweep;
        put(0, 'ARC'); put(8, layer); lt(); put(10, n(e.cx)); put(20, n(e.cy)); put(30, 0); put(40, n(e.r));
        put(50, deg(a)); put(51, deg(a + Math.abs(e.sweep)));
      } else if (e.type === 'circle') {
        put(0, 'CIRCLE'); put(8, layer); put(10, n(e.cx)); put(20, n(e.cy)); put(30, 0); put(40, n(e.r));
      } else if (e.type === 'solid') {
        // SOLID's corners go 1, 2, 4, 3 -- a triangle repeats its last.
        const c = e.corners.length === 3 ? [...e.corners, e.corners[2]] : e.corners;
        const order = [c[0], c[1], c[3], c[2]];
        put(0, 'SOLID'); put(8, layer);
        order.forEach(([x, y], i) => { put(10 + i, n(x)); put(20 + i, n(y)); put(30 + i, 0); });
      } else if (e.type === 'text') {
        const h = H_ALIGN[e.align] ?? 0, v = V_ALIGN[e.baseline] ?? 0;
        put(0, 'TEXT'); put(8, layer);
        put(10, n(e.x)); put(20, n(e.y)); put(30, 0);
        put(40, n(Math.max(e.h, 1e-3))); put(1, textOf(e.text));
        if (Math.abs(e.rot) > 1e-9) put(50, deg(e.rot));
        if (h || v) { put(72, h); put(11, n(e.x)); put(21, n(e.y)); put(31, 0); put(73, v); }
      }
    });
    put(0, 'ENDSEC');
    put(0, 'EOF');
    return `${out.join('\r\n')}\r\n`;
  }

  // ── A STORED ZIP ─────────────────────────────────────────────────────────
  // No compression: the archive is a wrapper, and text DXFs are what an
  // engineer's machine unpacks in a blink. CRC-32 per entry, as the format
  // requires.
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();
  const crc32 = bytes => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const utf8 = s => (typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s)
    : Uint8Array.from(unescape(encodeURIComponent(s)), ch => ch.charCodeAt(0)));

  // files: [{ name, text }] -> Uint8Array of the archive.
  function zip(files) {
    const parts = [];
    const central = [];
    let offset = 0;
    const u16 = v => [v & 0xff, (v >>> 8) & 0xff];
    const u32 = v => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    files.forEach(({ name, text }) => {
      const nameBytes = utf8(name);
      const data = utf8(text);
      const crc = crc32(data);
      // General purpose flag 0x0800: the name is UTF-8.
      const local = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)];
      parts.push(Uint8Array.from(local), nameBytes, data);
      central.push([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21),
        ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0), ...u32(offset)], nameBytes);
      offset += local.length + nameBytes.length + data.length;
    });
    const centralBytes = [];
    let centralSize = 0;
    central.forEach(part => {
      const bytes = part instanceof Uint8Array ? part : Uint8Array.from(part);
      centralBytes.push(bytes);
      centralSize += bytes.length;
    });
    const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
      ...u32(centralSize), ...u32(offset), ...u16(0)]);
    const all = [...parts, ...centralBytes, end];
    const total = all.reduce((sum, p) => sum + p.length, 0);
    const outBytes = new Uint8Array(total);
    let at = 0;
    all.forEach(p => { outBytes.set(p, at); at += p.length; });
    return outBytes;
  }

  // Every entity moved by (dx, dy), in drawing units.
  function shiftEntities(entities, dx, dy) {
    return entities.map(e => {
      if (e.type === 'poly') return { ...e, pts: e.pts.map((v, i) => v + (i % 2 ? dy : dx)) };
      if (e.type === 'arc' || e.type === 'circle') return { ...e, cx: e.cx + dx, cy: e.cy + dy };
      if (e.type === 'solid') return { ...e, corners: e.corners.map(([x, y]) => [x + dx, y + dy]) };
      if (e.type === 'text') return { ...e, x: e.x + dx, y: e.y + dy };
      return e;
    });
  }

  window.DraftDxfWriter = Object.freeze({
    recorder, mapEntities, shiftEntities, bounds, write, zip, layerName, cadColor, parseColor,
  });
})();
}
