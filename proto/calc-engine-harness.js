#!/usr/bin/env node
// THE CONSTRUCTION CALCULATOR -- offline checks for calc-engine.js, the
// arithmetic behind the NOTES pad's CALC tab.
//
// Movie, 18 Oct: "can we add a construction calculator tab under the notebook
// tab ... metric and ft and do area" -- "need areas for sure" -- "don't need
// volumes - except for CONC estimation later". And the sum he asked about the
// same day, worked by hand: "367-10.25" - 10-1.25" = 357-9" is this right?".
//
// Every spelling a drafter writes a length in, put through the reader, and
// the units carried through the sums: what can go wrong here is a dash read
// as a minus, a fraction read as feet, an area that comes out a length.
//
//   node proto/calc-engine-harness.js            the checks
//   node proto/calc-engine-harness.js --mutate   each mutation must be caught
const MUTATE = require('./harness-args.js').mutationMode();
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'calc-engine.js');
const TEXT = fs.readFileSync(SRC, 'utf8');
const load = (mutate = s => s) => {
  const window = {};
  vm.runInNewContext(mutate(TEXT), { window });
  return window.DraftCalc;
};

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });
const main = (C, line, opts) => { const r = C.work(line, opts); return r.ok ? r.main : `!! ${r.why}`; };

// ── READING A LENGTH ─────────────────────────────────────────────────────
check('his sum: 367-10 1/4 less 10-1 1/4 is 357\'-9"', C => [main(C, '367-10 1/4 - 10-1 1/4'), `357'-9"`]);
check('the same written with feet and inch marks', C => [main(C, `367'10-1/4" - 10'1 1/4"`), `357'-9"`]);
check('a dash between numbers with spaces round it is a minus', C => [main(C, `10' - 2'`), `8'-0"`]);
check('a fraction on its own is inches, never feet', C => [main(C, '3/8'), `0'-0 3/8"`]);
check('a whole number and a fraction are inches too', C => [main(C, '3/8 + 1 1/2'), `0'-1 7/8"`]);
check('decimal feet', C => [main(C, `50.5'`), `50'-6"`]);
check('inches alone', C => [main(C, '30"'), `2'-6"`]);
check('metres and millimetres read and added', C => [main(C, '1.5m + 300mm', { metric: true }), '1,800 mm']);

// ── THE UNITS CARRIED ────────────────────────────────────────────────────
check('a length times a length is an area', C => [main(C, `12'6" x 10'`), '125 sq ft']);
check('two bare numbers multiplied are a room, in sq ft', C => [main(C, '12 x 10'), '120 sq ft']);
check('and in sq m on METRIC', C => [main(C, '4 x 3', { metric: true }), '12 sq m']);
check('a bare number after an area is how many of them, not a volume', C => [main(C, '12 x 10 x 2'), '240 sq ft']);
check('a length times a bare number is still a length', C => [main(C, `12'6" x 2`), `25'-0"`]);
check('a length halved', C => [main(C, '367-10 1/4 / 2'), `183'-11 1/8"`]);
check('an area over a length is a length', C => [main(C, `120 sqft / 10'`), `12'-0"`]);
check('a bare number added to a length is feet', C => [main(C, `10' + 2`), `12'-0"`]);
check('and metres on METRIC', C => [main(C, '1m + 1', { metric: true }), '2,000 mm']);
check('metric areas come out in square metres both ways', C => {
  const r = C.work('4.2m x 3600mm');
  return [`${r.main} / ${r.alt[0]}`, '162.75 sq ft / 15.12 sq m'];
});
check('brackets first', C => [main(C, `(10' + 2') x 3`), `36'-0"`]);
check('a length less a longer one goes below zero', C => [main(C, `-5' + 2'`), `-3'-0"`]);

// ── REFUSED, AND SAYING WHY ──────────────────────────────────────────────
check('a length added to an area is refused', C => [main(C, `12' + 6 sqft`), "!! can't add a length to an area"]);
check('three lengths multiplied are a volume, which waits for the concrete estimate',
  C => [main(C, `12' x 10' x 8'`).startsWith('!! that is a volume'), true]);
