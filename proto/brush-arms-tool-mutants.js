#!/usr/bin/env node
// MUTATION GATE for the brush arming its tool (tests/brush-arms-tool.spec.js).
//
// Movie, 20 Oct: "once the user uses the BRUSH to get PROPERTIES can you
// also change the user to the TOOL necessary to use the properties". Three
// seams: the tool not armed, its OPENING row not told, and an opening
// pressed under it placed beside instead of repainted.
//
// Run: node proto/brush-arms-tool-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/brush-arms-tool.spec.js';

const MUTANTS = [
  { file: 'MODEL.html', name: 'the tool is not armed',
    find: "        setTool('fenestration');\n",
    with: "",
    test: 'a door lifted arms FENESTRATION wearing it, and a press on bare wall puts one there' },
  { file: 'MODEL.html', name: 'the OPENING row is not told',
    find: "        fenestrationType = brushLoad.props.type === 'window' ? 'window' : 'door';\n",
    with: "        fenestrationType = 'window';\n",
    test: 'a door lifted arms FENESTRATION wearing it, and a press on bare wall puts one there' },
  { file: 'MODEL.html', name: 'an opening pressed under the tool is placed beside',
    find: "        if (hit?.type === 'fenestration') { brushDust(hit); return; }\n",
    with: "",
    test: 'and a press on an existing window gives it the door\'s properties instead of placing beside it' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4496' } });
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
