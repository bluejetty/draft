#!/usr/bin/env node
// MUTATION GATE for a file dropped on the sheet (Movie, 23 Oct). Each row
// breaks one line, runs the one test that should notice, and restores the
// file from HEAD.
//
//   node proto/drop-underlay-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/drop-underlay.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the drop opens nothing',
    find: "    traceDropAt = tracePoint(event);\n    inspectTraceFile(file);\n",
    with: "    traceDropAt = tracePoint(event);\n",
    test: 'a photo dropped on the sheet' },
  { file: 'MODEL.html',
    name: 'the picture lands where the view looks, not where it was let go',
    find: "      x: traceDropAt ? traceDropAt.x : view.cx, z: traceDropAt ? traceDropAt.z : view.cz,\n",
    with: "      x: view.cx, z: view.cz,\n",
    test: 'a photo dropped on the sheet' },
  { file: 'MODEL.html',
    name: 'a drop on a panel opens the card too',
    find: "  const overSheet = event => event.target === canvas && !!drawing;\n",
    with: "  const overSheet = event => !!drawing;\n",
    test: 'a file let go on a panel' },
  { file: 'MODEL.html',
    name: 'the browser is left to open a file dropped off the sheet',
    find: "    if (!dropCarriesFiles(event)) return;\n    event.preventDefault();\n    canvas.classList.remove('drop-here');\n",
    with: "    if (!dropCarriesFiles(event)) return;\n    if (overSheet(event)) event.preventDefault();\n    canvas.classList.remove('drop-here');\n",
    test: 'a file let go on a panel' },
  { file: 'MODEL.html',
    name: 'any file at all goes to the card',
    find: "    const file = files.find(f => DROP_FILE_KINDS.test(f.name) || /^(image\\/|application\\/pdf$)/.test(f.type));\n",
    with: "    const file = files[0];\n",
    test: 'a file the sheet cannot trace over' },
  { file: 'MODEL.html',
    name: 'the sheet never says it will take the file',
    find: "    canvas.classList.toggle('drop-here', overSheet(event));\n",
    with: "",
    test: 'held over the sheet' },
  { file: 'MODEL.html',
    name: 'the picker keeps the last drop point',
    find: "    traceFile.value = '';\n    traceDropAt = null;\n",
    with: "    traceFile.value = '';\n",
    test: 'the picker after a drop' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4548' } });
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
