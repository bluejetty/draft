#!/usr/bin/env node
// MUTATION GATE for the ESTIMATES page (Movie, 23 Oct): what the page does
// with the quantities estimates.js hands it -- the prices and waste it keeps
// in the file, the totals it shows, the foot's way in. The module's own
// arithmetic is proto/estimates-harness.js's. Each row breaks one line, runs
// the one test that should notice, and restores the file from HEAD.
//
//   node proto/estimates-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/estimates.spec.js';

const MUTANTS = [
  { file: 'ESTIMATES.html',
    name: 'the sections come in the order they were counted, not the spec\'s',
    find: "        out.sections.forEach(section => {\n          if (!byDiv.has(section.div))",
    with: "        out.sections.slice().reverse().forEach(section => {\n          if (!byDiv.has(section.div))",
    test: 'the sections stand in the specification' },
  { file: 'ESTIMATES.html',
    name: 'a price typed is shown but never kept',
    find: "              if (input.value.trim() !== '' && Number.isFinite(v) && v >= 0) settings.prices[row.key] = Math.round(v * 100) / 100;\n",
    with: "              if (input.value.trim() !== '' && Number.isFinite(v) && v >= 0) settings.prices[row.key] = Math.round(v * 100) / 100;\n              settings = format.estimates({ ...settings, prices: {} });\n",
    test: 'a unit price typed against a line totals it' },
  { file: 'ESTIMATES.html',
    name: 'the page writes its settings over a fresh copy of the drawing',
    find: "        const merged = { ...base, estimates: settings };\n",
    with: "        const merged = { ...drawing, estimates: settings };\n",
    test: 'a unit price typed against a line totals it' },
  { file: 'ESTIMATES.html',
    name: 'the save is never made',
    find: "          .then(writeToStore)\n",
    with: "",
    test: 'a unit price typed against a line totals it' },
  { file: 'ESTIMATES.html',
    name: 'a blank waste is zero waste',
    find: "            if (input.value.trim() !== '' && Number.isFinite(v) && v >= 0 && v <= 100) settings.waste[section.category] = Math.round(v * 10) / 10;\n",
    with: "            if (Number.isFinite(v) && v >= 0 && v <= 100) settings.waste[section.category] = Math.round(v * 10) / 10;\n",
    test: 'the waste percent per category' },
  { file: 'ESTIMATES.html',
    name: 'a row with no finish set takes a price',
    find: "          if (!row.unassigned) {\n            const input = document.createElement('input');\n            input.className = 'price';",
    with: "          if (true) {\n            const input = document.createElement('input');\n            input.className = 'price';",
    test: 'the sections stand in the specification' },
  { file: 'shell-bars.js',
    name: 'the foot\'s ESTIMATES is still down',
    find: "      href: './ESTIMATES.html',\n",
    with: "      href: null,\n",
    test: 'the foot' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4555' } });
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
