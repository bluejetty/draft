#!/usr/bin/env node
// MUTATION GATE for a moved wall's faces seeking (tests/wall-face-seek.spec.js).
//
// Movie, 19 Oct: wall surfaces "magnetic for other wall surfaces/ nodes/ and
// 'act like' nodes". Four seams: the seek itself, the nodes, the foot's
// order, and the joined walls kept out.
//
// Run: node proto/wall-face-seek-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/wall-face-seek.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'a dragged wall\'s faces seek nothing',
    find: '          const seek = !toy && !ends && snapOn ? wallFaceSeek(md, dx, dz) : null;\n',
    with: '          const seek = null;\n',
    test: 'a dragged wall slides across its run until its face lines up with another wall\'s, and both faces glow' },
  { file: 'MODEL.html',
    name: 'a face passes no node',
    find: '      point(magnet.nodes, NODE_PULL_PX, true);\n',
    with: '',
    test: 'a dragged wall\'s face passes through a node, and takes the orange' },
  { file: 'MODEL.html',
    name: 'the foot beats a face that caught',
    find: '          else if (seek) { dx = seek.dx; dz = seek.dz; }\n          else if (footOn) {\n',
    with: '          else if (seek && !footOn) { dx = seek.dx; dz = seek.dz; }\n          else if (footOn) {\n',
    test: 'a face that catches beats the foot light' },
  { file: 'MODEL.html',
    name: 'a joined wall offers its faces',
    find: '    const still = walls().filter(w => w !== body && !touches(w.start) && !touches(w.end));\n',
    with: '    const still = walls().filter(w => w !== body);\n',
    test: 'a wall joined to the moving one offers no face' },
  { file: 'MODEL.html',
    name: 'the own face is not told',
    find: '      ...(lit.own ? { own: [[r4(lit.own.a.x), r4(lit.own.a.z)], [r4(lit.own.b.x), r4(lit.own.b.z)]] } : {}) }));\n',
    with: '    }));\n',
    test: 'a dragged wall slides across its run until its face lines up with another wall\'s, and both faces glow' },
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
