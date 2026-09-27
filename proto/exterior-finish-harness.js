// EXTERIOR FINISHES — the table a drafter picks a wall's cladding from.
//
//   node proto/exterior-finish-harness.js
//   node proto/exterior-finish-harness.js --mutate   break it, prove each break is caught
//
// Movie dictated the list on 26 Sep, in this order: *"1. STUCCO  2. V. SIDING
// 3. H. SIDING (B&B)"*, then *"also CEDAR SHAKE - which is used for details
// sparingly for some styles"*, with STONE and BRICK named as the *"'special'
// finishes"* still to come.
//
// WHY A TABLE AND NOT FOUR PAINTERS. *"make default 4\" but allow them to
// change it (then we don't need multiple types)"* -- his 6" and 8" vertical
// are one row with one field edited. So what a row fixes is the PATTERN and
// what it leaves open is the SPACING, and these checks are about that split:
// a row that hardcodes its spacing, or a pattern with no numbers to set,
// would both be the design going back on itself.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'wall-types.js');

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'wall-types.js' });
  return win;
}

function run(win) {
  const missed = [];
  const check = (label, ok, detail) => {
    if (!ok) missed.push({ label, detail });
    if (!MUTATION_MODE) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `   ${detail}` : ''}`);
    return ok;
  };
  const T = win.DraftWallTypes;
  if (!T || !T.EXTERIOR_FINISHES) {
    missed.push({ label: 'wall-types exports EXTERIOR_FINISHES', detail: 'missing' });
    return missed;
  }
  const F = T.EXTERIOR_FINISHES;

  // ── THE FIXTURE'S OWN REACH, asserted before anything filters it ──────
  check('the table has rows at all', F.length > 0, `${F.length}`);
  check('and it carries the four Movie dictated',
    ['stucco', 'siding_v', 'siding_h_bb', 'shake'].every(id => F.some(f => f.id === id)),
    F.map(f => f.id).join(' '));

  const ids = F.map(f => f.id);
  check('every id is unique -- two rows with one id is a picker that cannot tell them apart',
    new Set(ids).size === ids.length, ids.join(' '));
  check('every row has a label a drafter can read',
    F.every(f => typeof f.label === 'string' && f.label.trim().length > 0),
    F.map(f => f.label).join(' | '));

  // ── THE DEFAULT IS A ROW, not a name that happens to be spelled right ──
  check('the default finish id names a row in the table',
    F.some(f => f.id === T.DEFAULT_FINISH_ID), T.DEFAULT_FINISH_ID);
  check('and it is STUCCO, so an untouched drawing renders as it always did',
    T.DEFAULT_FINISH_ID === 'stucco', T.DEFAULT_FINISH_ID);
  check('stucco draws no pattern at all -- it is the quiet ground the rest read against',
    T.finishById('stucco').pattern === 'none', T.finishById('stucco').pattern);

  // ── AN UNKNOWN ID FALLS BACK, because a saved drawing outlives a table ──
  //
  // A finish renamed or dropped must not leave a wall with no way to draw
  // itself. Answering the DEFAULT is what keeps an old file openable.
  check('an unknown id falls back to the default rather than answering nothing',
    T.finishById('no-such-finish') && T.finishById('no-such-finish').id === T.DEFAULT_FINISH_ID,
    String(T.finishById('no-such-finish') && T.finishById('no-such-finish').id));
  check('and a known id answers itself',
    T.finishById('shake').id === 'shake', T.finishById('shake').id);

  // ── THICKNESS IS ON EVERY ROW, AND IS ZERO ON EVERY ROW TODAY ─────────
  //
  // Movie: *"the next few will need to have thickness"* -- stone and brick.
  // The field is present now so adding them is a row rather than a migration
  // of saved drawings. That it is ZERO everywhere is the claim that THIS
  // change moved nothing: no wall face steps out, no foundation grows a
  // ledge, no overhang is measured from a new line.
  check('every row carries a thickness field, so masonry is a row not a migration',
    F.every(f => Number.isFinite(f.thicknessIn)),
    F.map(f => `${f.id}=${f.thicknessIn}`).join(' '));
  check('and every one of them is zero, so nothing in any drawing moved',
    F.every(f => f.thicknessIn === 0),
    F.filter(f => f.thicknessIn !== 0).map(f => f.id).join(' ') || 'all zero');

  // ── THE SPACING IS A PARAMETER, WHICH IS THE WHOLE DESIGN ────────────
  //
  // *"make default 4\" but allow them to change it (then we don't need
  // multiple types)"*. A patterned row with no parameters would be a fixed
  // spacing wearing a table's clothes, and the 6" and 8" he asked for would
  // each need a row of their own again.
  const patterned = F.filter(f => f.pattern !== 'none');
  check('fixture: the table has patterned rows to ask about',
    patterned.length > 0, `${patterned.length}`);
  check('every patterned finish leaves its spacing open as a parameter',
    patterned.every(f => f.params.length > 0),
    patterned.map(f => `${f.id}:${f.params.length}`).join(' '));
  check('and stucco takes none, having no spacing to set',
    T.finishById('stucco').params.length === 0,
    `${T.finishById('stucco').params.length}`);
  check('every parameter is a named number with a real default',
    F.every(f => f.params.every(p => p.key && p.label
      && Number.isFinite(p.in) && p.in > 0)),
    F.flatMap(f => f.params.map(p => `${f.id}.${p.key}=${p.in}`)).join(' '));

  // ── AND A PATTERN THAT RUNS ONE WAY SAYS WHICH WAY ───────────────────
  //
  // Vertical siding's boards run up and its courses start at a wall END;
  // horizontal battens and shakes run across and start at its FOOT. The two
  // are drawn by different datums, so a patterned row that did not say which
  // it was would leave the painter guessing.
  check('every patterned finish names the axis it runs along',
    patterned.every(f => f.axis === 'vertical' || f.axis === 'horizontal'),
    patterned.map(f => `${f.id}:${f.axis}`).join(' '));
  check('V. Siding runs vertical and B&B runs horizontal -- Movie\'s own words for them',
    T.finishById('siding_v').axis === 'vertical'
    && T.finishById('siding_h_bb').axis === 'horizontal',
    `${T.finishById('siding_v').axis} / ${T.finishById('siding_h_bb').axis}`);
  check('and each pattern is distinct, so two rows cannot draw as one',
    new Set(patterned.map(f => f.pattern)).size === patterned.length,
    patterned.map(f => f.pattern).join(' '));

  return missed;
}

const baseline = run(load(null));
if (!MUTATION_MODE) {
  console.log(`\nexterior finish harness: ${baseline.length ? `${baseline.length} FAILED` : 'all checks passed'}`);
  if (baseline.length) {
    baseline.forEach(m => console.log(`  ✘ ${m.label}${m.detail ? `   ${m.detail}` : ''}`));
    process.exit(1);
  }
  process.exit(0);
}

const MUTATIONS = [
  ['the default names a finish that is not in the table',
    s => s.replace("const DEFAULT_FINISH_ID = 'stucco';",
      "const DEFAULT_FINISH_ID = 'brick';")],
  ['an unknown finish id answers nothing, so an old drawing cannot draw its walls',
    s => s.replace("  const finishById = id => EXTERIOR_FINISHES.find(f => f.id === id)\n"
      + "    || EXTERIOR_FINISHES.find(f => f.id === DEFAULT_FINISH_ID);",
      '  const finishById = id => EXTERIOR_FINISHES.find(f => f.id === id) || null;')],
  ['the fallback swallows a KNOWN id too, so every wall draws as stucco',
    s => s.replace('  const finishById = id => EXTERIOR_FINISHES.find(f => f.id === id)',
      '  const finishById = () => EXTERIOR_FINISHES.find(f => f.id === id)'.replace('id)', 'DEFAULT_FINISH_ID)')
      + ' || (() => EXTERIOR_FINISHES.find(f => f.id === DEFAULT_FINISH_ID))()')],
  ['stucco grows a pattern, so the ground the others read against is hatched too',
    s => s.replace("{ id: 'stucco', label: 'Stucco', pattern: 'none', thicknessIn: 0,",
      "{ id: 'stucco', label: 'Stucco', pattern: 'lines', thicknessIn: 0,")],
  ['a patterned finish hardcodes its spacing, so 6\" and 8\" need rows of their own again',
    s => s.replace("      params: Object.freeze([{ key: 'exposureIn', label: 'Exposure', in: 4 }]) },",
      '      params: Object.freeze([]) },')],
  ['a parameter loses its default, so a fresh wall draws at no spacing at all',
    s => s.replace("{ key: 'exposureIn', label: 'Exposure', in: 4 }",
      "{ key: 'exposureIn', label: 'Exposure', in: 0 }")],
  ['a row loses its thickness field, so masonry becomes a migration',
    s => s.replace("{ id: 'shake', label: 'Cedar Shake', pattern: 'shake', axis: 'horizontal',\n      thicknessIn: 0,",
      "{ id: 'shake', label: 'Cedar Shake', pattern: 'shake', axis: 'horizontal',")],
  ['a flat finish claims a thickness, so a drawing moves that should not have',
    s => s.replace("{ id: 'siding_v', label: 'V. Siding', pattern: 'lines', axis: 'vertical', thicknessIn: 0,",
      "{ id: 'siding_v', label: 'V. Siding', pattern: 'lines', axis: 'vertical', thicknessIn: 4,")],
  ['B&B is filed as vertical, against Movie-s own word for it',
    s => s.replace("{ id: 'siding_h_bb', label: 'H. Siding (B&B)', pattern: 'batten', axis: 'horizontal',",
      "{ id: 'siding_h_bb', label: 'H. Siding (B&B)', pattern: 'batten', axis: 'vertical',")],
  ['a patterned finish forgets which way it runs, leaving the painter to guess',
    s => s.replace("{ id: 'shake', label: 'Cedar Shake', pattern: 'shake', axis: 'horizontal',",
      "{ id: 'shake', label: 'Cedar Shake', pattern: 'shake',")],
  ['two rows share a pattern, so the drawing cannot tell them apart',
    s => s.replace("pattern: 'shake', axis: 'horizontal',", "pattern: 'batten', axis: 'horizontal',")],
  ['two rows share an id, so a picker cannot tell them apart',
    s => s.replace("{ id: 'shake', label: 'Cedar Shake',", "{ id: 'siding_v', label: 'Cedar Shake',")],
];

console.log('\n' + 'mutation'.padEnd(78) + 'caught by');
let survivors = 0, broken = 0;
for (const [label, mutate] of MUTATIONS) {
  let by;
  try {
    const m = run(load(mutate));
    if (!m.length) survivors += 1;
    by = m.length ? m.map(x => x.label).join('\n' + ' '.repeat(78)) : '*** NOTHING ***';
  } catch (err) {
    broken += 1;
    by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
  }
  console.log(`${label.padEnd(78)}${by}`);
}
console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
