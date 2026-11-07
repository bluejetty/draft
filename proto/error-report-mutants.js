#!/usr/bin/env node
// MUTATION GATE for SEND A REPORT WHEN THE APP HITS A PROBLEM (tests/error-report.spec.js).
//
// Movie, 6 Nov: "whenever it bugged out it would give me message about
// sending the report to archicad. could we do something like that" -- "they
// wouldn't go to the user they would come to me, maybe a copy could go to the
// user" -- "alot of them probably won't fill it out i bet". Eight seams: a
// fault that asks again and again, a rejection nobody hears, the button that
// says SEND with nowhere to send, the drawing that goes unasked, the hour's
// allowance forgotten, an empty REPORT A PROBLEM that mails anyway, a tool
// change missing from the trail, and a refused send that is tried again by
// the save.
//
// The test titles are written out in each row rather than named once above:
// proto/mutant-anchors-harness.js reads the MUTANTS table on its own, and
// a name defined outside the table is not defined there.
//
// Run: node proto/error-report-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/error-report.spec.js';
const MUTANTS = [
  { file: 'error-report.js', name: 'the same fault asks again and again',
    find: "    if (seen.has(key)) return;\n",
    with: "",
    test: 'an uncaught error opens ROUGH-DRAFTER HIT A PROBLEM once; with no desk address the report is saved on this computer' },
  { file: 'error-report.js', name: 'a rejection nobody caught is not heard',
    find: "  window.addEventListener('unhandledrejection', onFault);\n",
    with: "",
    test: 'an unhandled promise rejection opens the card; NOT NOW closes it; REPORT A PROBLEM in the foot lane opens it by hand' },
  { file: 'error-report.js', name: 'the button says SEND with nowhere to send',
    find: "    const relabel = () => { sendBtn.textContent = recipients().length ? 'SEND' : 'SAVE REPORT FILE'; };\n",
    with: "    const relabel = () => { sendBtn.textContent = 'SEND'; };\n",
    test: 'an uncaught error opens ROUGH-DRAFTER HIT A PROBLEM once; with no desk address the report is saved on this computer' },
  { file: 'error-report.js', name: 'the drawing goes without being asked for',
    find: "      if (tick && tick.checked) {\n",
    with: "      if (tick) {\n",
    test: 'a copy address mails the report through the backup worker; the drawing goes only when ticked' },
  { file: 'error-report.js', name: 'the hour\'s allowance is forgotten',
    find: "      if (allowance() < to.length) {\n",
    with: "      if (false) {\n",
    test: 'three reports an hour a browser, and a worker that says no leaves SAVE REPORT FILE' },
  { file: 'error-report.js', name: 'an empty REPORT A PROBLEM mails anyway',
    find: "      if (!fault && !pick && !said.value.trim()) { say('Tap what went wrong, or type a line.', 'error'); return; }\n",
    with: "",
    test: 'an unhandled promise rejection opens the card; NOT NOW closes it; REPORT A PROBLEM in the foot lane opens it by hand' },
  { file: 'model/09-draw-move-stretch.js', name: 'a tool change is missing from the trail',
    find: "    if (window.DraftErrorReport) window.DraftErrorReport.note(`tool ${next}`);\n",
    with: "",
    test: 'an uncaught error opens ROUGH-DRAFTER HIT A PROBLEM once; with no desk address the report is saved on this computer' },
  { file: 'error-report.js', name: 'a refused send is tried again by the save',
    find: "      if (keepHere) { keepHere(); return; }\n",
    with: "",
    test: 'three reports an hour a browser, and a worker that says no leaves SAVE REPORT FILE' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4498' } });
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
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
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
