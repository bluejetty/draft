// cut-marks.js — where the section lines and their bubbles land on the plan.
//
// The two answers drawCutMarks2D asks its caller for: the four standard
// elevation marks ringing the house, and how far a hand-placed cut runs before
// its bubbles sit down. Both were methods on MODEL.dc.html's component until
// this module, so only that page could draw a cut.
//
// THE EXTRACTION WAS PROVED BY A DIFFERENTIAL, run once while both copies
// existed: 32256 comparisons -- six wall sets, six dimension sets, seven
// offset maps including null, NaN, Infinity and a string, both
// auto-elevation states, four gap values and eight ray directions -- module
// against the live methods, identical. That check is not here and must not be:
// MODEL.dc.html delegates now, so the same comparison would be the module
// against itself, and a check that reads the thing it is checking cannot fail.
//
// One thing the differential's own guard taught, worth repeating because it
// is the third time a line range has lied in this migration: the guard
// asserted that each extracted window starts with the method it claims and
// closes at depth zero -- and _autoElevationsOn was left OFF that list and was
// the one window that was wrong. A guard only covers what it is pointed at.
//
// What is here is the CONTRACT: the marks ring the house outside its
// dimension strings, and a cut line clips to the plan or falls back to its
// own drawn ends. Plus one check that MODEL.dc.html still delegates.
//
// Run: node proto/cut-marks-harness.js          (checks)
//      node proto/cut-marks-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'cut-marks.js');
const MODEL_DC = path.join(__dirname, '..', 'MODEL.dc.html');
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
  return window.DraftCutMarks;
}

const W = (id, x0, z0, x1, z1, lv = 3) =>
  ({ id, levelId: lv, start: { x: x0, y: 0, z: z0 }, end: { x: x1, y: 0, z: z1 } });
const D = (x0, z0, x1, z1, lv = 3) =>
  ({ levelId: lv, start: { x: x0, z: z0 }, end: { x: x1, z: z1 } });
const round = n => Math.round(n * 1e6) / 1e6;

// A 30 x 24 house on MAIN, drawn from the origin.
const HOUSE = [W('a', 0, 0, 30, 0), W('b', 30, 0, 30, 24), W('c', 30, 24, 0, 24), W('d', 0, 24, 0, 0)];
const cuts = (G, over = {}) => G.autoElevationCuts({
  walls: HOUSE, dimensions: [], elevationMarkOffsets: {}, autoElevations: true, ...over });
const byId = (G, id, over) => cuts(G, over).find(c => c.id === id);

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── planWallExtents: the box everything else is measured from ──
check('the box is the house',
  G => [JSON.stringify(G.planWallExtents(HOUSE)),
        JSON.stringify({ minX: 0, maxX: 30, minZ: 0, maxZ: 24 })]);

// WHAT IT IS GIVEN IS WHAT IT MEASURES. This used to assert the opposite --
// that the module filtered the boneyard out itself -- and that second,
// blinder filter is what Movie's porch case killed on 6 Sep. The caller
// (_activeWalls on the bone, walls() on MODEL.html) decides visibility in one
// place; the module must not second-guess it, or the two rules drift and the
// call site cannot see which one won.
check('a wall it is handed is measured, whatever level it claims',
  G => [JSON.stringify(G.planWallExtents([...HOUSE, W('shelf', -500, -500, -480, -480, 0)])),
        JSON.stringify({ minX: -500, maxX: 30, minZ: -500, maxZ: 24 })]);

check('and a wall it is not handed cannot move anything',
  G => [JSON.stringify(G.planWallExtents(HOUSE)),
        JSON.stringify({ minX: 0, maxX: 30, minZ: 0, maxZ: 24 })]);

// THE PORCH, which is the drawing the rule came from. A frost wall 8 ft in
// front of the house, drawn on FOUNDATION to carry the porch posts. On the
// MAIN FL plan the caller does not hand it over, so E1 stays against the
// house instead of standing in the front yard.
const PORCH_FROST = W('porch', 0, -8, 30, -8);
check('the porch frost wall moves E1 when the view shows it',
  G => [G.autoElevationCuts({ walls: [...HOUSE, PORCH_FROST], dimensions: [],
          elevationMarkOffsets: {}, autoElevations: true })
        .find(c => c.id === 'E3').startPt.z < -8, true]);

