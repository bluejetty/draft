#!/usr/bin/env node
// MUTATION GATE for DORMER (tests/model-html-dormer.spec.js).
//
// Movie, 18 Oct: "can we make a DORMER command in the BUILD tab?" -- "we will
// start with the full dormer with only front wall like on the NORTH POINT
// roof plan".
//
// Run: node proto/model-dormer-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-dormer.spec.js';
const MUTANTS = [
  { file: "tool-roster.js", name: "no DORMER key",
    find: "    { id: 'dormer',       name: 'DORMER',       group: 'build', kind: 'contextual', command: null },\n",
    with: "",
    test: "DORMER is a key in the BUILD tab; armed, its panel has the type, a 40' width and 4/12" },
  { file: "MODEL.html", name: "DORMER arms no panel",
    find: "    if (tool === 'dormer') { showDormerProps(); return; }\n",
    with: "",
    test: "DORMER is a key in the BUILD tab; armed, its panel has the type, a 40' width and 4/12" },
  { file: "MODEL.html", name: "a click places nothing",
    find: "    if (activeTool === 'dormer') { dormerPress(at); return; }\n",
    with: "",
    test: "a click on the front eave puts a 40' 4/12 dormer there, on the wall line; the next takes the width typed; one UNDO each" },
  { file: "MODEL.html", name: "a dormer is not kept on its wall",
    find: "    const tc = Math.max(halfT, Math.min(1 - halfT, t));\n",
    with: "    const tc = t;\n",
    test: "a click on the front eave puts a 40' 4/12 dormer there, on the wall line; the next takes the width typed; one UNDO each" },
  { file: "MODEL.html", name: "a dormer goes on a gable edge",
    find: "    if (hit.roof.edges?.[hit.index] === 'gable') { sayOnStrip('DORMER \u2014 that edge is a GABLE; a dormer stands on an EAVE.'); return; }\n",
    with: "",
    test: "a GABLE edge and the open sheet are refused, nothing placed" },
  { file: "MODEL.html", name: "SITE offers no roof to the dormer",
    find: "    pickRoofs().forEach(roof => {\n      if (hit) return;",
    with: "    roofs().forEach(roof => {\n      if (hit) return;",
    test: "from the SITE plan too" },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4438' } });
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
