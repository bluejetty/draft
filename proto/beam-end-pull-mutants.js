#!/usr/bin/env node
// MUTATION GATE for a picked beam row's end pulled in off the wall
// (tests/beam-end-pull.spec.js).
//
// jb, 25 Nov 2026: "i'm having a hard time disconnecting the beam from the
// foundation wall.. i'd like to bring it in about 3'6 for the stair".
//
// Run: node proto/beam-end-pull-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/beam-end-pull.spec.js';
const MUTANTS = [
  { file: 'model/16-gestures-undo.js', name: 'the end square takes no press',
    find: "      const end = beamEndAt(at);\n",
    with: "      const end = null;\n",
    test: 'the picked row.s end square drags that end in' },
  { file: 'model/09-draw-move-stretch.js', name: 'the end is not held to its limits',
    find: "    p = Math.max(md.min, Math.min(md.max, p));\n",
    with: "",
    test: 'the end stops short of the last post and at the wall' },
  { file: 'model/09-draw-move-stretch.js', name: 'the end catches no node',
    find: "        p += best.gap;\n",
    with: "",
    test: 'a pulled-in end catches the stair opening' },
  { file: 'model/09-draw-move-stretch.js', name: 'a slide runs a pulled-in end back to the wall',
    find: "      runFree: across ? runEndsFree(entries.map(e => e.item)) : null,\n",
    with: "",
    test: 'a row pulled in stays in when it is slid' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4453' } });
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
