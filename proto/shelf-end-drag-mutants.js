#!/usr/bin/env node
// MUTATION GATE for a wall's end dragged on the shelf, the inside corners'
// cross lines and the inch join (Movie, 22 Oct). Each row breaks one line,
// runs the one test that should notice, and restores the file from HEAD.
//
//   node proto/shelf-end-drag-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/shelf-end-drag.spec.js';

const MUTANTS = [
  { file: 'model/07-walls-magnet.js',
    name: 'the shelf offers no end to grab, as before',
    find: "      if (lone && outlines().includes(lone)) {\n        const G = window.DraftGeometry2D;\n        return G.nearestVertex(lone.points || [], worldPt, CORNER_GRAB_PX / view.scale);\n      }\n    }",
    with: "      if (lone && outlines().includes(lone)) {\n        const G = window.DraftGeometry2D;\n        return G.nearestVertex(lone.points || [], worldPt, CORNER_GRAB_PX / view.scale);\n      }\n      return null;\n    }",
    test: 'on the shelf a selected wall' },
  { file: 'model/10-tracking-garage.js',
    name: 'a dragged end sends no cross lines',
    find: "      md.rays ||= dragMagnet(md.before[0].vtx).corners;\n      return md.rays.filter(c => litRays([c], cursorWorld).length);\n",
    with: "      return [];\n",
    test: 'the inside corner sends its cross line' },
  { file: 'model/16-gestures-undo.js',
    name: 'the rays read a cursor left where the press was',
    find: "          cursorWorld = raw;\n          const snapped = hit?.pt || null;\n",
    with: "          const snapped = hit?.pt || null;\n",
    test: 'the inside corner sends its cross line' },
  { file: 'model/16-gestures-undo.js',
    name: 'the cross line does not pull the end',
    find: "          const pt = joined ? joined.pt : landed;\n",
    with: "          const pt = joined ? joined.pt : (snapped || (footOn ? onTheFoot(from, { x: wanted.x, z: wanted.z }, 0) : wanted));\n",
    test: 'with the SNAP light off the cross line alone pulls' },
  { file: 'model/16-gestures-undo.js',
    name: 'no inch join',
    find: "          const joined = board !== 'toy'\n            ? inchJoin(grabbed.vtx, landed, (md.segs ||= dragMagnet(grabbed.vtx).segs)) : null;\n",
    with: "          const joined = null;\n",
    test: 'dropped within an inch of a face it crosses' },
  { file: 'model/07-walls-magnet.js',
    name: 'the inch is two',
    find: "  const INCH_JOIN_FT = 1 / 12;\n",
    with: "  const INCH_JOIN_FT = 2 / 12;\n",
    test: 'dropped within an inch of a face it crosses' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4532' } });
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
