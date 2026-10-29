// DOES tests/roof-raise-heel.spec.js CATCH A RAISED HEEL THAT DOES NOTHING?
//
// Movie, 28 Oct: "an option to 'Raise' roof heel when i click a roof edge on
// the roof plan" -- that edge only, the ridge moving, typed inches, and a
// separate heel band in the elevations. Each mutant breaks one of those; the
// test named in `test` must go red.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SPEC = 'tests/roof-raise-heel.spec.js';

const MUTANTS = [
  { file: 'geometry-2d.js',
    name: 'the roof never re-solves round a raised edge',
    find: '    if (!push.some(d => d > 0)) return null;',
    with: '    return null;',
    test: 'RAISE HEEL on the clicked eave' },
  { file: 'geometry-2d.js',
    name: 'the eave line is pushed IN, not out',
    find: '      const out = { x: s * u.z, z: -s * u.x };',
    with: '      const out = { x: -s * u.z, z: s * u.x };',
    test: 'RAISE HEEL on the clicked eave' },
  { file: 'geometry-2d.js',
    name: 'the cut-back strip leaves seams on the plain eaves beside it',
    find: '    .map(points => ({ ...face, points, area: Math.abs(polyArea2(points)) / 2, seams: seamsOf(points, seamHoles) })));',
    with: '    .map(points => ({ ...face, points, area: Math.abs(polyArea2(points)) / 2, seams: seamsOf(points, holes) })));',
    test: 'the elevations' },
  { file: 'cut-view.js',
    name: 'a raised eave is not an eave to the elevations',
    find: '    const eaveLiftOf = (ea, eb, eaveTop, lifts = [0]) => lifts.find(lift =>',
    with: '    const eaveLiftOf = (ea, eb, eaveTop, lifts = [0]) => [0].find(lift =>',
    test: 'the elevations' },
  { file: 'cut-view.js',
    name: 'the wall\'s corners stop at the plate under a raised eave',
    find: '        let top = Math.min(own, Math.max(level.wallTop, lifted));',
    with: '        let top = Math.min(own, level.wallTop);',
    test: 'corners climb' },
  { file: 'cut-view.js',
    name: 'the wall stops at the plate under a raised eave',
    find: '          top = Math.max(top, base + Math.min(lift, rise));',
    with: '',
    test: 'the elevations' },
  { file: 'drawing-format.js',
    name: 'the file forgets the raised heel',
    find: '          return heel && heel.some(v => v > 0) ? { edgeHeelIn: heel } : {};',
    with: '          return {};',
    test: 'the elevations' },
  { file: 'model/15-panels.js',
    name: 'a gable offers a heel to raise',
    find: "        if (kind === 'eave') {\n          const heelNow = () => {",
    with: "        if (true) {\n          const heelNow = () => {",
    test: 'a gable has no heel' },
  { file: 'model/15-panels.js',
    name: 'a heel set back to 0 leaves a list of zeros behind',
    find: '    if (next.some(v => v > 0)) roof.edgeHeelIn = next; else delete roof.edgeHeelIn;',
    with: '    roof.edgeHeelIn = next;',
    test: 'RAISE HEEL on the clicked eave' },
];

const run = (spec, grep) => {
  try {
    execSync(`npx playwright test ${spec} --workers=1`
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// The restore is `git checkout -- <file>`: refuse to run over uncommitted
// work in any file a mutant touches.
const files = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${files.join(' ')}`, { cwd: ROOT }).toString().trim();
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
  const spec = m.spec || SPEC;
  let result = run(spec, m.test);
  let note = '';
  if (result === 'passed' && run(spec, null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
