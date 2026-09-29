#!/usr/bin/env node
// THE STAIR RULEBOOK, OFFLINE — the decision tree walked, the packs kept
// apart, and the score explained.
//
// WHY IT EXISTS ALONGSIDE tests/stair-rules.spec.js. That spec opens MODEL
// and pins the table's integrity through the page: frozen all the way down,
// US and CA never the same object, every research value still unverified.
// It is the right instrument for "the page has the rulebook". It is a poor
// one for the tree, because it can only ask a handful of contexts and every
// question costs a browser. The tree is pure data walked by a pure function,
// so here it is walked EXHAUSTIVELY -- every storeys x entry x width
// combination the fields allow -- and the properties that must hold for all
// of them are asserted as properties:
//   - the answer is never empty and never has a shape twice;
//   - it only ever names shapes the SHAPES table defines;
//   - the fallback ladder finishes every answer, so a context nobody
//     anticipated still gets an ordered list rather than nothing.
// A drafter with no answer gets no stair; that is the failure this guards.
//
// AND THE PART WITH A JOB-SITE COST: the packs. US and Canadian dimensions
// are never blended, an unknown jurisdiction falls back rather than throwing,
// and -- the one that is easy to get wrong in a way nothing would notice --
// `production` is builder-typical, NOT a code pack, so asking for it must
// hand back the code default instead of builder numbers.
//
// Run: node proto/stair-rules-harness.js
//      node proto/stair-rules-harness.js --mutate
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const MUTATE = require('./harness-args.js').mutationMode();

let EDIT = null;
const readSubject = name => {
  const text = fs.readFileSync(path.join(ROOT, name), 'utf8');
  return EDIT && EDIT.file === name ? EDIT.fn(text) : text;
};

function loadRules() {
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array,
    JSON, Map, Set, isFinite, parseFloat, parseInt };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readSubject('stair-rules.js'), sandbox, { filename: 'stair-rules.js' });
  if (!win.DraftStairRules) throw new Error('stair-rules.js did not publish DraftStairRules');
  return win.DraftStairRules;
}

let passed = 0;
let failures = [];
const check = (label, condition, detail) => {
  if (condition) { passed += 1; return; }
  failures.push(detail ? `${label} — ${detail}` : label);
};

