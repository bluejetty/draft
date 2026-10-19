#!/usr/bin/env node
// MUTATION GATE for INTERNET LINKS on the entry page and the links page
// (tests/entry-links.spec.js).
//
// Movie, 19 Oct: "put INTERNET LINKS -- as a link that will go into a new
// page with basically ROUGHDRAFTER Favorite links. put this link in there as
// the first one". Three seams: the entry page's link, the catalogue's first
// entry, and the page opening each link in a new tab.
//
// Run: node proto/entry-links-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/entry-links.spec.js';

const MUTANTS = [
  { file: 'index.html',
    name: 'the entry page loses INTERNET LINKS',
    find: '            <a class="ring-link" href="LINKS.html" data-box="11">INTERNET LINKS</a>\n',
    with: '',
    test: 'INTERNET LINKS stands under REFERENCES, below the codes link, and opens the links page' },
  { file: 'index.html',
    name: 'INTERNET LINKS lands in the BOOKS column',
    find: '            <a class="ring-link" href="LINKS.html" data-box="11">INTERNET LINKS</a>\n          </div>\n          <div class="ring-column ring-column-right">\n            <span class="ring-title">Books</span>\n',
    with: '          </div>\n          <div class="ring-column ring-column-right">\n            <span class="ring-title">Books</span>\n            <a class="ring-link" href="LINKS.html" data-box="11">INTERNET LINKS</a>\n',
    test: 'INTERNET LINKS stands under REFERENCES, below the codes link, and opens the links page' },
  { file: 'links-catalog.js',
    name: 'the converter is not the first link',
    find: "    url: 'https://pdfaid.com/dxf-to-dwg',\n",
    with: "    url: 'https://pdfaid.com/',\n",
    test: 'the links page lists the DXF to DWG converter first, in a new tab, and its header goes home' },
  { file: 'LINKS.html',
    name: 'a link opens in the same tab',
    find: ' target="_blank" rel="noopener"',
    with: '',
    test: 'the links page lists the DXF to DWG converter first, in a new tab, and its header goes home' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4471' } });
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
