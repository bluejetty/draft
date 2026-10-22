#!/usr/bin/env node
// MUTATION GATE for the trace in hand finding its first corner (Movie, 21 Oct):
// "make the CROSS LINES (perpendicular locations) and the NODE SNAP on the
// first point so the last point can find first point easily". Each row breaks one line,
// runs the one test that should notice, and restores the file from HEAD.
//
//   node proto/trace-home-node-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/trace-home-node.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the trace in hand sends no rays',
    find: "    const trace = traceCorners();\n    if (trace.length) return trace;\n",
    with: "",
    test: 'the roof outline in hand sends cross lines from its corners, its first corner glows, and the last corner lands on its line' },
  { file: 'MODEL.html',
    name: 'the first corner is no node',
    find: "    traceHome().forEach(v => {\n      if (!out.some(o => Math.abs(o.x - v.x) < 1e-6 && Math.abs(o.z - v.z) < 1e-6)) out.push(v);\n    });\n",
    with: "",
    test: 'the roof outline in hand sends cross lines from its corners, its first corner glows, and the last corner lands on its line' },
  { file: 'MODEL.html',
    name: 'the roof outline reads no magnet, so nothing glows',
    find: "      || shedTracing();\n",
    with: ";\n",
    test: 'the roof outline in hand sends cross lines from its corners, its first corner glows, and the last corner lands on its line' },
  { file: 'MODEL.html',
    name: 'the first corner is a node from the first press',
    find: "  const traceHome = () => { const c = traceCorners(); return c.length >= 3 ? [c[0]] : []; };\n",
    with: "  const traceHome = () => { const c = traceCorners(); return c.length >= 1 ? [c[0]] : []; };\n",
    test: 'with two corners down the first is not yet a node: a press near it is a corner there' },
  { file: 'MODEL.html',
    name: 'only the roof outline tracks, the floor is forgotten',
    find: "  const traceCorners = () => (shedTracing() ? shedRoof.corners : (pendingCornerList() || []));\n",
    with: "  const traceCorners = () => (shedTracing() ? shedRoof.corners : []);\n",
    test: 'a FLOOR traced by hand gets the same cross lines and the same first-corner node' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4524' } });
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
