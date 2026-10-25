#!/usr/bin/env node
// MUTATION GATE for MOVE (M) and STRETCH (H) in the DRAFTING keys
// (tests/move-stretch.spec.js).
//
// Movie, 20 Oct: "add another command- 2 more - for the DRAFTING area - MOVE
// "M" and also STRETCH ... automatically also glow the SELECT button and
// bring up the rectagle select" -- "all the ASSEMBLED units with even a small
// part withint the rectabgle should be FULLY dragged along 'in tact'"; doors
// and windows "keep em put"; a suite the box touches moves whole.
//
// Run: node proto/move-stretch-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/move-stretch.spec.js';
const MUTANTS = [
  { file: 'tool-roster.js', name: 'no STRETCH key',
    find: "    { id: 'stretch',      name: 'STRETCH',      group: 'draw',  kind: 'contextual', command: 'stretch' },\n",
    with: '',
    test: 'MOVE and STRETCH are in the DRAFTING keys' },
  { file: 'profile-manager.js', name: 'STRETCH on no letter',
    find: "    stretch: 'H',\n",
    with: '',
    test: 'MOVE and STRETCH are in the DRAFTING keys' },
  { file: 'model/14-promotion-tools.js', name: 'SELECT does not glow under STRETCH',
    find: "      if (next === 'stretch') btn.setAttribute('data-stretch-glow', ''); else btn.removeAttribute('data-stretch-glow');",
    with: "      btn.removeAttribute('data-stretch-glow');",
    test: 'MOVE and STRETCH are in the DRAFTING keys' },
  { file: 'model/14-promotion-tools.js', name: 'M arms a tool instead of the foot MOVE',
    find: "    if (id === 'move') {\n      if (!selection.length && !moveState.on) {",
    with: "    if (false) {\n      if (!selection.length && !moveState.on) {",
    test: 'M with nothing picked' },
  { file: 'model/09-draw-move-stretch.js', name: 'a point inside the box stays put',
    find: "      rotatePointsOf(entry).forEach(p => { if (inBox(box, p)) points.add(p); });",
    with: "      rotatePointsOf(entry).forEach(p => { if (inBox(box, p) && false) points.add(p); });",
    test: 'the top edge pulled up 5 ft' },
  { file: 'model/09-draw-move-stretch.js', name: 'the window is not kept put',
    find: "        if (Math.abs(next - offset) > 1e-9) edits.push({ item: o, before: { ...o }, offset: next });",
    with: '',
    test: 'the top edge pulled up 5 ft' },
  { file: 'model/09-draw-move-stretch.js', name: 'a window inside the box is kept to the staying end',
    find: "        const rides = inBox(box, centreOf(offset)) ? (sMoves ? 'start' : 'end') : (sMoves ? 'end' : 'start');",
    with: "        const rides = sMoves ? 'end' : 'start';",
    test: 'a window inside the box rides' },
  { file: 'model/09-draw-move-stretch.js', name: 'an assembly is stretched like loose lines',
    find: "      if (unit) {\n        if (doneGroups.has(unit)) return;",
    with: "      if (false) {\n        if (doneGroups.has(unit)) return;",
    test: 'an ASSEMBLY with a small part' },
  { file: 'model/09-draw-move-stretch.js', name: 'a suite hologram stays behind',
    find: "      holo.z = (Number(holo.z) || 0) + dz;\n",
    with: '',
    test: 'a SUITE hologram the box touches' },
  { file: 'model/09-draw-move-stretch.js', name: 'the window offset is not in the undo',
    find: "    offsets.forEach(({ item, before: was, offset }) => { props.push({ item, before: was }); item.offset = offset; });",
    with: "    offsets.forEach(({ item, offset }) => { item.offset = offset; });",
    test: 'one UNDO puts the whole stretch back' },
  { file: 'model/14-promotion-tools.js', name: 'a typed length is not taken',
    find: "    if (stretchTypable()) { stretchByTyped(); return; }\n",
    with: '',
    test: 'a typed length finishes it' },
  { file: 'model/16-gestures-undo.js', name: 'Esc leaves the half-made box',
    find: "      || stretchState.a);\n    drawStart = null;\n    stretchState = { a: null, b: null, base: null };",
    with: "      || stretchState.a);\n    drawStart = null;",
    test: 'Esc puts a half-made box down' },
  { file: 'model/13-suites-trim-follow.js', name: 'the strip throws after the base point',
    find: "    const stretchReady = !moveReady && stretchTypable();",
    with: "    const stretchReady = false && stretchTypable();\n    const _m = stretchTypable() ? moveTyped.dx : 0;",
    test: 'the top edge pulled up 5 ft' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4469' } });
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
