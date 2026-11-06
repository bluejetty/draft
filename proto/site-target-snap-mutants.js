#!/usr/bin/env node
// MUTATION GATE for the registration target and the SITE's roof as snaps
// (tests/site-target-snap.spec.js).
//
// Movie, 26 Oct: "the roof plan doesn't seem to have NODE SNAPS working - i
// really would like the REGISTRATION TARGET to have a node snap so i can
// position the property site plan properly". The seams: the target a node,
// the roof's corners on the SITE, its edges on the SITE, those corners kept
// off the floor plans and the house's corner with them -- and, since 6 Nov
// ("i thought the gold node target had SNAP with orange pulse earlier but
// not snapping now?"), the target PAINTED is the one that catches, so a SITE
// or a floor plan with no house behind the target still catches on it.
//
// Run: node proto/site-target-snap-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/site-target-snap.spec.js';

const MUTANTS = [
  { file: 'model/07-walls-magnet.js',
    name: 'the target is no node',
    find: "    if (target && Number.isFinite(target.x) && Number.isFinite(target.z)) out.push({ x: target.x, y: 0, z: target.z });\n",
    with: "",
    test: 'the registration target catches a point exactly' },
  { file: 'model/07-walls-magnet.js',
    name: 'the SITE has no roof corners',
    find: "    (drawing.roofs || []).forEach(r => (r?.points || []).forEach(p => {\n      if (p && Number.isFinite(p.x) && Number.isFinite(p.z)) out.push(p);\n    }));\n",
    with: "",
    test: 'on the SITE the roof\'s corners catch a point exactly' },
  { file: 'model/07-walls-magnet.js',
    name: 'the SITE has no roof edges',
    find: "...loopEdges(), ...siteRoofEdges()])] };",
    with: "...loopEdges()])] };",
    test: 'on the SITE the roof\'s edges are lines to land on' },
  { file: 'model/07-walls-magnet.js',
    name: 'the roof\'s corners catch on every level',
    find: "    if (!onSite) return out;\n",
    with: "",
    test: 'a roof on the ROOF level is no node on the MAIN FL' },
  { file: 'model/07-walls-magnet.js',
    name: 'the house\'s corner is a node on a floor plan too',
    find: "    const target = onSite || !siteDatumNow() ? gridDatum() : null;\n",
    with: "    const target = gridDatum();\n",
    test: 'on a floor plan the target is no node of its own' },
  // Movie, 6 Nov: the target painted on a SITE with no house caught nothing.
  { file: 'model/07-walls-magnet.js',
    name: 'the node is the house\'s corner, not the target painted',
    find: "    const target = onSite || !siteDatumNow() ? gridDatum() : null;\n",
    with: "    const target = onSite || !siteDatumNow() ? siteDatumNow() : null;\n",
    test: 'with no house' },
  { file: 'model/07-walls-magnet.js',
    name: 'a target that is no wall\'s corner is no node on a floor plan',
    find: "    const target = onSite || !siteDatumNow() ? gridDatum() : null;\n",
    with: "    const target = onSite ? gridDatum() : null;\n",
    test: 'on a floor plan with no house the painted target is a node' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4731' } });
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
