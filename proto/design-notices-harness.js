// design-notices.js — what the page says when a press cannot move the drawing.
//
// Board #313 forbids software moving geometry without a press and says
// nothing about the other case: a press arrives, the geometry correctly stays,
// and the drafter is told nothing. These notices are that other case, and this
// harness holds them to two things a page cannot check for itself.
//
// FIRST, THAT A NOTICE FIRES WHEN IT SHOULD AND STAYS QUIET WHEN IT SHOULD
// NOT. A warning is the easiest thing in a codebase to get backwards without
// anyone noticing, because both mistakes look like nothing happening: one is
// silence where there should be a sentence, the other is a sentence nobody
// reads because it is always there.
//
// SECOND, THAT A MISWIRED CALLER IS LOUD. The garage check needs three numbers
// it deliberately does not own -- OPENING_HEAD_DROP_IN lives in
// project-page.js and a fourth copy here is the drift this repo spent 6 Sep
// removing. The cost of not owning them is a caller that passes undefined, and
// the honest failure for that is a notice saying so. Returning null would make
// a broken wire and a garage that fits produce the same silence, which is the
// exact shape of the seven stale facts found that day.
//
// THE THIRD FINDING IS NOT HERE AND IS NOT STUBBED. Pressing BUNGALOW on a
// drawing that already has a storey over the garage belongs in this file, but
// the build-type row that raises it is not on main yet. A function returning
// null until the feature lands would pass every check here for the wrong
// reason. Named in the module header instead, where it cannot look tested.
//
// Run: node proto/design-notices-harness.js          (checks)
//      node proto/design-notices-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'design-notices.js');
const STAIR_SRC = path.join(__dirname, '..', 'stair-geometry.js');
const MUTATION_MODE = require('./harness-args.js').mutationMode();

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  new Function('window', src)(window);
  return window.DraftDesignNotices;
}

// The real stair module, not a stand-in: these notices exist to be right about
// a stair, and a fake layoutFor would let the riser rule drift away from the
// one that draws.
const STAIR = (() => {
  const window = {};
  new Function('window', fs.readFileSync(STAIR_SRC, 'utf8'))(window);
  return window.DraftStairGeometry;
})();
const STAIR_FNS = { layoutFor: STAIR.stairLayout, descentFor: STAIR.stairDescent };

// A two-storey house on 8'-1 1/8" walls with an 11 7/8" + 3/4" floor: the
// level model stair-geometry.js asks for, as an object literal.
const levelsWith = ({ mainWallFt = 97.125 / 12, floorFt = 12.625 / 12 } = {}) => ({
  floors: [{ id: 3, name: 'MAIN FL' }, { id: 5, name: '2ND FL' }],
  assemblyFor: id => ({ wallHeightFt: mainWallFt, slabThicknessIn: 3 }),
  floorFtFor: () => floorFt,
  wallTopFtFor: () => 8,
});
// A stair on 2ND FL descends MAIN FL's wall plus 2ND FL's floor.
const stairOn2nd = riseFt => ({ id: 's1', levelId: 5, riseFt });
const PLACED_RISE = 97.125 / 12 + 12.625 / 12;   // 9'-1 3/4", 14 risers

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── The stair that no longer fits ─────────────────────────────────────

check('an unchanged stair says nothing',
  N => [N.stairRefitNotice(stairOn2nd(PLACED_RISE), levelsWith(), STAIR_FNS), null]);

// The rise moves but the riser count does not, so the run is the same length
// and the drafter has nothing to avoid. 1/4" over 14 risers is 1/56" a step.
check('a rise that moves within its riser count says nothing',
  N => [N.stairRefitNotice(stairOn2nd(PLACED_RISE), levelsWith({ floorFt: 12.875 / 12 }), STAIR_FNS), null]);

// Movie's OVER GARAGE ruling in miniature: a deeper joist package. 23 1/4" of
// joist takes the rise past a riser boundary and the run grows 10".
const deeper = levelsWith({ floorFt: 24 / 12 });
check('a deeper floor package that adds a riser is reported',
  N => [(N.stairRefitNotice(stairOn2nd(PLACED_RISE), deeper, STAIR_FNS) || {}).kind, 'stair-refit']);
check('and it names both riser counts',
  N => {
    const n = N.stairRefitNotice(stairOn2nd(PLACED_RISE), deeper, STAIR_FNS) || {};
    return [`${n.placedRisers}->${n.nowRisers}`, '14->16'];
  });
