// THE ROLE VOCABULARY, AND WHO SPEAKS IT.
//
// level-assembly.js became ROLE-AWARE on 6 Sep (Commander Devin's ruling, PR
// #323): ENTRY frames on 2x10s, OVER GARAGE spans clear on a 19 1/4" joist,
// and the id-to-role map lives in the module so there is ONE deriver instead
// of two vocabularies. Every caller was supposed to ask with a role.
//
// THREE DID NOT, AND NOTHING NOTICED FOR A DAY. MODEL.dc.html and PROJECT.html
// were updated; MODEL.html, LAYOUT.dc.html and proto/elevation-harness.js kept
// calling `normaliseLevelAssembly(assemblies[id])` with no second argument, so
// on those three every level framed like a plain floor. Measured through the
// real stair geometry rather than asserted:
//
//     stair up to OVER GARAGE   role-aware   117 1/8" rise, 15 risers, 11'-8" run
//                               role-less    109 3/4" rise, 14 risers, 10'-10" run
//
// One riser and a whole tread apart, on one drawing, between the page that
// serves users and the page written to replace it. ENTRY diverges too (104 1/8"
// against 106 3/4") and happens to land on the same riser count, so it draws
// the same run at slightly wrong riser heights -- real, and invisible.
//
// THIS IS THE FAILURE THE MODULE WAS EXTRACTED TO PREVENT, quoted from its own
// header: "the two boards would have drawn the same drawing with different
// riser counts." Pulling three copies of a table into one file removed the
// drift between the tables and left the drift between the CALLERS, which is
// the same defect one level up and has no single-page test that can see it.
//
// WHY NOBODY CAUGHT IT: of level-assembly.js's eight fields, three had no
// check anywhere in the repo -- joistType, joistSpacingIn and slabThicknessIn.
// Measured before this file was written: each was set to a different value and
// every harness in proto/ re-run -- 27 of them, this file not yet among them --
// and every one stayed green on all three. The vocabulary
// could move underneath them because nothing was holding them still.
//
// SO THE FIRST CHECK IS A SCAN, NOT AN ANCHOR. It does not name the three
// callers that were wrong -- it walks every caller file and requires EVERY
// `normaliseLevelAssembly(` to pass a role and EVERY `defaultLevelAssembly(`
// to pass one too. A fourth caller added tomorrow with no role fails here
// without anyone remembering to add it, which an anchored slice per known site
// would not do. The scan counts what it found and fails on zero, because a
// scan that matches nothing reports a clean sweep of an empty set.
//
//   node proto/level-role-harness.js
//   node proto/level-role-harness.js --mutate    break it, prove each break is caught
const fs = require('fs');
const path = require('path');

const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');

// The module and the geometry that consumes it, plus every file that asks
// either one a question. The harness itself is in the list: a check measuring
// a building the live board does not draw is worse than no check.
const FILES = Object.freeze({
  module:    'level-assembly.js',
  stair:     'stair-geometry.js',
  modelDc:   'MODEL.dc.html',
  modelHtml: 'MODEL.html',
  layout:    'LAYOUT.dc.html',
  project:   'PROJECT.html',
  elevation: 'proto/elevation-harness.js',
  cutView:   'cut-view.js',
});
// Files scanned for role-less calls: everyone except the module that DEFINES
// the functions (its own internal calls are the definition, not a caller) and
// stair-geometry.js, which never names them.
const CALLERS = Object.freeze(['modelDc', 'modelHtml', 'layout', 'project', 'elevation']);

function load(mutation) {
  const src = {};
  for (const [key, rel] of Object.entries(FILES)) src[key] = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (mutation) {
    const { file, apply } = mutation;
    const next = apply(src[file]);
    if (next === src[file]) throw new Error(`mutation matched nothing in ${FILES[file]} -- it would prove nothing`);
    src[file] = next;
  }
  const win = {};
  // eslint-disable-next-line no-new-func
  new Function('window', src.module)(win);
  // eslint-disable-next-line no-new-func
  new Function('window', src.stair)(win);
  // cut-view.js for the GARAGE slab, loaded for real rather than regexed out:
  // a rename or a restructure over there fails HERE, which a regex would sail
  // past. It reaches for three globals at module scope and none of them matter
  // for the one number read below, so three stubs are the whole cost.
  const cv = {
    DraftFormatters: { formatInchesOnly: () => '', formatFeetInches: () => '' },
    DraftWallTypes: { WALL_TYPES: [] },
    DraftGeometry: { offsetOutline: () => [], polygonArea: () => 0 },
  };
  // eslint-disable-next-line no-new-func
  new Function('window', src.cutView)(cv);
  return { LA: win.DraftLevelAssembly, SG: win.DraftStairGeometry,
           CUT_VIEW: cv.DraftCutView.STANDARDS, src };
}

