// DOES THE SHARED-SHELL HARNESS CATCH THE DRIFT IT WAS WRITTEN FOR?
//
// shared-shell-harness.js is ten checks of the shape "no page does X", and
// that shape is exactly the one that passes while measuring nothing. A
// selector list that stopped matching, a scan that found no pages, a regex
// with a typo -- each prints ten green lines and guards nothing. The harness
// was green the first time it ran, which tells you precisely nothing.
//
// So each mutant below is a real way the shared shell could come apart, and
// the question asked of the harness is whether it NOTICES. They are not
// hypotheticals: every one is a mistake someone could make in an afternoon,
// and #5 -- pasting a bar rule back into a page -- is the exact thing that
// already happened to .card between PROJECT.html and SPECS.html before any of
// this was shared.
//
// IT RUNS THE HARNESS, NOT A SPEC, so the whole gate is seconds rather than
// minutes. That is worth saying because the other mutation engines in this
// directory drive Playwright and take long enough that nobody runs them
// casually. This one has no excuse.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('./harness-args.js').noFlags();

const ROOT = path.resolve(__dirname, '..');
const HARNESS = 'proto/shared-shell-harness.js';

const MUTANTS = [
  { file: 'shell-bars.css',
    name: 'the sheet loses the top bar -- someone deletes the rule and the bar '
      + 'falls back to unstyled buttons in a row',
    find: '  #strip { position:fixed;',
    with: '  #strip-DELETED { position:fixed;' },

  { file: 'shell-bars.css',
    name: 'the sheet loses the bottom bar',
    find: '  #house-strip { position:fixed;',
    with: '  #house-strip-DELETED { position:fixed;' },

  { file: 'shell-bars.css',
    name: 'an instrument goes missing -- the cut that was nearly made, when '
      + 'they were thought to be MODEL\'s alone',
    // AIMED AT #strip-length-box BECAUSE IT OCCURS ONCE. The first version of
    // this mutant renamed one of NINE #strip-center rules and SURVIVED: the
    // harness only asked whether the selector appeared anywhere, and eight
    // copies were left to find it. Both ends were wrong -- the check was a
    // sighting rather than a set, and the mutant did not represent the
    // failure it was named after. The check is a set now; this is a selector
    // whose removal is actually the claim going false.
    find: '  #strip-length-box { display:flex;',
    with: '  #strip-length-box-DELETED { display:flex;' },

  { file: 'MODEL.html',
    name: 'a page wears the bars but forgets the stylesheet -- the shape the '
      + 'NEXT page will fail in, when SPECS or ESTIMATES is wired up',
    find: '<link rel="stylesheet" href="./shell-bars.css" />',
    with: '<!-- link rel="stylesheet" href="./shell-bars.css" -->' },

  { file: 'PROJECT.html',
    name: 'THE DRIFT ITSELF: a page pastes a bar rule back into its own '
      + '<style> because it wanted the row a little different',
    find: '  </style>',
    with: '  #file-row { gap:2px; }\n  </style>' },

  { file: 'shell-bars.css',
    name: 'a fifth literal colour appears where a role belongs -- the defect '
      + 'that left SPECS a white page on every skin',
    find: '  #file-row[hidden] { display:none; }',
    with: '  #file-row[hidden] { display:none; }\n  #file-row { color:#abcdef; }' },

  { file: 'MODEL.html',
    name: 'the sheet is linked without palette.js, so every role resolves to '
      + 'nothing and the bar paints in the browser\'s defaults',
    find: '<script src="./palette.js"></script>',
    with: '<!-- script src="./palette.js" -->' },

  { file: 'MODEL.html',
    name: 'the page mounts the bars with the MODULE NEVER LOADED -- the shape '
      + 'a new page fails in when someone copies the mount calls across',
    find: '<script src="./shell-bars.js"></script>',
    with: '<!-- script src="./shell-bars.js" -->' },

  { file: 'MODEL.html',
    name: 'THE DEFER TRAP: the module tag is still earlier in the text than '
      + 'every mount, so the ordering check sails through -- and the page '
      + 'throws, because defer runs it after the parse the mounts happen in',
    find: '<script src="./shell-bars.js"></script>',
    with: '<script src="./shell-bars.js" defer></script>' },

  { file: 'shell-bars.css',
    name: 'the rail shell goes missing -- the tabs and panels fall back to '
      + 'unstyled boxes on every page that has them',
    find: '  #left-rail {',
    with: '  #left-rail-DELETED {' },

  { file: 'shell-bars.js',
    name: 'the page row loses a chip -- the map of the job with a town '
      + 'missing, which is the row\'s oldest rule broken',
    // AIMED AT THE REAL `row`, NOT A SECOND ONE. The first draft appended
    // `row: 'nowhere'` after the title -- which JavaScript honours, the later
    // key winning, but which the harness reads straight past because its
    // regex takes the FIRST row: it finds. The mutant would have been killed
    // by nothing and reported as a hole in the check rather than in itself.
    find: "id: 'specs', row: 'sheet'",
    with: "id: 'specs', row: 'nowhere'" },
];

// EVERY FILE THIS GATE MUTATES. The restore is `git checkout -- <file>`, so a
// file left out of this list has any uncommitted work in it silently
// destroyed the first time a mutant touches it. Derived from MUTANTS rather
// than typed out again, because the two lists drifting is the same class of
// bug this whole directory is about.
const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`,
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

const run = () => {
  try {
    execSync(`node ${HARNESS}`, { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// THE BASELINE, FIRST. A mutant counts as KILLED when the harness fails, so a
// harness that is ALREADY failing kills every mutant and prints a perfect
// sheet over broken code -- the lie this gate exists to prevent, told by the
// gate itself.
if (run() !== 'passed') {
  console.log('REFUSING TO RUN: the harness is already failing before any mutant '
    + 'is applied.\nEvery mutant would read as KILLED and the sheet would be a lie.');
  process.exit(1);
}
console.log('baseline: the unmutated harness passes\n');

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const file = path.join(ROOT, m.file);
  const before = fs.readFileSync(file, 'utf8');
  // THE ANCHOR MUST BE UNIQUE, not merely present -- units-stack-mutants.js's
  // lesson, paid for there: `replace` takes the FIRST match, so an anchor
  // occurring twice mutates whichever copy comes first and the gate prints
  // SURVIVED when the truth is "the mutant never reached the code".
  const hits = before.split(m.find).length - 1;
  if (hits !== 1) {
    console.log(`  SKIPPED   ${m.name}\n            (anchor matches ${hits}× — re-aim \`find\`)`);
    ambiguous += 1;
    continue;
  }
  ran += 1;
  fs.writeFileSync(file, before.replace(m.find, m.with));
  const result = run();
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}`);
}

console.log(`\nshared shell mutants: ${killed}/${ran} killed`
  + (ambiguous ? `, ${ambiguous} skipped (bad anchor)` : ''));
// A SKIPPED MUTANT IS A FAILURE OF THE GATE, not a neutral outcome: it means
// this file believes it tested something it never applied.
process.exit(killed === ran && !ambiguous ? 0 : 1);
