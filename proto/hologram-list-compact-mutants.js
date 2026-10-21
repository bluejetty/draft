#!/usr/bin/env node
// MUTATION GATE for the HOLOGRAM card as a list (buttons only on the copy
// picked, files side by side) and a hologram's own holograms switched on and
// off (tests/hologram-list-compact.spec.js).
//
// Movie, 21 Oct: "can it just LIST the items and show all the button for only
// the one the user has selected ... go to 2 or 3 columns and be wider";
// "a list of the HOLOGRAMS within a HOLOGRAM and a checkbox beside all of
// them"; "a button ... where ALL its attached HOLOGRAMS can be NOT SHOWN /
// SHOWN".
//
// Run: node proto/hologram-list-compact-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/hologram-list-compact.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'every copy opens its buttons',
    find: "      const open = lit || all.length === 1 || (hologramOpenId === holo.id && !selection.some(e => e.type === 'hologram'));",
    with: "      const open = true;",
    test: 'only the picked one' },
  { file: 'MODEL.html', name: 'the file cards stacked, one column',
    find: "    grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); max-height:62vh; overflow:auto; }",
    with: "    grid-template-columns:1fr; max-height:62vh; overflow:auto; }",
    test: 'side by side' },
  { file: 'hologram.js', name: 'a hologram switched off inside is drawn anyway',
    find: "    const src = insideShown(holo);",
    with: "    const src = holo?.source || {};",
    test: 'unticking one hides it' },
  { file: 'drawing-format.js', name: 'the switches dropped on save',
    find: "          return off.length ? { hiddenInside: [...new Set(off)] } : {};",
    with: "          return {};",
    test: 'unticking one hides it' },
  { file: 'MODEL.html', name: 'an untick that does nothing',
    find: "              if (tick.checked) next.delete(String(child.id)); else next.add(String(child.id));",
    with: "              void next;",
    test: 'unticking one hides it' },
  { file: 'MODEL.html', name: 'HIDE ALL INSIDE that hides none',
    find: "        every.addEventListener('click', () => setOff(allOff ? new Set() : new Set(inside.map(c => String(c.id)))));",
    with: "        every.addEventListener('click', () => setOff(new Set()));",
    test: 'HIDE ALL INSIDE' },
  { file: 'MODEL.html', name: 'the switch is not undone',
    find: "          undoStack.push({ kind: 'props', edits });\n          markDirty();\n          paint();\n          renderHologramList();\n        };",
    with: "          markDirty();\n          paint();\n          renderHologramList();\n        };",
    test: 'HIDE ALL INSIDE' },
  { file: 'MODEL.html', name: 'INSIDE offered on a hologram with nothing inside',
    find: "      if (inside.length) {\n        const offOf",
    with: "      if (true) {\n        const offOf",
    test: 'nothing inside it' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4508' } });
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
