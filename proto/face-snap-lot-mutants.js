#!/usr/bin/env node
// MUTATION GATE for the wall-face snap and the lot card's typed sizes and
// second opening (tests/wall-face-snap.spec.js, tests/model-site-lot-typed.spec.js).
//
// Movie, 18 Oct: "can i make the EXT WALL corner nodes (on the outline wall
// lines) ... so i can reference that edge of wall" -- "allow 3/8" 11/16" etc
// as well as 50-6" 50'6" 50.5'" -- "double clicks on the site property line
// or the site layout view window ... bring up the ... SITE PLAN ... popup".
//
// Run: node proto/face-snap-lot-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/wall-face-snap.spec.js tests/model-site-lot-typed.spec.js tests/snap-track.spec.js';
const MUTANTS = [
  { file: "model/07-walls-magnet.js", name: "no face corners in the snap",
    find: "    if (!G?.wallFaceCorners || !drawing) return [];\n",
    with: "    return [];\n",
    test: "a LINE started a hair off the outside corner of two 2x6 walls starts ON it" },
  // CAUGHT BY THE INSIDE-CORNER TEST, not the outside corner's: with the
  // corner cut, TRACK's cross lines from the free ends' face points still
  // meet at the outside corner and the press lands there anyway.
  { file: "geometry-2d.js", name: "the crossings are cut short of the outside corner",
    find: "            if (Math.hypot(p.x - v.x, p.z - v.z) <= (f.t + g.t) * 1.5) add(p);\n",
    with: "            if (Math.hypot(p.x - v.x, p.z - v.z) <= Math.max(f.t, g.t) * 0.5) add(p);\n",
    test: "and the inside corner, and a free end's face" },
  { file: "geometry-2d.js", name: "a free end gives no face points",
    find: "          f.offs.forEach(o => add({ x: v.x + f.n.x * o, z: v.z + f.n.z * o }));\n          return;\n        }\n        others.forEach",
    with: "          return;\n        }\n        others.forEach",
    test: "and the inside corner, and a free end's face" },
  { file: "model/07-walls-magnet.js", name: "ROOF PLAN offers no wall tops",
    find: "    const segs = (own.length ? own : (activeLevelId() === ROOF_LEVEL_ID && G.roofPlanWalls\n",
    with: "    const segs = (own.length ? own : (false && G.roofPlanWalls\n",
    test: "on ROOF PLAN, the outside corner of the wall tops drawn there" },
  { file: "model/10-tracking-garage.js", name: "the lot boxes read whole feet only",
    find: "    const parsed = window.DraftFormatters.parseArchitecturalLength(value);\n    return parsed.ok ? parsed.inches / 12 : NaN;\n",
    with: "    return Number(value);\n",
    test: "the lot boxes take feet and inches -- 895-2 3/8, 50'6\", 50-6\", 50.5' -- to the sixteenth" },
  { file: "lot-sizes.js", name: "a typed lot is rounded to the inch",
    find: "    const toInch = value => (metric ? Math.round(value * 12) / 12 : Math.round(value * 192) / 192);\n",
    with: "    const toInch = value => Math.round(value * 12) / 12;\n",
    test: "the lot boxes take feet and inches -- 895-2 3/8, 50'6\", 50-6\", 50.5' -- to the sixteenth" },
  { file: "model/10-tracking-garage.js", name: "a redrawn lot is added beside the old one",
    find: "    if (was) {\n      // ONE UNDO PUTS THE OLD LOT BACK, size and all.\n",
    with: "    if (false) {\n      // ONE UNDO PUTS THE OLD LOT BACK, size and all.\n",
    test: "a double-click on the property line opens the card on the lot's own size; swapped and redrawn it REPLACES the lot; one UNDO puts it back" },
  { file: "model/10-tracking-garage.js", name: "the property line opens nothing",
    find: "    if (hit && hit.site) reopenLot();\n",
    with: "",
    test: "a double-click on the property line opens the card on the lot's own size; swapped and redrawn it REPLACES the lot; one UNDO puts it back" },
  { file: "model/10-tracking-garage.js", name: "the SITE PLAN seat opens nothing",
    find: "    setTimeout(() => { if (lotOnSite()) reopenLot(); }, 0);\n",
    with: "",
    test: "a double-click on the SITE PLAN seat opens it too, and NOT NOW leaves the lot as it was" },
  { file: "model/10-tracking-garage.js", name: "NOT NOW does not put the card away",
    find: "      lotAsked = true;\n      lotReopen = false;\n",
    with: "      lotAsked = true;\n",
    test: "a double-click on the SITE PLAN seat opens it too, and NOT NOW leaves the lot as it was" },
  { file: "model/07-walls-magnet.js", name: "a face corner beats the wall's own node",
    find: "    return cornerUnderHand(at, nodes, corners)?.v || nearest(nodes)\n      || strongerPoint(at, nodes, corners)?.v || null;\n",
    with: "    return nearest(nodeEnds());\n",
    test: "SNAP: a press near a wall end lands exactly on it, and the orange donut marks it first" },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4442' } });
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
