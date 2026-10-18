#!/usr/bin/env node
// MUTATION GATE for the North Point suites' WCs and kitchens on the live page
// (tests/suite-presets.spec.js).
//
// Movie, 17-18 Oct: WC BF2 to BF5 "include the closet", BF3 "the CLOSET and
// the W/D Laundry closet", KITCHEN U1, L2 and L3. The rooms' geometry is held
// by proto/washroom-presets-harness.js and proto/kitchen-presets-harness.js;
// this holds the page's filing of them: every door in its style, one undo
// for all of it, the island's standoff, and F reaching the kitchen's own
// walls.
//
// Run: node proto/suite-presets-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/suite-presets.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: "a room files only its first door",
    find: "    const doors = room.doors.map(d => {\n",
    with: "    const doors = room.doors.slice(0, 1).map(d => {\n",
    test: "each suite WC drops whole in open floor -- its closet, its laundry, every door -- one assembly, one undo" },
  { file: 'MODEL.html',
    name: "every door is a plain swing door",
    find: "        doorStyle: d.style || 'single',\n",
    with: "        doorStyle: 'single',\n",
    test: "each suite WC drops whole in open floor -- its closet, its laundry, every door -- one assembly, one undo" },
  { file: 'MODEL.html',
    name: "one undo leaves the closet's doors behind",
    find: "      openings: doors,\n",
    with: "      openings: doors.slice(0, 1),\n",
    test: "each suite WC drops whole in open floor -- its closet, its laundry, every door -- one assembly, one undo" },
  { file: 'MODEL.html',
    name: "a kitchen's island is filed against its wall",
    find: "        ...(f.standoff ? { standoff: f.standoff } : {}),\n      };\n      drawing.fixtures.push(record);",
    with: "      };\n      drawing.fixtures.push(record);",
    test: "the suites' kitchens drop in open floor with their own two walls, the island floated off its wall with its sink and dishwasher" },
  { file: 'MODEL.html',
    name: "F does not reach the kitchen's own walls",
    find: "    const own = KP.ownWalls(kitchenPreset, at, kitchenTurn, kitchenFlip);\n",
    with: "    const own = KP.ownWalls(kitchenPreset, at, kitchenTurn);\n",
    test: "F mirrors KITCHEN L2 in open floor and it still drops: its own walls swap lengths with its legs" },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4474' } });
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
