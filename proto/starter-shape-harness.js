// node proto/starter-shape-harness.js
//
// Every shape at every width, checked in node without a browser. The point of
// this harness is the SWEEP: generate() picks a width at random, so a bug that
// only bites at 47' would otherwise surface on a stranger's first press.

const MUTATE = require('./harness-args.js').mutationMode();

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

// ── MUTATIONS (1 Oct) ─────────────────────────────────────────────────────
//
// Against the checks this file had, THREE OF SEVEN were caught -- measured.
// The sweep pins whole feet, area and centring, and every survivor was
// something else: a T whose stem had slid to one end, a width outside its
// range, a kind the random pick could never land on, and an isUsable that no
// longer looked at the area. The four checks under "WHAT THE SWEEP CANNOT
// SEE" are what those asked for.
const MUTATIONS = [
  ['the rectangle\'s depth is left as a fraction of a foot', 'starter-shape.js',
    c => c.replace('const depth = Math.round(TARGET_SQ_FT / width);', 'const depth = TARGET_SQ_FT / width;')],
  ['the T\'s stem slides to one end, which is an L with extra corners', 'starter-shape.js',
    c => c.replace('const left = Math.round((width - stemWidth) / 2);', 'const left = 0;')],
  ['the house is centred in depth but not across', 'starter-shape.js',
    c => c.replace('return points.map(p => pt(p.x - dx, p.z - dz));', 'return points.map(p => pt(p.x, p.z - dz));')],
  ['a forced kind is ignored', 'starter-shape.js',
    c => c.replace('const chosen = kind && BUILDERS[kind]', 'const chosen = false')],
  ['the random width escapes its range', 'starter-shape.js',
    c => c.replace('const width = WIDTH_RANGE.least + Math.round(rng() * span);',
      'const width = WIDTH_RANGE.least + Math.round(rng() * span) + 8;')],
  ['the last kind is never drawn', 'starter-shape.js',
    c => c.replace('KINDS[Math.floor(rng() * KINDS.length) % KINDS.length]',
      'KINDS[Math.floor(rng() * (KINDS.length - 1)) % KINDS.length]')],
  ['isUsable stops checking the area', 'starter-shape.js',
    c => c.replace('    && Math.abs(shape.areaSqFt - TARGET_SQ_FT) <= TOLERANCE_SQ_FT\n', '\n')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('starter-shape',
    MUTATIONS, { root, harness: __filename, preload: true });
  process.exit(all ? 0 : 1);
}
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

// ── WHAT THE SWEEP CANNOT SEE ─────────────────────────────────────────────
//
// A T IS SYMMETRIC. Its area, its corners and its bounding box survive the
// stem sliding to one end, so the sweep passed an L with two extra corners.
for (let w = S.WIDTH_RANGE.least; w <= S.WIDTH_RANGE.most; w += 1) {
  const xs = S.shapeFor(S.KIND.T, w).map(p => p.x).sort((a, b) => a - b);
  const mirrored = xs.map(x => -x).sort((a, b) => a - b);
  ok(`T @${w}' is symmetric across its stem`,
     xs.every((x, i) => Math.abs(x - mirrored[i]) <= 1), JSON.stringify(xs));
}

// The random source spans [0, 1), so its two ends are the whole range.
for (const r of [0, 0.999999]) {
  const s = S.generate(() => r);
  ok(`a random width at rng ${r} stays in range`,
     s.widthFt >= S.WIDTH_RANGE.least && s.widthFt <= S.WIDTH_RANGE.most, `got ${s.widthFt}`);
}
// And every kind is reachable from it -- a kind the pick can never land on
// is a shape nobody is ever shown.
const drawn = new Set([0, 0.34, 0.67, 0.999999].map(r => S.generate(() => r).kind));
ok('every kind can come up', S.KINDS.every(kind => drawn.has(kind)), JSON.stringify([...drawn]));

// isUsable is the gate on the area, not only on the corners and whole feet.
ok('a shape far off the target area is not usable',
   !S.isUsable({ points: S.shapeFor(S.KIND.RECTANGLE, 40), areaSqFt: 900 }));

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
