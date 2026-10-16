// DOES THE SPEC CATCH A ROOF LINE THAT SAYS NOTHING, OR A BG THAT DOES NOTHING?
//
// Movie, 16 Oct: "add the ROOf lines to show how the overhand and hips/valleys
// will show up ... in realy thin lins", "only show it on the right window if
// the ROOF is selected (or selected as a BACKGROUND laryer)", and "add a BG
// button to each of those and if they press the BG button that LEVEL will show
// up lightweight in the background".
//
// Drawing is where wrong answers hide, because almost all of them still draw:
// a thin line that traces the bone again, a hairline at the bone's weight, an
// eave fitted outside the window, lines the right window shows whatever is
// picked, a BG that latches on and never off, a BG that leaves the roof's own
// lines behind. Each of those is a mutant here.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/boneyard-roof-lines-and-bg.spec.js';

const MUTANTS = [
  { file: 'boneyard-loops.js',
    name: 'the overhang is never drawn: the roof shows where its walls are '
      + 'and not where its edge is',
    find: "      roofThin.push({ kind: 'eave', closed: true, points: pts, elev });",
    with: '',
    test: 'the roof\'s overhang and the lines where its planes meet are drawn in the 3D' },

  { file: 'boneyard-loops.js',
    name: 'the thin outline traces the BONE instead of the roof -- a second '
      + 'line over the first, saying nothing',
    find: '      const pts = (roof.points || []).map(p => ({ x: Number(p.x), z: Number(p.z) }));',
    with: '      const pts = footprint(roof) || [];',
    test: 'the eave is the roof\'s own outline' },

  { file: 'boneyard-loops.js',
    name: 'the hips, valleys and ridges are left out, so the roof is an '
      + 'outline with nothing happening inside it',
    find: '      const arcs = (G && G.roofSkeleton) ? G.roofSkeleton(roof) || [] : [];',
    with: '      const arcs = [];',
    test: 'the roof\'s overhang and the lines where its planes meet are drawn in the 3D' },

  { file: 'boneyard-loops.js',
    name: 'the lines are left in feet when the bones are scaled to the '
      + 'window, which draws them off the edge of it',
    find: '        thinPolys: l.thinPolys.map(line => ({ ...line,\n'
      + '          points: line.points.map(p => ({ x: ox + p.x * scale, y: oy + p.y * scale })) })),',
    with: '        thinPolys: l.thinPolys,',
    test: 'the roof\'s overhang and the lines where its planes meet are drawn in the 3D' },

  { file: 'BONEYARD.html',
    name: 'the eave is left out of the frame, so the overhang is drawn past '
      + 'the edge of the window it hangs over',
    find: '      const framePoints = l => [...l.loops.flatMap(loop => loop.points),\n'
      + '        ...(l.thin || []).flatMap(line => line.points)];',
    with: '      const framePoints = l => l.loops.flatMap(loop => loop.points);',
    test: 'the eave is the roof\'s own outline' },

  { file: 'BONEYARD.html',
    name: 'the thin lines are drawn at the bone\'s weight: "very very thin" '
      + 'becomes another storey in the stack',
    find: '      const THIN_PX = 0.6;',
    with: '      const THIN_PX = 3;',
    test: 'they are hairline' },

  { file: 'BONEYARD.html',
    name: 'a hip is closed like a loop, so every one of them is drawn twice '
      + 'and the thinnest line in the window is the heaviest',
    find: '          if (line.closed) ctx.closePath();',
    with: '          ctx.closePath();',
    test: 'they are hairline' },

  { file: 'BONEYARD.html',
    name: 'the picked level\'s own thin lines are not drawn, so picking the '
      + 'ROOF shows the wall line and nothing else',
    find: '        strokeThin(ctx, level.thin, level.color, toScreen);\n'
      + '        if ((level.thin || []).length) {',
    with: '        if ((level.thin || []).length) {',
    test: 'they are hairline' },

  { file: 'BONEYARD.html',
    name: 'every level is behind every other one again, always -- which is '
      + 'the thing the BG button was asked for instead of',
    find: '          && !(l.kind === level.kind && l.levelId === level.levelId)\n'
      + '          && bg.has(keyOf(l)));',
    with: '          && !(l.kind === level.kind && l.levelId === level.levelId));',
    test: 'the right window keeps the roof\'s lines to itself' },

  { file: 'BONEYARD.html',
    name: 'a level put behind leaves its own thin lines in front: a roof '
      + 'behind a floor plan with no overhang to line up against',
    find: '          strokeThin(ctx, l.thin, l.color, toScreen);\n'
      + '          if ((l.thin || []).length) thinDrawn.push',
    with: '          if ((l.thin || []).length) thinDrawn.push',
    test: 'BG puts a level behind the one being edited' },

  { file: 'BONEYARD.html',
    name: 'BG latches on and never off, so a stack put behind cannot be '
      + 'cleared without picking every level in turn',
    find: '            if (bg.has(key)) bg.delete(key); else bg.add(key);',
    with: '            bg.add(key);',
    test: 'BG puts a level behind the one being edited' },

  { file: 'BONEYARD.html',
    name: 'the BG press does not repaint, so the window answers on the next '
      + 'press of something else instead of this one',
    find: '            paintLegend();\n            paint2d();',
    with: '            paintLegend();',
    test: 'BG puts a level behind the one being edited' },

  { file: 'BONEYARD.html',
    name: 'the level being edited offers a BG of itself, which is a press '
      + 'that can only do nothing',
    find: '          back.disabled = isPicked;',
    with: '          back.disabled = false;',
    test: 'a level cannot be put behind itself' },

  { file: 'BONEYARD.html',
    name: 'only the roof gets a BG button, so the floors cannot be lined up '
      + 'against each other at all',
    find: "          back.dataset.boneBg = level.name;",
    with: "          back.dataset.boneBg = level.kind === 'roof' ? level.name : '';",
    test: 'a level cannot be put behind itself' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4377' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it, and a guard that fires
// only afterwards lets you walk away believing the gate is running.
const dirty = execSync('git status --porcelain BONEYARD.html boneyard-loops.js',
  { cwd: ROOT }).toString().trim();
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
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}

// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