check('and leaves it alone when the view does not',
  G => [G.autoElevationCuts({ walls: HOUSE, dimensions: [],
          elevationMarkOffsets: {}, autoElevations: true })
        .find(c => c.id === 'E3').startPt.z > -8, true]);

// The same box feeds the hand-placed cut lines, so the porch stretched those
// too. One filter, two symptoms -- and this is the half nobody would have
// looked for.
check('the porch stretched hand-placed cut lines as well, and no longer can',
  G => [G.cutLineSpan(HOUSE, P(15, 5), P(16, 5), 0.75).start.x
        === G.cutLineSpan([...HOUSE, PORCH_FROST], P(15, 5), P(16, 5), 0.75).start.x, true]);

check('no walls is no box',
  G => [G.planWallExtents([]), null]);

// A box needs depth in BOTH directions -- a single wall has none, and marks
// placed around a degenerate box land on top of each other.
check('one wall is not a house',
  G => [G.planWallExtents([W('a', 0, 0, 30, 0)]), null]);

check('a box under a foot across is not a house either',
  G => [G.planWallExtents([W('a', 0, 0, 0.5, 0), W('b', 0, 0, 0, 0.5)]), null]);

// ── eMarkDimEdges: pushed out past the numbers ──
check('with no dimensions the edges are the house',
  G => [JSON.stringify(G.eMarkDimEdges(HOUSE, [])),
        JSON.stringify({ N: 0, S: 24, W: 0, E: 30 })]);

check('a dimension string below the house pushes the south edge out to it',
  G => [G.eMarkDimEdges(HOUSE, [D(0, 28, 30, 28)]).S, 28]);

check('and leaves the other three where they were',
  G => { const e = G.eMarkDimEdges(HOUSE, [D(0, 28, 30, 28)]);
         return [`${e.N},${e.W},${e.E}`, '0,0,30']; });

// A string running down the side is in the E/W corridor, not the N/S one.
check('a string beside the house pushes the east edge, not the south',
  G => { const e = G.eMarkDimEdges(HOUSE, [D(34, 0, 34, 24)]);
         return [`${e.E},${e.S}`, '34,24']; });

// The pad is what stops a string that merely passes the corner from voting on
// an edge it does not run along.
check('a string above the house pushes the north edge up to it',
  G => [JSON.stringify(G.eMarkDimEdges(HOUSE, [D(0, -40, 30, -40)])),
        JSON.stringify({ N: -40, S: 24, W: 0, E: 30 })]);

// THE CORRIDOR, which is what the pad is for. A string far off to the east at
// a northerly z is in neither corridor: it must not push N (it is not above
// the house) and must not push E (it is not beside it). Without the pad guard
// every string votes on every edge, and an elevation mark ends up out in the
// yard chasing a dimension that has nothing to do with its side.
check('a string in neither corridor pushes no edge at all',
  G => [JSON.stringify(G.eMarkDimEdges(HOUSE, [D(200, -40, 210, -40)])),
        JSON.stringify({ N: 0, S: 24, W: 0, E: 30 })]);

// SAME CONTRACT ON THE DIMENSIONS, and this is the half that would have been
// missed. Fixing only the walls leaves a string on a hidden layer view still
// pushing the marks out -- on a drawing where nothing visible is out there --
// and the porch case would have looked fixed while staying broken.
check('a dimension it is handed pushes the edge, whatever level it claims',
  G => [G.eMarkDimEdges(HOUSE, [D(0, 40, 30, 40, 0)]).S, 40]);

check('and one it is not handed cannot',
  G => [G.eMarkDimEdges(HOUSE, []).S, 24]);

check('no house is no edges',
  G => [G.eMarkDimEdges([], [D(0, 28, 30, 28)]), null]);

// ── eMarkClearFt: the drafter's drag, or the default ──
// PINNED, NOT READ BACK. The first version of this asserted against
// G.E_MARK_CLEAR_FT, which is the module's own constant -- mutate it and both
// sides of the equality move together, so the check could not fail. Measured:
// halving the constant survived every check in this file. 2' is the office
// clearance and it is written here as 2.
check('an undragged mark takes the default clearance, and it is two feet',
  G => [G.eMarkClearFt({}, 'E1'), 2]);

check('and the module agrees that is what its constant says',
  G => [G.E_MARK_CLEAR_FT, 2]);

