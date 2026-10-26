#!/usr/bin/env node
// MUTATION GATE for every run and loop feeding the magnet
// (tests/magnet-everything.spec.js).
//
// Movie, 19 Oct: "id like the lines / walls / areas / floors/ roofs etc to
// all act in this way". Six seams: loop corners as nodes, loop edges as
// faces, crossings over every run, the traced loop's press, the selection
// move's seek, and the roof corner kept out of its own magnet.
//
// Run: node proto/magnet-everything-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/magnet-everything.spec.js';

const MUTANTS = [
  { file: 'model/07-walls-magnet.js',
    name: 'a loop\'s corners are no nodes',
    find: '    // A LOOP\'S CORNERS ARE ITS NODES (Movie, 19 Oct).\n    loopCorners().forEach(v => {\n',
    with: '    [].forEach(v => {\n',
    test: 'a floor\'s corner is a node, its edge a face, and a line across its edge crosses at a yellow corner' },
  { file: 'model/07-walls-magnet.js',
    name: 'a loop\'s edges are no faces',
    find: '    magnetSegCache = { key, list: [...wallFaceSegs(), ...bodySegs([...lines(), ...loopEdges(), ...siteRoofEdges()])] };\n',
    with: '    magnetSegCache = { key, list: [...wallFaceSegs()] };\n',
    test: 'a floor\'s corner is a node, its edge a face, and a line across its edge crosses at a yellow corner' },
  { file: 'model/07-walls-magnet.js',
    name: 'only walls and lines cross',
    find: '    crossingCache = { key, list: G.lineCrossings(runsHere()) };\n',
    with: '    crossingCache = { key, list: G.lineCrossings([...walls(), ...lines()]) };\n',
    test: 'a floor\'s corner is a node, its edge a face, and a line across its edge crosses at a yellow corner' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'a traced floor lands where it was pressed',
    find: '  const floorPress = at => {\n    const here = loopPoint(at);\n',
    with: '  const floorPress = at => {\n    const here = { x: at.x, z: at.z };\n',
    test: 'a floor traced by hand lands a corner on the outline\'s, and a shape\'s corner on the floor\'s' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'a moved selection seeks nothing',
    find: '        const seek = moveSeek(d, dx, dz, axis);\n',
    with: '        const seek = null;\n',
    test: 'MOVE carries a floor onto the outline\'s corner by whichever corner comes nearest' },
  { file: 'model/07-walls-magnet.js',
    name: 'a roof corner is its own magnet',
    find: '    return { nodes: nodeEnds({ faces: false }).filter(stillPt),\n',
    with: '    return { nodes: nodeEnds({ faces: false }),\n',
    test: 'a roof node dragged lands on another roof\'s corner, and never on itself' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4476' } });
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
