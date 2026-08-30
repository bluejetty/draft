#!/usr/bin/env node
// ROOM GROWING — the offline harness (boards #275/#276, #290).
//
// room-grow.js is a pure module, so its rules are checked here in node
// against real ring geometry instead of through the browser: fast enough
// to run on every edit, and it can assert things a paint-scan cannot —
// that no claim, wall, or corridor leaves the outline polygon.
//
//   node proto/room-grow-harness.js
//
// Exit code 0 = every check passed. The Playwright specs pin the commit
// layer (tests/room-grow.spec.js); this pins the math.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = {};
['room-standards.js', 'geometry-2d.js', 'room-grow.js'].forEach(file => {
  (0, eval)(fs.readFileSync(path.join(ROOT, file), 'utf8'));
});
const G = window.DraftRoomGrow;

let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};
const eq = (name, actual, expected) => check(name,
  JSON.stringify(actual) === JSON.stringify(expected),
  `expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`);

// ── Ring geometry helpers (the harness's own, independent of the module) ──
const inRing = (ring, pt) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    if ((a.z > pt.z) !== (b.z > pt.z)
      && pt.x < a.x + (b.x - a.x) * (pt.z - a.z) / (b.z - a.z)) inside = !inside;
  }
  return inside;
};
const distToRing = (ring, pt) => {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j], b = ring[i];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.z - a.z) * dz) / len2));
    best = Math.min(best, Math.hypot(pt.x - (a.x + dx * t), pt.z - (a.z + dz * t)));
  }
  return best;
};
// Inside, or on the boundary within half a 2x4 wall — a claim edge that
// lands on the exterior wall face is inside the building.
const WALL_TOL = 3.5 / 24;
const insideOrOn = (ring, pt) => inRing(ring, pt) || distToRing(ring, pt) <= WALL_TOL;
const strictlyInside = (ring, pt) => inRing(ring, pt) && distToRing(ring, pt) > WALL_TOL;
const rectProbes = r => [
  { x: r.x0, z: r.z0 }, { x: r.x1, z: r.z0 }, { x: r.x1, z: r.z1 }, { x: r.x0, z: r.z1 },
  { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 },
];
const rectOf = poly => ({
  x0: Math.min(...poly.map(p => p.x)), x1: Math.max(...poly.map(p => p.x)),
  z0: Math.min(...poly.map(p => p.z)), z1: Math.max(...poly.map(p => p.z)),
});
const overlapSqFt = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0));

// ── Footprints ────────────────────────────────────────────────────────
const rect = (w, d) => [
  { x: -w / 2, z: -d / 2 }, { x: w / 2, z: -d / 2 },
  { x: w / 2, z: d / 2 }, { x: -w / 2, z: d / 2 },
];
const well = (x, z, w = 3.5, d = 10) => [
  { x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d },
];
// An L: 40x30 with the 20x15 south-east quarter cut away.
const L_RING = [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 15 },
  { x: 40, z: 15 }, { x: 40, z: 30 }, { x: 0, z: 30 }];
// A T: a 40x15 bar across the north, a 10x15 stem hanging south.
const T_RING = [{ x: 15, z: 0 }, { x: 25, z: 0 }, { x: 25, z: 15 }, { x: 40, z: 15 },
  { x: 40, z: 30 }, { x: 0, z: 30 }, { x: 0, z: 15 }, { x: 15, z: 15 }];
// A U: 40x30 with a 10x20 bite out of the south middle.
const U_RING = [{ x: 0, z: 0 }, { x: 15, z: 0 }, { x: 15, z: 20 }, { x: 25, z: 20 },
  { x: 25, z: 0 }, { x: 40, z: 0 }, { x: 40, z: 30 }, { x: 0, z: 30 }];

