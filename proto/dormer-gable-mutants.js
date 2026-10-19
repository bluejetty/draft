#!/usr/bin/env node
// MUTATION GATE for a dormer's gable wall on the elevations and on EXT.
// FINISH (Movie, 18 Oct: "i noticed the RAKE needs to show a line and 'gable
// wall in the triangle' where the user can change the materials in the EXT
// FINISH area").
//
// Run: node proto/dormer-gable-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/ext-finish-dormer.spec.js'];
const MUTANTS = [
  { file: "cut-view.js", name: "the gable is drawn on the elevation behind it", spec: 'tests/ext-finish-dormer.spec.js',
    find: "        if (-(g.ridgeDir.x * dir.x + g.ridgeDir.z * dir.z) < 0.5) return;",
    with: "        if ((g.ridgeDir.x * dir.x + g.ridgeDir.z * dir.z) < 0.5) return;",
    test: "the dormer's gable stands on the elevation that looks at it" },
  { file: "cut-view.js", name: "the gable does not wear the wall under it", spec: 'tests/ext-finish-dormer.spec.js',
    find: "          finish: gable.finish || below?.finish || DEFAULT_FINISH_ID });",
    with: "          finish: gable.finish || DEFAULT_FINISH_ID });",
    test: "the dormer's gable stands on the elevation that looks at it" },
  { file: "cut-view.js", name: "no rake board under the rakes", spec: 'tests/ext-finish-dormer.spec.js',
    find: "        ctx.lineWidth = 1;\n        ctx.stroke();\n        ctx.restore();\n      });\n",
    with: "        ctx.restore();\n      });\n",
    test: "the gable wall is clad, and a line runs along its foot" },
  { file: "cut-view.js", name: "the gable wall is not clad", spec: 'tests/ext-finish-dormer.spec.js',
    find: "          }, finishById(dg.finish), C);",
    with: "          }, finishById(DEFAULT_FINISH_ID), C);",
    test: "the gable wall is clad, and a line runs along its foot" },
  { file: "EXTFINISH.html", name: "a click on the gable picks the wall behind", spec: 'tests/ext-finish-dormer.spec.js',
    find: "        if (dormer) return { dormer };\n",
    with: "",
    test: "a click on the dormer's triangle picks its gable wall" },
  { file: "drawing-format.js", name: "the gable's finish is dropped on the way past", spec: 'tests/ext-finish-dormer.spec.js',
    find: "              ? { at: { x: at.x, z: at.z }, widthFt, pitch, ...finish } : null;",
    with: "              ? { at: { x: at.x, z: at.z }, widthFt, pitch } : null;",
    test: "a click on the dormer's triangle picks its gable wall" },
  { file: "EXTFINISH.html", name: "the wall's own finish chosen is stored as a key", spec: 'tests/ext-finish-dormer.spec.js',
    find: "        if (value === (dormerUnder() || WT.DEFAULT_FINISH_ID)) delete dormer.gable.finish;",
    with: "        if (false) delete dormer.gable.finish;",
    test: "a click on the dormer's triangle picks its gable wall" },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4449' } });
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
