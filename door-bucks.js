// door-bucks.js — THE DOOR BUCKS ON A GARAGE'S FOUNDATION PLAN
//
// Movie, 16 Oct: "DOOR BUCKS at the man door and each garage door, 2" wider
// than the door each side; no width dimension on the buck; buck areas in a
// lighter weight; the slab pours through the buck in the slab's light blue.
// The inside edge of the door buck, below the slab, is a lighter line."
//
// A GARAGE'S DOORS ARE FILED ON ITS WALLS PLAN, and the concrete under them
// is a closed ring on the FOUNDATION view with no opening at all -- so the
// buck cannot be read off the foundation's own records. It is PROJECTED:
// each door on a garage wall (the overhead doors and the man door) finds the
// concrete wall running under it and cuts a buck there, the door's width
// plus 2" each side, across the concrete's full thickness.
//
// PURE. Walls and fenestrations in, bucks out: no page, no canvas. The
// painter is render-2d.js drawDoorBucks2D; MODEL.html and layout-plan.js
// both ask this for the list, so the screen and the sheet cut one buck.
{
(() => {
  'use strict';

  const BUCK_EXTRA_FT = 2 / 12;   // 2" wider than the door, each side
  const UNDER_FT = 1;             // how far off the concrete's line a door may sit and still be over it

  const isConcrete = wall => /^concrete/.test(String(wall?.wallType || ''));
  const unit = (a, b) => {
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    return len < 1e-9 ? null : { x: dx / len, z: dz / len, len };
  };

  // The concrete wall under a point, parallel to `along`: the nearest of the
  // candidates whose line the point sits on (within UNDER_FT) and whose run
  // covers it. Null when none does -- a door over no concrete cuts no buck.
  const concreteUnder = (point, along, candidates) => {
    let best = null;
    candidates.forEach(wall => {
      const u = unit(wall.start, wall.end);
      if (!u) return;
      if (Math.abs(u.x * along.x + u.z * along.z) < 0.99) return;
      const t = (point.x - wall.start.x) * u.x + (point.z - wall.start.z) * u.z;
      const d = Math.abs((point.x - wall.start.x) * -u.z + (point.z - wall.start.z) * u.x);
      if (d > UNDER_FT || t < -0.01 || t > u.len + 0.01) return;
      if (!best || d < best.d) best = { wall, u, t, d };
    });
    return best;
  };

  // WHICH SIDE OF THE CONCRETE IS INSIDE: the side the rest of the body's
  // concrete stands on. The box centre of the body's foundation walls is
  // inside the ring for any garage a drafter draws.
  const bodyCentre = walls => {
    const pts = walls.flatMap(wall => [wall.start, wall.end]);
    if (!pts.length) return null;
    const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
  };

  // `walls`: the drawing's walls (the garage's plan walls and the foundation's
  // concrete; the function picks). `fenestrations`: the drawing's openings.
  // `thicknessFt(wall)` and `faceOffsets(wall, totalFt)` are the page's own
  // wall-type arithmetic (geometry-2d wallFaceOffsets), so the buck spans the
  // faces the wall is drawn with. `concreteLevelId` limits the concrete to one
  // level when given (the foundation being drawn).
  const doorBucks = ({ walls, fenestrations, thicknessFt, faceOffsets, concreteLevelId = null,
    extraFt = BUCK_EXTRA_FT } = {}) => {
    const list = (Array.isArray(walls) ? walls : []).filter(wall => wall && wall.start && wall.end);
    const byId = new Map(list.map(wall => [String(wall.id), wall]));
    const concrete = list.filter(wall => isConcrete(wall) && (wall.view || 'plan') === 'foundation'
      && (concreteLevelId == null || Number(wall.levelId) === Number(concreteLevelId)));
    if (!concrete.length || typeof thicknessFt !== 'function' || typeof faceOffsets !== 'function') return [];
    const out = [];
    (Array.isArray(fenestrations) ? fenestrations : []).forEach(door => {
      if (!door || door.type !== 'door') return;
      const host = byId.get(String(door.wallId));
      if (!host || host.body !== 'garage' || (host.view || 'plan') !== 'plan') return;
      const along = unit(host.start, host.end);
      if (!along) return;
      const offset = Number(door.offset), width = Number(door.width);
      if (!Number.isFinite(offset) || !(width > 0)) return;
      const centre = { x: host.start.x + along.x * offset, z: host.start.z + along.z * offset };
      const under = concreteUnder(centre, along, concrete);
      if (!under) return;
      const total = thicknessFt(under.wall);
      const { startOff, endOff } = faceOffsets(under.wall, total);
      const across = { x: -under.u.z, z: under.u.x };
      const at = { x: under.wall.start.x + under.u.x * under.t, z: under.wall.start.z + under.u.z * under.t };
      const middle = bodyCentre(concrete.filter(wall => wall.body === under.wall.body));
      const toMiddle = middle ? (middle.x - at.x) * across.x + (middle.z - at.z) * across.z : 0;
      out.push({
        id: `buck:${door.id}`,
        doorId: door.id,
        wallId: under.wall.id,
        garage: door.garage === true,
        centre: at,
        along: { x: under.u.x, z: under.u.z },
        across,
        halfLen: width / 2 + extraFt,
        widthFt: width + extraFt * 2,
        startOff,
        endOff,
        // The face on the inside of the ring: 'end' when +across points into
        // the garage, 'start' otherwise.
        insideFace: toMiddle >= 0 ? 'end' : 'start',
      });
    });
    return out;
  };

  // The buck's four corners in plan feet, for a painter or a check: along
  // then across, start face first.
  const buckCorners = buck => {
    const p = (along, across) => ({
      x: buck.centre.x + buck.along.x * along + buck.across.x * across,
      z: buck.centre.z + buck.along.z * along + buck.across.z * across,
    });
    return [p(-buck.halfLen, buck.startOff), p(buck.halfLen, buck.startOff),
      p(buck.halfLen, buck.endOff), p(-buck.halfLen, buck.endOff)];
  };

  window.DraftDoorBucks = Object.freeze({ doorBucks, buckCorners, BUCK_EXTRA_FT, UNDER_FT });
})();
}