// ── 1. #276 numbering ─────────────────────────────────────────────────
{
  const tags = [
    { id: 1, base: 'BEDROOM 1', levelId: 3 },
    { id: 2, base: 'BEDROOM', levelId: 3 },
    { id: 3, base: 'WC', levelId: 3 },
    { id: 4, base: 'BEDROOM', levelId: 5 },
    { id: 5, base: 'WC', levelId: 5 },
    { id: 6, base: 'BEDROOM', levelId: 1 },
    { id: 7, base: 'WC', levelId: 1 },
    { id: 8, base: 'KITCHEN', levelId: 3 },
  ];
  const names = G.assignStampNumbers(tags);
  eq('numbering: the primary is BEDROOM 1', names.get(1), 'BEDROOM 1');
  eq('numbering: ordinary bedrooms start at 2', names.get(2), 'BEDROOM 2');
  eq('numbering: the ladder runs house-wide, never restarting per floor', names.get(4), 'BEDROOM 3');
  eq('numbering: WC starts at 1', names.get(3), 'WC 1');
  eq('numbering: WC continues upstairs', names.get(5), 'WC 2');
  eq('numbering: the basement runs its own B-series bedroom', names.get(6), 'BEDROOM B1');
  eq('numbering: the basement runs its own B-series WC', names.get(7), 'WC B1');
  check('numbering: other bases are left to the per-floor machinery', !names.has(8));

  const claimed = G.assignStampNumbers([
    { id: 1, base: 'BEDROOM', levelId: 3, claimedNo: 4 },
    { id: 2, base: 'BEDROOM', levelId: 3 },
    { id: 3, base: 'BEDROOM', levelId: 3 },
  ]);
  eq('numbering: a claimed number is kept', claimed.get(1), 'BEDROOM 4');
  eq('numbering: the ladder skips a claimed number', [claimed.get(2), claimed.get(3)],
    ['BEDROOM 2', 'BEDROOM 3']);

  // A number belongs to ONE tag per series: the earliest claimant (stamp
  // order) keeps it, the later duplicate falls back onto the ladder.
  const dupBeds = G.assignStampNumbers([
    { id: 1, base: 'BEDROOM', levelId: 3, claimedNo: 4 },
    { id: 2, base: 'BEDROOM', levelId: 5, claimedNo: 4 },
    { id: 3, base: 'BEDROOM', levelId: 3 },
  ]);
  eq('duplicate claim: the earliest bedroom claimant keeps the number',
    dupBeds.get(1), 'BEDROOM 4');
  eq('duplicate claim: the later bedroom claimant falls to the ladder',
    dupBeds.get(2), 'BEDROOM 2');
  eq('duplicate claim: unclaimed bedrooms are untouched', dupBeds.get(3), 'BEDROOM 3');

  const dupWcs = G.assignStampNumbers([
    { id: 1, base: 'WC', levelId: 3, claimedNo: 3 },
    { id: 2, base: 'WC', levelId: 3, claimedNo: 3 },
  ]);
  eq('duplicate claim: WC series honors the earliest claimant', dupWcs.get(1), 'WC 3');
  eq('duplicate claim: the later WC claimant takes the next free rung', dupWcs.get(2), 'WC 1');

  // The basement series resolves its own duplicates, independent of the
  // above-grade ladders.
  const dupBasement = G.assignStampNumbers([
    { id: 1, base: 'BEDROOM', levelId: 1, claimedNo: 2 },
    { id: 2, base: 'BEDROOM', levelId: 1, claimedNo: 2 },
    { id: 3, base: 'WC', levelId: 1, claimedNo: 1 },
    { id: 4, base: 'WC', levelId: 1, claimedNo: 1 },
  ]);
  eq('duplicate claim: basement bedrooms resolve to distinct numbers',
    [dupBasement.get(1), dupBasement.get(2)], ['BEDROOM B2', 'BEDROOM B1']);
  eq('duplicate claim: basement WCs resolve to distinct numbers',
    [dupBasement.get(3), dupBasement.get(4)], ['WC B1', 'WC B2']);
}

// ── 2. The one primary ────────────────────────────────────────────────
{
  eq('primary: allowed on an empty house',
    G.primaryAllowed([], { levelId: 3 }), { ok: true });
  eq('primary: refused in the basement',
    G.primaryAllowed([], { levelId: 1 }), { ok: false, reason: 'basement' });
  eq('primary: refused while one stands',
    G.primaryAllowed([{ base: 'BEDROOM 1' }], { levelId: 3 }),
    { ok: false, reason: 'standing' });
}

