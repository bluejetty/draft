// WHAT A LEVEL IS CALLED ON SCREEN — the numbered names, and what they cost.
//
// Movie, 19 Sep: "lets name them 0.5 MAIN FL / 1 MAIN FL / 1.5 2ND FL /
// 2 2ND FL --- this will actually make most sense". The number is WHERE the
// level sits, the name is WHICH FLOOR IT BELONGS TO. So a bilevel's entry is
// a partial main floor and the room over a garage a lower second floor, which
// is his own phrase for it: "the 'over garage' layer is for bilevels when
// that would be a 'lower' 2nd floor".
//
// THE CHECKS ARE MOSTLY ABOUT WHAT IT MUST NOT DO. Getting the four labels
// right is one line of table lookup and a mutation of the table is caught by
// reading the table -- which proves nothing. What is worth guarding is the
// shape of the decision: that the levels with no floor to stand on are left
// alone, that a name the drafter chose is not eaten, that a level nobody
// planned for gets no invented number, and above all that the STORED name is
// never touched, because a label written into the record is a file that reads
// differently depending on the day it was saved.
//
// Run: node proto/level-label-harness.js
const fs = require('fs');
const path = require('path');
const MUTATION_MODE = require('./harness-args.js').mutationMode();
const SRC = path.join(__dirname, '..', 'level-assembly.js');

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', src)(window);
  return window.DraftLevelAssembly;
}

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── THE FOUR NUMBERED LEVELS ──
check('the four storeys read as Movie numbered them',
  L => [[2, 3, 4, 5].map(id => L.levelLabel(id, STORED[id])).join(' / '),
    '0.5 MAIN FL / 1 MAIN FL / 1.5 2ND FL / 2 2ND FL']);

// THE HALF-LEVELS CHANGE WORD, not just gain a number: ENTRY becomes a MAIN
// FL and OVER GARAGE a 2ND FL, which is the whole point of the scheme. Stated
// on its own because it is the part a "just prefix the number" rewrite would
// quietly get wrong while the numbers still looked right.
check('a half-level is named for the floor it belongs to, not for what is on it',
  L => [`${L.levelLabel(2, 'ENTRY')}|${L.levelLabel(4, 'OVER GARAGE')}`,
    '0.5 MAIN FL|1.5 2ND FL']);

// ── AND WHAT CARRIES NO NUMBER ──
// Movie, same conversation: "(and foundation boneyard etc roof site". A number
// here means a floor to stand on, and none of these is one.
check('the levels that are not storeys keep their own names, unnumbered',
  L => [[[1, 'FOUNDATION'], [7, 'ROOF'], [8, 'SITE']]
    .map(([id, name]) => L.levelLabel(id, name)).join(','),
  'FOUNDATION,ROOF,SITE']);

// _addLevel hands out ids from 9 up. Those are outside the scheme entirely,
// and inventing a number for one would put a level at a storey nobody chose.
check('a level the drafter added himself is not given a storey he did not choose',
  L => [L.levelLabel(9, 'ATTIC'), 'ATTIC']);

check('and one with no name at all still says which level it is',
  L => [L.levelLabel(9, ''), 'level 9']);

// ── WHAT IT MUST NOT EAT ──
// The table replaces the name a file holds TODAY and nothing else: a drawing
// whose main floor is called GROUND keeps the word and gains the number.
check('a name the drafter chose is numbered, not replaced',
  L => [`${L.levelLabel(3, 'GROUND')}|${L.levelLabel(5, 'LOFT')}`, '1 GROUND|2 LOFT']);

check('a missing name falls back to the floor this id is',
  L => [L.levelLabel(3, null), '1 MAIN FL']);

check('and whitespace is not a name',
  L => [L.levelLabel(3, '   '), '1 MAIN FL']);

// ── THE ONE THAT MATTERS MOST ──
//
// A label written into the record would leave every file made before today
// reading MAIN FL while a new one read 1 MAIN FL -- one level, two names,
// depending on when it was saved -- and would break every lookup that finds a
// level BY name. Derived, the record is untouched.
check('it reads a level without changing it',
  L => { const level = { id: 3, name: 'MAIN FL', elev: 0 };
    const before = JSON.stringify(level);
    L.levelLabel(level.id, level.name);
    return [JSON.stringify(level), before]; });

// AND THE STORED NAME IS STILL FOUND INSIDE THE LABEL, which is what keeps
// `.level-name` locators matching 'MAIN FL' working after the rename.
check('the floor-s own words survive inside the label a drafter reads',
  L => [L.levelLabel(3, 'MAIN FL').includes('MAIN FL'), true]);

