#!/usr/bin/env node
// TRACED PLANS (traced-plans.js), offline.
//
// Movie, 3 Oct, BONEYARD PR 3: the drafter traces the main floor, then the
// garage, and the bone builds "like the premade houses". His rulings:
//
//   ROOFS       bungalow + garage, and 2 STOREY + room over: ONE roof;
//               a garage on a lower plate keeps its own
//   THE ENTRY   a bilevel's 12 x 6 landing straddles the garage line; with no
//               garage it is centred on the front wall
//   ROOM OVER   18 ft of the garage at the house end
//   OPENINGS    auto-windows.js's rules: a front door clear of the garage,
//               the overhead door on the street face
//
// The house and garage here are the premade bungalow's own -- 32 x 40 and a
// 24 x 26 garage four feet past its right corner -- so every traced answer
// can be checked against the premade's.
//
// Run: node proto/traced-plans-harness.js [--mutate]
const path = require('path');
const H = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

const MUTATIONS = [
  ['the MOD BILEVEL room roof stops at the room', 'traced-plans.js',
    c => c.replace('plan.overGarageRoof = P().squareOver(over.room, plan.upperLanding);', 'plan.overGarageRoof = over.room;')],
  ['the bungalow + garage is roofed apart', 'traced-plans.js',
    c => c.replace('const one = unionLoops(H, Graw);', 'const one = null;')],
  ['the dropped garage shares the house roof', 'traced-plans.js',
    c => c.replace('      plan.houseRoof = H;\n      plan.garageRoof = Graw;\n      plan.garageRoofHouseEnd = flushEdge(Graw, H);',
      '      plan.houseRoof = unionLoops(H, Graw) || H;\n      plan.garageRoof = null;\n      plan.garageRoofHouseEnd = flushEdge(Graw, H);')],
  ['the entry ignores the garage line', 'traced-plans.js',
    c => c.replace('if (gLo > lo + TOL) { line = gLo; mirror = false; }', 'if (false) { line = gLo; mirror = false; }')],
  ['the room takes the whole garage', 'traced-plans.js',
    c => c.replace('const d = Math.min(ROOM_OVER_GARAGE_FT, depth);', 'const d = depth;')],
  ['the overhead door takes the longest run, not the street', 'traced-plans.js',
    c => c.replace('manDoorFaceIndex: joint ? joint.index : null,', 'manDoorFaceIndex: null,')],
  ['no front door', 'traced-plans.js',
    c => c.replace('if (spot) {\n        const centre', 'if (false) {\n        const centre')],
  ['the shared stretch is not split out, so a wall is raised twice', 'traced-plans.js',
    c => c.replace('const Gr = Graw ? splitAt(Graw, H) : null;', 'const Gr = Graw;')],
  ['the landing is not cut out of the house', 'traced-plans.js',
    c => c.replace('const house2 = notch(H, spot);', 'const house2 = H;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('traced-plans-harness',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = H.loadDraftModules();
const T = win.DraftTracedPlans;
const P = win.DraftPremadePlans;

let failed = 0, passed = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) passed += 1; else failed += 1;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}${ok ? '' : `\n         got  ${JSON.stringify(got)}\n         want ${JSON.stringify(want)}`}`);
};
const rect = (x0, z0, x1, z1) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }];
const box = loop => {
  const xs = loop.map(p => p.x), zs = loop.map(p => p.z);
  return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
};
const HOUSE = rect(-16, -20, 16, 20);
const GARAGE = rect(-4, 20, 20, 46);
const plan = (entryId, garage = GARAGE) => T.planFromTrace({
  entryId, house: HOUSE, garage: T.needsGarage(entryId) ? garage : null,
});

// ── ROOFS ───────────────────────────────────────────────────────────────
{
  const p = plan('bungalow-garage');
  check('bungalow + garage: one roof round both bodies', [p.houseRoof.length, box(p.houseRoof), p.garageRoof],
    [8, [-16, -20, 20, 46], null]);
  const q = plan('twoStorey-garage');
  check('2 STOREY + garage: the house roof and a lower one of its own over the garage',
    [box(q.houseRoof), box(q.garageRoof), q.garageRoofHouseEnd != null], [[-16, -20, 16, 20], [-4, 20, 20, 46], true]);
  const r = plan('twoStorey-over');
  check('room over: 18 ft at the house end, under the house roof; the rest roofed lower',
    [box(r.overGarage), box(r.houseRoof), box(r.garageRoof)],
    [[-4, 20, 20, 38], [-16, -20, 20, 38], [-4, 38, 20, 46]]);
  // Movie, 4 Oct: the MOD BILEVEL's room roof is square over the room and
  // the upper landing, straight across the jog between them.
  const m = plan('modifiedBilevel');
  const both = [...m.overGarage, ...m.upperLanding];
  check('MOD BILEVEL: the room\'s roof is square, over the room and the landing',
    [m.overGarageRoof.length, box(m.overGarageRoof)], [4, box(both)]);
}

// ── THE GARAGE'S WALLS AND DOORS ────────────────────────────────────────
{
  const p = plan('bungalow-garage');
  check('the garage gets a corner where the house corner meets it', p.garage.length, 5);
  const overhead = p.garageOpenings.filter(o => o.garage);
  const front = T.edgesOf(p.garage).find(e => e.index === overhead[0].edge);
  check('the overhead doors are on the street face', [front.a.z, front.b.z, overhead.length], [46, 46, 2]);
  check('and a man door on the four feet past the house', p.garageOpenings.filter(o => !o.garage)
    .map(o => box([T.edgesOf(p.garage)[o.edge].a, T.edgesOf(p.garage)[o.edge].b])), [[16, 20, 20, 20]]);
  const door = p.houseOpenings.find(o => o.type === 'door');
  const e = T.edgesOf(p.house)[door.edge];
  check('the front door is on the front, clear of the garage', [e.a.z, e.b.z,
    e.a.x + e.ux * door.offsetFt < -4 - 1.5], [20, 20, true]);
}

// ── THE BILEVEL'S LANDING ───────────────────────────────────────────────
{
  const p = plan('bilevel-garage');
  check('with a garage the landing straddles its line, as the premade does',
    box(p.entry), box(P.planFor('bilevel-garage').entry));
  check('and the house is notched round it', p.house.length, 8);
  check('the foundation is the whole rectangle', box(p.foundation), [-16, -20, 16, 20]);
  check('the stairs came with it', [p.stairs.up.x, p.stairs.down.x],
    [P.planFor('bilevel-garage').stairs.up.x, P.planFor('bilevel-garage').stairs.down.x]);
  const q = plan('bilevel');
  check('with no garage it is centred on the front', box(q.entry), [-6, 14, 6, 20]);
  // THE GARAGE ON THE OTHER SIDE turns the landing left for right: the up
  // flight stays on the street side.
  const left = T.planFromTrace({ entryId: 'bilevel-garage', house: HOUSE, garage: rect(-20, 20, 4, 46) });
  check('a garage on the left: line at x = 4, landing -2..10, up flight on the street (right)',
    [box(left.entry), left.stairs.up.x > left.stairs.down.x], [[-2, 14, 10, 20], true]);
}

// ── REFUSALS ─────────────────────────────────────────────────────────────
check('a garage type with no garage traced', T.planFromTrace({ entryId: 'bungalow-garage', house: HOUSE }).error, 'NO_GARAGE');
check('a front too short for the landing',
  T.planFromTrace({ entryId: 'bilevel', house: rect(0, 0, 10, 10) }).error, 'NO_FRONT');

// ── THE DETACHED GARAGE ─────────────────────────────────────────────────
{
  const g = T.detachedFromTrace(rect(0, 0, 24, 26));
  check('a detached garage keeps its corners and gets an overhead door', [g.corners.length,
    g.openings.some(o => o.garage)], [4, true]);
}

console.log(failed ? `\n${failed} check(s) FAILED, ${passed} passed` : `\nall ${passed} traced-plans checks passed`);
process.exit(failed ? 1 : 0);
