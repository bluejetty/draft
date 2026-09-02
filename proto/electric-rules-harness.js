#!/usr/bin/env node
// ELECTRIC RULES — the offline harness.
//
// electric-rules.js is pure, so its rules are checked here in node against
// real geometry instead of through a browser: fast enough to run on every
// edit, and it can assert things no paint-scan could.
//
//   node proto/electric-rules-harness.js
//
// Exit 0 = every check passed.
const R = require('../electric-rules.js');

let failures = 0;
const check = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failures += 1; console.log(`FAIL  ${name}\n        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); }
  else console.log(`ok    ${name}`);
};
const near = (name, got, want, tol = 0.01) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) { failures += 1; console.log(`FAIL  ${name}\n        got ${got}, want ${want} +-${tol}`); }
  else console.log(`ok    ${name}`);
};

const rect = (x0, z0, x1, z1) => [
  { x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 },
];

// ── Rule 1: a room with one light centres it ────────────────────────────
{
  const room = { id: 'BED1', polygon: rect(0, 0, 12, 10) };
  const [light] = R.lightCandidates(room);
  near('rule 1: a single light centres in x', light.x, 6);
  near('rule 1: a single light centres in z', light.z, 5);
}

// An L-shaped room: the AREA centroid, not the average of the corners, which
// drifts toward whichever leg carries more vertices.
{
  const L = [
    { x: 0, z: 0 }, { x: 12, z: 0 }, { x: 12, z: 4 },
    { x: 5, z: 4 }, { x: 5, z: 10 }, { x: 0, z: 10 },
  ];
  const [light] = R.lightCandidates({ id: 'L', polygon: L });
  const cornerAvg = { x: L.reduce((s, p) => s + p.x, 0) / 6, z: L.reduce((s, p) => s + p.z, 0) / 6 };
  const differs = Math.abs(light.x - cornerAvg.x) > 0.2 || Math.abs(light.z - cornerAvg.z) > 0.2;
  check('rule 1: an L uses the area centroid, not the corner average', differs, true);
  check('rule 1: and the centre is inside the L', R.contains(L, light), true);
}

// ── Rule 3: THE PARTY WALL ──────────────────────────────────────────────
// The case that separates the direction rule from nearest-by-distance. A
// rule that is only correct in the easy case is not implemented.
{
  // Two rooms sharing the wall at x = 10. The light sits in room A, hard up
  // against that wall. Room B's gang is much closer to it than room A's.
  const rooms = [
    { id: 'A', polygon: rect(0, 0, 10, 10), entry: { wallId: 'wA', offset: 1, side: 'in' } },
    { id: 'B', polygon: rect(10, 0, 20, 10), entry: { wallId: 'wB', offset: 1, side: 'in' } },
  ];
  const light = { x: 9.5, z: 5 };               // in A, 0.5 ft off the party wall
  const gangA = { x: 0.5, z: 5 };               // ~9 ft away
  const gangB = { x: 10.5, z: 5 };              // ~1 ft away -- the trap

  const nearest = Math.hypot(light.x - gangA.x, light.z - gangA.z)
    <= Math.hypot(light.x - gangB.x, light.z - gangB.z) ? 'wA' : 'wB';
  check('the trap is live: nearest-by-distance would pick the NEXT room', nearest, 'wB');

  const chosen = R.switchForLight(light, rooms);
  check('rule 3: the light is switched by the room that HOLDS it', chosen.wallId, 'wA');
  check('rule 3: and not by the nearer gang next door', chosen.wallId === 'wB', false);
}

// A light outside every room answers to no switch rather than the closest one.
{
  const rooms = [{ id: 'A', polygon: rect(0, 0, 10, 10), entry: { wallId: 'wA', offset: 1 } }];
  check('a light in no room takes no switch', R.switchForLight({ x: 50, z: 50 }, rooms), null);
}

// ── Banks are derived, and one switch per bank is true by definition ─────
{
  const lights = [
    { id: 1, roomId: 'K', switchId: 's1' }, { id: 2, roomId: 'K', switchId: 's1' },
    { id: 3, roomId: 'K', switchId: 's1' }, { id: 4, roomId: 'K', switchId: 's1' },
    { id: 5, roomId: 'K', switchId: 's2' },
  ];
  const banks = R.banksOf(lights);
  check('four pot lights on one switch are ONE bank, not four', banks.length, 2);
  check('the bank of four holds its four lights', banks[0].lights.length, 4);
  check('rule 2: the gang count is the room\'s bank count, derived', R.gangCountFor('K', lights), 2);

  // Deleting the last light of a bank makes the bank stop existing. Nothing
  // is swept, because there was never a record to sweep -- which is the
  // whole reason the bank is derived rather than stored.
  const afterDelete = lights.filter(l => l.switchId !== 's2');
  check('the last deletion makes a bank vanish, leaving no orphan',
    R.banksOf(afterDelete).length, 1);
}

// ── Rule 4: outlets sit ON the wall face ────────────────────────────────
{
  const wall = { id: 'w1', start: { x: 0, z: 0 }, end: { x: 18, z: 0 } };
  const outs = R.outletCandidates(wall);
  check('rule 4: every outlet is wall-hosted, an offset with no geometry',
    outs.every(o => o.host === 'wall' && o.wallId === 'w1' && typeof o.offset === 'number'
      && o.x === undefined && o.z === undefined), true);
  check('rule 4: stations stay on the wall run', outs.every(o => o.offset > 0 && o.offset < 18), true);
  const gaps = outs.slice(1).map((o, i) => o.offset - outs[i].offset);
  check('rule 4: spacing sits in the measured 4-8 ft band',
    gaps.every(g => g >= 4 && g <= 8), true);
}

// ── Rule 5: spacing candidates, and NO invented grid ────────────────────
{
  const room = { id: 'KIT', polygon: rect(0, 0, 14, 12) };
  check('no grid is invented: the build offers ONE centred light',
    R.candidates({ rooms: [room], walls: [] }).lights.length, 1);

  const spaced = R.spacingCandidates(room, [{ x: 7, z: 6 }]);
  check('rule 5: adding a second offers spacing candidates', spaced.length > 0, true);
  check('rule 5: every candidate is inside the room',
    spaced.every(p => R.contains(room.polygon, p)), true);
  const d = Math.hypot(spaced[0].x - 7, spaced[0].z - 6);
  check('rule 5: at the measured 5-7 ft', d >= 5 && d <= 7, true);
}

// ── Generate accepts every candidate, and flags them as the build's ─────
{
  const house = {
    rooms: [{ id: 'A', polygon: rect(0, 0, 10, 10), entry: { wallId: 'wA', offset: 1, side: 'in' } }],
    walls: [{ id: 'wA', start: { x: 0, z: 0 }, end: { x: 10, z: 0 } }],
  };
  const built = R.generate(house);
  check('generate is accepting every candidate', built.lights.length,
    R.candidates(house).lights.length);
  check('every generated device is the build\'s, so a re-deal replaces its own work',
    [...built.lights, ...built.gangs, ...built.outlets].every(d => d.auto === true), true);
  check('the gang carries one switch per bank', built.gangs[0].switches, 1);
}

// ── The magnet and the generator are the same answer ────────────────────
// The whole reason the rules live in a module: generate asks "what goes
// here", the magnet asks "where would it have gone". If those two ever
// disagree, a hand-added plan drifts from a built one -- which is the drift
// the module exists to prevent, so it is worth asserting rather than
// assuming.
{
  const house = {
    rooms: [{ id: 'A', polygon: rect(0, 0, 12, 10), entry: { wallId: 'wA', offset: 1, side: 'in' } }],
    walls: [{ id: 'wA', start: { x: 0, z: 0 }, end: { x: 12, z: 0 } }],
  };
  const built = R.generate(house);
  const offered = R.candidates(house);

  check('the magnet offers exactly what the build placed: lights',
    offered.lights.map(l => [l.x, l.z]), built.lights.map(l => [l.x, l.z]));
  check('the magnet offers exactly what the build placed: outlets',
    offered.outlets.map(o => [o.wallId, o.offset]), built.outlets.map(o => [o.wallId, o.offset]));

  // And a device added by hand at the offered position lands where the build
  // would have put it -- same rule, same answer, no drift.
  const byHand = offered.lights[0];
  const byBuild = built.lights[0];
  near('a hand-added light lands where the build would have put it (x)', byHand.x, byBuild.x);
  near('a hand-added light lands where the build would have put it (z)', byHand.z, byBuild.z);
}

console.log(failures ? `\n${failures} FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
