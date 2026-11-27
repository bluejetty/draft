// DOES THE SPEC CATCH A PASTED BEAM OR POST THAT IS GONE ON THE NEXT LOAD?
//
// The gate for tests/pasted-structure-ids.spec.js (jb, 27 Nov 2026: the main
// floor's beam and posts showed on the WIREFRAME and on neither the MAIN FL
// plan nor the 2ND FL LAYOUT). Every mutant is a way back to that file: a
// paste the reader drops, a twin pasted on top, or a reader that loses, mis-
// files or doubles what was pasted before the fix. Same hardenings as the
// gates before it: an ambiguous anchor is refused, a survivor is re-run
// against the whole spec before it is called one, the baseline runs first.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SPEC = 'tests/pasted-structure-ids.spec.js';

const MUTANTS = [
  { file: 'model/08-structure-roof.js',
    name: 'PASTE gives a beam or post the page\'s string id again',
    find: '        copy.id = newStructureId(drawing[key] || []);',
    with: '        copy.id = \'x\' + newStructureId(drawing[key] || []);',
    test: 'still there after a reload' },
  { file: 'model/08-structure-roof.js',
    name: 'PASTE lands a twin on top of the beam already there',
    find: '        if (twin) { stackedStructure += 1; return; }',
    with: '',
    test: 'still there after a reload' },
  { file: 'drawing-format.js',
    name: 'the reader refuses a `kind-N` id, as it did',
    find: "    const mapped = raw.map(item => (PASTED_ID.test(String(item?.id ?? '')) ? undefined : readOne(item, null)));",
    with: '    const mapped = raw.map(item => readOne(item, null));',
    test: 'once each' },
  { file: 'drawing-format.js',
    name: 'a storey\'s pasted record stays on \'foundation\', a sheet nothing draws',
    find: "      const view = item?.view === 'foundation' && Number(item?.levelId) !== 1 ? 'plan' : item?.view;",
    with: '      const view = item?.view;',
    test: 'once each' },
  { file: 'drawing-format.js',
    name: 'a rescued twin is kept, so every post stands twice',
    find: '      if (!read || kept.some(other => sameSpot(other, read))) return null;',
    with: '      if (!read) return null;',
    test: 'once each' },
  { file: 'drawing-format.js',
    name: 'any string id is read, not just `kind-N`',
    find: '  const PASTED_ID = /^[a-z]+-\\d+$/i;',
    with: '  const PASTED_ID = /./;',
    test: 'neither' },
];

const run = grep => {
  try {
    execSync(`npx playwright test ${SPEC}` + (grep ? ` -g ${JSON.stringify(grep)}` : '')
      + ' --trace off --reporter=line', { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync(`git status --porcelain ${[...new Set(MUTANTS.map(m => m.file))].join(' ')} ${SPEC}`,
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}
if (run(null) !== 'passed') {
  console.error('BASELINE IS RED: the spec fails on unmutated code, so every mutant would read as killed.');
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); ambiguous += 1; continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed` + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
