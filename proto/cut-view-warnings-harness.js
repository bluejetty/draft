// CUT-VIEW NAMES EVERY OPTIONAL MODULE IT IS MISSING.
//
// This exists because I missed one. #533 gave four silent fallbacks a voice
// and left a fifth -- the elevation's window size tag, at cut-view.js:4160,
// a bare `&&` with no warning. Devin's verification pass found it. It was my
// code, in my file, and the plan-side twin of that very guard had cost a
// morning the day before: the tag drew nothing, threw nothing, and four
// separate mirrors reported a clean sheet.
//
// SO THE CHECK IS THE CLASS, NOT THE INSTANCE. One warning proved by hand is
// one warning; a list walked in a loop is the thing that catches the SIXTH
// when somebody adds it. Every optional module cut-view reads gets loaded
// out from under it in turn, and the painter has to say the file's name.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const env = require('./harness-env.js');

const ROOT = path.join(__dirname, '..');
// THROUGH harness-args.js, NOT ARGV READ BY HAND (1 Oct). This file had a
// working table, 5/5, from the day it was written -- and CI never ran it,
// because the engines step finds an engine by its mutationMode() call and
// this one parsed --mutate itself. The workflow's own comment names that
// exact trap for seven other harnesses; this was the eighth.
const MUTATE = require('./harness-args.js').mutationMode();

const BASE = ['formatters.js', 'wall-types.js', 'geometry-2d.js', 'drawing-format.js',
  'room-standards.js', 'level-assembly.js', 'cut-marks.js', 'render-2d.js'];
// Each optional module, and the word its warning must carry beyond the
// filename -- so a warning that names the file and describes the wrong loss
// still fails.
const OPTIONAL = [
  ['build-house.js', /footing/i],
  ['finish-patterns.js', /wall/i],
  ['roof-patterns.js', /roof/i],
  ['fen-labels.js', /size|tag/i],
];
const ALL = ['build-house.js', 'finish-patterns.js', 'roof-patterns.js',
  'roof-types.js', 'fen-labels.js', 'profile-manager.js'];

function sandbox(omit, edit) {
  const warnings = [];
  const win = {};
  const box = {
    window: win, Math, Number, String, Object, Array, JSON, Map, Set, Boolean,
    isFinite, parseFloat, parseInt, Date, RegExp, Error,
    console: { warn: m => warnings.push(String(m)), error: () => {}, log: () => {} },
  };
  box.globalThis = box;
  vm.createContext(box);
  for (const file of [...BASE, ...ALL, 'cut-view-env.js', 'cut-view.js']) {
    if (file === omit) continue;
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) continue;
    let code = fs.readFileSync(full, 'utf8');
    if (edit && file === 'cut-view.js') code = edit(code);
    try { vm.runInContext(code, box, { filename: file }); } catch { /* reported by the checks */ }
  }
  return { win, warnings };
}

const SAVED = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'proto', 'repro-2storey-garage-beam.draft'), 'utf8'));

