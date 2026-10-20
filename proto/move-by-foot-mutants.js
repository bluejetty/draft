#!/usr/bin/env node
// MUTATION GATE for the 1' light moving a selection by the foot (Movie, 20 Oct):
// "the '1'' key doesn't make it go 'by the foot' its length is still 'free'
// based on cursor position". Each row breaks one line of MODEL.html,
// runs the one test that should notice, and restores the file from HEAD.
//
//   node proto/move-by-foot-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/move-by-foot.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'MOVE ignores the light',
    find: "      if (footOn && Q && !d.set.across) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }\n",
    with: "",
    test: 'MOVE with the 1\' light lit carries the assembly a whole foot each way' },
  { file: 'MODEL.html',
    name: 'MOVE rounds one axis only',
    find: "      if (footOn && Q && !d.set.across) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }\n",
    with: "      if (footOn && Q && !d.set.across) { dx = Q.quantiseFeet(dx); }\n",
    test: 'MOVE with the 1\' light lit carries the assembly a whole foot each way' },
  { file: 'MODEL.html',
    name: 'the assembly drag ignores the light',
    find: "          if (footOn && Q) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }\n          md.before.forEach(b => { b.vtx.x = b.x + dx; b.vtx.z = b.z + dz; });\n",
    with: "          md.before.forEach(b => { b.vtx.x = b.x + dx; b.vtx.z = b.z + dz; });\n",
    test: 'an assembly dragged under SELECT lands on the foot too' },
  { file: 'MODEL.html',
    name: 'the lines drag ignores the light',
    find: "          if (footOn && Q) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }\n          const by = p => ({ ...p, x: p.x + dx, z: p.z + dz });\n",
    with: "          const by = p => ({ ...p, x: p.x + dx, z: p.z + dz });\n",
    test: 'and so do lines moved together' },
  { file: 'MODEL.html',
    name: 'the wall drag ignores the light',
    find: "          if (!toy && footOn && Q) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }\n",
    with: "",
    test: 'and a lone wall dragged by its body under SELECT' },
  { file: 'MODEL.html',
    name: 'the wall drag rounds along its run only',
    find: "          if (!toy && footOn && Q) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }\n",
    with: "          if (!toy && footOn && Q) { dx = Q.quantiseFeet(dx); }\n",
    test: 'and a lone wall dragged by its body under SELECT' },
  { file: 'MODEL.html',
    name: 'the catch is dropped with the light lit',
    find: "          const seek = !toy && !ends && snapOn ? wallFaceSeek(md, dx, dz) : null;\n",
    with: "          const seek = !toy && !ends && snapOn && !footOn ? wallFaceSeek(md, dx, dz) : null;\n",
    test: 'a face that catches moves the wall across to it and leaves the other axis on the foot' },
  { file: 'MODEL.html',
    name: 'the light is always on for MOVE',
    find: "      if (footOn && Q && !d.set.across) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }\n",
    with: "      if (Q && !d.set.across) { dx = Q.quantiseFeet(dx); dz = Q.quantiseFeet(dz); }\n",
    test: 'with the light off the move is free, as it was' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4514' } });
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
