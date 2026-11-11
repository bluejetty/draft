// PEN TABLE: what each CAD layer prints with.
//
// jb, 9 Nov: "Line weights / a pen table. There is no way I could see to say
// 'walls heavy, dims light, hidden dashed' and have it print that way."
//
// The sheet composer (plan-composition.js) already announces the layer of
// every piece before it paints it -- `onLayer(ctx, 'A-WALL-EXT')` -- but
// only a DXF recorder had a `dxfLayer` to announce it to; a canvas has no
// such thing and heard nothing. This file gives the canvas ears: `wrap`
// puts a thin proxy in front of any drawing context (a real
// CanvasRenderingContext2D, the print canvas, or dxf-writer.js's recorder)
// that carries `dxfLayer`, listens for it, and from then until the next
// layer is named strokes everything at the PEN the company standard gives
// that layer.
//
// THE PEN IS ABSOLUTE, like a CAD plot style: a layer set to BOLD strokes
// every line on it at BOLD, whatever width the painter asked for, and a
// layer set to DASHED dashes every line on it. That is what a drafter
// means by a pen table. A layer whose pen is DEFAULT (the shipped setting
// for every layer) is left entirely to the painter, so a sheet from before
// the table existed prints unchanged.
//
// THE WEIGHTS AND DASHES ARE line-styles.js's, in paper pixels at the print
// zoom (72 to the inch): HAIR 0.5 px to XTRA-BOLD 4.5 px, scaled by the
// sheet's `inkScale` the way every other ink on the sheet is. The DXF side
// reads the same pens through `dxfLayerFor`, which turns a pen into the
// LAYER-table words AutoCAD wants: a linetype name and a lineweight in
// hundredths of a millimetre.
(() => {
  'use strict';
  const LS = () => (typeof window !== 'undefined' ? window.DraftLineStyles : null);
  const WRAPPED = Symbol('DraftPenTable.wrapped');

  // THE PEN FOR ONE LAYER STANDARD, or null when it has nothing to say.
  // `standard` is a normalised entry from profile-manager.js
  // ({ weight: 'default' | '1'..'6', linetype: 'default' | 'solid' | ... }).
  const penFor = standard => {
    if (!standard || typeof standard !== 'object') return null;
    const styles = LS();
    const weight = styles && standard.weight !== 'default' ? styles.weightOf(standard.weight) : null;
    const style = styles && standard.linetype !== 'default' ? styles.styleOf(standard.linetype) : null;
    if (!weight && !style) return null;
    return { px: weight ? weight.px : null, dash: style ? style.dash : null, weight, style };
  };

  // A PEN'S DXF WORDS: the linetype name the LAYER table carries, and the
  // lineweight in 1/100 mm (AutoCAD's own unit for group code 370). A paper
  // pixel at 72 to the inch is 0.353 mm, so HAIR (0.5 px) is 0.18 mm and
  // XTRA-BOLD (4.5 px) 1.59 mm; AutoCAD only lists certain weights, so the
  // nearest of its ladder is what goes out.
  const ACAD_WEIGHTS = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211];
  const MM_PER_PX = 25.4 / 72;
  const dxfLayerFor = standard => {
    const pen = penFor(standard);
    const out = { linetype: 'CONTINUOUS', lineweight: null };
    if (!pen) return out;
    if (pen.style) out.linetype = pen.style.dxf;
    if (pen.px != null) {
      const want = pen.px * MM_PER_PX * 100;
      out.lineweight = ACAD_WEIGHTS.reduce((best, w) => (Math.abs(w - want) < Math.abs(best - want) ? w : best), ACAD_WEIGHTS[0]);
    }
    return out;
  };

  // ── THE PROXY ─────────────────────────────────────────────────────────
  // `lookup(layerId)` answers the layer's normalised standard (or null).
  // `inkScale` is the sheet's ink multiplier, 1 at the print zoom.
  const wrap = (ctx, { lookup, inkScale = 1 } = {}) => {
    if (!ctx || typeof lookup !== 'function') return ctx;
    if (ctx[WRAPPED]) return ctx;
    const k = Number.isFinite(inkScale) && inkScale > 0 ? inkScale : 1;
    const inner = 'dxfLayer' in ctx;
    // WHAT THE PAINTER ASKED FOR is remembered beside what the pen made of
    // it, so a layer with no pen gets the painter's own width and dash back
    // -- strokeLines sets a line's ink and THEN names its layer, and a
    // dashed pen on the layer before must not leak onto it.
    const state = { layer: inner ? ctx.dxfLayer : null, pen: null, width: ctx.lineWidth, dash: [] };
    const canDash = typeof ctx.setLineDash === 'function';
    // AND IT FOLLOWS save()/restore() (jb, 10 Nov: "the dim lines are
    // showing as dashed dotted"): a painter that sets a dot-dash line's
    // dash inside a save/restore pair hands the real canvas its solid dash
    // back on restore, but this memory of what it asked for stayed
    // dot-dash -- and the next layer named, the dimensions after the
    // lines, got that dash reapplied. The memory is stacked with the
    // canvas's own state so a restore forgets what the pair asked for.
    const stack = [];
    // The dash rhythm follows the stroke it is on, as line-styles.js scales
    // a bold dashed line's pattern by its weight.
    const applyDash = () => {
      if (!canDash) return;
      if (state.pen && state.pen.dash) {
        const w = Math.max(1, ctx.lineWidth || 1);
        ctx.setLineDash(state.pen.dash.map(d => d * w));
      } else ctx.setLineDash(state.dash);
    };
    const applyPen = () => {
      ctx.lineWidth = state.pen && state.pen.px != null ? state.pen.px * k : state.width;
      applyDash();
    };
    const setLayer = id => {
      state.layer = id;
      if (inner) ctx.dxfLayer = id;
      state.pen = penFor(lookup(id));
      applyPen();
    };
    const handler = {
      has: (target, prop) => prop === 'dxfLayer' || prop === WRAPPED || prop in target,
      get: (target, prop) => {
        if (prop === WRAPPED) return true;
        if (prop === 'dxfLayer') return state.layer;
        if (prop === 'setLineDash' && canDash) {
          return dash => { state.dash = Array.isArray(dash) ? dash.slice() : []; applyDash(); };
        }
        if (prop === 'save' && typeof target.save === 'function') {
          return () => { stack.push({ width: state.width, dash: state.dash.slice() }); target.save(); };
        }
        if (prop === 'restore' && typeof target.restore === 'function') {
          return () => {
            target.restore();
            const kept = stack.pop();
            if (kept) { state.width = kept.width; state.dash = kept.dash; }
            // The canvas took its own width and dash back; the pen on the
            // layer still named stands over them as it did before the pair.
            applyPen();
          };
        }
        const value = target[prop];
        return typeof value === 'function' ? value.bind(target) : value;
      },
      set: (target, prop, value) => {
        if (prop === 'dxfLayer') { setLayer(value); return true; }
        if (prop === 'lineWidth') { state.width = value; applyPen(); return true; }
        target[prop] = value;
        return true;
      },
    };
    return new Proxy(ctx, handler);
  };

  const api = Object.freeze({ penFor, dxfLayerFor, wrap, MM_PER_PX });
  if (typeof window !== 'undefined') window.DraftPenTable = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
