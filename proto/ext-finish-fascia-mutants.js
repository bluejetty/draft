#!/usr/bin/env node
// MUTATION GATE for the fascia finish and the SEAM RULE (jb, 13 Nov 2026):
// FASCIA on the ROOF area of EXT. FINISH (PFM default, stored as nothing),
// a click on a fascia band picks its roof, and in the painter no line where
// two surfaces in one plane wear one finish -- a flush wall under its
// fascia, a storey over a storey -- and a line where they differ.
//
// Run: node proto/ext-finish-fascia-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/ext-finish-fascia.spec.js'];
const STORE = 'the ROOF area offers FASCIA, PFM first; PFM is stored as nothing and a choice as a word';
const PICK = 'a click on a fascia band picks its roof, the way a click on a wall picks the wall';
const EAVE = 'the seam rule at the eave: no foot line where a flush wall wears the fascia\'s finish';
const FLOOR = 'the seam rule at the floor: one skin over and under a floor band has no plate line, two skins keep it';
const MUTANTS = [
  { file: 'drawing-format.js', name: 'the format drops fasciaFinish on the way past', spec: SPECS[0],
    find: "          ? { fasciaFinish: roof.fasciaFinish } : {}),",
    with: "          ? {} : {}),",
    test: STORE },
  { file: 'EXTFINISH.html', name: 'PFM is stored as the word, not as nothing', spec: SPECS[0],
    find: "        writeRoof({ fasciaFinish: event.target.value === WT.DEFAULT_FASCIA_FINISH_ID\n          ? null : event.target.value }));",
    with: "        writeRoof({ fasciaFinish: event.target.value }));",
    test: STORE },
  { file: 'EXTFINISH.html', name: 'the select never shows what the roof wears', spec: SPECS[0],
    find: "        document.getElementById('fascia-finish').value = WT.fasciaFinishIdOf(roof);",
    with: "        document.getElementById('fascia-finish').value = WT.DEFAULT_FASCIA_FINISH_ID;",
    test: STORE },
  { file: 'EXTFINISH.html', name: 'a click never lands on a fascia band', spec: SPECS[0],
    find: "        const band = fasciaAt(u, e);\n        if (band) return { fascia: band };",
    with: "        const band = null;\n        if (band) return { fascia: band };",
    test: PICK },
  { file: 'cut-view.js', name: 'the painter hands out no fascia bands', spec: SPECS[0],
    find: "                if (opts && Array.isArray(opts.fasciaBands)) {\n                  shownFeet.forEach(f => opts.fasciaBands.push({",
    with: "                if (false) {\n                  shownFeet.forEach(f => opts.fasciaBands.push({",
    test: PICK },
  { file: 'cut-view.js', name: 'the seam rule at the eave is off: every foot is lined', spec: SPECS[0],
    find: "                  && sameSkin(skinOf(g.face.wall), fasciaSkin));",
    with: "                  && false);",
    test: EAVE },
  { file: 'cut-view.js', name: 'the eave rule is blind to the finish: any flush wall drops the line', spec: SPECS[0],
    find: "                  && sameSkin(skinOf(g.face.wall), fasciaSkin));",
    with: "                  && true);",
    test: EAVE },
  { file: 'cut-view.js', name: 'the eave rule is blind to the overhang: a wall 2 ft in is \"flush\"', spec: SPECS[0],
    find: "  const FLUSH_FT = 0.6;",
    with: "  const FLUSH_FT = 60;",
    test: EAVE },
  { file: 'cut-view.js', name: 'the eave rule is blind to the wall\'s head: a wall stopping short is \"flush\"', spec: SPECS[0],
    find: "                  && Math.abs(topAtU(g, u) - footE) < 0.1\n",
    with: "                  && true\n",
    test: EAVE },
  { file: 'wall-types.js', name: 'a roof\'s fasciaFinish is never read: every fascia is PFM', spec: SPECS[0],
    find: "    ? roof.fasciaFinish : DEFAULT_FASCIA_FINISH_ID;",
    with: "    ? DEFAULT_FASCIA_FINISH_ID : DEFAULT_FASCIA_FINISH_ID;",
    test: EAVE },
  { file: 'cut-view.js', name: 'the seam rule at the floor is off: the plate line is always drawn', spec: SPECS[0],
    find: "        || rimBands.some(band => band.oneSkin",
    with: "        || rimBands.some(band => false",
    test: FLOOR },
  { file: 'cut-view.js', name: 'the floor rule is blind to the skins: any band drops the plate line', spec: SPECS[0],
    find: "      return new Set([...above, ...below]).size === 1 ? above[0] : null;",
    with: "      return above[0];",
    test: FLOOR },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: process.env.DRAFT_TEST_PORT || '4464' } });
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
