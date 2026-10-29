// DOES tests/boneyard-beams.spec.js CATCH A BEAM LINE THAT DOES NOTHING?
//
// Movie, 28 Oct: add a beam line on the foundation from the WIREFRAME, take
// one off the main floor, and keep MAIN FL's two lines over the foundation's
// centre pair. Each mutant breaks one of those promises; the spec named in
// `test` must go red.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');
const SPEC = 'tests/boneyard-beams.spec.js';

const MUTANTS = [
  { file: 'boneyard-beams.js',
    name: 'a line moved leaves the lines over it behind',
    find: '      const over = stackedOver(d, frontier, levelOrder).filter(b => !seen.has(b));',
    with: '      const over = [];',
    test: 'rides with it when it moves' },
  { file: 'boneyard-beams.js',
    name: 'a line moved drags the lines BELOW it too',
    find: '    levelOrder.slice(at + 1).forEach(levelId => {',
    with: '    levelOrder.forEach(levelId => {',
    test: 'rides with it when it moves' },
  { file: 'boneyard-beams.js',
    name: 'a line drawn near the one below does not land on it',
    find: '    if (best) {\n      if (runX)',
    with: '    if (false) {\n      if (runX)',
    test: 'rides with it when it moves' },
  { file: 'boneyard-beams.js',
    name: 'a new line stands on no columns',
    find: '    for (let i = 1; i < spans; i += 1) {',
    with: '    for (let i = 1; i < 1; i += 1) {',
    test: 'columns at most 12 ft apart' },
  { file: 'boneyard-beams.js',
    name: 'DELETE leaves the line\'s columns standing',
    find: '    d.columns = (d.columns || []).filter(c => !posts.includes(c));',
    with: '',
    test: 'DELETE takes a picked MAIN FL line' },
  { file: 'boneyard-beams.js',
    name: 'a dragged column leaves its line',
    find: '    if (host) {',
    with: '    if (false) {',
    test: 'COLUMN puts a post on a line' },
  { file: 'boneyard-beams.js',
    name: 'COLUMN stands the post where the click was, off the line',
    find: '    let p = { x: at.x, z: at.z };\n    if (line) {',
    with: '    let p = { x: at.x, z: at.z };\n    if (false) {',
    test: 'COLUMN puts a post on a line' },
  { file: 'BONEYARD.html',
    name: 'the Delete key does nothing to a picked post',
    find: "        if ((e.key === 'Delete' || e.key === 'Backspace') && beamPick) { e.preventDefault(); deletePicked(); return; }\n",
    with: '',
    test: 'COLUMN puts a post on a line' },
  { file: 'BONEYARD.html',
    name: 'the 3D draws no beams',
    find: "            beams3d.push({ name: level.name, beams: beams.length, columns: columns.length,",
    with: "            if (false) beams3d.push({ name: level.name, beams: beams.length, columns: columns.length,",
    test: 'the 3D shows each level' },
  { file: 'BONEYARD.html',
    name: 'a press on a wall where a line ends picks the line, not the wall',
    find: '        if (edgeUnder(x, y)) return false;\n',
    with: '',
    spec: 'tests/boneyard-edit.spec.js',
    test: 'the arrows push the picked edge a foot at a time' },
  // ── ZOOM (Movie, 28 Oct: "zoome into the 2d wireframe window like in
  // model space") ──
  { file: 'BONEYARD.html',
    name: 'the wheel does nothing',
    find: '        const k = e.deltaY < 0 ? 1.15 : 1 / 1.15;',
    with: '        const k = 1;',
    spec: 'tests/boneyard-zoom.spec.js',
    test: 'the wheel zooms' },
  { file: 'BONEYARD.html',
    name: 'a zoom is refitted out from under him',
    find: '        if (!frame || (!zoomed && !drag && !fits(w, h))) frame = frameFor(w, h);',
    with: '        if (!frame || (!drag && !fits(w, h))) frame = frameFor(w, h);',
    spec: 'tests/boneyard-zoom.spec.js',
    test: 'the wheel zooms' },
  { file: 'BONEYARD.html',
    name: 'a drag on empty floor does not pan',
    find: '        if (!hit && !breaking) { selected = null; paint2d(); startPan(e, x, y); return; }',
    with: '        if (!hit && !breaking) { selected = null; paint2d(); return; }',
    spec: 'tests/boneyard-zoom.spec.js',
    test: 'a drag on empty floor pans' },
  { file: 'BONEYARD.html',
    name: '0 does not fit',
    find: '          frame = null;\n          zoomed = false;\n          paint2d();\n          return;',
    with: '          return;',
    spec: 'tests/boneyard-zoom.spec.js',
    test: 'a drag on empty floor pans' },
  // ── HOLOGRAMS IN THE BG ("allow the 'suites' holograms' to be in the BG
  // background") ──
  { file: 'BONEYARD.html',
    name: 'a hologram sent behind is not drawn at all',
    find: '          holosShown().filter(file => holoBg.has(file.name)).forEach(file => {',
    with: '          [].forEach(file => {',
    spec: 'tests/boneyard-holograms.spec.js',
    test: 'BG beside a hologram' },
  // ── THE DIMENSIONS ("the dimensions between the beams at each end",
  // "columns too but only when zoomed in closer") ──
  { file: 'boneyard-beams.js',
    name: 'no string across the lines at the ends',
    find: '        out.push({ axis, end, at, stops, gaps: stops.slice(1).map((v, i) => v - stops[i]) });',
    with: '',
    test: 'a string across the lines at each end' },
  { file: 'BONEYARD.html',
    name: 'the post spacing shows at every size',
    find: '        const close = frame.s >= POST_DIMS_PX;',
    with: '        const close = true;',
    test: 'a string across the lines at each end' },
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