check('a dragged one keeps its own',
  G => [G.eMarkClearFt({ E1: 5 }, 'E1'), 5]);

check('a mark dragged to zero keeps the zero, it is not falsy-defaulted',
  G => [G.eMarkClearFt({ E1: 0 }, 'E1'), 0]);

check('a negative clearance is honoured -- the drafter may pull it inward',
  G => [G.eMarkClearFt({ E1: -3 }, 'E1'), -3]);

// Only a FINITE number counts. Anything else would place the mark at NaN and
// the bubble would vanish with no error.
check('a null offset falls back rather than placing the mark at nothing',
  G => [G.eMarkClearFt({ E1: null }, 'E1'), G.E_MARK_CLEAR_FT]);

check('so does a string',
  G => [G.eMarkClearFt({ E1: 'seven' }, 'E1'), G.E_MARK_CLEAR_FT]);

check('and so does an infinity',
  G => [G.eMarkClearFt({ E1: Infinity }, 'E1'), G.E_MARK_CLEAR_FT]);

check('no offsets map at all is not a crash',
  G => [G.eMarkClearFt(undefined, 'E1'), G.E_MARK_CLEAR_FT]);

// ── autoElevationCuts: the four marks ──
check('there are four of them, E1 to E4',
  G => [cuts(G).map(c => c.id).join(','), 'E1,E2,E3,E4']);

check('turning auto elevations off leaves none',
  G => [cuts(G, { autoElevations: false }).length, 0]);

check('no house means no marks, whatever the setting',
  G => [G.autoElevationCuts({ walls: [], dimensions: [], elevationMarkOffsets: {},
        autoElevations: true }).length, 0]);

check('they are all flagged auto, which is what makes the line run edge to edge',
  G => [cuts(G).every(c => c.auto === true), true]);

// E1 is the front, looking north INTO the house. dirVec points at the viewer.
check('E1 lies below the house, clear of it',
  G => [byId(G, 'E1').startPt.z > 24, true]);

check('E3 lies above it',
  G => [byId(G, 'E3').startPt.z < 0, true]);

check('E2 lies to the west',
  G => [byId(G, 'E2').startPt.x < 0, true]);

check('E4 lies to the east',
  G => [byId(G, 'E4').startPt.x > 30, true]);

// Each looks back at the house it stands off from -- get a sign wrong and the
// section is cut looking away from the building.
check('every mark looks back at the house',
  G => { const towards = { E1: { x: 0, z: 1 }, E2: { x: -1, z: 0 },
                           E3: { x: 0, z: -1 }, E4: { x: 1, z: 0 } };
         return [cuts(G).every(c => c.dirVec.x === towards[c.id].x
                                 && c.dirVec.z === towards[c.id].z), true]; });

check('the north-south pair run east-west, and the other pair the other way',
  G => { const c = id => byId(G, id);
         return [c('E1').startPt.z === c('E1').endPt.z
              && c('E2').startPt.x === c('E2').endPt.x, true]; });

check('a mark stands its clearance off the edge',
  G => [round(byId(G, 'E1', { elevationMarkOffsets: { E1: 5 } }).startPt.z
              - byId(G, 'E1', { elevationMarkOffsets: { E1: 0 } }).startPt.z), 5]);

// The marks clear the DIMENSION strings, not just the walls -- which is the
// whole reason eMarkDimEdges exists rather than using the box directly.
check('a dimension string below the house pushes E1 further out',
  G => [G.autoElevationCuts({ walls: HOUSE, dimensions: [D(0, 30, 30, 30)],
          elevationMarkOffsets: {}, autoElevations: true })
        .find(c => c.id === 'E1').startPt.z
        > byId(G, 'E1').startPt.z, true]);

check('and does not move E3 on the far side',
  G => [G.autoElevationCuts({ walls: HOUSE, dimensions: [D(0, 30, 30, 30)],
          elevationMarkOffsets: {}, autoElevations: true })
        .find(c => c.id === 'E3').startPt.z, byId(G, 'E3').startPt.z]);

check('the marks span the whole house, with room past each end',
  G => { const e1 = byId(G, 'E1');
         return [e1.startPt.x < 0 && e1.endPt.x > 30, true]; });

