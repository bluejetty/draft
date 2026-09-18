// geometry-2d.js — which way a section looks.
//
// A cut is a line plus a direction, and the direction is the half of it that
// is easy to store backwards. The drafter draws the line and then presses the
// side they want to SEE; the file keeps where the VIEWER STANDS, which is the
// opposite perpendicular. MODEL.dc.html:22324 says it in its own words: "the
// clicked arrow is the way the view LOOKS; dirVec records where the viewer
// STANDS."
//
// WHY THIS IS MEASURED AND NOT LOOKED AT. A cut stored the wrong way round
// draws an IDENTICAL line on the plan. The section it produces is mirrored --
// the far wall in front, the near wall behind -- and the first place anyone
// notices is a printed sheet. There is no rendering of the plan that can tell
// the two apart, so the flip is checked here, in arithmetic, where it can be.
//
// THE CENTRAL CHECK IS NOT "left or right". Naming a perpendicular is a
// convention and conventions can be swapped in two places at once and still
// agree with themselves. What cannot be swapped is the RELATION: the stored
// direction points AWAY from the side that was pressed. That is one dot
// product, it holds for any line at any angle, and it is what the drafter
// means when they press a side.
//
// Run: node proto/cut-direction-harness.js          (checks)
//      node proto/cut-direction-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'geometry-2d.js');
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

const n = v => Number(v).toFixed(4);
const vec = v => (v ? `${n(v.x)},${n(v.z)}` : 'null');
const mid = (a, b) => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });
// Positive when the stored direction points the SAME way as the press, which
// is the error this file exists to catch.
const towardPress = (G, a, b, at) => {
  const dir = G.cutDirVec(a, b, at);
  if (!dir) return null;
  const m = mid(a, b);
  return dir.x * (at.x - m.x) + dir.z * (at.z - m.z);
};

const A = { x: 0, z: 0 };
const B = { x: 10, z: 0 };
const ABOVE = { x: 5, z: 5 };
const BELOW = { x: 5, z: -5 };
// A line on no axis at all, so nothing here can pass by agreeing with x or z.
const D1 = { x: -3, z: 2 };
const D2 = { x: 4, z: 9 };
const OFF = { x: 8, z: 2 };

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

// ── the two perpendiculars ──
check('a line along +x has its perpendiculars along z',
  G => [vec(G.cutPerpendiculars(A, B).left) + ' | ' + vec(G.cutPerpendiculars(A, B).right),
    '0.0000,1.0000 | 0.0000,-1.0000']);

check('both are unit length, whatever the line length',
  G => { const p = G.cutPerpendiculars(D1, D2);
         return [`${n(Math.hypot(p.left.x, p.left.z))},${n(Math.hypot(p.right.x, p.right.z))}`,
           '1.0000,1.0000']; });

check('and they are opposite, not merely different',
  G => { const p = G.cutPerpendiculars(D1, D2);
         return [`${n(p.left.x + p.right.x)},${n(p.left.z + p.right.z)}`, '0.0000,0.0000']; });

check('both are square to the line they came from',
  G => { const p = G.cutPerpendiculars(D1, D2);
         const dx = D2.x - D1.x, dz = D2.z - D1.z;
         return [n(p.left.x * dx + p.left.z * dz), n(0)]; });

// A cut with no length is not a cut, and a page that got one back as {0,0}
// would store a direction that points nowhere and read as valid forever.
check('a line of no length has no perpendiculars at all',
  G => [G.cutPerpendiculars(A, A), null]);

// ── which side a press is on ──
check('the two sides of a line have opposite signs',
  G => [Math.sign(G.cutSide(A, B, ABOVE)) + ',' + Math.sign(G.cutSide(A, B, BELOW)), '1,-1']);

check('a press ON the line picks no side',
  G => [n(G.cutSide(A, B, { x: 5, z: 0 })), n(0)]);

// ── THE FLIP, which is the whole point ──
check('the stored direction points AWAY from the side that was pressed',
  G => [towardPress(G, A, B, ABOVE) < 0, true]);

check('and away from the other side when that one is pressed',
  G => [towardPress(G, A, B, BELOW) < 0, true]);

check('on a line at an angle too, where no axis can carry the answer',
  G => [towardPress(G, D1, D2, OFF) < 0, true]);

