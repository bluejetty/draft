#!/usr/bin/env node
// MUTATION GATE for slivers trimmed off the drawing (Movie, 18 Oct: "if there
// is a peice of roof or wall or floor with less that 1/64" thickness can you
// autoamatically TRIM it off" -- "ok lets go 1/16" on your advice").
//
// Run: node proto/sliver-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/model-html-slivers.spec.js'];
const MUTANTS = [
  { file: 'MODEL.html', name: "a wall under 1/16\" stays", spec: 'tests/model-html-slivers.spec.js',
    find: "    trimSlivers({ walls: true });\n",
    with: "",
    test: "on open and save" },
  { file: 'MODEL.html', name: "the roof keeps its strip", spec: 'tests/model-html-slivers.spec.js',
    find: "      const clean = G.cleanRoofRing(roof);\n",
    with: "      const clean = null;\n",
    test: "on open and save" },
  { file: 'MODEL.html', name: "the floor keeps its doubled corner", spec: 'tests/model-html-slivers.spec.js',
    find: "      const clean = G.cleanRoofRing({ points: item.points });\n",
    with: "      const clean = null;\n",
    test: "on open and save" },
  { file: 'MODEL.html', name: "the window stays on a wall that is gone", spec: 'tests/model-html-slivers.spec.js',
    find: "          drawing.fenestrations = drawing.fenestrations.filter(o => !ids.has(String(o.wallId)));\n",
    with: "",
    test: "on open and save" },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line`
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
