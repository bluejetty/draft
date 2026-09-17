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
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the gesture stops writing a bone at all',
    // RE-POINTED. The call grew an `if (bone)` guard -- commitWall takes
    // `bone: false` for a run that brings its own outline (the autobuilt
    // garage), so the bone is no longer grown unconditionally. Deleting the
    // whole guarded statement is still exactly this defect.
    find: "    if (bone) extendToyBone(startPt, endPt, levelId);",
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
    // RE-AIMED at the check written for it: a four-corner run passes three
    // points either way, so only a run that STOPS at one wall can see this.
    test: 'one wall in TOY is not yet a bone' },
  { file: 'MODEL.html',
    name: 'THE POLYGON NOBODY DREW: any run joins any bone on the level',
    find: "    .find(o => Number(o.levelId) === Number(levelId) && !o.masterId\n      && endsAt(o, from)) || null;",
    with: "    .find(o => Number(o.levelId) === Number(levelId) && !o.masterId) || null;",
    test: 'a second bone, not one polygon' },
  // REMOVED, WITH THE REASON RECORDED: 'the pending bone is joined regardless
  // of where the run starts'. It dropped `endsAt(pendingBone, from)` and
  // SURVIVED once its test grep was corrected. MODEL.html:6591 says why, and
  // a passing test backs it: drawPress REFUSES a disconnected run while one is
  // unfinished ('an unfinished run refuses a new one, and says so'), so
  // reaching that branch with a pending bone that does not end at `from` is
  // not a state the gesture can produce. The branch is defensive, and no
  // gesture-driven test can tell the mutant from the original.
  //
  // THE GUARD ITSELF IS LEFT ALONE, deliberately. Deleting an unreachable
  // guard is the repo's own precedent (see the dedupe note at MODEL.html:6608)
  // and may well be right here -- but it is a behaviour change, and this file
  // is a test-cleanup lane. It is boarded rather than smuggled in beside a
  // measurement fix.
  //
  // WHAT WOULD MAKE THIS LIVE AGAIN: a gesture that can start a run away from
  // an unfinished one. The day drawPress stops refusing that -- or the day the
  // refusal is relaxed for a second footprint -- the branch becomes reachable
  // and this mutation is worth restoring.
  { file: 'MODEL.html',
    name: 'the bone claims a master it never came from',
    // RE-POINTED. The id is no longer minted here -- it is assigned when the
    // bone is committed -- so the anchor now carries `id: null`. The
    // mutation is unchanged in substance: claim a master this bone never
    // came from.
    find: "      pendingBone = { id: null, masterId: null,",
    with: "      pendingBone = { id: null, masterId: 'made-up',",
    test: 'acceptance 2b' },
  // ── THE FOUR BEHAVIOURS THAT LANDED AFTER THIS GATE LAST RAN ────────────
  // Each is one deleted line from silently not happening, and the notice-slot
  // bug is why they are here rather than on a list: a refusal that sets text
  // and is overwritten passes every check that inspects state.
  { file: 'MODEL.html',
    name: 'THE REFUSAL NEVER FIRES: a disconnected run is allowed while one is open',
    find: '      if (toyRunRefused(drawPoint(at))) return;',
    with: '',
    test: 'refuses a new one' },
  { file: 'MODEL.html',
    name: 'the refusal refuses but says nothing',
    find: "    sayOnStrip('finish or cancel the run you started — Esc cancels');",
    with: '',
    test: 'refuses a new one' },
  { file: 'MODEL.html',
    name: 'THE NOTICE IS OVERWRITTEN AGAIN: stripRefresh stops preferring it',
    find: '    stripMessage.textContent = stripNotice || (rulerOn',
    with: '    stripMessage.textContent = (rulerOn',
    test: 'refuses a new one' },
  { file: 'MODEL.html',
    name: 'Escape stops cancelling, so the refusal names a way out that is gone',
    find: '      if (pendingBone) {\n        pendingBone = null;\n        sayOnStrip(\'run cancelled\');\n      }',
    with: '',
    test: 'Escape cancels' },
  { file: 'MODEL.html',
    name: 'the notice sticks, sitting over a gesture that has since succeeded',
    // A COMMENT WAS NOT A MUTANT. The first version of this entry appended a
    // comment line and changed no behaviour at all -- it would have survived
    // for ever and taught me to read one survivor as normal. A mutant that
    // cannot fail is the gate's own version of a check that cannot fail.
    // RE-ANCHORED, AND THE SKIP IS WHY THIS LINE EXISTS. The fix for the last
    // survivor renamed `stripNotice = ''` to clearNotice(), so this anchor
    // stopped matching and the gate printed SKIPPED -- then totalled "10/10
    // killed", which reads exactly like a clean sheet. A mutant that did not
    // run is not a mutant that died, and the count has to be read against the
    // number defined, never on its own.
    find: '      if (toyRunRefused(drawPoint(at))) return;\n      clearNotice();',
    with: '      if (toyRunRefused(drawPoint(at))) return;',
    test: 'Escape cancels' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-toy-draw.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
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
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
