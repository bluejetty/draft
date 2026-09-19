// WHEN A STOREY'S HEIGHT MOVES, WHICH WALLS GO WITH IT.
//
// Movie, 19 Sep: "if the floor or ceiling is the same height as the DEFAULT,
// if they change the PROJECT DEFAULT, also change those heights to match",
// and, accepting what that leaves behind in the same breath: "(the user may
// need to manually change the 'previously adjusted' height".
//
// WHAT WAS BROKEN, on both pages. A wall's top is copied in at the moment it
// is drawn, from its storey's wallHeightFt, and never looked at again -- the
// only writes of `topHeight` anywhere are at creation. So raising MAIN FL to
// 9' in PROJECT moved nothing already on the sheet, and the drafter's only
// remedy was to redraw the house.
//
// THE RULE NEEDS NO NEW KEY, because Movie's own words ARE the comparison: a
// wall whose top equals the height in force is ON that height; one that
// differs is his. A stored "I am on the default" flag would be a second fact
// about the same wall, free to disagree with the first.
//
// AND IT TAKES BOTH TABLES. Only the instant of the write knows the OLD
// number, which is what says which walls were following it -- one tick later
// a wall at 8'-1 1/2" under a storey now set to 9' is indistinguishable from
// one somebody typed. That is why this is a function handed a before and an
// after, and why PROJECT.html calls it inside writeProjectToStore, on the
// freshly re-read file, rather than at the box that edits a height.
//
// Run: node proto/wall-height-follow-harness.js          (checks)
//      node proto/wall-height-follow-harness.js --mutate (checks + mutations)
const fs = require('fs');
const path = require('path');
const MUTATION_MODE = require('./harness-args.js').mutationMode();
const SRC = path.join(__dirname, '..', 'level-assembly.js');

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  // eslint-disable-next-line no-new-func
  new Function('window', src)(window);
  return window.DraftLevelAssembly;
}

// THE OFFICE DEFAULT IS ASKED FOR, NOT TYPED. 8'-1 1/8" is what a level with
// no stored assembly answers today, and a harness that hard-coded it would
// go green against a module that had changed its mind.
const DEFAULT_TOP = load(null).defaultLevelAssembly().wallHeightFt;

const MAIN = 3;
const SECOND = 5;
const wall = (id, levelId, topHeight) => ({ id, levelId, topHeight,
  start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, wallType: 'stud_2x6' });

// A main floor at the office default with one wall the drafter raised, and a
// second storey that is not being touched at all.
const HOUSE = () => [
  wall('on-default', MAIN, DEFAULT_TOP),
  wall('drafters', MAIN, 10),
  wall('upstairs', SECOND, DEFAULT_TOP),
];
const AT = table => table;
const topOf = (walls, id) => walls.find(w => w.id === id).topHeight;

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });

check('a wall standing at the storey-s height follows it up',
  L => { const out = L.wallsFollowingHeights(HOUSE(),
    AT({ [MAIN]: { wallHeightFt: DEFAULT_TOP } }), AT({ [MAIN]: { wallHeightFt: 9 } }));
  return [topOf(out, 'on-default'), 9]; });

// THE HALF MOVIE ASKED FOR BY NAME. A wall he already adjusted is his, and
// the default leaving it behind is the reason WALL PROPERTIES exists.
check('a wall the drafter set himself is left exactly where he put it',
  L => { const out = L.wallsFollowingHeights(HOUSE(),
    AT({ [MAIN]: { wallHeightFt: DEFAULT_TOP } }), AT({ [MAIN]: { wallHeightFt: 9 } }));
  return [topOf(out, 'drafters'), 10]; });

check('a storey nobody touched keeps every wall on it',
  L => { const out = L.wallsFollowingHeights(HOUSE(),
    AT({ [MAIN]: { wallHeightFt: DEFAULT_TOP } }), AT({ [MAIN]: { wallHeightFt: 9 } }));
  return [topOf(out, 'upstairs'), DEFAULT_TOP]; });

// A STOREY BEING GIVEN AN ASSEMBLY FOR THE FIRST TIME still moves its walls:
// it HAD a height -- the office default -- it just had no record saying so.
// Reading only the new table's keys would miss exactly this case.
check('a storey written for the first time still moves the walls that were on the default',
  L => { const out = L.wallsFollowingHeights(HOUSE(), AT({}), AT({ [MAIN]: { wallHeightFt: 9 } }));
    return [out && topOf(out, 'on-default'), 9]; });

