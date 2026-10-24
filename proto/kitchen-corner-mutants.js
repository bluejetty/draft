#!/usr/bin/env node
// MUTATION GATE for the kitchen CORNER and the one melded counter
// (tests/kitchen-corner.spec.js).
//
// Movie, 21 Oct: "a 'corner peice that is 28" x 28" - 24" deep counter that
// will allow 4" space in the corner before the first drawers or doors start";
// "when you draw the counter can make it all join up (and not hang in to the
// wall... and make the cabinet lines very lightweight but visible, meld the
// COUNTER".
//
// Run: node proto/kitchen-corner-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/kitchen-corner.spec.js';
const MUTANTS = [
  { file: 'render-2d.js', name: 'the uppers run over the sink and the dishwasher',
    find: "uppers.push(...upperRings(fx, geo, spansOn(fx, NO_UPPER_KINDS)));",
    with: "uppers.push(...upperRings(fx, geo));",
    test: 'stop at a sink and a dishwasher' },
  { file: 'render-2d.js', name: 'the counter runs over the stove and the fridge',
    find: "        counters.push(...counterRings(fx, geo, env.COUNTER_OVERHANG_FT, cuts));\n",
    with: "        counters.push(...counterRings(fx, geo, env.COUNTER_OVERHANG_FT));\n",
    test: 'stops at each' },
  { file: 'fixture-geometry.js', name: 'the counter hangs an inch past the cabinets',
    find: "  const COUNTER_OVERHANG_FT = 0.5 / 12;",
    with: "  const COUNTER_OVERHANG_FT = 1 / 12;",
    test: 'stops at each' },
  { file: 'render-2d.js', name: 'every edge kept: a joint line across the counter',
    find: "if (covered({ x: m.x + nx, z: m.z + nz }) !== covered({ x: m.x - nx, z: m.z - nz })) {",
    with: "if (true) {",
    test: 'one counter' },
  { file: 'render-2d.js', name: 'the walls block nothing: the counter hangs into them',
    find: "stroke(outlineSegments(counters, blockers), false);",
    with: "stroke(outlineSegments(counters), false);",
    test: 'stops at the wall face' },
  { file: 'render-2d.js', name: 'the CORNER\'s other leg has no counter',
    find: "        geoRect(geo, wallEnd, geo.legAlong - c * o, back, geo.legOff)];\n",
    with: "      ];\n",
    test: 'one counter' },
  { file: 'render-2d.js', name: 'the CORNER\'s other leg has no uppers',
    find: "      rings.push(geoRect(geo, geo.cornerAlong, geo.cornerAlong - c * deep, geo.backOff, geo.legOff));\n",
    with: "",
    test: 'one counter' },
  { file: 'render-2d.js', name: 'a melded box at full weight',
    find: "ctx.save(); ctx.lineWidth = 0.5; ctx.globalAlpha *= 0.45; ctx.stroke(); ctx.restore();",
    with: "ctx.stroke();",
    test: 'drawn light' },
  { file: 'MODEL.html', name: 'the CORNER turned the wrong way round',
    find: "const corner = along < face ? 1 : -1;",
    with: "const corner = along < face ? -1 : 1;",
    test: 'sits tight in the corner' },
  { file: 'MODEL.html', name: 'drawers by the leg on the other wall do not land against it',
    find: "      [t + half, t - half].forEach(at => {",
    with: "      [].forEach(at => {",
    test: 'sits tight in the corner' },
  { file: 'drawing-format.js', name: 'the file forgets which end is the corner',
    find: "        ...(kind === 'cornerbase' ? { corner: fixture?.corner === -1 ? -1 : 1 } : {}),\n",
    with: "",
    test: 'one counter' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4515' } });
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
