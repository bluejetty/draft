#!/usr/bin/env node
// MUTATION GATE for a selected roof's edges (tests/model-html-roof-edges.spec.js).
//
// Movie, 18 Oct, North Point: "main roof overhang at 8ft except at the front
// jog out, the side overhangs are only 2ft and at the left edge its no
// overhang" -- and on the elevation, "shouldn't be the extra lines". Each row
// breaks one piece of that and asks the spec whether it noticed.
//
// Run: node proto/model-roof-edges-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-roof-edges.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'a selected roof gets no panel',
    find: "    roof: items => ({ title: 'ROOF', node: roofPropsNode(items) }),\n",
    with: '',
    test: 'a roof clicked shows ROOF in PROPERTIES; an edge clicked says which, its kind and overhang' },
  { file: 'MODEL.html',
    name: 'a click on an edge picks no edge',
    find: '        roofEdgeIdx = roofHit ? roofEdgeNear(roofHit, world) : null;\n',
    with: '        roofEdgeIdx = null;\n',
    test: 'a roof clicked shows ROOF in PROPERTIES; an edge clicked says which, its kind and overhang' },
  { file: 'MODEL.html',
    name: 'the overhang is worked from the eave, not the wall line',
    find: '    const eave = G.offsetOutlineVariable(footprint, want);\n',
    with: '    const eave = G.offsetOutlineVariable(roof.points.map(pt => ({ x: pt.x, z: pt.z })), want.map((v, i) => v - roofOverhangs(roof)[i]));\n',
    test: "the jog-out front at 2' lands on the main eave line: one straight eave, no hips across it, and back out again" },
  { file: 'MODEL.html',
    name: 'a roof shaped by hand keeps following PROJECT',
    find: "    roof.edgeOverhang = want.slice();\n    roof.follows = 'none';\n",
    with: '    roof.edgeOverhang = want.slice();\n',
    test: "the jog-out front at 2' lands on the main eave line: one straight eave, no hips across it, and back out again" },
  { file: 'geometry-2d.js',
    name: 'the skeleton walks the corners that are not corners',
    find: '      if (zero || straight) { pts.splice(index, 1); kinds.splice(index, 1); } else index += 1;\n',
    with: '      index += 1;\n',
    test: "the jog-out front at 2' lands on the main eave line: one straight eave, no hips across it, and back out again" },
  { file: 'MODEL.html',
    name: 'no 10\' cap on a typed overhang',
    find: '    if (want.some(v => !(v >= 0) || v > max)) {\n',
    with: '    if (want.some(v => !(v >= 0))) {\n',
    test: "ALL EDGES moves every eave from the wall line; GABLE flips the picked edge; 10' is the cap; one UNDO each" },
  { file: 'MODEL.html',
    name: 'the GABLE chip flips nothing',
    find: "            roof.edges = roof.points.map((_, i) => (i === index ? id\n",
    with: "            roof.edges = roof.points.map((_, i) => (i === -1 ? id\n",
    test: "ALL EDGES moves every eave from the wall line; GABLE flips the picked edge; 10' is the cap; one UNDO each" },
  { file: 'MODEL.html',
    name: 'an edit pushes no UNDO',
    find: "    undoStack.push({ kind: 'props', edits });\n    markDirty();\n    paint();\n    return null;\n  };\n  // ── GABLE END",
    with: "    markDirty();\n    paint();\n    return null;\n  };\n  // ── GABLE END",
    test: "ALL EDGES moves every eave from the wall line; GABLE flips the picked edge; 10' is the cap; one UNDO each" },
  { file: 'MODEL.html',
    name: 'PITCH changes nothing on the roof',
    find: "editRoofs(items, roof => { roof.pitch = v; roof.follows = 'none'; return null; });",
    with: "editRoofs(items, roof => { roof.follows = 'none'; return null; });",
    test: 'PITCH on the selected roof' },
  { file: 'MODEL.html',
    name: 'a roof in an assembly edits alone',
    find: "    const items = kin.length > 1 && !roofScopeOne ? kin : picked;\n",
    with: '    const items = picked;\n',
    test: 'a roof in an ASSEMBLY: PITCH and ALL EDGES reach every roof in it, or THIS ROOF alone' },
  { file: 'MODEL.html',
    name: 'THIS ROOF still edits the whole assembly',
    find: "        roofScopeOne ? 'one' : 'assembly', id => { roofScopeOne = id === 'one'; again(); }));\n",
    with: "        roofScopeOne ? 'one' : 'assembly', id => { again(); }));\n",
    test: 'a roof in an ASSEMBLY: PITCH and ALL EDGES reach every roof in it, or THIS ROOF alone' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4432' } });
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
