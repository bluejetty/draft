#!/usr/bin/env node
// MUTATION GATE for shapes on the sheet, and DRAFT / NO DRAFT (jb, 6 Nov).
// Each row breaks one line, runs the one test that should notice, and
// restores the file from HEAD.
//
//   node proto/shape-on-sheet-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/shape-on-sheet.spec.js';
// The test names are spelled out on every row: the anchors harness reads
// this table on its own, with nothing declared above it.
const MUTANTS = [
  { file: 'layout-plan.js',
    name: 'the plan composes with no shape painter, as it did',
    find: "      shapeEnv: hologram ? null : unless(shapeEnv(saved)),\n",
    with: "      shapeEnv: null,\n",
    test: 'a tree on the SITE level' },
  { file: 'layout-plan.js',
    name: 'the level marks leave the shapes out',
    find: "      shapes,\n      shapeEnv: shapeEnv(saved),\n",
    with: "      shapes: [],\n      shapeEnv: shapeEnv(saved),\n",
    test: 'a tree on the SITE level' },
  { file: 'layout-plan.js',
    name: 'a level with nothing but a shape says it drew nothing',
    find: "    if (!lines.length && !notes.length && !dims.length && !shapes.length) return false;\n",
    with: "    if (!lines.length && !notes.length && !dims.length) return false;\n",
    test: 'a tree on the SITE level' },
  { file: 'layout-plan.js',
    name: 'the frame is not sized for the shapes',
    find: "    ['floors', 'roofs', 'outlines', 'shapes'].forEach(key => onLevel(key)\n",
    with: "    ['floors', 'roofs', 'outlines'].forEach(key => onLevel(key)\n",
    test: 'a tree on the SITE level' },
  { file: 'LAYOUT.html',
    name: 'a site with only a shape on it deals no SITE PLAN',
    find: "    const siteMarks = ['lines', 'notes', 'dimensions', 'shapes'].some(key =>\n",
    with: "    const siteMarks = ['lines', 'notes', 'dimensions'].some(key =>\n",
    test: 'a tree on the SITE level' },
  { file: 'layer-views.js',
    name: 'the walls plan does not carry SHAPE',
    find: "'A-FL-FLOORING', 'SHAPE', 'A-STR', 'A-FIXT',",
    with: "'A-FL-FLOORING', 'A-STR', 'A-FIXT',",
    test: 'a tree on the SITE level' },
  { file: 'plan-composition.js',
    name: 'a NO-DRAFT shape prints like any other',
    find: "    const shapes = pick(env.shapes).filter(shape => shape.layer !== 'no-draft'\n      && shows(shape.layer) && !off(shape.layer || 'SHAPE'));\n",
    with: "    const shapes = pick(env.shapes).filter(shape => shows(shape.layer) && !off(shape.layer || 'SHAPE'));\n",
    test: 'a tree on the SITE level' },
  { file: 'drawing-format.js',
    name: 'the file reader forgets NO DRAFT',
    find: "        layer: shape?.layer === 'no-draft' ? 'no-draft' : (shapeFlooring ? 'A-FL-FLOORING' : 'SHAPE'),\n",
    with: "        layer: shapeFlooring ? 'A-FL-FLOORING' : 'SHAPE',\n",
    test: 'the SHAPE panel offers DRAFT' },
  { file: 'model/15-panels.js',
    name: 'the flooring overrules NO DRAFT',
    find: "      shape.layer = shape.layer === 'no-draft' ? 'no-draft' : (shape.flooring ? 'A-FL-FLOORING' : 'SHAPE');\n",
    with: "      shape.layer = shape.flooring ? 'A-FL-FLOORING' : (shape.layer === 'no-draft' ? 'no-draft' : 'SHAPE');\n",
    test: 'the SHAPE panel offers DRAFT' },
  { file: 'model/15-panels.js',
    name: 'DRAFT leaves a NO DRAFT shape where it is',
    find: "      if (drafted !== true) writeShapeProps(shapes, { layer: null });\n",
    with: "      if (drafted !== true) writeShapeProps(shapes, {});\n",
    test: 'the SHAPE panel offers DRAFT' },
  { file: 'model/15-panels.js',
    name: 'the chips read every shape as DRAFT',
    find: "    const drafted = same(s => s.layer !== 'no-draft');\n",
    with: "    const drafted = true;\n",
    test: 'the SHAPE panel offers DRAFT' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4561' } });
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