// ── 3. The live WC fixture suffix ─────────────────────────────────────
{
  eq('wc suffix: nothing in the room', G.wcSuffix([]), '');
  eq('wc suffix: a tub reads /B', G.wcSuffix(['toilet', 'tub']), '/B');
  eq('wc suffix: a shower reads /S', G.wcSuffix(['shower']), '/S');
  eq('wc suffix: a stall IS a shower', G.wcSuffix(['stall']), '/S');
  eq('wc suffix: both read /BS', G.wcSuffix(['tub', 'stall']), '/BS');
}

// ── 4. Rectangles are pinned: board #290 changed the partition, and a
//      rectangle's output must not have moved by a thousandth.
const RECT_CASES = {
  'rect 28x22, four stamps, one well': { points: rect(28, 22), stairWells: [well(0.5, -5)],
    stamps: [{ id: 1, base: 'KITCHEN', x: -9, z: -7 }, { id: 2, base: 'LIVING', x: 9, z: -7 },
      { id: 3, base: 'BEDROOM 1', x: -9, z: 7 }, { id: 4, base: 'BATH', x: 9, z: 7 }] },
  'rect 24x18, two stamps, no well': { points: rect(24, 18), stairWells: [],
    stamps: [{ id: 1, base: 'KITCHEN', x: -7, z: -5 }, { id: 2, base: 'BEDROOM', x: 7, z: 5 }] },
  'rect 24x18, bedroom with companions': { points: rect(24, 18), stairWells: [],
    stamps: [{ id: 1, base: 'BEDROOM 1', x: -6, z: 5 },
      { id: 2, base: 'WALK-IN', x: -6, z: 7, companionOf: 1 },
      { id: 3, base: 'KITCHEN', x: 6, z: -5 }] },
  'tall rect 18x28 (flips axis)': { points: rect(18, 28), stairWells: [],
    stamps: [{ id: 1, base: 'KITCHEN', x: -5, z: -9 }, { id: 2, base: 'BEDROOM', x: 5, z: 9 }] },
  'rect 30x24, five stamps, well at the end': { points: rect(30, 24), stairWells: [well(-14, -4)],
    stamps: [{ id: 1, base: 'KITCHEN', x: -5, z: -8 }, { id: 2, base: 'DINING', x: 5, z: -8 },
      { id: 3, base: 'BEDROOM 1', x: -5, z: 8 }, { id: 4, base: 'BEDROOM', x: 5, z: 8 },
      { id: 5, base: 'WC', x: 12, z: 8 }] },
};
// Recorded from the module as it stood before board #290 — the rectangle
// behaviour the 15 focused specs already lock in.
const RECT_PINS = {
    "rect 28x22, four stamps, one well": {
      "walls": [
        [
          -14,
          -1.6667,
          14,
          -1.6667
        ],
        [
          -14,
          1.3333,
          14,
          1.3333
        ],
        [
          0.5,
          -11,
          0.5,
          -1.6667
        ],
        [
          0.5,
          1.3333,
          0.5,
          11
        ],
        [
          4,
          -11,
          4,
          -1.6667
        ],
        [
          4,
          1.3333,
          4,
          11
        ]
      ],
      "rooms": [
        [
          1,
          "KITCHEN",
          -14,
          -11,
          0.5,
          -1.6667,
          135.3333,
          9.3333,
          false,
          false
        ],
        [
          2,
          "LIVING",
          4,
          -11,
          14,
          -1.6667,
          93.3333,
          9.3333,
          false,
          false
        ],
        [
          3,
          "BEDROOM 1",
          -14,
          1.3333,
          0.5,
          11,
          140.1667,
          9.6667,
          false,
          false
        ],
        [
          4,
          "BATH",
          4,
          1.3333,
          14,
          11,
          96.6667,
          9.6667,
          false,
          false
        ]
      ],
      "corridor": [
        -14,
        -1.6667,
        14,
        1.3333
      ],
      "report": [
        "the floor cannot fit every stamp at minimums — smallest rooms pinned, remainder flagged"
      ]
    },
    "rect 24x18, two stamps, no well": {
      "walls": [
        [
          -12,
          -1.5,
          12,
          -1.5
        ],
        [
          -12,
          1.5,
          12,
          1.5
        ]
      ],
      "rooms": [
        [
          1,
          "KITCHEN",
          -12,
          -9,
          12,
          -1.5,
          180,
          7.5,
          false,
          false
        ],
        [
          2,
          "BEDROOM",
          -12,
          1.5,
          12,
          9,
          180,
          7.5,
          true,
          false
        ]
      ],
      "corridor": [
        -12,
        -1.5,
        12,
        1.5
      ],
      "report": []
    },
    "rect 24x18, bedroom with companions": {
      "walls": [
        [
          -12,
          -3.6667,
          12,
          -3.6667
        ],
        [
          -12,
          -0.6667,
          12,
          -0.6667
        ],
        [
          -12,
          3,
          -8,
          3
        ],
        [
          -8,
          3,
          -8,
          9
        ]
      ],
      "rooms": [
        [
          1,
          "BEDROOM 1",
          -12,
          -0.6667,
          12,
          9,
          232,
          9.6667,
          false,
          false
        ],
        [
          2,
          "WALK-IN",
          -12,
          3,
          -8,
          9,
          24,
          4,
          false,
          true
        ],
        [
          3,
          "KITCHEN",
          -12,
          -9,
          12,
          -3.6667,
          128,
          5.3333,
          false,
          false
        ]
      ],
      "corridor": [
        -12,
        -3.6667,
        12,
        -0.6667
      ],
      "report": []
    },
    "tall rect 18x28 (flips axis)": {
      "walls": [
        [
          -1.5,
          -14,
          -1.5,
          14
        ],
        [
          1.5,
          -14,
          1.5,
          14
        ]
      ],
      "rooms": [
        [
          1,
          "KITCHEN",
          -9,
          -14,
          -1.5,
          14,
          210,
          7.5,
          false,
          false
        ],
        [
          2,
          "BEDROOM",
          1.5,
          -14,
          9,
          14,
          210,
          7.5,
          true,
          false
        ]
      ],
      "corridor": [
        -1.5,
        -14,
        1.5,
        14
      ],
      "report": []
    },
    "rect 30x24, five stamps, well at the end": {
      "walls": [
        [
          -15,
          -0.6667,
          15,
          -0.6667
        ],
        [
          -15,
          2.3333,
          15,
          2.3333
        ],
        [
          -10.5,
          -12,
          -10.5,
          -0.6667
        ],
        [
          -10.5,
          2.3333,
          -10.5,
          12
        ],
        [
          -0.1786,
          -12,
          -0.1786,
          -0.6667
        ],
        [
          2.5862,
          2.3333,
          2.5862,
          12
        ],
        [
          8.3489,
          2.3333,
          8.3489,
          12
        ]
      ],
      "rooms": [
        [
          1,
          "KITCHEN",
          -10.5,
          -12,
          -0.1786,
          -0.6667,
          116.9762,
          10.3214,
          false,
          false
        ],
        [
          2,
          "DINING",
          -0.1786,
          -12,
          15,
          -0.6667,
          172.0238,
          11.3333,
          false,
          false
        ],
        [
          3,
          "BEDROOM 1",
          -10.5,
          2.3333,
          2.5862,
          12,
          126.5,
          9.6667,
          false,
          false
        ],
        [
          4,
          "BEDROOM",
          2.5862,
          2.3333,
          8.3489,
          12,
          55.7062,
          5.7627,
          true,
          false
        ],
        [
          5,
          "WC",
          8.3489,
          2.3333,
          15,
          12,
          64.2938,
          6.6511,
          false,
          false
        ]
      ],
      "corridor": [
        -15,
        -0.6667,
        15,
        2.3333
      ],
      "report": [
        "the floor cannot fit every stamp at minimums — smallest rooms pinned, remainder flagged"
      ]
    }
  };
