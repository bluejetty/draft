#!/usr/bin/env node
// MUTATION GATE for suites meeting by their end lines (Movie, 25 Oct), which
// replaced the corner rings clicking onto other holograms' corner rings
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
  { file: 'hologram.js', name: 'the end lines catch nothing',
    find: "      if (Math.abs(d) > reachFt) return;\n      const u = { x: (L.b.x - L.a.x) / L.len, z: (L.b.z - L.a.z) / L.len };",
    with: "      if (true) return;\n      const u = { x: (L.b.x - L.a.x) / L.len, z: (L.b.z - L.a.z) / L.len };",
    test: 'within 6"' },
  { file: 'hologram.js', name: 'lines that do not face each other catch too',
    find: "      if (L.n.x * M.n.x + L.n.z * M.n.z > -0.999) return;",
    with: "      if (false) return;",
    test: 'corners no longer pull' },
  { file: 'hologram.js', name: 'a much wider reach',
    find: "      if (Math.abs(d) > reachFt) return;\n      const u = { x: (L.b.x - L.a.x) / L.len, z: (L.b.z - L.a.z) / L.len };",
    with: "      if (Math.abs(d) > reachFt * 3) return;\n      const u = { x: (L.b.x - L.a.x) / L.len, z: (L.b.z - L.a.z) / L.len };",
    test: 'six inches short' },
  { file: 'model/13-suites-trim-follow.js', name: 'the line also pins the suite along it (no jog)',
    find: "        m.underlay.x += held === 'x' ? 0 : lock.dx;",
    with: "        m.underlay.x = (holograms().find(o => o === lock.other) || m.underlay).x;\n        m.underlay.x += held === 'x' ? 0 : lock.dx;",
    test: 'within 6"' },
  { file: 'hologram.js', name: 'the lines stop at the corners',
    find: "  const SUITE_LINE_REACH_FT = 2;",
    with: "  const SUITE_LINE_REACH_FT = 0;",
    test: 'the end lines' },
  { file: 'model/13-suites-trim-follow.js', name: 'a press on a line picks nothing up',
    find: "    const holo = suiteLineAt(event) || holograms().filter(h => !h.hidden).find(h => suiteGrabAt(h, at));\n    if (!holo) return;",
    with: "    const holo = null;\n    if (!holo) return;",
    test: 'press on a suite' },
  { file: 'model/13-suites-trim-follow.js', name: 'a click on a line leaves the suite in hand',
    find: "    if (m.grabbed) { endTraceMove(false); return; }\n",
    with: "",
    test: 'press on a suite' },
  { file: 'hologram.js', name: 'a blue hologram has no lines',
    find: "    if (!(isSuite(holo) || isSuiteFile(holo))) return [];",
    with: "    if (!isSuite(holo)) return [];",
    test: 'blue hologram' },
  { file: 'model/02-holograms-tags.js', name: 'joined lines drawn as two solids',
    find: "      if (t1 - t0 <= 0.01) return;\n      joined += 1;",
    with: "      if (true) return;\n      joined += 1;",
    test: 'within 6"' },
  { file: 'model/02-holograms-tags.js', name: 'lines a little apart drawn joined',
    find: "      if (Math.abs((M.a.x - L.a.x) * L.n.x + (M.a.z - L.a.z) * L.n.z) > 0.01) return;",
    with: "      if (Math.abs((M.a.x - L.a.x) * L.n.x + (M.a.z - L.a.z) * L.n.z) > 50) return;",
    test: 'do not quite meet' },
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
