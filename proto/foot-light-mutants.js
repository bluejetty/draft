// DOES THE FOOT LIGHT'S SPEC CATCH A SWITCH THAT SWITCHES NOTHING?
//
// The gate for FOOT-LIGHT-WORKORDER.md. The order names the failure it is
// most afraid of, in both directions: §3's gate already carries "TOY LEAKS:
// every board goes through the constraint path", and the order says the
// reverse -- a light that can UNROUND TOY -- is "the same defect wearing the
// other coat. Both directions need a check." Mutants 3 and 4 are those two.
//
// MUTANT 7 IS THE ONE WORTH THE GATE. Every other check in the spec passes if
// the light is routed through the TOY path wholesale: the run rounds, the drag
// rounds, TOY is untouched, it persists. What breaks is the thing nobody would
// think to look at -- DRAFTING quietly loses the right to draw off-axis. That
// is the failure the order calls "the worst failure this app has", and only
// acceptance 6 sees it.
const { execSync } = require('child_process');
const fs = require('fs');
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-foot-light.spec.js';

const MUTANTS = [
  { file: 'model/09-draw-move-stretch.js',
    name: 'THE SWITCH SWITCHES NOTHING when drawing',
    find: "  const onTheFoot_if = () => footOn;",
    with: "  const onTheFoot_if = () => false;",
    test: 'the same DRAFTING run lands on the whole foot' },

  { file: 'model/16-gestures-undo.js',
    name: 'the light governs drawing only -- the drag half of "one light, both" is gone',
    find: '            dx = quantiseFeet(dx); dz = quantiseFeet(dz);\n          }\n          md.before.forEach(',
    with: '            /* mutant */\n          }\n          md.before.forEach(',
    test: 'a DRAFTING drag moves a whole number of feet' },

  { file: 'model/01-skin-view.js',
    name: 'OFF BY DEFAULT: a fresh browser draws free, and the toy-like feel is gone',
    find: '  let footOn = stored.footLight !== false;',
    with: '  let footOn = stored.footLight === true;',
    spec: 'tests/lights-on-by-default.spec.js',
    test: 'a fresh browser lights the T-SQUARE and the 1 FT' },

  { file: 'model/13-suites-trim-follow.js',
    name: 'the light is never stored, so it dies with the tab',
    find: "      localStorage.setItem(SKIN_KEY, JSON.stringify({ ...keep, [key]: on }));",
    with: '      void keep;',
    test: 'the light survives a reload' },

  { file: 'model/13-suites-trim-follow.js',
    name: 'THE LIGHT SQUARES TOO: DRAFTING quietly loses the off-axis wall',
    find: "  const squaring = () => tsquareLive();",
    with: "  const squaring = () => tsquareLive() || footOn;",
    test: 'the light rounds distance and squares nothing' },

  { file: 'model/16-gestures-undo.js',
    name: 'the drag rounds ONE axis, so a two-axis drag lands off the foot',
    find: '            dx = quantiseFeet(dx); dz = quantiseFeet(dz);\n          }\n          md.before.forEach(',
    with: '            dx = quantiseFeet(dx);\n          }\n          md.before.forEach(',
    test: 'a DRAFTING drag moves a whole number of feet' },

  { file: 'model/17-boot-save.js',
    name: 'the light reaches the FILE: a page setting becomes drawing data',
    find: '    const { board: _board, ...rest } = drawing;\n    return {\n      ...rest,',
    with: '    const { board: _board, ...rest } = drawing;\n    return {\n      ...rest,\n      footLight: footOn,',
    test: 'a page setting, not drawing data' },
];

const run = (grep, spec = SPEC) => {
  try {
    execSync(`npx playwright test ${spec}`
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES. The restore is `git checkout -- <file>`, so a
// file left out of this guard has any uncommitted work in it silently
// destroyed the first time a mutant touches it.
const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test, m.spec);
  let note = '';
  if (result === 'passed' && run(null, m.spec) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
