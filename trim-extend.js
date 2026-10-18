// TRIM AND EXTEND, THE AUTOCAD WAY: where the cutting edges cross a wall,
// which piece a press takes away, and where an end runs on to.
//
// Movie, 17 Oct: "id like to be able to select both items and them select the
// TRIM ... and then select the part i want to cut (i'd select the int wall on
// the side i want to cut off) or if i had selected 2 lines it would use all
// surfaces for cutting except the one i select the part i select gets the cut
// ... is gone" -- "cuts on either side if there is another selected line
// crossing over". And EXTEND: "extend the end to another selected line" --
// "if the int wall is 2 ft from the ext wall i select both that int wall an
// that ext wall and then click the int wall at the end closest to the ext
// wall and it will extend to attach to the wall".
//
// PURE. Segments in, numbers out: every answer is a parameter `t` along the
// pressed segment's own stored line, 0 at its start and 1 at its end. The
// page owns the records, the pool, the openings and the undo.
//
// A CUTTER IS ITS BODY, NOT ITS LINE. A wall's stored line is one of its
// faces or its centre (refLine), and an exterior wall's is its OUTSIDE face:
// cutting to the line ran a partition straight through the wall it was
// trimmed against (Movie, 17 Oct, "i'd like to TRIM the interior wall on the
// EXT wall but doesn't seem to be working"). So a wall cutter crosses the
// pressed segment as a SPAN -- from where its one face crosses to where its
// other does -- and a cut stops at the face on the side that is KEPT: the
// piece taken away takes the run through the cutter's body with it, so no
// wall is ever left standing inside another. His partition, run out through
// the exterior wall, pressed outside, stops at the wall's inside face. A
// line cutter has no thickness: its span is one point.
(function () {
  const EPS = 1e-6;
  const cross = (a, b) => a.x * b.z - a.z * b.x;

  // Where the faces sit across a wall's stored line, along its normal
  // (-dz, dx)/len -- the convention render-2d draws by and geometry-2d's
  // wallFaceOffsets resolves. A line, or a wall of no thickness, is one face.
  const faceOffsets = (cutter, thicknessFt) => {
    const t = Math.max(0, Number(thicknessFt) || 0);
    const ref = cutter.refLine || 'center';
    const lo = ref === 'left' ? 0 : ref === 'right' ? -t : -t / 2;
    return [lo, lo + t];
  };

  // EVERY CUTTER'S SPAN ALONG THE PRESSED SEGMENT'S LINE, the line taken
  // without end -- extend needs the crossings past the ends too. A cutter
  // counts only where the pressed line meets it within its own length,
  // allowed `reachFt` past each of its ends so a corner (the line passing
  // through the cutter's end point) still counts. Parallel cutters never
  // cross and are left out.
  const spans = (seg, cutters, { thicknessFt = () => 0, reachFt = 0 } = {}) => {
    const A = seg.start, r = { x: seg.end.x - seg.start.x, z: seg.end.z - seg.start.z };
    const lenR = Math.hypot(r.x, r.z);
    if (lenR < EPS) return [];
    const out = [];
    (cutters || []).forEach(cutter => {
      if (!cutter || !cutter.start || !cutter.end || cutter === seg) return;
      const P = cutter.start, q = { x: cutter.end.x - P.x, z: cutter.end.z - P.z };
      const lenQ = Math.hypot(q.x, q.z);
      if (lenQ < EPS) return;
      const den = cross(r, q);
      if (Math.abs(den) < EPS * lenR * lenQ) return;
      const n = { x: -q.z / lenQ, z: q.x / lenQ };
      const at = o => {
        const w = { x: P.x + n.x * o - A.x, z: P.z + n.z * o - A.z };
        return { t: cross(w, q) / den, s: cross(w, r) / den };
      };
      const [o1, o2] = faceOffsets(cutter, thicknessFt(cutter));
      const mid = at((o1 + o2) / 2);
      const tol = reachFt / lenQ;
      if (mid.s < -tol - EPS || mid.s > 1 + tol + EPS) return;
      const a = at(o1).t, b = at(o2).t;
      out.push({ lo: Math.min(a, b), hi: Math.max(a, b), cutter });
    });
    return out.sort((p, q) => p.lo - q.lo);
  };

  // THE PIECE A TRIM PRESS TAKES AWAY. Only crossings INSIDE the segment cut
  // it: a cutter the segment merely ends against (a tee it already makes) is
  // not a crossing of it, and taking the piece up to that tee is taking it to
  // its end. The piece runs from the nearest crossing behind the press to the
  // nearest ahead, each taken to its face on the KEPT side, or to the
  // segment's own end where there is none -- and a press with no crossing on either side
  // has nothing to cut. A press inside a cutter's span is on the cutter, not
  // on a piece, and is refused the same way.
  const trimPiece = (allSpans, tPress) => {
    const inside = (allSpans || []).filter(sp => sp.lo > EPS && sp.hi < 1 - EPS);
    if (inside.some(sp => sp.lo < tPress && tPress < sp.hi)) return null;
    let behind = null, ahead = null;
    inside.forEach(sp => {
      if (sp.hi <= tPress && (!behind || sp.hi > behind.hi)) behind = sp;
      if (sp.lo >= tPress && (!ahead || sp.lo < ahead.lo)) ahead = sp;
    });
    if (!behind && !ahead) return null;
    const from = behind ? behind.lo : 0, to = ahead ? ahead.hi : 1;
    const kind = !behind ? 'start' : !ahead ? 'end' : 'middle';
    return { from, to, kind, behind: behind && behind.cutter, ahead: ahead && ahead.cutter };
  };

  // WHERE AN EXTENDED END STOPS: the near face of the nearest cutter wholly
  // past that end. A cutter the end already reaches into is not "past" it,
  // and an end with nothing ahead does not move.
  const extendTo = (allSpans, end) => {
    let best = null;
    (allSpans || []).forEach(sp => {
      if (end === 'end' && sp.lo > 1 + EPS && (!best || sp.lo < best.t)) best = { t: sp.lo, cutter: sp.cutter };
      if (end === 'start' && sp.hi < -EPS && (!best || sp.hi > best.t)) best = { t: sp.hi, cutter: sp.cutter };
    });
    return best;
  };

  const api = Object.freeze({ faceOffsets, spans, trimPiece, extendTo });
  if (typeof window !== 'undefined') window.DraftTrimExtend = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
