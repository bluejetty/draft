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

const SPEC = 'tests/model-foot-light.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'THE SWITCH SWITCHES NOTHING when drawing: the board is the only reason',
    find: "  const onTheFoot_if = () => board === 'toy' || footOn;",
    with: "  const onTheFoot_if = () => board === 'toy';",
    test: 'the same DRAFTING run lands on the whole foot' },

  { file: 'MODEL.html',
    name: 'the light governs drawing only -- the drag half of "one light, both" is gone',
    find: '            const Q = window.DraftToyConstraints;\n            if (Q) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }',
    with: '            /* mutant */',
    test: 'a DRAFTING drag moves a whole number of feet' },

  { file: 'MODEL.html',
    name: 'THE LEAK: the switch reaches TOY, so the light can unround the TOY board',
    find: "  const onTheFoot_if = () => board === 'toy' || footOn;",
    with: '  const onTheFoot_if = () => footOn;',
    test: 'the light cannot unround TOY' },

  { file: 'MODEL.html',
    name: 'TOY ARMS THE LIGHT: opening a TOY drawing lights a DRAFTING instrument',
    find: '  let footOn = stored.footLight === true;',
    with: "  let footOn = stored.footLight === true || board === 'toy';",
    test: 'the light cannot unround TOY' },

  { file: 'MODEL.html',
    name: 'ON BY DEFAULT: a drafter who never touched it finds his plan on the grid',
    find: '  let footOn = stored.footLight === true;',
    with: '  let footOn = stored.footLight !== false;',
    test: 'a DRAFTING run commits the odd length the hand gave it' },

  { file: 'MODEL.html',
    name: 'the light is never stored, so it dies with the tab',
    find: "      localStorage.setItem(SKIN_KEY, JSON.stringify({ ...keep, footLight: footOn }));",
    with: '      void keep;',
    test: 'the light survives a reload' },

  { file: 'MODEL.html',
    name: 'THE LIGHT SQUARES TOO: DRAFTING quietly loses the off-axis wall',
    find: "  const squaring = () => tsquareOn || board === 'toy';",
    with: "  const squaring = () => tsquareOn || board === 'toy' || footOn;",
    test: 'the light rounds distance and squares nothing' },

  { file: 'MODEL.html',
    name: 'the drag rounds ONE axis, so a two-axis drag lands off the foot',
    find: '            if (Q) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }',
    with: '            if (Q) { dx = Q.quantiseFeet(dx); }',
    test: 'a DRAFTING drag moves a whole number of feet' },

  { file: 'MODEL.html',
    name: 'the light reaches the FILE: a page setting becomes drawing data',
    find: '  const storedChoice = () => ({',
    with: '  const storedChoice = () => ({\n    footLight: footOn,',
    test: 'a page setting, not drawing data' },
];

const run = grep => {
  try {
    execSync(`npx playwright test ${SPEC}`
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: '/home/user/draft', stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES. The restore is `git checkout -- <file>`, so a
// file left out of this guard has any uncommitted work in it silently
// destroyed the first time a mutant touches it.
const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: '/home/user/draft' }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `/home/user/draft/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: '/home/user/draft' });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
