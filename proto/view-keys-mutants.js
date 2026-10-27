#!/usr/bin/env node
// MUTATION GATE for the view keys (tests/view-keys.spec.js).
//
// Movie, 27 Oct, the ARCHICAD keys he ticked: Ctrl+' fits, Ctrl+[ / Ctrl+]
// step back and on through the zooms, Shift+F2 / Ctrl+F2 and Page Up / Page
// Down change level, F3 opens the 3D WIREFRAME, the arrows nudge.
//
// Run: node proto/view-keys-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/view-keys.spec.js';

const MUTANTS = [
  { file: 'model/16-gestures-undo.js',
    name: "CTRL+' does not fit",
    find: "    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === \"'\") {\n",
    with: "    if (false) {\n",
    test: "CTRL+' fits; CTRL+[ steps back to the zoom before it and CTRL+] on again" },
  { file: 'model/16-gestures-undo.js',
    name: 'a fit is not remembered',
    find: "      e.preventDefault(); noteView(true); fit(); paint(); return;\n",
    with: "      e.preventDefault(); fit(); paint(); return;\n",
    test: "CTRL+' fits; CTRL+[ steps back to the zoom before it and CTRL+] on again" },
  { file: 'model/16-gestures-undo.js',
    name: 'the wheel is not remembered',
    find: "    noteView();\n    view.scale = Math.max(0.25, Math.min(view.scale * factor, 800));\n",
    with: "    view.scale = Math.max(0.25, Math.min(view.scale * factor, 800));\n",
    test: "CTRL+' fits; CTRL+[ steps back to the zoom before it and CTRL+] on again" },
  { file: 'model/16-gestures-undo.js',
    name: 'CTRL+] goes nowhere',
    find: "      if (e.key === '[') stepView(viewBack, viewAhead); else stepView(viewAhead, viewBack);\n",
    with: "      if (e.key === '[') stepView(viewBack, viewAhead);\n",
    test: "CTRL+' fits; CTRL+[ steps back to the zoom before it and CTRL+] on again" },
  { file: 'model/16-gestures-undo.js',
    name: 'PAGE UP changes nothing',
    find: "    const levelKey = e.key === 'PageUp' || (e.key === 'F2' && e.shiftKey) ? LEVEL_UP\n",
    with: "    const levelKey = (e.key === 'F2' && e.shiftKey) ? LEVEL_UP\n",
    test: 'PAGE UP / PAGE DOWN and SHIFT+F2 / CTRL+F2 go up and down a level' },
  { file: 'model/16-gestures-undo.js',
    name: 'CTRL+F2 changes nothing',
    find: "      : e.key === 'PageDown' || (e.key === 'F2' && e.ctrlKey) ? LEVEL_DOWN : null;\n",
    with: "      : e.key === 'PageDown' ? LEVEL_DOWN : null;\n",
    test: 'PAGE UP / PAGE DOWN and SHIFT+F2 / CTRL+F2 go up and down a level' },
  { file: 'model/16-gestures-undo.js',
    name: 'F3 opens nothing',
    find: "    if (e.key === 'F3' && !e.ctrlKey && !e.altKey && !e.shiftKey) {\n",
    with: "    if (false) {\n",
    test: 'F3 opens the 3D WIREFRAME' },
  { file: 'model/16-gestures-undo.js',
    name: 'CTRL+arrow nudges an inch too',
    find: "      const step = e.ctrlKey || e.metaKey ? 1 : NUDGE_FT;\n",
    with: "      const step = NUDGE_FT;\n",
    test: 'the arrows nudge a picked wall an inch, CTRL+arrow a foot, as MOVE does, and each press is one UNDO' },
  { file: 'model/16-gestures-undo.js',
    name: 'a nudge leaves no UNDO',
    find: "    undoStack.push(steps.length > 1 ? { kind: 'batch', steps } : moveStep);\n    markDirty();\n    setSelection([...selection]);\n    sayOnStrip(`Nudged",
    with: "    markDirty();\n    setSelection([...selection]);\n    sayOnStrip(`Nudged",
    test: 'the arrows nudge a picked wall an inch, CTRL+arrow a foot, as MOVE does, and each press is one UNDO' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4799' } });
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
