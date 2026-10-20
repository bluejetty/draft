#!/usr/bin/env node
// MUTATION GATE for RESIDENTIAL / COMMERCIAL SUITE (tests/suites.spec.js).
//
// Movie, 20 Oct: a SUITE card on PROJECT after BILEVEL with "RESIDENTIAL" &
// "COMMERCIAL", "a RESIDENTIAL SUITE card and a COMMERCIAL SUITE card (close
// together)" on the drive-thru, "both those 'SUITES will be built in the
// BONE'YARD and will be to place as HOLOGRAM in another DRAFT file".
//
// Run: node proto/suites-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/suites.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'the suite tiles are not in the drive-thru row',
    find: "      if (family.stack) {\n        const stack = document.createElement('span');\n",
    with: "      if (false) {\n        const stack = document.createElement('span');\n",
    test: 'the drive-thru' },
  { file: 'MODEL.html', name: 'the bone does not start a suite',
    find: "    if (order?.entry?.suite) startSuite(order.entry.suite);\n",
    with: "",
    test: 'the drive-thru' },
  { file: 'MODEL.html', name: 'the file does not remember it is a suite',
    find: "      drawing.suiteKind = window.DraftDrawingFormat.suiteKind(kind);\n",
    with: "",
    test: 'the drive-thru' },
  { file: 'MODEL.html', name: 'a suite is not started on the BONEYARD',
    find: "      drawing.suiteKind = window.DraftDrawingFormat.suiteKind(kind);\n      goToBoneyard();\n",
    with: "      drawing.suiteKind = window.DraftDrawingFormat.suiteKind(kind);\n",
    test: 'the drive-thru' },
  { file: 'MODEL.html', name: 'a drawn sheet is not asked about',
    find: "    if (!drawn) { begin(); return; }\n",
    with: "    begin(); return;\n",
    test: 'a sheet that already holds a drawing' },
  { file: 'MODEL.html', name: 'a suite file does not open on the BONEYARD',
    find: "    if (drawing.suiteKind) boneyardActive = true;\n",
    with: "",
    test: 'a suite file opens on the BONEYARD' },
  { file: 'MODEL.html', name: 'a suite\'s shelf walls are not stood on a floor',
    find: "    return suiteOnFloor(parsed);\n",
    with: "    return parsed;\n",
    test: 'INSERTED INTO A HOUSE' },
  { file: 'MODEL.html', name: 'a suite\'s card does not name its kind',
    find: "      name.textContent = kind ? `${suiteLabel(kind)} · ${first.name || first.id}` : (first.name || first.id);\n",
    with: "      name.textContent = first.name || first.id;\n",
    test: 'INSERTED INTO A HOUSE' },
  { file: 'PROJECT.html', name: 'PROJECT has no SUITE panel to show',
    find: "      const TYPE_STAGES = ['detached', 'bungalow', 'bilevel', 'suite'];\n",
    with: "      const TYPE_STAGES = ['detached', 'bungalow', 'bilevel'];\n",
    test: 'PROJECT: SUITE is the 4th card' },
  { file: 'PROJECT.html', name: 'a suite file is not the SUITE card\'s',
    find: "        if (suiteKind) return 'suite';\n",
    with: "",
    test: 'PROJECT: SUITE is the 4th card' },
  { file: 'PROJECT.html', name: 'PROJECT does not save which suite',
    find: "        ...(suitePressedHere ? { suiteKind } : {}),\n",
    with: "",
    test: 'PROJECT: SUITE is the 4th card' },
  { file: 'PROJECT.html', name: 'the PROJECT bone asks about an outline for a suite',
    find: "          if (entry.suite) { sendOrder('menu'); return; }\n",
    with: "",
    test: 'PROJECT: SUITE is the 4th card' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4464' } });
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
