// DOES THE TYPED-LENGTH SPEC CATCH A HANDLER THAT ROUTES THE WRONG KEYS?
//
// The gate for "type the length without clicking the box" (Movie, 16 Oct).
// The defects it is most afraid of are the two directions of one mistake:
// a handler that takes digits when there is NO run (mutant 3 -- 0 stops
// fitting the sheet for good) and one that lets them through when there IS
// one (mutant 5 -- 0 refits the sheet under the drafter's hands, the very
// complaint the box's own stopPropagation was written against).
//
// MUTANT 7 IS THE ONE WORTH THE GATE. Widen the opener to letters and every
// other check still passes -- digits still go in, Tab still works -- while W
// mid-run quietly becomes a character instead of the wall key. Only the
// letter check sees it.
//
// TWO ROUTES ARE NOT MUTATED, WITH THE REASON WRITTEN DOWN: Tab from the
// LENGTH box to the ANGLE box, and Shift+Tab back. The two boxes are the two
// focusable controls either side of the strip's centre line, so the
// browser's own Tab order lands on the same box the explicit route does, and
// a spec cannot tell the route from the default. The route is written out so
// it survives a control being put between the boxes; the day one is, these
// two mutants become demonstrable and belong here.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

// THE SPEC PATHS ARE WRITTEN OUT IN EACH ROW, not named once above the
// table: mutant-anchors-harness.js reads this table on its own, without the
// rest of the file, and a name it cannot see is a table it cannot read.

const MUTANTS = [
  { file: 'formatters.js', spec: 'tests/formatters.spec.js',
    name: 'THE SIXTH FORM IS STILL REFUSED: "14 6" has no branch',
    find: 'match = raw.match(/^([+-]?\\d+)\\s+(\\d.*)$/);',
    with: 'match = null;',
    test: 'feet, a space, inches' },

  { file: 'formatters.js', spec: 'tests/formatters.spec.js',
    name: 'the second number reads as FEET: "14 6" is twenty feet',
    find: '+ spacedInches));',
    with: '+ spacedInches * 12));',
    test: 'feet, a space, inches' },

  { file: 'model/14-promotion-tools.js', spec: 'tests/model-typed-length.spec.js',
    name: 'DIGITS TAKEN WITH NO RUN: 0 never fits the sheet again',
    find: '    if (lengthBox.disabled || !typedLengthOpener.test(event.key)) return;',
    with: '    if (!typedLengthOpener.test(event.key)) return;',
    test: 'with no run in hand the digits are the page' },

  { file: 'model/14-promotion-tools.js', spec: 'tests/model-typed-length.spec.js',
    name: 'the first digit is APPENDED to the live reading: 6\'-0"1',
    find: '    lengthBox.value = event.key;',
    with: '    lengthBox.value += event.key;',
    test: 'the first keystroke replaces the live reading' },

  { file: 'model/14-promotion-tools.js', spec: 'tests/model-typed-length.spec.js',
    name: 'THE KEY IS NOT SPENT: 0 goes into the box AND refits the sheet',
    find: '    event.preventDefault();\n    event.stopImmediatePropagation();\n    dropLengthHint();\n    lengthBox.value = event.key;',
    with: '    dropLengthHint();\n    lengthBox.value = event.key;',
    test: 'while a run is live, 0 is a digit and not a fit' },

  { file: 'model/14-promotion-tools.js', spec: 'tests/model-typed-length.spec.js',
    name: 'Tab from the sheet is the browser\'s Tab: the first control on the page, not ANGLE',
    find: '      if (!inAField(target) && !event.shiftKey && !angleBox.disabled && !lengthBox.disabled) {',
    with: '      if (false) {',
    test: 'TAB steps into the ANGLE box' },

  { file: 'model/14-promotion-tools.js', spec: 'tests/model-typed-length.spec.js',
    name: 'LETTERS OPEN THE BOX: W mid-run is a character, not the wall key',
    find: '  const typedLengthOpener = /^[0-9.]$/;',
    with: '  const typedLengthOpener = /^[0-9a-z.]$/i;',
    test: 'a letter is still a key' },
];

const run = (spec, grep) => {
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
const dirty = execSync('git status --porcelain MODEL.html formatters.js',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

// THE BASELINE FIRST. A spec that is already red kills every mutant and
// prints a perfect sheet over broken code.
for (const spec of ['tests/formatters.spec.js', 'tests/model-typed-length.spec.js']) {
  if (run(spec, null) !== 'passed') {
    console.error(`BASELINE RED: ${spec} fails on an unmutated tree; nothing below would mean anything.`);
    process.exit(1);
  }
}
console.log('baseline green\n');

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); ambiguous += 1; continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.spec, m.test);
  let note = '';
  if (result === 'passed' && run(m.spec, null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant counts as
// AMBIGUOUS and fails the sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
