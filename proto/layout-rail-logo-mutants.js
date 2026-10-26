#!/usr/bin/env node
// MUTATION GATE for three LAYOUT asks of 26 Oct (tests/layout-sheet-edit.spec.js):
// "can we click on the 'Company 01' logo to change the name", "a 'ADD NEW
// PAGE' to the right side where the page views show", and a shelf's first
// scale ("1/4"=1' is better size").
//
// Run: node proto/layout-rail-logo-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-sheet-edit.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'a renamed logo is not written',
    find: "    if (!logos.some(logo => logo.id === id)) return;\n",
    with: "    return;\n",
    test: 'a double press on the titleblock\'s logo opens the picker: pick one, or add a picture of your own' },
  { file: 'LAYOUT.html',
    name: 'pressing the name picks the logo instead',
    find: "        name.addEventListener('click', e => {\n          e.stopPropagation();\n",
    with: "        name.addEventListener('click', e => {\n",
    test: 'a double press on the titleblock\'s logo opens the picker: pick one, or add a picture of your own' },
  { file: 'LAYOUT.html',
    name: 'no ADD PAGE in the rail',
    find: "      }), this._addPageTile());\n",
    with: "      }));\n",
    test: '+ ADD PAGE at the end of the rail adds a blank page and goes to it' },
  { file: 'LAYOUT.html',
    name: 'a shelf takes the working scale',
    find: "    const working = view?.kind === 'plan' && view.levelId < 0 ? SHELF_PIF : SCALES[this.state.activeScale].pif;\n",
    with: "    const working = SCALES[this.state.activeScale].pif;\n",
    test: '+ ADD VIEWPORT offers a SHELF with a drawing on it, and puts it on the sheet' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4709' } });
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
