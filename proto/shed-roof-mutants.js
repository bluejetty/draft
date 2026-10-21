#!/usr/bin/env node
// MUTATION GATE for the SINGLE SLOPE ROOF drawn by hand on a storey
// (tests/shed-roof.spec.js).
//
// Movie, 21 Oct: "lets make a POPUP and we can put different ROOF options in
// there", "option 1 - simple 1 slope roof", the wall line, "the DIRECTION OF
// SLOPE - mark the EAVE side", "the ROOF shape" with "their eave overhang",
// the PROJECT pitch "as the default at start", drawn on the 2nd floor and
// shown "on the 2nd FLoor PLAN and on the ROOF plan".
//
// Run: node proto/shed-roof-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/shed-roof.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'ROOF on a storey never asks',
    find: "    if (roofPickCard && storeyHere()) roofPickCard.hidden = false;",
    with: "    void storeyHere;",
    test: 'asks which roof' },
  { file: 'MODEL.html', name: 'the half-drawn roof never takes the press',
    find: "    if (activeTool === 'roof') { if (shedRoof) { shedPress(at); return; } roofPress(at); return; }",
    with: "    if (activeTool === 'roof') { roofPress(at); return; }",
    test: 'three steps' },
  { file: 'MODEL.html', name: 'the eave read uphill',
    find: "        return off >= -0.5 ? { kind: 'eave', over: Math.max(0, off) } : { kind: 'gable', over: 0 };",
    with: "        return off <= 0.5 ? { kind: 'eave', over: Math.max(0, -off) } : { kind: 'gable', over: 0 };",
    test: 'three steps' },
  { file: 'MODEL.html', name: 'the rakes never overhang the end walls',
    find: "        if (d < bestD) { bestD = d; over = d; }",
    with: "        if (d < bestD) { bestD = d; over = 0; }",
    test: 'three steps' },
  { file: 'MODEL.html', name: 'the build pitch, not the PROJECT pitch',
    find: "    const { pitch } = window.DraftLevelAssembly.projectRoofFor(drawing, 'house', drawing.buildType);",
    with: "    const pitch = roofPitch;",
    test: 'three steps' },
  { file: 'MODEL.html', name: 'bearing on the storey it was drawn on',
    find: "    return i > 0 ? Number(list[i - 1].id) : Number(activeLevelId());",
    with: "    return Number(activeLevelId());",
    test: 'three steps' },
  { file: 'MODEL.html', name: 'not shown on the storey it was drawn on',
    find: "      || (r.drawnOn != null && Number(r.drawnOn) === onActiveLevel().levelId));",
    with: "      || false);",
    test: 'shows on the 2nd floor' },
  { file: 'drawing-format.js', name: 'drawnOn dropped on save',
    find: "        ...(levelId(roof?.drawnOn, levelIds) != null ? { drawnOn: levelId(roof.drawnOn, levelIds) } : {}),",
    with: "",
    test: 'shows on the 2nd floor' },
  { file: 'cut-view.js', name: 'the elevation stands it on the top storey',
    find: "    if (roof.drawnOn != null && roof.sourceLevelId != null) {",
    with: "    if (false) {",
    test: 'MAIN FL plate' },
  { file: 'MODEL.html', name: 'an outline with no eave made anyway',
    find: "    if (!read.some(e => e.kind === 'eave')) {",
    with: "    if (false) {",
    test: 'refused' },
  { file: 'MODEL.html', name: 'Escape leaves the roof half drawn',
    find: "    } else if (event.key === 'Escape') {\n      endShedRoof();",
    with: "    } else if (event.key === 'Escape') {\n      void endShedRoof;",
    test: 'Escape' },
  { file: 'MODEL.html', name: 'a press on the plan leaves the popup up',
    find: "    if (roofPickCard && !roofPickCard.hidden && !shedRoof) roofPickCard.hidden = true;",
    with: "    void shedRoof;",
    test: 'puts the popup away' },
  { file: 'MODEL.html', name: 'the T-square ignored on the wall line',
    find: "    if (s.stage === 'bearing') return s.a ? squareTo(s.a, shedSnap(at)) : shedSnap(at);",
    with: "    if (s.stage === 'bearing') return shedSnap(at);",
    test: 'T-square holds' },
  { file: 'MODEL.html', name: 'the T-square ignored on the outline',
    find: "    return last ? squareTo(last, loopPoint(at)) : loopPoint(at);",
    with: "    return loopPoint(at);",
    test: 'T-square holds' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4506' } });
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
