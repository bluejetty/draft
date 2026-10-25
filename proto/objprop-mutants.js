#!/usr/bin/env node
// MUTATION GATE for OBJ / PROP (Movie, 24 Oct): the tab hung under the top
// bar, the window opened by a click on a fixture, its four views drawn (the
// faces tiled and mirrored as a section stands them) and the piece's
// PROPERTIES under them. Each row breaks one line, runs the test that should
// notice, and restores from HEAD.
//
//   node proto/objprop-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/objprop.spec.js tests/model-html-left-tabs.spec.js';

const MUTANTS = [
  { file: 'model/15-panels.js',
    name: 'the tab never shows',
    find: "    objTab.hidden = false;\n",
    with: "",
    test: 'the tab hangs' },
  { file: 'model/15-panels.js',
    name: 'a click on a fixture leaves the window shut',
    find: "    if ((objPieces().length || objStair()) && !objOpen) { setObjOpen(true); return; }\n",
    with: "",
    test: 'the tab hangs' },
  { file: 'model/15-panels.js',
    name: 'the window has no properties',
    find: "    props.replaceChildren(...(items.length ? [fixturePropsNode(items)] : []));\n",
    with: "    props.replaceChildren();\n",
    test: 'the tab hangs' },
  { file: 'model/15-panels.js',
    name: 'the TOP view draws nothing',
    find: "        const { toS } = V.topFrame(geo, box);\n",
    with: "        return;\n",
    test: 'the tab hangs' },
  { file: 'objprop-views.js',
    name: 'a cabinet run is one stretched door base',
    find: "      const n = tile ? Math.max(1, Math.round(widthIn / tile)) : 1;\n",
    with: "      const n = 1;\n",
    test: 'the faces' },
  { file: 'objprop-views.js',
    name: 'LEFT is RIGHT again, not mirrored',
    find: "      map.push(view === 'right' ? (a => a * k) : (a => depthIn - a * k));\n",
    with: "      map.push(a => a * k);\n",
    test: 'the faces' },
  // AND THE LEFT PROPERTIES TAB IS GONE, its box always on under BUILD and
  // DRAFTING (Movie, 25 Oct).
  { file: 'model/04-levels-notes-bars.js',
    name: 'an old lprops=0 link shuts PROPERTIES again',
    find: "  const propsShowing = () => true;\n",
    with: "  const propsShowing = () => params.get('lprops') !== '0';\n",
    test: 'stays on under either tab' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4560' } });
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