let failures = 0;
const check = (name, cond, detail) => {
  if (cond) return;
  failures += 1;
  console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ''}`);
};

// Paints every standard elevation with finishes on, which is the only mode
// that asks for any of these modules at all.
function paintAll(win) {
  const e = env.buildEnv(win, SAVED);
  if (!e) return 0;
  let painted = 0;
  for (const cut of env.standardElevationCuts(e)) {
    try {
      const out = env.paintElevation(win, e, cut, { finishes: true });
      if (out && out.ok) painted += 1;
    } catch { /* a throw is its own failure below */ }
  }
  return painted;
}

function run() {
  // ── THE FIXTURE'S OWN REACH ───────────────────────────────────────────
  const full = sandbox(null);
  const painted = paintAll(full.win);
  check('the fixture paints elevations at all', painted > 0);
  check('the fixture carries windows to label',
    (SAVED.fenestrations || []).some(f => f.type === 'window'));
  check('a complete load says nothing',
    full.warnings.length === 0, full.warnings.join(' / '));

  // ── AND EACH MODULE, TAKEN AWAY IN TURN ───────────────────────────────
  for (const [file, mustSay] of OPTIONAL) {
    const { win, warnings } = sandbox(file);
    paintAll(win);
    const named = warnings.filter(w => w.includes(file));
    check(`without ${file} cut-view names it`,
      named.length > 0, warnings.join(' / ') || '(silent)');
    check(`without ${file} the warning says what is lost`,
      named.some(w => mustSay.test(w)), named.join(' / ') || '(nothing named it)');
    check(`without ${file} it is said once, not once per opening`,
      named.length <= 1, `said ${named.length} times`);
  }
}

if (!MUTATE) {
  run();
  console.log(failures
    ? `cut-view-warnings-harness: ${failures} FAILED`
    : 'cut-view-warnings-harness: all checks pass');
  process.exit(failures ? 1 : 0);
}

// PLAIN `.replace()` WITH STRING ANCHORS, and neither half is a style choice.
//
// mutant-anchors-harness reads this table to check every anchor is still
// alive in the file it edits. It slices the table by walking brackets while
// tracking strings and comments -- it does not know a REGEX LITERAL when it
// sees one, so an apostrophe inside /.../ (as in `f.type === 'window'`) puts
// its slicer into string mode and the table never closes. And `replace` is
// the edit verb it understands; a `.split().join()` reads to it as a target
// that does not exist.
//
// THE FILE IS NAMED IN EVERY ENTRY because that is how mutant-anchors knows
// which source to look the anchor up in; without it the anchor reads as
// aimed at nothing and the liveness check cannot run.
//
// EVERY ANCHOR IS SINGLE-OCCURRENCE IN cut-view.js, checked rather than
// assumed: `.replace` with a string edits the FIRST match only, so an anchor
// appearing twice would leave the second site intact and the mutation would
// survive against a check that is working perfectly. That is why the pattern
// case below aims at ROOF patterns -- the wall-pattern warning has two sites
// and cannot be killed with one replace.
const MUTATIONS = [
  ['fen-labels warning deleted', 'cut-view.js',
    c => c.replace('!window.DraftFenLabels && !warnedNoFenLabels',
      'false && !warnedNoFenLabels')],
  ['fen-labels warning loses the filename', 'cut-view.js',
    c => c.replace('fen-labels.js is not loaded', 'a module is not loaded')],
  ['fen-labels warning repeats per window', 'cut-view.js',
    c => c.replace('warnedNoFenLabels = true;', 'warnedNoFenLabels = false;')],
  ['build-house warning deleted', 'cut-view.js',
    c => c.replace('!bh && !warnedNoFootings', 'false && !warnedNoFootings')],
  ['roof-pattern warning repeats per roof', 'cut-view.js',
    c => c.replace('warnedNoRoofPatterns = true;', 'warnedNoRoofPatterns = false;')],
  // 1 Oct: the other two halves of the class, for the cases above that had
  // only one. Each of the three is checked for being said, saying what is
  // lost, and being said once.
  ['build-house warning names the file and describes the wrong loss', 'cut-view.js',
    c => c.replace(`+ 'footing is drawn at the 12" fallback rather than its own size.');`,
      `+ 'is drawn at the 12" fallback rather than its own size.');`)],
  ['build-house warning repeats per pile', 'cut-view.js',
    c => c.replace('warnedNoFootings = true;', 'warnedNoFootings = false;')],
  ['roof-pattern warning deleted', 'cut-view.js',
    c => c.replace('        if (!warnedNoRoofPatterns) {', '        if (false) {')],
];

// A RUN THAT IS ALREADY RED KILLS EVERY ROW, and this loop scores a row by
// whether failures went up -- so a clean run that fails would read 100%
// while measuring nothing. It is run once unbent first.
run();
if (failures) {
  console.log(`cut-view-warnings-harness: REFUSED -- ${failures} check(s) fail with nothing mutated`);
  process.exit(1);
}

let caught = 0;
for (const [name, , edit] of MUTATIONS) {
  const before = failures;
  const origSandbox = sandbox;
  // eslint-disable-next-line no-func-assign
  sandbox = (omit) => origSandbox(omit, edit);
  try { run(); } catch { failures += 1; }
  sandbox = origSandbox;
  if (failures > before) caught += 1; else console.log(`  SURVIVED  ${name}`);
  failures = before;
}
console.log(`cut-view-warnings-harness: ${caught}/${MUTATIONS.length} mutations caught`);
process.exit(caught === MUTATIONS.length ? 0 : 1);
