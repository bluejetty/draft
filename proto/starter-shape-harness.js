// node proto/starter-shape-harness.js
//
// Every shape at every width, checked in node without a browser. The point of
// this harness is the SWEEP: generate() picks a width at random, so a bug that
// only bites at 47' would otherwise surface on a stranger's first press.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
global.window = {};
new Function(fs.readFileSync(path.join(root, 'starter-shape.js'), 'utf8'))();
const S = global.window.DraftStarterShape;

let checks = 0, failed = 0;
const ok = (name, cond, detail = '') => {
  checks += 1;
  if (!cond) { failed += 1; console.log(`  FAIL  ${name}${detail ? '  ' + detail : ''}`); }
};

// ── the sweep: every kind at every width in range ─────────────────────────
for (const kind of S.KINDS) {
  for (let w = S.WIDTH_RANGE.least; w <= S.WIDTH_RANGE.most; w += 1) {
    const points = S.shapeFor(kind, w);
    const a = Math.round(S.area(points));
    ok(`${kind} @${w}' whole feet`,
       points.every(p => Number.isInteger(p.x) && Number.isInteger(p.z)),
       JSON.stringify(points));
    ok(`${kind} @${w}' area near ${S.TARGET_SQ_FT}`,
       Math.abs(a - S.TARGET_SQ_FT) <= S.TOLERANCE_SQ_FT,
       `got ${a}`);
    ok(`${kind} @${w}' is centred on the origin`,
       Math.abs(Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) <= 1
       && Math.abs(Math.min(...points.map(p => p.z)) + Math.max(...points.map(p => p.z))) <= 1);
  }
}

// ── corner counts: the reason these three shapes were chosen ──────────────
ok('rectangle has 4 corners', S.shapeFor(S.KIND.RECTANGLE, 50).length === 4);
ok('L has 6 corners',         S.shapeFor(S.KIND.L, 50).length === 6);
ok('T has 8 corners',         S.shapeFor(S.KIND.T, 50).length === 8);

// ── the same random source gives the same house twice ─────────────────────
const fixedRng = seq => { let i = 0; return () => seq[i++ % seq.length]; };
const a1 = S.generate(fixedRng([0.1, 0.5]));
const a2 = S.generate(fixedRng([0.1, 0.5]));
ok('a fixed rng repeats exactly', JSON.stringify(a1) === JSON.stringify(a2));

// ── a forced kind is honoured ─────────────────────────────────────────────
for (const kind of S.KINDS) {
  ok(`generate can be forced to ${kind}`, S.generate(Math.random, kind).kind === kind);
}

// ── generate() can never produce an unusable shape ────────────────────────
for (let i = 0; i < 500; i += 1) {
  const s = S.generate();
  ok(`random #${i} is usable`, S.isUsable(s), `${s.kind} ${s.widthFt}' ${s.areaSqFt}sqft`);
}

// ── the export is frozen, like every other module here ────────────────────
ok('export is frozen', Object.isFrozen(S));

console.log(`\n${checks - failed}/${checks} checks passed`);
if (failed) { console.log(`${failed} FAILED`); process.exit(1); }

console.log('\nOne of each, for the record:');
for (const kind of S.KINDS) {
  const s = S.generate(() => 0.5, kind);
  const xs = s.points.map(p => p.x), zs = s.points.map(p => p.z);
  console.log(`  ${kind.padEnd(10)} ${s.areaSqFt} sq ft  ${Math.max(...xs)-Math.min(...xs)}' x ${Math.max(...zs)-Math.min(...zs)}'  ${s.points.length} corners`);
}
