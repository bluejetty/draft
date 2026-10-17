// THE DEFAULT WASHROOMS -- Movie's two main baths and his barrier-free WC,
// picked and dropped whole.
//
// Movie, 9 Oct: "make some 'default' washrooms i can select and add to the
// plan", drawn in 1._Story.DXF: bath A, 5'-7" x 8'-7" inside, and bath B,
// 5'-1" x 8'-1". Everything below is measured off that file; nothing is a
// round number chosen here.
//
// WC BF1 (Movie, 17 Oct, NORTH_POINT_S_SUITE.pdf: "can you make a WC and
// KITCHENS that are like on this plan ... call it WC BF1 ... (BF = Barrier
// Free)"): the studio suite's WC, 9'-11" x 10'-5 1/2" inside, a 36 x 72
// roll-in shower across the far end, the toilet on the left wall, a V42 on
// the end wall and a D32 that swings OUT -- a barrier-free door clears the
// room rather than blocking someone on the floor inside it. Measured off
// the sheet at 1/8" = 1'-0" printed twice up; the 9'-11" and 10'-5 1/2" are
// its own dimension strings.
//
// THE ROOM'S OWN FRAME, in feet, the INSIDE faces: `u` across the width
// (0 .. W), `v` along the length (0 .. L). The tub runs across the v = 0 end
// -- the end that is the house's exterior wall when the room is dropped
// against one -- and the toilet and vanity stand on the u = W wall.
//
//                  far wall (v = L)
//          +-----------------------------+
//          |                       vanity|
//    left  |                       toilet|  right (u = W)
//          |   tub  (30 x 60)            |
//          +-----------------------------+
//                tub wall (v = 0)
//
// THE TUB-END WALL IS THE ONE THAT CAN BE SOMEONE ELSE'S. Dropped against the
// house's exterior wall (Movie: "when the bathroom is against the exterior
// wall it should join up like this"), the room draws no wall of its own
// there: the tub sits on the exterior wall and the side walls run to it.
// Anywhere else it is a 3 1/2" interior wall ("when it is in interior that
// magenta wall should become a int wall").
//
// THE KEY STAYS 'tub' FOR EVERY ROOM, the BF1 included: it names the v = 0
// end, the end that joins the house, and the baths that gave it the name
// put a tub there. BF1 puts its vanity there and its shower at the far end;
// what joins the house is still the v = 0 wall.
//
// PURE: points in, points out. The page decides where the cursor is, what
// counts as the exterior, and how a record is filed.
if (!window.DraftWashroomPresets) {
(() => {
  const IN = 1 / 12;
  const STUD_4 = 3.5 * IN;
  const HALF_4 = STUD_4 / 2;
  const STUD_6 = 5.5 * IN;

  // What Movie drew. Toilet and vanity centres are along the right wall from
  // the tub end; the door is given by its hinge jamb and the jamb it closes
  // on, both on the inside face, as the DXF's swing arc puts them.
  const TOILET = Object.freeze({ width: 5 / 3, depth: 7 / 3 });
  const PRESETS = Object.freeze({
    A: Object.freeze({
      id: 'A', name: 'BATH A', label: "BATH A 5'-7\" x 8'-7\"",
      W: 67 * IN, L: 103 * IN,
      // Toilet and vanity centres along the right wall from the tub end.
      fixtures: [
        { kind: 'vanity', host: 'right', at: [67 * IN, 84.5 * IN], width: 3, depth: 2 },   // V36
        { kind: 'toilet', host: 'right', at: [67 * IN, 51.2 * IN], ...TOILET },
        { kind: 'tub' },
      ],
      // The 6" wall at the tub's foot, as long as the tub is deep: a 2x6
      // standing against the right wall.
      chase: { lengthFt: 30 * IN },
      door: { wall: 'far', hinge: [5 * IN, 103 * IN], strike: [37 * IN, 103 * IN], width: 32 * IN },
    }),
    B: Object.freeze({
      id: 'B', name: 'BATH B', label: "BATH B 5'-1\" x 8'-1\"",
      W: 61 * IN, L: 97 * IN,
      fixtures: [
        { kind: 'vanity', host: 'right', at: [61 * IN, 81.5 * IN], width: 2.5, depth: 2 }, // V30
        { kind: 'toilet', host: 'right', at: [61 * IN, 51.2 * IN], ...TOILET },
        { kind: 'tub' },
      ],
      chase: null,
      // On the long wall opposite the toilet and vanity (Movie: "the entry
      // door will be on the wall opposite the toilet and sink").
      door: { wall: 'left', hinge: [0, 92 * IN], strike: [0, 60 * IN], width: 32 * IN },
    }),
    // THE BARRIER-FREE WC, off the studio suite. The end wall (v = 0) is the
    // suite's exterior wall with the V42 in its corner; the 36 x 72 roll-in
    // shower lies across the far end from the left wall; the toilet is on
    // the left wall 4'-11" in; the D32 is on the right wall past the vanity
    // and swings out. No tub, so no 6" wall.
    BF1: Object.freeze({
      id: 'BF1', name: 'WC BF1', label: "WC BF1 9'-11\" x 10'-5 1/2\" barrier free",
      W: 119 * IN, L: 125.5 * IN,
      fixtures: [
        { kind: 'vanity', host: 'tub', at: [98 * IN, 0], width: 3.5, depth: 2 },           // V42
        { kind: 'toilet', host: 'left', at: [0, 59 * IN], ...TOILET },
        { kind: 'shower', host: 'far', at: [36 * IN, 125.5 * IN], width: 6, depth: 3 },   // 36 x 72
      ],
      chase: null,
      door: { wall: 'right', hinge: [119 * IN, 30 * IN], strike: [119 * IN, 62 * IN], width: 32 * IN,
        swing: 'out' },
    }),
  });
  const TUB = Object.freeze({ width: 5, depth: 2.5 });

  // The room, in its own frame. `tubInsetFt` is where the side walls stop
  // behind the tub's inside face: half a 2x4 for its own wall, or as far as
  // the exterior wall's drawn line when it stands against one.
  function localLayout(id, { tubInsetFt = null } = {}) {
    const p = PRESETS[id];
    if (!p) return null;
    const { W, L } = p;
    const own = tubInsetFt == null;
    const vT = own ? -HALF_4 : -tubInsetFt;
    const walls = [
      { key: 'left', a: [-HALF_4, vT], b: [-HALF_4, L + HALF_4], wallType: 'stud_2x4' },
      { key: 'right', a: [W + HALF_4, vT], b: [W + HALF_4, L + HALF_4], wallType: 'stud_2x4' },
      { key: 'far', a: [-HALF_4, L + HALF_4], b: [W + HALF_4, L + HALF_4], wallType: 'stud_2x4' },
    ];
    if (own) walls.push({ key: 'tub', a: [-HALF_4, -HALF_4], b: [W + HALF_4, -HALF_4], wallType: 'stud_2x4' });
    if (p.chase) {
      const u = W - STUD_6 / 2;
      walls.push({ key: 'chase', a: [u, vT], b: [u, p.chase.lengthFt], wallType: 'stud_2x6' });
    }
    return {
      preset: p,
      walls,
      fixtures: p.fixtures.map(f => (f.kind !== 'tub' ? f
        // The tub's faucet end is the end its drain is at -- the chase in A,
        // the right wall in B -- and it fills the alcove to the left wall.
        : { kind: 'tub', host: 'tub', endWall: p.chase ? 'chase' : 'right',
          width: TUB.width, depth: TUB.depth, faucet: [W, 0], far: [0, 0] })),
      door: { host: p.door.wall, hinge: p.door.hinge, strike: p.door.strike, width: p.door.width,
        swing: p.door.swing || 'in' },
      inside: [[0, 0], [W, 0], [W, L], [0, L]],
    };
  }

  // Room frame -> world. Centred on the inside rectangle, turned by
  // `angleDeg`, and mirrored across the room's own long axis when `flip`.
  function toWorld(p, { at, angleDeg = 0, flip = false }) {
    const t = (angleDeg * Math.PI) / 180;
    const c = Math.cos(t), s = Math.sin(t);
    return ([u, v]) => {
      const a = (flip ? -1 : 1) * (u - p.W / 2), b = v - p.L / 2;
      return { x: at.x + c * a - s * b, z: at.z + s * a + c * b };
    };
  }

  const sub = (a, b) => ({ x: a.x - b.x, z: a.z - b.z });
  const dot = (a, b) => a.x * b.x + a.z * b.z;
  const unit = (a, b) => {
    const d = sub(b, a); const n = Math.hypot(d.x, d.z) || 1;
    return { x: d.x / n, z: d.z / n };
  };

  // THE WHOLE ROOM IN THE WORLD. Walls by key with their ends; fixtures and
  // the door with everything a record needs, measured along the wall they
  // ride: `offset` from the host's start, and `side` -- which face -- read
  // off where the room actually is, so a mirrored or turned room is right
  // without a rule per case. `ext` is the exterior wall the room stands
  // against, or null.
  function place(id, { at, angleDeg = 0, flip = false, ext = null } = {}) {
    const lay = localLayout(id, { tubInsetFt: ext ? ext.insetFt : null });
    if (!lay || !at) return null;
    const P = toWorld(lay.preset, { at, angleDeg, flip });
    const walls = lay.walls.map(w => ({ key: w.key, start: P(w.a), end: P(w.b), wallType: w.wallType }));
    const hostOf = key => (key === 'ext' ? ext && ext.wall : walls.find(w => w.key === key));
    const centre = P([lay.preset.W / 2, lay.preset.L / 2]);
    const along = (wall, pt) => dot(sub(pt, wall.start), unit(wall.start, wall.end));
    // +1 when the room is on the wall's left normal (-dz, dx) -- the face
    // fixture-geometry.js calls side 1.
    const roomSide = wall => {
      const d = unit(wall.start, wall.end);
      return dot({ x: -d.z, z: d.x }, sub(centre, wall.start)) >= 0 ? 1 : -1;
    };
    // WHAT STANDS ON THE END WALL STANDS ON THE HOUSE'S when the room joins
    // it: the tub in A and B, the vanity in BF1.
    const endKey = key => (key === 'tub' && !lay.walls.some(w => w.key === 'tub') ? 'ext' : key);
    const fixtures = lay.fixtures.map(f => {
      const host = hostOf(endKey(f.host));
      if (!host) return null;
      if (f.kind === 'tub') {
        const toFar = along(host, P(f.far)) - along(host, P(f.faucet));
        return { kind: 'tub', host: endKey(f.host), endWall: f.endWall, offset: 0,
          width: f.width, depth: f.depth, side: roomSide(host), dir: toFar >= 0 ? 1 : -1 };
      }
      return { kind: f.kind, host: endKey(f.host), offset: along(host, P(f.at)),
        width: f.width, depth: f.depth, side: roomSide(host) };
    }).filter(Boolean);
    const doorHost = hostOf(lay.door.host);
    const hingeAt = along(doorHost, P(lay.door.hinge));
    const strikeAt = along(doorHost, P(lay.door.strike));
    const door = {
      host: lay.door.host,
      offset: (hingeAt + strikeAt) / 2,
      width: lay.door.width,
      swing: lay.door.swing,
      // fixture-geometry's conventions for a door: unflipped, the hinge is
      // at the jamb nearer the wall's start and the leaf swings to the left
      // normal. Into the room, hinged where Movie hung it -- or OUT of it
      // where the preset says so: BF1's door swings out, so a fall inside a
      // barrier-free WC can never block its own door.
      hingeFlip: hingeAt > strikeAt,
      swingFlip: lay.door.swing === 'out' ? roomSide(doorHost) === 1 : roomSide(doorHost) !== 1,
    };
    return {
      id, name: lay.preset.name, walls, fixtures, door, centre,
      inside: lay.inside.map(P),
      ext: ext ? ext.wall : null,
    };
  }

  // THE EXTERIOR WALL THE TUB END IS DROPPED AGAINST, if one is near enough:
  // parallel to the tub end, its inside face within `snapFt` of the room's,
  // and long enough to carry the room's width. The room slides square to the
  // wall until the two faces meet. `faces(wall)` answers the wall's two face
  // offsets across its drawn line (fixture-geometry's wallFrame startOff /
  // endOff), so this module knows no wall types.
  const SNAP_FT = 1.5;
  function snapToExterior(id, { at, angleDeg = 0, flip = false }, candidates, faces, snapFt = SNAP_FT) {
    const p = PRESETS[id];
    if (!p || !at) return null;
    const P = toWorld(p, { at, angleDeg, flip });
    const tubA = P([0, 0]), tubB = P([p.W, 0]);
    const out = unit(P([p.W / 2, p.L / 2]), P([p.W / 2, 0]));   // centre -> tub end
    const tubMid = P([p.W / 2, 0]);
    let best = null;
    (candidates || []).forEach(wall => {
      const d = unit(wall.start, wall.end);
      if (Math.abs(dot(d, out)) > 0.05) return;
      const n = { x: -d.z, z: d.x };
      const off = faces(wall);
      if (!off) return;
      const roomOn = dot(n, sub(at, wall.start)) >= 0 ? 1 : -1;
      const inner = roomOn > 0 ? Math.max(off.startOff, off.endOff) : Math.min(off.startOff, off.endOff);
      const facePt = { x: wall.start.x + n.x * inner, z: wall.start.z + n.z * inner };
      const gap = dot(sub(facePt, tubMid), out);
      if (Math.abs(gap) > snapFt) return;
      const len = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
      const sA = dot(sub(tubA, wall.start), d), sB = dot(sub(tubB, wall.start), d);
      if (Math.min(sA, sB) < -0.05 || Math.max(sA, sB) > len + 0.05) return;
      if (!best || Math.abs(gap) < Math.abs(best.gap)) {
        best = { wall, gap, insetFt: Math.abs(inner) };
      }
    });
    if (!best) return null;
    return {
      at: { x: at.x + out.x * best.gap, z: at.z + out.z * best.gap },
      ext: { wall: best.wall, insetFt: best.insetFt },
    };
  }

  window.DraftWashroomPresets = Object.freeze({
    PRESETS,
    IDS: Object.freeze(Object.keys(PRESETS)),
    SNAP_FT,
    localLayout,
    place,
    snapToExterior,
  });
})();
}
