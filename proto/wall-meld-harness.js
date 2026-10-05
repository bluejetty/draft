#!/usr/bin/env node
// WALLS THAT MEET MID-SPAN MELD: geometry-2d's meldPieces.
//
// Movie, 5 Oct: "TRIM interior walls against other INTERIOR and EXTERIOR
// walls, and when the trim happens i'd like the walls to 'meld' together" --
// "2 interior wall that cross or meet at corner should meld".
//
// A wall ending on another's middle (a T) or two crossing (an X) share no
// corner, so wallJoins saw nothing. meldPieces hands the painter the walls
// cut at those points: a T is cut AT the stem's own end object (three meet,
// a tee), an X at one new shared point (four meet, a multi). Records are not
// touched, and only walls of one (level, view, body) meld.
//
//   node proto/wall-meld-harness.js
//   node proto/wall-meld-harness.js --mutate
const path = require('path');
const MUTATE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['a wall ending on another\'s middle is not cut there', 'geometry-2d.js',
    c => c.replace('if (off < NEAR && t * len > NEAR && (1 - t) * len > NEAR) cuts.get(a).push({ t, p });', '')],
  ['two crossing walls are not cut', 'geometry-2d.js',
    c => c.replace('        cuts.get(a).push({ t, p });\n        cuts.get(b).push({ t: u, p });', '')],
  ['a garage wall melds into the house', 'geometry-2d.js',
    c => c.replace('        if (keyOf(a) !== keyOf(b)) continue;\n', '')],
  ['the X is cut at two points, not one', 'geometry-2d.js',
    c => c.replace('      if (found) return found;\n', '')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('wall-meld',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const { loadDraftModules } = require('./harness-env.js');
const G = loadDraftModules().DraftGeometry2D;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed += 1; console.log(`  FAIL ${label}\n       got  ${JSON.stringify(got)}\n       want ${JSON.stringify(want)}`); }
  else console.log(`  ok   ${label}`);
};

const pool = [];
const V = (x, z, body = 'house') => G.mergeVertex(pool, { x, y: 0, z }, 3, 'plan', body);
const W = (a, b, body) => ({ start: V(a[0], a[1], body), end: V(b[0], b[1], body),
  levelId: 3, view: 'plan', wallType: 'stud_2x4', refLine: 'center', body });

// A T: a partition ending on the middle of the outside wall.
const host = W([0, 0], [20, 0]);
const stem = W([8, 0], [8, 7]);
let pieces = G.meldPieces([host, stem]);
check('the outside wall is cut in two at the partition', pieces.filter(p => p.meldOf === host).length, 2);
const tJoin = G.wallJoins(pieces).get(stem.start);
check('and the three meet as a tee, at the partition\'s own end', tJoin && tJoin.type, 'tee');
check('the partition is the stem', tJoin && tJoin.stem.seg === stem, true);
check('the records are untouched', [host.start.x, host.end.x], [0, 20]);

// An X: two partitions crossing.
const a = W([4, 10], [16, 10]);
const b = W([12, 4], [12, 13]);
pieces = G.meldPieces([a, b]);
check('crossing walls are each cut in two', pieces.length, 4);
const mid = pieces.find(p => p.meldOf === a).end;
const xJoin = G.wallJoins(pieces).get(mid);
check('at one shared point, where four meet', xJoin && xJoin.type, 'multi');
check('which is where the centrelines cross', [mid.x, mid.z], [12, 10]);

// Three walls through one point: ONE point, six arms -- not three points a
// hair apart, which would leave three little crossings and no junction.
const d = W([9, 7], [15, 13]);
pieces = G.meldPieces([a, b, d]);
const hub = pieces.find(p => p.meldOf === a).end;
check('three walls through one point meet at one point, six arms',
  G.wallJoins(pieces).get(hub)?.entries.length, 6);

// A garage wall crossing the house is not the house's to meld.
const g = W([12, 4], [12, 13], 'garage');
check('a garage wall crossing a house wall stays whole', G.meldPieces([a, g]).length, 2);

// Walls meeting end to end are a corner, already: no cut.
const c1 = W([30, 0], [40, 0]);
const c2 = { ...W([40, 0], [40, 9]), start: c1.end };
check('a corner is left to the corner rules', G.meldPieces([c1, c2]).length, 2);

console.log(failed ? `\n${failed} of ${ran} wall-meld checks FAILED` : `\nall ${ran} wall-meld checks passed`);
process.exit(failed ? 1 : 0);
