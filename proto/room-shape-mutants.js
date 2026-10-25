#!/usr/bin/env node
// MUTATION GATE for a room tag's shape: the floor it is, the flooring it
// lays, and the corners that link to the walls' nodes (Movie, 23 Oct). Each
// row breaks one line, runs the one test that should notice, and restores
// the file from HEAD.
//
//   node proto/room-shape-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/room-shape.spec.js';

const MUTANTS = [
  { file: 'model/08-structure-roof.js',
    name: 'a placed tag has no shape',
    find: "      points: roomSquare(at),\n",
    with: "",
    test: 'ROOM TAG placed by hand starts as a 3 ft square' },
  { file: 'model/16-gestures-undo.js',
    name: 'the name dragged leaves its square behind',
    find: "          if (md.points) md.tag.points = md.points.map(({ pt }) => (carry ? { x: pt.x + dx, z: pt.z + dz } : pt));\n",
    with: "",
    test: 'ROOM TAG placed by hand starts as a 3 ft square' },
  { file: 'model/16-gestures-undo.js',
    name: 'the name moved inside its floor drags the floor too',
    find: "          const carry = !!md.points && !inside && md.points.every(({ free }) => free);\n",
    with: "          const carry = !!md.points && md.points.every(({ free }) => free);\n",
    test: 'ROOM TAG placed by hand starts as a 3 ft square' },
  { file: 'model/16-gestures-undo.js',
    name: 'a corner dropped on a wall\'s node is not linked to it',
    find: "          } else pt = caught || { x, z };\n",
    with: "          } else pt = caught ? { x: caught.x, z: caught.z } : { x, z };\n",
    test: 'a corner dragged onto a wall\'s node links there' },
  { file: 'model/17-boot-save.js',
    name: 'a saved link is lost on load',
    find: "        const v = G.mergeVertex(vertexPool, p, tag.levelId, 'plan', 'house');\n",
    with: "        const v = { x: p.x, z: p.z };\n",
    test: 'a press on a linked corner asks' },
  { file: 'model/16-gestures-undo.js',
    name: 'a linked corner drags without asking',
    find: "      if (loopKind === 'roomtag' && handle.kind === 'corner' && wallsOnCorner(pts[handle.index]).length) {\n        askRoomCorner(shapedTag, handle.index);\n        return;\n      }\n",
    with: "",
    test: 'a press on a linked corner asks' },
  { file: 'model/07-walls-magnet.js',
    name: 'DE-LINK leaves the corner on the wall\'s node',
    find: "      tag.points = tag.points.map((p, i) => (i === index ? { x: p.x, z: p.z } : p));\n",
    with: "      tag.points = tag.points.slice();\n",
    test: 'a press on a linked corner asks' },
  { file: 'model/16-gestures-undo.js',
    name: 'an edge\'s midpoint grows no corner',
    find: "        points.splice(index + 1, 0, { x: (q.x + r.x) / 2, z: (q.z + r.z) / 2 });\n        index += 1;\n",
    with: "",
    test: 'an edge\'s midpoint pressed grows a corner' },
  { file: 'model/16-gestures-undo.js',
    name: 'a corner dropped on its neighbour stays',
    find: "            if (pts.length > 3 && (same(pts[i], next) || same(pts[i], prev))) pts.splice(i, 1);\n",
    with: "",
    test: 'an edge\'s midpoint pressed grows a corner' },
  { file: 'drawing-format.js',
    name: 'an area switched off still counts in the roll-up',
    find: "        areaSqFt: shaped ? (areaShown ? loopAreaSqFt(points) : 0) : (area > 0 ? area : 0),",
    with: "        areaSqFt: shaped ? loopAreaSqFt(points) : (area > 0 ? area : 0),",
    test: 'SHOW AREA off counts nothing' },
  { file: 'model/17-boot-save.js',
    name: 'the file keeps a stale area',
    find: "        ? { ...tag, points: tag.points.map(p => ({ ...point(p), ...(p.link ? { link: { ...p.link } } : {}) })), areaSqFt: roomTagArea(tag) }\n",
    with: "        ? { ...tag, points: tag.points.map(p => ({ ...point(p), ...(p.link ? { link: { ...p.link } } : {}) })) }\n",
    test: 'SHOW AREA off counts nothing' },
  { file: 'model/16-gestures-undo.js',
    name: 'a face corner takes no link',
    find: "          const face = window.DraftGeometry2D.nearestVertex(wallFaceNodes(), raw, reach);\n",
    with: "          const face = null;\n",
    test: 'a corner dropped on the inside corner of two walls' },
  { file: 'model/03-plan-paint.js',
    name: 'a linked corner never follows its wall',
    find: "    if (typeof followRoomLinks === 'function') followRoomLinks();\n",
    with: "",
    test: 'a corner dropped on the inside corner of two walls' },
  { file: 'drawing-format.js',
    name: 'the file forgets a corner\'s link',
    find: "          return { x: p.x, z: p.z, ...(link ? { link } : {}) };\n",
    with: "          return { x: p.x, z: p.z };\n",
    test: 'a corner dropped on the inside corner of two walls' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'a dropped WC\'s corners are not linked',
    find: "      const link = roomLinkAt({ x: p.x, z: p.z });\n      return { x: p.x, z: p.z, ...(link ? { link } : {}) };\n",
    with: "      return { x: p.x, z: p.z };\n",
    test: 'a dropped WC brings its tag' },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'a dropped WC brings no tag',
    find: "    const tag = inside.length >= 3 ? addItem(drawing.roomTags, {",
    with: "    const tag = inside.length >= 300 ? addItem(drawing.roomTags, {",
    test: 'a dropped WC brings its tag' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4553' } });
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
