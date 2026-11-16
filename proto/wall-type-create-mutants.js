#!/usr/bin/env node
// MUTATION GATE for CREATE WALL TYPE (jb, 16 Nov 2026): a wall type made of
// slices, each with its thickness and hatch, saved in the drawing; a
// foundation type's slices shown per plan (FDN / BSMT).
//
// Run: node proto/wall-type-create-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/wall-type-create.spec.js'];
const MUTANTS = [
  { file: 'model/15-panels.js', name: 'no CREATE WALL TYPE chip beside CUSTOM WIDTH', spec: 'tests/wall-type-create.spec.js',
    find: "  const wallTypeChips = types => [...types.map(type => [type.id, type.label]), CUSTOM_CHIP, CREATE_WALL_TYPE_CHIP];",
    with: "  const wallTypeChips = types => [...types.map(type => [type.id, type.label]), CUSTOM_CHIP];",
    test: 'CREATE WALL TYPE beside CUSTOM WIDTH' },
  { file: 'model/17-boot-save.js', name: 'the file forgets the types it made on the way in', spec: 'tests/wall-type-create.spec.js',
    find: "    WT.adoptDrawing(parsed);\n",
    with: "",
    test: 'EDIT TYPE changes every wall' },
  { file: 'drawing-format.js', name: 'a wall of a made type reads as the default type', spec: 'tests/wall-type-create.spec.js',
    find: "          : userWallTypeId(wall?.wallType)\n",
    with: "          : false\n",
    test: 'a wall whose type the file lost' },
  { file: 'render-2d.js', name: 'every slice shows on every plan (FDN / BSMT ignored)', spec: 'tests/wall-type-create.spec.js',
    find: "    const slicePlan = env.slicePlan || null;",
    with: "    const slicePlan = null;",
    test: 'a FOUNDATION type' },
  { file: 'model/02-holograms-tags.js', name: 'the BASEMENT plan does not draw the foundation type under it', spec: 'tests/wall-type-create.spec.js',
    find: "    const fdnUnder = basementFoundationWalls();",
    with: "    const fdnUnder = [];",
    test: 'a FOUNDATION type' },
  { file: 'plan-composition.js', name: 'the BASEMENT sheet does not print the foundation type', spec: 'tests/wall-type-create.spec.js',
    find: "    const fdnUnder = slicePlan === 'bsmt' && WTs?.isUserWallTypeId",
    with: "    const fdnUnder = false && WTs?.isUserWallTypeId",
    test: 'on the LAYOUT sheets too' },
  { file: 'plan-composition.js', name: 'the FOUNDATION sheet prints the lining too', spec: 'tests/wall-type-create.spec.js',
    find: "    if (env.wallEnv && slicePlan) env = { ...env, wallEnv: { ...env.wallEnv, slicePlan } };",
    with: "",
    test: 'on the LAYOUT sheets too' },
  { file: 'model/20-wall-type-card.js', name: 'DELETE TYPE goes on the first press', spec: 'tests/wall-type-create.spec.js',
    find: "        if (!armed) {",
    with: "        if (false) {",
    test: 'EDIT TYPE changes every wall' },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4812' } });
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
