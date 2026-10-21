#!/usr/bin/env node
// MUTATION GATE for BG: another layer drawn faded behind the plan in view,
// its nodes snapping (tests/bg-layers.spec.js).
//
// Movie, 21 Oct: "can you put a little BG button in each of the LAYOUT
// preview viewports and if somebody click the BG (to make it light up) the
// BACKGROUND will show that story BEHIND the current floor and slightly
// faded"; "we can turn on an off multiple at a time"; "i would like the
// NODES to work in the BG".
//
// Run: node proto/bg-layers-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/bg-layers.spec.js';
const MUTANTS = [
  { file: 'MODEL.html', name: 'the BG never painted',
    find: "        paintBackgrounds();\n",
    with: "",
    test: 'drawn behind the 2nd floor' },
  { file: 'MODEL.html', name: 'the BG painted at full strength',
    find: "      ctx.globalAlpha = BG_ALPHA;\n      paintFloors(); paintRoofs();",
    with: "      ctx.globalAlpha = 1;\n      paintFloors(); paintRoofs();",
    test: 'drawn behind the 2nd floor' },
  { file: 'MODEL.html', name: 'a press on BG walks to that plan instead',
    find: "          event.stopPropagation();\n          if (bgLayers.has(spec.seatId))",
    with: "          if (bgLayers.has(spec.seatId))",
    test: 'leaves the page where it is' },
  { file: 'MODEL.html', name: 'one BG at a time',
    find: "          if (bgLayers.has(spec.seatId)) bgLayers.delete(spec.seatId); else bgLayers.add(spec.seatId);",
    with: "          if (bgLayers.has(spec.seatId)) bgLayers.delete(spec.seatId); else { bgLayers.clear(); bgLayers.add(spec.seatId); }",
    test: 'leaves the page where it is' },
  { file: 'MODEL.html', name: 'BG on an elevation card too',
    find: "      bg.hidden = !spec.plan;",
    with: "      bg.hidden = false;",
    test: 'leaves the page where it is' },
  { file: 'MODEL.html', name: 'not remembered',
    find: "          saveBgLayers();\n",
    with: "",
    test: 'across a reload' },
  { file: 'MODEL.html', name: 'the BG walls do not pull the face-corner magnet',
    find: "        floors: drawing.floors || [], levels: drawing.levels || [] }) : [])).concat(bgWalls());",
    with: "        floors: drawing.floors || [], levels: drawing.levels || [] }) : []));",
    test: 'lands on that corner' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4507' } });
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
