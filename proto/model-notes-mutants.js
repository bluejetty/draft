#!/usr/bin/env node
// MUTATION GATE for the NOTES pad's SAVE AS TXT and grab spots
// (tests/model-html-notes.spec.js).
//
// Movie, 18 Oct: "a 'SAVE AS TXT FILE' ... in location where they save their
// DRAFT files as a backup" -- and "add 3 'grab spots on the edges ... allow
// them to fill basically half the page".
//
// Run: node proto/model-notes-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-notes.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: "the download path says nothing",
    find: "    setTimeout(() => URL.revokeObjectURL(url), 0);\n    sayWhereItWent(file.name);\n  };\n  document.querySelector('[data-notes-save-txt]')",
    with: "    setTimeout(() => URL.revokeObjectURL(url), 0);\n  };\n  document.querySelector('[data-notes-save-txt]')",
    test: "SAVE AS TXT downloads the pad as a .txt where there is no save dialog, and the chip says where" },
  { file: 'MODEL.html', name: "the dialog does not open beside the .draft",
    find: "          ...(lastSaveHandle ? { startIn: lastSaveHandle } : {}),\n",
    with: "",
    test: "with a save dialog, it opens beside the last .draft saved and writes the text there" },
  { file: 'MODEL.html', name: "the .draft handle is not kept",
    find: "      return lastSaveHandle = await window.showSaveFilePicker({",
    with: "      return await window.showSaveFilePicker({",
    test: "with a save dialog, it opens beside the last .draft saved and writes the text there" },
  { file: 'MODEL.html', name: "no stop at the middle of the page",
    find: "      const maxW = Math.max(minW, window.innerWidth / 2 - right);\n",
    with: "      const maxW = window.innerWidth;\n",
    test: "the pad pulls out by its left, top and bottom edges, to the right half of the page; LEVELS keeps its width; a reload keeps the size" },
  { file: 'MODEL.html', name: "LEVELS takes the pad size too",
    find: "    const on = pane === 'notes' && notesSize;\n",
    with: "    const on = notesSize;\n",
    test: "the pad pulls out by its left, top and bottom edges, to the right half of the page; LEVELS keeps its width; a reload keeps the size" },
  { file: 'MODEL.html', name: "the size is forgotten on a reload",
    find: "        try { localStorage.setItem('draft.notepad.size', JSON.stringify(notesSize)); } catch (err) {}\n",
    with: "",
    test: "the pad pulls out by its left, top and bottom edges, to the right half of the page; LEVELS keeps its width; a reload keeps the size" },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4441' } });
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