// ── cutLineSpan: the infinite line, clipped ──
const span = (G, a, b, gap = 0.75) => G.cutLineSpan(HOUSE, a, b, gap);
const P = (x, z) => ({ x, y: 0, z });

check('a short cut inside the house runs clear across it',
  G => { const s = span(G, P(10, 5), P(12, 5));
         return [s.start.x < 0 && s.end.x > 30, true]; });

check('and stops at the gap, not at infinity',
  G => { const s = span(G, P(10, 5), P(12, 5));
         return [round(s.start.x), -0.75]; });

check('a wider gap stops it further out',
  G => [span(G, P(10, 5), P(12, 5), 3).start.x < span(G, P(10, 5), P(12, 5), 0.75).start.x, true]);

check('the clipped line keeps the direction it was drawn in',
  G => { const s = span(G, P(10, 5), P(12, 5));
         return [s.end.x > s.start.x, true]; });

check('a cut drawn backwards stays backwards',
  G => { const s = span(G, P(12, 5), P(10, 5));
         return [s.end.x < s.start.x, true]; });

check('a north-south cut clips against the other pair of edges',
  G => { const s = span(G, P(15, 5), P(15, 9));
         return [round(s.start.z), -0.75]; });

check('a diagonal clips to whichever slab bites first',
  G => { const s = span(G, P(-40, -40), P(40, 40));
         return [Math.max(Math.abs(s.start.x), Math.abs(s.start.z)) <= 30.75 + 1e-6, true]; });

// Every failure path falls back to the DRAWN segment pushed out, never to
// nothing -- a cut that vanishes is worse than one drawn short.
check('a zero-length cut is returned untouched rather than clipped to nothing',
  G => { const s = G.cutLineSpan(HOUSE, P(3, 3), P(3, 3), 0.75);
         return [`${s.start.x},${s.end.x}`, '3,3']; });

// Pinned at 6' for the same reason as the clearance above: reading
// G.CUT_BUBBLE_PUSH_FT back would make the check agree with any value.
check('with no house the cut is pushed out six feet past its own ends',
  G => { const s = G.cutLineSpan([], P(0, 0), P(10, 0), 0.75);
         return [round(s.start.x), -6]; });

check('and pushed out at the far end too',
  G => { const s = G.cutLineSpan([], P(0, 0), P(10, 0), 0.75);
         return [round(s.end.x), 16]; });

check('and the module agrees that is what its constant says',
  G => [G.CUT_BUBBLE_PUSH_FT, 6]);

// A cut nowhere near the house cannot clip to it, and must not come back as a
// line through the building.
check('a cut that misses the house entirely falls back to its own ends',
  G => { const s = span(G, P(100, 100), P(110, 100));
         return [round(s.start.x), 94]; });

// THE OTHER MISS, and it is a different branch. The one above never travels
// the z slab at all, so it leaves by the `!sx || !sz` door. A diagonal that
// only clips the corner DOES produce an overlap -- just a uselessly short one
// -- and leaves by the `tMax - tMin > 0.5` door instead. Measured: without
// this case, replacing that fallback with the drawn segment survives every
// other check here.
check('a cut that only grazes the corner falls back too, rather than drawing a stub',
  G => { const s = G.cutLineSpan(HOUSE, P(30.5, -10), P(40.5, 0), 0.75);
         return [round(s.end.x) > 40.5, true]; });

check('a cut is never returned with a non-finite end',
  G => { const all = [span(G, P(10, 5), P(12, 5)), span(G, P(15, 5), P(15, 9)),
                      span(G, P(-40, -40), P(40, 40)), span(G, P(100, 100), P(110, 100))];
         return [all.every(s => [s.start.x, s.start.z, s.end.x, s.end.z].every(Number.isFinite)), true]; });

check('the cut keeps the elevation it was drawn at',
  G => { const s = G.cutLineSpan(HOUSE, { x: 10, y: 7.5, z: 5 }, { x: 12, y: 7.5, z: 5 }, 0.75);
         return [`${s.start.y},${s.end.y}`, '7.5,7.5']; });

