// THE DEFAULT KITCHENS -- Movie's corner L, picked and dropped whole into a
// corner two walls already make.
//
// Movie, 17 Oct, NORTH_POINT_S_SUITE.pdf: "can you make a WC and KITCHENS
// that are like on this plan ... call it ... KITCHEN L1". The studio suite's
// kitchen, 8'-6" x 8'-6": one leg along the balcony wall carries the counter
// with the double sink and the 24" dishwasher at its open end; the other
// leg, along the end wall, carries the 30" range near the corner and the
// 36" fridge at its open end. Measured off the sheet at 1/8" = 1'-0" printed
// twice up; the 8-6 x 8-6 is the room tag's own.
//
// NOT A ROOM. Unlike the washrooms (washroom-presets.js) a kitchen draws no
// wall of its own: it is six ordinary wall-hosted fixtures laid along two
// walls the drafter has already drawn, so every piece stays movable
// afterwards (the old page's L PRESET promised the same, and this is it on
// the live page). The press is NEAR THE INSIDE CORNER; this module finds the
// corner, decides which leg takes the sink, and measures every piece from
// the inside corner the two wall faces make -- not from either wall's line,
// which would push the first cabinet into the other wall's body.
//
//                 stove leg (open end -> corner)
//          fridge | counter | range | counter |
//          -------+--------------------------+  <- inside corner
//                                            | corner counter
//                                            | counter
//                                            | sink
//                                            | counter
//                                            | DW
//                                            |  sink leg (corner -> open end)
//
// WHICH LEG IS WHICH: unflipped, the sink leg is the one that is CLOCKWISE
// from the stove leg on the plan (x right, z down the screen), which is the
// suite as drawn -- corner at the top right, sink down the right wall, range
// along the top. F swaps them, the way it mirrors a washroom.
//
// PURE: walls and a point in, records out. The page files the records, draws
// the preview, and says what was refused.
if (!window.DraftKitchenPresets) {
(() => {
  const IN = 1 / 12;

  // Along each leg, feet from the inside corner. A run is `from`..`to`; a
  // piece is its `centre` and `width`. Depths are the catalogue's
  // (fixture-kinds.js), asked for at the press, so a kitchen piece here is
  // the same size as the same piece dropped by hand.
  const PRESETS = Object.freeze({
    L1: Object.freeze({
      id: 'L1', name: 'KITCHEN L1', label: "KITCHEN L1 8'-6\" x 8'-6\" corner L",
      legFt: 8.5,
      // The counter runs from the corner to the open end; the corner 24" is
      // the other leg's counter turning in, so the sink leg owns the corner.
      sink: [
        { kind: 'cabinet', from: 0, to: 8.5 },
        { kind: 'sink', centre: 53 * IN, width: 2.5 },
        { kind: 'dish', centre: 86.5 * IN, width: 2 },
      ],
      // Past the corner counter: a run with the range on it, then the fridge
      // bay at the open end. The range is the sheet's 24" apartment range,
      // 3'-5" from the corner to its centre (Movie, 17 Oct: "can you check
      // the predrawn kitchens KITCHEN L1 which should look like the Suite S"
      // -- measured again off the sheet at 300 dpi; it had been drawn 30").
      stove: [
        { kind: 'cabinet', from: 2, to: 5.5 },
        { kind: 'stove', centre: 41 * IN, width: 2 },
        { kind: 'fridge', centre: 84 * IN, width: 3 },
      ],
    }),
  });

  const sub = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });
  const dot = (a, b) => a.x * b.x + a.z * b.z;

  // ── THE CORNER UNDER THE PRESS ─────────────────────────────────────────
  //
  // Two walls that cross within their own lengths, square to each other,
  // their crossing within `reachFt` of the press, nearest crossing wins. For
  // each: the face that looks at the press, the inside corner where the two
  // faces meet measured along the wall's axis, which way the leg runs from
  // it (towards the press's shadow on the wall) and how much wall is clear
  // that way. `wallFrame` and `wallCross` are fixture-geometry.js's, handed
  // in so this module knows no wall types.
  const REACH_FT = 4;
  function findCorner(walls, pt, { wallFrame, wallCross }, reachFt = REACH_FT) {
    const framed = (walls || []).map(wall => ({ wall, frame: wall?.start && wall?.end ? wallFrame(wall) : null }))
      .filter(w => w.frame);
    let best = null;
    for (let i = 0; i < framed.length; i += 1) {
      for (let j = i + 1; j < framed.length; j += 1) {
        const A = framed[i], B = framed[j];
        if (Math.abs(dot({ x: A.frame.ux, z: A.frame.uz }, { x: B.frame.ux, z: B.frame.uz })) > 0.05) continue;
        const x = wallCross(A.wall, A.frame, B.wall);
        if (!x || x.s < -0.02 || x.s > 1.02 || x.along < -0.02 * A.frame.len || x.along > 1.02 * A.frame.len) continue;
        const at = A.frame.at(x.along, 0);
        const d = Math.hypot(pt.x - at.x, pt.z - at.z);
        if (d > reachFt || (best && d >= best.d)) continue;
        best = { d, A, B, alongA: x.along, alongB: x.s * B.frame.len };
      }
    }
    if (!best) return null;
    const leg = (W, cornerAlong, other) => {
      const f = W.frame;
      const rel = sub(pt, W.wall.start);
      const across = rel.x * f.nx + rel.z * f.nz;
      const side = across >= (f.startOff + f.endOff) / 2 ? 1 : -1;
      const t = dot(rel, { x: f.ux, z: f.uz });
      const dir = t >= cornerAlong ? 1 : -1;
      // The other wall's face that looks at the press, pushed along this
      // wall: the inside corner is that far past the lines' crossing.
      const of = other.frame;
      const oRel = sub(pt, other.wall.start);
      const oAcross = oRel.x * of.nx + oRel.z * of.nz;
      const oSide = oAcross >= (of.startOff + of.endOff) / 2 ? 1 : -1;
      const faceOff = oSide === 1 ? of.endOff : of.startOff;
      // The other wall's normal, resolved along this wall's axis.
      const push = faceOff * (of.nx * f.ux + of.nz * f.uz);
      const inside = cornerAlong + push;
      return {
        wall: W.wall, frame: f, side, dir, cornerAlong: inside,
        clearFt: dir > 0 ? f.len - inside : inside,
      };
    };
    const legA = leg(best.A, best.alongA, best.B);
    const legB = leg(best.B, best.alongB, best.A);
    return { legs: [legA, legB], at: best.A.frame.at(best.alongA, 0) };
  }

  // ── THE KITCHEN ON ITS TWO LEGS ────────────────────────────────────────
  //
  // Which leg takes the sink: unflipped, the pair is ordered so the sink
  // leg's direction turned a quarter clockwise is the stove leg's (cross
  // product positive on x-right z-down), the suite as drawn. `depthOf(kind)`
  // is the catalogue's depth. Returns the records, or `{ refused }` saying
  // which leg is short.
  function place(id, corner, { flip = false, depthOf } = {}) {
    const p = PRESETS[id];
    if (!p || !corner || corner.legs?.length !== 2) return null;
    const [A, B] = corner.legs;
    const dirOf = leg => ({ x: leg.frame.ux * leg.dir, z: leg.frame.uz * leg.dir });
    const dA = dirOf(A), dB = dirOf(B);
    const cross = dA.x * dB.z - dA.z * dB.x;
    let [sinkLeg, stoveLeg] = cross < 0 ? [B, A] : [A, B];
    if (flip) [sinkLeg, stoveLeg] = [stoveLeg, sinkLeg];
    const short = [['sink', sinkLeg], ['stove', stoveLeg]].find(([, leg]) => leg.clearFt < p.legFt - 0.01);
    if (short) {
      return { refused: `${p.name} needs ${fmtFt(p.legFt)} clear along both walls from the corner — `
        + `the ${short[0]} leg has ${fmtFt(short[1].clearFt)}.` };
    }
    const depth = kind => (depthOf ? depthOf(kind) : 2);
    const lay = (leg, pieces, legName) => pieces.map(piece => {
      const runs = piece.kind === 'cabinet';
      const centre = runs ? (piece.from + piece.to) / 2 : piece.centre;
      return {
        kind: piece.kind, leg: legName, wall: leg.wall,
        offset: leg.cornerAlong + leg.dir * centre,
        width: runs ? piece.to - piece.from : piece.width,
        depth: depth(piece.kind),
        side: leg.side,
      };
    });
    return {
      id, name: p.name,
      sinkLeg, stoveLeg,
      fixtures: lay(sinkLeg, p.sink, 'sink').concat(lay(stoveLeg, p.stove, 'stove')),
    };
  }

  const fmtFt = ft => {
    const inches = Math.round(ft * 12);
    const f = Math.floor(inches / 12), i = inches - f * 12;
    return i ? `${f}'-${i}"` : `${f}'`;
  };

  // ── ITS OWN TWO WALLS, WHERE THERE IS NO CORNER ─────────────────────────
  //
  // Movie, 17 Oct: "maybe kitchen not ready still, not working yet like the
  // WCs which work good". Dropped in open floor the kitchen brings the corner
  // it needs: two 2x4 walls meeting at a mitred corner, their inside faces
  // meeting at `at`, each a leg long. Unturned they are the suite as drawn --
  // the corner at the top right, one wall running west along the top, the
  // other south down the right -- and `angleDeg` turns them about `at`.
  // `inside` is a point in the L, for findCorner to read the faces from.
  const STUD_4 = 3.5 * IN;
  function ownWalls(id, at, angleDeg = 0) {
    const p = PRESETS[id];
    if (!p || !at) return null;
    const h = STUD_4 / 2, len = p.legFt;
    const t = (angleDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    const P = (x, z) => ({ x: at.x + c * x - s * z, y: 0, z: at.z + s * x + c * z });
    const corner = P(h, -h);
    return {
      walls: [
        { key: 'top', start: corner, end: P(-len, -h), wallType: 'stud_2x4', refLine: 'center' },
        { key: 'side', start: corner, end: P(h, len), wallType: 'stud_2x4', refLine: 'center' },
      ],
      inside: P(-1, 1),
    };
  }

  window.DraftKitchenPresets = Object.freeze({
    PRESETS,
    IDS: Object.freeze(Object.keys(PRESETS)),
    REACH_FT,
    findCorner,
    place,
    ownWalls,
  });
})();
}
