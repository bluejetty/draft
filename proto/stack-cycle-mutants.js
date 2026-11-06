#!/usr/bin/env node
// MUTATION GATE for CLICK AGAIN and TO FRONT / TO BACK (tests/stack-cycle.spec.js).
//
// Movie, 6 Nov: "when 2 things are on top of each other when i select it the
// 2nd time i'd like to scroll the selection to pick the 2nd item or third
// etc" -- "we should have a feature to bring a item, or group 'to the top'"
// -- "when it cycles through selections you should be able to see the 'OBJ/
// PROP' area change update". Seven seams: one line per kind again, the
// earlier record on top, four pixels is the same spot again, a click again
// that cannot step onto a held piece, TO FRONT that sends to the back, UNDO
// that forgets the order, and OBJ / PROP that names an outline as nothing.
//
// Run: node proto/stack-cycle-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/stack-cycle.spec.js';
const CYCLE = 'click again on the same spot steps through every stacked thing, lines of the same kind included, and round again';
const ORDER = 'ORDER: TO FRONT paints the held thing last of its kind and a click takes it first; TO BACK the reverse; UNDO puts the order back';

const MUTANTS = [
  { file: 'model/06-selection-pick.js', name: 'one line per kind, as before',
    find: "      if (takeAll('line', segsAt(lines(), worldPt))) return out;\n",
    with: "      if (takeAll('line', segsAt(lines(), worldPt).slice(0, 1))) return out;\n",
    test: CYCLE },
  { file: 'model/06-selection-pick.js', name: 'the earlier record is on top',
    find: "    return near.sort((a, b) => (Math.abs(a.d - b.d) < 1e-6 ? b.i - a.i : a.d - b.d)).map(n => n.item);\n",
    with: "    return near.sort((a, b) => (Math.abs(a.d - b.d) < 1e-6 ? a.i - b.i : a.d - b.d)).map(n => n.item);\n",
    test: CYCLE },
  { file: 'model/06-selection-pick.js', name: 'four pixels is the same spot again',
    find: "  const PICK_AGAIN_PX = 10;\n",
    with: "  const PICK_AGAIN_PX = 4;\n",
    test: CYCLE },
  { file: 'model/06-selection-pick.js', name: 'the cycle forgets where it was',
    find: "    const lastAt = again && lastPick.item ? hits.findIndex(h => h.item === lastPick.item) : -1;\n",
    with: "    const lastAt = -1;\n",
    test: CYCLE },
  { file: 'model/16-gestures-undo.js', name: 'a click again cannot step onto a held piece',
    find: "          && (under.again || !selection.some(entry => entry.item === under.hit.item))) {\n",
    with: "          && !selection.some(entry => entry.item === under.hit.item)) {\n",
    test: CYCLE },
  { file: 'model/09-draw-move-stretch.js', name: 'TO FRONT sends to the back',
    find: "      const after = toFront ? [...staying, ...moving] : [...moving, ...staying];\n",
    with: "      const after = toFront ? [...moving, ...staying] : [...staying, ...moving];\n",
    test: ORDER },
  { file: 'model/16-gestures-undo.js', name: 'UNDO forgets the order',
    find: "      step.lists.forEach(({ list, before }) => list.splice(0, list.length, ...before));\n",
    with: "",
    test: ORDER },
  { file: 'model/15-panels.js', name: 'OBJ / PROP names an outline as nothing',
    find: "        : kinds.length === 1 ? `${hitSays(selection[0])}${picked.length > 1 ? ` \\u00d7${picked.length}` : ''} \\u2014 NOTHING TO SET`\n",
    with: "",
    test: CYCLE },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4497' } });
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
