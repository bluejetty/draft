// DOES THE STACKED-HIT-BOX CHECK CATCH THE BUG IT WAS WRITTEN FOR?
//
// The top bar stacks two pairs of buttons vertically -- IMPERIAL over METRIC,
// TOY over DRAFTING -- and the units pair is a REVERSAL of
// MODEL.dc.html:435-442, which collapsed units to one button after its two
// stacked buttons overlapped and METRIC ate every tap aimed at IMPERIAL.
//
// The reversal shipped citing a measurement that did not exist: MODEL.html
// said "model-html-topbar asserts each button's own centre hits ITSELF", and
// that spec is about house families and has no hit test in it. So the check
// was written, and this gate is the reason to believe it. Each mutant below
// is a way the stacks could go wrong that the stylesheet would still describe
// correctly.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-shell.spec.js';
const MINE = 'a tap aimed at a stacked button lands on that button';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'DC\'s OWN BUG, back: the units grow a 44px hit box by padding out '
      + 'and pulling the margin back, and overlap',
    find: '  #units-corner button {\n'
      + '    font-family: var(--font-ui); font-size:9px; font-weight:600;\n'
      + '    letter-spacing:0.05em; text-transform:uppercase;\n'
      + '    display:inline-flex; align-items:center; justify-content:center;\n'
      + '    min-width:64px; padding:2px 6px; cursor:pointer;',
    with: '  #units-corner button {\n'
      + '    font-family: var(--font-ui); font-size:9px; font-weight:600;\n'
      + '    letter-spacing:0.05em; text-transform:uppercase;\n'
      + '    display:inline-flex; align-items:center; justify-content:center;\n'
      + '    min-width:64px; padding:14px 6px; margin:-12px 0; cursor:pointer;' },

  { file: 'MODEL.html',
    name: 'METRIC alone reaches up over IMPERIAL — the stylesheet still says '
      + 'flex-direction:column',
    find: '  #units-corner .stack { display:flex; flex-direction:column; gap:1px; }',
    with: '  #units-corner .stack { display:flex; flex-direction:column; gap:1px; }\n'
      + '  #units-corner button[data-units="metric"] {\n'
      + '    margin-top:-12px; position:relative; z-index:1; }' },

  { file: 'MODEL.html',
    name: 'the OTHER stack overlaps: TOY and DRAFTING, which the units check '
      + 'alone would never have looked at',
    find: '  #mode-corner .set.stack button { padding:2px 7px; font-size:9px; }',
    with: '  #mode-corner .set.stack button {\n'
      + '    padding:10px 7px; margin:-8px 0; font-size:9px; }' },

  // NOT z-index:-1, WHICH DOES NOT COVER ANYTHING. A negative-z-index child
  // paints above its own parent's background, so the button stays on top and
  // stays hit-testable -- the mutant survived, and it deserved to. A real
  // covering is another piece of chrome lying over the stack, which is the
  // #389 collision class and the reason the hitsSelf half exists at all.
  { file: 'MODEL.html',
    name: 'SETTINGS lies over the unit stack: the boxes are perfect and every '
      + 'tap lands on the neighbouring corner',
    find: '  #settings-corner { display:flex; align-items:center; gap:6px; flex:0 0 auto; }',
    with: '  #settings-corner { display:flex; align-items:center; gap:6px; flex:0 0 auto;\n'
      + '    position:relative; z-index:2; margin-right:-70px; }' },

  { file: 'MODEL.html',
    name: 'the boxes are honest and the PRESS is eaten — a tap aimed at '
      + 'IMPERIAL lands on IMPERIAL and changes nothing',
    find: '    const wanted = b.dataset.units === \'metric\';\n'
      + '    if (wanted === metric()) return;',
    with: '    const wanted = b.dataset.units === \'metric\';\n'
      + '    if (wanted === metric() || !wanted) return;' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4345' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES. The restore is `git checkout -- <file>`, so a
// file left out of this guard has any uncommitted work in it silently
// destroyed the first time a mutant touches it. This gate mutates MODEL.html
// and nothing else.
//
// BEFORE THE BASELINE, NOT AFTER, and that ordering is the whole value. The
// baseline below is a full Playwright run of the spec -- minutes -- and it
// answers a question about the spec, not about your tree. A guard that fires
// only after it lets you walk away believing the gate is running when it has
// already refused, and the uncommitted work it was protecting is the thing
// you were least willing to lose.
const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

{
  const clean = run(MINE);
  if (clean !== 'passed') {
    console.log('REFUSING TO RUN: the check is already failing before any mutant '
      + 'is applied.\nEvery mutant would read as KILLED and the sheet would be a '
      + 'lie. Fix the check first.');
    process.exit(1);
  }
  console.log('baseline: the unmutated check passes\n');
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  // THE ANCHOR MUST BE UNIQUE, not merely present. `replace` takes the FIRST
  // match, so an anchor that occurs twice mutates whichever copy comes first
  // and the gate prints SURVIVED -- which reads as "the check has a hole"
  // when the truth is "the mutant never reached the code". That happened on
  // this gate's first run: three lines of button styling matched the SETTINGS
  // corner at :180 before the units corner at :196, so DC's own bug was
  // re-injected into a control the check does not look at.
  const hits = before.split(m.find).length - 1;
  if (hits !== 1) {
    console.log(`  SKIPPED   ${m.name}  (anchor matches ${hits}× — re-aim \`find\`)`);
    ambiguous += 1;
    continue;
  }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  const result = run(MINE);
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}`);
}
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