// ── The scanner ───────────────────────────────────────────────────────────
// Finds every call of `name` and returns its top-level arguments, counted by
// walking parentheses rather than splitting on commas: `normalise(a, f(b, c))`
// takes TWO arguments and a comma split says three, which would pass a
// role-less call whose single argument happened to contain a comma.
//
// Comments are NOT stripped. A comment showing a role-less call is documenting
// the wrong contract, and this repo has already been burned twice by a comment
// that had stopped being true (elevation-harness.js's "mirrors LAYOUT exactly",
// the citation pointing at a file that refuted it). If one fails here, fix the
// comment -- that is the check working.
function callsOf(source, name) {
  const calls = [];
  const needle = new RegExp(`\\b${name}\\s*\\(`, 'g');
  let match;
  while ((match = needle.exec(source))) {
    let depth = 1, i = match.index + match[0].length;
    const start = i;
    for (; i < source.length && depth; i += 1) {
      if (source[i] === '(') depth += 1;
      else if (source[i] === ')') depth -= 1;
    }
    if (depth) continue;                        // unbalanced: not a call site
    const inner = source.slice(start, i - 1);
    const args = [];
    let buf = '', d = 0;
    for (const ch of inner) {
      if (ch === '(' || ch === '[' || ch === '{') d += 1;
      else if (ch === ')' || ch === ']' || ch === '}') d -= 1;
      if (ch === ',' && d === 0) { args.push(buf.trim()); buf = ''; continue; }
      buf += ch;
    }
    if (buf.trim()) args.push(buf.trim());
    calls.push({ args, line: source.slice(0, match.index).split('\n').length });
  }
  return calls;
}

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const ftIn = inches => {
  const sign = inches < 0 ? '-' : '';
  const eighths = Math.round(Math.abs(inches) * 8);
  const ft = Math.floor(eighths / 96), rest = eighths - ft * 96;
  const whole = Math.floor(rest / 8);
  const frac = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'][rest % 8];
  return `${sign}${ft}'-${whole}${frac ? ` ${frac}` : ''}"`;
};

// ── A. EVERY CALLER PASSES A ROLE ─────────────────────────────────────────
check('every normaliseLevelAssembly call passes a role', ({ src }) => {
  const bad = CALLERS.flatMap(key => callsOf(src[key], 'normaliseLevelAssembly')
    .filter(call => call.args.length < 2)
    .map(call => `${FILES[key]}:${call.line}`));
  return [bad.join(', '), ''];
});
check('every defaultLevelAssembly call passes a role', ({ src }) => {
  const bad = CALLERS.flatMap(key => callsOf(src[key], 'defaultLevelAssembly')
    .filter(call => call.args.length < 1)
    .map(call => `${FILES[key]}:${call.line}`));
  return [bad.join(', '), ''];
});
// THE COMPANION THE EMPTINESS ASSERTIONS NEED. Both checks above pass on a
// scan that finds nothing -- a rename, a broken regex, a caller list that
// drifted off the real filenames. Each caller file must contribute at least
// one call, so silence has to be earned.
check('and the scan actually found a call in every caller file', ({ src }) => {
  const empty = CALLERS.filter(key =>
    !callsOf(src[key], 'normaliseLevelAssembly').length
    && !callsOf(src[key], 'defaultLevelAssembly').length);
  return [empty.map(key => FILES[key]).join(', '), ''];
});
// And that the scanner can still see a role-less call at all: fed one, it must
// report it. Without this the two checks above are green whenever the walker
// is broken, which is the passing state and the broken state looking alike.
check('and the scanner still recognises a role-less call when shown one', () => {
  const sample = 'const a = normaliseLevelAssembly(assemblies[id]);\n'
    + 'const b = normaliseLevelAssembly(assemblies[id], levelRole(id));\n'
    + 'const c = normaliseLevelAssembly(pick(id, fallback), levelRole(id));';
  return [callsOf(sample, 'normaliseLevelAssembly').map(call => call.args.length).join(','), '1,2,2'];
});

