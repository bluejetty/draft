#!/usr/bin/env node
// MUTATION GATE for the BONE's RELOAD (Movie, 20 Oct): "to reload press the
// bone in project area once you pick your numbers" ... "BUNGALOW / number of
// stories etc should be locked". Each row breaks one line of PROJECT.html or
// project-reload.js, runs the one test that should notice, and restores the
// file from HEAD. project-reload-harness.js --mutate covers the pass itself;
// this gate covers the page around it.
//
//   node proto/project-reload-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/project-reload.spec.js';

const MUTANTS = [
  { file: 'PROJECT.html',
    name: 'the BONE on a standing house still asks to build',
    find: "          if (!readOnly && reloadAsk && window.DraftProjectReload?.houseStands(drawing)) {\n",
    with: "          if (false) {\n",
    test: 'the BONE on a standing house reloads it to the PROJECT numbers' },
  { file: 'PROJECT.html',
    name: 'the reloaded walls are worked out and thrown away',
    find: "          if (out) { merged.walls = out.walls; merged.roofs = out.roofs; }\n",
    with: "          if (out) { merged.roofs = out.roofs; }\n",
    test: 'the BONE on a standing house reloads it to the PROJECT numbers' },
  { file: 'PROJECT.html',
    name: 'RELOAD saves and stays on PROJECT',
    find: "          if (lastReload) location.href = './MODEL.html';\n",
    with: "",
    test: 'the BONE on a standing house reloads it to the PROJECT numbers' },
  { file: 'project-reload.js',
    name: 'the roofs keep the pitch they were cut at',
    find: "        if (!row) return roof;\n",
    with: "        return roof;\n",
    test: 'the BONE on a standing house reloads it to the PROJECT numbers' },
  { file: 'PROJECT.html',
    name: 'the type stays open while the house stands',
    find: "          if (col) col.inert = home != null && (key !== home || standing);\n",
    with: "          if (col) col.inert = home != null && key !== home;\n",
    test: 'while the house stands its type is locked, and the BONE says it reloads' },
  { file: 'PROJECT.html',
    name: 'the lock is silent',
    find: "            : (key === home && standing\n",
    with: "            : (false\n",
    test: 'while the house stands its type is locked, and the BONE says it reloads' },
  { file: 'PROJECT.html',
    name: 'a house already at its numbers reports a reload',
    find: "        if (!out) return 'Nothing to reload — the house already stands at these numbers.';\n",
    with: "",
    test: 'CANCEL reloads nothing, and a house already at its numbers says so and stays' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4504' } });
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
