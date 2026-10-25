#!/usr/bin/env node
// MUTATION GATE for the dimension that drives (tests/driving-dims.spec.js).
//
// Movie, 20 Oct: "if i click on that dimension and the type in 9-5 1/2" into
// the dimension instead, it would stetch the wall to that size ... i have the
// door and its 2 sidewalls as an ASSEMBLY so it shouldn't stretch but the
// other 'LONE" line at the north / top side should stretch" -- "i'd like to do
// this for the windows and door dimensions too" -- and a value that cannot be
// met changes nothing and says why on the strip.
//
// Run: node proto/driving-dims-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/driving-dims.spec.js';
const MUTANTS = [
  { file: 'model/13-suites-trim-follow.js', name: 'the box never opens for a dimension',
    find: "    const dimReady = !moveReady && !stretchReady && dimTypedReady();\n",
    with: "    const dimReady = false;\n",
    test: 'a lone wall moves to make the dimension so' },
  { file: 'model/14-promotion-tools.js', name: 'picking a dimension leaves the box as it was',
    find: "  selectionWatchers.push(() => stripRefresh());\n",
    with: "",
    test: 'a lone wall moves to make the dimension so' },
  { file: 'model/14-promotion-tools.js', name: 'ENTER on a dimension is read as something else',
    find: "    if (dimTypedReady()) {\n      const parsed = F.parseArchitecturalLength(lengthBox.value);\n",
    with: "    if (false) {\n      const parsed = F.parseArchitecturalLength(lengthBox.value);\n",
    test: 'a lone wall moves to make the dimension so' },
  { file: 'model/14-promotion-tools.js', name: 'the worst end moves, not the best',
    find: "    plans.sort((a, b) => b[1].score - a[1].score);\n",
    with: "    plans.sort((a, b) => a[1].score - b[1].score);\n",
    test: 'an ASSEMBLY moves whole' },
  { file: 'model/14-promotion-tools.js', name: 'an assembly is stretched like lone walls',
    find: "    if (grouped) return { kind: 'assembly', group: grouped, score: 2 };\n",
    with: "",
    test: 'an ASSEMBLY moves whole' },
  { file: 'model/14-promotion-tools.js', name: 'a door is pushed past what its wall allows',
    find: "      if (!clamped || Math.abs(clamped.offset - want) > 1e-4) {\n",
    with: "      if (!clamped) {\n",
    test: "a value that can't be met changes nothing" },
  { file: 'model/14-promotion-tools.js', name: 'a hand dimension keeps its old length',
    find: "      dim[which] = { ...dim[which], x: dim[which].x + shift.x, z: dim[which].z + shift.z };\n",
    with: "",
    test: 'a lone wall moves to make the dimension so' },
  { file: 'model/14-promotion-tools.js', name: 'the change has no UNDO',
    find: "    undoStack.push(steps.length > 1 ? { kind: 'batch', steps } : step);\n    setSelection(selection.filter(entry => (drawing.dimensions || []).includes(entry.item)));\n",
    with: "    setSelection(selection.filter(entry => (drawing.dimensions || []).includes(entry.item)));\n",
    test: 'a lone wall moves to make the dimension so' },
  { file: 'model/14-promotion-tools.js', name: 'a door never counts as what an end stands on',
    find: "        .some(p => near(along(p)))) found.openings.push({ opening, host, w });\n",
    with: "        .some(p => false)) found.openings.push({ opening, host, w });\n",
    test: 'a door slides along its wall' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4461' } });
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
