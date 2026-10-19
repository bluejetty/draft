#!/usr/bin/env node
// MUTATION GATE for the WALL panel's type row (Movie, 18 Oct: "under the WALL
// title can we put the TYPE of WALL" -- "so i can select a wall type /
// thickness before drawing").
//
// Run: node proto/wall-panel-type-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/model-wall-justify.spec.js', 'tests/model-html-draw-delete.spec.js'];
const MUTANTS = [
  { file: "MODEL.html", name: "the WALL panel has no type row", spec: 'tests/model-wall-justify.spec.js',
    find: "    box.append(propRow('WALL TYPE', WALL_PANEL_TYPES, wallShape({}).wallType, id => {\n      drawing.activeWallType = id;",
    with: "    box.append(propRow('WALL TYPE', WALL_PANEL_TYPES, wallShape({}).wallType, id => {\n      void id;",
    test: "the WALL panel offers the six types" },
  { file: "MODEL.html", name: "ICF picked on a floor plan draws a stud wall", spec: 'tests/model-wall-justify.spec.js',
    find: "    if (viewId !== 'foundation' && WALL_PANEL_TYPES.some(([id]) => id === active)) return active;\n",
    with: "",
    test: "the WALL panel offers the six types" },
  { file: "wall-types.js", name: "there is no 2x8", spec: 'tests/model-wall-justify.spec.js',
    find: "    { id:'stud_2x8',    label:'2\u00d78 Stud  (7\u00bc\")',   totalIn:7.25,  layers:[{in:7.25,  fill:'stud'}] },\n",
    with: "",
    test: "the WALL panel offers the six types" },
  { file: 'MODEL.html', name: "a stud wall picked on the panel is drawn on the foundation", spec: 'tests/model-html-draw-delete.spec.js',
    find: "    if (viewId !== 'foundation' && WALL_PANEL_TYPES.some(([id]) => id === active)) return active;\n",
    with: "    if (WALL_PANEL_TYPES.some(([id]) => id === active)) return active;\n",
    test: "FOUNDATION draws a foundation-set wall, not a stud one" },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4459' } });
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
