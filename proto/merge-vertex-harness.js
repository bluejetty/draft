// MERGE-VERTEX HARNESS — the pool that gives wallJoins something to key on.
//
// wallJoins groups endpoints by OBJECT IDENTITY. JSON restores values and not
// references, so a drawing read back off disk has a separate point object at
// every corner and the classifier finds nothing. mergeVertex rebuilds that
// identity: hand it a pool and a point and it returns THE object for that
// corner, creating one only if no match exists.
//
// The key is (levelId, viewId, body) and NOT the coordinate, which is the part
// worth testing hardest. Two walls can sit on exactly the same point and still
// belong to different buildings; folding them together is how a garage splices
// into a house. Every check below that looks like it is about coordinates is
// really about that.
//
// Separate file from wall-joins-harness.js on purpose: the two functions share
// geometry-2d.js and share nothing else, and one harness per concern keeps a
// mutation table readable.
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'geometry-2d.js');

// Argument handling is shared: proto/harness-args.js. Both --coverage and
// --mutate work here, and anything else exits 2 rather than running the wrong
// mode quietly. That module is require()d, not source-loaded -- see its header
// for why it is the one file here that must not be mutable by the tests.
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
  return window.DraftGeometry2D;
}

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── Identity, which is the entire point ──
check('the same corner of the same wall body returns ONE object', G => {
  const pool = [];
  const a = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  const b = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  return [a === b, true];
});

check('and the pool holds one entry, not two', G => {
  const pool = [];
  G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  return [pool.length, 1];
});

// ── The three key fields, each on its own ──
// Separate checks rather than one combined fixture: a single check asserting
// "different keys give different objects" passes with any ONE of the three
// fields still in the key.
check('a different LEVEL at the same point is a different corner', G => {
  const pool = [];
  const a = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  const b = G.mergeVertex(pool, { x: 10, z: 0 }, 1, 'plan', 'house');
  return [a === b, false];
});

check('a different LAYER SET at the same point is a different corner', G => {
  const pool = [];
  const a = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  const b = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'foundation', 'house');
  return [a === b, false];
});

check('a different BODY at the same point is a different corner', G => {
  const pool = [];
  const a = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  const b = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'garage');
  return [a === b, false];
});

// THE CASE THE NORMALISER'S COLLAPSE USED TO BREAK. drawing-format.js dropped
// every body but 'garage', so a shed wall arrived with none and pooled as
// house. The pool itself was always right about this; the check pins it so the
// fix cannot rot back from the other end.
check('a body the app has never assigned pools on its OWN, not as house', G => {
  const pool = [];
  const house = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  const garage = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'garage');
  const shed = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'shed');
  return [shed !== house && shed !== garage && pool.length === 3, true];
});

check('an omitted body is house, so untagged walls still join each other', G => {
  const pool = [];
  const a = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan');
  const b = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  return [a === b, true];
});

// ── The proximity threshold, at its boundary rather than in the middle ──
// A control far inside the threshold would only prove that identical points
// merge, which was never in doubt.
check('float dust inside the threshold is the same corner', G => {
  const pool = [];
  const a = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  const b = G.mergeVertex(pool, { x: 10.0009, z: 0 }, 3, 'plan', 'house');
  return [a === b, true];
});

check('a real gap outside the threshold is not', G => {
  const pool = [];
  const a = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  const b = G.mergeVertex(pool, { x: 10.01, z: 0 }, 3, 'plan', 'house');
  return [a === b, false];
});

check('the threshold applies on BOTH axes, not just x', G => {
  const pool = [];
  const a = G.mergeVertex(pool, { x: 10, z: 0 }, 3, 'plan', 'house');
  const b = G.mergeVertex(pool, { x: 10, z: 0.01 }, 3, 'plan', 'house');
  return [a === b, false];
});

// ── What the returned object carries ──
check('the corner keeps the coordinates it was given', G => {
  const pool = [];
  const v = G.mergeVertex(pool, { x: 3.5, z: -7.25 }, 3, 'plan', 'house');
  return [`${v.x},${v.z}`, '3.5,-7.25'];
});

check('a missing y is 0 rather than undefined, so arithmetic on it is safe', G => {
  const pool = [];
  const v = G.mergeVertex(pool, { x: 0, z: 0 }, 3, 'plan', 'house');
  return [v.y, 0];
});

check('a non-finite y is 0 too', G => {
  const pool = [];
  const v = G.mergeVertex(pool, { x: 0, z: 0, y: NaN }, 3, 'plan', 'house');
  return [v.y, 0];
});

// ── Run ──
function run(G) {
  const failing = [];
  for (const c of CHECKS) {
    let got, want;
    try { [got, want] = c.fn(G); } catch (err) { got = `threw: ${err.message}`; want = '(no throw)'; }
    if (got !== want) failing.push({ ...c, got, want });
  }
  return failing;
}

const baseline = run(load());
for (const c of CHECKS) {
  const bad = baseline.find(f => f.label === c.label);
  console.log(`  ${bad ? 'FAIL' : 'ok  '}  ${c.label}${bad ? `   got ${JSON.stringify(bad.got)}, want ${JSON.stringify(bad.want)}` : ''}`);
}
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

// Each mutation must change what the code COMPUTES, not merely what it says.
// A mutation the surrounding guards make unreachable survives every check and
// reports a gap that is not there -- see BOARDS standing rule 10.
const MUTATIONS = [
  ['level dropped from the key (two storeys share a corner)',
    s => s.replace('v._draftLevelId === levelId', 'true')],
  ['layer set dropped from the key (foundation joins plan)',
    s => s.replace('v._draftViewId === viewId', 'true')],
  ['body dropped from the key (a garage splices into a house)',
    s => s.replace('v._draftBody === body', 'true')],
  ['threshold widened until distinct corners merge',
    s => s.replace('const THRESH = 0.001;', 'const THRESH = 100;')],
  ['threshold closed until nothing ever merges',
    s => s.replace('const THRESH = 0.001;', 'const THRESH = 0;')],
  ['pool never consulted, so every call mints a new corner',
    s => s.replace('for (const v of pool) {', 'for (const v of []) {')],
  ['default body removed, so untagged walls stop joining each other',
    s => s.replace("body = 'house') {", 'body) {')],
];

if (MUTATION_MODE) {
  // TWO THINGS THIS LOOP REFUSES TO CALL A PASS. Shape ported from
  // outline-accessors-harness.js, where both were found by forcing them.
  //
  // A MUTATION THAT WILL NOT APPLY IS NOT A CAUGHT MUTATION. The older shape
  // of this loop turned the load() throw into a `caught` entry -- the counter
  // for "a check noticed" -- so a drifted anchor printed "load: mutation
  // matched nothing" IN THE CAUGHT COLUMN, kept the total at N/N, and exited
  // 0. Measured by pointing one replace at text that does not exist. Broken
  // mutations are counted separately, shown in the table, and are fatal.
  //
  // AN EMPTY LIST IS NOT A CLEAN SWEEP. With no mutations this printed "0/0
  // mutations caught" and exited 0: the absence-that-reads-as-a-pass this
  // harness exists to prevent, one layer in.
  console.log('\n' + 'mutation'.padEnd(58) + 'caught by');
  let survivors = 0;
  let broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let caught, by;
    try {
      caught = run(load(mutate));
      if (!caught.length) survivors += 1;
      by = caught.length ? caught.map(m => m.label).join('\n' + ' '.repeat(58)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(58)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
