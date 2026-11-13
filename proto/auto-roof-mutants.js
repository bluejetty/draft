#!/usr/bin/env node
// MUTATION GATE for AUTO ROOF / HAND ROOF (jb, 13 Nov 2026: "TURN OFF THE
// AUTOROOF and do a HANDROOF"): the ROOF level's chips write the file's
// switch, the bone raises no roof with it off, the PROJECT page reshapes
// none, and the ROOF plan still shows the top floor's wall tops to draw to.
//
// Run: node proto/auto-roof-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/auto-roof-chips.spec.js'];
const MUTANTS = [
  { file: 'model/12-garage-storeys-stairs.js', name: 'the bone raises the roof with HAND ROOF on', spec: 'tests/auto-roof-chips.spec.js',
    find: "    if (levelPresent(ROOF_LEVEL_ID) && !autoRoofOn()) {",
    with: "    if (false) {",
    test: 'with HAND ROOF on, the bone raises walls and floors but no roof' },
  { file: 'level-assembly.js', name: 'PROJECT reshapes roofs with HAND ROOF on', spec: 'tests/auto-roof-chips.spec.js',
    find: "    if (before?.autoRoof === false || after?.autoRoof === false) return null;\n",
    with: "",
    test: 'PROJECT leaves every roof alone while HAND ROOF is on' },
  { file: 'model/01-skin-view.js', name: 'the ROOF plan draws wall tops only under a roof', spec: 'tests/auto-roof-chips.spec.js',
    find: "    const tops = G.roofPlanWalls && drawing && (roofs().length || activeLevelId() === ROOF_LEVEL_ID)",
    with: "    const tops = G.roofPlanWalls && drawing && roofs().length",
    test: "the ROOF plan shows the top floor's wall tops with no roof on them" },
  { file: 'model/03-plan-paint.js', name: 'the chip lights but writes nothing to the file', spec: 'tests/auto-roof-chips.spec.js',
    find: "            if (wantHand) drawing.autoRoof = false; else delete drawing.autoRoof;\n            undoStack.push",
    with: "            undoStack.push",
    test: 'AUTO ROOF / HAND ROOF chips stand on the ROOF level, and the file keeps the switch' },
  { file: 'model/03-plan-paint.js', name: 'the chips stand on every level', spec: 'tests/auto-roof-chips.spec.js',
    find: "    const show = !!drawing && !boneyardActive && activeLevelId() === ROOF_LEVEL_ID;",
    with: "    const show = !!drawing && !boneyardActive;",
    test: 'AUTO ROOF / HAND ROOF chips stand on the ROOF level, and the file keeps the switch' },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: process.env.DRAFT_TEST_PORT || '4462' } });
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
