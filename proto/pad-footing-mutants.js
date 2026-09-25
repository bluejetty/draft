// DOES THE PAD SPEC CATCH A FOOTING THAT IS NOT THERE?
//
// The gate for tests/model-html-pad-footings.spec.js, in the shape its
// twenty-four siblings take: an ambiguous anchor is refused rather than
// guessed at, and a survivor is re-run against the whole spec before it is
// called one.
//
// THIS FEATURE'S FAILURE MODE IS A DRAWING THAT LOOKS FINISHED. A telepost
// with no pad under it draws exactly like one with a pad -- that is how
// MODEL.html shipped a foundation plan with beams, columns and no footings and
// nobody saw it until Movie looked at one. So the mutants below are not typos;
// each is a way to produce a plan a drafter would sign.
//
// AND TWO OF THEM ALREADY HAPPENED, which is why they are kept: `no table, so
// the pad has no size` is the live defect this change fixed, and `every pile
// at 6 inches` is the one that came with it -- the page hard-coded a diameter
// because it had none to look up, so a 12" pile and an 8" pile were one
// circle.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'THE DEFECT THIS FIXED: no pad is drawn under any column',
    find: '    if (activeViewId() === \'foundation\' && B) {',
    with: '    if (false) {',
    test: 'a built foundation draws a pad under every telepost' },
  { file: 'MODEL.html',
    name: 'the buried pad is drawn on every plan, not just the foundation',
    find: '    if (activeViewId() === \'foundation\' && B) {',
    with: '    if (B) {',
    test: 'a pad is drawn on the foundation and nowhere else' },
  { file: 'build-house.js',
    name: 'piles get pads too, so every hole grows a rectangle',
    find: '    const pads = (columns || []).filter(column => !footingFor(column?.footing).pile',
    with: '    const pads = (columns || []).filter(column => (true)',
    test: 'a built foundation draws a pad under every telepost' },
  { file: 'MODEL.html',
    name: 'the openings drawn are the level\'s OWN, not the floor above it',
    find: '    const carried = floorCarriedBy(activeLevelId());',
    with: '    const carried = { id: activeLevelId() };',
    test: 'each plan draws the openings in the floor above it' },
  // NOT `if (!carried) return;` -> an assignment, which was the first draft of
  // this mutant: `carried` is a const, so that mutation CRASHES rather than
  // mis-draws, and the check would have killed it for the wrong reason. A
  // mutant that throws proves the page has error handling, not that the rule
  // is guarded. This one is the plausible bug instead -- falling back to the
  // level itself when there is nothing above it, which draws a real plan with
  // the wrong holes on it.
  { file: 'MODEL.html',
    name: 'nothing above falls back to the level itself, so the top storey '
      + 'draws its own openings as though they were overhead',
    find: '    const carried = floorCarriedBy(activeLevelId());',
    with: '    const carried = floorCarriedBy(activeLevelId()) || { id: activeLevelId() };',
    test: 'the top storey has nothing overhead to draw' },
  { file: 'MODEL.html',
    name: 'THE DEFECT THIS FIXED: every pile back to one hard-coded diameter',
    find: '      footing: B ? B.footingFor(column.footing) : null,',
    with: '      footing: /pile/i.test(String(column.footing || \'\')) ? { pile: true, sizeIn: 6, label: column.footing } : null,',
    test: 'every pile is drawn at its own diameter, not one size for all' },
  { file: 'build-house.js',
    name: 'an unknown footing resolves to a pile rather than the standard pad',
    find: '    COLUMN_FOOTINGS.find(footing => footing.id === id) || COLUMN_FOOTINGS[0];',
    with: '    COLUMN_FOOTINGS.find(footing => footing.id === id) || COLUMN_FOOTINGS[2];',
    test: 'every pile is drawn at its own diameter, not one size for all' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-html-pad-footings.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`,
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
