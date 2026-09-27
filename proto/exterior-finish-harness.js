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
  // ── THICKNESS AND MASONRY ARE TWO QUESTIONS, ASKED SEPARATELY ────────
  //
  // They were one for a while -- masonry was READ OFF `thicknessIn > 0` -- and
  // it held only while every thick finish happened to be stone or brick. Cedar
  // shake taking its 1" butt broke it: the derivation swept a shake into
  // masonry and these checks started demanding a mortar joint and a stone
  // water table of it. So thickness is asked of the row and masonry is
  // declared on it.
  const thick = F.filter(f => f.thicknessIn > 0);
  const flat = F.filter(f => f.thicknessIn === 0);
  const masonry = F.filter(f => T.MASONRY_FINISH_IDS.includes(f.id));
  check('fixture: the table holds thick rows and flat ones, so neither claim is vacuous',
    thick.length > 0 && flat.length > 0, `${thick.length} thick, ${flat.length} flat`);
  check('fixture: and a row that is thick WITHOUT being masonry, which is the case that broke the old derivation',
    thick.some(f => !T.MASONRY_FINISH_IDS.includes(f.id)),
    thick.filter(f => !T.MASONRY_FINISH_IDS.includes(f.id)).map(f => f.id).join(' ') || 'none');
  check('every masonry finish stands off the wall',
    masonry.every(f => f.thicknessIn > 0),
    masonry.map(f => `${f.id}=${f.thicknessIn}`).join(' '));
  check('the masonry list is declared on the rows, not inferred from their thickness',
    T.MASONRY_FINISH_IDS.length === F.filter(f => f.masonry === true).length
    && T.MASONRY_FINISH_IDS.length < thick.length,
    `${T.MASONRY_FINISH_IDS.length} masonry of ${thick.length} thick`);
  check('and the finishes are offered as ONE list, with no second grouping beside it',
    !T.SPECIAL_FINISH_IDS && !T.STANDOFF_FINISH_IDS,
    Object.keys(T).filter(k => /_FINISH_IDS$/.test(k)).join(' '));

  // ── WHAT STANDS OFF THE WALL STANDS PROUD OF ITS JOINT ───────────────
  //
  // Movie: *"can we give these texture where the stone stuck out past the
  // mortor"*. Relief is what makes stone read as stone rather than as tile:
  // the unit is forward, the mortar is behind it, and the unit throws a
  // shadow. A flat finish has no joint to stand out of, so claiming relief
  // there would be a shadow drawn for a depth that is not there.
  check('every masonry finish stands proud of its joint',
    masonry.every(f => f.relief === true),
    masonry.map(f => `${f.id}:${!!f.relief}`).join(' '));
  // RELIEF FOLLOWS THICKNESS, NOT MASONRY. A shake is not masonry and still
  // throws a shadow at every course, because it is thick at the butt. What
  // cannot throw one is a finish with no depth to throw it from.
  check('everything that stands off the wall takes relief',
    thick.every(f => f.relief === true),
    thick.map(f => `${f.id}:${!!f.relief}`).join(' '));
  check('and nothing flat does, having no depth to throw a shadow from',
    flat.every(f => !f.relief),
    flat.map(f => `${f.id}:${!!f.relief}`).join(' '));
  check('every masonry finish leaves its joint width open, since the shadow is measured against it',
    masonry.every(f => f.params.some(p => p.key === 'jointIn' && p.in > 0)),
    masonry.map(f => `${f.id}:${(f.params.find(p => p.key === 'jointIn') || {}).in}`).join(' '));

  // ── AND A WAINSCOT IS CAPPED ─────────────────────────────────────────
  //
  // *"we should put a ledge at the top of the stone that overhangs the top of
  // the stone"*, then *"drip edge"*. A cap that does not OVERHANG sheds
  // nothing and throws no shadow, and one without a drip sends the water back
  // along its own underside to the wall it was put there to protect. Both are
  // the detail failing quietly rather than loudly, which is why they are
  // checked rather than left to the row.
  check('every masonry finish carries a cap for where its band stops short',
    masonry.every(f => f.cap), masonry.map(f => `${f.id}:${!!f.cap}`).join(' '));
  check('and the cap actually overhangs, or it sheds nothing and casts no shadow',
    masonry.every(f => f.cap && f.cap.projectIn > 0),
    masonry.map(f => `${f.id}:${f.cap && f.cap.projectIn}`).join(' '));
  check('and it is a course with a height, not a line',
    masonry.every(f => f.cap && f.cap.highIn > 0),
    masonry.map(f => `${f.id}:${f.cap && f.cap.highIn}`).join(' '));
  check('and its nose is kerfed, so the water drops clear instead of tracking back',
    masonry.every(f => f.cap && f.cap.drip === true),
    masonry.map(f => `${f.id}:${f.cap && f.cap.drip}`).join(' '));
  check('and a finish that is not masonry takes none, capped or thick or neither',
    F.filter(f => !T.MASONRY_FINISH_IDS.includes(f.id)).every(f => !f.cap),
    F.filter(f => !T.MASONRY_FINISH_IDS.includes(f.id))
      .map(f => `${f.id}:${!!f.cap}`).join(' '));

  // ── BRICK COURSES ON THE UNIT PLUS THE JOINT, AND NOTHING ELSE ───────
  //
  // Movie asked whether 8x2 was standard. The length is; the height is not,
  // and the trap is the published nominal: modular brick prints as 2 2/3"
  // high, which is where "three courses to eight inches" comes from, while
  // 2 1/4" of brick and a 3/8" joint is 2 5/8" and three of those are 7 7/8".
  // A drawing that stores the nominal and lets a drafter edit the joint would
  // silently be claiming one and drawing the other, an eighth out per course
  // and two inches by the top of a storey. So the UNIT and the JOINT are both
  // stored and the coursing is their sum -- set the joint to 7/16 and the
  // courses land on 8" because the arithmetic says so, not because a table
  // was rounded.
  const brick = T.finishById('brick');
  const at = k => (brick.params.find(p => p.key === k) || {}).in;
  check('brick stores its unit and its joint separately, so coursing is their sum',
    Number.isFinite(at('brickHighIn')) && Number.isFinite(at('jointIn')),
    `${at('brickHighIn')} + ${at('jointIn')}`);
  check('and the stored unit is the ACTUAL brick, not the nominal one',
    at('brickHighIn') < 8 / 3 && at('brickLongIn') < 8,
    `${at('brickLongIn')}" x ${at('brickHighIn')}" against nominal 8" x ${(8 / 3).toFixed(3)}"`);
  // AND THE ROUNDING IS NAMED RATHER THAN INHERITED. Three courses of what
  // this table stores come to 7 7/8", not 8". The joint that would land them
  // on 8" is 8/3 - 2 1/4 = 5/12", which is not a size anybody lays -- so
  // "three courses to eight inches" is a rule of thumb and there is no joint
  // that makes it exact. What a drawing owes is the arithmetic it actually
  // stores, and this is the check that it is not quietly claiming the other.
  check('three courses come to what the unit and joint say, not to the printed 8\"',
    Math.abs((at('brickHighIn') + at('jointIn')) * 3
      - (at('brickHighIn') + at('jointIn')) * 3) < 1e-9
    && Math.abs((at('brickHighIn') + at('jointIn')) * 3 - 8) > 0.05,
    `${((at('brickHighIn') + at('jointIn')) * 3).toFixed(3)}" at a ${at('jointIn')}" joint`);
  check('and no standard joint makes it exact, which is why the nominal is not stored',
    Math.abs((at('brickHighIn') + 0.375) * 3 - 8) > 0.05
    && Math.abs((at('brickHighIn') + 0.4375) * 3 - 8) > 0.05,
    `3/8 -> ${((at('brickHighIn') + 0.375) * 3).toFixed(3)}"`
    + `   7/16 -> ${((at('brickHighIn') + 0.4375) * 3).toFixed(3)}"`
    + `   exact would need ${(8 / 3 - at('brickHighIn')).toFixed(4)}"`);

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
    s => s.replace("{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      thicknessIn: 2, relief: true, masonry: true,",
      "{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      relief: true, masonry: true,")],
  ['a flat finish claims a thickness, so a drawing moves that should not have',
    s => s.replace("{ id: 'siding_v', label: 'V. Siding', pattern: 'lines', axis: 'vertical', thicknessIn: 0,",
      "{ id: 'siding_v', label: 'V. Siding', pattern: 'lines', axis: 'vertical', thicknessIn: 4,")],
  ['a veneer stone goes flat, so it hangs on the wall with no thickness at all',
    s => s.replace("{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      thicknessIn: 2, relief: true, masonry: true,",
      "{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      thicknessIn: 0, relief: true, masonry: true,")],
  ['the masonry list is typed out instead of read off the rows',
    s => s.replace("  const MASONRY_FINISH_IDS = Object.freeze(\n"
      + "    EXTERIOR_FINISHES.filter(f => f.masonry === true).map(f => f.id));",
      "  const MASONRY_FINISH_IDS = Object.freeze(['ledgestone', 'ashlar']);")],
  // ANCHORED ON A ROW, not on the line it shares with four others. All five
  // masonry rows carry the same relief and the same cap, so a bare line
  // matches five times and `replace` takes the first -- the mutant still dies,
  // but on whichever row happened to come first rather than the one its label
  // names. mutant-anchors-harness.js is what said so.
  ['stone stops standing proud, so it outlines flat and reads as tile',
    s => s.replace("{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      thicknessIn: 2, relief: true,",
      "{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      thicknessIn: 2,")],
  ['siding claims relief, so a shadow is drawn for a depth that is not there',
    s => s.replace("{ id: 'siding_v', label: 'V. Siding', pattern: 'lines', axis: 'vertical', thicknessIn: 0,",
      "{ id: 'siding_v', label: 'V. Siding', pattern: 'lines', axis: 'vertical', thicknessIn: 0, relief: true,")],
  ['the cap stops overhanging, so it sheds nothing and throws no shadow',
    s => s.replace("{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      thicknessIn: 2, relief: true, masonry: true,\n"
      + '      cap: Object.freeze({ projectIn: 1',
      "{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      thicknessIn: 2, relief: true, masonry: true,\n"
      + '      cap: Object.freeze({ projectIn: 0')],
  ['the cap loses its drip, so the water tracks back along it to the wall',
    s => s.replace("{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      thicknessIn: 2, relief: true, masonry: true,\n"
      + '      cap: Object.freeze({ projectIn: 1, highIn: 2, drip: true }),',
      "{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      thicknessIn: 2, relief: true, masonry: true,\n"
      + '      cap: Object.freeze({ projectIn: 1, highIn: 2 }),')],
  ['the cap becomes a line with no course height',
    s => s.replace("{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      thicknessIn: 2, relief: true, masonry: true,\n"
      + '      cap: Object.freeze({ projectIn: 1, highIn: 2,',
      "{ id: 'ledgestone', label: 'Ledgestone', pattern: 'stacked', axis: 'horizontal',\n      thicknessIn: 2, relief: true, masonry: true,\n"
      + '      cap: Object.freeze({ projectIn: 1, highIn: 0,')],
  ['masonry loses its joint, so the relief has nothing to be measured against',
    s => s.replace("        { key: 'jointIn', label: 'Joint', in: 1 },\n      ]) },\n"
      + "    { id: 'ashlar',", '      ]) },\n    { id: \'ashlar\',')],
  ['brick is stored NOMINAL, so editing the joint silently changes the brick',
    s => s.replace("{ key: 'brickHighIn', label: 'Brick high', in: 2.25 },",
      "{ key: 'brickHighIn', label: 'Brick high', in: 2.6667 },")],
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
