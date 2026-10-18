#!/usr/bin/env node
// MUTATION GATE for SUITE holograms (tests/model-html-suite.spec.js).
//
// Movie, 18 Oct: "shaded the normal colors but NOT editable from the 'SHELL
// BUILDING' file except to MOVE, COPY or FLIP etc" -- "CUT THE HOLES for the
// WINDOWS in the SUITES in the proper locations on the SHELL" -- "as long as
// it will look normal without having the 2 walls overlapping" -- "when they
// go close to lining them up it snaps".
//
// Run: node proto/suite-hologram-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-suite.spec.js';
const MUTANTS = [
  { file: 'drawing-format.js', name: "the format drops SUITE",
    find: "        ...(holo?.mode === 'suite' ? { mode: 'suite' } : {}),\n",
    with: "",
    test: "a SUITE keeps its mode through a save, and its shared wall hands its window to the shell wall" },
  { file: 'hologram.js', name: "only one face has to line up",
    find: "          && faceGaps(sf, h).every(g => Math.abs(g) < FACE_TOL_FT)",
    with: "          && faceGaps(sf, h).some(g => Math.abs(g) < FACE_TOL_FT)",
    test: "a suite wall that does not line up face for face shares nothing" },
  { file: 'hologram.js', name: "a turned-over suite's window keeps its unturned place",
    find: "      const walls = placed(holo, { walls: split.existing.walls || [] }).walls;\n      const fens",
    with: "      const walls = placed({ ...holo, flip: false }, { walls: split.existing.walls || [] }).walls;\n      const fens",
    test: "moved, turned over, the window follows: a mirrored suite in the far corner" },
  { file: 'hologram.js', name: "the window is measured from the suite wall's far end",
    find: "          const t0 = a + dir * o.offset, t1 = a + dir * (o.offset + o.width);",
    with: "          const t0 = a + o.offset, t1 = a + (o.offset + o.width);",
    test: "moved, turned over, the window follows: a mirrored suite in the far corner" },
  { file: 'hologram.js', name: "the suite's copy of the shared wall is still drawn",
    find: "        hidden.add(wall.id);\n",
    with: "",
    test: "a SUITE keeps its mode through a save, and its shared wall hands its window to the shell wall" },
  { file: 'hologram.js', name: "a suite is tinted blue like any hologram",
    find: "    const suiteDrew = list.some(isSuite) && show.existing",
    with: "    const suiteDrew = false && list.some(isSuite) && show.existing",
    test: "a suite draws in the normal colours, not the hologram blue" },
  { file: 'hologram.js', name: "no clash is found with a shell window",
    find: "        .forEach(h => out.clashes.push({ wallId: o.wallId, suite: o, other: h }));\n",
    with: "        .forEach(() => {});\n",
    test: "a shell window where a suite window lands: both drawn, and the card warns" },
  { file: 'hologram.js', name: "the snap takes only one direction",
    find: "    if (second) {\n",
    with: "    if (false) {\n",
    test: "a suite dragged within 6\" of lining up snaps onto the shell, both ways in a corner" },
  { file: 'MODEL.html', name: "a dragged suite does not snap",
    find: "    if (m.hologram && m.underlay.mode === 'suite' && H()?.suiteSnap) {",
    with: "    if (false) {",
    test: "a suite dragged within 6\" of lining up snaps onto the shell, both ways in a corner" },
  { file: 'MODEL.html', name: "a SUITE row still offers DEMO",
    find: "        ...(suite ? [] : [button(hologramDemoCount(holo)",
    with: "        ...(false ? [] : [button(hologramDemoCount(holo)",
    test: "the HOLOGRAM chip lists what is loaded; a SUITE row has no DEMO and switches back to HOLOGRAM" },
  { file: 'cut-view-env.js', name: "the elevations and sheets never get the suites' windows",
    find: "      ...(hologram?.hostOpenings ? hologram.hostOpenings(saved) : [])], levelIds);",
    with: "      ], levelIds);",
    test: "the elevations and sheets read the suite windows on the shell" },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4443' } });
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
