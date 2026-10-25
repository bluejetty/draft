#!/usr/bin/env node
// MUTATION GATE for the brush setting the tools' defaults (Movie, 20 Oct):
// "change the PROPERTIES to match in the 'item' FENS / WALL / LINE area to
// match most recent BRUSH pickup". Each row breaks one line of MODEL.html,
// runs the one test that should notice, and restores the file from HEAD.
//
//   node proto/brush-sets-defaults-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/brush-sets-defaults.spec.js';

const MUTANTS = [
  { file: 'model/13-suites-trim-follow.js',
    name: 'a pickup sets nothing',
    find: "      brushSetsDefaults(kind, brushLoad.props);\n",
    with: "",
    test: 'a door lifted becomes the FENESTRATION panel and the next door drawn without the brush' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the door keeps the panel\'s old width',
    find: "      if (num(props.width) > 0) openingSizes[type] = num(props.width);\n",
    with: "",
    test: 'a door lifted becomes the FENESTRATION panel and the next door drawn without the brush' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the door keeps the panel\'s old swing',
    find: "        doorSwingFlip = props.swingFlip === true;\n",
    with: "",
    test: 'a door lifted becomes the FENESTRATION panel and the next door drawn without the brush' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the wall keeps the old type',
    find: "      if (WT?.WALL_TYPES.some(t => t.id === props.wallType)) drawing.activeWallType = props.wallType;\n",
    with: "",
    test: 'a wall lifted becomes the WALL panel and the next wall drawn' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the wall keeps the old height',
    find: "      if (num(props.topHeight) > 0) drawing.wallTopHeight = num(props.topHeight);\n",
    with: "",
    test: 'a wall lifted becomes the WALL panel and the next wall drawn' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the line keeps the old weight and style',
    find: "      if (Object.keys(patch).length) setLineDefaults(patch);\n",
    with: "",
    test: 'a line lifted becomes the LINE tool\'s weight and style' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4513' } });
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
