#!/usr/bin/env node
// THE PREDESIGNED WASHROOM — offline checks for washroom.js (board #315 room
// half, reworked).
//
// The unit is arithmetic before it is geometry, and the arithmetic is the
// part the spec got wrong once: read as "outside of stud" the fixtures
// overrun the room by 14". So these checks measure the fit rather than
// trusting the comment that describes it.
//
//   node proto/washroom-harness.js
//
// Exit 0 = every check passed.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const win = {};
const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON, isFinite };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'washroom.js'), 'utf8'), sandbox, { filename: 'washroom.js' });

const W = win.DraftWashroom;
let passed = 0;
const failures = [];
const check = (name, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
};

// ── THE MODULE LOADED AT ALL ─────────────────────────────────────────────
// Every check below reads off W. If washroom.js failed to define it, they
// would all throw rather than fail, and a harness that dies is not a harness
// that reports.
check('washroom.js defines DraftWashroom', !!W, String(W));
if (!W) { console.log('washroom harness: 0 passed, 1 failed'); process.exit(1); }

// ── THE FIT ──────────────────────────────────────────────────────────────
// The spec's own numbers, stated here independently of the module so this is
// a comparison and not an echo. If washroom.js changed a run, these fail.
const SPEC = { tub: 30, toilet: 36, sink: 36, chase: 6, tubLen: 60, finish: 1 };

check('length is the fixture run plus finish, exactly',
  W.STANDARD_LENGTH_IN === SPEC.tub + SPEC.toilet + SPEC.sink + SPEC.finish,
  `${W.STANDARD_LENGTH_IN}" vs ${SPEC.tub + SPEC.toilet + SPEC.sink + SPEC.finish}"`);
check("and that is 8'-7\"", W.STANDARD_LENGTH_IN === 103, `${W.STANDARD_LENGTH_IN}"`);
check('width is the chase plus the tub length plus finish, exactly',
  W.STANDARD_WIDTH_IN === SPEC.chase + SPEC.tubLen + SPEC.finish,
  `${W.STANDARD_WIDTH_IN}" vs ${SPEC.chase + SPEC.tubLen + SPEC.finish}"`);
check("and that is 5'-7\"", W.STANDARD_WIDTH_IN === 67, `${W.STANDARD_WIDTH_IN}"`);

// THE TUB FITS THE WIDTH EXACTLY, and this is the check that would have
// caught the outside-of-stud reading: under it the clear width is 60" minus
// two studs and the tub does not go in at all.
const std = W.layout();
const tub = std.fixtures.find(f => f.kind === 'tub');
check('the fixture set includes a tub', !!tub, std.fixtures.map(f => f.kind).join(', '));
check('the tub spans from the chase to the far face, exactly',
  Math.abs((tub.v1 - tub.v0) * 12 - SPEC.tubLen) < 1e-9,
  `${((tub.v1 - tub.v0) * 12).toFixed(3)}" of tub in a ${W.STANDARD_WIDTH_IN}" room`);
check('and it does NOT touch the wet wall — the chase is between them',
  Math.abs(tub.v0 * 12 - SPEC.chase) < 1e-9,
  `tub starts ${(tub.v0 * 12).toFixed(3)}" off the wet wall`);
check('the chase is on the wet-wall side, not the far side',
  std.chase.v0 === 0 && Math.abs(std.chase.v1 * 12 - SPEC.chase) < 1e-9,
  `chase v0=${std.chase.v0} v1=${(std.chase.v1 * 12).toFixed(3)}"`);
check('and the chase runs only alongside the tub',
  Math.abs(std.chase.u0 - tub.u0) < 1e-9 && Math.abs(std.chase.u1 - tub.u1) < 1e-9,
  `chase u ${std.chase.u0.toFixed(3)}..${std.chase.u1.toFixed(3)} vs tub ${tub.u0.toFixed(3)}..${tub.u1.toFixed(3)}`);
check('the tub faucet is at the wet-wall end', tub.faucetEnd === 'wet', String(tub.faucetEnd));

// EVERY SUPPLY ON THE ONE WALL. Sink and toilet stand on it; the tub reaches
// it through the chase. That is the whole reason the wet wall is 2x6 and the
// reason stacking it is worth a lock.
const onWetWall = std.fixtures.filter(f => f.v0 === 0);
check('sink and toilet stand on the wet wall',
  onWetWall.map(f => f.kind).sort().join(',') === 'sink,toilet',
  onWetWall.map(f => `${f.kind}@v0=${f.v0}`).join(' '));
