// DOES THE §2 SPEC CATCH A BONE THAT IS NOT THERE?
//
// The gate for the §2 half of tests/model-toy-draw.spec.js. Same two
// hardenings as the seven before it: an ambiguous anchor is refused rather
// than guessed at, and a survivor is re-run against the whole spec before it
// is called one.
//
// THE TWO FAILURES THIS IS ARRANGED AGAINST are the ones that look like
// success. A bone written with one or two points is accepted by the page and
// thrown away by the reader, so the drawing has a bone right up until it is
// reopened. And a bone that swallows every run on its level draws a polygon
// from the house across the yard to the garage -- more points, not fewer, so
// any check that counts them passes.
const { execSync } = require('child_process');
const fs = require('fs');

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the gesture stops writing a bone at all',
    find: '    extendToyBone(startPt, endPt, levelId);',
    with: '',
    test: 'acceptance 2b' },
  { file: 'MODEL.html',
    name: 'the bone is written on DRAFTING too, changing every drawing',
    find: "    if (board !== 'toy') return;\n    const same = sameSpot;",
    with: '    const same = sameSpot;',
    test: 'DRAFTING house is still walls alone' },
  { file: 'MODEL.html',
    name: 'a one- or two-point bone reaches the file and the reader drops it',
    find: '    if (bone === pendingBone && bone.points.length >= 3) {',
    with: '    if (bone === pendingBone) {',
    test: 'acceptance 2b' },
  { file: 'MODEL.html',
    name: 'THE POLYGON NOBODY DREW: any run joins any bone on the level',
    find: "    .find(o => Number(o.levelId) === Number(levelId) && !o.masterId\n      && endsAt(o, from)) || null;",
    with: "    .find(o => Number(o.levelId) === Number(levelId) && !o.masterId) || null;",
    test: 'a second bone, not one polygon' },
  { file: 'MODEL.html',
    name: 'the pending bone is joined regardless of where the run starts',
    find: '    if (!bone && pendingBone\n        && Number(pendingBone.levelId) === Number(levelId)\n        && endsAt(pendingBone, from)) {',
    with: '    if (!bone && pendingBone\n        && Number(pendingBone.levelId) === Number(levelId)) {',
    test: 'a second bone, not one polygon' },
  { file: 'MODEL.html',
    name: 'the shared corner is stored twice',
    find: '    if (!same(last, to)) bone.points.push(pt(to));',
    with: '    bone.points.push(pt(to));',
    test: 'acceptance 2b' },
  { file: 'MODEL.html',
    name: 'the bone claims a master it never came from',
    find: "      pendingBone = { id: newDrawingItemId('outline'), masterId: null,",
    with: "      pendingBone = { id: newDrawingItemId('outline'), masterId: 'made-up',",
    test: 'acceptance 2b' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-toy-draw.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: '/home/user/draft', stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: '/home/user/draft' }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `/home/user/draft/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: '/home/user/draft' });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
