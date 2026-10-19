#!/usr/bin/env node
// MUTATION GATE for a line's weight, colour and style reaching the sheet and
// the DXF (tests/layout-lines.spec.js).
//
// Movie, 19 Oct: "do your line stuff" -- the sheets strokes every line the
// way the Model Space draws it. Three seams: LAYOUT loading the table, the
// sheet's colour, the sheet's dash (which is what names the DXF linetype).
//
// Run: node proto/layout-lines-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-lines.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'LAYOUT does not load the line table',
    find: '<script src="./line-styles.js"></script>\n',
    with: '',
    test: 'a red XTRA-BOLD dot-dash line prints red on the sheet, and a plain line prints as it always did' },
  { file: 'plan-composition.js',
    name: 'the sheet ignores a line\'s colour',
    find: "      ctx.strokeStyle = ink.color || env.lineColor || '#1d1f20';\n",
    with: "      ctx.strokeStyle = env.lineColor || '#1d1f20';\n",
    test: 'a red XTRA-BOLD dot-dash line prints red on the sheet, and a plain line prints as it always did' },
  { file: 'plan-composition.js',
    name: 'the sheet ignores a line\'s dash, so the DXF has no linetype to name',
    find: '      if (ctx.setLineDash) ctx.setLineDash(ink.dash);\n',
    with: '',
    test: 'SAVE DXF names the dot dash CENTER and carries the red on the line; the plain line stays CONTINUOUS on its layer\'s colour' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4482' } });
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
