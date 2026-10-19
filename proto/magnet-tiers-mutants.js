#!/usr/bin/env node
// MUTATION GATE for the three magnet tiers (tests/magnet-tiers.spec.js).
//
// Movie, 19 Oct: "the ACT LIKE nodes ... will be YELLOW glow and will be
// slightly less magnetic than the ORANGE NODES". Five seams: the orange
// reach, the yellow reach, the crossings, the yellow ink, and the crossings
// on a drag.
//
// Run: node proto/magnet-tiers-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/magnet-tiers.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'a node reaches no further than a corner',
    find: '  const NODE_PULL_PX = 14;\n',
    with: '  const NODE_PULL_PX = 11;\n',
    test: 'a node pulls harder than a crossing that acts like one; a crossing close by still wins' },
  { file: 'MODEL.html',
    name: 'a corner is as magnetic as a node',
    find: '  const FACE_CORNER_PULL_PX = 11;\n',
    with: '  const FACE_CORNER_PULL_PX = 14;\n',
    test: 'a node pulls harder than a crossing that acts like one; a crossing close by still wins' },
  { file: 'MODEL.html',
    name: 'a crossing is no corner',
    find: "    crossingCache = { key, list: G.lineCrossings([...walls(), ...lines()]) };\n",
    with: '    crossingCache = { key, list: [] };\n',
    test: 'a node pulls harder than a crossing that acts like one; a crossing close by still wins' },
  { file: 'MODEL.html',
    name: 'a corner glows neon, not yellow',
    find: "    yellow: { ink: '#ffe600', glow: 'rgba(255, 230, 0, 0.95)' },\n",
    with: "    yellow: { ink: TRACK_LIT, glow: TRACK_GLOW },\n",
    test: 'the node glows orange, the corner yellow, the face neon' },
  { file: 'MODEL.html',
    name: 'a drag sees no crossings',
    find: "    const still = walls().filter(w => !touches(w.start) && !touches(w.end));\n"
      + "    const stillRuns = [...still, ...lines().filter(l => !touches(l.start) && !touches(l.end))];\n"
      + "    return { nodes: nodeEnds({ faces: false }).filter(v => !touches(v)),\n"
      + "      corners: [...G.wallFaceCorners(still, openingThicknessFt()),\n"
      + "        ...(G.lineCrossings ? G.lineCrossings(stillRuns) : [])],\n",
    with: "    const still = walls().filter(w => !touches(w.start) && !touches(w.end));\n"
      + "    const stillRuns = [...still, ...lines().filter(l => !touches(l.start) && !touches(l.end))];\n"
      + "    return { nodes: nodeEnds({ faces: false }).filter(v => !touches(v)),\n"
      + "      corners: [...G.wallFaceCorners(still, openingThicknessFt()),\n"
      + "      ],\n",
    test: 'a dragged node lands on a crossing, and takes the yellow' },
  { file: 'geometry-2d.js',
    name: 'a T-junction counts as a crossing',
    find: '        if (!hit || hit.t < 0.001 || hit.t > 0.999 || hit.u < 0.001 || hit.u > 0.999) continue;\n',
    with: '        if (!hit) continue;\n',
    test: 'the node glows orange, the corner yellow, the face neon' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4473' } });
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
