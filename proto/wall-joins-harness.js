// geometry-2d.js wallJoins — how does the drafter's wall meet its neighbour?
//
// The classifier the wall painter reads. It was inline in MODEL.dc.html and
// therefore reachable only by the old page: MODEL.html passes joins = null, so
// every corner on the new page is a butt joint.
//
// Sharing this is HALF that debt. The other half is the vertex pool: identity
// is the key here, and MODEL.html builds walls off parsed JSON, which restores
// values rather than references -- so its coincident corners are separate
// objects and this returns an empty Map. The check below named
// "coincident endpoints in separate objects do not join" is the proof, and it
// is the obstacle as much as the invariant.
//
// The four kinds it emits are miter, tee, continuation and multi. It never
// emits `none`; the painter honours that defensively and nothing produces it.
// Naming that here because a dictionary entry claiming a fifth kind, and a
// first kind called `corner`, both survived half a day -- the painter mitres
// anything it does not recognise, so a wrong name paints correctly and no
// test can tell. Read the names off THIS function.
//
// Run: node proto/wall-joins-harness.js         (checks)
//      node proto/wall-joins-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'geometry-2d.js');

// Argument handling is shared: proto/harness-args.js. Both --coverage and
// --mutate work here, and anything else exits 2 rather than running the wrong
// mode quietly. That module is require()d, not source-loaded -- see its header
// for why it is the one file here that must not be mutable by the tests.
const MUTATION_MODE = require('./harness-args.js').mutationMode();

// Load from SOURCE TEXT, not require(). To be exact about what that buys,
// because the looser version of this claim is wrong: require() does NOT stop a
// mutant reaching the module. Edit geometry-2d.js on disk and re-run, and the
// harness reads the mutant -- measured, not assumed. What require() stops is a
// harness carrying its own mutations IN PROCESS. The module is resolved and
// evaluated once, before any check runs, so mutations have to be applied from
// outside by hand, and they leave nothing behind in the repo.
//
// That is the difference between this file before and after. It was not
// unmutatable; it was unmeasured, and nothing had ever measured it. A green
// harness is not evidence that it measures anything -- the committed, rerunnable
// mutation table below is.
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

// Endpoints are SHARED POINT OBJECTS. That identity is the whole mechanism.
const P = (x, z) => ({ x, z });
const wall = (a, b) => ({ start: a, end: b });

// Every check is a named closure over G, so the same set can be re-run against
// each mutant to see which checks notice it.
const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });
const kindAt = (G, walls, pt) => {
  const join = G.wallJoins(walls).get(pt);
  return join ? join.type : 'none';
};

// ── The four kinds ──
const o = P(0, 0), e = P(10, 0), n = P(10, 10), w = P(-10, 0), s = P(10, -10);

check('two walls at a right angle mitre',
  G => [kindAt(G, [wall(o, e), wall(e, n)], e), 'miter']);

check('two walls running straight on continue',
  G => [kindAt(G, [wall(o, e), wall(e, P(20, 0))], e), 'continuation']);

check('a stem into a through-host is a tee',
  G => [kindAt(G, [wall(w, e), wall(e, P(20, 0)), wall(e, n)], e), 'tee']);

check('four arms is a multi, with no unambiguous pair to mitre',
  G => [kindAt(G, [wall(w, e), wall(e, P(20, 0)), wall(e, n), wall(e, s)], e), 'multi']);

// ── What it refuses to classify ──
check('a lone wall end is no join at all',
  G => [kindAt(G, [wall(o, e)], e), 'none']);

// COINCIDENT IS NOT JOINED. Two walls at the same coordinate holding SEPARATE
// point objects never splice -- this is what keeps a garage wall independent of
// the house wall it sits on, and the reason the map is keyed by object.
const houseCorner = P(10, 0), garageCorner = P(10, 0);
check('coincident endpoints in separate objects do not join',
  G => [kindAt(G, [wall(o, houseCorner), wall(garageCorner, n)], houseCorner), 'none']);
check('and neither does the other one',
  G => [kindAt(G, [wall(o, houseCorner), wall(garageCorner, n)], garageCorner), 'none']);

// ── Both answers at ONE coordinate, in ONE call ──
// The two checks above float their unshared walls in a fixture with nothing
// shared in it, so they only ever ask for one answer. The drawing that is
// actually at stake is a garage abutting a house: at (10,0) the two house
// walls share a corner object and must mitre, while the garage wall holds its
// own object at the same coordinate and must stay butt-jointed. One call, one
// coordinate, two answers -- which is the shape the vertex-pool lift has to
// preserve, and the shape a pool that splices on proximity cannot produce.
//
// Measured, it catches the same mutant the two floating checks above do and
// no other: it is not buying a new discriminator. What it buys is a failure
// that looks like the drawing, so whoever breaks it reads the fixture and
// sees a garage against a house rather than two abstract segments.
const houseC = P(10, 0), garageC = P(10, 0);
const abutting = [
  wall(P(0, 0), houseC),      // house, running east into the corner
  wall(houseC, P(10, 10)),    // house, turning north out of it
  wall(garageC, P(10, -10)),  // garage, its own corner at the same spot
];
check('the shared house corner mitres while the garage sits on it',
  G => [kindAt(G, abutting, houseC), 'miter']);
check('and the garage corner beside it stays unjoined',
  G => [kindAt(G, abutting, garageC), 'none']);