const r4 = value => Math.round(value * 10000) / 10000;
const shape = plan => ({
  walls: plan.walls.map(w => [r4(w.start.x), r4(w.start.z), r4(w.end.x), r4(w.end.z)])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]),
  rooms: plan.rooms.map(rm => [rm.stampId, rm.base, r4(rm.rect.x0), r4(rm.rect.z0),
    r4(rm.rect.x1), r4(rm.rect.z1), r4(rm.insideSqFt), r4(rm.minDimensionFt),
    rm.underMin === true, rm.companion === true])
    .sort((a, b) => a[0] - b[0] || String(a[1]).localeCompare(String(b[1]))),
  corridor: plan.corridor
    ? [r4(plan.corridor.x0), r4(plan.corridor.z0), r4(plan.corridor.x1), r4(plan.corridor.z1)]
    : null,
  report: plan.report.slice().sort(),
});
Object.entries(RECT_CASES).forEach(([name, input]) => {
  eq(`rectangle unchanged: ${name}`, shape(G.growRooms(input)), RECT_PINS[name]);
});

// ── 5. Board #290: nothing leaves the polygon ─────────────────────────
const containment = (name, ring, input) => {
  const plan = G.growRooms({ points: ring, ...input });
  const strays = [];
  plan.rooms.forEach(room => rectProbes(room.rect).forEach(pt => {
    if (!insideOrOn(ring, pt)) strays.push(`room ${room.base} corner (${r4(pt.x)}, ${r4(pt.z)})`);
  }));
  plan.walls.forEach(wall => {
    [wall.start, wall.end, { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 }]
      .forEach(pt => {
        if (!insideOrOn(ring, pt)) strays.push(`wall point (${r4(pt.x)}, ${r4(pt.z)})`);
      });
  });
  (plan.corridorSpans || []).forEach(span => rectProbes(span).forEach(pt => {
    if (!insideOrOn(ring, pt)) strays.push(`corridor corner (${r4(pt.x)}, ${r4(pt.z)})`);
  }));
  check(`${name}: every claim, wall and corridor lies inside the outline`,
    strays.length === 0, strays.slice(0, 4).join('; '));
  // A wall lying ON the outline would double the exterior wall (#290 rule 6).
  const onFace = plan.walls.filter(wall => !strictlyInside(ring,
    { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 }));
  check(`${name}: no grown wall sits on an exterior wall face`, onFace.length === 0,
    onFace.slice(0, 3).map(w => `(${r4(w.start.x)},${r4(w.start.z)})-(${r4(w.end.x)},${r4(w.end.z)})`).join('; '));
  return plan;
};

