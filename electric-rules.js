// ELECTRIC RULES — where the devices go, as one table read three ways.
//
//   generate  what goes here?          the build, accepting every candidate
//   snap      where would it have gone?  adding one by hand
//   check     what is missing?           later, drafting mode
//
// All three are the same answer, which is why this is a module and not code
// inside the generator: written there, the check gets written a second time
// and the two drift. Pure, no DOM, node-loadable, frozen.
//
// Every rule here is from SPEC-electric-plan.md and is Movie's. Nothing is
// invented — in particular there is NO POT LIGHT GRID. Spacing alone cannot
// tell a grid from a row, and how a grid fits a room is his rule, ungiven. A
// room that wants one light gets one centred fixture; the 5-7 ft band is
// offered as a spacing candidate when a second is added by hand, never as a
// generated array.
if (typeof window === 'undefined' || !window.DraftElectricRules) {
(() => {

  // Measured off sheet 14, not ruled. Defaults, never enforcement: if
  // implementing shows a number to be wrong that is a finding for Movie, not
  // a number to quietly change.
  const MEASURED = Object.freeze({
    outletToWallFt: 0.29,     // median; 90th 0.31 -- outlets sit ON the face
    outletSpacingFt: 6,       // the 4-8 ft band, mid
    fixtureSpacingFt: 6,      // 5-7 ft; medians 6.6 / 5.0 / 5.9
  });

  // ── Geometry, kept tiny and local ──────────────────────────────────────
  const centroid = polygon => {
    // Area centroid, not the average of the corners: an L-shaped room's
    // corner average drifts toward whichever leg has more vertices.
    let a = 0, cx = 0, cz = 0;
    for (let i = 0; i < polygon.length; i += 1) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length];
      const cross = p.x * q.z - q.x * p.z;
      a += cross; cx += (p.x + q.x) * cross; cz += (p.z + q.z) * cross;
    }
    if (Math.abs(a) < 1e-9) {           // degenerate: fall back to the average
      const n = polygon.length || 1;
      return { x: polygon.reduce((s, p) => s + p.x, 0) / n,
               z: polygon.reduce((s, p) => s + p.z, 0) / n };
    }
    a *= 0.5;
    return { x: cx / (6 * a), z: cz / (6 * a) };
  };

  // Containment is what defeats nearest-by-distance, so it is the load-
  // bearing primitive here rather than a convenience.
  const contains = (polygon, pt) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const a = polygon[i], b = polygon[j];
      if ((a.z > pt.z) !== (b.z > pt.z)
        && pt.x < ((b.x - a.x) * (pt.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
  };

  const roomHolding = (rooms, pt) => rooms.find(room => contains(room.polygon, pt)) || null;

  // ── Rule 1: a room with one light centres it ───────────────────────────
  const lightCandidates = room => [{
    kind: 'light', roomId: room.id, host: 'ceiling',
    ...centroid(room.polygon),
    why: 'rule 1: a room with one light centres it',
  }];

  // ── Rule 5: spacing candidates for a SECOND fixture, off its neighbours.
  // Offered when adding by hand. Not a grid, and never generated.
  const spacingCandidates = (room, existing) => {
    if (!existing.length) return [];
    const c = centroid(room.polygon);
    const gap = MEASURED.fixtureSpacingFt;
    return existing.flatMap(near => [
      { x: near.x + gap, z: near.z }, { x: near.x - gap, z: near.z },
      { x: near.x, z: near.z + gap }, { x: near.x, z: near.z - gap },
    ]).filter(pt => contains(room.polygon, pt))
      .map(pt => ({ kind: 'light', roomId: room.id, host: 'ceiling', ...pt,
        why: `rule 5: ${gap} ft off its neighbour (measured 5-7)` }))
      .sort((p, q) => Math.hypot(p.x - c.x, p.z - c.z) - Math.hypot(q.x - c.x, q.z - c.z));
  };

  // ── Rule 2: switches gang at the entry ─────────────────────────────────
  // A bank is lights; a gang is switches. The gang holds one switch per bank,
  // and that count is DERIVED -- add a bank and the gang grows on its own.
  const gangCandidate = room => (room.entry ? {
    kind: 'gang', roomId: room.id, host: 'wall',
    wallId: room.entry.wallId, offset: room.entry.offset, side: room.entry.side,
    why: 'rule 2: the gang sits beside the door you come in by',
  } : null);

  // ── Rule 3: a light joins the bank it is ENTERED FROM ──────────────────
  // The rule with teeth, and the one a wrong implementation still passes in
  // the easy case. Nearest-by-distance fails exactly where it shows: a light
  // near a party wall is often closest to the NEXT room's gang.
  //
  // So the switch is decided by CONTAINMENT first -- a light is switched by
  // the room that holds it, never by a nearer gang in another room -- and
  // only then, within that room, by direction from the entry.
  const switchForLight = (light, rooms) => {
    const room = roomHolding(rooms, light);
    if (!room || !room.entry) return null;
    return { roomId: room.id, wallId: room.entry.wallId, offset: room.entry.offset };
  };

  // Banks are DERIVED, never stored: group the lights on their switch. One
  // switch per bank is then true by definition rather than by maintenance,
  // and the last deletion makes a bank stop existing with nothing to sweep.
  // Revisit when three-ways arrive: a light answering to more than one switch
  // is the point a bank earns its own record.
  const banksOf = lights => {
    const by = new Map();
    lights.forEach(light => {
      const key = light.switchId == null ? 'unswitched' : String(light.switchId);
      if (!by.has(key)) by.set(key, []);
      by.get(key).push(light);
    });
    return [...by.entries()].map(([switchId, members]) => ({ switchId, lights: members }));
  };

  const gangCountFor = (roomId, lights) =>
    banksOf(lights.filter(l => l.roomId === roomId && l.switchId != null)).length;

  // ── Rule 4: outlets sit ON the wall face ───────────────────────────────
  // Measured at a median 0.29 ft from the wall line, which is to say: on it.
  // Wall-hosted, so there is no representation for one floating in a room.
  const outletCandidates = wall => {
    const runFt = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
    const gap = MEASURED.outletSpacingFt;
    const out = [];
    for (let d = gap / 2; d < runFt; d += gap) {
      out.push({ kind: 'outlet', host: 'wall', wallId: wall.id, offset: d,
        side: wall.side || 'in',
        why: `rule 4: on the wall face, ${gap} ft stations (measured 4-8)` });
    }
    return out;
  };

  // ── The three reads ────────────────────────────────────────────────────
  // One entry point. `generate` is nothing more than accepting every
  // candidate, so a device added by hand lands where the build would have
  // put it and the two plans cannot drift apart.
  const candidates = (house = {}) => {
    const rooms = Array.isArray(house.rooms) ? house.rooms : [];
    const walls = Array.isArray(house.walls) ? house.walls : [];
    return {
      lights: rooms.flatMap(lightCandidates),
      gangs: rooms.map(gangCandidate).filter(Boolean),
      outlets: walls.flatMap(outletCandidates),
    };
  };

  const generate = house => {
    const c = candidates(house);
    const rooms = Array.isArray(house.rooms) ? house.rooms : [];
    // Every generated device is the build's until the drafter touches it --
    // the same `auto` flag the bone's windows use (#169), so a re-deal
    // replaces its own work and never his.
    const lights = c.lights.map(light => {
      const sw = switchForLight(light, rooms);
      return { ...light, auto: true, switchId: sw ? `${sw.wallId}:${sw.offset}` : null };
    });
    const gangs = c.gangs.map(gang => ({
      ...gang, auto: true, switches: gangCountFor(gang.roomId, lights) || 1,
    }));
    return { lights, gangs, outlets: c.outlets.map(o => ({ ...o, auto: true })) };
  };

  const API = Object.freeze({
    MEASURED, centroid, contains, roomHolding,
    lightCandidates, spacingCandidates, gangCandidate,
    switchForLight, banksOf, gangCountFor, outletCandidates,
    candidates, generate,
  });
  if (typeof window !== 'undefined') window.DraftElectricRules = API;
  if (typeof module !== 'undefined') module.exports = API;
})();
}
