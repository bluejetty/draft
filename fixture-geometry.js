// FIXTURE GEOMETRY — where a fixture's rectangle actually lands on a wall.
//
// Pulled out of MODEL.dc.html so both boards can draw a fixture from ONE copy
// of the maths. render-2d.js's drawFixture2D asks its caller for `wallFrame`,
// `wallCross` and `fixtureGeometry`; before this file the only place those
// existed was the Model Space component, so the MODEL.html board could not
// paint a sink without duplicating them. Duplicated geometry is geometry that
// drifts, and a fixture drawn two ways is worse than a fixture drawn once.
//
// Everything here is pure. It works on plain { x, y, z } points and a walls
// ARRAY passed in by the caller — no component state, no THREE, no canvas.
// The one dependency is wall-types.js, for the assembly width that decides
// which face of a wall the fixture backs onto.
//
// The four functions, and why they come as a set:
//
//   wallFrame(wall)                  the wall's own axes: unit vector along it,
//                                    unit normal across it, and where its two
//                                    faces sit relative to the drawn line.
//   wallCross(wall, frame, other)    feet along this wall where another wall's
//                                    centreline crosses it.
//   fixtureGeometry(walls, fixture)  the fixture's four corners and centre.
//   tubGeometry(walls, fixture, ...) the same, for a tub in an alcove, which
//                                    stretches to fit and grows decks either
//                                    side of what it cannot fill.
//
// fixtureGeometry hands the tub case to tubGeometry, tubGeometry needs
// wallCross and wallFrame to find the alcove's far end, and both frames come
// from wallFrame. Splitting any one of them out again would only move the
// dependency, not remove it.
if (!window.DraftFixtureGeometry) {
(() => {
  // The tub's own spec, and it lives here rather than at the call sites: a tub
  // is the one fixture whose drawn length is not the length it was placed at.
  // THE TUB IS ITS OWN SIZE (Movie, 24 Oct: "the tub should only be 42 x 72
  // (not 73), but should have the extra 1/2" on each side (so will need 73
  // space but tub is 72"): it no longer grows to fill an alcove. It grew up
  // to 6", and a 72" tub in a 73 3/4" alcove read 42X73.
  const TUB_STRETCH_MAX_FT = 0;
  // SLACK UNDER AN INCH IS GAP, NOT DECK: an alcove a hair longer than the
  // tub and its two half inches draws no sliver of a deck strip.
  const TUB_DECK_MIN_FT = 1 / 12;
  const TUB_MIN_LENGTH_FT = 4;       // an alcove shorter than this can't take the tub
  // Not read in this file: drawFixture2D takes it through env, and the kitchen
  // island reads it to stand its cabinet off the counter. It lives here because
  // it is the fixture's spec and both boards need the same number -- a counter
  // that overhangs by a different amount on each page is the drift this module
  // was extracted to stop.
  // HALF AN INCH (Movie, 24 Oct: "should only be 1/2" over the edge of
  // cabinet").
  const COUNTER_OVERHANG_FT = 0.5 / 12; // countertop edge past the cabinet face

  // HALF AN INCH OFF THE WALLS IT STANDS AGAINST (Movie, 23 Oct: "for the
  // BATHRUB / SHOWER / and SINK / KITCHEN CABINETS.. can you add 1/2" to the
  // sides of the item (for example a 60X30 bathtub show it 60x30 but add 1/2"
  // on back and sides (not on front)" -- "the corner at the extra 1/2" point
  // will be the important point i need to attached to the corner of wall";
  // "anything that is 'against' a wall"; "not the toilet"; "only when
  // against a wall"; "update all the stuff"). The piece keeps its size; it
  // stands WALL_GAP_FT off the wall it backs onto, and an end of it (or of
  // the run it is in) that meets a crossing wall stands the same off that
  // wall (settleWallGaps). A toilet, an island (its aisle is its standoff)
  // and a closet (its own walls) take none.
  const WALL_GAP_FT = 0.5 / 12;
  const NO_WALL_GAP = new Set(['toilet', 'island', 'closet', 'fireplace']);
  const wallGapOf = fixture => (!fixture || NO_WALL_GAP.has(fixture.kind) || (Number(fixture.standoff) || 0) > 0
    ? 0 : WALL_GAP_FT);
  // ROOM BEHIND THE LAUNDRY (Movie, 25 Oct: "the LAUDRY Washer and Dryer,
  // they need about 6-8" space behind for the venting and plugs and stuff
  // . can we add a 7" space behind them where they attach to the wall"): a
  // washer or a dryer stands 7" off the wall it backs onto; its ends keep
  // the half inch (wallGapOf).
  const BACK_GAP_FT = { washer: 7 / 12, dryer: 7 / 12 };
  const backGapOf = fixture => (wallGapOf(fixture) ? (BACK_GAP_FT[fixture.kind] ?? WALL_GAP_FT) : 0);

  // ── ATTACHED BY ITS SIDE (jb, 27 Nov 2026) ─────────────────────────────
  //
  // "when it attached to the wall can we have a popup that says ATTACH TO
  // BACK / LEFT / RIGHT". `attach` is 'left' or 'right' -- the piece's own
  // side, standing at its front -- and missing for the back, which is every
  // piece until a drafter says otherwise. A piece on its side stands its
  // DEPTH along the wall and its WIDTH off it, its doors facing along the
  // wall. Not a tub, an island, a closet, a corner or a toilet: each of
  // those has its own way of meeting a wall. Nor a fireplace: its opening
  // faces the room, and on its side it would face along the wall.
  const NO_SIDE_ATTACH = new Set(['tub', 'island', 'closet', 'cornerbase', 'toilet', 'fireplace']);
  const canAttachSide = fixture => !!fixture && !NO_SIDE_ATTACH.has(fixture.kind)
    && !(Number(fixture.standoff) > 0) && fixture.endWallId == null;
  const attachOf = fixture => (canAttachSide(fixture) && (fixture.attach === 'left' || fixture.attach === 'right')
    ? fixture.attach : 'back');
  // WHAT IT TAKES UP ALONG ITS WALL: its width on its back, its depth on a side.
  const alongWidth = fixture => (attachOf(fixture) === 'back' ? Number(fixture.width) : Number(fixture.depth)) || 0;

  const wallTypes = () => {
    const WT = window.DraftWallTypes;
    if (!WT) throw new Error('fixture-geometry.js: wall-types.js did not load, so a wall has no assembly width');
    return WT.WALL_TYPES;
  };

  // The wall's local axes plus its two faces. startOff/endOff are the faces'
  // offsets across the wall from the line the drafter drew, which is why a
  // refLine of 'left' puts the drawn line ON the outside face rather than
  // through the middle. `at(along, across)` converts back to world.
  const wallFrame = wall => {
    const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return null;
    const ux = dx / len, uz = dz / len;
    const nx = -uz, nz = ux;
    const TYPES = wallTypes();
    const custom = window.DraftWallTypes.isCustomWall(wall) ? window.DraftWallTypes.wallTypeOf(wall) : null;
    const def = custom || TYPES.find(w => w.id === (wall.wallType || 'stud_2x6')) || TYPES[1];
    const totalFt = def.totalIn / 12;
    const refLine = wall.refLine || 'center';
    const startOff = (refLine === 'left' ? 0 : refLine === 'right' ? -totalFt : -totalFt / 2)
      + window.DraftWallTypes.wallLineShiftFt(wall);
    return {
      ux, uz, nx, nz, len, totalFt, startOff, endOff: startOff + totalFt,
      at: (along, across) => ({
        x: wall.start.x + ux * along + nx * across,
        y: wall.start.y || 0,
        z: wall.start.z + uz * along + nz * across,
      }),
    };
  };

  // Where another wall's centreline crosses this wall's axis: feet along the
  // host wall, plus the crossing parameter on the other wall (0..1 inside it).
  // Null when the walls are parallel.
  const wallCross = (wall, frame, other) => {
    const vx = other.end.x - other.start.x, vz = other.end.z - other.start.z;
    const denom = frame.ux * vz - frame.uz * vx;
    if (Math.abs(denom) < 1e-6) return null;
    const rx = other.start.x - wall.start.x, rz = other.start.z - wall.start.z;
    return {
      along: (rx * vz - rz * vx) / denom,
      s: (frame.uz * rx - frame.ux * rz) / denom,
    };
  };

  // WHERE A CROSSING WALL'S TWO FACES MEET THIS WALL'S LINE, along it. Its
  // faces sit at startOff / endOff across ITS drawn line, which is a face
  // for an exterior wall (refLine 'left'), not its middle -- so half its
  // thickness either side of the crossing put a tub 2 3/4" into a 2x6 it
  // ran into (WC BF2 dropped against the house). An offset across the other
  // wall moves its crossing along this one by offset / (its normal . this
  // direction).
  const facesAlong = (frame, other, along) => {
    const of = wallFrame(other);
    const k = of ? of.nx * frame.ux + of.nz * frame.uz : 0;
    if (Math.abs(k) < 1e-6) return [along, along];
    return [along + of.startOff / k, along + of.endOff / k];
  };

  const tubGeometry = (walls, fixture, wall, frame) => {
    const endWall = walls.find(w => w.id === fixture.endWallId);
    if (!endWall) return null;
    const cross = wallCross(wall, frame, endWall);
    if (!cross || cross.s < -0.2 || cross.s > 1.2) return null;
    const dir = fixture.dir === -1 ? -1 : 1;
    // The end wall's face on the tub's side, and each crossing wall's face
    // that looks back at the tub.
    const endFaces = facesAlong(frame, endWall, cross.along);
    // HALF AN INCH OFF EACH END WALL, and off the back (wallGapOf).
    const gap = wallGapOf(fixture);
    const bare = dir > 0 ? Math.max(...endFaces) : Math.min(...endFaces);
    // The alcove's far bound: the nearest crossing wall past the faucet wall,
    // or the end of the back wall itself.
    let farFace = dir > 0 ? frame.len : 0;
    walls.forEach(other => {
      if (other === wall || other === endWall) return;
      if (other.levelId !== wall.levelId || (other.view || 'plan') !== (wall.view || 'plan')) return;
      const hit = wallCross(wall, frame, other);
      if (!hit || hit.s < -0.05 || hit.s > 1.05) return;
      const otherFaces = facesAlong(frame, other, hit.along);
      const otherFace = dir > 0 ? Math.min(...otherFaces) : Math.max(...otherFaces);
      if (dir * (otherFace - bare) > 0.5 && dir * (otherFace - bare) < dir * (farFace - bare)) farFace = otherFace;
    });
    // The alcove found between the bare faces; the tub then keeps its half
    // inch off each -- or what the alcove can spare past the tub's own
    // length, shared: a 72" tub in a 72" alcove (BF2) stays 72".
    const ends = Math.max(0, Math.min(gap, (dir * (farFace - bare) - fixture.width) / 2));
    const face = bare + dir * ends;
    farFace -= dir * ends;
    const alcove = dir * (farFace - face);
    if (alcove < TUB_MIN_LENGTH_FT) return null;
    const tubLen = Math.min(alcove, fixture.width + TUB_STRETCH_MAX_FT);
    const room = Math.max(alcove - tubLen, 0);
    const slide = Math.min(Math.max(fixture.offset, 0), room);
    const near = face + dir * slide;
    const far = near + dir * tubLen;
    const faceOff = fixture.side === -1 ? frame.startOff : frame.endOff;
    const backOff = faceOff + fixture.side * gap;
    const frontOff = backOff + fixture.side * fixture.depth;
    const rect = (a0, a1) => [
      frame.at(a0, backOff), frame.at(a1, backOff), frame.at(a1, frontOff), frame.at(a0, frontOff),
    ];
    const decks = [];
    if (slide > TUB_DECK_MIN_FT) decks.push(rect(Math.min(face, near), Math.max(face, near)));
    if (room - slide > TUB_DECK_MIN_FT) decks.push(rect(Math.min(far, farFace), Math.max(far, farFace)));
    return {
      wall, frame, tub: true, dir, face, farFace, alcove, tubLen, gap: room, wallGap: gap, faceOff, slide,
      faucetAlong: near,
      along: (near + far) / 2,
      alongStart: Math.min(face, farFace), alongEnd: Math.max(face, farFace),
      tubAlongStart: Math.min(near, far), tubAlongEnd: Math.max(near, far),
      backOff, frontOff, width: tubLen, side: fixture.side,
      corners: rect(Math.min(near, far), Math.max(near, far)),
      decks,
      center: frame.at((near + far) / 2, (backOff + frontOff) / 2),
    };
  };

  // A PIECE ON ITS SIDE: the box on the plan, by the wall's own axes (its
  // depth along, its width off, the half inch between its side and the wall
  // face), so every slide, pick and gap reads it as any other piece; and
  // `piece`, the same box by the piece's OWN axes -- along its width, back to
  // front -- which is what the painter draws its symbol by, so a sink's bowls
  // face its front and not the wall. The drafter's left, standing at the
  // front in plan (x right, z down the sheet), is (-F.z, F.x) for a front F:
  // the side named goes to the wall.
  const sideGeometry = (fixture, wall, frame, attach) => {
    const side = fixture.side === -1 ? -1 : 1;
    const width = Math.max(Number(fixture.width) || 0, 0.5);
    const depth = Math.max(Number(fixture.depth) || 0, 0.5);
    const half = depth / 2;
    const along = Math.min(Math.max(Number(fixture.offset), half + 0.01), Math.max(frame.len - half - 0.01, half + 0.01));
    const faceOff = side === -1 ? frame.startOff : frame.endOff;
    const wallGap = wallGapOf(fixture);
    const backOff = faceOff + side * wallGap;
    const frontOff = backOff + side * width;
    const u = { x: frame.ux, z: frame.uz };
    const toward = attach === 'left' ? -side : side;
    const F = { x: toward * u.x, z: toward * u.z };          // its front, along the wall
    const U = { x: F.z, z: -F.x };                           // its own left to right
    const center = frame.at(along, (backOff + frontOff) / 2);
    const y = center.y || 0;
    const pieceFrame = {
      ux: U.x, uz: U.z, nx: F.x, nz: F.z, len: width,
      at: (a, c) => ({ x: center.x + U.x * a + F.x * c, y, z: center.z + U.z * a + F.z * c }),
    };
    return {
      wall, frame, attach,
      along, alongStart: along - half, alongEnd: along + half,
      backOff, frontOff, width: depth, side, faceOff, wallGap, backGap: wallGap,
      corners: [
        frame.at(along - half, backOff),
        frame.at(along + half, backOff),
        frame.at(along + half, frontOff),
        frame.at(along - half, frontOff),
      ],
      center,
      piece: {
        frame: pieceFrame, along: 0, alongStart: -width / 2, alongEnd: width / 2,
        backOff: -depth / 2, frontOff: depth / 2, width, side: 1, faceOff: null, wallGap: 0, backGap: 0,
      },
    };
  };

  // ITS WALL, or the line it was kept on when that wall was deleted (`host`,
  // Movie, 21 Oct): every drawing of it reads the one frame either way.
  const hostOf = (walls, fixture) => (fixture?.wallId == null && fixture?.host
    ? { levelId: fixture.levelId, view: 'plan', ...fixture.host }
    : walls.find(w => w.id === fixture.wallId));
  const fixtureGeometry = (walls, fixture, wall = hostOf(walls, fixture)) => {
    if (!wall) return null;
    const frame = wallFrame(wall);
    if (!frame) return null;
    if (fixture.kind === 'tub' && fixture.endWallId) return tubGeometry(walls, fixture, wall, frame);
    // ITS OWN WIDTH, WHATEVER THE WALL'S LENGTH (Movie, 23 Oct: "lets only
    // allow the object to change if they click on it and change the
    // properties"): a shower on a wall shortened under it keeps its size and
    // stands past the wall's end, rather than shrinking to fit. It used to
    // be cut down to the wall.
    const attach = attachOf(fixture);
    if (attach !== 'back') return sideGeometry(fixture, wall, frame, attach);
    const width = Math.max(fixture.width, 0.5);
    const half = width / 2;
    const along = Math.min(Math.max(fixture.offset, half + 0.01), Math.max(frame.len - half - 0.01, half + 0.01));
    // A standoff floats the body clear of the wall face (the island's aisle),
    // and the half inch off the wall does the same (wallGapOf).
    const faceOff = fixture.side === -1 ? frame.startOff : frame.endOff;
    const wallGap = wallGapOf(fixture);
    const backGap = backGapOf(fixture);
    // A FIREPLACE SITS IN ITS WALL (jb, 27 Nov 2026: "that's where the
    // 'fireplace' should sit within the wall (the threshold and trim will be
    // on outside of wall and fireplace on the inside of that box i make with
    // the 4 2x4 walls"): only its trim stands proud of the room face; the
    // body goes back through the wall into the framed box behind it.
    const recess = fixture.kind === 'fireplace'
      ? Math.max(0, fixture.depth - fireplaceParts(fixture).frameDepth) : 0;
    const backOff = faceOff + fixture.side * ((fixture.standoff || 0) + backGap - recess);
    const frontOff = backOff + fixture.side * fixture.depth;
    const geo = {
      wall, frame,
      along, alongStart: along - half, alongEnd: along + half,
      backOff, frontOff, width, side: fixture.side, faceOff, wallGap, backGap, recess,
      corners: [
        frame.at(along - half, backOff),
        frame.at(along + half, backOff),
        frame.at(along + half, frontOff),
        frame.at(along - half, frontOff),
      ],
      center: frame.at(along, (backOff + frontOff) / 2),
    };
    // THE CORNER PIECE'S OTHER LEG: out along the crossing wall to its own
    // length off this wall, its depth deep off that one -- the box is the leg
    // on this wall, the deck the 4" of the other leg past it, so a pick takes
    // the whole L. `cornerAlong` is the corner end, `legAlong` the other
    // leg's inside face, `legOff` its far end off this wall.
    if (fixture.kind === 'cornerbase') {
      const c = fixture.corner === -1 ? -1 : 1;
      geo.cornerAlong = c > 0 ? along + half : along - half;
      geo.legAlong = geo.cornerAlong - c * fixture.depth;
      // FROM THE WALL'S FACE, not from the half inch: the next piece on the
      // other wall still stands tight to the leg's end.
      geo.legOff = faceOff + fixture.side * width;
      geo.decks = [[frame.at(geo.cornerAlong, frontOff), frame.at(geo.legAlong, frontOff),
        frame.at(geo.legAlong, geo.legOff), frame.at(geo.cornerAlong, geo.legOff)]];
    }
    return geo;
  };

  // ── A RUN, AN ISLAND, AND WHAT STOPS A SLIDE (Movie, 20 Oct) ────────────
  //
  // "i'd like to be able to move sink / dw in island back an forth / and
  // they shouldn't overlap". Two fixtures are RUN MATES when they stand on
  // the same wall, on the same face, the same distance off it: a counter's
  // pieces, or the pieces an island holds. A piece whose centre lies within
  // an island that is its run mate is IN that island; a slide keeps it
  // there and off the others. The tub keeps its own geometry and is nobody's
  // mate.
  const RUN_TOL_FT = 0.01;
  const hostKey = f => (f.wallId != null ? `w:${f.wallId}` : `h:${f.host?.id ?? ''}`);
  const runMates = (fixtures, piece) => fixtures.filter(other => other !== piece
    && hostKey(other) === hostKey(piece)
    && String(other.levelId) === String(piece.levelId)
    && (other.side === -1 ? -1 : 1) === (piece.side === -1 ? -1 : 1)
    && Math.abs((Number(other.standoff) || 0) - (Number(piece.standoff) || 0)) <= RUN_TOL_FT
    && other.kind !== 'tub' && piece.kind !== 'tub');
  const spanOf = f => [Number(f.offset) - alongWidth(f) / 2, Number(f.offset) + alongWidth(f) / 2];
  const within = (f, piece) => spanOf(f)[0] - RUN_TOL_FT <= Number(piece.offset)
    && Number(piece.offset) <= spanOf(f)[1] + RUN_TOL_FT;
  const islandHolding = (fixtures, piece) => (piece.kind === 'island' ? null
    : runMates(fixtures, piece).find(other => other.kind === 'island' && within(other, piece)) || null);
  const islandPieces = (fixtures, island) => (island.kind !== 'island' ? []
    : runMates(fixtures, island).filter(other => other.kind !== 'island' && within(island, other)));
  // WHERE A SLIDE MAY PUT A CENTRE: the nearest point to `target` inside
  // `bounds` that keeps the piece -- half its width each way -- off every
  // block. Null when nothing fits.
  const slideClamp = (target, half, bounds, blocks = []) => {
    let free = [[bounds[0] + half, bounds[1] - half]];
    blocks.forEach(([lo, hi]) => {
      free = free.flatMap(([a, b]) => {
        const cutLo = lo - half, cutHi = hi + half;   // the centres that would overlap
        if (cutHi <= a || cutLo >= b) return [[a, b]];
        const out = [];
        if (cutLo > a) out.push([a, cutLo]);
        if (cutHi < b) out.push([cutHi, b]);
        return out;
      });
    });
    free = free.filter(([a, b]) => b - a >= -1e-9);
    if (!free.length) return null;
    let best = null;
    free.forEach(([a, b]) => {
      const at = Math.min(Math.max(target, a), b);
      if (best === null || Math.abs(at - target) < Math.abs(best - target)) best = at;
    });
    return best;
  };

  // ── THE HALF INCH OFF A CROSSING WALL (Movie, 23 Oct) ─────────────────
  //
  // Where a piece's end -- or the end of the run of pieces it stands in,
  // touching end to end on one face of one wall -- meets a crossing wall, it
  // stands WALL_GAP_FT off that wall's face: within GAP_SNAP_FT of it, or
  // into it by up to a few inches, the run slides -- in or out -- to
  // exactly the half inch.
  // Pieces within a run stay tight ("only when against a wall"). A run with
  // a wall at both ends and no inch to spare is left where it is. A tub in
  // its alcove (endWallId) takes its half inches in tubGeometry.
  // The changes as [{ fixture, offset }], nothing mutated.
  const GAP_SNAP_FT = 3 / 12;
  const GAP_INTO_FT = 3 / 12;
  const crossFacesOn = (walls, wall, frame) => {
    const faces = [];
    (walls || []).forEach(other => {
      if (!other || other === wall || !other.start || !other.end) return;
      if (String(other.levelId) !== String(wall.levelId) || (other.view || 'plan') !== (wall.view || 'plan')) return;
      const hit = wallCross(wall, frame, other);
      if (!hit || hit.s < -0.05 || hit.s > 1.05) return;
      faces.push(...facesAlong(frame, other, hit.along));
    });
    return faces;
  };
  const settleWallGaps = (walls, fixtures) => {
    const groups = new Map();
    (fixtures || []).forEach(f => {
      if (!f || f.endWallId != null || !wallGapOf(f) || !(alongWidth(f) > 0)) return;
      const key = `${hostKey(f)}|${f.side === -1 ? -1 : 1}|${f.levelId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    });
    const out = [];
    groups.forEach(list => {
      const wall = hostOf(walls, list[0]);
      const frame = wall ? wallFrame(wall) : null;
      if (!frame) return;
      const faces = crossFacesOn(walls, wall, frame);
      if (!faces.length) return;
      const span = f => [Number(f.offset) - alongWidth(f) / 2, Number(f.offset) + alongWidth(f) / 2];
      const sorted = list.slice().sort((a, b) => span(a)[0] - span(b)[0]);
      const runs = [];
      sorted.forEach(f => {
        const last = runs[runs.length - 1];
        if (last && span(f)[0] - last.hi < RUN_TOL_FT * 2) { last.items.push(f); last.hi = Math.max(last.hi, span(f)[1]); }
        else runs.push({ items: [f], lo: span(f)[0], hi: span(f)[1] });
      });
      runs.forEach(run => {
        // THE SLIDE EACH END ASKS FOR, toward or away from the face nearest
        // it; a run asked both ways by two walls has no room and stays.
        let lo = null, hi = null;
        faces.forEach(face => {
          const dLo = run.lo - face;
          if (dLo > -GAP_INTO_FT && dLo < GAP_SNAP_FT && face < run.hi) {
            const ask = face + WALL_GAP_FT - run.lo;
            if (lo == null || Math.abs(ask) < Math.abs(lo)) lo = ask;
          }
          const dHi = face - run.hi;
          if (dHi > -GAP_INTO_FT && dHi < GAP_SNAP_FT && face > run.lo) {
            const ask = face - WALL_GAP_FT - run.hi;
            if (hi == null || Math.abs(ask) < Math.abs(hi)) hi = ask;
          }
        });
        const shift = lo != null && hi != null ? (Math.abs(lo - hi) < 1e-4 ? lo : 0) : lo ?? hi ?? 0;
        if (Math.abs(shift) < 1e-4) return;
        run.items.forEach(f => out.push({ fixture: f, offset: Number(f.offset) + shift }));
      });
    });
    return out;
  };

  // A PIECE PRESSED BY A CORNER: the centre that stands its end exactly the
  // half inch off the crossing wall's face, when that end is within `reach`
  // of the face or runs into the wall; null when no end is near one.
  const snapToWallGap = (walls, wall, along, width, reach = 0.5) => {
    const frame = wall && wallFrame(wall);
    if (!frame) return null;
    const half = width / 2;
    let best = null;
    crossFacesOn(walls, wall, frame).forEach(face => {
      const lo = along - half, hi = along + half;
      if (face <= along && lo - face > -half && lo - face < reach) {
        const at = face + WALL_GAP_FT + half;
        if (!best || Math.abs(at - along) < Math.abs(best - along)) best = at;
      }
      if (face >= along && face - hi > -half && face - hi < reach) {
        const at = face - WALL_GAP_FT - half;
        if (!best || Math.abs(at - along) < Math.abs(best - along)) best = at;
      }
    });
    return best;
  };

  // ── THE HALF INCH'S CORNERS, AS NODES (Movie, 24 Oct) ─────────────────
  //
  // "the corner where the 2 X 1/2" faint lines meet so the user can place it
  // against a wall and if there is a corner node the use can 'connect' them
  // when they are located at the same location". Where the faint line along
  // the wall face meets a faint side line: each end of the piece, half an
  // inch out, on the face. An end another piece stands against (a run kept
  // tight) has no side line there, and no node. `end` is -1 at the low end
  // along the wall, +1 at the high.
  const GAP_JOINT_FT = 0.03;
  const gapCorners = (walls, fixture, fixtures = []) => {
    const geo = fixtureGeometry(walls, fixture);
    if (!geo || !geo.frame || geo.faceOff == null || !(geo.wallGap > 0)) return [];
    const g = geo.wallGap;
    const a0 = geo.tub ? geo.tubAlongStart : geo.alongStart;
    const a1 = geo.tub ? geo.tubAlongEnd : geo.alongEnd;
    const side = fixture.side === -1 ? -1 : 1;
    const abuts = at => fixtures.some(other => other && other !== fixture
      && hostKey(other) === hostKey(fixture) && String(other.levelId) === String(fixture.levelId)
      && (other.side === -1 ? -1 : 1) === side && (() => {
        const o = fixtureGeometry(walls, other);
        return !!o && (Math.abs(o.alongEnd - at) < GAP_JOINT_FT || Math.abs(o.alongStart - at) < GAP_JOINT_FT);
      })());
    const out = [];
    if (!abuts(a0)) out.push({ ...geo.frame.at(a0 - g, geo.faceOff), end: -1 });
    if (!abuts(a1)) out.push({ ...geo.frame.at(a1 + g, geo.faceOff), end: 1 });
    return out.map(p => ({ x: p.x, z: p.z, end: p.end }));
  };

  // ── THE FIREPLACE'S PARTS (jb, 27 Nov 2026) ──────────────────────────
  //
  // A gas unit on plan, as jb's construction set draws its GAS FP: the box
  // against the wall, the FRAME (surround) round the opening at the front,
  // the GLASS across the opening, the firebox tapering back from it, and a
  // THRESHOLD (hearth) strip on the floor in front. The drafter sets the
  // OPENING (glass width) and THRESHOLD (hearth depth, 0 for none) in OBJ /
  // PROP; the rest follows from them and the box. Everything is in feet, the
  // opening held inside the box less its frame so a narrowed box never draws
  // glass past its own sides.
  const FIREPLACE_OPENING_FT = 3;
  const FIREPLACE_HEARTH_FT = 4 / 12;
  const FIREPLACE_FRAME_FT = 3 / 12;       // the surround each side of the glass
  const FIREPLACE_FRAME_DEPTH_FT = 2 / 12; // and its thickness at the front
  const FIREPLACE_HEARTH_PAST_FT = 4 / 12; // the hearth runs past the frame each side
  const fireplaceParts = fixture => {
    const width = Math.max(0, Number(fixture?.width) || 0);
    const depth = Math.max(0, Number(fixture?.depth) || 0);
    const frame = Math.min(FIREPLACE_FRAME_FT, width / 6);
    const asked = Number(fixture?.opening) > 0 ? Number(fixture.opening) : FIREPLACE_OPENING_FT;
    const opening = Math.max(0, Math.min(asked, width - 2 * frame));
    const hearthAsked = Number(fixture?.hearth);
    const hearth = Number.isFinite(hearthAsked) && hearthAsked >= 0 ? hearthAsked : FIREPLACE_HEARTH_FT;
    const frameDepth = Math.min(FIREPLACE_FRAME_DEPTH_FT, depth / 4);
    // The firebox's back: half the opening, 3" in from the box's back.
    const backInset = Math.min(3 / 12, depth / 5);
    return {
      width, depth, opening, frame, frameDepth, hearth, backInset,
      fireboxBack: opening / 2,
      hearthWidth: Math.min(width, opening + 2 * (frame + FIREPLACE_HEARTH_PAST_FT)),
      maxOpening: Math.max(0, width - 2 * frame),
    };
  };

  // THE CENTRE TAB (jb, 28 Nov 2026: "make a 'tab' on the fireplace right in
  // the dead center of the fireplace (widthwise) so i can pick up and move
  // it to the center of the dimension line and therefore center it in the
  // wall"): a grab point at the middle of the piece's width, just inside its
  // front edge. Held by it, the piece's centre is what snaps.
  const centreTab = (walls, fixture) => {
    const geo = fixtureGeometry(walls, fixture);
    if (!geo?.frame || geo.tub) return null;
    const dir = geo.frontOff >= geo.backOff ? 1 : -1;
    const inset = Math.min(1.5 / 12, Math.abs(geo.frontOff - geo.backOff) / 4);
    const p = geo.frame.at(geo.along, geo.frontOff - dir * inset);
    return { x: p.x, z: p.z, along: geo.along };
  };
  const CENTRE_TAB_KINDS = Object.freeze(['fireplace']);

  window.DraftFixtureGeometry = Object.freeze({
    centreTab,
    CENTRE_TAB_KINDS,
    fireplaceParts,
    FIREPLACE_OPENING_FT,
    FIREPLACE_HEARTH_FT,
    gapCorners,
    canAttachSide,
    attachOf,
    alongWidth,
    WALL_GAP_FT,
    snapToWallGap,
    wallGapOf,
    backGapOf,
    settleWallGaps,
    runMates,
    islandHolding,
    islandPieces,
    slideClamp,
    wallFrame,
    wallCross,
    facesAlong,
    fixtureGeometry,
    hostOf,
    hostKey,
    tubGeometry,
    TUB_MIN_LENGTH_FT,
    TUB_STRETCH_MAX_FT,
    COUNTER_OVERHANG_FT,
  });
})();
}
