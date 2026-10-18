#!/usr/bin/env node
// MUTATION GATE for the NOTES pad (tests/model-html-notes.spec.js).
//
// Movie, 16-17 Oct: "a 'notepad' that can open up as a tab under the
// LEVELS/LAYERS tab ... that blue sticky pad look" -- "save with the draft,
// and also when a user starts a new plan, keep the notes still there ... add
// a CLEAR button ... keep those notes always in there as long as possible
// unless the user presses CLEAR". Each row breaks one of those promises and
// asks the spec that makes it whether it noticed.
//
// Run: node proto/model-notes-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-notes.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the pad is not a pane: NOTES opens nothing',
    find: "  const PANES = ['levels', 'notes'];\n",
    with: "  const PANES = ['levels'];\n",
    test: 'it opens and shuts like the LEVELS tab, and swaps with it on the same rail' },
  { file: 'MODEL.html',
    name: 'the tab sits on LEVELS / LAYERS instead of under it',
    find: "    if (above.height) notesTab.style.top = `${Math.round(above.bottom + 8)}px`;\n",
    with: "    if (above.height) notesTab.style.top = `${Math.round(above.top)}px`;\n",
    test: 'NOTES hangs under LEVELS / LAYERS on the right edge: a blue sticky pad, dark lettering' },
  { file: 'MODEL.html',
    name: 'the ROUGH pad is not blue',
    find: "  :root { --pad: #d6e9f8;",
    with: "  :root { --pad: #ffffff;",
    test: 'NOTES hangs under LEVELS / LAYERS on the right edge: a blue sticky pad, dark lettering' },
  { file: 'MODEL.html',
    name: 'the notes never reach the .draft',
    find: "    if (text) drawing.notepad = text;\n",
    with: "    if (text) void 0;\n",
    test: 'typing goes on the pad, not to the tools, and the notes save in the .draft' },
  { file: 'MODEL.html',
    name: 'an empty pad writes an empty key into every file',
    find: "    else delete drawing.notepad;\n",
    with: "    else drawing.notepad = '';\n",
    test: 'an empty pad leaves the file key for key' },
  { file: 'MODEL.html',
    name: 'the browser forgets them: a reload empties the pad',
    find: "  showNotes(notesStored());\n",
    with: "  showNotes('');\n",
    test: 'a reload keeps them, NEW keeps them, and a drawing with its own notes shows those' },
  { file: 'MODEL.html',
    name: 'NEW wipes the pad',
    find: "    notesOntoDrawing(notesText.value);\n  };\n",
    with: "    if (!own) showNotes('');\n    notesOntoDrawing(notesText.value);\n  };\n",
    test: 'a reload keeps them, NEW keeps them, and a drawing with its own notes shows those' },
  { file: 'MODEL.html',
    name: 'a drawing\'s own notes lose to the pad',
    find: "    if (own) { showNotes(own); storeNotes(own); }\n",
    with: "    if (own && !notesText.value) { showNotes(own); storeNotes(own); }\n",
    test: 'a reload keeps them, NEW keeps them, and a drawing with its own notes shows those' },
  { file: 'MODEL.html',
    name: 'CLEAR wipes without asking',
    find: "    if (!window.confirm('Clear all notes?')) return;\n",
    with: "",
    test: 'CLEAR asks first; NO keeps them, YES wipes the pad and the file' },
  { file: 'MODEL.html',
    name: 'CLEAR leaves the browser copy behind',
    find: "    showNotes('');\n    storeNotes('');\n",
    with: "    showNotes('');\n",
    test: 'CLEAR asks first; NO keeps them, YES wipes the pad and the file' },
  { file: 'MODEL.html',
    name: 'no five-page limit',
    find: "  notesText.maxLength = NOTES_MAX;\n",
    with: "",
    test: 'about five pages and no more: 15,000 characters, the head counts the pages' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4431' } });
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
