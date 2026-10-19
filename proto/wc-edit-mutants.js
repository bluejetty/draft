#!/usr/bin/env node
// MUTATION GATE for the selection MOVE, the FIXED assembly picked whole,
// TRIM's one piece, SHIFT letting a wall go of its corners, WALL OFF, and hand
// dimensions on their nodes (Movie, 18 Oct, the WC: "i'm not able to make an
// ASSEBLY - so i can select it as 1 UNIT" -- "i'd also like to FREELY MOVE the
// entire selection or 'ASSEMBLY'" -- "when i trim i don't want to trim both
// ends only the one i touch" -- "DISCONNECT the nodes at corners ... SHIFT" --
// "TURN OFF that wall" -- "the dim didn't follow the node").
//
// Run: node proto/wc-edit-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPECS = ['tests/model-html-move-selection.spec.js', 'tests/model-html-trim.spec.js',
  'tests/model-html-wall-loose.spec.js', 'tests/model-html-wall-off.spec.js', 'tests/dimension-hand.spec.js',
  'tests/model-tool-assembly.spec.js', 'tests/model-html-roof-move.spec.js', 'tests/model-html-suite.spec.js'];
const MUTANTS = [
  { file: 'MODEL.html', name: "MOVE still needs a roof", spec: 'tests/model-html-move-selection.spec.js',
    find: "    const able = !activeCut() && !modalUp() && selection.length > 0;\n    if (!able || (moveState.on && roof !== moveState.roof",
    with: "    const able = !activeCut() && !modalUp() && !!roof;\n    if (!able || (moveState.on && roof !== moveState.roof",
    test: "MOVE takes a loose selection too, and a press that does not travel moves nothing" },
  { file: 'MODEL.html', name: "a moved selection drags its neighbours' corners with it", spec: 'tests/model-html-move-selection.spec.js',
    find: "        detached.push({ wall: item, key, orig });\n        item[key] = { ...orig };\n",
    with: "",
    test: "MOVE takes a whole FIXED assembly anywhere: the walls, the window riding them; the house wall stays; one UNDO" },
  { file: 'MODEL.html', name: "a click on a FIXED assembly picks one piece", spec: 'tests/model-tool-assembly.spec.js',
    find: "    return owner && owner.fixed === true ? itemsOfGroup(owner) : [entry];",
    with: "    return [entry];",
    test: "clicking one member of a FIXED assembly takes it whole; of a NOT FIXED one, just that member" },
  { file: 'MODEL.html', name: "an assembly cannot find its windows again", spec: 'tests/model-html-move-selection.spec.js',
    find: "    sweep('fenestration', (drawing?.fenestrations || []).filter(o => walls().some(w => String(w.id) === String(o.wallId))));\n",
    with: "",
    test: "ASSEMBLY GROUP opens its name box in view, and an assembly keeps the window it was made with" },
  { file: 'MODEL.html', name: "TRIM corners whatever is selected", spec: 'tests/model-html-trim.spec.js',
    find: "      const corner = trimCuttersPicked().includes(cutter) ? trimCornerWith(seg, cutter) : null;",
    with: "      const corner = trimCornerWith(seg, cutter);",
    test: "TRIM with nothing selected takes only the piece pressed; the wall it crosses runs on through" },
  { file: 'MODEL.html', name: "SHIFT does not let the corners go", spec: 'tests/model-html-wall-loose.spec.js',
    find: "          if (board !== 'toy') setWallLoose(md, e.shiftKey);\n",
    with: "",
    test: "SHIFT held: the wall moves on its own; the walls it met stay where they were; UNDO joins it again" },
  { file: 'MODEL.html', name: "SHIFT let go keeps the corners loose", spec: 'tests/model-html-wall-loose.spec.js',
    find: "          if (board !== 'toy') setWallLoose(md, e.shiftKey);",
    with: "          if (board !== 'toy' && e.shiftKey) setWallLoose(md, true);",
    test: "SHIFT let go part way: the corners bounce back and stretch with it" },
  { file: 'MODEL.html', name: "UNDO leaves a loosed wall loose", spec: 'tests/model-html-wall-loose.spec.js',
    find: "      if (step.loose) {\n",
    with: "      if (false) {\n",
    test: "SHIFT held: the wall moves on its own; the walls it met stay where they were; UNDO joins it again" },
  { file: 'MODEL.html', name: "WALL OFF leaves the toilet on the gone wall", spec: 'tests/model-html-wall-off.spec.js',
    find: "      fx.wallId = host.id;\n      fx.offset = Math.max(0, at.t);",
    with: "      fx.offset = Math.max(0, at.t);",
    test: "WALL OFF takes the WC wall away; the toilet hangs on the house wall where it stood; the side walls run on to its face; one UNDO" },
  { file: 'MODEL.html', name: "WALL OFF leaves the side walls short", spec: 'tests/model-html-wall-off.spec.js',
    find: "      v.x = far.x + dir.x * k;\n      v.z = far.z + dir.z * k;",
    with: "",
    test: "WALL OFF takes the WC wall away; the toilet hangs on the house wall where it stood; the side walls run on to its face; one UNDO" },
  { file: 'MODEL.html', name: "WALL OFF offered with no house wall behind", spec: 'tests/model-html-wall-off.spec.js',
    find: "    const able = !activeCut() && !modalUp() && !!wall && !!wallOffHost(wall);",
    with: "    const able = !activeCut() && !modalUp() && !!wall;",
    test: "a wall with no house wall behind it is not offered WALL OFF" },
  { file: 'MODEL.html', name: "a hand dimension forgets its node", spec: 'tests/dimension-hand.spec.js',
    find: "    if (typeof followDimLinks === 'function') followDimLinks();\n",
    with: "",
    test: "a hand dimension follows the corner it was put on, along its own run; UNDO brings it back" },
  { file: 'MODEL.html', name: "the node a dimension locks to stays dark", spec: 'tests/dimension-hand.spec.js',
    find: "      if (lit) {\n        const s = toS(lit);",
    with: "      if (false) {\n        const s = toS(lit);",
    test: "the node a dimension point will lock to lights up under the pointer" },
  { file: 'MODEL.html', name: "a roof edge pulled past the corner runs on", spec: 'tests/model-html-roof-move.spec.js',
    find: "        if (stop != null && (Math.abs(dist) > Math.abs(stop) || Math.abs(dist - stop) < catchFt)) dist = stop;",
    with: "        if (stop != null && Math.abs(dist - stop) < catchFt) dist = stop;",
    test: "an edge pulled past the corner stops on it: no roof the other side, no sliver" },
  { file: 'MODEL.html', name: "a roof edge let go a hair short is not caught", spec: 'tests/model-html-roof-move.spec.js',
    find: "        if (stop != null && (Math.abs(dist) > Math.abs(stop) || Math.abs(dist - stop) < catchFt)) dist = stop;",
    with: "        if (stop != null && Math.abs(dist) > Math.abs(stop)) dist = stop;",
    test: "an edge pulled past the corner stops on it: no roof the other side, no sliver" },
  { file: 'MODEL.html', name: "a double-click on a hologram opens nothing", spec: 'tests/model-html-suite.spec.js',
    find: "    if (hitAt(world) || !hologramUnder(world)) return;",
    with: "    return;",
    test: "a double-click on a hologram opens the HOLOGRAM card; off it, nothing" },
  { file: 'MODEL.html', name: "a double-click anywhere opens the HOLOGRAM card", spec: 'tests/model-html-suite.spec.js',
    find: "    if (hitAt(world) || !hologramUnder(world)) return;",
    with: "    if (hitAt(world)) return;",
    test: "a double-click on a hologram opens the HOLOGRAM card; off it, nothing" },
  { file: 'MODEL.html', name: "a suite in hand lights nothing", spec: 'tests/model-html-suite.spec.js',
    find: "    if (inHand && inHand.mode === 'suite' && H().suiteNear) {",
    with: "    if (false) {",
    test: "a suite in hand lights the shell wall it lines up with, and the window it will cut" },
  { file: 'MODEL.html', name: "a wall of another thickness is not told", spec: 'tests/model-html-suite.spec.js',
    find: "      if (odd && !near.some(n => n.lined)) {",
    with: "      if (false) {",
    test: "a suite wall that is not the shell wall's thickness is told so" },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4443' } });
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
  let result = run(m.test, m.spec);
  let note = '';
  if (result === 'passed' && run(null, m.spec) === 'failed') {
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
