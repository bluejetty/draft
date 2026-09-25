// WHERE TWO ROOFS MEET IN ONE PLANE THERE IS NO LINE BETWEEN THEM.
//
// Movie, 24 Sep, on the 2 STOREY once the tie piece was built, with two shots
// marked in the same place -- the E4 elevation and the ROOF PLAN:
//
//   "your updated roof has an extra line in it, that should be all one
//    connected roof"
//
// The elevation's half was answered inside cut-view by `carriedOn`, which can
// turn a roof into an absolute elevation because it holds a wall stack. THE
// PLAN HOLDS NO STACK. It has the roof records and nothing else, so the same
// fact has to be decided from `plateHeightFt` plus the face's own rise --
// which is the whole of a roof's height and is carried on the record.
//
// SO THIS IS THE PLAN'S HALF, and it is measured against a REAL BUILD rather
// than a shape typed here. proto/repro-tie-gable.draft is what the drive-thru
// writes for 2 STOREY + GARAGE; every number below was read off it, and if
// the design moves, these fail loudly rather than quietly agreeing with a
// constant that moved with them.
//
// WHAT THE PAINTER DOES WITH THE ANSWER is proto/render-2d-harness.js's
// business, not this file's. Here: which stretches, and why not the others.
//
// Run: node proto/geometry-2d-weld-harness.js          (checks)
//      node proto/geometry-2d-weld-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'geometry-2d.js');
const FIXTURE = path.join(ROOT, 'proto', 'repro-tie-gable.draft');
const MUTATION_MODE = require('./harness-args.js').mutationMode();

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    if (mutate(next) !== next) {
      throw new Error('mutation anchor matches more than once -- replace() takes '
        + 'the FIRST, which may not be the code the mutation is named for');
    }
    src = next;
  }
  const window = {};
  new Function('window', src)(window);
  return window.DraftGeometry2D;
}

const roofs = () => JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).roofs || [];

// THE THREE ROOFS BY WHAT THEY ARE, never by index or id. The ids are
// whatever the id counter was at when the fixture was rebuilt, and an index
// is whatever order the committer pushed them in; both have already changed
// once. The house is the one with no plate of its own, the tie piece is the
// small one, and the stub is the other garage roof.
const named = list => {
  const house = list.find(r => !Number.isFinite(Number(r.plateHeightFt)));
  const garage = list.filter(r => r !== house);
  const area = r => {
    const xs = r.points.map(p => p.x), zs = r.points.map(p => p.z);
    return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
  };
  const tie = garage.slice().sort((a, b) => area(a) - area(b))[0];
  return { house, tie, stub: garage.find(r => r !== tie) };
};

// A weld, printed as the two WORLD points it runs between, so a failure names
// a place in the building rather than a pair of edge parameters.
const weldsOf = (G, roof, list) => G.roofWeldSpans(roof, list)
  .flatMap((spans, index) => {
    const a = roof.points[index], b = roof.points[(index + 1) % roof.points.length];
    const at = t => `(${+(a.x + (b.x - a.x) * t).toFixed(3)},${+(a.z + (b.z - a.z) * t).toFixed(3)})`;
    return spans.map(([t0, t1]) => `e${index} ${at(t0)}->${at(t1)}`);
  }).join(' | ');