// ── MODEL.dc.html still delegates ──
check('MODEL.dc.html delegates all five rather than carrying a second copy',
  () => {
    const src = fs.readFileSync(MODEL_DC, 'utf8');
    // BRACE-MATCHED, not a character budget. The first version allowed 400
    // characters of body and went red the moment a delegation grew a comment
    // -- reporting "does not delegate" about a method that plainly did. A
    // check that fails for a reason unrelated to its claim is worse than no
    // check: it trains you to edit the check.
    const bodyOf = name => {
      const at = src.indexOf(`\n  ${name}(`);
      if (at < 0) return null;
      let i = src.indexOf('{', at), depth = 0;
      for (let j = i; j < src.length; j += 1) {
        if (src[j] === '{') depth += 1;
        else if (src[j] === '}') { depth -= 1; if (!depth) return src.slice(i, j); }
      }
      return null;
    };
    const missing = ['_planWallExtents', '_eMarkClearFt', '_cutLineSpan',
                     '_eMarkDimEdges', '_autoElevationCuts']
      .filter(name => !(bodyOf(name) || '').includes('window.DraftCutMarks.'));
    return [missing.join(',') || 'all five delegate', 'all five delegate'];
  });

// AND BOTH CALLERS ACTUALLY PASS THEIR VISIBLE SETS. The contract above is
// only worth anything if somebody honours it, and the module cannot tell.
// Cheap to read, and it is the half that would rot silently: someone
// "simplifying" _activeWalls() back to _walls restores the porch bug with
// every check in this file still green.
check('MODEL.dc.html hands over the walls and dimensions it is showing',
  () => {
    const src = fs.readFileSync(MODEL_DC, 'utf8');
    // SCOPED TO THIS PAINTER'S ENV, not grepped over the file. The first
    // version looked for `walls: this._walls,` anywhere and found it -- in
    // drawFixture2D's env, where it is CORRECT: tubGeometry scans for the wall
    // that closes the alcove and does its own level and view filtering while
    // it scans, so it wants the whole list. A check that cannot tell one
    // painter's env from another's reports a bug in working code, which is how
    // a correct line gets "fixed".
    const at = src.indexOf('_autoElevationCuts() {');
    const env = at < 0 ? '' : src.slice(at, src.indexOf('\n  }', at));
    const bad = [
      ['planWallExtents(this._walls)', 'planWallExtents'],
      ['eMarkDimEdges(this._walls', 'eMarkDimEdges'],
      ['cutLineSpan(this._walls', 'cutLineSpan'],
    ].filter(([needle]) => src.includes(needle)).map(([, label]) => label)
      .concat(env.includes('walls: this._walls,') ? ['autoElevationCuts walls'] : [])
      .concat(env.includes('dimensions: this._dimensions,') ? ['autoElevationCuts dimensions'] : []);
    return [bad.join(',') || 'all five pass the active sets', 'all five pass the active sets'];
  });

// The control, so the check above is not passing because it looks at nothing:
// the env it reads must actually mention the active sets.
check('and that env is really the one being read',
  () => {
    const src = fs.readFileSync(MODEL_DC, 'utf8');
    const at = src.indexOf('_autoElevationCuts() {');
    const env = at < 0 ? '' : src.slice(at, src.indexOf('\n  }', at));
    return [env.includes('this._activeWalls()') && env.includes('this._activeDimensions()'), true];
  });

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

