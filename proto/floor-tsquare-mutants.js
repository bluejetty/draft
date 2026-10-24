#!/usr/bin/env node
// MUTATION GATE for the T-square on a floor's corners and fixture corners as
// nodes (tests/floor-tsquare-fixture-nodes.spec.js).
//
// Movie, 23 Oct: "the FLOORING , the T and NODES don't seem to work can you
// fix that so the TSQuare will work and make the corners of tub and sink
// mini- snap nodes if possible for connecting the flooring".
//
// Run: node proto/floor-tsquare-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/floor-tsquare-fixture-nodes.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'a floor corner is not squared to the one before',
    find: "    if (last && !drawStart) {\n",
    with: "    if (false) {\n",
    test: 'T-square lit' },
  { file: 'MODEL.html', name: 'no fixture corner is a node',
    find: "    if (activeTool !== 'floor' && activeTool !== 'shape') return [];\n",
    with: "    return [];\n",
    test: 'vanity' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4534' } });
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
