#!/usr/bin/env node
// MUTATION GATE for THE AUTOHOUSE OFF A DRAWN OUTLINE
// (tests/outline-to-autohouse.spec.js).
//
// jb, 13 Nov 2026: pick the type, ESC the board, draw the footprint with
// TURTLE HOUSE or the OUTLINE tool (or set the PROJECT numbers first), then
// press the bone and get the autohouse on it.
//
// Twelve defects that still render: a turtle walk the trace never hears, a
// walk that lands and waits for a bone press, a second walk that is a second
// house instead of the garage, a U-key second loop the same, an ESC that
// leaves the OUTLINE tool in hand, a pick stamped without its garage plan, a
// re-open that forgets the tile (three ways), a walk with no type that asks
// nothing, a tile press that throws away the house drawn before it, and one
// that keeps it but waits for the bone.
//
// Run: node proto/outline-to-autohouse-mutants.js
//      (refuses a dirty tree on the mutated files; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/outline-to-autohouse.spec.js';

const MUTANTS = [
  { file: 'model/04-levels-notes-bars.js',
    name: 'a TURTLE HOUSE walk is handed to the trace',
    find: "      if (master) traceLanded(master, made, { garage: rec.garage === true, buildOnClose: true, fromTurtle: true });",
    with: "",
    test: 'a TURTLE HOUSE walk after ESC is the traced house' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'the walk builds on its close, no bone press',
    find: "      if (master) traceLanded(master, made, { garage: rec.garage === true, buildOnClose: true, fromTurtle: true });",
    with: "      if (master) traceLanded(master, made, { garage: rec.garage === true, buildOnClose: false, fromTurtle: true });",
    test: 'a TURTLE HOUSE walk after ESC is the traced house' },
  { file: 'model/10-tracking-garage.js',
    name: 'a walk with no type asks with the board',
    find: "      if (fromTurtle) askTypeForOutline();",
    with: "",
    test: 'raises the board to ask' },
  { file: 'model/10-tracking-garage.js',
    name: 'the tile pressed over a drawn house builds at once',
    find: "      paint();\n      window.ModelBuild.build();\n      return;",
    with: "      paint();\n      return;",
    test: 'raises the board to ask' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'the second walk is the garage when the type hangs one on the house',
    find: "    rec.garage = wantsGarageNext() || isGarageChoice(window.ModelBuild.chosen());",
    with: "    rec.garage = false;",
    test: 'the second TURTLE HOUSE walk is the garage' },
  { file: 'model/10-tracking-garage.js',
    name: 'a U-key second loop is the garage, outlineGarage or not',
    find: "    const closingGarage = outlineGarage || wantsGarageNext();",
    with: "    const closingGarage = outlineGarage;",
    test: 'the OUTLINE key by hand works the same way' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'ESC off the board puts the OUTLINE tool down',
    find: "    setTool(RESTING_TOOL);\n    sayOnStrip(PICKED_LINE(picked.entry.label));",
    with: "    sayOnStrip(PICKED_LINE(picked.entry.label));",
    test: 'ESC off the board with a type picked' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'the pick stamps its garage plan on the file',
    find: "    if (drawing && plan && drawing.garagePlan !== plan) {\n      drawing.garagePlan = plan;",
    with: "    if (false) {\n      drawing.garagePlan = plan;",
    test: 'ESC off the board with a type picked' },
  { file: 'model/04-levels-notes-bars.js',
    name: 'the pick is read back off the file',
    find: "    if (!drawing || chosenEntryId || classicLocked()) return false;",
    with: "    return false;",
    test: 'the pick survives a reload' },
  { file: 'model/17-boot-save.js',
    name: 'boot asks for the pick back',
    find: "    restorePickFromFile();\n",
    with: "",
    test: 'the pick survives a reload' },
  { file: 'model/10-tracking-garage.js',
    name: 'the restored pick is the trace’s order too',
    find: "    tracedOrder = picked?.entry ? picked : null;\n  };",
    with: "    tracedOrder = null;\n  };",
    test: 'the pick survives a reload' },
  { file: 'model/10-tracking-garage.js',
    name: 'a house drawn before the type is kept as that type’s house',
    find: "      ? { house: tracedHouse, masters: tracedMasters } : null;",
    with: "      ? null : null;",
    test: 'raises the board to ask' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4367' } });
    return 'passed';
  } catch { return 'failed'; }
};

const files = [...new Set(MUTANTS.map(m => m.file))].join(' ');
const dirty = execSync(`git status --porcelain ${files}`, { cwd: ROOT }).toString().trim();
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
