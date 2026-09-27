// ROOFING MATERIALS — the table a drafter picks a roof's covering from.
//
//   node proto/roof-types-harness.js
//   node proto/roof-types-harness.js --mutate   break it, prove each break is caught
//
// Movie dictated four on 27 Sep -- *"1. ASPHALT/FIBERGLASS  2. PRE-FINISHED
// METAL (PFM) vertical  3. CEDAR SHAKE  4. TERRA-COTTA...."* -- asked what was
// missing, and took the whole answer: *"All 10"*.
//
// WHAT THIS FILE IS FOR is the same thing the wall finish harness is for: the
// table is a DESIGN, and a design that nothing reads back is a design that
// drifts. Ten rows that share six patterns is the claim that makes ten rows
// affordable, and it is checked below rather than asserted in a comment.
// THREE FILES, ONE SUBJECT. roof-types.js holds the vocabulary and answers
// what a roof wears and how its gable ends; profile-manager.js owns the four
// corner names, because they are an OFFICE standard and not this table's;
// drawing-format.js decides whether a stored roof is well formed enough to
// ask. Checked together because a rule that resolves a roofing the format
// would have dropped is a rule about nothing -- which is not hypothetical:
// the format drops both new keys unless the caller hands it these two lists,
// and a harness loading one file could not have noticed.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
const FILES = ['roof-types.js', 'profile-manager.js', 'drawing-format.js'];
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// THE MUTATOR SEES ALL THREE AT ONCE, keyed by name, so a mutation says which
// one it is breaking -- and an anchor that matched nothing in any of them is
// reported rather than passing quietly.
function load(mutate) {
  let src = Object.fromEntries(FILES.map(name => [name, read(name)]));
  if (mutate) {
    const next = mutate({ ...src });
    if (FILES.every(name => next[name] === src[name])) {
      throw new Error('mutation matched nothing -- it would prove nothing');
    }
    src = next;
  }
  const win = {};
  // profile-manager touches the document and localStorage at load. Neither is
  // what this file is about, so both are stubs -- and a stub that answers
  // nothing is right here: a standard nobody has saved IS the default.
  const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON,
    isFinite, parseFloat, Set, Map, Boolean, RegExp, Error, Date, URL, TextEncoder,
    document: { querySelector: () => null, querySelectorAll: () => [],
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
      addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: () => Promise.reject(new Error('no network in a harness')) };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const name of FILES) vm.runInContext(src[name], sandbox, { filename: name });
  return win;
}

// EVERY MUTATION GOES THROUGH HERE, which is the exactly-once guard the wall
// finish engine carries for the same reason: an anchor that matches twice
// breaks two things and an anchor that matches nothing breaks none, and both
// read as a mutation that was "caught".
const sub = (src, file, find, replace) => {
  const hits = src[file].split(find).length - 1;
  if (hits !== 1) throw new Error(`anchor hit ${hits} times in ${file}`);
  return { ...src, [file]: src[file].replace(find, replace) };
};

