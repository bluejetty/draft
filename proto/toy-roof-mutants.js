// DOES THE §5 SPEC CATCH A ROOF THAT DECIDES NOTHING?
//
// The gate for §5 -- the uncovered region, the edge kinds, and the bone the
// drag used to forget. Same hardenings as the ten before it.
//
// MUTANT 3 IS THE DEFECT THIS SECTION EXPOSED, not one invented for the gate.
// Every TOY drag moved wall vertices and left the OUTLINE behind, so the bone
// was a stale snapshot of where the house used to be. Sixteen §3 mutants and
// thirty-one checks missed it because all of them read walls. Only a feature
// that consumes the bone could see it.
const { execSync } = require('child_process');
const fs = require('fs');

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the roofs are never rebuilt, so a moved bone leaves them stale',
    find: "        if (board === 'toy') { boneFollows(md.before, md.body?.levelId); rebuildRoofs(); }",
    with: '        /* mutant */',
    test: 'a roof over the ceiling it opened' },
  { file: 'MODEL.html',
    name: 'ROOFS ONLY EVER ADD: the old ones are never dropped',
    // The order's own warning -- "push it back out and that roof goes again".
    find: "      drawing.roofs = (drawing.roofs || [])\n        .filter(r => String(r.sourceShapeId || '') !== String(bone.id));",
    with: '      drawing.roofs = drawing.roofs || [];',
    test: 'loses the roof it had' },
  { file: 'MODEL.html',
    name: 'THE BONE IS LEFT BEHIND AGAIN: the drag moves walls only',
    find: '    before.forEach(b => {\n      if (b.x === b.vtx.x && b.z === b.vtx.z) return;',
    with: '    before.forEach(b => {\n      if (true) return;',
    test: 'a ranch takes one roof' },
  { file: 'MODEL.html',
    name: 'the bone follows across LEVELS, so a floor reshapes the storey above',
    find: '    const rings = (drawing.outlines || [])\n      .filter(o => Number(o.levelId) === Number(levelId));',
    with: '    const rings = (drawing.outlines || []);',
    test: 'does not reshape the storey above' },
  { file: 'MODEL.html',
    name: 'EVERY EDGE IS AN EAVE, so the roof hangs two feet into the storey above',
    find: "      return onUpper(pt) && onUpper(next) ? 'gable' : 'eave';",
    with: "      return 'eave';",
    test: 'only the shared edge is a gable' },
  { file: 'MODEL.html',
    name: 'EVERY EDGE IS A GABLE: cottage-by-default is broken',
    find: "      return onUpper(pt) && onUpper(next) ? 'gable' : 'eave';",
    with: "      return 'gable';",
    test: 'only the shared edge is a gable' },
  { file: 'MODEL.html',
    name: 'the storey above is ignored, so a covered floor still takes a roof',
    find: '      const cover = above ? boneOf(above.id) : null;',
    with: '      const cover = null;',
    test: 'loses the roof it had' },
  { file: 'geometry-2d.js',
    name: 'the difference ignores the upper ring entirely',
    find: '    const cover = Array.isArray(upper) && upper.length >= 3 ? upper : null;',
    with: '    const cover = null;',
    test: 'a roof over the ceiling it opened' },
];


const run = grep => {
  try {
    execSync('npx playwright test tests/model-toy-draw.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: '/home/user/draft', stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, not just the page. The restore is
// `git checkout -- <file>`, so a file left out of this guard has any
// uncommitted work in it silently destroyed the first time a mutant touches
// it. §3b added toy-constraints.js to the targets; it belongs here too.
const dirty = execSync('git status --porcelain MODEL.html geometry-2d.js',
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
// THE COUNT IS READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED
// mutant printed "10/10 killed" on another gate today and read like a clean
// sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