// ── B. WHAT THE ROLE IS WORTH, IN RISERS ──────────────────────────────────
// Without this the section above is a style rule. A role that changed nothing
// would make skipping it harmless, and every check in A would be pedantry.
// LOWEST FIRST, which is the order stair-geometry.js requires and the order
// both boards hand it (`.slice().reverse()` on a top-down level list). It is
// load-bearing: `idx === 0` is the branch that descends onto the basement slab,
// so a reversed list would quietly move that branch to the top storey and every
// number below would still look plausible.
const LEVELS = Object.freeze([
  { id: 2, name: 'ENTRY' }, { id: 3, name: 'MAIN FL' },
  { id: 4, name: 'OVER GARAGE' }, { id: 5, name: '2ND FL' },
]);
// The four questions stair-geometry.js asks, answered twice: once the way the
// role-aware callers ask and once the way the role-less ones did. Nothing here
// is stored -- every number derives from the module.
const bundle = (LA, roleAware) => {
  const asm = id => LA.normaliseLevelAssembly(undefined, roleAware ? LA.levelRole(id) : undefined);
  return {
    floors: LEVELS,
    assemblyFor: asm,
    floorFtFor: id => LA.levelFloorFt(asm(id)),
    wallTopFtFor: () => LA.DEFAULT_WALL_TOP_FT,
  };
};
const layoutTo = (LA, SG, id, roleAware) => {
  const descent = SG.stairDescent(id, bundle(LA, roleAware));
  return descent ? { ...SG.stairLayout(descent.riseFt), riseFt: descent.riseFt } : null;
};

check('the stair to OVER GARAGE gains a riser when the role is read', ({ LA, SG }) => {
  const aware = layoutTo(LA, SG, 4, true), less = layoutTo(LA, SG, 4, false);
  return [`${less.risers} -> ${aware.risers}`, '14 -> 15'];
});
check('and a whole tread of run with it', ({ LA, SG }) => {
  const aware = layoutTo(LA, SG, 4, true), less = layoutTo(LA, SG, 4, false);
  return [Math.round((aware.runFt - less.runFt) * 12), SG.STAIR_TREAD_RUN_IN];
});
// The rise composed from the module, not quoted. A check against 117.125 would
// pass with the joist depth hardcoded at the call site, which is the mistake
// one layer along from the one being guarded.
check('the role-aware rise is the wall plus the OVER GARAGE package', ({ LA, SG }) => {
  const asm = LA.normaliseLevelAssembly(undefined, LA.levelRole(4));
  const want = LA.DEFAULT_WALL_TOP_FT + (asm.joistDepthIn + asm.sheathingIn) / 12;
  return [near(layoutTo(LA, SG, 4, true).riseFt, want), true];
});
// ENTRY is the quiet one and is checked precisely BECAUSE it is quiet: the
// rise is wrong by 2 5/8" and the riser count is not, so a check that only
// counted risers would call this level fine.
check('ENTRY diverges too, by its 2x10s, without changing the riser count', ({ LA, SG }) => {
  const aware = layoutTo(LA, SG, 2, true), less = layoutTo(LA, SG, 2, false);
  const gapIn = (less.riseFt - aware.riseFt) * 12;
  const joistGap = LA.normaliseLevelAssembly(undefined).joistDepthIn
    - LA.normaliseLevelAssembly(undefined, 'entry').joistDepthIn;
  return [near(gapIn, joistGap) && aware.risers === less.risers, true];
});
check('a plain floor level answers the same either way', ({ LA, SG }) =>
  [near(layoutTo(LA, SG, 5, true).riseFt, layoutTo(LA, SG, 5, false).riseFt), true]);

// ── The role table itself ─────────────────────────────────────────────────
// A role misspelt in the map is the worst shape available here: ROLE_DEFAULTS
// has no entry for it, defaultLevelAssembly spreads `{}`, and the level
// silently frames like a plain floor -- the wrong building, no error, and the
// page looks exactly as it does when it is right.
check('every role in the id map is a declared role', ({ LA }) => {
  const known = new Set(LA.LEVEL_ROLES);
  return [Object.values(LA.ROLE_BY_LEVEL_ID).filter(role => !known.has(role)).join(','), ''];
});
check('every mapped role actually changes the assembly', ({ LA }) => {
  const plain = JSON.stringify(LA.defaultLevelAssembly('floor'));
  const inert = [...new Set(Object.values(LA.ROLE_BY_LEVEL_ID))]
    .filter(role => JSON.stringify(LA.defaultLevelAssembly(role)) === plain);
  return [inert.join(','), 'foundation'];
});
check('an unmapped level is a plain floor', ({ LA }) =>
  [LA.levelRole(3), 'floor']);
