#!/usr/bin/env node
// MUTATION GATE for SITS ON, a roof dropped onto the storey below
// (tests/roof-sits-on.spec.js).
//
// Movie, 27 Oct: "cut the roof how it is now and drop it down to match the
// one beside it" -- "allow the user to drop it somehow, in the properties
// menu maybe? ... the lower roofs ... on the ROOF PLAN but maybe shaded
// lighter?".
//
// Run: node proto/roof-sits-on-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/roof-sits-on.spec.js';

const MUTANTS = [
  { file: 'model/15-panels.js',
    name: 'a dropped roof is not drawn on the storey above',
    find: "    roof.drawnOn = above.id;\n",
    with: "",
    test: 'SITS ON drops a roof to the storey below' },
  { file: 'model/15-panels.js',
    name: 'a dropped roof still bears on the top storey',
    find: "    roof.sourceLevelId = id;\n    roof.drawnOn",
    with: "    roof.drawnOn",
    test: 'SITS ON drops a roof to the storey below' },
  { file: 'model/15-panels.js',
    name: 'TOP FLOOR leaves the roof bearing on the storey it was dropped to',
    find: "      roof.sourceLevelId = storeys[storeys.length - 1].id;\n",
    with: "",
    test: 'SITS ON drops a roof to the storey below' },
  { file: 'model/15-panels.js',
    name: 'a one-storey house is offered SITS ON',
    find: "    if (storeys.length > 1) {\n      const top",
    with: "    if (storeys.length > 0) {\n      const top",
    test: 'a one-storey house offers no SITS ON' },
  { file: 'model/01-skin-view.js',
    name: 'a lower roof is drawn in the main roof\'s brown on the ROOF plan',
    find: "      const lower = roof.drawnOn != null && activeLevelId() === ROOF_LEVEL_ID;\n",
    with: "      const lower = false;\n",
    test: 'a lower roof is RED on the ROOF plan' },
  { file: 'model/08-structure-roof.js',
    name: 'a roof is not copied',
    find: "  const NOT_COPIED = new Set(['roomtag', 'note']);\n",
    with: "  const NOT_COPIED = new Set(['roof', 'roomtag', 'note']);\n",
    test: 'CUT a roof on the ROOF plan and paste it on 2ND FL' },
  { file: 'model/08-structure-roof.js',
    name: 'a roof pasted on a storey lands on that storey, not on the ROOF level',
    find: "        copy.levelId = ROOF_LEVEL_ID;\n",
    with: "",
    test: 'CUT a roof on the ROOF plan and paste it on 2ND FL' },
  { file: 'model/08-structure-roof.js',
    name: 'a roof pasted on 2ND FL keeps the top storey',
    find: "        if (k > 0) setRoofSitsOn(copy, storeys[k - 1].id, storeys);\n",
    with: "",
    test: 'CUT a roof on the ROOF plan and paste it on 2ND FL' },
  { file: 'model/16-gestures-undo.js',
    name: 'CTRL+X copies and leaves it standing',
    find: "          deleteSelection();\n          sayOnStrip(`CUT",
    with: "          sayOnStrip(`CUT",
    test: 'CUT a roof on the ROOF plan and paste it on 2ND FL' },
  // "instead of making the lower roof dimmer, lets make it a redish color
  // instead ... make the printed construction layout a dimmer or greyer
  // line" (Movie, 28 Oct).
  { file: 'model/01-skin-view.js',
    name: 'the lower roof is dimmed in brown again, not red',
    find: "        lower ? { ...env, colors: { ...env.colors, roof: skin['draw-roof-lower'] } } : env);\n",
    with: "        env);\n",
    test: 'a lower roof is RED on the ROOF plan' },
  { file: 'layout-plan.js',
    name: 'the printed lower roof is brown like the main one',
    find: "        roof.drawnOn != null ? lowerEnv : roofEnv);\n",
    with: "        roofEnv);\n",
    test: 'a lower roof is RED on the ROOF plan' },
  { file: 'layout-plan.js',
    name: 'the printed lower roof keeps brown guides',
    find: "colors: { roof: LOWER_ROOF_PRINT, roofGuide: LOWER_ROOF_PRINT } };",
    with: "colors: { roof: LOWER_ROOF_PRINT } };",
    test: 'a lower roof is RED on the ROOF plan' },
  // "the ridge lines on the main roof disappeared on that roof plan view"
  // (Movie, 28 Oct).
  { file: 'geometry-2d.js',
    name: 'a dropped roof cuts the bone\'s main roof away inside MAIN FL',
    find: "roofs.filter(r => own(r) && r.drawnOn == null).map(",
    with: "roofs.filter(own).map(",
    test: 'a roof dropped onto MAIN FL leaves' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4803' } });
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
