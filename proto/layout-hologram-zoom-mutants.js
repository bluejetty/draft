#!/usr/bin/env node
// MUTATION GATE for a hologram on a LAYOUT elevation zoomed out (Movie, 29
// Oct, PHASE 1 beside PHASE 2: "zoomed it you can see it , zoomed out you
// cant"): a pass pinned to the sheet's own fit keeps no MODEL gutters, so its
// clip never shrinks to nothing on a short viewport.
//
//   node proto/layout-hologram-zoom-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-hologram.spec.js';

const MUTANTS = [
  { file: 'cut-view.js',
    name: 'a pass pinned to the sheet keeps MODEL\'s gutters again',
    find: '    const ext = Boolean(pin && pin.external);\n',
    with: '    const ext = false;\n',
    test: 'zoomed out small' },
  { file: 'cut-view.js',
    name: 'the elevation does not tell the hologram it is on a sheet',
    find: '    if (runUnderlay(opts, { x0, y0, pxPerFt, uMin, yTop, external: Boolean(fit) })) return true;',
    with: '    if (runUnderlay(opts, { x0, y0, pxPerFt, uMin, yTop })) return true;',
    test: 'zoomed out small' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4597' } });
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