// ── AND WHAT IT MUST NOT DO ──
//
// NULL IS A REAL ANSWER, not an empty result. PROJECT.html writes six keys
// and only six; a walls array handed back when nothing moved would put the
// walls into a write that has deliberately never carried them, which is the
// snapshot defect that page already closed once.
check('nothing to move answers null, so the caller writes no walls at all',
  L => [L.wallsFollowingHeights(HOUSE(),
    AT({ [MAIN]: { wallHeightFt: DEFAULT_TOP } }),
    AT({ [MAIN]: { wallHeightFt: DEFAULT_TOP } })), null]);

check('a change that moves no wall answers null too',
  L => [L.wallsFollowingHeights([wall('mine', MAIN, 10)],
    AT({ [MAIN]: { wallHeightFt: DEFAULT_TOP } }), AT({ [MAIN]: { wallHeightFt: 9 } })), null]);

check('no walls, or something that is not a list, is null and not a throw',
  L => [`${L.wallsFollowingHeights([], AT({}), AT({}))}|`
    + `${L.wallsFollowingHeights(null, AT({}), AT({}))}|`
    + `${L.wallsFollowingHeights(undefined, AT({}), AT({}))}`, 'null|null|null']);

// IT READS THE WALLS IT IS GIVEN AND CHANGES NONE OF THEM. The caller hands
// in the file it just read off disk; mutating that in place would edit a
// drawing behind the back of the revision guard it is about to be written
// under.
check('the walls handed in come back untouched',
  L => { const walls = HOUSE();
    const before = JSON.stringify(walls);
    L.wallsFollowingHeights(walls,
      AT({ [MAIN]: { wallHeightFt: DEFAULT_TOP } }), AT({ [MAIN]: { wallHeightFt: 9 } }));
    return [JSON.stringify(walls), before]; });

// AND A WALL THAT DID NOT MOVE IS THE SAME OBJECT, not a copy of it. Cheap
// to keep and worth keeping: it says out loud that this walks the list and
// rewrites the ones that moved, rather than rebuilding the drawing.
check('a wall that did not move is not even rebuilt',
  L => { const walls = HOUSE();
    const out = L.wallsFollowingHeights(walls,
      AT({ [MAIN]: { wallHeightFt: DEFAULT_TOP } }), AT({ [MAIN]: { wallHeightFt: 9 } }));
    return [out[1] === walls[1] && out[2] === walls[2], true]; });

// THE TOP, NOT THE BASE. wallHeightFt governs where a wall STOPS; where it
// starts is the level's own elevation, a different number under a different
// control. A base that followed this would move walls for a reason nobody
// asked for -- and a pony wall, when it arrives, is exactly a wall whose
// bottom moves while its height does not.
check('it moves the top and leaves the base alone',
  L => { const out = L.wallsFollowingHeights(
    [{ ...wall('w', MAIN, DEFAULT_TOP), baseHeight: 0 }],
    AT({ [MAIN]: { wallHeightFt: DEFAULT_TOP } }), AT({ [MAIN]: { wallHeightFt: 9 } }));
  return [`${out[0].baseHeight}|${out[0].topHeight}`, '0|9']; });

// Level ids arrive as numbers on a wall and as object keys -- which are
// strings -- on the assembly table. A comparison that forgot that would
// match nothing and quietly move no walls at all.
check('a level id matches whether it is a number or a key',
  L => { const out = L.wallsFollowingHeights([wall('w', '3', DEFAULT_TOP)],
    AT({ 3: { wallHeightFt: DEFAULT_TOP } }), AT({ 3: { wallHeightFt: 9 } }));
  return [out && out[0].topHeight, 9]; });

