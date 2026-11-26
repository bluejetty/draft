#!/usr/bin/env node
// MUTATION GATE for the siding gaps (jb, 26 Nov 2026): one coursing up the
// house, the seam rule reading BANDS, a band reaching the plate carried up the
// gable, the straight rake outline, STUCCO DARK, the gable pick and the band
// held to the wall's head. tests/ext-finish-siding-gaps.spec.js.
//
// Run: node proto/ext-finish-siding-gaps-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

// LITERALS IN THE TABLE, not constants: proto/mutant-anchors-harness.js reads
// the MUTANTS table on its own, with nothing else of this file defined.
const SPECS = ['tests/ext-finish-siding-gaps.spec.js'];
const MUTANTS = [
  { file: "cut-view.js", name: "a band reaching the plate stops there: the gable stays plain", spec: 'tests/ext-finish-siding-gaps.spec.js',
    find: "      return span && span.lo < lines.plate - CARRY_EPS_FT && span.hi >= lines.plate - CARRY_EPS_FT\n        ? { ...band, toTop: true } : band;",
    with: "      return band;",
    test: "the gable: a band that reaches the plate fills the triangle" },
  { file: "cut-view.js", name: "only a band typed exactly to the plate carries on", spec: 'tests/ext-finish-siding-gaps.spec.js',
    find: "  const CARRY_EPS_FT = 0.5;",
    with: "  const CARRY_EPS_FT = 0.02;",
    test: "the gable: a band that reaches the plate fills the triangle" },
  { file: "cut-view.js", name: "the seam rule reads the base finish again, bands ignored", spec: 'tests/ext-finish-siding-gaps.spec.js',
    find: "    if (!finishAtFt || !lines) return skinOf(wall);",
    with: "    return skinOf(wall);",
    test: "a stucco board over a vinyl BAND keeps its foot line" },
  { file: "cut-view.js", name: "each storey courses off its own sill again", spec: 'tests/ext-finish-siding-gaps.spec.js',
    find: "        ...(courseFrom != null && lo <= lines.sill + 0.05 ? { courseFrom } : {}),",
    with: "        ...({}),",
    test: "the floor line: one coursing up the house, no strip without a course" },
  { file: "finish-patterns.js", name: "the lap pattern ignores the house datum", spec: 'tests/ext-finish-siding-gaps.spec.js',
    find: "    if (!Number.isFinite(box.courseFrom)) return { y: box.yBottom - step, row: 0 };",
    with: "    return { y: box.yBottom - step, row: 0 };",
    test: "the floor line: one coursing up the house, no strip without a course" },
  { file: "cut-view.js", name: "every outline station is drawn: the pixel stair is back", spec: 'tests/ext-finish-siding-gaps.spec.js',
    find: "          if ([...pending, i].every(j => onChord(kept, next, silhouette[j]))) pending.push(i);",
    with: "          if (false) pending.push(i);",
    test: "the rake: the outline up a straight rake is one straight line, not a pixel stair" },
  { file: "finish-patterns.js", name: "stucco dark draws nothing", spec: 'tests/ext-finish-siding-gaps.spec.js',
    find: "    stipple: (ctx, box, finish) => {\n",
    with: "    stipple: (ctx, box, finish) => { return;\n",
    test: "STUCCO DARK stipples, plain STUCCO stays blank, and they are two skins" },
  { file: "EXTFINISH.html", name: "a wall is picked only up to its plate", spec: 'tests/ext-finish-siding-gaps.spec.js',
    find: "          if (e < g.foot || e > (g.outlines ? topOfPick(g, u) : g.head)) continue;",
    with: "          if (e < g.foot || e > g.plate) continue;",
    test: "a click in the gable triangle picks the wall under it" },
  { file: "EXTFINISH.html", name: "ADD BAND stores any TO, however tall", spec: 'tests/ext-finish-siding-gaps.spec.js',
    find: "        const toTop = Number.isFinite(room) && highFt >= room - 0.01;",
    with: "        const toTop = false;",
    test: "a click in the gable triangle picks the wall under it" },
  { file: "EXTFINISH.html", name: "the top nudge runs past the wall", spec: 'tests/ext-finish-siding-gaps.spec.js',
    find: "            if (by > 0 && Number.isFinite(at) && at + next >= lines.head - 0.01) {",
    with: "            if (false) {",
    test: "nudging a band" },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: process.env.DRAFT_TEST_PORT || '4465' } });
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
  let result = run(m.test, m.spec);
  let note = '';
  if (result === 'passed' && run(null, m.spec) === 'failed') {
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
