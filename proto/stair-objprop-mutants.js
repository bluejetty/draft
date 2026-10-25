#!/usr/bin/env node
// MUTATION GATE for a stair in OBJ / PROP (Movie, 25 Oct): a click on a
// stair opens the window on its PLAN and SECTION, the lower boxes gone; a
// riser more or less, kept in the file, inside 6" and 7 7/8", its flight a
// tread longer or shorter and its well cut again, one UNDO for it; WIDTH,
// never under 36", growing away from a wall it lies on; the width said on
// the plan's first dropped step and changed there by a double-click; and the
// shower's size mark inside its lip; and a WC floor MOVEd off its walls
// letting go of them rather than tearing. Each row breaks one line, runs the one
// test that should notice, and restores from HEAD.
//
//   node proto/stair-objprop-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/stair-objprop.spec.js';
const SHOWER = 'tests/fixture-size-mark.spec.js';
const SPECS = [SPEC, SHOWER, 'tests/room-shape.spec.js'];

const MUTANTS = [
  { file: 'model/15-panels.js',
    name: 'a click on a stair leaves OBJ / PROP shut',
    find: "    if ((objPieces().length || objStair()) && !objOpen) { setObjOpen(true); return; }\n",
    with: "    if (objPieces().length && !objOpen) { setObjOpen(true); return; }\n",
    test: 'a click on a stair opens' },
  { file: 'model.css',
    name: 'the two lower boxes stay up for a stair',
    find: '  #objprop[data-objprop-kind="stair"] figure:nth-child(n+3) { display:none; }\n',
    with: '',
    test: 'a click on a stair opens' },
  { file: 'stair-geometry.js',
    name: 'the drafter\'s riser count is ignored',
    find: "      && stair.riserCount >= range.fewest && stair.riserCount <= range.most ? stair.riserCount : null;\n",
    with: "      && stair.riserCount >= range.fewest && stair.riserCount <= range.most ? null : null;\n",
    test: 'RISERS +:' },
  { file: 'drawing-format.js',
    name: 'the riser count is not kept in the file',
    find: "        ...(Number.isInteger(riserCount) && riserCount > 0 ? { riserCount } : {}),\n",
    with: '',
    test: 'RISERS +:' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'the flight keeps its old length',
    find: "    const end = SG.stairEndFor(stair, layout);\n    stair.end = { x: end.x, y: 0, z: end.z };\n",
    with: "    const end = SG.stairEndFor(stair, layout);\n",
    test: 'RISERS +:' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'UNDO forgets the stair itself',
    find: "      { kind: 'props', edits: [{ item: stair, before }, ",
    with: "      { kind: 'props', edits: [",
    test: 'RISERS +:' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'one riser fewer than the 7 7/8" allows',
    find: "    if (!range || next < range.fewest) {\n",
    with: "    if (!range) {\n",
    test: 'at the fewest is refused' },
  { file: 'stair-geometry.js',
    name: 'the 6" least is not a floor',
    find: "    const most = Math.max(fewest, Math.floor(riseIn / minIn + 1e-9));\n",
    with: "    const most = Math.max(fewest, Math.floor(riseIn / 5 + 1e-9));\n",
    test: 'past the 6" least' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'the well is not cut again',
    find: "    const ring = hole && stairOpeningFootprint(stair);\n    if (ring && ring.length >= 3) hole.points = ring.map(pt => ({ x: pt.x, z: pt.z }));\n    const reframed",
    with: "    const reframed",
    test: 'WIDTH 42' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'a stair under 36" is let through',
    find: "    if (!(want >= stairMinWidthIn())) {\n",
    with: "    if (!(want > 0)) {\n",
    test: 'WIDTH 42' },
  { file: 'model/12-garage-storeys-stairs.js',
    name: 'a stair on a wall grows both ways',
    find: "      const shift = lock?.left && !lock?.right ? half - now : lock?.right && !lock?.left ? now - half : 0;\n",
    with: "      const shift = 0;\n",
    test: 'grows away from it' },
  { file: 'model/03-plan-paint.js',
    name: 'the width mark is three steps down',
    find: "      const nose = { x: run.start.x + run.dir.x * step, z: run.start.z + run.dir.z * step };\n",
    with: "      const nose = { x: run.start.x + run.dir.x * step * 3, z: run.start.z + run.dir.z * step * 3 };\n",
    test: 'the plan says the width' },
  { file: 'model/16-gestures-undo.js',
    name: 'ENTER on the plan\'s width box changes nothing',
    find: "      if (keep) { setStairWidth(mark.stair, value); showSelectionProps(); renderObjProp(); }\n",
    with: '',
    test: 'the plan says the width' },
  { file: 'model/16-gestures-undo.js',
    name: 'Esc on the plan\'s width box sets it anyway',
    find: "      if (ev.key === 'Escape') { ev.preventDefault(); settle(false); }\n    });\n    box.addEventListener('blur', () => settle(false));\n    document.body.appendChild(box);\n    box.focus();\n    box.select();\n  };\n  canvas.addEventListener('dblclick', e => {\n    if (!drawing || activeTool !== RESTING_TOOL || activeCut() || stairWorkspaceOn()) return;\n    const r = canvas",
    with: "      if (ev.key === 'Escape') { ev.preventDefault(); settle(true); }\n    });\n    box.addEventListener('blur', () => settle(false));\n    document.body.appendChild(box);\n    box.focus();\n    box.select();\n  };\n  canvas.addEventListener('dblclick', e => {\n    if (!drawing || activeTool !== RESTING_TOOL || activeCut() || stairWorkspaceOn()) return;\n    const r = canvas",
    test: 'the plan says the width' },
  { file: 'model/02-holograms-tags.js',
    name: 'the shower\'s mark goes back outside its lip',
    find: "          take(fx, label, draw(lineAt(geo, a0, a1, curb, SIZE_MARK_IN_PX), label));\n",
    with: "          take(fx, label, draw(lineAt(geo, a0, a1, geo.frontOff, -SIZE_MARK_OFF_PX), label));\n",
    spec: 'tests/fixture-size-mark.spec.js',
    test: 'inside its lip' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'a moved floor stays tied to walls that stay',
    find: "          if (!pt.link || chosen.has(linkWall(pt))) return;\n          detached.push({ wall: item.points, key: index, orig: pt });\n          item.points[index] = { x: pt.x, z: pt.z };\n        });\n        return;\n      }\n      if (type !== 'wall') return;\n      ['start', 'end'].forEach(key => {\n        if (!held.has(item[key]) || pinned.has(item[key])) return;",
    with: "          return;\n        });\n        return;\n      }\n      if (type !== 'wall') return;\n      ['start', 'end'].forEach(key => {\n        if (!held.has(item[key]) || pinned.has(item[key])) return;",
    spec: 'tests/room-shape.spec.js',
    test: 'MOVE on a floor tied' },
];

const run = (name, spec = SPECS.join(' ')) => {
  try {
    execSync(`npx playwright test ${spec} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4567' } });
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
  let result = run(m.test, m.spec || SPEC);
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