check('and both run lengths, which is what the drafter has to fit',
  N => {
    const n = N.stairRefitNotice(stairOn2nd(PLACED_RISE), deeper, STAIR_FNS) || {};
    return [`${Math.round(n.placedRunFt * 12)}->${Math.round(n.nowRunFt * 12)}`, '130->150'];
  });
// THE HALF THAT MATTERS MOST: it must say nothing was moved. A notice a
// drafter reads as "handled" is worse than no notice, because they stop
// looking.
check('and it says nothing has been moved',
  N => [/Nothing has been moved/.test(
    (N.stairRefitNotice(stairOn2nd(PLACED_RISE), deeper, STAIR_FNS) || {}).text || ''), true]);
// A shallower package loses a riser; the run shrinks and the wording follows.
check('a shallower package is reported as a shrink',
  N => {
    const n = N.stairRefitNotice(stairOn2nd(PLACED_RISE), levelsWith({ floorFt: 1 / 12 }), STAIR_FNS) || {};
    return [/shrank/.test(n.text || ''), true];
  });

check('a stair with no rise at placement has nothing to compare and says nothing',
  N => [N.stairRefitNotice({ id: 's1', levelId: 5 }, deeper, STAIR_FNS), null]);
check('a stair on a level that no longer exists says nothing',
  N => [N.stairRefitNotice({ id: 's1', levelId: 99, riseFt: PLACED_RISE }, deeper, STAIR_FNS), null]);
// The miswired case, loud rather than quiet.
check('a caller that supplies no stair module is told so, not answered null',
  N => [(N.stairRefitNotice(stairOn2nd(PLACED_RISE), deeper, {}) || {}).kind, 'notice-inputs-missing']);

// ── The garage door head ──────────────────────────────────────────────
// project-page.js's numbers, passed in: OPENING_HEAD_DROP_IN 16.5, a 7'-0"
// door, and the 9'-1 1/8" garage wall it is checked against today.
const HEAD_DROP_IN = 16.5, DOOR_IN = 84;
const head = (wallHeightFt, N) => N.garageDoorHeadNotice(
  { wallHeightFt, headDropIn: HEAD_DROP_IN, doorHeightIn: DOOR_IN });

check('the 9\'-1 1/8" garage wall clears a 7\'-0" door and says nothing',
  N => [head(109.125 / 12, N), null]);
// Skipper's arithmetic, 6 Sep: at 23 1/4" joists the wall drops to 8'-9 1/8".
check('8\'-9 1/8" still clears, so still nothing',
  N => [head(105.125 / 12, N), null]);
// The limit. 27 7/8" of joist plus 3/4" sheathing under a 10'-9 1/8" deck
// leaves 100.5" of wall, and the head lands exactly on 7'-0".
check('the head landing exactly on 7\'-0" is not short, so nothing',
  N => [head(100.5 / 12, N), null]);
check('a quarter inch past it is reported',
  N => [(head(100.25 / 12, N) || {}).kind, 'garage-door-head']);
check('and it says how short, not how to fix it',
  N => [Math.round(((head(100.25 / 12, N) || {}).shortIn || 0) * 100) / 100, 0.25]);
check('and it says the wall was not changed',
  N => [/has not been changed/.test((head(100.25 / 12, N) || {}).text || ''), true]);

// The tallest door that fits, which is the drafter's next question.
check('the limit under the default garage wall is a 92" door',
  N => [N.garageDoorHeadLimitIn({ wallHeightFt: 109.125 / 12, headDropIn: HEAD_DROP_IN }), 92]);
check('the limit is whole inches down, because doors come in sizes',
  N => [N.garageDoorHeadLimitIn({ wallHeightFt: 100.4 / 12, headDropIn: HEAD_DROP_IN }), 83]);

// Every missing input, named. A caller that forgot one gets told which.
check('no wall height is reported as a missing input',
  N => [(N.garageDoorHeadNotice({ headDropIn: HEAD_DROP_IN, doorHeightIn: DOOR_IN }) || {}).kind,
        'notice-inputs-missing']);
check('no head drop is reported as a missing input',
  N => [(N.garageDoorHeadNotice({ wallHeightFt: 8, doorHeightIn: DOOR_IN }) || {}).kind,
        'notice-inputs-missing']);