check('and so is a level id nobody has invented yet', ({ LA }) =>
  [LA.levelRole(99), 'floor']);

// ── C. slabThicknessIn, WHICH NOTHING WATCHED ─────────────────────────────
// Its one geometric consumer: the lowest stair does not land on the foundation
// floor, it lands on the SLAB POURED ON IT (stair-geometry.js:83), so a thicker
// slab shortens the rise by exactly what it adds. The section drawing reads it
// too, through PROJECT.html's foundation row into cut-view.js:407 -- that ink
// is on the page's side of the line and is not paintable here; this is the
// reach a node harness has, and it is arithmetic rather than a literal.
const basement = (LA, SG, slabIn) => {
  const base = LA.normaliseLevelAssembly(undefined, LA.levelRole(1));
  const asm = id => (id === 1 ? { ...base, slabThicknessIn: slabIn } : LA.normaliseLevelAssembly(undefined, LA.levelRole(id)));
  return SG.stairDescent(LEVELS[0].id, {
    floors: LEVELS,
    assemblyFor: asm,
    floorFtFor: id => LA.levelFloorFt(asm(id)),
    wallTopFtFor: () => LA.DEFAULT_WALL_TOP_FT,
  });
};
check('the basement stair lands on the slab, not the foundation floor', ({ LA, SG }) =>
  [basement(LA, SG, LA.defaultLevelAssembly('foundation').slabThicknessIn).landing, 'the basement slab']);
check('pouring the slab 3" thicker shortens that rise by exactly 3"', ({ LA, SG }) => {
  const thin = basement(LA, SG, 3), thick = basement(LA, SG, 6);
  return [near((thin.riseFt - thick.riseFt) * 12, 3), true];
});
// Not a rounding: enough slab crosses a riser boundary and the drawn stair
// gets shorter. This is what makes the field geometry rather than a note.
check('and enough slab costs the stair a riser', ({ LA, SG }) => {
  const thin = SG.stairLayout(basement(LA, SG, 3).riseFt);
  const thick = SG.stairLayout(basement(LA, SG, 10).riseFt);
  return [thin.risers - thick.risers, 1];
});
check('a stored slab beats the default', ({ LA }) =>
  [LA.normaliseLevelAssembly({ slabThicknessIn: 5 }, 'foundation').slabThicknessIn, 5]);
// Zero is the interesting fallback and the reason this is `positive(...)` and
// not `?? `: a slab of no thickness is a typo, never a choice, and it would
// put the stair's bottom tread at the wrong height rather than error.
check('a zero slab falls back rather than pouring nothing', ({ LA }) =>
  [LA.normaliseLevelAssembly({ slabThicknessIn: 0 }, 'foundation').slabThicknessIn,
   LA.defaultLevelAssembly('foundation').slabThicknessIn]);
check('and so does a slab that arrived as text', ({ LA }) =>
  [LA.normaliseLevelAssembly({ slabThicknessIn: '4' }, 'foundation').slabThicknessIn, 4]);
// THE DEFAULT ITSELF, which the three checks above cannot hold: every one of
// them is a RELATIONSHIP (three inches of slab costs three inches of rise) and
// a relationship survives its baseline moving. The house pour was the last of
// the three unwatched fields with nothing on it at all.
//
// The rule first, the number second. A basement slab is thinner than the one a
// car parks on -- that is the fact, it is checkable against the file that owns
// the garage number, and it fails on the plausible mistake of pouring the house
// at the garage's 4". The literal is pinned under it because "thinner" alone
// still permits a 2" slab.
check('the house basement pours thinner than a garage slab', ({ LA, CUT_VIEW }) =>
  [LA.defaultLevelAssembly('foundation').slabThicknessIn < CUT_VIEW.GARAGE_SLAB_THICKNESS_IN, true]);
check('and it is the 3" typ pour', ({ LA }) =>
  [LA.defaultLevelAssembly('foundation').slabThicknessIn, 3]);