const L_STAMPS = [{ id: 1, base: 'KITCHEN', x: 6, z: 6 },
  { id: 2, base: 'BEDROOM 1', x: 6, z: 24 }, { id: 3, base: 'BEDROOM', x: 30, z: 24 }];
const T_STAMPS = [{ id: 1, base: 'KITCHEN', x: 20, z: 6 },
  { id: 2, base: 'BEDROOM 1', x: 8, z: 24 }, { id: 3, base: 'BEDROOM', x: 32, z: 24 }];
const U_STAMPS = [{ id: 1, base: 'KITCHEN', x: 6, z: 6 },
  { id: 2, base: 'BEDROOM', x: 33, z: 6 }, { id: 3, base: 'BEDROOM 1', x: 20, z: 26 }];

const lPlan = containment('L footprint', L_RING, { stamps: L_STAMPS, stairWells: [] });
const tPlan = containment('T footprint', T_RING, { stamps: T_STAMPS, stairWells: [] });
const uPlan = containment('U footprint', U_RING, { stamps: U_STAMPS, stairWells: [] });

// The notch is the whole point: nothing may stand in it.
const notch = { x0: 20, x1: 40, z0: 0, z1: 15 };
check('L footprint: no claim reaches into the notch',
  lPlan.rooms.every(room => overlapSqFt(room.rect, notch) < 0.01),
  lPlan.rooms.map(r => `${r.base} ${JSON.stringify(r.rect)}`).join('; '));
check('L footprint: the corridor stops at the notch',
  (lPlan.corridorSpans || []).every(span => span.x1 <= 20 + WALL_TOL));
check('L footprint: every stamp still got a claim',
  L_STAMPS.every(stamp => lPlan.rooms.some(room => room.stampId === stamp.id)));
check('T footprint: every stamp still got a claim',
  T_STAMPS.every(stamp => tPlan.rooms.some(room => room.stampId === stamp.id)));
check('U footprint: every stamp still got a claim',
  U_STAMPS.every(stamp => uPlan.rooms.some(room => room.stampId === stamp.id)));

// ── 6. A leg the spine cannot reach is REPORTED, never silent ─────────
check('L footprint: the unreached leg is reported',
  lPlan.report.some(line => /corridor does not reach/.test(line)), JSON.stringify(lPlan.report));
