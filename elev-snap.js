// ELEVATION SNAP — the corners, ends and crossings of a drawn elevation or
// section, so a hand drawing over it catches them as it does on a plan.
//
// jb, 14 Nov 2026: "on the sections and elevations can we have 'node snap' on
// the corners intersections etc, and allow the AREA / SHAPE and dimension
// commands to work on those pages too so i can draw overtop to fix small
// problems quickly".
//
// AN ELEVATION HAS NO RECORDS TO SNAP TO. cut-view.js works the building out
// as it paints -- walls, floor bands, stairs, roof edges, the grade line --
// and keeps none of it. So the snap reads what was DRAWN: `recorder` wraps
// the canvas the painter is handed and keeps every straight piece of every
// path it strokes or fills, in screen pixels. The page turns them into the
// view's own feet with the frame the painter hands back, and `catchAt` finds
// the node, crossing or line nearest the hand.
//
// HATCH IS NOT DRAWING (jb's plan, 14 Nov: hatch lines don't snap, "the way
// CAD ignores hatch"). Every siding course, stone joint and shingle row
// cut-view lays is painted inside a clip -- the face it fills -- so nothing
// drawn while a clip smaller than the glass is in force is kept. The pinned
// frame's own clip -- the first one, before any line -- holds the whole
// drawing, and does not count.
//
// AND A CLIP THE PAINTER NAMES AS ITS VIEWPORT DOES NOT COUNT, WHEREVER IT
// COMES (`snapFrameClip`, set true before that one `clip()`). "The first
// one, before any line" was a guess at which clip is the viewport, and on a
// zoomed elevation it guessed wrong: the painter rules its level lines
// FIRST, then clips to the room inside the margins, and with the rails out
// that room is well under the glass. So the viewport read as a hatch clip
// and the whole house was dropped -- 5 pieces of 244 kept on one elevation,
// the five being the level lines -- and a hand drawing over a zoomed-in
// view caught nothing of the building. Found 20 Nov 2026 while testing the
// DETAIL SNAPSHOT camera. The painter knows which clip is its viewport, so
// it says.
//
// `snapRecordOff` is a switch the painter can throw round what it does not
// want caught: the drafter's own marks are snapped from their records
// (exact feet) rather than from their ink, and the mark being drawn must
// never catch itself.
if (!window.DraftElevSnap) {
(() => {
  // A clip covering at least this much of the glass is a frame, not a fill.
  const FRAME_CLIP_SHARE = 0.8;
  // Straight pieces shorter than this (px) are text strokes and tick marks.
  const MIN_SEG_PX = 1.5;
  // How far off straight a following piece may sit and still carry the run.
  const STRAIGHT_PX = 0.35;

  function recorder(ctx, w, h) {
    const segs = [];
    let path = [];          // pieces of the path being built, in glass px
    let sub = null;         // the subpath's first point
    let last = null;        // its pen
    let off = false;        // snapRecordOff
    let clipStack = [[]];   // per save level: clips that hide (hatch)
    let hatchDepth = 0;
    let clipsSeen = 0;
    let frameNext = false;  // snapFrameClip: the next clip is the viewport
    let matrix = null;      // current transform relative to the base
    const base = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
    const baseInv = base && typeof base.inverse === 'function' ? base.inverse() : null;
    const tf = () => {
      if (matrix) return matrix;
      if (!baseInv) { matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; return matrix; }
      matrix = baseInv.multiply(ctx.getTransform());
      return matrix;
    };
    const dirty = () => { matrix = null; };
    const map = (x, y) => {
      const m = tf();
      return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
    };
    // A RUN DRAWN IN STEPS IS ONE LINE. The painter traces some edges as a
    // chain of short pieces (a line split where something stands in front
    // of it, sampled along its length); each joint would be a false node
    // every half foot along it. A piece that carries straight on from the
    // last one, the same way, lengthens it instead.
    const keep = (a, b) => {
      if (!a || !b) return;
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) return;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const prev = path[path.length - 1];
      if (prev && prev[1] === a) {
        const px = prev[1].x - prev[0].x, py = prev[1].y - prev[0].y;
        const plen = Math.hypot(px, py);
        if (plen > 0 && len > 0) {
          const cross = Math.abs(px * (b.y - a.y) - py * (b.x - a.x)) / plen;
          const dot = px * (b.x - a.x) + py * (b.y - a.y);
          if (cross < STRAIGHT_PX && dot > 0) { prev[1] = b; return; }
        }
      }
      if (len < MIN_SEG_PX) return;
      path.push([a, b]);
    };
    const bboxShare = pieces => {
      if (!pieces.length) return 0;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pieces.forEach(([a, b]) => {
        x0 = Math.min(x0, a.x, b.x); x1 = Math.max(x1, a.x, b.x);
        y0 = Math.min(y0, a.y, b.y); y1 = Math.max(y1, a.y, b.y);
      });
      return ((x1 - x0) * (y1 - y0)) / Math.max(1, w * h);
    };
    const commit = () => {
      if (off || hatchDepth > 0 || !path.length) return;
      // THE GROUND'S OWN FILL (the whole glass) is not a drawing edge.
      if (bboxShare(path) >= FRAME_CLIP_SHARE) return;
      path.forEach(p => segs.push(p));
    };
    const handler = {
      get: (target, prop) => {
        if (prop === 'snapRecordOff') return off;
        if (prop === 'snapFrameClip') return frameNext;
        switch (prop) {
          case 'beginPath': return () => { path = []; sub = null; last = null; target.beginPath(); };
          case 'moveTo': return (x, y) => { sub = last = map(x, y); target.moveTo(x, y); };
          case 'lineTo': return (x, y) => {
            const p = map(x, y);
            if (last) keep(last, p); else sub = p;
            last = p;
            target.lineTo(x, y);
          };
          case 'closePath': return () => { if (last && sub) keep(last, sub); last = sub; target.closePath(); };
          case 'rect': return (x, y, rw, rh) => {
            const a = map(x, y), b = map(x + rw, y), c = map(x + rw, y + rh), d = map(x, y + rh);
            keep(a, b); keep(b, c); keep(c, d); keep(d, a);
            sub = last = a;
            target.rect(x, y, rw, rh);
          };
          // A curve breaks the straight run; its ends are not corners of the
          // building (bubbles, arrow heads) and are left out.
          case 'arc': case 'arcTo': case 'ellipse': case 'bezierCurveTo': case 'quadraticCurveTo':
            return (...args) => { last = null; sub = null; target[prop](...args); };
          case 'stroke': return (...args) => { if (!args.length) commit(); target.stroke(...args); };
          case 'fill': return (...args) => { if (!args.length || typeof args[0] === 'string') commit(); target.fill(...args); };
          case 'strokeRect': return (x, y, rw, rh) => {
            const was = path;
            path = [];
            const a = map(x, y), b = map(x + rw, y), c = map(x + rw, y + rh), d = map(x, y + rh);
            keep(a, b); keep(b, c); keep(c, d); keep(d, a);
            commit();
            path = was;
            target.strokeRect(x, y, rw, rh);
          };
          case 'clip': return (...args) => {
            // THE FIRST CLIP, before a line is drawn, is the pinned frame's
            // viewport (cut-view `pinClip`): the margins of the rails can
            // leave it well under the glass, and it holds the whole drawing.
            // OR THE ONE THE PAINTER NAMED (`snapFrameClip`), which is spent
            // by the naming: the clip after it is a face's again.
            const frameClip = frameNext || (!clipsSeen && !segs.length);
            frameNext = false;
            clipsSeen += 1;
            if (!frameClip && bboxShare(path) < FRAME_CLIP_SHARE) {
              clipStack[clipStack.length - 1].push(1);
              hatchDepth += 1;
            }
            target.clip(...args);
          };
          case 'save': return () => { clipStack.push([]); target.save(); };
          case 'restore': return () => {
            target.restore();
            dirty();
            if (clipStack.length > 1) hatchDepth -= clipStack.pop().length;
          };
          case 'setTransform': case 'resetTransform': case 'translate': case 'scale': case 'rotate': case 'transform':
            return (...args) => { target[prop](...args); dirty(); };
          default: {
            const value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
          }
        }
      },
      set: (target, prop, value) => {
        if (prop === 'snapRecordOff') { off = !!value; return true; }
        if (prop === 'snapFrameClip') { frameNext = !!value; return true; }
        target[prop] = value;
        return true;
      },
    };
    return {
      ctx: new Proxy(ctx, handler),
      // What was drawn, in glass px: [[{x,y},{x,y}], ...]
      segments: () => segs,
    };
  }

  // Glass px to the view's own feet, through the frame cut-view hands back
  // (`onFrame`): u along the view, e the elevation.
  const toFeet = (frame, p) => ({
    u: frame.uMin + (p.x - frame.x0) / frame.pxPerFt,
    e: frame.yTop - (p.y - frame.y0) / frame.pxPerFt,
  });
  function segmentsInFeet(frame, pxSegs) {
    if (!frame || !(frame.pxPerFt > 0)) return [];
    const out = [];
    const seen = new Set();
    pxSegs.forEach(([a, b]) => {
      const fa = toFeet(frame, a), fb = toFeet(frame, b);
      // One edge is often stroked twice (a face filled, then outlined).
      const k = [fa.u, fa.e, fb.u, fb.e].map(v => Math.round(v * 256)).join(',');
      const k2 = [fb.u, fb.e, fa.u, fa.e].map(v => Math.round(v * 256)).join(',');
      if (seen.has(k) || seen.has(k2)) return;
      seen.add(k);
      out.push({ a: fa, b: fb });
    });
    return out;
  }

  const footOn = (s, p) => {
    const du = s.b.u - s.a.u, de = s.b.e - s.a.e;
    const len2 = du * du + de * de;
    if (!(len2 > 1e-12)) return { u: s.a.u, e: s.a.e, t: 0 };
    const t = Math.max(0, Math.min(1, ((p.u - s.a.u) * du + (p.e - s.a.e) * de) / len2));
    return { u: s.a.u + du * t, e: s.a.e + de * t, t };
  };
  const crossing = (s1, s2) => {
    const r = { u: s1.b.u - s1.a.u, e: s1.b.e - s1.a.e };
    const q = { u: s2.b.u - s2.a.u, e: s2.b.e - s2.a.e };
    const den = r.u * q.e - r.e * q.u;
    if (Math.abs(den) < 1e-9) return null;
    const w = { u: s2.a.u - s1.a.u, e: s2.a.e - s1.a.e };
    const t = (w.u * q.e - w.e * q.u) / den;
    const v = (w.u * r.e - w.e * r.u) / den;
    const eps = 1e-6;
    if (t < -eps || t > 1 + eps || v < -eps || v > 1 + eps) return null;
    return { u: s1.a.u + r.u * t, e: s1.a.e + r.e * t };
  };
  const dist = (a, b) => Math.hypot(a.u - b.u, a.e - b.e);

  // THE CATCH NEAREST THE HAND, by the plan's order: a NODE (an end or a
  // corner) first, then a CROSSING of two pieces, then a point ON a piece.
  // `reach` is { node, corner, line } in feet; a negative reach is off.
  // `nodes` are extra points (the drafter's own marks' ends and corners).
  // Returns { kind: 'node'|'corner'|'line', at: { u, e } } or null.
  function catchAt(segs, nodes, p, reach) {
    if (!p) return null;
    const far = Math.max(reach.node || 0, reach.corner || 0, reach.line || 0);
    if (!(far > 0)) return null;
    const near = segs.filter(s => dist(footOn(s, p), p) <= far);
    let best = null;
    const offer = (kind, at, r) => {
      if (!(r > 0)) return;
      const d = dist(at, p);
      if (d > r) return;
      if (!best || d < best.d) best = { kind, at: { u: at.u, e: at.e }, d };
    };
    near.forEach(s => { offer('node', s.a, reach.node); offer('node', s.b, reach.node); });
    (nodes || []).forEach(n => offer('node', n, reach.node));
    if (best) return { kind: best.kind, at: best.at };
    for (let i = 0; i < near.length; i += 1) {
      for (let j = i + 1; j < near.length; j += 1) {
        const x = crossing(near[i], near[j]);
        if (x) offer('corner', x, reach.corner);
      }
    }
    if (best) return { kind: best.kind, at: best.at };
    near.forEach(s => offer('line', footOn(s, p), reach.line));
    return best ? { kind: best.kind, at: best.at } : null;
  }

  const api = Object.freeze({ recorder, segmentsInFeet, catchAt, toFeet });
  window.DraftElevSnap = api;
})();
}