// A LONE LITERAL, SAID OUT LOUD. 16" O.C. is a framing convention and nothing
// else in this repo derives from it -- there is no stud spacing, no sheet
// module, no relationship to tie it to, so this check is exactly as strong as
// the number being typed correctly here and nowhere else. It is worth having
// anyway: an unpinned default with no reader is how OVER GARAGE carried a
// joist depth 3/4" too deep for two days.
check('joists frame at the 16" O.C. convention', ({ LA }) =>
  [LA.defaultLevelAssembly().joistSpacingIn, 16]);

// ── D. joistType AND joistSpacingIn: THE NORMALISER, AND NOTHING MORE ─────
// WHAT THESE CANNOT REACH, SAID PLAINLY. Neither field puts ink in any drawing
// this repo paints. Measured: set to anything, the other 27 harnesses stay green, and
// the elevation views come out byte-identical at 400 px/ft. Their ONE reader in
// the whole repository is the FLOOR JOISTS caption -- MODEL.dc.html:22484-5,
// `11 7/8" TJI @ 16" O.C. + 3/4" sheathing` -- which is a DOM string on a
// framework page and unreachable from node. tests/floor-assembly-label.spec.js
// holds that caption; nothing below pretends to.
//
// The normaliser IS pure and IS reachable, so what is checked here is the
// normaliser: which values survive it and which fall back. That is a real
// contract, not a stand-in for the missing one.
check('a joist type the catalogue does not stock falls back', ({ LA }) =>
  [LA.normaliseLevelAssembly({ joistType: 'unobtanium' }).joistType,
   LA.defaultLevelAssembly().joistType]);
check('a stocked one survives', ({ LA }) => {
  const other = LA.JOIST_TYPES.find(type => type.id !== LA.defaultLevelAssembly().joistType);
  return [LA.normaliseLevelAssembly({ joistType: other.id }).joistType, other.id];
});
// The fallback must not be silent about WHICH default it picked: a role that
// changed the joist type would have to change it here too, and today none does.
check('the joist type is one the FLOOR JOISTS box can label', ({ LA }) => {
  const stocked = new Set(LA.JOIST_TYPES.map(type => type.id));
  const bad = LA.LEVEL_ROLES.filter(role => !stocked.has(LA.defaultLevelAssembly(role).joistType));
  return [bad.join(','), ''];
});
check('a stored spacing beats the default', ({ LA }) =>
  [LA.normaliseLevelAssembly({ joistSpacingIn: 24 }).joistSpacingIn, 24]);
check('a spacing of zero falls back rather than framing at no spacing', ({ LA }) =>
  [LA.normaliseLevelAssembly({ joistSpacingIn: 0 }).joistSpacingIn,
   LA.defaultLevelAssembly().joistSpacingIn]);

// ── Run ───────────────────────────────────────────────────────────────────
function run(world) {
  const missed = [];
  for (const { label, fn } of CHECKS) {
    let got, want;
    try { [got, want] = fn(world); } catch (err) { got = `threw ${err.message}`; want = null; }
    if (got !== want) missed.push({ label, got, want });
  }
  return missed;
}

const baseline = run(load(null));
for (const m of baseline) console.log(`  FAIL ${m.label}\n       got ${JSON.stringify(m.got)}, want ${JSON.stringify(m.want)}`);
console.log(`level role harness: ${CHECKS.length - baseline.length}/${CHECKS.length} checks passed`);