const CHECKS = [
  // ── THE SEAM MOVIE MARKED ────────────────────────────────────────────
  {
    label: 'the stub s rear edge is welded ONLY where the tie piece carries it on',
    fn: G => {
      const list = roofs(); const { stub } = named(list);
      return [weldsOf(G, stub, list), 'e0 (16,20)->(22,20)'];
    },
  },
  {
    label: 'and the other twenty-two feet of that same edge stay drawn',
    fn: G => {
      // The edge runs (-6,20)->(22,20). Six feet welded leaves twenty-two,
      // and THAT is the half the house roof sits under at a different plate.
      const list = roofs(); const { stub } = named(list);
      const spans = G.roofWeldSpans(stub, list)[0];
      const welded = spans.reduce((sum, [t0, t1]) => sum + (t1 - t0), 0) * 28;
      return [`${+welded.toFixed(3)} of 28`, '6 of 28'];
    },
  },
  {
    label: 'the tie s own edge against the stub is welded end to end',
    fn: G => {
      const list = roofs(); const { tie } = named(list);
      return [weldsOf(G, tie, list), 'e2 (22,20)->(16,20)'];
    },
  },
  {
    label: 'six feet welded is ONE stretch, not a run of touching pieces',
    fn: G => {
      const list = roofs(); const { stub } = named(list);
      return [G.roofWeldSpans(stub, list)[0].length, 1];
    },
  },
  // ── AND EVERYTHING THAT MUST NOT WELD ────────────────────────────────
  {
    label: 'the house roof welds to nothing, though the garage lies across it',
    fn: G => {
      // #32 put the garage roof OVER the house on purpose: they overlap for
      // twenty-two feet of z=20 and agree nowhere in height. A weld here
      // would erase the lap Movie asked for.
      const list = roofs(); const { house } = named(list);
      return [weldsOf(G, house, list) || '(none)', '(none)'];
    },
  },
  {
    label: 'a different plate is a different sheet, whatever the footprints do',
    fn: G => {
      const list = roofs(); const { stub, tie } = named(list);
      const lifted = { ...tie, plateHeightFt: Number(tie.plateHeightFt) + 1 };
      return [weldsOf(G, stub, [stub, lifted]) || '(none)', '(none)'];
    },
  },
  {
    label: 'and so is a different pitch, off the same plate',
    fn: G => {
      const list = roofs(); const { stub, tie } = named(list);
      return [weldsOf(G, stub, [stub, { ...tie, pitch: (tie.pitch || 4) + 2 }]) || '(none)', '(none)'];
    },
  },
  {
    label: 'a roof on its own has nothing to weld to',
    fn: G => {
      const list = roofs(); const { stub } = named(list);
      return [weldsOf(G, stub, [stub]) || '(none)', '(none)'];
    },
  },
  {
    label: 'a roof that touches at a corner only is not welded along anything',
    fn: G => {
      // The stub's x=22 eave and the tie's x=22 eave are collinear and meet
      // at (22,20) -- they touch at one point and overlap over none. A test
      // that asked "is the neighbour there" rather than "over what stretch"
      // would weld the whole outer eave and lose the roof's right-hand edge.
      const list = roofs(); const { stub } = named(list);
      return [G.roofWeldSpans(stub, list)[1].length, 0];
    },
  },
  {
    label: 'a degenerate roof answers per edge rather than throwing',
    // ONE ENTRY PER POINT, even here: the painter indexes the answer by edge
    // and a short array would silently leave the last edges unwelded-by-luck
    // rather than unwelded-by-decision.
    fn: G => [JSON.stringify(G.roofWeldSpans({ points: [{ x: 0, z: 0 }, { x: 1, z: 0 }] }, roofs())), '[[],[]]'],
  },
  // ── AND WHAT THE FIXTURE ALONE CANNOT ASK ────────────────────────────
  //
  // THE MUTATION TABLE FOUND THIS, which is what it is for. Every roof in the
  // fixture that survives the plate-and-pitch filter is ALSO coplanar, so the
  // filter was quietly doing all the work: dropping the height comparison
  // altogether, or widening its tolerance to a foot, changed not one answer
  // and the table showed two mutations strolling through. A check that passes
  // because of a condition it is not testing is not a check.
  //
  // So these two are built here rather than read off a build: a pair that the
  // filter waves through and the geometry must part.
  //
  // THE SHAPE is the tie piece's -- three gables and one eave, which the
  // skeleton resolves to a single plane falling to that eave. Same plate,
  // same pitch, eaves TWO FEET apart, so the two planes run parallel 0.667 ft
  // apart (2 ft of run at 4/12) everywhere they meet.
  {
    label: 'same plate, same pitch, planes a step apart: no weld',
    fn: G => {
      const shed = (points, eave) => ({
        points, pitch: 4, plateHeightFt: 8,
        edges: points.map((_, i) => (i === eave ? 'eave' : 'gable')),
      });
      const lower = shed([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 6 }, { x: 0, z: 6 }], 1);
      const apart = shed([{ x: 0, z: 6 }, { x: 12, z: 6 }, { x: 12, z: 12 }, { x: 0, z: 12 }], 1);
      return [weldsOf(G, lower, [lower, apart]) || '(none)', '(none)'];
    },
  },
  {
    label: 'and the same pair with ONE eave line welds along all of it',
    fn: G => {
      // The control. Move the second roof's eave onto the first's and the
      // two are one sheet -- so the check above is measuring the step, not
      // some other reason the answer came back empty.
      const shed = (points, eave) => ({
        points, pitch: 4, plateHeightFt: 8,
        edges: points.map((_, i) => (i === eave ? 'eave' : 'gable')),
      });
      const lower = shed([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 6 }, { x: 0, z: 6 }], 1);
      const level = shed([{ x: 0, z: 6 }, { x: 10, z: 6 }, { x: 10, z: 12 }, { x: 0, z: 12 }], 1);
      return [weldsOf(G, lower, [lower, level]), 'e2 (10,6)->(0,6)'];
    },
  },
  {
    label: 'a neighbour s own mid-edge corner splits the run, and it comes back whole',
    fn: G => {
      // THE OTHER THING THE TABLE FOUND. The fixture never exercises the
      // coalescing at all: the breakpoints come only from roofs that passed
      // the filter, and the one that splits the garage's run at x=18 is the
      // HOUSE, which the plate parts first. So the merge was dead code under
      // test, and a mutation that removed it strolled through.
      //
      // A footprint with a point partway along an edge is ordinary -- a
      // garage splice leaves them -- and it is what really splits a run.
      const shed = (points, eave) => ({
        points, pitch: 4, plateHeightFt: 8,
        edges: points.map((_, i) => (i === eave ? 'eave' : 'gable')),
      });
      const main = shed([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 20 }, { x: 0, z: 20 }], 1);
      const below = shed([{ x: 0, z: -6 }, { x: 10, z: -6 }, { x: 10, z: 0 },
        { x: 5, z: 0 }, { x: 0, z: 0 }], 1);
      const spans = G.roofWeldSpans(main, [main, below])[0];
      return [`${spans.length} stretch, ${weldsOf(G, main, [main, below])}`,
        '1 stretch, e0 (0,0)->(10,0)'];
    },
  },
  {
    label: 'two sheds falling into a shared VALLEY keep the line between them',
    fn: G => {
      // THE MUTATION TABLE FOUND THIS TOO, and it was a live defect rather
      // than a missing check. `roofFaceRise` measures the absolute distance
      // from the eave line, so my plane carried past my OWN eave turns back
      // upward at exactly the rate a neighbour on the far side rises. Same
      // plate, same pitch, one shared eave line at x=10: the heights agree
      // to the last decimal at every probe distance, and the valley -- a
      // real line, and the lowest one on the building -- was welded away.
      const shed = (points, eave) => ({
        points, pitch: 4, plateHeightFt: 8,
        edges: points.map((_, i) => (i === eave ? 'eave' : 'gable')),
      });
      const west = shed([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 6 }, { x: 0, z: 6 }], 1);
      const east = shed([{ x: 10, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 6 }, { x: 10, z: 6 }], 3);
      return [`${weldsOf(G, west, [west, east]) || '(none)'} / ${weldsOf(G, east, [west, east]) || '(none)'}`,
        '(none) / (none)'];
    },
  },
  {
    label: 'a roof riding its own stack never welds to one naming a plate of zero',
    fn: G => {
      // WHAT THE PLATE FILTER IS REALLY FOR. `plateHeightFt` absent means
      // "ask the wall stack", which the plan cannot do; read as the number
      // zero it would weld a house roof to anything bearing at grade. The
      // two below are the same sheet in every other respect, so only the
      // filter parts them.
      const shed = (points, eave, plate) => ({
        points, pitch: 4, edges: points.map((_, i) => (i === eave ? 'eave' : 'gable')),
        ...(plate === null ? {} : { plateHeightFt: plate }),
      });
      const onStack = shed([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 6 }, { x: 0, z: 6 }], 1, null);
      const atGrade = shed([{ x: 0, z: 6 }, { x: 10, z: 6 }, { x: 10, z: 12 }, { x: 0, z: 12 }], 1, 0);
      return [weldsOf(G, onStack, [onStack, atGrade]) || '(none)', '(none)'];
    },
  },
  {
    label: 'and two roofs off the same shared eave at DIFFERENT pitches keep theirs',
    fn: G => {
      // At the shared eave both rises are zero, so height alone calls them
      // one sheet along the whole line -- which is the ridge or valley they
      // actually make. The pitch filter is what parts them.
      const shed = (points, eave, pitch) => ({
        points, pitch, plateHeightFt: 8,
        edges: points.map((_, i) => (i === eave ? 'eave' : 'gable')),
      });
      const shallow = shed([{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 6 }, { x: 0, z: 6 }], 1, 4);
      const steep = shed([{ x: 10, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 6 }, { x: 10, z: 6 }], 3, 8);
      return [weldsOf(G, shallow, [shallow, steep]) || '(none)', '(none)'];
    },
  },
  // ── THE RISE LOOKUP THE WELD IS DECIDED ON ───────────────────────────
  {
    label: 'roofRiseAt reads the tie s plane off its single eave at x=22',
    fn: G => {
      const { tie } = named(roofs());
      // 4/12 off the x=22 eave: three feet in is one foot up, six is two.
      const at = x => +G.roofRiseAt(tie, { x, z: 18.5 }).toFixed(4);
      return [`${at(19)} ${at(16.5)}`, '1 1.8333'];
    },
  },
  {
    label: 'and answers null off the roof, rather than a number from nowhere',
    fn: G => {
      const { tie } = named(roofs());
      return [G.roofRiseAt(tie, { x: 40, z: 40 }), null];
    },
  },
];

