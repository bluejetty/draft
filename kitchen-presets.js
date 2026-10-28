// THE DEFAULT KITCHENS -- Movie's corner L and the North Point suites' L, U
// and island kitchens, picked and dropped whole into a corner two walls
// already make.
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
// WHICH LEG IS WHICH: unflipped, the FIRST leg (L1's sink leg) is the one
// whose direction turned a quarter clockwise on the plan (x right, z down the
// screen) is the SECOND's -- the suite as drawn: corner at the top right,
// sink down the right wall, range along the top. F swaps them, the way it
// mirrors a washroom.
//
// THE SUITES' KITCHENS (Movie, 17-18 Oct: "KITCHEN U1" off the 1B, "KITCHEN
// L2" off the 1BD, "KITCHEN L3" off the 2BD -- "its very similar to the last
// one we may need to combine these later but keep seperate for now"): the
// same two legs, and an ISLAND or PENINSULA that is no wall's. It rides a
// leg's wall all the same, floated off it by a `standoff` -- the island
// fixture's own convention -- with its sink and dishwasher at the same
// standoff, so the whole kitchen moves, turns and mirrors with its walls.
// Each leg needs as much wall as its furthest piece reaches.
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
      // The counter runs from the corner to the open end; the corner 24" is
      // the other leg's counter turning in, so the sink leg owns the corner.
      first: [
        { kind: 'cabinet', from: 0, to: 8.5 },
        { kind: 'sink', centre: 53 * IN, width: 2.5 },
        { kind: 'dish', centre: 86.5 * IN, width: 2 },
      ],
      // Past the corner counter: a run with the range on it, then the fridge
      // bay at the open end. The range is the sheet's 24" apartment range,
      // 3'-5" from the corner to its centre (Movie, 17 Oct: "can you check
      // the predrawn kitchens KITCHEN L1 which should look like the Suite S"
      // -- measured again off the sheet at 300 dpi; it had been drawn 30").
      second: [
        { kind: 'cabinet', from: 2, to: 5.5 },
        { kind: 'stove', centre: 41 * IN, width: 2 },
        { kind: 'fridge', centre: 84 * IN, width: 3 },
      ],
    }),
    // THE 1BD SUITE'S "KITCHEN 18X9": the counter along the demising wall
    // with the fridge and a cabinet past it, the long leg down the den wall
    // with the range, and a 7' x 3' island 5' clear of both counters, the
    // double sink and the dishwasher on it and the bar on its far side.
    L2: Object.freeze({
      id: 'L2', name: 'KITCHEN L2', label: "KITCHEN L2 8'-9\" x 13'-4\" L + island",
      first: [
        { kind: 'cabinet', from: 0, to: 47 * IN },
        { kind: 'fridge', centre: 64.5 * IN, width: 3 },
        { kind: 'cabinet', from: 82.5 * IN, to: 105 * IN },
      ],
      second: [
        { kind: 'cabinet', from: 0, to: 160 * IN },
        { kind: 'stove', centre: 106 * IN, width: 2 },
        { kind: 'island', centre: 132 * IN, width: 7, depth: 3, standoff: 81 * IN },
        { kind: 'sink', centre: 119 * IN, width: 2.5, standoff: 81 * IN },
        { kind: 'dish', centre: 161 * IN, width: 2, standoff: 81 * IN },
      ],
    }),
    // THE 2BD SUITE'S "KITCHEN 9X14": the fridge at the open end of the
    // exterior wall's leg, the long counter along the far wall to the pantry
    // with the range on it, and the 7' x 3' island 5' off that counter.
    L3: Object.freeze({
      id: 'L3', name: 'KITCHEN L3', label: "KITCHEN L3 8'-3\" x 13'-4\" L + island",
      first: [
        { kind: 'cabinet', from: 0, to: 63 * IN },
        { kind: 'fridge', centre: 81 * IN, width: 3 },
      ],
      second: [
        { kind: 'cabinet', from: 0, to: 160 * IN },
        { kind: 'stove', centre: 106.5 * IN, width: 2 },
        { kind: 'island', centre: 133.5 * IN, width: 7, depth: 3, standoff: 84 * IN },
        { kind: 'sink', centre: 124.5 * IN, width: 2.5, standoff: 84 * IN },
        { kind: 'dish', centre: 163.5 * IN, width: 2, standoff: 84 * IN },
      ],
    }),
    // THE 1B SUITE'S U, "KITCHEN/DINING 15X9-8": the counter along the top
    // wall to the fridge, the 9'-8" leg down the exterior wall with the
    // range, and the PENINSULA closing the U off the exterior wall -- 8'
    // long, the dishwasher and the double sink on it and the bar outside.
    // It rides the top wall at its standoff; the exterior leg's counter
    // stops where the peninsula's turns in.
    U1: Object.freeze({
      id: 'U1', name: 'KITCHEN U1', label: "KITCHEN U1 8'-7\" x 9'-8\" U with peninsula",
      first: [
        { kind: 'cabinet', from: 0, to: 66.5 * IN },
        { kind: 'fridge', centre: 84.5 * IN, width: 3 },
        { kind: 'island', centre: 48 * IN, width: 8, depth: 3, standoff: 92.5 * IN },
        { kind: 'dish', centre: 36 * IN, width: 2, standoff: 92.5 * IN },
        { kind: 'sink', centre: 80 * IN, width: 2.5, standoff: 92.5 * IN },
      ],
      second: [
        { kind: 'cabinet', from: 0, to: 92.5 * IN },
        { kind: 'stove', centre: 51 * IN, width: 2 },
      ],
      // The exterior wall runs on past the peninsula: the bay is 9'-8".
      secondFt: 116 * IN,
    }),
  });

  // HOW MUCH WALL A LEG NEEDS: as far as its furthest piece reaches, or the
  // bay the sheet gives, whichever is more.
  const reach = piece => (piece.kind === 'cabinet' ? piece.to : piece.centre + piece.width / 2);
  const needFt = (p, leg) => Math.max(p[`${leg}Ft`] || 0, ...p[leg].map(reach));
  // A leg's name in a sentence: its first piece that is not a cabinet run.
  const legName = (p, leg) => `${(p[leg].find(piece => piece.kind !== 'cabinet') || { kind: leg }).kind} leg`;

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
    let [firstLeg, secondLeg] = cross < 0 ? [B, A] : [A, B];
    if (flip) [firstLeg, secondLeg] = [secondLeg, firstLeg];
    const short = [['first', firstLeg], ['second', secondLeg]].find(([name, leg]) => leg.clearFt < needFt(p, name) - 0.01);
    if (short) {
      // Each leg by the piece that names it -- L1's sink leg and stove leg.
      const [a, b] = [needFt(p, 'first'), needFt(p, 'second')];
      const needs = Math.abs(a - b) < 0.01 ? `${fmtFt(a)} clear along both walls`
        : `${fmtFt(a)} along the ${legName(p, 'first')} and ${fmtFt(b)} along the ${legName(p, 'second')}`;
      return { refused: `${p.name} needs ${needs} from the corner — `
        + `the ${legName(p, short[0])} has ${fmtFt(short[1].clearFt)}.` };
    }
    const depth = kind => (depthOf ? depthOf(kind) : 2);
    const lay = (leg, pieces, legName) => pieces.map(piece => {
      const runs = piece.kind === 'cabinet';
      const centre = runs ? (piece.from + piece.to) / 2 : piece.centre;
      return {
        kind: piece.kind, leg: legName, wall: leg.wall,
        offset: leg.cornerAlong + leg.dir * centre,
        width: runs ? piece.to - piece.from : piece.width,
        depth: piece.depth || depth(piece.kind),
        side: leg.side,
        ...(piece.standoff ? { standoff: piece.standoff } : {}),
      };
    });
    return {
      id, name: p.name,
      firstLeg, secondLeg,
      fixtures: lay(firstLeg, p.first, 'first').concat(lay(secondLeg, p.second, 'second')),
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
  // The side wall carries the first leg and the top wall the second, each
  // as long as its leg needs -- swapped when F swaps the legs, or a mirrored
  // U1 would put its 9'-8" leg on the 8'-7" wall and be refused.
  //
  // DRAWN ON THEIR INSIDE FACES (Movie, 28 Oct: "change the 3.5" wall so the
  // line is on the interior (behind the cabinets etc) and the intersection at
  // the corner of the kitchen would be the 'mini' registration point so a
  // user can position the placement in the larger model precisely"). Each
  // wall's line is the face the cabinets stand against, both lines start at
  // `at` -- the inside corner, the kitchen's registration point -- and the
  // studs stand outward of them: the top wall's to its left, the side
  // wall's to its right, read along start -> end.
  const STUD_4 = 3.5 * IN;
  function ownWalls(id, at, angleDeg = 0, flip = false) {
    const p = PRESETS[id];
    if (!p || !at) return null;
    const t = (angleDeg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    const P = (x, z) => ({ x: at.x + c * x - s * z, y: 0, z: at.z + s * x + c * z });
    const corner = P(0, 0);
    return {
      walls: [
        { key: 'top', start: corner, end: P(-needFt(p, flip ? 'first' : 'second'), 0), wallType: 'stud_2x4', refLine: 'left' },
        { key: 'side', start: corner, end: P(0, needFt(p, flip ? 'second' : 'first')), wallType: 'stud_2x4', refLine: 'right' },
      ],
      inside: P(-1, 1),
      registration: { x: corner.x, z: corner.z },
    };
  }

  window.DraftKitchenPresets = Object.freeze({
    PRESETS,
    IDS: Object.freeze(Object.keys(PRESETS)),
    REACH_FT,
    needFt: (id, leg) => (PRESETS[id] ? needFt(PRESETS[id], leg) : null),
    findCorner,
    place,
    ownWalls,
  });
})();
}
