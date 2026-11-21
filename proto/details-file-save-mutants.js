// DOES THE SPEC CATCH A SAVE DETAILS FILE THAT SAVES THE WRONG THING?
//
// jb, 21 Nov 2026: "when i'm in a house plan can i save the DETAIL.draft
// file seperately (and allow rename and send to email address)". Every
// mutant below still says SAVED or SENT on the panel: the house written in
// place of the library, the old name kept inside a renamed file, a bone
// taken for a send that failed, none taken at all, a refusal that writes
// anyway.
//
// THE TABLE IS PLAIN DATA: proto/mutant-anchors-harness.js reads it without
// running this file.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED
// when the spec fails, so a spec that is already red kills everything.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/details-file-save.spec.js';

const MUTANTS = [
  { file: 'model/22-details-strip.js',
    name: 'the HOUSE is written in place of the library: a .draft named DETAILS that opens as a house',
    find: '      const text = await detailsFileText(stem);\n      if (!text) { fileSay(\'Load a DETAILS file first.\', \'error\'); return false; }\n      await downloadDrawing(text, name, handle);',
    with: '      const text = JSON.stringify(serializeDrawing({ trim: false }));\n      await downloadDrawing(text, name, handle);',
    test: 'to the computer' },

  { file: 'model/22-details-strip.js',
    name: 'the rename is the file\'s only: inside it is still DETAILS-LIBRARY, and it LOADs back under the old name',
    find: '    if (stem) lib.detailsLibrary = stem;\n',
    with: '',
    test: 'to the computer' },

  { file: 'model/22-details-strip.js',
    name: 'the typed name is ignored: the file goes out as the library\'s own name',
    find: '    const name = `${stem}.draft`;\n    const handle = await pickSaveTarget(name);',
    with: '    const name = linkedDetails().name;\n    const handle = await pickSaveTarget(name);',
    test: 'to the computer' },

  { file: 'model/22-details-strip.js',
    name: 'the computer save is free',
    find: "    spendToll('saveToComputer');\n",
    with: '',
    test: 'to the computer' },

  { file: 'model/22-details-strip.js',
    name: 'short of a bone it is written anyway',
    find: "    const toll = fileToll('saveToComputer');\n    if (bonesHeldNow() < toll) {",
    with: "    const toll = fileToll('saveToComputer');\n    if (false) {",
    test: 'short of a bone' },

  { file: 'model/22-details-strip.js',
    name: 'the bone is taken before the mail goes, so a refused send still costs one',
    find: "      const parts = await mail.sendFile({ to: fileBox.to, name, progress: fileSay,",
    with: "      spendToll('emailBackup');\n      const parts = await mail.sendFile({ to: fileBox.to, name, progress: fileSay,",
    test: 'EMAIL IT' },

  { file: 'model/22-details-strip.js',
    name: 'the email is free',
    find: "      spendToll('emailBackup');\n      fileSay(parts > 1",
    with: "      fileSay(parts > 1",
    test: 'EMAIL IT' },

  { file: 'backup-email.js',
    name: 'the mail goes out as the invoice book (app bluejetty), which the worker refuses from this site',
    find: "    const body = JSON.stringify({ app: APP, email: to, filename: piece.filename, dataUrl: await asDataUrl(piece.blob) });",
    with: "    const body = JSON.stringify({ app: 'bluejetty', email: to, filename: piece.filename, dataUrl: await asDataUrl(piece.blob) });",
    test: 'EMAIL IT' },

  { file: 'model/22-details-strip.js',
    name: 'the price line never moves after a bone is spent',
    find: "      line.textContent = `Computer ${tollWord(fileToll('saveToComputer'))}, email ${tollWord(fileToll('emailBackup'))} (you have ${bonesHeldNow()}).`;",
    with: "      void line;",
    test: 'to the computer' },
];

const FILES = [...new Set(MUTANTS.map(m => m.file))];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4396' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it.
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`,
  { cwd: ROOT }).toString().trim();
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
  // UNIQUE OR NOT AT ALL: an anchor that matches twice mutates the first
  // match, which may not be the call site the mutant is named for.
  if (before.split(m.find).length !== 2) {
    console.log(`  SKIPPED   ${m.name}  (anchor ${before.includes(m.find) ? 'matches more than once' : 'not found'} — re-aim \`find\`)`);
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
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}

// READ AGAINST WHAT WAS DEFINED, never on its own.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
