#!/usr/bin/env node
// MUTATION GATE for CROSS GABLE (tests/model-html-roof-edges.spec.js).
//
// Movie, 18 Oct: "its a full gable that extend down to meet the roof in the
// valley (no dormer sidewall/ only a front wall that is aligned with the ext
// perimter wall below".
//
// Run: node proto/model-cross-gable-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-roof-edges.spec.js';
const MUTANTS = [
  { file: 'geometry-2d.js', name: 'the ridge runs in by the width, not by the pitches',
    find: '    const depth = half * pg / pm;\n', with: '    const depth = half;\n', test: 'CROSS GABLE on an eave: centred where clicked on the wall line, its ridge and valleys in plan, its faces standing on the roof' },
  { file: 'geometry-2d.js', name: 'the gable stands at the eave height, not the main roof\'s at the wall line',
    find: '    const lift = (overs[best.i] || 0) * pm / 12;\n', with: '    const lift = 0;\n', test: 'CROSS GABLE on an eave: centred where clicked on the wall line, its ridge and valleys in plan, its faces standing on the roof' },
  { file: 'geometry-2d.js', name: 'a gable face rises at the main pitch',
    find: "    + Math.abs((p.x - face.eave.a.x) * ez - (p.z - face.eave.a.z) * ex) / len * ((face.pitch ?? pitch) || 4) / 12;\n",
    with: "    + Math.abs((p.x - face.eave.a.x) * ez - (p.z - face.eave.a.z) * ex) / len * (pitch || 4) / 12;\n", test: 'CROSS GABLE on an eave: centred where clicked on the wall line, its ridge and valleys in plan, its faces standing on the roof' },
  { file: 'geometry-2d.js', name: 'no faces of its own',
    find: '  const gables = crossGableShapes(roof);\n  if (!gables.length) return cutRoofFaces(faces, roof);\n',
    with: '  const gables = [];\n  if (!gables.length) return cutRoofFaces(faces, roof);\n', test: 'CROSS GABLE on an eave: centred where clicked on the wall line, its ridge and valleys in plan, its faces standing on the roof' },
  { file: 'model/15-panels.js', name: 'a gable wider than its wall goes in anyway',
    find: "    if (crossGableWidthFt > len + 1e-6) return 'That dormer is wider than the wall under this edge.';\n",
    with: '', test: 'CROSS GABLE on an eave: centred where clicked on the wall line, its ridge and valleys in plan, its faces standing on the roof' },
  { file: 'model/15-panels.js', name: 'it goes at the middle of the wall, not where clicked',
    find: '    const t = click ? Math.max(0, Math.min(1, ((click.x - a.x) * ex + (click.z - a.z) * ez) / len2)) : 0.5;\n',
    with: '    const t = 0.5;\n', test: 'CROSS GABLE on an eave: centred where clicked on the wall line, its ridge and valleys in plan, its faces standing on the roof' },
  { file: 'model/15-panels.js', name: 'REMOVE takes nothing off',
    find: '            roof.crossGables = (roof.crossGables || []).filter((_, k) => k !== gi);\n',
    with: '            roof.crossGables = (roof.crossGables || []).slice();\n', test: 'CROSS GABLE on an eave: centred where clicked on the wall line, its ridge and valleys in plan, its faces standing on the roof' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4436' } });
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
