#!/usr/bin/env node
// MUTATION GATE for the CALC tab on the NOTES pad (Movie, 18 Oct: "can we add
// a construction calculator tab under the notebook tab ... metric and ft and
// do area" -- "need areas for sure"). The arithmetic has its own mutations in
// proto/calc-engine-harness.js --mutate; these are the pad's wiring.
//
// Run: node proto/calc-pad-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/model-html-calc.spec.js', 'tests/calc-sqrt.spec.js'];
const MUTANTS = [
  // THE ROOT AND THE SQUARE (Movie, 20 Oct), and the tab's name.
  { file: 'MODEL.html', name: "no root key on the pad", spec: 'tests/calc-sqrt.spec.js',
    find: '        <button type="button" data-calc-key="&#x221A;(" class="op" title="Square root: &#x221A;(3\'&#xB2; + 4\'&#xB2;)">&#x221A;</button>\n',
    with: '',
    test: 'Pythagoras on the keys' },
  { file: 'MODEL.html', name: "the tab still reads NOTES", spec: 'tests/calc-sqrt.spec.js',
    find: '  data-pane-tab="notes" hidden><span class="rail-tab-text">NOTES / CALC</span></button>',
    with: '  data-pane-tab="notes" hidden><span class="rail-tab-text">NOTES</span></button>',
    test: 'the tab reads NOTES / CALC' },
  { file: 'model/04-levels-notes-bars.js', name: "CALC leaves the NOTES page showing", spec: 'tests/model-html-calc.spec.js',
    find: "    notesText.hidden = which !== 'notes';\n",
    with: "",
    test: "CALC is a tab beside NOTES on the pad; it swaps the page for the calculator and back" },
  { file: 'model/04-levels-notes-bars.js', name: "ENTER puts nothing on the tape", spec: 'tests/model-html-calc.spec.js',
    find: "    if (e.key === 'Enter') { e.preventDefault(); calcEquals(); }",
    with: "",
    test: "his sum typed the way he writes it" },
  { file: 'model/04-levels-notes-bars.js', name: "the tape is not kept", spec: 'tests/model-html-calc.spec.js',
    find: "    calcState.tape = calcState.tape.slice(-60);\n    keepCalc();",
    with: "    calcState.tape = calcState.tape.slice(-60);",
    test: "his sum typed the way he writes it" },
  { file: 'model/04-levels-notes-bars.js', name: "METRIC does not reach the arithmetic", spec: 'tests/model-html-calc.spec.js',
    find: "window.DraftCalc.work(calcLine.value, { metric: calcState.metric })",
    with: "window.DraftCalc.work(calcLine.value, { metric: false })",
    test: "on the keys: 12 FT x 10 FT = is an area" },
  { file: 'model/04-levels-notes-bars.js', name: "a key types over the line", spec: 'tests/model-html-calc.spec.js',
    find: "    calcLine.value = calcLine.value.slice(0, at) + b.dataset.calcKey + calcLine.value.slice(to);",
    with: "    calcLine.value = b.dataset.calcKey;",
    test: "on the keys: 12 FT x 10 FT = is an area" },
  { file: 'model/04-levels-notes-bars.js', name: "a refused line does not say why", spec: 'tests/model-html-calc.spec.js',
    find: "    if (!r.ok) { calcAnswer.textContent = r.why;",
    with: "    if (!r.ok) { calcAnswer.textContent = '';",
    test: "a volume is refused and says why" },
  { file: 'model/04-levels-notes-bars.js', name: "a tape row clicked does nothing", spec: 'tests/model-html-calc.spec.js',
    find: "      div.addEventListener('click', () => { calcLine.value = row.reuse || row.main; showAnswer(); calcLine.focus(); });\n",
    with: "",
    test: "a volume is refused and says why" },
  { file: 'model/04-levels-notes-bars.js', name: "-> NOTES is not saved with the drawing", spec: 'tests/model-html-calc.spec.js',
    find: "      if (drawing) { notesOntoDrawing(notesText.value); markDirty(); }\n",
    with: "",
    test: "NOTES writes the line and its answer on the pad" },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4447' } });
    return 'passed';
  } catch { return 'failed'; }
};

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`, { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}
{
  const clean = run(null);
  if (clean !== 'passed') {
    console.log('REFUSING TO RUN: the spec is already failing before any mutant '
      + 'is applied.\nEvery mutant would read as KILLED and the sheet would be a '
      + 'lie. Fix the spec first.');
    process.exit(1);
  }
  console.log('baseline: the unmutated spec passes\n');
}
let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  if (!before.includes(m.find)) {
    console.log(`  SKIPPED   ${m.name}  (anchor not found — re-aim \`find\`)`);
    ambiguous += 1;
    continue;
  }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test, m.spec);
  let note = '';
  if (result === 'passed' && run(null, m.spec) === 'failed') {
    result = 'failed'; note = '  (caught by another check — re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  const caught = result === 'failed';
  if (caught) killed += 1;
  console.log(`  ${caught ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS (anchor missing)` : ''));
process.exit(killed === MUTANTS.length ? 0 : 1);