function run(win) {
  const missed = [];
  const check = (label, ok, detail) => {
    if (!ok) missed.push({ label, detail });
    if (!MUTATION_MODE) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `   ${detail}` : ''}`);
    return ok;
  };
  // A BROKEN MODULE MUST FAIL A CHECK, NOT KILL THE HARNESS. Two of the
  // mutants below make roofingById answer nothing, and nothing.id throws --
  // inside the module, in roofingsInUse, before any check here gets a verdict.
  // The runner reports a throw as "MUTATION DID NOT APPLY", which reads as an
  // anchor that missed rather than as the defect it is, so a real gap would
  // look exactly like a typo in this file. Measured: both came back that way
  // first. Every probe that could reach a null goes through here.
  const val = (fn, fallback = null) => {
    try { const out = fn(); return out === undefined ? fallback : out; }
    catch (error) { return fallback; }
  };
  const T = win.DraftRoofTypes;
  if (!T || !T.ROOFING_TYPES) {
    missed.push({ label: 'roof-types exports ROOFING_TYPES', detail: 'missing' });
    return missed;
  }
  const R = T.ROOFING_TYPES;

  // ── THE FIXTURE'S OWN REACH, asserted before anything filters it ──────
  check('the table has rows at all', R.length > 0, `${R.length}`);
  check('and it carries the four Movie dictated, by his own names',
    ['asphalt', 'pfm_vertical', 'cedar_shake', 'terracotta'].every(id => R.some(r => r.id === id)),
    R.map(r => r.id).join(' '));
  // TEN, AND THE NUMBER IS THE ANSWER HE GAVE. A row quietly dropped is a
  // material a drafter cannot pick any more, and nothing else here would say
  // so -- every other check below is about the rows that ARE present.
  check('and the other six he took when he said "All 10"',
    ['concrete_tile', 'slate', 'metal_shingle', 'corrugated',
      'composite_shake', 'wood_shingle'].every(id => R.some(r => r.id === id)),
    `${R.length} rows: ${R.map(r => r.id).join(' ')}`);

  const ids = R.map(r => r.id);
  check('every row has an id of its own, or a picker cannot tell two apart',
    new Set(ids).size === ids.length, ids.join(' '));
  check('and a label to show, since a drafter picks by reading not by id',
    R.every(r => typeof r.label === 'string' && r.label.trim().length > 0),
    R.map(r => `${r.id}:${r.label}`).join(' '));

  // ── TEN MATERIALS, SIX PICTURES ───────────────────────────────────────
  //
  // Which is the whole economy of the table: the market has ten things you can
  // buy and six things a drafter draws. Checked in BOTH directions, because
  // each failing means something different -- more patterns than six is rows
  // that should have shared one, and a pattern used by nothing is a painter
  // written for nobody.
  const patterns = [...new Set(R.map(r => r.pattern))];
  check('every row names a pattern for the painter to draw it with',
    R.every(r => typeof r.pattern === 'string' && r.pattern.length > 0),
    R.map(r => `${r.id}:${r.pattern || '-'}`).join(' '));
  // SEVEN, AND THE NUMBER WENT RED BEFORE IT WENT GREEN: this said six, which
  // was the comment in the module rather than the table underneath it. The two
  // that will not merge are the pressed metal panel and the slate -- a
  // two-foot regular grid against a staggered foot-wide course.
  check('and ten materials come to seven pictures, which is what makes ten affordable',
    patterns.length === 7, `${patterns.length}: ${patterns.join(' ')}`);
  // AND THE SHARING IS NOT ACCIDENTAL. The three rows that share `shake` are
  // the lapped-butt family and the two that share `barrel` are the tiles; if a
  // pattern were shared by rows from different families it would be one
  // painter asked to draw two things.
  check('the three lapped-butt rows share one pattern',
    ['cedar_shake', 'wood_shingle', 'composite_shake']
      .every(id => R.find(r => r.id === id)?.pattern === 'shake'),
    ['cedar_shake', 'wood_shingle', 'composite_shake']
      .map(id => `${id}:${R.find(r => r.id === id)?.pattern}`).join(' '));
  check('and the two tiles share one, since clay and concrete are the same profile',
    R.find(r => r.id === 'terracotta')?.pattern === 'barrel'
      && R.find(r => r.id === 'concrete_tile')?.pattern === 'barrel',
    `${R.find(r => r.id === 'terracotta')?.pattern} / ${R.find(r => r.id === 'concrete_tile')?.pattern}`);
  // THE THREE METALS DO NOT. Movie named one metal; the table carries three,
  // and the argument for the other two is that they draw differently. If they
  // shared a pattern that argument would be gone and so should the rows be.
  const metals = ['pfm_vertical', 'corrugated', 'metal_shingle']
    .map(id => R.find(r => r.id === id)?.pattern);
  check('and the three metals draw three different ways, which is why they are three rows',
    new Set(metals).size === 3, metals.join(' '));

  // ── WHAT A ROW FIXES AND WHAT IT LEAVES OPEN ──────────────────────────
  //
  // The wall table's ruling, applied here: *"make default 4\" but allow them to
  // change it (then we don't need multiple types)"*. A three-tab shingle is the
  // asphalt row at a 5" exposure, not a row of its own.
  check('every row leaves at least one number open for the drafter to set',
    R.every(r => Array.isArray(r.params) && r.params.length > 0),
    R.map(r => `${r.id}:${(r.params || []).length}`).join(' '));
  check('and every one of those numbers arrives with a sane default',
    R.every(r => r.params.every(p => Number.isFinite(p.in) && p.in > 0)),
    R.flatMap(r => r.params.map(p => `${r.id}.${p.key}=${p.in}`)).join(' '));
  check('and with a label, since a field called exposureIn is not a question',
    R.every(r => r.params.every(p => typeof p.label === 'string' && p.label.trim())),
    R.flatMap(r => r.params.map(p => `${r.id}.${p.key}:${p.label || '-'}`)).join(' '));

  // ── THE WEIGHT COLUMN, WHICH IS THE ONE WITH A CONSEQUENCE ────────────
  //
  // Slate and tile are four times asphalt, and that is the difference between
  // a truss off the shelf and a truss somebody designs. The threshold is named
  // once in the module; these check that the list it produces is the list a
  // roofer would name, in both directions.
  check('every row carries a weight, since that is the one number with a consequence',
    R.every(r => Number.isFinite(r.weightPsf) && r.weightPsf > 0),
    R.map(r => `${r.id}:${r.weightPsf}`).join(' '));
  check('the heavy list is the two tiles and the slate, and nothing else',
    val(() => [...T.HEAVY_ROOFING_IDS].sort().join(' ')) === 'concrete_tile slate terracotta',
    val(() => T.HEAVY_ROOFING_IDS.join(' '), 'it threw'));
  check('and it is derived from the threshold, not written down beside it',
    R.filter(r => r.weightPsf >= T.HEAVY_ROOFING_PSF).map(r => r.id).join(' ')
      === T.HEAVY_ROOFING_IDS.join(' '),
    `${T.HEAVY_ROOFING_PSF} psf -> ${T.HEAVY_ROOFING_IDS.join(' ')}`);
  check('asphalt is the lightest thing that is not metal, which sorts the table',
    R.find(r => r.id === 'asphalt').weightPsf
      < R.find(r => r.id === 'cedar_shake').weightPsf,
    `asphalt ${R.find(r => r.id === 'asphalt').weightPsf} vs cedar `
    + `${R.find(r => r.id === 'cedar_shake').weightPsf}`);
  check('and every metal is lighter than every non-metal, which is what metal is for',
    Math.max(...['pfm_vertical', 'corrugated', 'metal_shingle']
      .map(id => R.find(r => r.id === id).weightPsf))
      < Math.min(...R.filter(r => !['pfm_vertical', 'corrugated', 'metal_shingle']
        .includes(r.id)).map(r => r.weightPsf)),
    R.map(r => `${r.id}:${r.weightPsf}`).join(' '));

  // ── RELIEF FOLLOWS THE JOINT ──────────────────────────────────────────
  //
  // The wall table's rule, and the same one: a material with a visible edge
  // standing over the course below throws a shadow a drafter draws. Asphalt
  // lies flat and a pressed metal shingle is a crease, not an edge.
  check('the flat-lying rows take no relief',
    ['asphalt', 'metal_shingle'].every(id => !R.find(r => r.id === id).relief),
    ['asphalt', 'metal_shingle'].map(id => `${id}:${!!R.find(r => r.id === id).relief}`).join(' '));
  check('and everything with an edge over the course below does',
    R.filter(r => !['asphalt', 'metal_shingle'].includes(r.id)).every(r => r.relief === true),
    R.map(r => `${r.id}:${!!r.relief}`).join(' '));

  // ── AN UNKNOWN ID OPENS AS THE DEFAULT ────────────────────────────────
  check('the default names a row that is in the table',
    R.some(r => r.id === T.DEFAULT_ROOFING_ID), T.DEFAULT_ROOFING_ID);
  check('and it is asphalt, which is what is on the roof unless somebody says otherwise',
    T.DEFAULT_ROOFING_ID === 'asphalt', T.DEFAULT_ROOFING_ID);
  check('a known id answers its own row',
    val(() => T.roofingById('slate').id) === 'slate',
    val(() => T.roofingById('slate').id, 'nothing'));
  check('an unknown one answers the default rather than nothing, so a later file opens',
    val(() => T.roofingById('thatch').id) === T.DEFAULT_ROOFING_ID,
    val(() => T.roofingById('thatch').id, 'nothing'));
  check('and so does a roof with no roofing named at all',
    val(() => T.roofingById(undefined).id) === T.DEFAULT_ROOFING_ID,
    val(() => T.roofingById(undefined).id, 'nothing'));

  // ── THE CORNER IS THE ROOF'S, OR THE OFFICE'S ─────────────────────────
  //
  // Movie: *"allow them to change each iduvidually, don't worry about changing
  // all"*. Which needs "not set" and "set to what the office says" to stay
  // different records: the first follows the standard when it changes and the
  // second does not, and that difference IS per-roof control.
  const STYLES = ['flat', 'return', 'porkchop', 'boxed'];
  check('a roof that names no corner follows the office',
    T.cornerStyleOf({}, 'porkchop', STYLES) === 'porkchop',
    T.cornerStyleOf({}, 'porkchop', STYLES));
  check('and one that names its own keeps it when the office changes',
    T.cornerStyleOf({ gableCorner: 'boxed' }, 'porkchop', STYLES) === 'boxed'
      && T.cornerStyleOf({ gableCorner: 'boxed' }, 'flat', STYLES) === 'boxed',
    `${T.cornerStyleOf({ gableCorner: 'boxed' }, 'porkchop', STYLES)} / `
    + `${T.cornerStyleOf({ gableCorner: 'boxed' }, 'flat', STYLES)}`);
  check('while a roof set to the SAME style the office says still follows it after',
    T.cornerStyleOf({}, 'return', STYLES) === 'return'
      && T.cornerStyleOf({ gableCorner: 'return' }, 'boxed', STYLES) === 'return',
    'unset follows, set does not');
  check('a corner style this build does not know falls back rather than drawing nothing',
    T.cornerStyleOf({ gableCorner: 'gambrel' }, 'return', STYLES) === 'return',
    T.cornerStyleOf({ gableCorner: 'gambrel' }, 'return', STYLES));
  check('and so does an office standard it does not know',
    T.cornerStyleOf({}, 'gambrel', STYLES) === 'flat',
    T.cornerStyleOf({}, 'gambrel', STYLES));
  // THE STYLES ARE NOT COPIED HERE, which this check is the guard for: they
  // belong to profile-manager.js, and a second list in this module would be
  // two office standards that drift.
  check('the module keeps no list of corner styles of its own',
    !Array.isArray(T.GABLE_CORNER_STYLES),
    T.GABLE_CORNER_STYLES ? 'it has one' : 'none, which is right');

  // ── WHAT A LEGEND PRINTS ──────────────────────────────────────────────
  const legend = roofs => val(() => T.roofingsInUse(roofs).join(' '), 'it threw');
  check('a drawing with one kind of roof names it once',
    legend([{ roofing: 'slate' }, { roofing: 'slate' }]) === 'slate',
    legend([{ roofing: 'slate' }, { roofing: 'slate' }]));
  check('and one with two names both, in TABLE order rather than drawing order',
    legend([{ roofing: 'slate' }, { roofing: 'asphalt' }]) === 'asphalt slate',
    legend([{ roofing: 'slate' }, { roofing: 'asphalt' }]));
  check('a roof with nothing named counts as the default, since that is what it wears',
    legend([{}]) === T.DEFAULT_ROOFING_ID, legend([{}]));
  check('and no roofs at all name nothing',
    legend([]) === '' && legend(null) === '', `"${legend([])}" / "${legend(null)}"`);

  // ── AND NOW THE RECORD THE ROOF ACTUALLY CARRIES ──────────────────────
  //
  // drawing-format.js decides what survives a save and an open. Its standing
  // rule is CONDITIONAL KEYS: a record holds departures from the default and
  // nothing else, so every drawing that predates this field opens unchanged
  // rather than as a migration with every roof dirty.
  const FORMAT = win.DraftDrawingFormat;
  const PROFILES = win.DraftProfileManager;
  if (!FORMAT?.roofs || !PROFILES?.GABLE_CORNER_STYLES) {
    missed.push({ label: 'the format and the office standard both load',
      detail: `${!!FORMAT?.roofs} ${!!PROFILES?.GABLE_CORNER_STYLES}` });
    return missed;
  }
  const LEVELS = new Set([7]);
  // THE TWO VOCABULARIES A PAGE HANDS OVER. drawing-format reads no table off
  // `window` on purpose -- its own note says why -- so this env is the same
  // one cut-view-env.js builds, and a check that omitted it would be checking
  // a normaliser nobody calls.
  const rEnv = {
    roofingIds: R.map(r => r.id),
    cornerStyles: PROFILES.GABLE_CORNER_STYLES,
  };
  const ROOF = { id: 'r1', levelId: 7, pitch: 6,
    points: [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 30 }, { x: 0, z: 30 }] };
  const roof = (extra, env = rEnv) => val(() => FORMAT.roofs([{ ...ROOF, ...extra }], LEVELS, env)[0]);

  check('fixture: a roof with nothing new on it is still a roof',
    roof({})?.id === 'r1', roof({})?.id);
  check('and it grows neither key, so opening a drawing from before today is not a migration',
    !('roofing' in roof({})) && !('gableCorner' in roof({})),
    Object.keys(roof({}) || {}).join(','));
  check('a roof told what it wears keeps it',
    roof({ roofing: 'slate' })?.roofing === 'slate', roof({ roofing: 'slate' })?.roofing);
  check('and a roofing this build never heard of is dropped rather than stored',
    !('roofing' in roof({ roofing: 'thatch' })),
    JSON.stringify(roof({ roofing: 'thatch' })?.roofing ?? null));
  check('a roof told how its gable ends keeps that too',
    roof({ gableCorner: 'porkchop' })?.gableCorner === 'porkchop',
    roof({ gableCorner: 'porkchop' })?.gableCorner);
  check('and a corner style the office does not offer is dropped, so the painter is never guessing',
    !('gableCorner' in roof({ gableCorner: 'gambrel' })),
    JSON.stringify(roof({ gableCorner: 'gambrel' })?.gableCorner ?? null));

  // ── THE TRAP THE FINISH PAGE ALREADY FELL INTO ────────────────────────
  //
  // A caller that hands over no vocabulary gets a roof with neither key --
  // which is correct and is also exactly how EXT. FINISH came up blank of its
  // own subject on 27 Sep. Asserted here so the behaviour is a decision with a
  // check behind it rather than a surprise waiting for the next page.
  check('a caller that names no vocabulary gets neither key, which is why every call site names both',
    !('roofing' in roof({ roofing: 'slate', gableCorner: 'boxed' }, {}))
      && !('gableCorner' in roof({ roofing: 'slate', gableCorner: 'boxed' }, {})),
    Object.keys(roof({ roofing: 'slate', gableCorner: 'boxed' }, {}) || {}).join(','));

  // AND THE ROUND TRIP, which is the only question a saved file asks: a roof
  // written by this build and read back by it is the same roof.
  const saved = roof({ roofing: 'concrete_tile', gableCorner: 'boxed' });
  const reopened = val(() => FORMAT.roofs([saved], LEVELS, rEnv)[0]);
  check('a roof with both set survives a save and an open unchanged',
    reopened?.roofing === 'concrete_tile' && reopened?.gableCorner === 'boxed',
    `${reopened?.roofing} / ${reopened?.gableCorner}`);
  // AND THE ANSWER IS THE SAME AFTERWARDS. The record surviving is half of it;
  // what the drawing asks is what the ROOF WEARS, and that question goes
  // through the table, so it is asked on the reopened record rather than
  // inferred from the keys being present.
  check('and it still answers the same material and the same corner afterwards',
    val(() => T.roofingById(reopened.roofing).id) === 'concrete_tile'
      && T.cornerStyleOf(reopened, 'flat', PROFILES.GABLE_CORNER_STYLES) === 'boxed',
    `${val(() => T.roofingById(reopened.roofing).id)} / `
    + `${T.cornerStyleOf(reopened, 'flat', PROFILES.GABLE_CORNER_STYLES)}`);

  return missed;
}

const baseline = run(load(null));
if (!MUTATION_MODE) {
  console.log(`\nroof types harness: ${baseline.length ? `${baseline.length} FAILED` : 'all checks passed'}`);
  if (baseline.length) {
    baseline.forEach(m => console.log(`  ✘ ${m.label}${m.detail ? `   ${m.detail}` : ''}`));
    process.exit(1);
  }
  process.exit(0);
}

const MUTATIONS = [
  ['a row is dropped, so a material a drafter could pick is gone',
    s => sub(s, 'roof-types.js', "    { id: 'slate', label: 'Slate', pattern: 'slate',\n"
      + "      weightPsf: 9, relief: true,", "    { id: 'slate_gone', label: 'Slate', pattern: 'slate',\n"
      + '      weightPsf: 9, relief: true,')],
  ['two rows share an id, so a picker cannot tell them apart',
    s => sub(s, 'roof-types.js', "{ id: 'wood_shingle', label: 'Wood Shingle',",
      "{ id: 'cedar_shake', label: 'Wood Shingle',")],
  ['a row loses its label, so the picker shows a blank line',
    s => sub(s, 'roof-types.js', "{ id: 'corrugated', label: 'Corrugated Metal', pattern: 'rib',",
      "{ id: 'corrugated', label: '', pattern: 'rib',")],

  // ── THE SIX PICTURES ────────────────────────────────────────────────
  ['an eighth pattern appears, so a row that should have shared one did not',
    s => sub(s, 'roof-types.js', "{ id: 'wood_shingle', label: 'Wood Shingle', pattern: 'shake',",
      "{ id: 'wood_shingle', label: 'Wood Shingle', pattern: 'shingle',")],
  ['the two tiles stop sharing a picture, though they are the same profile',
    s => sub(s, 'roof-types.js', "{ id: 'concrete_tile', label: 'Concrete Tile', pattern: 'barrel',",
      "{ id: 'concrete_tile', label: 'Concrete Tile', pattern: 'slate',")],
  ['two of the three metals collapse into one, so the row stops earning itself',
    s => sub(s, 'roof-types.js', "{ id: 'corrugated', label: 'Corrugated Metal', pattern: 'rib',",
      "{ id: 'corrugated', label: 'Corrugated Metal', pattern: 'seam',")],
  ['a row names no pattern, leaving the painter to guess',
    s => sub(s, 'roof-types.js', "{ id: 'asphalt', label: 'Asphalt / Fibreglass', pattern: 'tab',",
      "{ id: 'asphalt', label: 'Asphalt / Fibreglass',")],

  // ── WHAT IS FIXED AND WHAT IS OPEN ──────────────────────────────────
  ['a row hardcodes its spacing, so a 5" three-tab needs a row of its own again',
    s => sub(s, 'roof-types.js', "      params: Object.freeze([\n"
      + "        { key: 'exposureIn', label: 'Exposure', in: 5.625 },\n"
      + "        { key: 'tabIn', label: 'Tab', in: 12 },\n"
      + '      ]) },', '      params: Object.freeze([]) },')],
  ['a parameter loses its default, so a fresh roof draws at no spacing at all',
    s => sub(s, 'roof-types.js', "{ key: 'ribIn', label: 'Rib spacing', in: 9 }",
      "{ key: 'ribIn', label: 'Rib spacing', in: 0 }")],
  ['a parameter loses its label, so a field called ribIn is the question',
    s => sub(s, 'roof-types.js', "{ key: 'ribIn', label: 'Rib spacing', in: 9 }",
      "{ key: 'ribIn', in: 9 }")],

  // ── THE WEIGHT ──────────────────────────────────────────────────────
  ['a row loses its weight, so the framing question cannot be asked',
    s => sub(s, 'roof-types.js', "{ id: 'slate', label: 'Slate', pattern: 'slate',\n      weightPsf: 9, relief: true,",
      "{ id: 'slate', label: 'Slate', pattern: 'slate',\n      relief: true,")],
  ['slate weighs what asphalt does, so a slate roof asks nothing of the trusses',
    s => sub(s, 'roof-types.js', "{ id: 'slate', label: 'Slate', pattern: 'slate',\n      weightPsf: 9,",
      "{ id: 'slate', label: 'Slate', pattern: 'slate',\n      weightPsf: 2.5,")],
  ['the heavy list is written down instead of derived, so the threshold stops meaning anything',
    s => sub(s, 'roof-types.js', "  const HEAVY_ROOFING_IDS = Object.freeze(ROOFING_TYPES\n"
      + "    .filter(r => r.weightPsf >= HEAVY_ROOFING_PSF).map(r => r.id));",
      "  const HEAVY_ROOFING_IDS = Object.freeze(['terracotta', 'concrete_tile', 'slate',\n"
      + "    'cedar_shake']);")],
  ['the threshold moves up past the tiles, so nothing is heavy any more',
    s => sub(s, 'roof-types.js', 'const HEAVY_ROOFING_PSF = 6;', 'const HEAVY_ROOFING_PSF = 20;')],
  ['a metal outweighs a shake, so the reason to pick metal is gone',
    s => sub(s, 'roof-types.js', "{ id: 'corrugated', label: 'Corrugated Metal', pattern: 'rib',\n      weightPsf: 1.2,",
      "{ id: 'corrugated', label: 'Corrugated Metal', pattern: 'rib',\n      weightPsf: 4,")],

  // ── RELIEF ──────────────────────────────────────────────────────────
  ['asphalt grows a shadow, so a flat-lying roof is drawn as a lapped one',
    s => sub(s, 'roof-types.js', "      weightPsf: 2.5, relief: false,", '      weightPsf: 2.5, relief: true,')],
  ['a shake loses its butt, so the line at every course has nothing behind it',
    s => sub(s, 'roof-types.js', "{ id: 'cedar_shake', label: 'Cedar Shake', pattern: 'shake',\n      weightPsf: 3, relief: true,",
      "{ id: 'cedar_shake', label: 'Cedar Shake', pattern: 'shake',\n      weightPsf: 3, relief: false,")],

  // ── THE DEFAULT ─────────────────────────────────────────────────────
  ['the default names a material that is not in the table',
    s => sub(s, 'roof-types.js', "const DEFAULT_ROOFING_ID = 'asphalt';", "const DEFAULT_ROOFING_ID = 'thatch';")],
  ['the default is the expensive one, so every roof opens as slate',
    s => sub(s, 'roof-types.js', "const DEFAULT_ROOFING_ID = 'asphalt';", "const DEFAULT_ROOFING_ID = 'slate';")],
  ['an unknown id answers nothing, so a file from a later build draws a hole',
    s => sub(s, 'roof-types.js', "  const roofingById = id => ROOFING_TYPES.find(r => r.id === id)\n"
      + "    || ROOFING_TYPES.find(r => r.id === DEFAULT_ROOFING_ID);",
      '  const roofingById = id => ROOFING_TYPES.find(r => r.id === id) || null;')],

  // ── THE CORNER ──────────────────────────────────────────────────────
  ['the roof stops overriding the office, so "individually" means nothing',
    s => sub(s, 'roof-types.js', "    if (own && styles.includes(own)) return own;\n", '')],
  ['the office stops being consulted, so an unset roof is always flat',
    s => sub(s, 'roof-types.js', "    return styles.includes(officeStyle) ? officeStyle : (styles[0] || null);",
      '    return styles[0] || null;')],
  ['an unknown corner style is kept, so the painter is handed a name it cannot draw',
    s => sub(s, 'roof-types.js', '    if (own && styles.includes(own)) return own;',
      '    if (own) return own;')],
  ['the module grows its own list of corner styles, a second office standard to drift',
    s => sub(s, 'roof-types.js', '  window.DraftRoofTypes = Object.freeze({',
      "  const GABLE_CORNER_STYLES = ['flat', 'return', 'porkchop', 'boxed'];\n"
      + '  window.DraftRoofTypes = Object.freeze({\n    GABLE_CORNER_STYLES,')],

  // ── THE LEGEND ──────────────────────────────────────────────────────
  // ── THE RECORD ──────────────────────────────────────────────────────
  ['the roofing is written onto every roof, so opening an old drawing is a migration',
    s => sub(s, 'drawing-format.js',
      "        ...(Array.isArray(env.roofingIds) && env.roofingIds.includes(roof?.roofing)\n"
      + '          ? { roofing: roof.roofing } : {}),',
      "        roofing: env.roofingIds && env.roofingIds.includes(roof?.roofing)\n"
      + "          ? roof.roofing : 'asphalt',")],
  ['the roofing is dropped, so the ROOF area cannot store what a roof wears',
    s => sub(s, 'drawing-format.js',
      '        ...(Array.isArray(env.roofingIds) && env.roofingIds.includes(roof?.roofing)\n'
      + '          ? { roofing: roof.roofing } : {}),', '')],
  ['an unknown roofing is stored anyway, so the painter is handed a word it cannot draw',
    s => sub(s, 'drawing-format.js',
      '        ...(Array.isArray(env.roofingIds) && env.roofingIds.includes(roof?.roofing)\n'
      + '          ? { roofing: roof.roofing } : {}),',
      '        ...(roof?.roofing ? { roofing: roof.roofing } : {}),')],
  ['the corner is dropped, so "change each individually" stores nothing',
    s => sub(s, 'drawing-format.js',
      '        ...(Array.isArray(env.cornerStyles) && env.cornerStyles.includes(roof?.gableCorner)\n'
      + '          ? { gableCorner: roof.gableCorner } : {}),', '')],
  ['an unknown corner style is stored, so a fifth style reaches a painter that has four',
    s => sub(s, 'drawing-format.js',
      '        ...(Array.isArray(env.cornerStyles) && env.cornerStyles.includes(roof?.gableCorner)\n'
      + '          ? { gableCorner: roof.gableCorner } : {}),',
      '        ...(roof?.gableCorner ? { gableCorner: roof.gableCorner } : {}),')],
  ['every roof is written with the office corner, so an unset roof stops following it',
    s => sub(s, 'drawing-format.js',
      '        ...(Array.isArray(env.cornerStyles) && env.cornerStyles.includes(roof?.gableCorner)\n'
      + '          ? { gableCorner: roof.gableCorner } : {}),',
      "        gableCorner: Array.isArray(env.cornerStyles)\n"
      + "          && env.cornerStyles.includes(roof?.gableCorner) ? roof.gableCorner : 'flat',")],
  ['the office loses its list, so nothing can validate a corner at all',
    s => sub(s, 'profile-manager.js', '    GABLE_CORNER_STYLES,\n', '')],

  ['the legend prints a material once per roof that wears it',
    s => sub(s, 'roof-types.js', "    return ROOFING_TYPES.filter(r => asked.has(r.id)).map(r => r.id);",
      '    return (Array.isArray(roofs) ? roofs : []).map(roof => roofingById(roof?.roofing).id);')],
  ['the legend lists in drawing order, so two drawings of one house print differently',
    s => sub(s, 'roof-types.js', "    const asked = new Set((Array.isArray(roofs) ? roofs : [])\n"
      + '      .map(roof => roofingById(roof?.roofing).id));\n'
      + '    return ROOFING_TYPES.filter(r => asked.has(r.id)).map(r => r.id);',
      '    const seen = [];\n'
      + '    (Array.isArray(roofs) ? roofs : []).forEach(roof => {\n'
      + '      const id = roofingById(roof?.roofing).id;\n'
      + '      if (!seen.includes(id)) seen.push(id);\n'
      + '    });\n'
      + '    return seen;')],
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