check('and the notice names which one',
  N => [((N.garageDoorHeadNotice({ wallHeightFt: 8, doorHeightIn: DOOR_IN }) || {}).missing || []).join(','),
        'headDropIn']);
check('a caller passing nothing at all is told, not answered null',
  N => [(N.garageDoorHeadNotice() || {}).kind, 'notice-inputs-missing']);

// ── The strings the drafter actually reads ────────────────────────────
// A notice is only as good as its number. These pin the formatter, because a
// wrong fraction in a warning is worse than the warning being absent -- it is
// a wrong fact stated confidently.
check('feet and inches read as a drafter writes them',
  N => [N.formatFtIn(109.125 / 12), `9'-1 1/8"`]);
check('a bare inch measure keeps its fraction',
  N => [N.formatIn(0.25), '1/4"']);
check('and rounds to the nearest eighth rather than showing decimals',
  N => [N.formatIn(2.1), '2 1/8"']);
check('a whole foot has no stray fraction',
  N => [N.formatFtIn(9), `9'-0"`]);
check('eight eighths carry into the next inch',
  N => [N.formatIn(1.99), '2"']);

function run(N) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(N); } catch (err) { got = `threw ${err.message}`; want = null; }
    if (got !== want) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}, want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

const MUTATIONS = [
  ['the stair notice fires on any rise change, not a riser change',
    s => s.replace('if (placed.risers === now.risers) return null;', '')],
  ['the stair notice never fires',
    s => s.replace('if (placed.risers === now.risers) return null;',
      'if (placed.risers !== now.risers) return null;')],
  ['a stair with no placement rise is compared against zero',
    s => s.replace('if (placedRiseFt === null || placedRiseFt <= 0) return null;', '')],
  ['the stair notice reports the placed run as the new one',
    s => s.replace('nowRunFt: now.runFt,', 'nowRunFt: placed.runFt,')],
  ['the stair notice loses its promise that nothing moved',
    s => s.replace('Nothing has been moved.', 'Adjusted.')],
  ['grew and shrank are the wrong way round',
    s => s.replace('const grew = now.risers > placed.risers;',
      'const grew = now.risers < placed.risers;')],
  ['a missing stair module answers null instead of saying so',
    s => s.replace("typeof layoutFor !== 'function' || typeof descentFor !== 'function'", 'false')],
  ['the door head is measured from the plate, not under the drop',
    s => s.replace('const headIn = wallFt * 12 - dropIn;', 'const headIn = wallFt * 12;')],
  ['a head exactly on the door height is called short',
    s => s.replace('if (clearIn >= 0) return null;', 'if (clearIn > 0) return null;')],
  ['the door notice never fires',
    s => s.replace('if (clearIn >= 0) return null;', 'return null;')],
  ['the shortfall is reported with the wrong sign',
    s => s.replace('shortIn: -clearIn,', 'shortIn: clearIn,')],
  ['the door notice loses its promise that nothing moved',
    s => s.replace('The wall has not `\n      + `been changed', 'The wall was lowered')],
  ['a missing garage input answers null instead of saying so',
    s => s.replace('if (wallFt === null || dropIn === null || doorIn === null) {', 'if (false) {')],
  ['the missing-input notice stops naming which input',
    s => s.replace('.filter(Boolean);', '.filter(() => false);')],
  ['the door limit rounds up to a size nobody sells',
    s => s.replace('return Math.floor(wallFt * 12 - dropIn);', 'return Math.ceil(wallFt * 12 - dropIn);')],
  ['the door limit ignores the head drop',
    s => s.replace('return Math.floor(wallFt * 12 - dropIn);', 'return Math.floor(wallFt * 12);')],
  ['feet and inches lose their eighths',
    s => s.replace('const eighths = Math.round(Math.abs(feet) * 96);',
      'const eighths = Math.round(Math.abs(feet) * 12) * 8;')],
  ['an inch measure truncates its fraction instead of rounding',
    s => s.replace('const eighths = Math.round(Math.abs(totalIn) * 8);',
      'const eighths = Math.floor(Math.abs(totalIn) * 8);')],
];

if (MUTATION_MODE) {
  console.log('\nMUTATION                                                              CAUGHT BY');
  let survivors = 0, broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let missed, by;
    try {
      missed = run(load(mutate));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(70)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(70)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