// A STOREY THE WRITER'S TABLE DOES NOT KNOW ABOUT IS NOT A STOREY THAT
// MOVED. PROJECT writes its own levelAssemblies map, loaded when the tab
// opened; a level added in the Model Space since is missing from it. Reading
// both tables' keys -- which this function did until a mutation survived and
// was read properly -- made such a level answer the OFFICE DEFAULT on the
// after side and dragged its walls down to it. Nobody asked for that, and it
// is the caller's snapshot hazard arriving by a side door.
// THE WALL UPSTAIRS STANDS AT THE HEIGHT ITS STOREY RECORDS, which is what
// makes this check able to fail: under the union it is a wall sitting exactly
// on the `before` number for a storey the `after` table answers with the
// office default, so it is precisely the wall that gets dragged.
check('a storey missing from the table being written is left completely alone',
  L => [L.wallsFollowingHeights(
    [wall('on-default', MAIN, 9), wall('upstairs', SECOND, 9)],
    AT({ [MAIN]: { wallHeightFt: 9 }, [SECOND]: { wallHeightFt: 9 } }),
    AT({ [MAIN]: { wallHeightFt: 9 } })), null]);

const MUTATIONS = [
  // Compare against the NEW height, so nothing is ever recognised as having
  // been on the old one and no wall follows.
  ['a wall is matched against the height it is moving TO',
    s => s.replace('if (!(Math.abs(Number(wall.topHeight) - step.was) < 1e-9)) return wall;',
      'if (!(Math.abs(Number(wall.topHeight) - step.now) < 1e-9)) return wall;')],
  // Move every wall on the storey, which eats the one the drafter adjusted.
  ['every wall on the storey is dragged along, the drafter-s included',
    s => s.replace('      if (!(Math.abs(Number(wall.topHeight) - step.was) < 1e-9)) return wall;\n',
      '')],
  // Hand back the array even when nothing moved, so PROJECT writes a walls
  // key it has deliberately never written.
  ['an unchanged list is handed back anyway',
    s => s.replace('    return changed ? next : null;', '    return next;')],
  // Consider every storey either table mentions -- which drags the walls of
  // a level the writer's table has never heard of down to the office
  // default. THIS WAS THE CODE until the mutation table caught it.
  ['a storey the writer has never heard of counts as one that moved',
    s => s.replace('const ids = new Set(Object.keys(after || {}));',
      'const ids = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);')],
  // Move the base instead of the top.
  ['the bottom of the wall follows instead of the top',
    s => s.replace('      return { ...wall, topHeight: step.now };',
      '      return { ...wall, baseHeight: step.now };')],
  // Mutate the caller's array in place.
  ['the walls handed in are edited where they lie',
    s => s.replace('      return { ...wall, topHeight: step.now };',
      '      wall.topHeight = step.now; return wall;')],
  // Compare ids without making them both strings, so a numeric levelId on a
  // wall never finds its storey.
  ['a numeric level id is looked up as a number',
    s => s.replace('      const step = moved.get(String(wall?.levelId));',
      '      const step = moved.get(wall?.levelId);')],
];

function run() {
  const L = load(null);
  let failed = 0;
  CHECKS.forEach(({ label, fn }) => {
    let got, want;
    try { [got, want] = fn(L); } catch (err) { got = `threw: ${err.message}`; want = 'no throw'; }
    if (String(got) !== String(want)) {
      failed += 1;
      console.log(`FAIL  ${label}\n      got  ${got}\n      want ${want}`);
    }
  });
  console.log(`\n${CHECKS.length - failed}/${CHECKS.length} checks passed`);
  if (failed) process.exitCode = 1;
}

// A MUTATION THAT NEVER APPLIED IS NOT A MUTATION THAT WAS CAUGHT -- broken
// is its own tally and it fails the run.
function runMutations() {
  console.log('\n' + 'mutation'.padEnd(62) + 'caught by');
  let survived = 0;
  let broken = 0;
  MUTATIONS.forEach(([label, mutate]) => {
    let L;
    try { L = load(mutate); } catch (err) {
      broken += 1;
      console.log(`${label.padEnd(62)}!!! MUTATION DID NOT APPLY: ${err.message}`);
      return;
    }
    const caught = [];
    CHECKS.forEach(({ label: name, fn }) => {
      let got, want;
      try { [got, want] = fn(L); } catch (err) { caught.push(name); return; }
      if (String(got) !== String(want)) caught.push(name);
    });
    if (!caught.length) survived += 1;
    console.log(label.padEnd(62)
      + (caught.length ? caught.join('\n' + ' '.repeat(62)) : '*** NOTHING ***'));
  });
  console.log(`\n${MUTATIONS.length - survived - broken}/${MUTATIONS.length} mutations caught`);
  if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
  if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
  if (survived || broken) process.exitCode = 1;
}

if (MUTATION_MODE) runMutations(); else run();
