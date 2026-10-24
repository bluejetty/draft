#!/usr/bin/env node
// MUTATION GATE for the clipped gable and the elevation fit (Movie, 23 Oct):
// the 45 wall climbs from its corner, the corner is a crease to the rake,
// the rest of the gable is filled as a wall, and EXT. FINISH and MODEL fit
// the whole building with its level marks and a tenth of air. Each row
// breaks one line, runs the one test that should notice, and restores the
// file from HEAD. The painter rows are also in proto/elevation-harness.js's
// own MUTATIONS, where CI runs them offline; here they are read off the page.
//
//   node proto/clipped-gable-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/clipped-gable.spec.js';

const MUTANTS = [
  { file: 'cut-view.js',
    name: 'a wall under a rake is measured to the rake\'s ends, not its line',
    find: "            return along >= -reach && along <= gLen + reach && off <= reach;\n",
    with: "            return distToSegment(pt, a, b) <= reach;\n",
    test: 'plumb crease' },
  { file: 'cut-view.js',
    name: 'a corner where both walls climb is still capped at the plate',
    find: "          top = Math.max(top, Math.min(own, end.top));\n",
    with: "",
    test: 'plumb crease' },
  { file: 'cut-view.js',
    name: 'no gable infill under a rake with nothing standing under it',
    find: "    gableInfills().forEach(g => faceGeoms.push(g));\n",
    with: "",
    test: 'rest of the gable' },
  { file: 'cut-view.js',
    name: 'the infill is painted as if it stood where the wall behind it does',
    find: "          const depth = mid.x * dir.x + mid.z * dir.z;\n",
    with: "          const depth = -Infinity;\n",
    test: 'rest of the gable' },
  { file: 'cut-view.js',
    name: 'the cushion is ignored',
    find: "    return Number.isFinite(asked) && asked > 0 ? Math.min(asked, 0.45) : 0;\n",
    with: "    return 0;\n",
    test: 'EXT. FINISH fits' },
  { file: 'EXTFINISH.html',
    name: 'EXT. FINISH asks for no cushion',
    find: "      const ELEVATION_CUSHION = 0.1;\n",
    with: "      const ELEVATION_CUSHION = 0;\n",
    test: 'EXT. FINISH fits' },
  { file: 'EXTFINISH.html',
    name: 'EXT. FINISH fits the drawing itself again, with no gutter for the marks',
    find: "          { colors, finishes: true, cushion: ELEVATION_CUSHION,\n",
    with: "          { colors, finishes: true, cushion: ELEVATION_CUSHION, margins: { left: 0, right: 0, top: 0, bottom: 0 },\n            pxPerFt: Math.max(2, Math.min((canvas.width - 28) / 91, (canvas.height - 28) / 36)), extents: CV.cutViewExtents(env, cut),\n",
    test: 'EXT. FINISH fits' },
  { file: 'MODEL.html',
    name: 'MODEL asks for no cushion',
    find: "          { margins: rails, cushion: 0.1, colors: window.DraftCutView.inksFromSkin(skin),\n",
    with: "          { margins: rails, colors: window.DraftCutView.inksFromSkin(skin),\n",
    test: 'MODEL\'s E3 fits' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4545' } });
    return 'passed';
  } catch { return 'failed'; }
};

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`, { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(2);
}

console.log(`baseline: ${run()}`);
let caught = 0;
for (const m of MUTANTS) {
  const p = `${ROOT}/${m.file}`;
  const src = fs.readFileSync(p, 'utf8');
  if (!src.includes(m.find)) {
    console.log(`SKIPPED (anchor not found): ${m.name}`);
    continue;
  }
  fs.writeFileSync(p, src.replace(m.find, m.with));
  const result = run(m.test);
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  const ok = result === 'failed';
  if (ok) caught += 1;
  console.log(`${ok ? 'CAUGHT ' : 'SURVIVED'}  ${m.name}`);
}
console.log(`\n${caught}/${MUTANTS.length} mutants caught`);
process.exit(caught === MUTANTS.length ? 0 : 1);
