#!/usr/bin/env node
// MUTATION GATE for a beam row slid across itself catching a node
// (tests/beam-slide-node-snap.spec.js).
//
// jb, 25 Nov 2026: "i'd like to position it using the corner of the int
// staircase opening and then add 2 inches push it over so it will have 4"
// floor bearing ... just need the node snap".
//
// Run: node proto/beam-slide-node-snap-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/beam-slide-node-snap.spec.js';
// -g takes a regex: plain words (written into each row, which
// mutant-anchors-harness reads on its own), so the shell quoting stays simple.
const MUTANTS = [
  { file: 'model/09-draw-move-stretch.js', name: 'the sliding row seeks nothing',
    find: "          if (hit) { dx = n.x * hit.k; dz = n.z * hit.k; d.lit = hit.lit; }\n",
    with: "",
    test: 'FLOOR LAYOUT: a sliding beam lines up' },
  { file: 'model/07-walls-magnet.js', name: 'the stair drawn here gives the slide no corners',
    find: "        corners.forEach(add);\n",
    with: "",
    test: 'FLOOR LAYOUT: a sliding beam lines up' },
  { file: 'model/07-walls-magnet.js', name: 'a stair hole gives the slide no corners',
    find: "      .forEach(o => o.points.forEach(add));\n",
    with: "",
    test: 'a stair HOLE.s corner catches the sliding beam' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4453' } });
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