check('the wet wall is 2x6', W.WET_WALL_IN === 5.5, `${W.WET_WALL_IN}"`);
check('and every other wall is 2x4', W.WALL_IN === 3.5, `${W.WALL_IN}"`);

// ── THE WALK-IN ORDER ────────────────────────────────────────────────────
const order = std.fixtures.slice().sort((a, b) => a.u0 - b.u0).map(f => f.kind);
check('walking in: sink, then toilet, then the tub at the far end',
  order.join(' -> ') === 'sink -> toilet -> tub', order.join(' -> '));
check('the door is at the sink end, opposite the wet wall',
  std.door.v === std.widthFt && std.door.u < std.lengthFt / 2,
  `door u=${std.door.u.toFixed(2)} v=${std.door.v.toFixed(2)} of ${std.lengthFt.toFixed(2)}x${std.widthFt.toFixed(2)}`);

// NO WINDOW, and stated as a value. A caller reading `window: null` knows it
// was decided; a missing key would read as an oversight.
check('the WC is windowless BY DECISION, not by omission',
  'window' in std && std.window === null, JSON.stringify(std.window));

// ── THE GROWTH LADDER ────────────────────────────────────────────────────
// Sink first to 42", then the tub-to-toilet gap. Movie's own example is 9'-1".
const at = len => W.runsForLength(len);
check('at standard the sink is 36" and there is no gap',
  at(103).sinkRunIn === 36 && at(103).gapIn === 0,
  JSON.stringify(at(103)));
check("at 9'-1\" the extra 6\" all goes to the sink, making it 42\"",
  at(109).sinkRunIn === 42 && at(109).gapIn === 0,
  JSON.stringify(at(109)));
check('the sink stops at 42" and never grows past it',
  at(200).sinkRunIn === 42, `${at(200).sinkRunIn}" at a 200" room`);
check('past 42" the surplus opens the tub-to-toilet gap',
  at(120).gapIn === 120 - 103 - 6, `gap ${at(120).gapIn}" at 120"`);
check('the toilet run never changes',
  [103, 109, 120, 200].every(l => at(l).toiletRunIn === 36),
  [103, 109, 120, 200].map(l => at(l).toiletRunIn).join(','));

// ── IT CLOSES AT EVERY SIZE ──────────────────────────────────────────────
// The runs must sum to the length at any size, or the drawn room and the
// stated size disagree -- silently, because each fixture looks right alone.
const sizes = [103, 104, 109, 110, 120, 150];
const notClosing = sizes.filter(l => !W.closes(l).ok);
check('the runs sum to the room length at every size',
  notClosing.length === 0,
  notClosing.map(l => `${l}": sum ${W.closes(l).sum}`).join(', ') || 'none');
// AND THE COMPANION: closes() must be able to say NO. A predicate that
// cannot fail proves nothing about the ones above -- and the first version
// of closes() could not, which is how this check earned its place.
//
// 94" IS THE ERROR ITSELF. It is the clear length the work order's
// "outside of stud" reading gives, and the fixtures overrun it by 14".
// If closes(94) ever returns true, the unit has been quietly resized to fit
// the wrong reading.
const tooShort = W.closes(94);
check('closes() says NO to the 94" the outside-of-stud reading gives',
  tooShort.ok === false, JSON.stringify(tooShort));
check('and it says WHY, rather than just false',
  Array.isArray(tooShort.reasons) && tooShort.reasons.length > 0,
  JSON.stringify(tooShort.reasons));
check('a room one inch short of the fixtures does not close',
  W.closes(W.MIN_LENGTH_IN - 1).ok === false,
  JSON.stringify(W.closes(W.MIN_LENGTH_IN - 1)));
check('and the standard room does',
  W.closes(W.STANDARD_LENGTH_IN).ok === true,
  JSON.stringify(W.closes(W.STANDARD_LENGTH_IN)));

// ── FINISHES AND TILE ────────────────────────────────────────────────────
check('cement board around the tub, drywall elsewhere',
  std.finishes.some(f => f.kind === 'cement-board' && f.at === 'tub')
  && std.finishes.some(f => f.kind === 'drywall' && f.at === 'other'),
  JSON.stringify(std.finishes));
check('the two finishes are the 1" that makes 102 into 103',
  (W.CEMENT_BOARD_IN + W.DRYWALL_IN) === W.FINISH_IN,
  `${W.CEMENT_BOARD_IN} + ${W.DRYWALL_IN} vs ${W.FINISH_IN}`);
