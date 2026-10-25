#!/usr/bin/env node
// MUTATION GATE for holograms picked like assembly units, and the HOLOGRAM
// list's card per file (tests/hologram-units.spec.js).
//
// Movie, 20 Oct: "would it be possible to SELECT the HOLOGRAM UNITS as like
// selecting a ASSEMBLY unit - and allow the user to copy, flip rotate etc" --
// "can we do 1 per file (and 1 color per file) and then a list within that of
// each copy, with a number assigned and when they click it or scroll past it
// it will light up and its' suite will also light up".
//
// Run: node proto/hologram-units-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/hologram-units.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'a click on a hologram picks nothing',
    find: "      const holo = hologramPickAt(worldPt);\n      if ((holo) && take({ type: 'hologram', item: holo })) return out;",
    with: "      const holo = null;\n      if ((holo) && take({ type: 'hologram', item: holo })) return out;",
    test: "a click on a suite's own wall picks the whole suite" },
  { file: 'MODEL.html', name: 'the box passes holograms by',
    find: "        if (segs.length) out.push({ type: 'hologram', item, parts: segs, open: true });",
    with: '',
    test: 'the box catches suites' },
  { file: 'MODEL.html', name: 'MOVE leaves a hologram where it was',
    find: "          return { vtx: item, x: item.x, z: item.z, holo: true };",
    with: "          return { vtx: { x: item.x, z: item.z }, x: item.x, z: item.z, holo: true };",
    test: 'MOVE carries the picked suite' },
  { file: 'MODEL.html', name: 'ROTATE moves the pivot but never turns the hologram',
    find: "      holo.angleDeg = ((((Number(holo.angleDeg) || 0) + degrees) % 360) + 360) % 360;",
    with: '',
    test: 'ROTATE a quarter' },
  { file: 'MODEL.html', name: 'FLIP never turns a hologram over',
    find: "      if (holo.flip === true) delete holo.flip; else holo.flip = true;\n",
    with: '',
    test: 'FLIP left for right, both suites' },
  { file: 'MODEL.html', name: 'FLIP top for bottom forgets the half turn',
    find: "      holo.angleDeg = ((((axis === 'x' ? -a : 180 - a) % 360) + 360) % 360);",
    with: "      holo.angleDeg = ((((-a) % 360) + 360) % 360);",
    test: 'FLIP top for bottom' },
  { file: 'MODEL.html', name: 'a pasted hologram is filed on a level of ours',
    find: "        delete copy.levelId;\n        delete copy.demo;",
    with: "        delete copy.demo;",
    test: 'COPY and PASTE a suite' },
  { file: 'MODEL.html', name: 'a double-click on a suite is taken for a pick',
    find: "    if ((own && own.type !== 'hologram') || !hologramUnder(world)) return;",
    with: "    if (own || !hologramUnder(world)) return;",
    test: 'a double-click on a suite still opens the HOLOGRAM card' },
  { file: 'MODEL.html', name: 'one card per hologram, not per file',
    find: "      const key = H().fileOf(holo);\n      if (!files.has(key)) files.set(key, []);",
    with: "      const key = holo.id;\n      if (!files.has(key)) files.set(key, []);",
    test: 'the list: one card per file' },
  { file: 'MODEL.html', name: 'a row clicked picks nothing',
    find: "        setSelection([{ type: 'hologram', item: holo }]);\n        paint();",
    with: "        paint();",
    test: 'a row clicked picks its suite' },
  { file: 'MODEL.html', name: 'the pointer on a row lights nothing',
    find: "    if (!hologramHover || !holograms().includes(hologramHover)) return;",
    with: "    return;",
    test: 'the pointer passing a row' },
  { file: 'MODEL.html', name: 'a new file comes in with no colour of its own',
    find: "      ...(!sameFile && H()?.nextColour ? { colour: H().nextColour(drawing) } : {}) }]);",
    with: " }]);",
    test: 'a new file brought in takes a colour' },
  { file: 'hologram.js', name: 'every file the same colour',
    find: "    return Math.max(0, files.indexOf(key)) % COLOURS.length;",
    with: "    return 0;",
    test: 'the list: one card per file' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4500' } });
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
