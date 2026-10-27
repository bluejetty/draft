#!/usr/bin/env node
// MUTATION GATE for the outline's squared corner landing on what it lights
// (tests/outline-tsquare-snap.spec.js).
//
// Movie, 27 Oct: "the lines for the outline house aren't landing on the
// proper spot perpendicular to the point selected (i'm selecting a point
// along the line) and the node appears in the wrong spot still even with
// the T on".
//
// Run: node proto/outline-tsquare-snap-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/outline-tsquare-snap.spec.js';

const MUTANTS = [
  { file: 'model/10-tracking-garage.js',
    name: 'the squared corner takes no snap, as before',
    find: "        if (caught) return { x: caught.x, z: caught.z };\n",
    with: "",
    test: 'T-square lit: an outline corner pressed beside a line lands square on the line, and the ring shows where' },
  { file: 'model/10-tracking-garage.js',
    name: 'the ring is the hand\'s, not the square\'s',
    find: "    const runFrom = drawStart\n      || (activeTool === 'outline' ? outlineTail() : loopCornersInHand()?.at(-1)) || null;\n",
    with: "    const runFrom = drawStart;\n",
    test: 'T-square lit: an outline corner pressed beside a line lands square on the line, and the ring shows where' },
  { file: 'model/10-tracking-garage.js',
    name: 'the T-square does not square the outline',
    find: "        const square = outlineHand(from, at, 90);\n",
    with: "        const square = { x: at.x, z: at.z };\n",
    test: 'T-square lit, nothing in reach: the corner is square to the last and wherever the hand set it' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4798' } });
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