// ── Mutations ─────────────────────────────────────────────────────────────
// Each is a thing somebody could plausibly do, and each reaches a drawing as a
// wrong number rather than an error. The first three ARE what was on main this
// morning, put back one file at a time.
const MUTATIONS = [
  ['MODEL.html goes back to asking role-less', 'modelHtml',
    s => s.replace('LA.normaliseLevelAssembly(assemblies[id], LA.levelRole(id))', 'LA.normaliseLevelAssembly(assemblies[id])')],
  ['LAYOUT.dc.html goes back to asking role-less', 'layout',
    s => s.replace('normaliseLevelAssembly(assemblies[levelId], levelRole(levelId))', 'normaliseLevelAssembly(assemblies[levelId])')],
  ['the elevation harness goes back to measuring a plain-floor building', 'elevation',
    s => s.replace('normaliseLevelAssembly(\n    assemblies[id], win.DraftLevelAssembly.levelRole(id))', 'normaliseLevelAssembly(assemblies[id])')],
  ['MODEL.dc.html drops the role on the level it reads most', 'modelDc',
    s => s.replace('normaliseLevelAssembly(this.state.levelAssemblies?.[levelId], levelRole(levelId))',
      'normaliseLevelAssembly(this.state.levelAssemblies?.[levelId])')],
  ['PROJECT.html normalises without one', 'project',
    s => s.replace('normaliseLevelAssembly(raw, levelRole(levelId))', 'normaliseLevelAssembly(raw)')],
  ['PROJECT.html asks for a default with no role', 'project',
    s => s.replace(': defaultLevelAssembly(levelRole(levelId)));', ': defaultLevelAssembly());')],
  // The map, which is where a role goes quiet rather than wrong.
  ['OVER GARAGE loses its entry in the id map', 'module',
    s => s.replace("4: 'overGarage'", "40: 'overGarage'")],
  ['a role in the map is misspelt, so the level frames like a plain floor', 'module',
    s => s.replace("2: 'entry'", "2: 'Entry'")],
  ['ENTRY loses its 2x10s', 'module',
    s => s.replace('entry: Object.freeze({ joistDepthIn: ENTRY_JOIST_IN }),', '')],
  // TWO MUTATIONS THAT BELONG IN THIS FILE'S TABLE AND ARE NOT IN IT:
  //
  //   OVER_GARAGE_JOIST_IN 19 1/4" -> 20" survives every check here, and
  //   should. proto/over-garage-floor-harness.js owns that number and drops
  //   to 4/9 on it. Writing a second copy of a check here is the fourth-copy
  //   problem in miniature -- two files asserting one fact, free to drift.
  //
  //   Declaring a role in LEVEL_ROLES with no ROLE_DEFAULTS entry also
  //   survives, because it is not a defect: 'floor' is exactly that by
  //   design, and a declared role nothing maps to cannot be selected. The
  //   mistake that DOES bite is a role in the id map that is not declared,
  //   or one declared and mapped that changes nothing, and both are checked.
  // The three fields nothing watched before this file.
  ['the basement slab is poured at the garage 4"', 'module',
    s => s.replace('DEFAULT_FDN_SLAB_THICKNESS_IN = 3', 'DEFAULT_FDN_SLAB_THICKNESS_IN = 4')],
  ['a zero slab is taken at face value instead of falling back', 'module',
    s => s.replace('slabThicknessIn: positive(raw.slabThicknessIn, base.slabThicknessIn),',
      'slabThicknessIn: raw.slabThicknessIn ?? base.slabThicknessIn,')],
  ['a zero spacing is taken at face value', 'module',
    s => s.replace('joistSpacingIn: positive(raw.joistSpacingIn, base.joistSpacingIn),',
      'joistSpacingIn: raw.joistSpacingIn ?? base.joistSpacingIn,')],
  ['the default framing spacing drifts', 'module',
    s => s.replace('joistSpacingIn: 16,', 'joistSpacingIn: 24,')],
  ['an unstocked joist type is stored rather than rejected', 'module',
    s => s.replace('joistType: JOIST_TYPES.some(type => type.id === raw.joistType) ? raw.joistType : base.joistType,',
      'joistType: raw.joistType ?? base.joistType,')],
  ['the default joist type is not one the catalogue stocks', 'module',
    s => s.replace("DEFAULT_JOIST_TYPE = 'tji'", "DEFAULT_JOIST_TYPE = 'i-joist'")],
  // And the stair, whose rise is where all of it shows.
  ['the lowest stair forgets it lands on a slab', 'stair',
    s => s.replace('- assembly.slabThicknessIn / 12;', '- 0;')],
  ['the floor package forgets its sheathing', 'module',
    s => s.replace('const levelFloorFt = assembly => (assembly.joistDepthIn + assembly.sheathingIn) / 12;',
      'const levelFloorFt = assembly => assembly.joistDepthIn / 12;')],
];

if (MUTATION_MODE) {
  console.log('\n' + 'mutation'.padEnd(66) + 'caught by');
  let survivors = 0, broken = 0;
  for (const [label, file, apply] of MUTATIONS) {
    let by;
    try {
      const missed = run(load({ file, apply }));
      if (!missed.length) survivors += 1;
      by = missed.length ? missed.map(m => m.label).join('\n' + ' '.repeat(66)) : '*** NOTHING ***';
    } catch (err) {
      broken += 1;
      by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
    }
    console.log(`${label.padEnd(66)}${by}`);
  }
  console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  process.exit(baseline.length || survivors || broken ? 1 : 0);
}

process.exit(baseline.length ? 1 : 0);
