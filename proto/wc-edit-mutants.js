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
  { file: 'model/09-draw-move-stretch.js', name: "MOVE still needs a roof", spec: 'tests/model-html-move-selection.spec.js',
    find: "    const able = !activeCut() && !modalUp() && selection.length > 0;\n    if (!able || (moveState.on && roof !== moveState.roof",
    with: "    const able = !activeCut() && !modalUp() && !!roof;\n    if (!able || (moveState.on && roof !== moveState.roof",
    test: "MOVE takes a loose selection too, and a press that does not travel moves nothing" },
  { file: 'model/09-draw-move-stretch.js', name: "a moved selection drags its neighbours' corners with it", spec: 'tests/model-html-move-selection.spec.js',
    find: "        detached.push({ wall: item, key, orig });\n        item[key] = { ...orig };\n",
    with: "",
    test: "MOVE takes a whole FIXED assembly anywhere: the walls, the window riding them; the house wall stays; one UNDO" },
  { file: 'model/06-selection-pick.js', name: "a click on a FIXED assembly picks one piece", spec: 'tests/model-tool-assembly.spec.js',
    find: "    if (owner && owner.fixed === true) return itemsOfGroup(owner);",
    with: "",
    test: "clicking one member of a FIXED assembly takes it whole; of a NOT FIXED one, just that member" },
  { file: 'model/06-selection-pick.js', name: "an assembly cannot find its windows again", spec: 'tests/model-html-move-selection.spec.js',
    find: "    sweep('fenestration', (drawing?.fenestrations || []).filter(o => walls().some(w => String(w.id) === String(o.wallId))));\n",
    with: "",
    test: "ASSEMBLY GROUP opens its name box in view, and an assembly keeps the window it was made with" },
  { file: 'model/13-suites-trim-follow.js', name: "TRIM corners whatever is selected", spec: 'tests/model-html-trim.spec.js',
    find: "      const corner = trimCuttersPicked().includes(cutter) ? trimCornerWith(seg, cutter) : null;",
    with: "      const corner = trimCornerWith(seg, cutter);",
    test: "TRIM with nothing selected takes only the piece pressed; the wall it crosses runs on through" },
  { file: 'model/16-gestures-undo.js', name: "ALT does not let the corners go", spec: 'tests/model-html-wall-loose.spec.js',
    find: "          if (board !== 'toy') setWallLoose(md, e.altKey);\n",
    with: "",
    test: "ALT held: the wall moves on its own; the walls it met stay where they were; UNDO joins it again" },
  { file: 'model/16-gestures-undo.js', name: "ALT let go keeps the corners loose", spec: 'tests/model-html-wall-loose.spec.js',
    find: "          if (board !== 'toy') setWallLoose(md, e.altKey);",
    with: "          if (board !== 'toy' && e.altKey) setWallLoose(md, true);",
    test: "ALT let go part way: the corners bounce back and stretch with it" },
  { file: 'model/16-gestures-undo.js', name: "UNDO leaves a loosed wall loose", spec: 'tests/model-html-wall-loose.spec.js',
    find: "      if (step.loose) {\n",
    with: "      if (false) {\n",
    test: "ALT held: the wall moves on its own; the walls it met stay where they were; UNDO joins it again" },
  { file: 'model/09-draw-move-stretch.js', name: "WALL OFF leaves the toilet on the gone wall", spec: 'tests/model-html-wall-off.spec.js',
    find: "      fx.wallId = host.id;\n      fx.offset = Math.max(0, at.t);",
    with: "      fx.offset = Math.max(0, at.t);",
    test: "WALL OFF takes the WC wall away; the toilet hangs on the house wall where it stood; the side walls run on to its face; one UNDO" },
  { file: 'model/09-draw-move-stretch.js', name: "WALL OFF leaves the side walls short", spec: 'tests/model-html-wall-off.spec.js',
    find: "      v.x = far.x + dir.x * k;\n      v.z = far.z + dir.z * k;",
    with: "",
    test: "WALL OFF takes the WC wall away; the toilet hangs on the house wall where it stood; the side walls run on to its face; one UNDO" },
  { file: 'model/09-draw-move-stretch.js', name: "WALL OFF offered with no house wall behind", spec: 'tests/model-html-wall-off.spec.js',
    find: "    const able = !activeCut() && !modalUp() && !!wall && !!wallOffHost(wall);",
    with: "    const able = !activeCut() && !modalUp() && !!wall;",
    test: "a wall with no house wall behind it is not offered WALL OFF" },
  { file: 'model/03-plan-paint.js', name: "a hand dimension forgets its node", spec: 'tests/dimension-hand.spec.js',
    find: "    if (typeof followDimLinks === 'function') followDimLinks();\n",
    with: "",
    test: "a hand dimension follows the corner it was put on, along its own run; UNDO brings it back" },
  { file: 'model/15-panels.js', name: "the node a dimension locks to stays dark", spec: 'tests/dimension-hand.spec.js',
    find: "      if (lit) {\n        const s = toS(lit);",
    with: "      if (false) {\n        const s = toS(lit);",
    test: "the node a dimension point will lock to lights up under the pointer" },
  { file: 'model/09-draw-move-stretch.js', name: "a roof edge pulled past the corner runs on", spec: 'tests/model-html-roof-move.spec.js',
    find: "        if (stop != null && (Math.abs(dist) > Math.abs(stop) || Math.abs(dist - stop) < catchFt)) dist = stop;",
    with: "        if (stop != null && Math.abs(dist - stop) < catchFt) dist = stop;",
    test: "an edge pulled past the corner stops on it: no roof the other side, no sliver" },
  { file: 'model/09-draw-move-stretch.js', name: "a roof edge let go a hair short is not caught", spec: 'tests/model-html-roof-move.spec.js',
    find: "        if (stop != null && (Math.abs(dist) > Math.abs(stop) || Math.abs(dist - stop) < catchFt)) dist = stop;",
    with: "        if (stop != null && Math.abs(dist) > Math.abs(stop)) dist = stop;",
    test: "an edge pulled past the corner stops on it: no roof the other side, no sliver" },
  { file: 'model/13-suites-trim-follow.js', name: "a double-click on a hologram opens nothing", spec: 'tests/model-html-suite.spec.js',
    find: "    if ((own && own.type !== 'hologram') || !hologramUnder(world)) return;",
    with: "    return;",
    test: "a double-click on a hologram opens the HOLOGRAM card; off it, nothing" },
  { file: 'model/13-suites-trim-follow.js', name: "a double-click anywhere opens the HOLOGRAM card", spec: 'tests/model-html-suite.spec.js',
    find: "    if ((own && own.type !== 'hologram') || !hologramUnder(world)) return;",
    with: "    if (own && own.type !== 'hologram') return;",
    test: "a double-click on a hologram opens the HOLOGRAM card; off it, nothing" },
  { file: 'model/02-holograms-tags.js', name: "a suite in hand lights nothing", spec: 'tests/model-html-suite.spec.js',
    find: "    if (inHand && inHand.mode === 'suite' && H().suiteNear) {",
    with: "    if (false) {",
    test: "a suite in hand lights the shell wall it lines up with, and the window it will cut" },
  { file: 'model/02-holograms-tags.js', name: "a wall of another thickness is not told", spec: 'tests/model-html-suite.spec.js',
    find: "      if (odd && !near.some(n => n.lined)) {",
    with: "      if (false) {",
    test: "a suite wall that is not the shell wall's thickness is told so" },
  { file: 'model/13-suites-trim-follow.js', name: "a blue hologram lined up says nothing", spec: 'tests/model-html-suite.spec.js',
    find: "    if (m.hologram && m.underlay.mode !== 'suite' && H()?.suiteNear",
    with: "    if (false && m.hologram && m.underlay.mode !== 'suite' && H()?.suiteNear",
    test: "a blue hologram lined up with the shell says to make it a SUITE to snap and cut" },
  { file: 'model/16-gestures-undo.js', name: "a click close to a roof node picks nothing", spec: 'tests/model-html-roof-move.spec.js',
    find: "        const nodeHit = roofNodeNear(world);",
    with: "        const nodeHit = null;",
    test: "a click close to a roof node picks just the node" },
  { file: 'model/06-selection-pick.js', name: "a roof stays lit while its node is picked", spec: 'tests/model-html-roof-move.spec.js',
    find: "      if (type === 'roof' && moveState?.node?.roof === item) return;\n",
    with: "",
    test: "a click close to a roof node picks just the node" },
  { file: 'model/16-gestures-undo.js', name: "a box over roof nodes picks none", spec: 'tests/model-html-roof-move.spec.js',
    find: "      const nodes = !caught.length && !e?.shiftKey ? roofNodesInBox(box.from, box.to) : null;",
    with: "      const nodes = null;",
    test: "a box over two roof nodes picks them" },
  { file: 'model/09-draw-move-stretch.js', name: "a drag on one picked node leaves the others", spec: 'tests/model-html-roof-move.spec.js',
    find: "    const carried = node != null && moveState.node?.roof === roof",
    with: "    const carried = false && node != null && moveState.node?.roof === roof",
    test: "a box over two roof nodes picks them" },
  { file: 'model/09-draw-move-stretch.js', name: "DELETE takes only one of the picked nodes", spec: 'tests/model-html-roof-move.spec.js',
    find: "    list.slice().sort((a, b) => b - a).forEach(i => {",
    with: "    list.slice(0, 1).forEach(i => {",
    test: "a box over two roof nodes picks them" },
  { file: 'model/16-gestures-undo.js', name: "a click on one of a pair keeps both", spec: 'tests/model-html-roof-move.spec.js',
    find: "          pickRoofNodes(nodeHit.roof, [nodeHit.i]);",
    with: "          pickRoofNodes(nodeHit.roof, moveState.node?.roof === nodeHit.roof ? moveState.node.list : [nodeHit.i]);",
    test: "a box over two roof nodes picks them" },
  { file: 'model/09-draw-move-stretch.js', name: "two nodes picked and BREAK still adds a node", spec: 'tests/model-html-roof-move.spec.js',
    find: "    const splits = moveState?.node?.list?.length === 2;",
    with: "    const splits = false;",
    test: "two nodes picked, BREAK ROOF splits the roof between them" },
  { file: 'model/09-draw-move-stretch.js', name: "BREAK ROOF leaves the cut an eave", spec: 'tests/model-html-roof-move.spec.js',
    find: "      edges: idx.map((k, m) => (m === idx.length - 1 ? 'gable' : roof.edges[k])),",
    with: "      edges: idx.map(k => roof.edges[k]),",
    test: "two nodes picked, BREAK ROOF splits the roof between them" },
  { file: 'model/09-draw-move-stretch.js', name: "UNDO leaves the broken-off piece", spec: 'tests/model-html-roof-move.spec.js',
    find: "      if (at >= 0) list0.splice(at, 1);\n",
    with: "",
    test: "two nodes picked, BREAK ROOF splits the roof between them" },
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
