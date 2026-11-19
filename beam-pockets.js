// beam-pockets.js — THE BEAM POCKETS IN A BASEMENT'S CONCRETE WALL
//
// jb, 19 Nov 2026: "for bungalow (not for bilevel) we need BEAM POCKETS at
// each end where it sits in the conc wall. make them 4" "in" the conc and 8"
// wide on the plan."
//
// WHICH ENDS: a beam filed on the FOUNDATION level (its 'foundation' view,
// the beams that carry the main floor) whose end lands on -- or within a
// foot of -- a concrete foundation wall it runs into, more or less square.
// A bilevel or modified bilevel takes none (LevelAssembly.isSplitType): its
// beam bears on the short concrete wall under a framed one, not in a pocket.
//
// WHAT: a notch from the wall's INSIDE face (the face the beam comes from)
// POCKET_DEPTH_FT into the concrete, POCKET_WIDTH_FT along the wall, centred
// on the beam's line. On the stock 8" CONC + 2X6 BSMT only the concrete band
// counts (the FOUNDATION plan shows only it), the way footing-outline.js
// reads it.
//
// PURE. Walls and beams in, pockets out; the painter is render-2d.js
// drawBeamPockets2D, and MODEL.html and layout-plan.js both ask this.
if (!window.DraftBeamPockets) {
(() => {
  'use strict';

  const POCKET_DEPTH_FT = 4 / 12;
  const POCKET_WIDTH_FT = 8 / 12;
  const REACH_FT = 1;          // how far short of the concrete an end may stop
  const SQUARE_COS = 0.3;      // |beam . wall| under this counts as running into it

  const isConcreteWall = wall => {
    const type = String(wall?.wallType || '');
    if (/^(concrete|icf)/.test(type)) return true;
    const WT = window.DraftWallTypes;
    return !!(WT?.isStockWallType && WT.isStockWallType(type));
  };

  // The concrete band across a wall, as offsets along n = (-u.z, u.x) from
  // its line: the faces the FOUNDATION plan draws.
  const bandOf = (wall, thicknessFt, faceOffsets) => {
    const total = Number(thicknessFt(wall)) || 8 / 12;
    const { startOff, endOff } = faceOffsets(wall, total);
    let lo = Math.min(startOff, endOff), hi = Math.max(startOff, endOff);
    const FO = window.DraftFootingOutline;
    const band = FO?.concreteBandIn ? FO.concreteBandIn(wall) : null;
    if (band) { const base = lo; lo = base + band.from / 12; hi = base + band.to / 12; }
    return { lo, hi };
  };

  // walls, beams: the drawing's (any level; the function picks).
  // levelId: the foundation level drawn. buildType: the drawing's.
  // thicknessFt(wall), faceOffsets(wall, totalFt): the page's wall arithmetic.
  const beamPockets = ({ walls, beams, levelId = 1, buildType = null, thicknessFt, faceOffsets } = {}) => {
    const LA = window.DraftLevelAssembly;
    if (LA?.isSplitType && LA.isSplitType(buildType)) return [];
    if (typeof thicknessFt !== 'function' || typeof faceOffsets !== 'function') return [];
    const concrete = (Array.isArray(walls) ? walls : []).filter(wall => wall?.start && wall?.end
      && Number(wall.levelId) === Number(levelId) && (wall.view || 'plan') === 'foundation'
      && isConcreteWall(wall));
    if (!concrete.length) return [];
    const frames = concrete.map(wall => {
      const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z, len = Math.hypot(dx, dz);
      if (len < 1e-6) return null;
      const u = { x: dx / len, z: dz / len }, n = { x: -u.z, z: u.x };
      return { wall, u, n, len, ...bandOf(wall, thicknessFt, faceOffsets) };
    }).filter(Boolean);
    const out = [];
    (Array.isArray(beams) ? beams : []).forEach(beam => {
      if (!beam?.start || !beam?.end || Number(beam.levelId) !== Number(levelId)
        || (beam.view || 'foundation') !== 'foundation') return;
      const dx = beam.end.x - beam.start.x, dz = beam.end.z - beam.start.z, len = Math.hypot(dx, dz);
      if (len < 1e-6) return;
      const b = { x: dx / len, z: dz / len };
      [['start', beam.start, { x: -b.x, z: -b.z }], ['end', beam.end, b]].forEach(([which, end, outward]) => {
        let best = null;
        frames.forEach(f => {
          if (Math.abs(outward.x * f.u.x + outward.z * f.u.z) > SQUARE_COS) return;
          const px = end.x - f.wall.start.x, pz = end.z - f.wall.start.z;
          const t = px * f.u.x + pz * f.u.z;
          if (t < -0.05 || t > f.len + 0.05) return;
          const d = px * f.n.x + pz * f.n.z;
          // The face the beam comes from: the beam runs outward along
          // +n or -n into the wall, so its inside face is the other one.
          const into = outward.x * f.n.x + outward.z * f.n.z > 0 ? 1 : -1;
          const face = into > 0 ? f.lo : f.hi;
          // How far the end is past the face, into the wall (negative: short).
          const pastFace = (d - face) * into;
          if (pastFace < -REACH_FT || pastFace > (f.hi - f.lo) + 0.05) return;
          const gap = pastFace < 0 ? -pastFace : 0;
          if (!best || gap < best.gap) best = { f, t, face, into, gap };
        });
        if (!best) return;
        const { f, t, face, into } = best;
        const back = face + into * POCKET_DEPTH_FT;
        const at = (along, off) => ({
          x: f.wall.start.x + f.u.x * along + f.n.x * off,
          z: f.wall.start.z + f.u.z * along + f.n.z * off,
        });
        const half = POCKET_WIDTH_FT / 2;
        out.push({
          id: `pocket:${beam.id}:${which}`,
          beamId: beam.id,
          wallId: f.wall.id,
          end: which,
          // The middle of the pocket's open face, on the wall's inside face.
          mouth: at(t, face),
          // [face lo, back lo, back hi, face hi]
          corners: [at(t - half, face), at(t - half, back), at(t + half, back), at(t + half, face)],
        });
      });
    });
    return out;
  };

  window.DraftBeamPockets = Object.freeze({ beamPockets, POCKET_DEPTH_FT, POCKET_WIDTH_FT, isConcreteWall });
})();
}