check('pressing one side and then the other gives opposite directions',
  G => { const up = G.cutDirVec(A, B, ABOVE), down = G.cutDirVec(A, B, BELOW);
         return [`${n(up.x + down.x)},${n(up.z + down.z)}`, '0.0000,0.0000']; });

// THE DIRECTION BELONGS TO THE PRESS, NOT TO THE DRAWING ORDER. A drafter who
// drags the cut line right-to-left and presses the same side must get the same
// section. Both ends and both perpendiculars swap when the line reverses, and
// an implementation that got only one of those right would pass every check
// above and mirror every backwards-drawn cut.
check('a line drawn backwards and pressed on the same side stores the same direction',
  G => [vec(G.cutDirVec(A, B, ABOVE)), vec(G.cutDirVec(B, A, ABOVE))]);

check('which holds on the angled line as well',
  G => [vec(G.cutDirVec(D1, D2, OFF)), vec(G.cutDirVec(D2, D1, OFF))]);

check('a cut with no length has no direction to store',
  G => [G.cutDirVec(A, A, ABOVE), null]);

// A STEEP LINE WITH A PRESS BESIDE IT, and it is here because of a mutation
// that survived everything above: dropping the second term of the cross
// product. On a line along an axis the dropped term is zero anyway, and on a
// 45-degree line it usually agrees by luck. Here it does not -- the term that
// a shortcut would drop is the one that decides the side.
const STEEP1 = { x: 0, z: 0 };
const STEEP2 = { x: 1, z: 10 };
const BESIDE = { x: 5, z: 1 };

check('a steep line is decided by the term a shortcut would drop',
  G => [towardPress(G, STEEP1, STEEP2, BESIDE) < 0, true]);

check('and the side it reports is the one the geometry says, not the one x says',
  G => [Math.sign(G.cutSide(STEEP1, STEEP2, BESIDE)), -1]);

// A PRESS ON THE LINE ITSELF still has to produce a cut, and which way it
// faces is a tie-break rather than a meaning. The old page breaks it with a
// strict `>`, so a side of exactly zero takes the LEFT perpendicular; this
// records that, so the port cannot drift to the other answer unnoticed.
check('a press exactly on the line falls to the old page-s tie-break',
  G => [vec(G.cutDirVec(A, B, { x: 5, z: 0 })), vec(G.cutPerpendiculars(A, B).left)]);

// ── Mutations ──
const MUTATIONS = [
  ['the stored direction is the side that was pressed, not the far one',
    s => s.replace('return cutSide(start, end, at) > 0 ? perps.right : perps.left;',
      'return cutSide(start, end, at) > 0 ? perps.left : perps.right;')],
  ['the two perpendiculars are the same vector',
    s => s.replace('return { left: { x: -nz, z: nx }, right: { x: nz, z: -nx } };',
      'return { left: { x: -nz, z: nx }, right: { x: -nz, z: nx } };')],
  ['the perpendiculars are not normalised, so a long cut stores a long vector',
    s => s.replace('const nx = dx / len, nz = dz / len;', 'const nx = dx, nz = dz;')],
  ['the perpendicular is the line direction itself',
    s => s.replace('return { left: { x: -nz, z: nx }, right: { x: nz, z: -nx } };',
      'return { left: { x: nx, z: nz }, right: { x: -nx, z: -nz } };')],
  ['a zero-length cut is handed back a direction of nothing',
    s => s.replace('if (!(len > 0)) return null;',
      'if (!(len > 0)) return { left: { x: 0, z: 0 }, right: { x: 0, z: 0 } };')],
  ['the side test drops a term, so one axis decides every press',
    s => s.replace('(end.x - start.x) * (at.z - start.z) - (end.z - start.z) * (at.x - start.x)',
      '(end.x - start.x) * (at.z - start.z)')],
  // MEASURING FROM THE END RATHER THAN THE START was tried here as a mutation
  // and is not one: cross(d, P - B) with B = A + d expands to cross(d, P - A)
  // minus cross(d, d), and the second term is zero. The two expressions are
  // the same number, so a table row for it would report a survivor and prove
  // nothing. Written down rather than silently dropped, because the next
  // person to think of it deserves the algebra.
  ['a press exactly on the line takes a side anyway',
    s => s.replace('return cutSide(start, end, at) > 0 ? perps.right : perps.left;',
      'return cutSide(start, end, at) >= 0 ? perps.right : perps.left;')],
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

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${m.got}, want ${m.want}`);
console.log(`\n${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

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
  process.exit(baseline.length || survivors || broken ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
