#!/usr/bin/env node
// MUTATION GATE for the drafting brush picked by an opening's dot, its two
// cursors, and the TOO BIG popup and glow (tests/brush-dot.spec.js).
//
// Movie, 20 Oct: "if the user is within 1ft of the DOT for fenstration radius
// 2ft dia can they pickup the DOOR properties (not other items lit wall etc)"
// -- "2 different ICONS for cursor - one for when it empty and GRABBING a
// property - and a second one that looks like it DROPPING the properties" --
// "a popup warning good idea" -- "make it glow to be obvious".
//
// Run: node proto/brush-dot-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/brush-dot.spec.js';
const MUTANTS = [
  { file: 'model/13-suites-trim-follow.js', name: 'the dot is never asked: the press beside the door takes the wall',
    find: "      const opening = openingByDot(at);\n      if (opening) return { type: 'fenestration', item: opening };\n",
    with: '',
    test: 'lifts the door, not the wall' },
  { file: 'model/13-suites-trim-follow.js', name: 'the dot reaches two feet, not one',
    find: 'const BRUSH_DOT_FT = 1;',
    with: 'const BRUSH_DOT_FT = 2;',
    test: 'a bare wall too short' },
  { file: 'model/13-suites-trim-follow.js', name: 'a brush holding a wall asks the dot too',
    find: "    if (!brushLoad || brushLoad.kind === 'fenestration') {\n      const opening = openingByDot(at);",
    with: "    if (true) {\n      const opening = openingByDot(at);",
    test: 'beyond a foot' },
  { file: 'model/16-gestures-undo.js', name: 'FENESTRATION wearing the load does not ask the dot',
    find: "        const hit = brushHitAt(at);\n        if (hit?.type === 'fenestration') { brushDust(hit); return; }",
    with: "        const hit = hitAt(at);\n        if (hit?.type === 'fenestration') { brushDust(hit); return; }",
    test: 'lifts the door, not the wall' },
  { file: 'model/14-promotion-tools.js', name: 'one cursor for both',
    find: '    if (brushOn && !brushLoad) return brushCursorFor(false);',
    with: '    if (brushOn && !brushLoad) return brushCursorFor(true);',
    test: 'the cursor' },
  { file: 'model/14-promotion-tools.js', name: 'no picture cursor at all',
    find: '    if (c) canvas.style.cursor = c;\n',
    with: '',
    test: 'the cursor' },
  { file: 'model/14-promotion-tools.js', name: 'the picture outlives the load',
    find: "    else if (canvas.style.cursor.startsWith('url(')) canvas.style.cursor",
    with: "    else if (false) canvas.style.cursor",
    test: 'the cursor' },
  { file: 'model/14-promotion-tools.js', name: 'TOO BIG on the strip only, no popup',
    find: "      brushWarnBox.hidden = false;\n",
    with: '',
    test: 'too wide' },
  { file: 'model/02-holograms-tags.js', name: 'no glow',
    find: '    paintTooBig(ctx, toS, shown);\n',
    with: '',
    test: 'too wide' },
  { file: 'model/11-floor-openings-fixtures.js', name: 'a wall too short says it on the strip only',
    find: "      brushWarn(`TOO BIG — that wall is too short",
    with: "      sayOnStrip(`TOO BIG — that wall is too short",
    test: 'a bare wall too short' },
  { file: 'model/16-gestures-undo.js', name: 'the next press leaves the popup up',
    find: "      brushWarnClear();\n      if (brushHas('fenestration')) {",
    with: "      if (brushHas('fenestration')) {",
    test: 'a bare wall too short' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4467' } });
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