check('dividing by nothing is refused', C => [main(C, `10' / 0`), "!! can't divide by zero"]);
check('a line that stops short says so', C => [main(C, `10' +`), '!! the line ends too soon']);

// ── WRITING THE ANSWER ───────────────────────────────────────────────────
check('to the sixteenth, in lowest terms', C => [C.feetInches(1 + 2 / 12 + 0.125 / 12), `1'-2 1/8"`]);
check('rounding up to the next inch carries', C => [C.feetInches(1 + 11.99 / 12), `2'-0"`]);
check('a length shows its inches, decimal feet and metric beside it',
  C => [C.work(`10'`).alt.join(' | '), `120" | 10' | 3,048 mm | 3.048 m`]);

// ── MUTATIONS ────────────────────────────────────────────────────────────
const MUTATIONS = [
  ['the feet-inch dash is read as a minus',
    s => s.replace("if (s[i] === '-' && /\\d/.test(s[i + 1] || '') && Number.isInteger(n)", "if (false && s[i] === '-'")],
  ['a fraction on its own is feet',
    s => s.replace("out.push({ t: 'num', v: frac / 12, dim: 1, inch: true });", "out.push({ t: 'num', v: frac, dim: 1, inch: true });")],
  ['two bare numbers multiplied stay a number',
    s => s.replace("        const A = asLength(a), B = asLength(b);\n        return { v: A.v * B.v, dim: 2 };", "        return { v: a.v * b.v, dim: 0, bare: true };")],
  ['a bare number after an area makes a volume',
    s => s.replace("      return { v: a.v * b.v, dim: (a.bare ? 0 : a.dim) + (b.bare ? 0 : b.dim) };", "      return { v: a.v * b.v, dim: (a.bare ? 1 : a.dim) + (b.bare ? 1 : b.dim) };")],
  ['a length plus an area goes through',
    s => s.replace("if (A.dim !== B.dim) throw", "if (false) throw")],
  ['the sixteenth is not reduced',
    s => s.replace("const g = part ? gcd(part, denom) : 1;", "const g = 1;")],
  ['millimetres are read as metres',
    s => s.replace("mm: [FT_PER_M / 1000, 1]", "mm: [FT_PER_M, 1]")],
  ['metric makes no difference to a bare number',
    s => s.replace("const lengthOfBare = v => v * (metric ? FT_PER_M : 1);", "const lengthOfBare = v => v;")],
  ['brackets are ignored', s => s.replace("      if (t.t === '(') {\n        const x = sum();", "      if (false) {\n        const x = sum();")],
];

const runChecks = C => CHECKS.map(({ label, fn }) => {
  let got, want;
  try { [got, want] = fn(C); } catch (err) { return { label, ok: false, got: `threw ${err.message}`, want: '' }; }
  return { label, ok: String(got) === String(want), got, want };
});

if (!MUTATE) {
  const results = runChecks(load());
  results.forEach(r => console.log(`${r.ok ? '  ok  ' : '  FAIL'}  ${r.label}${r.ok ? '' : `\n          got ${r.got}\n         want ${r.want}`}`));
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
} else {
  let survived = 0, broken = 0;
  MUTATIONS.forEach(([label, mutate]) => {
    if (mutate(TEXT) === TEXT) { broken += 1; console.log(`!!! NEVER APPLIED  ${label}`); return; }
    let C;
    try { C = load(mutate); } catch (err) { console.log(`caught (load)  ${label}`); return; }
    const caught = runChecks(C).filter(r => !r.ok);
    if (!caught.length) survived += 1;
    console.log(`${caught.length ? 'caught' : '*** SURVIVED'}  ${label}${caught.length ? `  <- ${caught[0].label}` : ''}`);
  });
  console.log(`\n${MUTATIONS.length - survived - broken}/${MUTATIONS.length} mutations caught`);
  process.exitCode = survived || broken ? 1 : 0;
}
