// DOES THE LEVEL-LOCK PORT'S SPEC CATCH A LOCK THAT DOES NOT HOLD?
//
// The gate for GILLIGAN-LEVEL-LOCK-PORT-WORKORDER.md on MODEL.html. Every
// mutant here is a way the port could be wrong while still looking like a
// working feature on screen — which is the only kind worth defining.
//
// MUTANT 1 IS THE ONE THE ORDER NAMES TWICE: uniquePoints exists because a
// corner shared by two walls of one assembly is ONE object in the vertex pool,
// and walking items instead would move it twice and tear the assembly apart at
// its own corner. It is the failure the module was written to prevent, so it
// is the first thing this gate asks about.
//
// MUTANT 4 IS WHY THE LOOKUP IS UNFILTERED. itemsOfGroup sweeps the
// LEVEL-FILTERED accessors, and a lock's siblings are by definition on other
// floors — so using it would make the lock work only when both assemblies are
// on the level already being looked at, which is the one case a level lock is
// not for. It moves nothing and reports success.
const { execSync } = require('child_process');
const fs = require('fs');

const SPEC = 'tests/model-level-lock.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the shared corner is moved TWICE: uniquePoints replaced by a plain walk',
    find: `    const points = window.DraftLevelLock.uniquePoints(items);`,
    with: `    const points = (items || []).flatMap(i => (i.points || [i.start, i.end, i.point]).filter(Boolean));`,
    test: 'a corner shared by two walls of one assembly moves ONCE' },

  { file: 'MODEL.html',
    name: 'the siblings never move: the delta is dropped on release',
    find: `          applyLevelLockDelta(md.group, a.vtx.x - a.x, a.vtx.z - a.z);`,
    with: `          applyLevelLockDelta(md.group, 0, 0);`,
    test: 'moves its locked siblings the same delta' },

  { file: 'MODEL.html',
    name: 'the MOVER is moved twice: the lock delta is applied to it as well',
    find: `    const siblings = levelLockSiblings(group);`,
    with: `    const siblings = [group, ...levelLockSiblings(group)];`,
    test: 'the mover moves ONCE' },

  { file: 'MODEL.html',
    name: 'the sibling lookup is LEVEL-FILTERED, so a lock across floors moves nothing',
    find: `      moved += translateItemsBy(itemsOfGroupAnywhere(sibling), dx, dz);`,
    with: `      moved += translateItemsBy(itemsOfGroup(sibling).map(e => e.item), dx, dz);`,
    test: 'moves its locked siblings the same delta' },

  { file: 'MODEL.html',
    name: 'a LOCK OF ONE is allowed: the page counts members itself instead of asking',
    find: `    const lock = window.DraftLevelLock.makeLock(
      \`lock-\${nextId}\`, name, (chosen || []).map(group => group?.id));
    if (!lock) return null;`,
    with: `    const lock = { id: \`lock-\${nextId}\`, name,
      members: [...new Set((chosen || []).map(g => g?.id).filter(Boolean))] };
    if (!lock.members.length) return null;`,
    test: 'a lock of one is refused' },

  { file: 'MODEL.html',
    name: 'BREAK marks the lock instead of removing it',
    find: `    drawing.levelLocks = window.DraftLevelLock.breakLock(levelLocks(), lock.id);
    if (drawing.levelLocks.length === before) return false;`,
    with: `    drawing.levelLocks = levelLocks().map(l =>
      (l.id === lock.id ? { ...l, broken: true } : l));
    if (false) return false;`,
    test: 'BREAK removes the lock outright' },

  { file: 'MODEL.html',
    name: 'a DRAG breaks the lock, so distance becomes consent',
    find: `        if (md.kind === 'group' && md.group && md.before.length) {`,
    with: `        if (md.kind === 'group' && md.group && md.before.length
            && (drawing.levelLocks = [])) {`,
    test: 'a drag never breaks a lock' },

  { file: 'MODEL.html',
    name: 'the rigid drag never arms, so the whole gesture is dead',
    find: `      if (rigidGroup) {`,
    with: `      if (false && rigidGroup) {`,
    test: 'moves its locked siblings the same delta' },

  { file: 'MODEL.html',
    name: 'UNDO forgets the siblings: one Ctrl+Z restores half the move',
    find: `          before: md.lockBefore ? [...md.before, ...md.lockBefore] : md.before });`,
    with: `          before: md.before });`,
    test: 'one Ctrl+Z puts BOTH floors back' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: '/home/user/draft', stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4321' } });
    return 'passed';
  } catch { return 'failed'; }
};

// THE BASELINE FIRST, AND THIS IS NOT CEREMONY. A mutant is counted KILLED
// when the spec FAILS -- so if the spec is already failing for a reason that
// has nothing to do with the mutant, every mutant "dies" and the gate prints a
// perfect sheet over broken code.
//
// It happened on this gate. After rebasing onto main, fit() began insetting
// the view for the chrome bars, the spec's local world-to-screen helper was
// still mapping from the canvas centre, five checks went red -- and the gate
// reported 9/9 anyway, because a red spec kills everything. A gate that cannot
// tell "the mutant did it" from "it was already broken" is not measuring
// anything.
{
  const clean = run(null);
  if (clean !== 'passed') {
    console.log('REFUSING TO RUN: the spec is already failing before any mutant '
      + 'is applied.\nEvery mutant would read as KILLED and the sheet would be '
      + 'a lie. Fix the spec first.');
    process.exit(1);
  }
  console.log('baseline: the unmutated spec passes\n');
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `/home/user/draft/${m.file}`;
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
  execSync(`git checkout -- ${m.file}`, { cwd: '/home/user/draft' });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
