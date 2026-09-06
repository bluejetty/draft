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

  const tubGeometry = (walls, fixture, wall, frame) => {
    const endWall = walls.find(w => w.id === fixture.endWallId);
    if (!endWall) return null;
    const cross = wallCross(wall, frame, endWall);
    if (!cross || cross.s < -0.2 || cross.s > 1.2) return null;
    const dir = fixture.dir === -1 ? -1 : 1;
    const face = cross.along + dir * ((wallFrame(endWall)?.totalFt || 0) / 2);
    // The alcove's far bound: the nearest crossing wall past the faucet wall,
    // or the end of the back wall itself.
    let farFace = dir > 0 ? frame.len : 0;
    walls.forEach(other => {
      if (other === wall || other === endWall) return;
      if (other.levelId !== wall.levelId || (other.view || 'plan') !== (wall.view || 'plan')) return;
      const hit = wallCross(wall, frame, other);
      if (!hit || hit.s < -0.05 || hit.s > 1.05) return;
      const otherFace = hit.along - dir * ((wallFrame(other)?.totalFt || 0) / 2);
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

  const fixtureGeometry = (walls, fixture, wall = walls.find(w => w.id === fixture.wallId)) => {
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
    return {
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
  };

  window.DraftFixtureGeometry = Object.freeze({
    wallFrame,
    wallCross,
    fixtureGeometry,
    tubGeometry,
    TUB_MIN_LENGTH_FT,
    TUB_STRETCH_MAX_FT,
    COUNTER_OVERHANG_FT,
  });
})();
}
