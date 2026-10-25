#!/usr/bin/env node
// MUTATION GATE for COPY, MIRROR and refresh-all on the hologram card
// (tests/model-html-hologram.spec.js, the two 17 Oct tests).
//
// Movie, 17 Oct, placing his suites: "position multiples all within the
// EXTERIOR of the building" and "change as a block". The placement
// arithmetic has its own engine (proto/layout-plan-harness.js --mutate);
// these rows bend the PAGE's seams -- the copy filed and put in hand, every
// copy of a file taking its REFRESH, MIRROR and F turning it over.
//
// Run: node proto/hologram-copies-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-hologram.spec.js';

const MUTANTS = [
  { file: 'model/13-suites-trim-follow.js',
    name: 'COPY files nothing',
    find: "          addItem(drawing.holograms, copy);\n",
    with: '',
    test: 'COPY puts another of the same file in hand, and REFRESH takes every copy to the newer file' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'COPY lands where it was, not in hand',
    find: "          traceMoving = { underlay: copy, from: null, before: null, hologram: true };\n",
    with: '',
    test: 'COPY puts another of the same file in hand, and REFRESH takes every copy to the newer file' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'REFRESH takes only the copy pressed',
    find: "      const copies = holograms().filter(h => h.name === refreshing.name);\n",
    with: "      const copies = [refreshing];\n",
    test: 'COPY puts another of the same file in hand, and REFRESH takes every copy to the newer file' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'MIRROR turns nothing over',
    find: "    const flip = holo.flip !== true;\n",
    with: "    const flip = holo.flip === true;\n",
    test: 'MIRROR turns it over across its own axis, F in hand does too, and the blue follows' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'F in hand mirrors nothing',
    find: "    if (mirror) { mirrorHologram(traceMoving.underlay); return; }\n",
    with: "    if (mirror) return;\n",
    test: 'MIRROR turns it over across its own axis, F in hand does too, and the blue follows' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4441' } });
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
