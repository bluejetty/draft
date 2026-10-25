#!/usr/bin/env node
// MUTATION GATE for TRIM and EXTEND on the page (tests/model-html-trim.spec.js).
//
// Movie, 17 Oct: "select both items and them seltec the TRIM ... then select
// the part i want to cut ... the part i select gets the cut ... is gone" --
// "cuts on either side" -- EXTEND "to attach to the wall" -- Shift swaps the
// two -- "move the doors and windows in on the wall if they fit ... delete
// them". The geometry has its own engine (proto/trim-extend-harness.js
// --mutate); these rows aim at the page's wiring of it.
//
// Run: node proto/trim-extend-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-trim.spec.js';

const MUTANTS = [
  { file: 'model/13-suites-trim-follow.js',
    name: 'the selection is never the cutting edges',
    find: "    return [...selection.filter(e => (e.type === 'wall' || e.type === 'line') && here.has(e.item)).map(e => e.item),\n      ...trimHoloWalls(true)];\n",
    with: '    return [];\n',
    test: 'his case: select the exterior wall and the partition run through it, TRIM, press outside -- it stops at the inside face' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the middle is cut out but the far piece is never filed',
    find: '      list.push(tail);\n',
    with: '',
    test: 'a press between two crossings takes the middle out, leaving two walls, and one UNDO makes it one' },
  { file: 'model/16-gestures-undo.js',
    name: 'UNDO leaves the far piece behind',
    find: '        if (at >= 0) a.list.splice(at, 1);\n',
    with: '',
    test: 'a press between two crossings takes the middle out, leaving two walls, and one UNDO makes it one' },
  { file: 'model/16-gestures-undo.js',
    name: 'EXTEND has a key and still no gesture',
    find: "    if (activeTool === 'trim' || activeTool === 'extend') { trimPress(at, e, activeTool); return; }\n",
    with: "    if (activeTool === 'trim') { trimPress(at, e, activeTool); return; }\n",
    test: 'EXTEND: the partition two feet short of the wall runs on to it and stops at its inside face' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'Shift swaps nothing',
    find: "    const mode = (tool === 'extend') !== !!(e && e.shiftKey) ? 'extend' : 'trim';\n",
    with: "    const mode = tool === 'extend' ? 'extend' : 'trim';\n",
    test: 'Shift swaps them: Shift+press in TRIM extends' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'near the other wall\'s end it never makes a corner',
    find: '    if (!(u <= 0 || u >= 1 || toEnd <= TRIM_CORNER_FT)) return null;\n',
    with: '    return null;\n',
    test: 'near the other wall\'s end EXTEND makes a corner: both ends on one point' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'the openings are never put back on the wall that is left',
    find: '    const gone = isLine ? [] : [\n',
    with: '    const gone = true ? [] : [\n',
    test: 'a door on the piece taken away slides on if it fits, and goes if it does not' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4472' } });
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
