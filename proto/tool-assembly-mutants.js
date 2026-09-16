// DOES THE ASSEMBLY SPEC CATCH A BROKEN ASSEMBLY?
//
// Same gate, same reasons, and the same two hardenings it grew in
// proto/tool-select-mutants.js: an ambiguous anchor is refused rather than
// guessed at, and a survivor is re-run against the WHOLE spec before it is
// called one, because "nothing sees this" and "the mutant was aimed at the
// wrong check" look identical otherwise.
//
// Restores MODEL.html from HEAD, so the baseline must be committed first.
const { execSync } = require('child_process');
const fs = require('fs');
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  {
    name: 'members are recorded by reference instead of by type and id',
    find: "        members.push({ type: entry.type, id: entry.item.id });",
    with: "        members.push({ type: entry.type, id: String(entry.item.id) + '-x' });",
    test: 'FIXED writes a named assembly',
  },
  {
    name: 'the typed name is ignored',
    find: "    const typed = (assemblyName || '').trim().toUpperCase();",
    with: "    const typed = '';",
    test: 'FIXED writes a named assembly',
  },
  {
    name: 'NOT FIXED gets the rigid behaviour anyway',
    find: "      stretchBehavior: fixed === true ? 'rigid' : 'item-geometry',",
    with: "      stretchBehavior: 'rigid',",
    test: 'NOT FIXED is a different assembly',
  },
  {
    name: 'an unnamed assembly lands in the file blank',
    find: "      name: typed || `ASSEMBLY ${n}`,",
    with: '      name: typed,',
    test: 'NOT FIXED is a different assembly',
  },
  {
    name: 'ASSEMBLY stays pressable with nothing selected',
    find: '      asmBtn.disabled = n === 0;',
    with: '      asmBtn.disabled = false;',
    test: 'ASSEMBLY is dead until something is selected',
  },
  {
    name: 'the help line stops counting',
    find: "        ? `${n} selected item${n === 1 ? '' : 's'} · make a named assembly.`",
    with: "        ? 'items selected · make a named assembly.'",
    test: 'ASSEMBLY is dead until something is selected',
  },
  {
    name: 'clicking a member takes only that member',
    find: '    const members = itemsOfGroup(group);',
    with: '    const members = [];',
    test: 'clicking one member takes the whole assembly',
  },
  {
    name: 'UNGROUP shows for a bare selection too',
    find: '      unBtn.hidden = held.length === 0;',
    with: '      unBtn.hidden = false;',
    test: 'UNGROUP appears only for an assembly',
  },
  {
    name: 'UNGROUP deletes the members instead of releasing them',
    find: '    drawing.groups = groups().filter(group => !ids.has(group.id));',
    with: "    drawing.groups = groups().filter(group => !ids.has(group.id));\n    drawing.walls = (drawing.walls || []).filter(w => !going.some(g => (g.members || []).some(m => m.id === w.id)));",
    test: 'UNGROUP appears only for an assembly',
  },
  {
    name: 'an item can sit in two assemblies at once',
    find: '    drawing.groups = groups()\n      .map(group => ({ ...group,\n        members: (group.members || [])\n          .filter(m => !taken.has(`${m.type}:${m.id}`)) }))\n      .filter(group => group.members.length > 0);',
    with: '    drawing.groups = groups();',
    test: 'an item belongs to one assembly',
  },
  {
    name: 'an emptied assembly is kept rather than dropped',
    find: '      .filter(group => group.members.length > 0);',
    with: '      .filter(() => true);',
    test: 'an item belongs to one assembly',
  },
  {
    name: 'Escape in the name field cancels instead of creating',
    find: "      if (e.key === 'Escape') { e.preventDefault(); createAssembly(false); }",
    with: "      if (e.key === 'Escape') { e.preventDefault(); closeAssemblyDialog(); }",
    test: 'Escape in the name field',
  },
  {
    name: 'the assembly is not saved at all',
    find: '    drawing.nextGroupId = n + 1;',
    with: '    drawing.nextGroupId = n + 1;\n    drawing.groups = [];',
    test: 'FIXED writes a named assembly',
  },
];

const run = grep => {
  try {
    execSync(`npx playwright test tests/model-tool-assembly.spec.js`
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: MODEL.html has uncommitted changes and this '
    + 'script restores it from HEAD.\n' + dirty);
  process.exit(1);
}

const PATH = `${ROOT}/MODEL.html`;
let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const before = fs.readFileSync(PATH, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) {
    console.log(`  SKIPPED (anchor not found): ${m.name}`);
    continue;
  }
  // AN AMBIGUOUS ANCHOR IS WORSE THAN A MISSING ONE. String.replace takes the
  // FIRST match, so a `find` that now occurs twice quietly mutates a site the
  // test was never watching, the test passes, and the run reports a survivor
  // that was never actually attacked. That is exactly what happened to "a
  // plain click stops clearing the selection" the moment the window drag added
  // a second `setSelection(hit ? [hit] : [])`.
  if (hits > 1) {
    console.log(`  AMBIGUOUS (${hits} matches, refusing to guess): ${m.name}`);
    ambiguous += 1;
    continue;
  }
  ran += 1;
  fs.writeFileSync(PATH, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed') {
    // Aimed check let it through. Was anything else watching?
    if (run(null) === 'failed') { result = 'failed'; note = '  (caught by another check -- re-aim `test`)'; }
  }
  execSync('git checkout -- MODEL.html', { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
// READ AGAINST WHAT WAS DEFINED, never against what ran. A SKIPPED mutant
// leaves `ran` smaller, so `10/10 killed` prints like a clean sheet while the
// exit code says otherwise -- and the line is what gets read.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ran < MUTANTS.length ? ` -- ${MUTANTS.length - ran} NEVER RAN` : '')
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS -- anchors that match more than one site` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
