#!/usr/bin/env node
// MUTATION GATE for the size marks (Movie, 24 Oct): the door's label --
// both panels, the height when it is not 80", the garage in feet -- and its
// place inside the swing; the four STANDARDS switches ON by default; the tub
// its own size, marked inside by its open side; the vanity's mark at its
// front left; cabinet runs and uppers said round a stove; a sink base's mark
// in the right bowl; and a drag's distance in the LENGTH box. Each row breaks
// one line, runs the one test that should notice, and restores from HEAD.
//
//   node proto/size-marks-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/size-marks.spec.js';

const MUTANTS = [
  { file: 'fen-labels.js',
    name: 'a pair says one width again',
    find: "      splitFt: garage ? null : doorPanelsFt(opening),\n",
    with: "      splitFt: null,\n",
    test: 'door labels' },
  { file: 'fen-labels.js',
    name: 'SHOW HEIGHT is ignored',
    find: "      && (showHeight === true || Math.abs(heightFt - STANDARD_DOOR_HEIGHT_FT) > DOOR_HEIGHT_SLACK_FT);\n",
    with: "      && Math.abs(heightFt - STANDARD_DOOR_HEIGHT_FT) > DOOR_HEIGHT_SLACK_FT;\n",
    test: 'door labels' },
  { file: 'fen-labels.js',
    name: 'the garage reads G 16W x 8H again',
    find: "      return `${trimFeet(widthFt)}' X ${trimFeet(heightFt)}'`;\n",
    with: "      return `G ${trimFeet(widthFt)}W x ${trimFeet(heightFt)}H`;\n",
    test: 'door labels' },
  { file: 'fen-labels.js',
    name: 'the mark goes back to the face away from the swing',
    find: "    const side = swings ? -flip : flip;\n",
    with: "    const side = flip;\n",
    test: 'inside its swing' },
  { file: 'fen-labels.js',
    name: 'the size switches are OFF unless saved ON',
    find: "      ...Object.fromEntries(SIZE_MARK_SWITCHES.map(key => [key, stored[key] !== false])),\n",
    with: "      ...Object.fromEntries(SIZE_MARK_SWITCHES.map(key => [key, stored[key] === true])),\n",
    test: 'the four size switches' },
  { file: 'fixture-geometry.js',
    name: 'the tub grows 6" to fill its alcove again',
    find: "  const TUB_STRETCH_MAX_FT = 0;\n",
    with: "  const TUB_STRETCH_MAX_FT = 0.5;\n",
    test: 'the tub is its own' },
  { file: 'MODEL.html',
    name: 'the tub\'s mark goes out into the room',
    find: "          take(fx, label, draw(lineAt(geo, a0, a1, geo.frontOff, SIZE_MARK_IN_PX), label));\n",
    with: "          take(fx, label, draw(lineAt(geo, a0, a1, geo.frontOff, -SIZE_MARK_OFF_PX), label));\n",
    test: 'the tub is its own' },
  { file: 'MODEL.html',
    name: 'the vanity\'s mark goes to its front right',
    find: "          const [from, to] = leftLow ? [lo, hi] : [hi, lo];\n",
    with: "          const [from, to] = leftLow ? [hi, lo] : [lo, hi];\n",
    test: 'front left' },
  { file: 'MODEL.html',
    name: 'a cabinet run is said whole, through the stove',
    find: "        (R.counterSpans2D ? R.counterSpans2D(fx, list, env) : [[a0, a1]]).forEach(([c0, c1]) => {\n",
    with: "        [[a0, a1]].forEach(([c0, c1]) => {\n",
    test: 'cabinet runs' },
  { file: 'MODEL.html',
    name: 'the uppers\' mark goes back onto their dashed line\'s room side',
    find: "draw(lineToward(geo, u0, u1, front, geo.backOff, SIZE_MARK_IN_PX), say(u1 - u0), ink, 'upper', fx.id);",
    with: "draw(lineAt(geo, u0, u1, front, SIZE_MARK_IN_PX), say(u1 - u0), ink, 'upper', fx.id);",
    test: 'cabinet runs' },
  { file: 'render-2d.js',
    name: 'the run\'s uppers are said over the stove\'s too',
    find: "  const upperCutsOn = (fixture, fixtures, env) => (fixture.kind !== 'cabinet' ? []\n    : (fixtures || []).filter(o => o && o !== fixture && o.kind !== 'cabinet' && o.kind !== 'island' && sameRun(o, fixture))\n",
    with: "  const upperCutsOn = (fixture, fixtures, env) => (fixture.kind !== 'cabinet' ? []\n    : (fixtures || []).filter(o => o && o !== fixture && o.kind === 'sinkbase' && sameRun(o, fixture))\n",
    test: 'cabinet runs' },
  { file: 'render-2d.js',
    name: 'a 60/40 sink is marked in its small bowl',
    find: "      return { spans: [[s0, s0 + first], [s0 + first + 0.08, s0 + total + 0.08]], mark: leftIsLow ? 1 : 0 };\n",
    with: "      return { spans: [[s0, s0 + first], [s0 + first + 0.08, s0 + total + 0.08]], mark: leftIsLow ? 0 : 1 };\n",
    test: 'left bowl' },
  { file: 'MODEL.html',
    name: 'CABINET SIZES off is ignored',
    find: "    const showCabinets = !std || std.cabinetSizes !== false;\n",
    with: "    const showCabinets = true;\n",
    test: 'take their marks off' },
  { file: 'drawing-format.js',
    name: 'a sink\'s bowls are not kept in the file',
    find: "        ...((kind === 'sinkbase' || kind === 'sink') && SINK_BOWLS.includes(fixture?.bowls) ? { bowls: fixture.bowls } : {}),\n",
    with: "",
    test: 'front left' },
  { file: 'MODEL.html',
    name: 'the LENGTH box says nothing while a drag goes',
    find: "    if (syncDragLength) syncDragLength();\n",
    with: "",
    test: 'LENGTH box' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4543' } });
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
