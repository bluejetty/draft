#!/usr/bin/env node
// MUTATION GATE for ON GRADE / 2 STOREY (Movie, 18 Oct: "i need an additional
// house type: BUNGALOW / ON GRADE / 2 STOREY" -- "the othe ON / GRADE can be
// calle ON GRADE / ONE STOREY").
//
// Run: node proto/ongrade-two-storey-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/model-html-premade-bungalow.spec.js'];
const MUTANTS = [
  { file: "MODEL.html", name: "the card-less tiles sit side by side again", spec: 'tests/model-html-premade-bungalow.spec.js',
    find: "      if (last?.classList?.contains('dt-stack')) { last.append(button); return; }\n      const prev = last && !last.classList.contains('card') ? slots.pop() : null;",
    with: "      const prev = null;",
    test: "ON GRADE / 2 STOREY builds the two-storey house on a ledger floor" },
  { file: "premade-plans.js", name: "ON GRADE / 2 STOREY is an ordinary 2 STOREY", spec: 'tests/model-html-premade-bungalow.spec.js',
    find: "    'twoStorey-ongrade': () => twoStorey({ garage: false, framing: 'balloon' }),",
    with: "    'twoStorey-ongrade': () => twoStorey({ garage: false }),",
    test: "ON GRADE / 2 STOREY builds the two-storey house on a ledger floor" },
  { file: "premade-plans.js", name: "the 2 STOREY design drops its framing", spec: 'tests/model-html-premade-bungalow.spec.js',
    find: "    house: houseLoop(),\n    framing,\n    houseOpenings: houseOpenings(),\n    upperOpenings: upperOpenings(),",
    with: "    house: houseLoop(),\n    houseOpenings: houseOpenings(),\n    upperOpenings: upperOpenings(),",
    test: "ON GRADE / 2 STOREY builds the two-storey house on a ledger floor" },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4455' } });
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
