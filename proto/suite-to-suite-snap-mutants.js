#!/usr/bin/env node
// MUTATION GATE for corner rings clicking onto other holograms' corner rings
// (tests/suite-to-suite-snap.spec.js).
//
// Movie, 23 Oct: "when they come close to another suite circle corner node
// can they 'GLOW' and be 'MAGNETIC SNAP ... within about 4" radius 8"
// diameter (pretty strong"; "all suites attrached and glow for all other
// suites with the corner ring nodes".
//
// Run: node proto/suite-to-suite-snap-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/suite-to-suite-snap.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'another hologram\'s corner rings are not magnetic',
    find: "    others.forEach(other => hologramSuperNodes(other).forEach(b => offer(b, other)));\n",
    with: "",
    test: 'within 4"' },
  { file: 'MODEL.html', name: 'a caught pair does not hold',
    find: "      if (kept && kept.d <= SUPER_NODE_HOLD_FT) return kept;\n",
    with: "",
    test: 'holds through a wobble' },
  { file: 'MODEL.html', name: 'a caught pair never lets go',
    find: "      if (kept && kept.d <= SUPER_NODE_HOLD_FT) return kept;\n",
    with: "      if (kept) return kept;\n",
    test: 'holds through a wobble' },
  { file: 'MODEL.html', name: 'a blue hologram\'s rings are passed by',
    find: "    const others = holograms().filter(o => o !== holo && !o.hidden);\n",
    with: "    const others = holograms().filter(o => o !== holo && !o.hidden && o.mode === 'suite');\n",
    test: 'blue hologram' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4529' } });
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
