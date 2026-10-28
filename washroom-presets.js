// THE DEFAULT WASHROOMS -- Movie's two main baths and the North Point suites'
// barrier-free WCs, picked and dropped whole.
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
// THE SUITES' WCs ARE MORE THAN A BOX (Movie, 17-18 Oct, the North Point
// 1B, 1BD and 2BD sheets: "WC BF2", "WC BF3 ... include the CLOSET and the
// W/D Laundry closet", "WC BF4 ... put the closet on the back of this one",
// "WCBF# (next one) include the closet too"). So a preset may give its own
// WALLS -- notches, stubs, plumbing walls, the closet beyond -- as a list in
// the room frame, a DOOR LIST with styles (pocket, two-leaf), and its SPACES:
// the WC first, then the closet and the laundry, each a polygon. Every one
// is measured off its sheet; the room tags give the sizes and the fixtures
// sit where the sheet puts them.
//
// A PLUMBING WALL BEHIND THE SINK (Movie, 17 Oct: "the sink needs a 3.5"
// wall behind it for extra plumbing and so the sound insulation in the wall
// isn't disturbed"): a 2x4 against the end or demising wall behind the
// vanity only, as the sheets draw it, and the vanity stands on it.
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
      // WC 1 AND WC 2 (Movie, 17 Oct: "could be called WC1 WC2 to save
      // space" -- "lets call them WC1 WC2"). Their ids stay A and B.
      id: 'A', name: 'WC 1', label: "WC 1 5'-7\" x 8'-7\"",
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
      doors: [{ wall: 'far', hinge: [5 * IN, 103 * IN], strike: [37 * IN, 103 * IN], width: 32 * IN }],
    }),
    B: Object.freeze({
      id: 'B', name: 'WC 2', label: "WC 2 5'-1\" x 8'-1\"",
      W: 61 * IN, L: 97 * IN,
      fixtures: [
        { kind: 'vanity', host: 'right', at: [61 * IN, 81.5 * IN], width: 2.5, depth: 2 }, // V30
        { kind: 'toilet', host: 'right', at: [61 * IN, 51.2 * IN], ...TOILET },
        { kind: 'tub' },
      ],
      chase: null,
      // On the long wall opposite the toilet and vanity (Movie: "the entry
      // door will be on the wall opposite the toilet and sink").
      doors: [{ wall: 'left', hinge: [0, 92 * IN], strike: [0, 60 * IN], width: 32 * IN }],
    }),
    // THE BARRIER-FREE WC, off the studio suite. The end wall (v = 0) is the
    // suite's exterior wall with the V42 in its corner, on its own 3 1/2"
    // plumbing wall; the 36 x 72 roll-in shower lies across the far end from
    // the left wall; the toilet is on the left wall 4'-11" in.
    //
    // THE LAUNDRY NOTCH (Movie, 17 Oct, on the S suite sheet): the far
    // corner on the door side is cut out, 42 1/2" x 37" inside, wrapped in
    // 2x4s, for the W/D closet outside the room -- so the room is an L. And
    // the door is a 32" POCKET on the door-side wall, moved down to just
    // above the notch: its pocket runs back towards the vanity end.
    BF1: Object.freeze({
      id: 'BF1', name: 'WC BF1', label: "WC BF1 9'-11\" x 10'-5 1/2\" barrier free, laundry notch",
      W: 119 * IN, L: 125.5 * IN,
      walls: (vT, own) => {
        const W = 119 * IN, L = 125.5 * IN, NU = 74.75 * IN, NV = 86.75 * IN;
        return [
          { key: 'left', a: [-HALF_4, vT], b: [-HALF_4, L + HALF_4] },
          { key: 'far', a: [-HALF_4, L + HALF_4], b: [NU, L + HALF_4] },
          { key: 'notchV', a: [NU, L + HALF_4], b: [NU, NV] },
          { key: 'notchH', a: [NU, NV], b: [W + HALF_4, NV] },
          { key: 'right', a: [W + HALF_4, vT], b: [W + HALF_4, NV] },
          ...(own ? [{ key: 'tub', a: [-HALF_4, -HALF_4], b: [W + HALF_4, -HALF_4] }] : []),
          // Half an inch longer than the V42, so the vanity is never clamped.
          { key: 'plumb', a: [76.5 * IN, HALF_4], b: [W, HALF_4] },
        ];
      },
      spaces: [{ name: 'WC', poly: [[0, 0], [119 * IN, 0], [119 * IN, 85 * IN], [73 * IN, 85 * IN],
        [73 * IN, 125.5 * IN], [0, 125.5 * IN]] }],
      fixtures: [
        { kind: 'vanity', host: 'plumb', at: [98 * IN, STUD_4], width: 3.5, depth: 2 },        // V42
        { kind: 'toilet', host: 'left', at: [0, 59 * IN], ...TOILET },
        { kind: 'shower', host: 'far', at: [36 * IN, 125.5 * IN], width: 6, depth: 3 },   // 36 x 72
      ],
      chase: null,
      doors: [{ wall: 'right', hinge: [119 * IN, 51.5 * IN], strike: [119 * IN, 83.5 * IN], width: 32 * IN,
        style: 'pocket' }],
    }),
    // WC BF2, the 1B suite's "WC 8-10X11-6", and the walk-in "CL 8-10X5"
    // beyond it. The toilet stands on the exterior end; the 42 x 72 tub runs
    // along the right wall from it to a 2x4 stub; past the stub the V60 on
    // its plumbing wall. The D36 is near the end wall and swings OUT; a
    // second D36 goes on into the closet, whose far wall has a 42" cased
    // opening to the bedroom.
    BF2: Object.freeze({
      id: 'BF2', name: 'WC BF2', label: "WC BF2 8'-10\" x 11'-6\" + walk-in closet",
      W: 106 * IN, L: 138 * IN,
      walls: (vT, own) => {
        const W = 106 * IN, L = 138 * IN, CLF = L + STUD_4 + 60 * IN + HALF_4;
        return [
          { key: 'left', a: [-HALF_4, vT], b: [-HALF_4, CLF] },
          { key: 'right', a: [W + HALF_4, vT], b: [W + HALF_4, CLF] },
          { key: 'far', a: [-HALF_4, L + HALF_4], b: [W + HALF_4, L + HALF_4] },
          { key: 'clFarA', a: [-HALF_4, CLF], b: [24 * IN, CLF] },
          { key: 'clFarB', a: [66 * IN, CLF], b: [W + HALF_4, CLF] },
          ...(own ? [{ key: 'tub', a: [-HALF_4, -HALF_4], b: [W + HALF_4, -HALF_4] }] : []),
          { key: 'stub', a: [W - 42 * IN - HALF_4, 72 * IN + HALF_4], b: [W, 72 * IN + HALF_4] },
          { key: 'plumb', a: [W - HALF_4, 72 * IN + STUD_4], b: [W - HALF_4, L] },
        ];
      },
      spaces: [
        { name: 'WC', poly: [[0, 0], [106 * IN, 0], [106 * IN, 138 * IN], [0, 138 * IN]] },
        { name: 'CL', poly: [[0, 141.5 * IN], [106 * IN, 141.5 * IN], [106 * IN, 201.5 * IN], [0, 201.5 * IN]] },
      ],
      fixtures: [
        { kind: 'toilet', host: 'tub', at: [45.5 * IN, 0], ...TOILET },
        { kind: 'tub', host: 'right', endWall: 'stub', faucet: [106 * IN, 72 * IN], far: [106 * IN, 0], width: 6, depth: 3.5 },
        { kind: 'vanity', host: 'plumb', at: [106 * IN - STUD_4, 107.5 * IN], width: 5, depth: 26 * IN },   // V60
      ],
      chase: null,
      doors: [
        { wall: 'left', hinge: [0, 23.5 * IN], strike: [0, 59.5 * IN], width: 36 * IN, swing: 'out' },
        { wall: 'far', hinge: [25 * IN, 138 * IN], strike: [61 * IN, 138 * IN], width: 36 * IN, swing: 'out' },
      ],
    }),
    // WC BF3, the 1BD suite's "WC 14X10-8" with the "CL 8-10X5-6" and the
    // "LAUNDRY 4-4X9-0" (Movie: "in this one we should include the CLOSET and
    // the W/D Laundry closet"). The exterior end is 14' long: the 42 x 72 tub
    // lies along it between two stubs, the toilet past the second; the V48
    // stands on its plumbing wall at the far end. The laundry runs across the
    // top of the room's far half and the closet, washer and dryer on its back
    // wall and a two-leaf door to the hall; the closet opens off the WC by a
    // D36 that swings in, with a cased opening to the bedroom.
    BF3: Object.freeze({
      id: 'BF3', name: 'WC BF3', label: "WC BF3 14' x 10'-8\" + closet + W/D laundry",
      W: 168 * IN, L: 128 * IN,
      walls: (vT, own) => {
        const W = 168 * IN, L = 128 * IN, LB = 53.75 * IN, LL = 102.25 * IN, CLF = 197.75 * IN;
        return [
          { key: 'left', a: [-HALF_4, vT], b: [-HALF_4, CLF] },
          { key: 'right', a: [W + HALF_4, vT], b: [W + HALF_4, CLF] },
          { key: 'lauL', a: [-HALF_4, LL], b: [LB, LL] },
          { key: 'lauB', a: [LB, LL], b: [LB, CLF] },
          { key: 'far', a: [LB, L + HALF_4], b: [W + HALF_4, L + HALF_4] },
          { key: 'clFarA', a: [-HALF_4, CLF], b: [89 * IN, CLF] },
          { key: 'clFarB', a: [133 * IN, CLF], b: [W + HALF_4, CLF] },
          ...(own ? [{ key: 'tub', a: [-HALF_4, -HALF_4], b: [W + HALF_4, -HALF_4] }] : []),
          { key: 'stubA', a: [13.25 * IN, 0], b: [13.25 * IN, 44 * IN] },
          { key: 'stubB', a: [88.75 * IN, 0], b: [88.75 * IN, 44 * IN] },
          { key: 'plumb', a: [W - HALF_4, 79.5 * IN], b: [W - HALF_4, L] },
        ];
      },
      spaces: [
        { name: 'WC', poly: [[0, 0], [168 * IN, 0], [168 * IN, 128 * IN], [55.5 * IN, 128 * IN],
          [55.5 * IN, 100.5 * IN], [0, 100.5 * IN]] },
        { name: 'CL', poly: [[55.5 * IN, 131.5 * IN], [168 * IN, 131.5 * IN], [168 * IN, 196 * IN], [55.5 * IN, 196 * IN]] },
        { name: 'LAUNDRY', poly: [[0, 104 * IN], [52 * IN, 104 * IN], [52 * IN, 196 * IN], [0, 196 * IN]] },
      ],
      fixtures: [
        { kind: 'tub', host: 'tub', endWall: 'stubB', faucet: [87 * IN, 0], far: [15 * IN, 0], width: 6, depth: 3.5 },
        { kind: 'toilet', host: 'tub', at: [111 * IN, 0], ...TOILET },
        { kind: 'vanity', host: 'plumb', at: [168 * IN - STUD_4, 104 * IN], width: 4, depth: 27 * IN },     // V48
        { kind: 'washer', host: 'lauB', at: [52 * IN, 127 * IN], width: 2.5, depth: 2.5 },
        { kind: 'dryer', host: 'lauB', at: [52 * IN, 158 * IN], width: 2.5, depth: 2.5 },
      ],
      chase: null,
      doors: [
        { wall: 'left', hinge: [0, 93.5 * IN], strike: [0, 57.5 * IN], width: 36 * IN, swing: 'out' },
        { wall: 'far', hinge: [129.5 * IN, 128 * IN], strike: [93.5 * IN, 128 * IN], width: 36 * IN },
        { wall: 'left', hinge: [0, 117 * IN], strike: [0, 174 * IN], width: 57 * IN, swing: 'out', style: 'french' },
      ],
    }),
    // WC BF4, the 2BD suite's "WC 9-5X11-6", reached through the "CL 9-5X5"
    // on its back (Movie: "put the closet on the back of this one, include
    // that as part of the 'ASSEMBLY'"). The toilet on the exterior end; the
    // 42 x 72 tub runs away from it along the demising wall to a stub; past
    // it the V60 on its plumbing wall, and a V48 across the room on the
    // kitchen side. The WC's one door is the D36 into the closet; the
    // closet's cased opening is the way in from the bedroom.
    BF4: Object.freeze({
      id: 'BF4', name: 'WC BF4', label: "WC BF4 9'-5\" x 11'-6\" + closet behind",
      W: 113 * IN, L: 138 * IN,
      walls: (vT, own) => {
        const W = 113 * IN, L = 138 * IN, CLF = L + STUD_4 + 60 * IN + HALF_4;
        return [
          { key: 'left', a: [-HALF_4, vT], b: [-HALF_4, CLF] },
          { key: 'right', a: [W + HALF_4, vT], b: [W + HALF_4, CLF] },
          { key: 'far', a: [-HALF_4, L + HALF_4], b: [W + HALF_4, L + HALF_4] },
          { key: 'clFarA', a: [-HALF_4, CLF], b: [29 * IN, CLF] },
          { key: 'clFarB', a: [72 * IN, CLF], b: [W + HALF_4, CLF] },
          ...(own ? [{ key: 'tub', a: [-HALF_4, -HALF_4], b: [W + HALF_4, -HALF_4] }] : []),
          { key: 'stub', a: [W - 42 * IN - HALF_4, 73.5 * IN + HALF_4], b: [W, 73.5 * IN + HALF_4] },
          { key: 'plumb', a: [W - HALF_4, 73.5 * IN + STUD_4], b: [W - HALF_4, L] },
        ];
      },
      spaces: [
        { name: 'WC', poly: [[0, 0], [113 * IN, 0], [113 * IN, 138 * IN], [0, 138 * IN]] },
        { name: 'CL', poly: [[0, 141.5 * IN], [113 * IN, 141.5 * IN], [113 * IN, 201.5 * IN], [0, 201.5 * IN]] },
      ],
      fixtures: [
        { kind: 'toilet', host: 'tub', at: [48.75 * IN, 0], ...TOILET },
        { kind: 'tub', host: 'right', endWall: 'stub', faucet: [113 * IN, 73.5 * IN], far: [113 * IN, 0], width: 6, depth: 3.5 },
        { kind: 'vanity', host: 'plumb', at: [113 * IN - STUD_4, 107.5 * IN], width: 5, depth: 26 * IN },   // V60
        { kind: 'vanity', host: 'left', at: [0, 113.5 * IN], width: 4, depth: 26 * IN },                    // V48
      ],
      chase: null,
      doors: [
        { wall: 'far', hinge: [33.5 * IN, 138 * IN], strike: [69.5 * IN, 138 * IN], width: 36 * IN, swing: 'out' },
      ],
    }),
    // WC BF5, the 2BD suite's second "WC 10-6X5", with the bedroom closet
    // beside it (Movie: "include the closet too"). The 30 x 60 shower fills
    // the end wall; the toilet stands on the wall it shares with the closet;
    // past the closet the room widens into an alcove for the V48. A D36
    // swings out of the room; the closet's two-leaf door opens to the
    // bedroom.
    BF5: Object.freeze({
      id: 'BF5', name: 'WC BF5', label: "WC BF5 5'-1\" x 10'-6\" + closet",
      W: 61 * IN, L: 126 * IN,
      walls: (vT, own) => {
        const W = 61 * IN, L = 126 * IN, CB = 75.25 * IN, R = 90.5 * IN;
        return [
          { key: 'left', a: [-HALF_4, vT], b: [-HALF_4, L + HALF_4] },
          { key: 'part', a: [W + HALF_4, vT], b: [W + HALF_4, CB] },
          { key: 'clB', a: [W + HALF_4, CB], b: [R, CB] },
          { key: 'right', a: [R, vT], b: [R, L + HALF_4] },
          { key: 'far', a: [-HALF_4, L + HALF_4], b: [R, L + HALF_4] },
          ...(own ? [{ key: 'tub', a: [-HALF_4, -HALF_4], b: [R, -HALF_4] }] : []),
        ];
      },
      spaces: [
        { name: 'WC', poly: [[0, 0], [61 * IN, 0], [61 * IN, 77 * IN], [88.75 * IN, 77 * IN],
          [88.75 * IN, 126 * IN], [0, 126 * IN]] },
        { name: 'CL', poly: [[64.5 * IN, 0], [88.75 * IN, 0], [88.75 * IN, 73.5 * IN], [64.5 * IN, 73.5 * IN]] },
      ],
      fixtures: [
        { kind: 'shower', host: 'tub', at: [30.5 * IN, 0], width: 5, depth: 2.5 },             // 30 x 60
        { kind: 'toilet', host: 'part', at: [61 * IN, 50 * IN], ...TOILET },
        { kind: 'vanity', host: 'right', at: [88.75 * IN, 101.75 * IN], width: 4, depth: 25 * IN },  // V48
      ],
      chase: null,
      doors: [
        { wall: 'left', hinge: [0, 81 * IN], strike: [0, 117 * IN], width: 36 * IN, swing: 'out' },
        { wall: 'right', hinge: [88.75 * IN, 15.5 * IN], strike: [88.75 * IN, 66.5 * IN], width: 51 * IN,
          swing: 'out', style: 'french' },
      ],
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
    // A PRESET'S OWN WALLS, or the plain box: left, right, far, its own tub
    // end, and A's 6" wall at the tub's foot. Every wall is a 2x4 unless it
    // says otherwise.
    const walls = (p.walls ? p.walls(vT, own) : (() => {
      const box = [
        { key: 'left', a: [-HALF_4, vT], b: [-HALF_4, L + HALF_4] },
        { key: 'right', a: [W + HALF_4, vT], b: [W + HALF_4, L + HALF_4] },
        { key: 'far', a: [-HALF_4, L + HALF_4], b: [W + HALF_4, L + HALF_4] },
      ];
      if (own) box.push({ key: 'tub', a: [-HALF_4, -HALF_4], b: [W + HALF_4, -HALF_4] });
      if (p.chase) {
        const u = W - STUD_6 / 2;
        box.push({ key: 'chase', a: [u, vT], b: [u, p.chase.lengthFt], wallType: 'stud_2x6' });
      }
      return box;
    })()).map(w => ({ wallType: 'stud_2x4', ...w }));
    const spaces = p.spaces || [{ name: 'WC', poly: [[0, 0], [W, 0], [W, L], [0, L]] }];
    return {
      preset: p,
      walls,
      fixtures: p.fixtures.map(f => (f.kind !== 'tub' || f.faucet ? f
        // The tub's faucet end is the end its drain is at -- the chase in A,
        // the right wall in B -- and it fills the alcove to the left wall.
        // A suite's tub says its own host, end wall and faucet end.
        : { kind: 'tub', host: 'tub', endWall: p.chase ? 'chase' : 'right',
          width: TUB.width, depth: TUB.depth, faucet: [W, 0], far: [0, 0] })),
      doors: p.doors.map(d => ({ host: d.wall, hinge: d.hinge, strike: d.strike, width: d.width,
        swing: d.swing || 'in', style: d.style || 'single' })),
      spaces,
      inside: spaces[0].poly,
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
  // the doors with everything a record needs, measured along the wall they
  // ride: `offset` from the host's start, and `side` -- which face -- read
  // off where the room actually is, so a mirrored or turned room is right
  // without a rule per case. `ext` is the exterior wall the room stands
  // against, or null.
  // THE ROOM'S OWN WALLS ON THEIR INSIDE FACES (Movie, 28 Oct: "for
  // bathrooms this model will be used too - interior corner placement").
  // A 2x4 standing on the room's rectangle -- left, right, far, its own tub
  // end -- is drawn on the face the room sees, its studs outward; every
  // wall end on one of those lines comes in to the face with it, so a
  // partition tees onto the face and the corners are the inside corners.
  // Walls inside the room (a chase, a stub, a plumbing wall) stay on their
  // centrelines.
  function facedWalls(lay, own) {
    const { W, L } = lay.preset;
    const near = (a, b) => Math.abs(a - b) < 1e-6;
    const onU = u => (near(u, -HALF_4) ? 0 : near(u, W + HALF_4) ? W : u);
    const onV = v => (near(v, L + HALF_4) ? L : own && near(v, -HALF_4) ? 0 : v);
    const rim = w => w.wallType === 'stud_2x4' && (
      (near(w.a[0], w.b[0]) && (near(w.a[0], -HALF_4) || near(w.a[0], W + HALF_4)))
      || (near(w.a[1], w.b[1]) && (near(w.a[1], L + HALF_4) || (own && near(w.a[1], -HALF_4)))));
    return lay.walls.map(w => ({ ...w, face: rim(w),
      a: [onU(w.a[0]), onV(w.a[1])], b: [onU(w.b[0]), onV(w.b[1])] }));
  }

  // THE MINI REGISTRATION POINT (Movie, 28 Oct: "sure tub corner"): the
  // inside corner at the tub end on the toilet and vanity side.
  function registrationCorner(lay) {
    const { W } = lay.preset;
    const by = lay.fixtures.find(f => (f.kind === 'vanity' || f.kind === 'toilet') && Array.isArray(f.at));
    return by && by.at[0] < W / 2 ? [0, 0] : [W, 0];
  }

  function place(id, { at, angleDeg = 0, flip = false, ext = null } = {}) {
    const lay = localLayout(id, { tubInsetFt: ext ? ext.insetFt : null });
    if (!lay || !at) return null;
    const P = toWorld(lay.preset, { at, angleDeg, flip });
    const centre = P([lay.preset.W / 2, lay.preset.L / 2]);
    // A faced wall's studs go away from the room: 'left' stands them on the
    // wall's left normal, so a room on that side wants 'right'.
    const walls = facedWalls(lay, !ext).map(w => {
      const wall = { key: w.key, start: P(w.a), end: P(w.b), wallType: w.wallType };
      if (!w.face) return wall;
      const d = unit(wall.start, wall.end);
      const roomLeft = dot({ x: -d.z, z: d.x }, sub(centre, wall.start)) > 0;
      return { ...wall, refLine: roomLeft ? 'right' : 'left' };
    });
    const hostOf = key => (key === 'ext' ? ext && ext.wall : walls.find(w => w.key === key));
    const along = (wall, pt) => dot(sub(pt, wall.start), unit(wall.start, wall.end));
    // +1 when the point is on the wall's left normal (-dz, dx) -- the face
    // fixture-geometry.js calls side 1.
    const sideOf = (wall, pt) => {
      const d = unit(wall.start, wall.end);
      return dot({ x: -d.z, z: d.x }, sub(pt, wall.start)) >= 0 ? 1 : -1;
    };
    const roomSide = wall => sideOf(wall, centre);
    // A FIXTURE FACES THE SPACE IT IS SET IN: its `at` is on the face it
    // stands against, so which side of the wall's line that point lies on is
    // the face -- the room's for a WC fixture, the laundry's for the washer
    // on the laundry's back wall. A point on the line itself asks the room.
    const faceOf = (wall, pt) => {
      const d = unit(wall.start, wall.end);
      const off = dot({ x: -d.z, z: d.x }, sub(pt, wall.start));
      return Math.abs(off) > 1e-6 ? (off > 0 ? 1 : -1) : roomSide(wall);
    };
    // WHAT STANDS ON THE END WALL STANDS ON THE HOUSE'S when the room joins
    // it: the tub in A and B, the toilet in the suites.
    const endKey = key => (key === 'tub' && !lay.walls.some(w => w.key === 'tub') ? 'ext' : key);
    const fixtures = lay.fixtures.map(f => {
      const host = hostOf(endKey(f.host));
      if (!host) return null;
      if (f.kind === 'tub') {
        const toFar = along(host, P(f.far)) - along(host, P(f.faucet));
        return { kind: 'tub', host: endKey(f.host), endWall: endKey(f.endWall), offset: 0,
          width: f.width, depth: f.depth, side: roomSide(host), dir: toFar >= 0 ? 1 : -1 };
      }
      return { kind: f.kind, host: endKey(f.host), offset: along(host, P(f.at)),
        width: f.width, depth: f.depth, side: faceOf(host, P(f.at)) };
    }).filter(Boolean);
    const doors = lay.doors.map(d => {
      const doorHost = hostOf(d.host);
      const hingeAt = along(doorHost, P(d.hinge));
      const strikeAt = along(doorHost, P(d.strike));
      return {
        host: d.host,
        offset: (hingeAt + strikeAt) / 2,
        width: d.width,
        swing: d.swing,
        style: d.style,
        // fixture-geometry's conventions for a door: unflipped, the hinge is
        // at the jamb nearer the wall's start and the leaf swings to the left
        // normal. Into the room, hinged where Movie hung it -- or OUT of it
        // where the preset says so: a barrier-free door swings out, so a fall
        // inside can never block it. A pocket's pocket is on the hinge side.
        hingeFlip: hingeAt > strikeAt,
        swingFlip: d.swing === 'out' ? roomSide(doorHost) === 1 : roomSide(doorHost) !== 1,
      };
    });
    return {
      id, name: lay.preset.name, walls, fixtures, doors, door: doors[0], centre,
      registration: P(registrationCorner(lay)),
      inside: lay.inside.map(P),
      spaces: lay.spaces.map(sp => ({ name: sp.name, poly: sp.poly.map(P) })),
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
