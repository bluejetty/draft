// DOES THE §1 SPEC CATCH A GESTURE THAT STOPPED WORKING?
//
// The gate for tests/model-toy-draw.spec.js. Same two hardenings as the five
// before it: an ambiguous anchor is refused rather than guessed at, and a
// survivor is re-run against the whole spec before it is called one.
//
// WHAT IT IS ARRANGED AGAINST. §1 has TWO gestures and ONE commit, and the
// failure that matters is not "no wall appeared" -- it is the two gestures
// quietly diverging while both still produce a plausible wall. Mutants 3 and 4
// break exactly one pointer's path and leave the other's alone; if the check
// that compares them to each other were replaced by two checks against a
// constant, those two would survive.
//
// And mutant 6 is the defect that was actually shipped: the readout measured
// through squareTo while the commit went through drawPoint, so on TOY the
// strip read 5.4 over a wall that committed at 5. Both numbers were present
// the whole time. Only asserting them EQUAL sees it.
const { execSync } = require('child_process');
const fs = require('fs');

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the lift stops placing the line',
    find: '    const rect = canvas.getBoundingClientRect();\n    drawPress(toWorld(e.clientX - rect.left, e.clientY - rect.top));\n  });',
    with: '  });',
    test: 'a press, a drag and a lift' },
  { file: 'MODEL.html',
    name: 'every lift commits, so a PC click makes a zero-length wall',
    find: '    if (press.opened ? !travelled : !press.touch) return;',
    with: '',
    test: 'click-move-click reaches the same wall' },
  { file: 'MODEL.html',
    name: 'a finger commits on the down again, so the drag after it is ignored',
    find: "      if (wallPress.touch && drawStart) { paint(); return; }",
    with: '',
    // RE-AIMED: this pointed at the mouse gesture, which the mutant does not
    // touch. It is the finger's press-again-and-drag that it breaks.
    test: 'presses again and drags' },
  { file: 'MODEL.html',
    name: 'the mouse stops committing on the down',
    find: "      if (wallPress.touch && drawStart) { paint(); return; }",
    with: '      if (drawStart) { paint(); return; }',
    test: 'click-move-click reaches the same wall' },
  { file: 'MODEL.html',
    name: 'the drag threshold goes, so the first press commits on its own lift',
    find: '    const travelled = Math.hypot(e.clientX - press.x, e.clientY - press.y) >= DRAG_ARM_PX;',
    with: '    const travelled = true;',
    // RE-AIMED at the check written for it. The threshold's real job is
    // absorbing a tremor, not rescuing the PC click -- drawPress already does
    // that -- so the tremor check is the one that can see it go.
    test: 'a tremor during the press' },
  { file: 'MODEL.html',
    name: 'THE SHIPPED DEFECT: the readout measures the cursor, the commit rounds it',
    find: "    if (drawStart && activeTool === 'wall') return { from: drawStart, to: drawPoint(cursorWorld) };",
    with: "    if (drawStart && activeTool === 'wall') return { from: drawStart, to: squareTo(drawStart, cursorWorld) };",
    test: 'the length on screen is the length that gets committed' },
  { file: 'MODEL.html',
    name: 'the length never appears',
    find: '    drawLenEl.hidden = false;',
    with: '    drawLenEl.hidden = true;',
    test: 'the length on screen is the length that gets committed' },
  { file: 'MODEL.html',
    name: 'the length stays on screen after the run ends',
    find: '    if (!run || !pointerScreen) { drawLenEl.hidden = true; return; }',
    with: '    if (!run || !pointerScreen) return;',
    test: 'goes out when the run does' },
  { file: 'MODEL.html',
    name: 'the squaring moves into the gesture, so TOY leaks into DRAFTING',
    find: "    return board === 'toy' ? onTheFoot(drawStart, free) : free;",
    with: '    return onTheFoot(drawStart, free);',
    test: 'DRAFTING keeps the off-axis' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-toy-draw.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: '/home/user/draft', stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: '/home/user/draft' }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `/home/user/draft/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: '/home/user/draft' });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