check('U footprint: the split corridor is reported',
  uPlan.report.some(line => /corridor comes in pieces/.test(line)), JSON.stringify(uPlan.report));

// ── 7. Stair wells keep carving, in the body and in a leg ─────────────
const wellCase = (name, ring, wellPoly, stamps) => {
  const plan = containment(name, ring, { stamps, stairWells: [wellPoly] });
  const wr = rectOf(wellPoly);
  const intruders = plan.rooms.filter(room => overlapSqFt(room.rect, wr) > 0.5);
  check(`${name}: the stair well stays clear of every claim`, intruders.length === 0,
    intruders.map(r => `${r.base} ${JSON.stringify(r.rect)}`).join('; '));
  return plan;
};
wellCase('L + well in the body', L_RING, well(8, 10), L_STAMPS);
const legWell = wellCase('L + well in the leg', L_RING, well(30, 17),
  [{ id: 1, base: 'KITCHEN', x: 6, z: 6 }, { id: 2, base: 'BEDROOM 1', x: 6, z: 24 },
    { id: 3, base: 'BEDROOM', x: 36, z: 24 }]);
check('L + well in the leg: the leg still grew its room',
  legWell.rooms.some(room => room.rect.x0 >= 25), JSON.stringify(legWell.rooms.map(r => r.rect)));
wellCase('T + well in the stem', T_RING, well(18, 8), T_STAMPS);
wellCase('U + well in a leg', U_RING, well(3, 8), U_STAMPS);

// ── 8. Odd rings are survived, and nothing leaves silently ────────────
{
  // A floor with no room for a band at all keeps its stamps unseated —
  // and SAYS so, instead of quietly growing nothing.
  const tiny = G.growRooms({ points: rect(8, 6), stamps: [{ id: 1, base: 'KITCHEN', x: 0, z: 0 }] });
  eq('tiny floor: no claims', tiny.rooms.length, 0);
  check('tiny floor: the unseated stamp is reported',
    tiny.report.some(line => /no room/.test(line)), JSON.stringify(tiny.report));

  // A slanted edge (a bulge read by its chord for v1) is ordinary ring.
  const slant = [{ x: 0, z: 0 }, { x: 30, z: 0 }, { x: 40, z: 8 }, { x: 40, z: 26 }, { x: 0, z: 26 }];
  containment('slanted edge', slant, {
    stamps: [{ id: 1, base: 'KITCHEN', x: 8, z: 6 }, { id: 2, base: 'BEDROOM 1', x: 8, z: 20 },
      { id: 3, base: 'BEDROOM', x: 30, z: 20 }],
    stairWells: [],
  });

  // Winding and duplicate points must not matter.
  const reversed = [...L_RING].reverse();
  const cwPlan = containment('L, clockwise ring', reversed, { stamps: L_STAMPS, stairWells: [] });
  eq('L, clockwise ring: same claim count as counter-clockwise',
    cwPlan.rooms.length, lPlan.rooms.length);
  const doubled = [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 15 },
    { x: 40, z: 15 }, { x: 40, z: 30 }, { x: 0, z: 30 }];
  containment('L with a repeated ring point', doubled,
    { stamps: L_STAMPS, stairWells: [] });

  // A stamp standing where no band reaches packs into the nearest stretch
  // and says so — never into the notch.
  const stray = G.growRooms({ points: L_RING, stairWells: [],
    stamps: [{ id: 1, base: 'KITCHEN', x: 38, z: 16 }, { id: 2, base: 'BEDROOM 1', x: 5, z: 25 }] });
  check('a stamp outside every band stretch is reported',
    stray.report.some(line => /no band stretch reaches/.test(line)), JSON.stringify(stray.report));
  check('a stray stamp still lands inside the outline',
    stray.rooms.every(room => rectProbes(room.rect).every(pt => insideOrOn(L_RING, pt))));
}

// ── 9. Degenerate input is refused, not crashed ───────────────────────
{
  eq('no region', G.growRooms({ points: [], stamps: [{ id: 1, base: 'KITCHEN', x: 0, z: 0 }] }).report,
    ['no region']);
  eq('no stamps', G.growRooms({ points: rect(24, 18), stamps: [] }).report, ['no stamps']);
}

// ── Report ────────────────────────────────────────────────────────────
console.log(`room-grow harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
