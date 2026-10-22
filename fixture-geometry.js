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
  const TUB_STRETCH_MAX_FT = 0.5;    // the tub grows up to 6" past standard; the rest is deck
  const TUB_MIN_LENGTH_FT = 4;       // an alcove shorter than this can't take the tub
  // Not read in this file: drawFixture2D takes it through env, and the kitchen
  // island reads it to stand its cabinet off the counter. It lives here because
  // it is the fixture's spec and both boards need the same number -- a counter
  // that overhangs by a different amount on each page is the drift this module
  // was extracted to stop.
  const COUNTER_OVERHANG_FT = 1 / 12; // countertop edge past the cabinet face

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
    const def = TYPES.find(w => w.id === (wall.wallType || 'stud_2x6')) || TYPES[1];
    const totalFt = def.totalIn / 12;
    const refLine = wall.refLine || 'center';
    const startOff = refLine === 'left' ? 0 : refLine === 'right' ? -totalFt : -totalFt / 2;
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
    const face = dir > 0 ? Math.max(...endFaces) : Math.min(...endFaces);
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
      if (dir * (otherFace - face) > 0.5 && dir * (otherFace - face) < dir * (farFace - face)) farFace = otherFace;
    });
    const alcove = dir * (farFace - face);
    if (alcove < TUB_MIN_LENGTH_FT) return null;
    const tubLen = Math.min(alcove, fixture.width + TUB_STRETCH_MAX_FT);
    const gap = Math.max(alcove - tubLen, 0);
    const slide = Math.min(Math.max(fixture.offset, 0), gap);
    const near = face + dir * slide;
    const far = near + dir * tubLen;
    const backOff = fixture.side === -1 ? frame.startOff : frame.endOff;
    const frontOff = backOff + fixture.side * fixture.depth;
    const rect = (a0, a1) => [
      frame.at(a0, backOff), frame.at(a1, backOff), frame.at(a1, frontOff), frame.at(a0, frontOff),
    ];
    const decks = [];
    if (slide > 0.04) decks.push(rect(Math.min(face, near), Math.max(face, near)));
    if (gap - slide > 0.04) decks.push(rect(Math.min(far, farFace), Math.max(far, farFace)));
    return {
      wall, frame, tub: true, dir, face, farFace, alcove, tubLen, gap, slide,
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
    const width = Math.min(fixture.width, Math.max(frame.len - 0.02, 0.5));
    const half = width / 2;
    const along = Math.min(Math.max(fixture.offset, half + 0.01), Math.max(frame.len - half - 0.01, half + 0.01));
    // A standoff floats the body clear of the wall face (the island's aisle).
    const backOff = (fixture.side === -1 ? frame.startOff : frame.endOff) + fixture.side * (fixture.standoff || 0);
    const frontOff = backOff + fixture.side * fixture.depth;
    const geo = {
      wall, frame,
      along, alongStart: along - half, alongEnd: along + half,
      backOff, frontOff, width, side: fixture.side,
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
      geo.legOff = backOff + fixture.side * width;
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
  const spanOf = f => [Number(f.offset) - Number(f.width) / 2, Number(f.offset) + Number(f.width) / 2];
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

  window.DraftFixtureGeometry = Object.freeze({
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