function runChecks() {
  passed = 0; failures = [];
  const R = loadRules();
  const ids = R.SHAPES.map(shape => shape.id);

  // ── THE SHAPES TABLE ─────────────────────────────────────────────────
  check('every shape is reachable by id', ids.every(id => R.SHAPE_BY_ID[id]));
  check('the ids are distinct', new Set(ids).size === ids.length);
  check('the fallback ranks are a ladder with no rung shared',
    new Set(R.SHAPES.map(s => s.fallbackRank)).size === R.SHAPES.length);
  check('the ladder starts at straight and ends at spiral',
    [...R.SHAPES].sort((a, b) => a.fallbackRank - b.fallbackRank)[0].id === 'straight'
      && [...R.SHAPES].sort((a, b) => b.fallbackRank - a.fallbackRank)[0].id === 'spiral');
  check('every prior is a BAND, low then high, not a single number',
    R.SHAPES.every(s => Array.isArray(s.priorBand) && s.priorBand.length === 2
      && s.priorBand[0] <= s.priorBand[1]),
    'the spread between the nine sources is the information; averaging it away is a lie');
  check('the bands are percentages of stair instances',
    R.SHAPES.every(s => s.priorBand[0] >= 0 && s.priorBand[1] <= 100));
  check('every shape states a confidence the reader can weigh',
    R.SHAPES.every(s => ['HIGH', 'MEDIUM', 'LOW'].includes(s.confidence)));
  check('the shapes the engine can actually draw are listed, and only those',
    R.GENERATED_SHAPES.join() === 'straight,L,U',
    `lists ${R.GENERATED_SHAPES.join()}`);
  check('generated shapes agree with the rows\' own flags',
    R.GENERATED_SHAPES.every(id => R.SHAPE_BY_ID[id].generated === true)
      && ids.filter(id => R.SHAPE_BY_ID[id].generated).length === R.GENERATED_SHAPES.length);
  check('every shape carries a note saying why it sits where it does',
    R.SHAPES.every(s => typeof s.note === 'string' && s.note.length > 20));

  // ── THE PLACEMENT RULEBOOK ───────────────────────────────────────────
  check('every placement rule says HOW it reaches the engine',
    R.PLACEMENT.every(rule =>
      ['scored', 'by-construction', 'inactive', 'caller'].includes(rule.applied)),
    'the applied field is the honest part of the table');
  check('every rule is hard or soft', R.PLACEMENT.every(r => ['hard', 'soft'].includes(r.kind)));
  check('every rule names its source', R.PLACEMENT.every(r => typeof r.source === 'string'));
  check('every rule is reachable by id',
    R.PLACEMENT.every(r => R.PLACEMENT_BY_ID[r.id] === r));
  check('a scored rule has a weight to score with',
    R.PLACEMENT.filter(r => r.applied === 'scored').every(r => Number.isFinite(r.weight)),
    'a live term with a null weight scores nothing and says nothing');
  check('the bonuses are negative and the penalties positive — the score is a COST',
    R.weightOf('entryLBonus') < 0 && R.weightOf('basementStacking') < 0
      && R.weightOf('bedroomRepel') > 0 && R.weightOf('entryStepPenalty') > 0,
    'a sign flip here turns a preference into an aversion and nothing else notices');
  check('the base term is one cost point per foot of walking',
    R.weightOf('circulationDistance') === 1);
  check('an unknown rule weighs nothing rather than blowing up the score',
    R.weightOf('noSuchRule') === 0 && R.weightOf(undefined) === 0);
  check('a rule with no weight of its own also reads zero',
    R.weightOf('insideInteriorRing') === 0);
  check('the disputed joist rule is recorded and NOT live',
    R.PLACEMENT_BY_ID.joistDirection.applied === 'inactive',
    'five sources say parallel, three perpendicular — it must never be a constraint');
  check('the unverified headroom rule is recorded and not live',
    R.PLACEMENT_BY_ID.headroomFeasible.applied === 'inactive');

  // ── THE PACKS ────────────────────────────────────────────────────────
  check('an unnamed jurisdiction gets Canada, the stated default',
    R.dimensionsFor(undefined).id === 'ca' && R.DIMENSIONS.defaultJurisdiction === 'ca');
  check('the packs are asked for by name', R.dimensionsFor('us').id === 'us'
    && R.dimensionsFor('ca').id === 'ca');
  check('the name is read case-insensitively', R.dimensionsFor('US').id === 'us');
  check('a jurisdiction nobody has heard of falls back instead of throwing',
    R.dimensionsFor('atlantis').id === 'ca' && R.dimensionsFor('').id === 'ca'
      && R.dimensionsFor(null).id === 'ca',
    'a bad string must not lose a drafter their stair');
  check('BUILDER-TYPICAL IS NOT A CODE PACK and cannot be asked for as one',
    R.dimensionsFor('production').id === 'ca',
    'what builders do is not what the code allows; handing it over as a pack blends the two');
  check('the two code packs are never the same object',
    R.DIMENSIONS.us !== R.DIMENSIONS.ca);
  check('they disagree where the codes disagree',
    R.DIMENSIONS.ca.headroom.value > R.DIMENSIONS.us.headroom.value
      && R.DIMENSIONS.ca.width.value !== R.DIMENSIONS.us.width.value);
  check('nothing in either code pack claims to be verified',
    ['us', 'ca'].every(pack => Object.values(R.DIMENSIONS[pack])
      .filter(entry => entry && typeof entry === 'object' && 'value' in entry)
      .every(entry => entry.verified === false)),
    'a verified flag turned on by accident turns research into a code check');
  check('the width the nine sources could not agree on carries its dispute',
    typeof R.DIMENSIONS.ca.width.dispute === 'string');
  check('the landing default is deliberately NOT switched by jurisdiction',
    R.DIMENSIONS.ca.defaultLandingFt === R.DIMENSIONS.us.defaultLandingFt,
    "36\" satisfies both codes; narrowing it would move every stair that leaves landingFt unset");
  check('the width default IS switched, because the codes differ',
    R.DIMENSIONS.ca.defaultWidthFt !== R.DIMENSIONS.us.defaultWidthFt);
  check('the defaults are in feet, the unit the engine works in',
    Math.abs(R.DIMENSIONS.us.defaultWidthFt - 3) < 1e-9
      && Math.abs(R.DIMENSIONS.ca.defaultWidthFt - 34 / 12) < 1e-9);

  // ── THE TREE ─────────────────────────────────────────────────────────
  const named = [
    [{ storeys: 'bungalow' }, 'bungalow', ['straight', 'L']],
    [{ storeys: 'bilevel' }, 'splitEntry', ['straight']],
    [{ storeys: 'splitlevel' }, 'splitLevel', ['U', 'straight', 'L']],
    [{ storeys: 'two', houseWidthFt: 20 }, 'twoStoreyNarrow', ['U', 'L']],
    [{ storeys: 'two', entry: 'center' }, 'twoStoreyCentreEntry', ['straight', 'L']],
    [{ storeys: 'two', entry: 'side' }, 'twoStoreySideEntry', ['straight', 'L']],
    [{ storeys: 'two' }, 'twoStoreyDefault', ['straight', 'L', 'U']],
  ];
  named.forEach(([ctx, rule, head]) => {
    const got = R.suggestShapes(ctx);
    check(`${JSON.stringify(ctx)} is answered by ${rule}`, got.rule === rule,
      `got ${got.rule}`);
    check(`${rule} leads with ${head.join(' then ')}`,
      head.every((id, i) => got.shapes[i] === id), `got ${got.shapes.join(',')}`);
    check(`${rule} explains itself`, typeof got.note === 'string' && got.note.length > 20);
  });

  check('a narrow two-storey is decided before the entry position',
    R.suggestShapes({ storeys: 'two', entry: 'center', houseWidthFt: 20 }).rule
      === 'twoStoreyNarrow',
    'first match wins, and the width is the stronger constraint');
  check("narrow is derived from the house width at 24'",
    R.suggestShapes({ storeys: 'two', houseWidthFt: 23.9 }).rule === 'twoStoreyNarrow'
      && R.suggestShapes({ storeys: 'two', houseWidthFt: 24 }).rule !== 'twoStoreyNarrow'
      && R.NARROW_HOUSE_FT === 24);
  check('a stated narrow beats the width it contradicts',
    R.suggestShapes({ storeys: 'two', houseWidthFt: 40, narrow: true }).rule
      === 'twoStoreyNarrow'
      && R.suggestShapes({ storeys: 'two', houseWidthFt: 18, narrow: false }).rule
      === 'twoStoreyDefault');
  check('the storeys name is matched case-insensitively',
    R.suggestShapes({ storeys: 'BUNGALOW' }).rule === 'bungalow');

  // THE PROPERTY, OVER EVERY CONTEXT THE FIELDS ALLOW.
  const storeysValues = [undefined, 'bungalow', 'bilevel', 'splitlevel', 'two', 'three', ''];
  const entryValues = [undefined, 'center', 'side', 'rear', ''];
  const widthValues = [undefined, 16, 23.9, 24, 40, NaN, Infinity];
  const narrowValues = [undefined, true, false];
  let empty = null, dup = null, unknown = null, short = null, ruleUnknown = null;
  storeysValues.forEach(storeys => entryValues.forEach(entry =>
    widthValues.forEach(houseWidthFt => narrowValues.forEach(narrow => {
      const ctx = { storeys, entry, houseWidthFt, narrow };
      const got = R.suggestShapes(ctx);
      const where = JSON.stringify(ctx);
      if (!empty && got.shapes.length === 0) empty = where;
      if (!dup && new Set(got.shapes).size !== got.shapes.length) dup = where;
      if (!unknown && got.shapes.some(id => !R.SHAPE_BY_ID[id])) unknown = where;
      if (!short && !R.FALLBACK_LADDER.every(id => got.shapes.includes(id))) short = where;
      if (!ruleUnknown && got.rule !== null
        && !R.DECISION_TREE.some(row => row.id === got.rule)) ruleUnknown = where;
    }))));
  check('every context in the matrix gets a non-empty answer', empty === null, empty);
  check('no answer names a shape twice', dup === null, dup);
  check('no answer names a shape the table does not define', unknown === null, unknown);
  check('every answer is finished by the whole fallback ladder', short === null, short);
  check('an answer that names a rule names a rule that exists', ruleUnknown === null, ruleUnknown);
  check('a context of nothing at all still gets the ladder',
    R.suggestShapes(undefined).rule === null
      && R.suggestShapes(undefined).shapes.join() === R.FALLBACK_LADDER.join());
  check('a non-object context does not throw',
    R.suggestShapes('two').shapes.length === R.FALLBACK_LADDER.length);
  check('the ladder is straight, L, U, then winders as a last resort',
    R.FALLBACK_LADDER.join() === 'straight,L,U,winder');

  // ── WHY THIS STAIR ───────────────────────────────────────────────────
  const fired = [
    { ruleId: 'circulationDistance', points: 12.5 },
    { ruleId: 'entryLBonus', points: -4 },
    { ruleId: 'bedroomRepel', points: 0 },
    { ruleId: 'basementStacking', points: -30 },
    { ruleId: 'entryStepPenalty', points: 2 },
    { ruleId: 'noSuchRule', points: 5 },
    { ruleId: 'circulationDistance', points: NaN },
    { points: 99 },
    null,
  ];
  const told = R.scoreBreakdown({}, fired);
  check('the explanation is ordered by how much each rule mattered',
    told.map(t => t.ruleId).join() === 'basementStacking,circulationDistance,noSuchRule,entryLBonus,entryStepPenalty',
    `got ${told.map(t => t.ruleId).join()}`);
  check('a rule that helped is ordered by size, not buried under the penalties',
    told[0].ruleId === 'basementStacking' && told[0].points < 0,
    'ranking by raw points would put every bonus last and read as if none of them mattered');
  check('terms worth nothing are dropped',
    !told.some(t => t.ruleId === 'bedroomRepel'),
    'a breakdown listing a dozen zeroes explains nothing');
  check('a term with no number is dropped', told.filter(t => t.ruleId === 'circulationDistance').length === 1);
  check('a term with no rule is dropped and a null term does not throw',
    told.length === 5);
  check('each term is enriched with what kind of rule it was',
    told.find(t => t.ruleId === 'entryLBonus').kind === 'soft'
      && told.find(t => t.ruleId === 'entryLBonus').source
        === R.PLACEMENT_BY_ID.entryLBonus.source);
  check('a term the rulebook does not know says so rather than guessing',
    told.find(t => t.ruleId === 'noSuchRule').kind === null
      && told.find(t => t.ruleId === 'noSuchRule').source === null);
  check('nothing fired is nothing explained',
    R.scoreBreakdown({}, []).length === 0 && R.scoreBreakdown({}, undefined).length === 0);

  // ── THE DISAGREEMENTS AND THE CHECKLIST ──────────────────────────────
  check('the nine-source splits are still carried', R.DISAGREEMENTS.length === 7,
    `${R.DISAGREEMENTS.length} kept`);
  check('every split says what it is and where it stands',
    R.DISAGREEMENTS.every(d => d.topic && d.split && d.status));
  check('the NBC width is still recorded as unresolved',
    R.DISAGREEMENTS.some(d => /NBC minimum width/i.test(d.topic) && /UNRESOLVED/.test(d.status)));
  check('the verification checklist rides with the file it governs',
    R.VERIFICATION_CHECKLIST.length === 9);
  check('the rulebook is frozen all the way down',
    (function deepFrozen(value) {
      if (!value || typeof value !== 'object') return true;
      return Object.isFrozen(value) && Object.values(value).every(deepFrozen);
    })(R));
}

