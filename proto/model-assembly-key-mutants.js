#!/usr/bin/env node
// MUTATION GATE for the ASSEMBLY key (tests/model-html-assembly-key.spec.js).
//
// Movie, 18 Oct: "press Y first and THEN puts them into select mode the
// items and THEn press ENTER or DOUBLE CLICK or press Y again to close the
// assembly as one new unit".
//
// Run: node proto/model-assembly-key-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-assembly-key.spec.js';
const MUTANTS = [
  { file: 'tool-roster.js',
    name: 'no ASSEMBLY key in the column',
    find: "    { id: 'assembly',     name: 'ASSEMBLY',     group: 'draw',  kind: 'contextual', command: 'group' },\n",
    with: '',
    test: 'ASSEMBLY is a key among the DRAW / EDIT letters, Y on its face' },
  { file: 'MODEL.html',
    name: 'a click while assembling replaces instead of adding',
    find: "      } else if (e.shiftKey || activeTool === 'assembly') {\n",
    with: '      } else if (e.shiftKey) {\n',
    test: 'Y, click two walls -- no Shift -- and ENTER: one new assembly of both' },
  { file: 'MODEL.html',
    name: 'ENTER makes nothing',
    find: '      event.stopImmediatePropagation();\n      closeAssemblyKey();\n',
    with: '      event.stopImmediatePropagation();\n',
    test: 'Y, click two walls -- no Shift -- and ENTER: one new assembly of both' },
  { file: 'MODEL.html',
    name: 'Y again puts it down with nothing made',
    find: '      activeTool = \'assembly\';\n      closeAssemblyKey();\n      return;\n',
    with: '      return;\n',
    test: 'a second click takes one back out; Y again closes it' },
  { file: 'MODEL.html',
    name: 'the double-click does not put back what it landed on',
    find: "    if (hit && !selection.some(entry => entry.item === hit.item)) {\n      const owner = groupOf(hit);\n",
    with: "    if (false) {\n      const owner = groupOf(hit);\n",
    test: 'a double-click closes it, and what it lands on is in' },
  { file: 'MODEL.html',
    name: 'a WC picked by one wall gives up just that wall',
    find: "          const owner = activeTool === 'assembly' ? groupOf(hit) : null;\n",
    with: '          const owner = null;\n',
    test: 'a WC picked by one wall goes in whole: the new unit holds it and the free wall' },
  { file: 'MODEL.html',
    name: 'Escape leaves ASSEMBLY armed',
    find: "      assemblyEscaped = true;\n      setTool(RESTING_TOOL);\n",
    with: '      assemblyEscaped = true;\n',
    test: 'Escape puts it down with nothing made' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4433' } });
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
