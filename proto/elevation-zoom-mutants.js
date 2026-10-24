#!/usr/bin/env node
// MUTATION GATE for zoom and pan on an elevation (Movie, 23 Oct): the wheel
// zooms the painter's frame about the cursor, a drag pans it, 0 brings the
// fit back, the readings stay in their gutter, and zooming out stops at
// half the fit. Each row breaks one line, runs the one test that should
// notice, and restores the file from HEAD.
//
//   node proto/elevation-zoom-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/elevation-zoom.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the wheel zooms the plan\'s view under an elevation, as it used to',
    find: "    if (cutNow && elevFrame) {\n",
    with: "    if (false) {\n",
    test: 'wheel zooms' },
  { file: 'MODEL.html',
    name: 'the zoom is not about the cursor',
    find: "        x0: sx - (at.u - elevFrame.uMin) * px,\n",
    with: "        x0: elevFrame.x0,\n",
    test: 'wheel zooms' },
  { file: 'MODEL.html',
    name: '0 does not bring the fit back',
    find: "    elevPin = null; elevPinFor = null;\n    const own = allPoints(wide);\n",
    with: "    const own = allPoints(wide);\n",
    test: 'wheel zooms' },
  { file: 'MODEL.html',
    name: 'the painter is never handed the frame',
    find: "            ...(elevPinned(cut) ? { frame: elevPin } : {}),\n",
    with: "",
    test: 'wheel zooms' },
  { file: 'cut-view.js',
    name: 'a pinned elevation drops its margins, and the readings with them',
    find: "    const marginL = fit ? 0 : mg.left, marginR = fit ? 0 : mg.right,\n      marginT = fit ? 0 : mg.top, marginB = fit ? 0 : mg.bottom;\n",
    with: "    const marginL = fit || pin ? 0 : mg.left, marginR = fit || pin ? 0 : mg.right,\n      marginT = fit || pin ? 0 : mg.top, marginB = fit || pin ? 0 : mg.bottom;\n",
    test: 'wheel zooms' },
  { file: 'MODEL.html',
    name: 'a drag pans the plan\'s view under an elevation',
    find: "    if (panElev(dragging, e.clientX - dragging.sx, e.clientY - dragging.sy)) return;\n",
    with: "",
    test: 'right-button drag pans' },
  { file: 'MODEL.html',
    name: 'zooming out runs on past half the fit',
    find: "      const floor = elevFitPx ? elevFitPx * 0.5 : 0.25;\n",
    with: "      const floor = 0.25;\n",
    test: 'right-button drag pans' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4546' } });
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
