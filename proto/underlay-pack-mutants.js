#!/usr/bin/env node
// MUTATION GATE for underlay pictures riding in the .draft (Movie, 25 Oct:
// "can it save the jpg within the file so when the user reopens the jpg is
// already loaded" -- "Always pack them in").
//
//   node proto/underlay-pack-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/underlay-pack.spec.js';

const MUTANTS = [
  { file: 'model/17-boot-save.js',
    name: 'the download carries no pictures',
    find: "      if (download) await downloadDrawing(await withUnderlayFiles(contents), download, handle);",
    with: "      if (download) await downloadDrawing(contents, download, handle);",
    test: 'packs the picture' },
  { file: 'model/17-boot-save.js',
    name: 'OPEN leaves the pictures in the file',
    find: "      if (file && (await adoptAndShow(await unpackUnderlayFiles(file)))) setRail('right', true);",
    with: "      if (file && (await adoptAndShow(file))) setRail('right', true);",
    test: 'packs the picture' },
  { file: 'model/17-boot-save.js',
    name: 'the packed copy rides on into the drawing',
    find: "    delete parsed.underlayFiles;\n",
    with: "",
    test: 'packs the picture' },
  { file: 'model/17-boot-save.js',
    name: 'a drawing with no pictures still gets the key',
    find: "    if (!Object.keys(packed).length) return contents;",
    with: "    if (false) return contents;",
    test: 'no underlays saves as it always did' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4634' } });
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