const STORED = { 2: 'ENTRY', 3: 'MAIN FL', 4: 'OVER GARAGE', 5: '2ND FL' };

const MUTATIONS = [
  // The numbers go on, the WORDS do not change -- the half-levels keep
  // saying ENTRY and OVER GARAGE.
  ['a half-level keeps its old word and only gains a number',
    s => s.replace("const STOREY_FLOOR = Object.freeze({ 2: 'MAIN FL', 3: 'MAIN FL', 4: '2ND FL', 5: '2ND FL' });",
      "const STOREY_FLOOR = Object.freeze({ 2: 'ENTRY', 3: 'MAIN FL', 4: 'OVER GARAGE', 5: '2ND FL' });")],
  // FOUNDATION is a floor level after all, and gets a 0.
  ['the foundation is numbered as though it were a storey',
    s => s.replace("const STOREY_NUMBER = Object.freeze({ 2: '0.5', 3: '1', 4: '1.5', 5: '2' });",
      "const STOREY_NUMBER = Object.freeze({ 1: '0', 2: '0.5', 3: '1', 4: '1.5', 5: '2' });")],
  // Every level gets a number, including the ones a drafter added.
  ['a level nobody planned for is given a storey number anyway',
    s => s.replace('    if (!number) return stored || `level ${levelId}`;',
      '    if (!number) return `${levelId} ${stored}`;')],
  // The stored name is ignored outright, so a chosen word is eaten.
  ['the table replaces every name, including one the drafter chose',
    s => s.replace('    const floor = (!stored || stored === STOREY_STORED[levelId])\n'
      + '      ? STOREY_FLOOR[levelId] : stored;',
      '    const floor = STOREY_FLOOR[levelId];')],
  // The half-levels lose their number, so ENTRY and OVER GARAGE read as
  // whole storeys sitting on top of the ones they are half a storey off.
  ['the half-levels read as whole storeys',
    s => s.replace("const STOREY_NUMBER = Object.freeze({ 2: '0.5', 3: '1', 4: '1.5', 5: '2' });",
      "const STOREY_NUMBER = Object.freeze({ 2: '1', 3: '1', 4: '2', 5: '2' });")],
];

function run() {
  const L = load(null);
  let failed = 0;
  CHECKS.forEach(({ label, fn }) => {
    const [got, want] = fn(L);
    if (String(got) !== String(want)) {
      failed += 1;
      console.log(`FAIL  ${label}\n      got  ${got}\n      want ${want}`);
    }
  });
  console.log(`\n${CHECKS.length - failed}/${CHECKS.length} checks passed`);
  if (failed) process.exitCode = 1;
}

// A MUTATION THAT NEVER APPLIED IS NOT A MUTATION THAT WAS CAUGHT.
//
// The first version of this runner wrapped `load(mutate)` in a try and pushed
// the error into the CAUGHT list -- so a mutation whose anchor had gone stale,
// matching nothing in the source, was scored as proof that the checks work.
// Measured rather than reasoned about: a deliberately dead anchor added to the
// table below reported "6/6 mutations caught" and exited 0.
//
// That is this directory's own subject one level up -- a check that cannot
// fail, reporting success. proto/mutant-anchors-harness.js guards against it,
// but it scans the `*-mutants.js` tables and does not reach an inline table
// like this one, so the runner has to count it itself. Broken is its own
// tally and it fails the run, the way premade-plans-harness.js counts it.
function runMutations() {
  console.log('\n' + 'mutation'.padEnd(64) + 'caught by');
  let survived = 0;
  let broken = 0;
  MUTATIONS.forEach(([label, mutate]) => {
    let L;
    try {
      L = load(mutate);
    } catch (err) {
      broken += 1;
      console.log(`${label.padEnd(64)}!!! MUTATION DID NOT APPLY: ${err.message}`);
      return;
    }
    const caught = [];
    CHECKS.forEach(({ label: name, fn }) => {
      let got;
      let want;
      try { [got, want] = fn(L); } catch (err) { caught.push(name); return; }
      if (String(got) !== String(want)) caught.push(name);
    });
    if (!caught.length) survived += 1;
    console.log(label.padEnd(64)
      + (caught.length ? caught.join('\n' + ' '.repeat(64)) : '*** NOTHING ***'));
  });
  console.log(`\n${MUTATIONS.length - survived - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  if (survived || broken) process.exitCode = 1;
}

if (MUTATION_MODE) runMutations(); else run();