check('the floor tile grid is 12"x12"',
  Math.abs(std.tileGridFt * 12 - 12) < 1e-9, `${(std.tileGridFt * 12).toFixed(3)}"`);

// ── STAIR LANDING ZONES ──────────────────────────────────────────────────
// A general rule the washroom is only the first caller of: every run gets a
// keep-out at top AND bottom, full width, that nothing auto-placed may
// occupy. It binds the machine, not the human.
const run = { id: 's1', start: { x: 0, z: 0 }, end: { x: 0, z: 10 }, widthFt: 3.5 };
const zones = W.landingZones([run]);
check('a stair run gets TWO landing zones, top and bottom',
  zones.length === 2, `${zones.length} zones`);
check('the preferred depth is 3\'-6", the minimum 3\'-0"',
  W.LANDING_PREFERRED_FT === 3.5 && W.LANDING_MIN_FT === 3,
  `${W.LANDING_PREFERRED_FT} / ${W.LANDING_MIN_FT}`);
check('each zone is the full width of the run',
  zones.every(z => {
    const xs = z.corners.map(c => c.x);
    return Math.abs((Math.max(...xs) - Math.min(...xs)) - run.widthFt) < 1e-9;
  }),
  zones.map(z => (Math.max(...z.corners.map(c => c.x)) - Math.min(...z.corners.map(c => c.x))).toFixed(2)).join(', '));
check('and it reaches its depth away from the step',
  zones.every(z => {
    const zs = z.corners.map(c => c.z);
    return Math.abs((Math.max(...zs) - Math.min(...zs)) - W.LANDING_PREFERRED_FT) < 1e-9;
  }),
  zones.map(z => (Math.max(...z.corners.map(c => c.z)) - Math.min(...z.corners.map(c => c.z))).toFixed(2)).join(', '));

// THE TWO ZONES ARE ON OPPOSITE SIDES, and this is the check that catches a
// sign error. Both sitting at the same end would leave one landing bare
// while the room looked guarded -- a keep-out that keeps nothing out.
const zMids = zones.map(z => z.corners.reduce((sum, c) => sum + c.z, 0) / z.corners.length);
check('one zone falls below the run and one above it',
  Math.min(...zMids) < 0 && Math.max(...zMids) > run.end.z,
  zMids.map(v => v.toFixed(2)).join(' and '));

check('a zero-length run gets no zones rather than a divide-by-zero',
  W.landingZones([{ start: { x: 1, z: 1 }, end: { x: 1, z: 1 } }]).length === 0,
  JSON.stringify(W.landingZones([{ start: { x: 1, z: 1 }, end: { x: 1, z: 1 } }])));
check('no stairs means no zones, not a throw', W.landingZones([]).length === 0, 'empty');
// AND THE COMPANION: the fixture must have a run to zone at all, or every
// count above is a count of nothing.
check('the fixture really has a stair to zone',
  Math.hypot(run.end.x - run.start.x, run.end.z - run.start.z) > 1,
  'zero-length fixture would make the checks above vacuous');

// ── WHICH SIDE ──────────────────────────────────────────────────────────
// The WC takes the garage side so living and dining own the open one. With
// no garage the front door predicts where the garage will land.
check('a known garage side is taken as given',
  W.garageSide({ garageOutlineSide: 'left' }) === 'left'
  && W.garageSide({ garageOutlineSide: 'right' }) === 'right',
  'garage outline');
check('a door on the LEFT sends the WC right',
  W.garageSide({ doorSide: 'left' }) === 'right', W.garageSide({ doorSide: 'left' }));
check('a door on the RIGHT sends the WC left',
  W.garageSide({ doorSide: 'right' }) === 'left', W.garageSide({ doorSide: 'right' }));
check('a CENTRED door sends the WC left',
  W.garageSide({ doorSide: 'centre' }) === 'left', W.garageSide({ doorSide: 'centre' }));
check('a real garage outranks the door prediction',
  W.garageSide({ garageOutlineSide: 'right', doorSide: 'right' }) === 'right',
  'the prediction exists only for houses with no garage');
// NOTHING TO GO ON IS NOT A COIN FLIP. Returning null hands the decision
// back to the caller instead of guessing a side and looking certain.
check('with nothing to go on it returns null rather than guessing',
  W.garageSide({}) === null, String(W.garageSide({})));

console.log(`washroom harness: ${passed} checks passed, ${failures.length} failed`);
if (failures.length) {
  failures.forEach(line => console.log(`  ✘ ${line}`));
  process.exit(1);
}
