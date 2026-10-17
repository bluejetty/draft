#!/usr/bin/env node
// MUTATION GATE for the entry page's titled side columns
// (tests/entry-columns.spec.js).
//
// Movie, 17 Oct, drawn in GIMP over the page: "move the side columns down and
// switch the sides (put the books on the right and reference (span tables,
// codes etc) on the left" ... "add the titles (keep the titles aligned with
// approx the top of the logo in the middle like in the image upload". Each
// row below undoes one thing his picture asked for, and the spec must notice.
//
// Run: node proto/entry-columns-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/entry-columns.spec.js';

const MUTANTS = [
  { file: 'index.html',
    name: 'the sides are switched back: books left, references right',
    find: '      .ring-column-left { grid-column: 1; }\n      .ring-column-right { grid-column: 4; }\n',
    with: '      .ring-column-left { grid-column: 4; }\n      .ring-column-right { grid-column: 1; }\n',
    test: 'REFERENCES stands left of the logo and BOOKS right of it, both level with its top' },
  { file: 'index.html',
    name: 'the REFERENCES title is never written',
    find: '            <span class="ring-title">References</span>\n',
    with: '',
    test: 'REFERENCES stands left of the logo and BOOKS right of it, both level with its top' },
  { file: 'index.html',
    name: 'the columns centre themselves beside the logo instead of hanging from its top',
    find: '        grid-row: 2 / 4;\n        align-self: start;\n',
    with: '        grid-row: 2 / 4;\n        align-self: center;\n',
    test: 'REFERENCES stands left of the logo and BOOKS right of it, both level with its top' },
  { file: 'index.html',
    name: 'the columns start a row higher, so the titles stand above the logo',
    find: '        grid-row: 2 / 4;\n        align-self: start;\n',
    with: '        grid-row: 1 / 4;\n        align-self: start;\n',
    test: 'REFERENCES stands left of the logo and BOOKS right of it, both level with its top' },
  { file: 'index.html',
    name: 'the titles drop to the middle of the logo',
    find: '        padding-top: calc(var(--logo-w) * 0.13);\n',
    with: '        padding-top: calc(var(--logo-w) * 0.45);\n',
    test: 'REFERENCES stands left of the logo and BOOKS right of it, both level with its top' },
  { file: 'index.html',
    name: 'the partner note goes back to the bottom-left corner',
    find: '<span class="ring-note" data-box="7" data-book-note hidden>',
    with: '<span class="ring-note" data-box="10" data-book-note hidden>',
    test: 'REFERENCES stands left of the logo and BOOKS right of it, both level with its top' },
  { file: 'index.html',
    name: 'the phone keeps the square\'s cell numbers and opens a fourth column',
    find: '        .ring [data-box] { grid-column: auto; grid-row: auto; }\n',
    with: '',
    test: 'a phone lists both columns under the logo, titled, with the logo on the screen' },
  { file: 'index.html',
    name: 'the phone keeps the columns as columns, so the titles never head the list',
    find: '        .ring-column { display: contents; }\n',
    with: '',
    test: 'a phone lists both columns under the logo, titled, with the logo on the screen' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4403' } });
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
