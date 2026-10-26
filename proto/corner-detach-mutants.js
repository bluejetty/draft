#!/usr/bin/env node
// MUTATION GATE for ALT-drag letting a corner go (Movie, 22 Oct). Each row
// breaks one line, runs the one test that should notice, and restores the
// file from HEAD.
//
//   node proto/corner-detach-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/corner-detach.spec.js';

const MUTANTS = [
  { file: 'model/16-gestures-undo.js',
    name: 'ALT lets nothing go',
    find: "      if (corner && e.altKey && board !== 'toy') detachCorner(moveDrag, corner);\n",
    with: "",
    test: 'ALT held on the press' },
  { file: 'model/16-gestures-undo.js',
    name: 'every corner press lets go',
    find: "      if (corner && e.altKey && board !== 'toy') detachCorner(moveDrag, corner);\n",
    with: "      if (corner && board !== 'toy') detachCorner(moveDrag, corner);\n",
    test: 'without ALT the corner moves whole' },
  { file: 'model/10-tracking-garage.js',
    name: 'a free end is let go of nothing, and says so',
    find: "    if (!others.length) return;\n",
    with: "    if (!others.length) { sayOnStrip('Corner let go.'); return; }\n",
    test: 'ALT on a free end' },
  { file: 'model/10-tracking-garage.js',
    name: 'UNDO leaves the corner split',
    find: "    md.loose = { shared: [{ vtx: v, x: v.x, z: v.z }], fresh: [{ vtx: fresh, x: v.x, z: v.z }] };\n",
    with: "    md.loose = null;\n",
    test: 'ALT held on the press' },
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
