#!/usr/bin/env node
// MUTATION GATE for the super nodes (tests/super-nodes.spec.js).
//
// Movie, 20 Oct: "super high power nodes very SNAP Magnetic ... place them
// on the corners of the suites where they will attach to the other SUPER
// NODES". Seven seams: the lock never applied, the pull doubled, the T-square
// not respected, a blue hologram catching, the placing press not snapping,
// the record dropped on load, and the super node not deletable.
//
// Run: node proto/super-nodes-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/super-nodes.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the lock pulls nothing',
    find: "      m.underlay.x += held === 'x' ? 0 : m.superLock.dx;\n",
    with: "",
    test: 'a suite dragged to within 4" of a house super node clicks onto it exactly, and its window cuts the shell' },
  { file: 'MODEL.html',
    name: 'the pull reaches eight inches',
    find: "      if (p.d <= SUPER_NODE_PULL_FT && (!best || p.d < best.d)) best = p;\n",
    with: "      if (p.d <= SUPER_NODE_PULL_FT * 2 && (!best || p.d < best.d)) best = p;\n",
    test: 'six inches short, no catch: the suite stays where the hand left it' },
  { file: 'MODEL.html',
    name: 'the lock goes off the square',
    find: "      m.underlay.z += held === 'z' ? 0 : m.superLock.dz;\n",
    with: "      m.underlay.z += m.superLock.dz;\n",
    test: 'T-square lit: the catch moves the suite along the hand\'s axis only' },
  { file: 'MODEL.html',
    name: 'a blue hologram does not catch',
    find: "    m.superLock = m.hologram ? superNodeLock(m.underlay, m.superLock) : null;\n",
    with: "    m.superLock = m.hologram && m.underlay.mode === 'suite' ? superNodeLock(m.underlay, m.superLock) : null;\n",
    test: 'a blue hologram\'s corners click on too' },
  { file: 'MODEL.html',
    name: 'a placed super node lands where it was pressed',
    find: "    const caught = snap.pt || cornerSnap(at, []);\n",
    with: "    const caught = null;\n",
    test: 'SUPERNODE armed: a press by a corner lands the node on it exactly, and a reload keeps it' },
  { file: 'MODEL.html',
    name: 'the record is dropped on load',
    find: "      ...(Array.isArray(parsed.superNodes) ? { superNodes: F.superNodes(parsed.superNodes, levelIds) } : {}),\n",
    with: "      ...(Array.isArray(parsed.superNodes) ? { superNodes: [] } : {}),\n",
    test: 'SUPERNODE armed: a press by a corner lands the node on it exactly, and a reload keeps it' },
  { file: 'MODEL.html',
    name: 'a super node cannot be deleted',
    find: "    superNode: 'superNodes',\n",
    with: "",
    test: 'DELETE takes a super node out and UNDO puts it back' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4492' } });
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
