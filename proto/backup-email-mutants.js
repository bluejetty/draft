// DOES tests/backup-email.spec.js CATCH A BACKUP FILE EMAIL THAT DOES NOTHING?
//
// Movie, 30 Oct: SAVE BACKUP FILE TO EMAIL after a local save only, 3 bones a
// backup, big files zipped into parts, at most a few an hour.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SPEC = 'tests/backup-email.spec.js';

const MUTANTS = [
  { file: 'model/17-boot-save.js',
    name: 'SAVE AS no longer offers the BACKUP FILE',
    find: '      if ((await save({ download: typed, handle })) && lastLocalSave && window.DraftBackupEmail) {',
    with: '      if ((await save({ download: typed, handle })) && false) {',
    test: 'SAVE AS offers' },
  { file: 'LAYOUT.html',
    name: 'LAYOUT\'s SAVE AS no longer offers it',
    find: "        window.DraftBackupEmail?.offer({ name, blob: new Blob([text], { type: 'application/json' }) });",
    with: '',
    test: 'LAYOUT' },
  { file: 'backup-email.js',
    name: 'the backup costs nothing',
    find: '        wallet().spend(cost());',
    with: '',
    test: 'SAVE AS offers' },
  { file: 'backup-email.js',
    name: 'an empty wallet still sends',
    find: '      if (!wallet() || bonesHeld() < cost()) {',
    with: '      if (false) {',
    test: 'without 3 bones' },
  { file: 'backup-email.js',
    name: 'a big file goes whole',
    find: '    if (blob.size <= PART_BYTES) return [{ filename: name, blob }];',
    with: '    return [{ filename: name, blob }];',
    test: 'numbered parts' },
  { file: 'backup-email.js',
    name: 'no hourly limit',
    find: '        if (pieces.length > allowance()) {',
    with: '        if (false) {',
    test: 'at most 5' },
];

const run = (spec, grep) => {
  try {
    execSync(`npx playwright test ${spec} --workers=1`
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// The restore is `git checkout -- <file>`: refuse to run over uncommitted
// work in any file a mutant touches.
const files = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${files.join(' ')}`, { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  const spec = m.spec || SPEC;
  let result = run(spec, m.test);
  let note = '';
  if (result === 'passed' && run(spec, null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