if (!MUTATE) {
  runChecks();
  console.log(`\nstair rules harness: ${passed} checks passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach(line => console.log(`  ✘ ${line}`));
    process.exit(1);
  }
  process.exit(0);
}

// ── MUTATIONS ───────────────────────────────────────────────────────────
const MUTATIONS = [
  ['the tree stops falling back, so an odd house gets no stair', 'stair-rules.js',
    c => c.replace("FALLBACK_LADDER.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });", '')],

  ['the ladder is appended without checking for what is already there', 'stair-rules.js',
    c => c.replace('FALLBACK_LADDER.forEach(id => { if (!ordered.includes(id)) ordered.push(id); });',
      'FALLBACK_LADDER.forEach(id => { ordered.push(id); });')],

  ['the ladder goes on the front, so the rule\'s own answer is buried', 'stair-rules.js',
    c => c.replace('const ordered = [...(rule ? rule.shapes : [])];',
      'const ordered = [...FALLBACK_LADDER];')],

  ['the last matching rule wins instead of the first', 'stair-rules.js',
    c => c.replace('const rule = DECISION_TREE.find(row => matches(row.when, probe)) || null;',
      'const rule = [...DECISION_TREE].reverse().find(row => matches(row.when, probe)) || null;')],

  ['a rule matches when ANY field agrees rather than all of them', 'stair-rules.js',
    c => c.replace('const matches = (when, ctx) => Object.entries(when).every(',
      'const matches = (when, ctx) => Object.entries(when).some(')],

  ['the storeys name is matched case-sensitively', 'stair-rules.js',
    c => c.replace("if (typeof want === 'string') return String(got || '').toLowerCase() === want;",
      "if (typeof want === 'string') return String(got || '') === want;")],

  ['narrow is derived the wrong way round', 'stair-rules.js',
    c => c.replace('context.houseWidthFt < NARROW_HOUSE_FT', 'context.houseWidthFt > NARROW_HOUSE_FT')],

  ["the narrow house threshold moves off 24'", 'stair-rules.js',
    c => c.replace('const NARROW_HOUSE_FT = 24;', 'const NARROW_HOUSE_FT = 28;')],

  ['a stated narrow is ignored in favour of the measured width', 'stair-rules.js',
    c => c.replace("const narrow = typeof context.narrow === 'boolean' ? context.narrow\n      : (Number.isFinite",
      'const narrow = false ? context.narrow\n      : (Number.isFinite')],

  // NOT A ROW, MEASURED. Dropping the Number.isFinite() guard -- so an
  // absent or NaN width yields `false` where it yields `undefined` today --
  // changes no answer anywhere in the matrix above. Every tree rule that
  // mentions narrow asks for `narrow: true`, and false and undefined both
  // fail that test; `narrow` itself is not returned. So the two forms are
  // indistinguishable from outside, and a row for it could only ever print
  // SURVIVED. It becomes a real row the first time a rule keys on
  // `narrow: false` -- a wide-house rule -- at which point an unmeasured
  // house would start matching it.

  ['the split-entry rule loses its straight run', 'stair-rules.js',
    c => c.replace("      when: { storeys: 'bilevel' },\n      shapes: ['straight'],",
      "      when: { storeys: 'bilevel' },\n      shapes: ['U'],")],

  ['builder-typical numbers are handed over as a code pack', 'stair-rules.js',
    c => c.replace("return DIMENSIONS[key] && key !== 'production' ? DIMENSIONS[key]",
      'return DIMENSIONS[key] ? DIMENSIONS[key]')],

  ['an unknown jurisdiction comes back undefined instead of the default', 'stair-rules.js',
    c => c.replace("    return DIMENSIONS[key] && key !== 'production' ? DIMENSIONS[key]\n      : DIMENSIONS[DIMENSIONS.defaultJurisdiction];",
      '    return DIMENSIONS[key];')],

  ['the default pack becomes the US one', 'stair-rules.js',
    c => c.replace("defaultJurisdiction: 'ca',", "defaultJurisdiction: 'us',")],

  ['the Canadian landing default is narrowed to the NBC minimum', 'stair-rules.js',
    c => c.replace('      defaultLandingFt: 36 * IN,\n    },\n\n    production:',
      '      defaultLandingFt: 35.43 * IN,\n    },\n\n    production:')],

  ['a code value is marked verified before the checklist is worked', 'stair-rules.js',
    c => c.replace("const val = (value, basis, extra) => ({ value, basis, verified: false, ...(extra || {}) });",
      'const val = (value, basis, extra) => ({ value, basis, verified: true, ...(extra || {}) });')],

  ['the disputed NBC width quietly loses its dispute', 'stair-rules.js',
    c => c.replace("        dispute: 'Sources give 34\", 36\" and 860mm for the NBC minimum and do not agree. VERIFY against the NBC text before this drives any validation.',\n", '')],

  ['the joist rule goes live despite the sources splitting five to three', 'stair-rules.js',
    c => c.replace("id: 'joistDirection', kind: 'soft', weight: 4, unit: 'cost', applied: 'inactive',",
      "id: 'joistDirection', kind: 'soft', weight: 4, unit: 'cost', applied: 'scored',")],

  ['the entry-L bonus turns into a penalty', 'stair-rules.js',
    c => c.replace("id: 'entryLBonus', kind: 'soft', weight: -4,", "id: 'entryLBonus', kind: 'soft', weight: 4,")],

  ['an unknown rule weighs something rather than nothing', 'stair-rules.js',
    c => c.replace('const weightOf = id => PLACEMENT_BY_ID[id]?.weight ?? 0;',
      'const weightOf = id => PLACEMENT_BY_ID[id]?.weight ?? 1;')],

  ['a shape the engine cannot draw is listed as generated', 'stair-rules.js',
    c => c.replace("fallbackRank: 4, generated: false,", 'fallbackRank: 4, generated: true,')],

  ['the breakdown is ordered by raw points, so every bonus reads as last', 'stair-rules.js',
    c => c.replace('.sort((a, b) => Math.abs(b.points) - Math.abs(a.points));',
      '.sort((a, b) => b.points - a.points);')],

  ['zero-point terms are kept and the explanation fills with nothing', 'stair-rules.js',
    c => c.replace('.filter(term => term && term.ruleId && Number.isFinite(term.points) && term.points !== 0)',
      '.filter(term => term && term.ruleId)')],

  ['a term for a rule the book does not know is given the first rule\'s kind', 'stair-rules.js',
    c => c.replace('kind: PLACEMENT_BY_ID[term.ruleId]?.kind ?? null,',
      "kind: PLACEMENT_BY_ID[term.ruleId]?.kind ?? 'hard',")],

  ['the table is left thawed below the top level', 'stair-rules.js',
    c => c.replace('      Object.values(value).forEach(deepFreeze);\n', '')],
];

let caught = 0;
for (const [name, file, fn] of MUTATIONS) {
  const before = fs.readFileSync(path.join(ROOT, file), 'utf8');
  if (fn(before) === before) {
    console.log(`  ANCHOR MISSED  ${name}  (the edit changed nothing in ${file} -- re-aim it)`);
    continue;
  }
  EDIT = { file, fn };
  let red = false;
  try { runChecks(); red = failures.length > 0; }
  catch (err) { red = true; }
  EDIT = null;
  if (red) caught += 1;
  else console.log(`  SURVIVED  ${name}`);
}
console.log(`stair-rules-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
