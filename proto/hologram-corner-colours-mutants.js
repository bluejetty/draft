#!/usr/bin/env node
// MUTATION GATE for the suites' corner colours (Movie, 23 Oct): a hologram's
// corner rings in its file's colour, a shelf's in its copies', the gold
// registration corner kept. Each row breaks one line, runs the one test that
// should notice, and restores the file from HEAD.
//
//   node proto/hologram-corner-colours-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/hologram-corner-colours.spec.js';

const MUTANTS = [
  { file: 'model/02-holograms-tags.js',
    name: 'a hologram\'s corners stay aqua',
    find: "      const ink = H().colourOf?.(holo, drawing)?.ink || null;\n",
    with: "      const ink = null;\n",
    test: 'on the plan, each suite' },
  { file: 'model/02-holograms-tags.js',
    name: 'the dot painter ignores the ink it is handed',
    find: "    const ink = gold ? (skin['draw-origin'] || SUPER_NODE_INK) : (own || SUPER_NODE_INK);\n",
    with: "    const ink = gold ? (skin['draw-origin'] || SUPER_NODE_INK) : SUPER_NODE_INK;\n",
    test: 'on the plan, each suite' },
  { file: 'model/02-holograms-tags.js',
    name: 'the registration corner takes the colour too',
    find: "        if (n.registration === true) superDot(n.point, { ring: true, ink, gold: true });\n",
    with: "        if (n.registration === true) superDot(n.point, { ring: true, ink, gold: false });\n",
    test: 'on the plan, each suite' },
  { file: 'model/05-props-shelves-rail.js',
    name: 'the shelf squares stay grey',
    find: "      if (Number(levelId) < 0) paintSuperNodes();\n",
    with: "",
    test: 'the shelf squares above the bone' },
  { file: 'model/02-holograms-tags.js',
    name: 'a shelf cannot find its copies\' colour',
    find: "    const twin = holograms().find(holo => String(H().fileOf(holo) || '').trim().toUpperCase() === name);\n",
    with: "    const twin = null;\n",
    test: 'the shelf squares above the bone' },
  { file: 'model/02-holograms-tags.js',
    name: 'the shelf\'s corners are not drawn on the shelf itself',
    find: "    if (shelfLevel < 0 && H()?.shelfSuperNodes) {\n",
    with: "    if (false) {\n",
    test: 'on the shelf itself' },
  { file: 'hologram.js',
    name: 'a shelf\'s registration corner is not marked',
    find: "  const shelfSuperNodes = (walls, levelId, turn = 0) => registered(cornerSuperNodes(walls, levelId), walls, levelId, turn);\n",
    with: "  const shelfSuperNodes = (walls, levelId, turn = 0) => cornerSuperNodes(walls, levelId);\n",
    test: 'on the shelf itself' },
  { file: 'model/02-holograms-tags.js',
    name: 'the shelf\'s registration is read at turn 0 whatever the drawing\'s turn',
    find: "      H().shelfSuperNodes(walls(), shelfLevel, drawing?.planTurn || 0).forEach(n => superDot(n.point, { ring: true, gold: n.registration === true, ink }));\n",
    with: "      H().shelfSuperNodes(walls(), shelfLevel).forEach(n => superDot(n.point, { ring: true, gold: n.registration === true, ink }));\n",
    test: 'on a turned drawing' },
  { file: 'model/02-holograms-tags.js',
    name: 'a shelf square\'s paint writes over the sheet\'s gold count',
    find: "    if (thumbTarget) return;\n    canvas.dataset.goldSuperNodes = String(goldDots);\n",
    with: "    canvas.dataset.goldSuperNodes = String(goldDots);\n",
    test: 'the shelf squares above the bone' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4544' } });
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
