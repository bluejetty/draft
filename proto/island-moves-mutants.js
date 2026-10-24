#!/usr/bin/env node
// MUTATION GATE for the island, its pieces and its size (Movie, 20 Oct):
// "move sink / dw in island back an forth / and they shouldn't overlap ...
// no title ... click on the island and change the dimensions size ... move
// the island independantly". Each row breaks one line of one file,
// runs the one test that should notice, and restores the file from HEAD.
//
//   node proto/island-moves-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/island-moves.spec.js';

const MUTANTS = [
  { file: 'render-2d.js',
    name: 'the island gets its name back',
    find: "      if (!melded) { rect(a0 - o, a1 + o, cMin - o, cMax + o); ctx.stroke(); }\n    } else if (kind === 'pantry') {",
    with: "      if (!melded) { rect(a0 - o, a1 + o, cMin - o, cMax + o); ctx.stroke(); }\n      if (pxPerFt > 6) { const c = toS(geo.center); ctx.fillStyle = env.FIXTURE_COLOR; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('ISLAND', c.x, c.y); }\n    } else if (kind === 'pantry') {",
    test: 'the island carries no name; its dishwasher still says DW' },
  { file: 'MODEL.html',
    name: 'a piece slides over its mates',
    find: "      const at = FG.slideClamp(sideSnap(fixture, md.was.offset + dAlong, half), half, bounds, blocks);\n",
    with: "      const at = FG.slideClamp(sideSnap(fixture, md.was.offset + dAlong, half), half, bounds, []);\n",
    test: 'the dishwasher slides inside its island and stops at the sink, never over it' },
  { file: 'MODEL.html',
    name: 'a piece slides out of its island',
    find: "        ? [Number(md.island.offset) - Number(md.island.width) / 2, Number(md.island.offset) + Number(md.island.width) / 2]\n",
    with: "        ? [0, frame.len]\n",
    test: 'the dishwasher slides inside its island and stops at the sink, never over it' },
  { file: 'MODEL.html',
    name: 'the island stays on its aisle',
    find: "      const standoff = Math.max(0, md.was.standoff + side * dAcross);\n",
    with: "      const standoff = md.was.standoff;\n",
    test: 'the island dragged goes along the wall and off it, its sink and dishwasher riding' },
  { file: 'MODEL.html',
    name: 'the pieces stay behind',
    find: "      md.riders.forEach(r => { r.item.offset = r.offset + (offset - md.was.offset); setStandoff(r.item, standoff); });\n",
    with: "",
    test: 'the island dragged goes along the wall and off it, its sink and dishwasher riding' },
  { file: 'MODEL.html',
    name: 'the release writes no undo',
    find: "      undoStack.push(withLinks({ kind: 'props', edits: md.edits }));\n",
    with: "",
    test: 'the island dragged goes along the wall and off it, its sink and dishwasher riding' },
  { file: 'MODEL.html',
    name: 'a narrower island leaves its pieces hanging out',
    find: "        ...(f.kind === 'island' ? islandPiecePatches(f, Number(f.offset) || 0, feet) : [])]));\n",
    with: "        ]));\n",
    test: 'clicking the island opens WIDTH, DEPTH and AISLE; a narrower island pulls its pieces in; UNDO puts it back' },
  { file: 'MODEL.html',
    name: 'the panel has no AISLE for an island',
    find: "    if (items.every(f => f.kind === 'island')) {\n      box.append(field('AISLE'",
    with: "    if (false) {\n      box.append(field('AISLE'",
    test: 'clicking the island opens WIDTH, DEPTH and AISLE; a narrower island pulls its pieces in; UNDO puts it back' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4520' } });
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
