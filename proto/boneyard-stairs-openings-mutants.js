#!/usr/bin/env node
// MUTATION GATE for the stairs on the wireframe and the sliding openings
// (tests/boneyard-stairs-openings.spec.js).
//
// Movie, 16 Oct: "can you add the stairs to the wireframe so i can adjust
// the openings around the stairs" and "i'd like to be able to select the
// windows and doors and then move them along the wall surface". The
// engine's rows (the slide's sign, its ends, the crowding, the dot under
// the press) are proto/boneyard-edit-harness.js's; these are the page's.
//
// Run: node proto/boneyard-stairs-openings-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/boneyard-stairs-openings.spec.js';

const MUTANTS = [
  { file: 'BONEYARD.html',
    name: 'the stairs are counted but never drawn',
    find: '          window.DraftRender2D.drawStairs2D(ctx, p => toScreen(p), stairEnvFor(preview ? preview.drawing : raw, stairsHere, level));',
    with: '          void 0;',
    test: "the stairs stand on the wireframe's plan, on the level they are on" },
  { file: 'BONEYARD.html',
    name: "every level's stairs are drawn on every level",
    find: "        ? ((d && d.stairs) || []).filter(stair => Number(stair.levelId) === Number(level.levelId)",
    with: "        ? ((d && d.stairs) || []).filter(stair => true",
    test: "the stairs stand on the wireframe's plan, on the level they are on" },
  { file: 'BONEYARD.html',
    name: 'a press never finds a dot: the edge under it is picked instead',
    find: '        const dot = !breaking ? dotUnder(x, y) : null;',
    with: '        const dot = null;',
    test: 'a door dot slides along its wall by whole feet, and the house follows' },
  { file: 'BONEYARD.html',
    name: 'the drag is read across the wall, not along it',
    find: '          const feet = Math.round((dx * dotDrag.screen.x + dy * dotDrag.screen.y) / frame.s);',
    with: '          const feet = Math.round((dx * dotDrag.screen.y - dy * dotDrag.screen.x) / frame.s);',
    test: 'a door dot slides along its wall by whole feet, and the house follows' },
  { file: 'BONEYARD.html',
    name: 'the slide is shown and said but never kept',
    find: '        await commit(result);\n        paint2d();\n        say(slideWords(result.report));',
    with: '        paint2d();\n        say(slideWords(result.report));',
    test: 'a door dot slides along its wall by whole feet, and the house follows' },
  { file: 'BONEYARD.html',
    name: 'the lift of the finger forgets how far the dot was dragged',
    find: '          await slide(dot.id, dot.along, dot.feet);',
    with: '          await slide(dot.id, dot.along, 0);',
    test: 'a door dot slides along its wall by whole feet, and the house follows' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4362' } });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain BONEYARD.html', { cwd: ROOT }).toString().trim();
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