const MUTATIONS = [
  // THE CONTRACT MUTATION, replacing one that anchored on the filter this
  // module used to keep. A second filter here is the porch bug: the caller
  // hands over what the drafter can see, and anything the module strips after
  // that is a rule invisible from the call site.
  ['the module re-filters the walls it was handed',
    s => s.replace('const kept = walls || [];', 'const kept = (walls || []).filter(w => w.levelId > 0);')],
  ['a degenerate box is accepted',
    s => s.replace('if (maxX - minX < 1 || maxZ - minZ < 1) return null;', '')],
  ['the box collapses to its x extent',
    s => s.replace('minZ = Math.min(minZ, pt.z); maxZ = Math.max(maxZ, pt.z);', '')],
  ['dimension strings never push the edges out',
    s => s.replace('(dimensions || []).forEach(dimension => {', '[].forEach(dimension => {')],
  ['the module re-filters the dimensions it was handed',
    s => s.replace('(dimensions || []).forEach(dimension => {',
      '(dimensions || []).filter(d => d.levelId > 0).forEach(dimension => {')],
  ['the corridor pad is dropped, so any string pushes any edge',
    s => s.replace('if (pt.x >= minX - pad && pt.x <= maxX + pad) {', 'if (true) {')],
  ['north and south are swapped',
    s => s.replace('if (pt.z > edge.S) edge.S = pt.z;\n          if (pt.z < edge.N) edge.N = pt.z;',
      'if (pt.z > edge.N) edge.N = pt.z;\n          if (pt.z < edge.S) edge.S = pt.z;')],
  ['a stored clearance of zero is treated as absent',
    s => s.replace('Number.isFinite(stored) ? stored : E_MARK_CLEAR_FT', 'stored || E_MARK_CLEAR_FT')],
  ['a non-finite clearance is used as-is',
    s => s.replace('Number.isFinite(stored) ? stored : E_MARK_CLEAR_FT', 'stored')],
  ['the auto-elevation switch is ignored',
    s => s.replace('if (!autoElevations) return [];', '')],
  ['the marks are placed with no clearance at all',
    s => s.replace('+ E_MARK_SIDES[id].sign * eMarkClearFt(elevationMarkOffsets, id)', '')],
  ['every mark steps the same way off its edge',
    s => s.replace('E_MARK_SIDES[id].sign *', '1 *')],
  ['the marks are measured off the walls, ignoring the dimension strings',
    s => s.replace('const edge = eMarkDimEdges(walls, dimensions);',
      'const edge = { N: box.minZ, S: box.maxZ, W: box.minX, E: box.maxX };')],
  ['E1 looks away from the house',
    s => s.replace("endPt: { x: maxX + pad, z: at('E1') }, dirVec: { x: 0, z: 1 }",
      "endPt: { x: maxX + pad, z: at('E1') }, dirVec: { x: 0, z: -1 }")],
  ['the marks stop at the house instead of running past it',
    s => s.replace('const pad = 2;\n    const at = id =>', 'const pad = 0;\n    const at = id =>')],
  ['a zero-length cut is clipped like any other',
    s => s.replace('if (len < 0.001) return { start, end };', '')],
  ['the clip ignores the gap, stopping at the walls',
    s => s.replace('box.minX - gapFt, box.maxX + gapFt', 'box.minX, box.maxX')],
  ['a cut with no house to clip against is returned unpushed',
    s => s.replace('if (!box) return pushed();', 'if (!box) return { start, end };')],
  ['a cut that misses the house is returned as drawn',
    s => s.replace('if (!(tMax - tMin > 0.5) || !Number.isFinite(tMin) || !Number.isFinite(tMax)) return pushed();',
      'if (!(tMax - tMin > 0.5)) return { start, end };')],
  // NOT MUTATED, AND THE REASON IS THE FINDING. `!Number.isFinite(tMin/tMax)`
  // is unreachable: a slab returns [-Infinity, Infinity] only when the ray is
  // parallel to it, and (ux, uz) is a unit vector, so it cannot be parallel to
  // both axes at once -- at least one slab is always finite, and max/min with
  // a finite operand is finite. Dropping the guard therefore changes nothing
  // and no check could catch it. It is kept in the module because the original
  // had it and this was a faithful extraction, not a cleanup; it is left out
  // of this table because a mutation nothing can catch reads as a coverage gap
  // when it is really dead code.
  ['the clip is taken the wrong way round, inverting the span',
    s => s.replace('const tMin = Math.max(sx[0], sz[0]), tMax = Math.min(sx[1], sz[1]);',
      'const tMin = Math.min(sx[0], sz[0]), tMax = Math.max(sx[1], sz[1]);')],
  ['a ray parallel to a slab is refused instead of running through it',
    s => s.replace('return (origin >= lo && origin <= hi) ? [-Infinity, Infinity] : null;', 'return null;')],
  ['the clipped line loses the elevation it was drawn at',
    s => s.replace('({ x: start.x + ux * t, y: start.y, z: start.z + uz * t })',
      '({ x: start.x + ux * t, y: 0, z: start.z + uz * t })')],
  ['the push-out distance is halved',
    s => s.replace('const CUT_BUBBLE_PUSH_FT = 6;', 'const CUT_BUBBLE_PUSH_FT = 3;')],
  ['the default clearance is halved',
    s => s.replace('const E_MARK_CLEAR_FT = 2;', 'const E_MARK_CLEAR_FT = 1;')],
];

if (MUTATION_MODE) {
  console.log('\n' + 'mutation'.padEnd(74) + 'caught by');
  let survivors = 0, broken = 0;
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