// ── The angle thresholds, at the boundary rather than the middle ──
// Near-collinear but not collinear is still a mitre: the classifier asks
// whether the cross product clears 0.001, not whether it looks straight.
const nearlyStraight = P(20, 0.5);
check('a shallow bend is a mitre, not a continuation',
  G => [kindAt(G, [wall(o, e), wall(e, nearlyStraight)], e), 'miter']);

// Collinear is not the same as opposed. Two walls leaving the SAME corner in
// the SAME direction -- an overlap, or a wall doubled back over its neighbour --
// have a zero cross product like a continuation does, but they do not continue
// anything: nothing runs through the vertex. Only the dot-product test tells
// the two apart, and without this check that test can be deleted outright.
check('two walls leaving a corner in the same direction do not continue',
  G => [kindAt(G, [wall(e, P(20, 0)), wall(e, P(30, 0))], e), 'none']);

// A degenerate wall has no direction, so it cannot classify anything.
check('a zero-length wall yields no join',
  G => [kindAt(G, [wall(o, e), wall(e, P(10, 0))], e), 'none']);

// ...and the threshold is 0.001 ft, not zero. At exactly zero the arithmetic
// yields NaN, and every comparison against NaN is false, so the guard and its
// absence agree by accident -- the check above cannot see the guard at all.
// A wall shorter than the threshold is where it becomes visible: it must not
// steer a mitre, however clean its angle looks.
check('a wall shorter than the direction threshold still has no direction',
  G => [kindAt(G, [wall(o, e), wall(e, P(10, 0.0005))], e), 'none']);

// ── Three arms that are not a tee ──
// A tee needs two arms in near-opposition to act as the host. Three arms at
// 120 degrees have no host pair, so the vertex is left unclassified rather
// than guessed at.
const a120 = P(10 + Math.cos(Math.PI * 2 / 3) * 10, Math.sin(Math.PI * 2 / 3) * 10);
const b120 = P(10 + Math.cos(-Math.PI * 2 / 3) * 10, Math.sin(-Math.PI * 2 / 3) * 10);
check('three arms with no opposed pair is not a tee',
  G => [kindAt(G, [wall(e, P(20, 0)), wall(e, a120), wall(e, b120)], e), 'none']);

// ── Run ──
function run(G) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(G); } catch (err) { got = `threw ${err.message}`; want = null; }
    if (got !== want) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}, want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

// ── Mutations ──
// Each entry breaks one decision in wallJoins. A mutation no check notices is
// a gap, however green the run above is. The last one models the bug the
// vertex-pool lift could introduce: splicing endpoints that merely share a
// coordinate.
const MUTATIONS = [
  ['cross-product threshold accepts anything (all bends mitre)',
    s => s.replace('Math.abs(a.x * b.z - a.z * b.x) > 0.001', 'Math.abs(a.x * b.z - a.z * b.x) > -1')],
  // This branch is only REACHED by (anti)parallel arms -- a bent pair leaves via
  // the miter arm above -- so the only thing it decides is opposed vs. same
  // direction. The mutant must clear +1 to loosen it; `< 1` would be a no-op
  // dressed as a mutation, and would have reported a gap that is not there.
  ['collinearity test accepts any parallel pair (same direction continues)',
    s => s.replace('a.x * b.x + a.z * b.z < -0.995', 'a.x * b.x + a.z * b.z < 2')],
  ['two-arm branch also swallows three arms',
    s => s.replace('if (entries.length === 2) {', 'if (entries.length >= 2) {')],
  ['tee opposition threshold accepts any three arms',
    s => s.replace('strongestOpposition > 0.995', 'strongestOpposition > -2')],
  ['multi branch never fires',
    s => s.replace('if (entries.length >= 4) {', 'if (entries.length >= 5) {')],
  ['degenerate walls are given a direction anyway',
    s => s.replace('len < 0.001 ? null', 'len < -1 ? null')],
  ['endpoints are grouped by COORDINATE instead of identity',
    s => s.replace('const add = (seg, pt, at) => {',
      'const canon = new Map();\n    const add = (seg, pt0, at) => {\n      const ck = pt0.x + "," + pt0.z;\n      if (!canon.has(ck)) canon.set(ck, pt0);\n      const pt = canon.get(ck);')],
];

if (MUTATION_MODE) {
  // TWO THINGS THIS LOOP REFUSES TO CALL A PASS. Shape ported from
  // outline-accessors-harness.js, where both were found by forcing them.
  //
  // A MUTATION THAT WILL NOT APPLY IS NOT A CAUGHT MUTATION. The older shape
  // of this loop turned the load() throw into a `missed` entry -- the counter
  // for "a check noticed" -- so a drifted anchor printed "load: mutation
  // matched nothing" IN THE CAUGHT COLUMN, kept the total at N/N, and exited
  // 0. Measured by pointing one replace at text that does not exist. Broken
  // mutations are counted separately, shown in the table, and are fatal.
  //
  // AN EMPTY LIST IS NOT A CLEAN SWEEP. With no mutations this printed "0/0
  // mutations caught" and exited 0: the absence-that-reads-as-a-pass this
  // harness exists to prevent, one layer in.
  console.log('\n' + 'mutation'.padEnd(74) + 'caught by');
  let survivors = 0;
  let broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let missed, by;
    try {
      missed = run(load(mutate));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(74)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(74)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
