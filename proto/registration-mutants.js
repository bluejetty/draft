#!/usr/bin/env node
// MUTATION GATE for the REGISTRATION box (tests/model-registration.spec.js).
//
// Movie, 28 Oct: "in the lower right where it says 'drag to pan wheel to
// zoom' i'd like to have a little box with the 2 targets gold and green and
// the word REGISTRATION. and then it will have setback as one textbox and
// sideyard as the other" -- and "show the different site plans on which
// holograms / file and they can checkbox the one they want to use".
//
// Run: node proto/registration-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-registration.spec.js';

const MUTANTS = [
  { file: 'model/10-tracking-garage.js',
    name: 'the box shows on every level',
    find: "    const onSite = activeLevelId() === SITE_LEVEL_ID && !boneyardActive;\n",
    with: "    const onSite = !boneyardActive;\n",
    test: 'not on a floor plan' },
  { file: 'model/10-tracking-garage.js',
    name: 'the setback is read across, not back',
    find: "      setback: along(green, front) - along(gold, front),\n",
    with: "      setback: along(green, left) - along(gold, left),\n",
    test: 'on SITE the box shows both targets' },
  { file: 'model/10-tracking-garage.js',
    name: 'the house moves instead of the lot',
    find: "    gap.lot.points.forEach(pt => { pt.x += dir.x * by; pt.z += dir.z * by; });\n",
    with: "    drawing.walls.forEach(w => [w.start, w.end].forEach(pt => { pt.x -= dir.x * by; pt.z -= dir.z * by; }));\n",
    test: 'typing a SETBACK slides the lot forward' },
  { file: 'model/10-tracking-garage.js',
    name: 'no UNDO for a typed setback',
    find: "    undoStack.push({ kind: 'node', undo: () => {\n      lot.points.forEach((pt, i) => Object.assign(pt, before[i]));\n    } });\n",
    with: "",
    test: 'typing a SETBACK slides the lot forward' },
  { file: 'model/10-tracking-garage.js',
    name: 'metric is read as feet',
    find: "      return Number.isFinite(m) ? m / 0.3048 : NaN;\n",
    with: "      return Number.isFinite(m) ? m : NaN;\n",
    test: 'metric drawings read and take metres' },
  { file: 'model/10-tracking-garage.js',
    name: 'USE leaves the hologram\'s line on -- two lines',
    find: "    drawing.siteLots = { ...(drawing.siteLots || {}), own: true, [l.key]: false };\n",
    with: "    drawing.siteLots = { ...(drawing.siteLots || {}), own: true };\n",
    test: 'a hologram\'s lot is listed with its box' },
  { file: 'hologram.js',
    name: 'a hologram\'s lot line draws with its box off',
    find: "LP.drawPlan(ink, place, lotLess(holo, saved, split.existing, levelId), levelId,",
    with: "LP.drawPlan(ink, place, split.existing, levelId,",
    test: 'a hologram\'s lot is listed with its box' },
  { file: 'hologram.js',
    name: 'the copy lands where the hologram\'s lot is in ITS file, not here',
    find: "        points: placed(holo, lot.points), size: holo.source?.lot || null });\n",
    with: "        points: lot.points, size: holo.source?.lot || null });\n",
    test: 'a hologram\'s lot is listed with its box' },
  { file: 'layout-plan.js',
    name: 'the own box off still draws this file\'s lot',
    find: "    const lot = saved?.siteLots?.own === false ? null\n      : outlines.find(item => item.site === true) || null;\n",
    with: "    const lot = outlines.find(item => item.site === true) || null;\n",
    test: 'the own box off' },
  // ALIGN SITE PLAN GREEN REGISTRATION MARKS, and only for some (Movie,
  // 28 Oct: "the suites i don't want aligned that way").
  { file: 'model/10-tracking-garage.js',
    name: 'ALIGN moves nothing',
    find: "      holo.x = (Number(holo.x) || 0) + dx;\n      holo.z = (Number(holo.z) || 0) + dz;\n",
    with: "",
    test: 'ALIGN SITE PLAN GREEN REGISTRATION MARKS slides each hologram' },
  { file: 'model/10-tracking-garage.js',
    name: 'with no lot of its own, the first site plan is the mark, checked or not',
    find: "    const pick = lots.find(l => l.shown) || lots[0];\n",
    with: "    const pick = lots[0];\n",
    test: 'with no lot of its own' },
  { file: 'model/10-tracking-garage.js',
    name: 'a suite aligns by default',
    find: "    return !window.DraftHologram.isSuite(first);\n",
    with: "    return true;\n",
    test: 'the TYPES list' },
  { file: 'model/10-tracking-garage.js',
    name: 'the TYPES box is ignored',
    find: "    alignHolograms(holo => typeAligns(window.DraftHologram.fileOf(holo)));\n",
    with: "    alignHolograms(() => true);\n",
    test: 'the TYPES list' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'a card\'s ALIGN aligns every file',
    find: "alignHolograms(holo => H().fileOf(holo) === key);",
    with: "alignHolograms(() => true);",
    test: 'a hologram card' },
  { file: 'model.css',
    name: 'the box goes under the side panel',
    find: "  #registration { position:fixed; right:12px; bottom:calc(var(--readout-bottom) + 20px);\n    z-index:7;",
    with: "  #registration { position:fixed; right:12px; bottom:calc(var(--readout-bottom) + 20px);\n    z-index:4;",
    test: 'the box sits ON TOP' },
  // "can the corners of the site plan (and the lower right corner with the
  // green target) all have snap nodes on the hologram site plan" (28 Oct).
  { file: 'model/02-holograms-tags.js',
    name: 'a hologram\'s lot line is not its wall on SITE',
    find: "      .filter(w => w?.start && w?.end), ...hologramLotHere(holo)] : []);",
    with: "      .filter(w => w?.start && w?.end)] : []);",
    test: 'on SITE a hologram is picked by its lot line' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'a hologram is not taken by its corners',
    find: "    entries.filter(e => e.type === 'hologram').forEach(({ item }) => hologramCorners(item)\n      .forEach(v => pts.push({ x: v.x, z: v.z, node: true })));\n",
    with: "",
    test: 'on SITE a hologram is picked by its lot line' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4805' } });
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