// ── Mutations ──
// Each one is a plausible way to get this wrong, and the table is the proof
// the checks above bite. A survivor is a check that is not really asking.
const MUTATIONS = [
  ['the plate is not compared -- every roof is the same sheet',
    s => s.replace('    && samePlate(plateOf(other))\n', '    && (samePlate(plateOf(other)) || true)\n')],
  // NOR IS 'the pitch is not compared' HERE, for the same kind of reason as
  // the nudge below, and it is worth saying which filter earns its keep. The
  // PLATE filter does: absent means "ask the wall stack", and read as zero it
  // welds a house roof to anything bearing at grade -- 'a roof riding its own
  // stack' measures exactly that. The PITCH filter does not: two planes off
  // one eave line at different pitches are already parted by their heights
  // everywhere except AT the eave, and at the eave the valley guard parts
  // them first. It stays because it is the cheap test -- it spares building
  // a skeleton and its faces for a roof that cannot match -- and because it
  // says what "the same sheet" means. Not because an answer turns on it.
  ['the probe steps INTO this roof instead of out of it',
    s => s.replace('      const out = { x: on.x + nx * ROOF_WELD_NUDGE_FT, z: on.z + nz * ROOF_WELD_NUDGE_FT };',
      '      const out = { x: on.x - nx * ROOF_WELD_NUDGE_FT, z: on.z - nz * ROOF_WELD_NUDGE_FT };')],
  ['the outward normal is never flipped, so winding decides which way is out',
    s => s.replace('    if (inRing({ x: (a.x + b.x) / 2 + nx * ROOF_WELD_NUDGE_FT,\n      z: (a.z + b.z) / 2 + nz * ROOF_WELD_NUDGE_FT })) { nx = -nx; nz = -nz; }',
      '    if (false) { nx = -nx; nz = -nz; }')],
  ['a neighbour anywhere near counts, without comparing heights',
    s => s.replace('        return rise !== null && Math.abs(mate.plate + rise - myElev) < ROOF_WELD_TOL_FT;',
      '        return rise !== null;')],
  ['the valley guard is dropped -- a mirrored plane counts as a carried-on one',
    s => s.replace('      if (sideOf(inn) * sideOf(out) <= 1e-12) continue;', '')],
  ['the tolerance is a foot, so planes a step apart read as one',
    s => s.replace('const ROOF_WELD_TOL_FT = 0.01;', 'const ROOF_WELD_TOL_FT = 1;')],
  ['only whole edges weld -- the breakpoints are dropped',
    s => s.replace('    const cuts = [...new Set(ts.map(t => Math.round(t * 1e9) / 1e9))].sort((p, q) => p - q);',
      '    const cuts = [0, 1];')],
  ['touching welds are left as two stretches',
    s => s.replace('      if (last && Math.abs(last[1] - cuts[k]) < 1e-9) last[1] = cuts[k + 1];\n      else welds.push([cuts[k], cuts[k + 1]]);',
      '      welds.push([cuts[k], cuts[k + 1]]);')],
  // NOT IN THIS TABLE, and the reason is worth more than the row would be:
  // reading MY plane at the edge rather than a nudge past it cannot change an
  // answer. Two sheets are coplanar only when they share an eave LINE, and a
  // roof whose eave is a given line cannot stop short of it -- so an edge that
  // can weld at all is never parallel to the eave, and a step across it
  // changes the rise by nothing. The nudge is there for the NEIGHBOUR's sake,
  // where it decides a point-in-polygon on a boundary, and that is what 'the
  // probe steps INTO this roof instead of out of it' measures.
  ['roofRiseAt answers zero off the roof rather than null',
    s => s.replace('    if (inside) return roofFaceRise(face, p, roof.pitch || 4);\n  }\n  return null;',
      '    if (inside) return roofFaceRise(face, p, roof.pitch || 4);\n  }\n  return 0;')],
];

// ── Run ──
function run(G) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(G); } catch (err) { got = `THREW: ${err.message}`; want = '(no throw)'; }
    if (String(got) !== String(want)) missed.push({ label, got, want });
  }
  return missed;
}

if (!fs.existsSync(FIXTURE)) {
  console.log('proto/repro-tie-gable.draft is missing -- nothing to measure against');
  process.exit(1);
}

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}, want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

if (MUTATION_MODE) {
  console.log('\n' + 'mutation'.padEnd(66) + 'caught by');
  let survivors = 0, broken = 0;
  for (const [label, mutate] of MUTATIONS) {
    let missed, by;
    try {
      missed = run(load(mutate));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(66)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(66)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  process.exit(baseline.length || survivors || broken ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
