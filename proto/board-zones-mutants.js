// DOES THE DRIVE-THRU SPEC CATCH A BOARD WHOSE ZONES HAVE COME OFF THE ART?
//
// The board is ONE PICTURE and every control on it is a percentage of that
// picture. That makes the art and the CSS two halves of one fact, and a fact
// in two places drifts -- which is exactly what happened on 20 Sep: Movie
// redrew the sign and its SHAPE changed, 2000x1550 landscape where the one
// before was 1020x1500 portrait, and the dog's speech ran off the bottom of
// the band it was measured for.
//
// WHAT MAKES THIS GATE WORTH HAVING is that the failure is invisible to every
// check that reads text or asks whether a control is visible. A line clipped
// in half by `overflow:hidden` is in the DOM, has a rectangle, and holds
// exactly the right string. Only a check that asks the BOX whether its
// contents fit, and a check that asks the IMAGE what is under each zone, can
// see it -- so those two are the ones the mutants below aim at.
//
// Run: node proto/board-zones-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-drivethru.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'THE SCREEN KEEPS THE PORTRAIT BOARD-S PERCENTAGES: the dog talks on the shelf',
    find: '  #dt-screen { position:absolute; left:22.2%; top:8%; width:73.4%; height:21.548%;',
    with: '  #dt-screen { position:absolute; left:41.863%; top:11.667%; width:51.078%; height:22.333%;',
    test: 'the screen and the shelf sit on the panels drawn for them, the bone on a bare post' },

  { file: 'MODEL.html',
    name: 'THE SHELF KEEPS THEM TOO, so the cards stand off the edge of their strip',
    find: '  #dt-tiles { position:absolute; left:5.9%; top:32.5%; width:88.2%; height:44.1%;',
    with: '  #dt-tiles { position:absolute; left:9.5%; top:37%; width:81%; height:38.4%;',
    test: 'the screen and the shelf sit on the panels drawn for them, the bone on a bare post' },

  // THE DISC IT USED TO MISS IS NOT ON THE ART ANY MORE (Movie, 20 Sep:
  // "there were 2 buttons showing so i deleted it from the drive thru"), so
  // this mutant lands on a bare post rather than beside a painted one -- and
  // it is still the mutant worth having, because the post is what the press
  // has to stay on. At 11.4% and 81.1% the box grows to 228px and reaches
  // down over the speaker plate, which is the only red left on this board:
  // the check catches it twice over, on the red it finds and on the corners
  // that are no longer grey.
  { file: 'MODEL.html',
    name: 'THE BONE KEEPS THE PORTRAIT FIGURES, so the press slides off the post onto the speaker',
    find: '  #dt-bone { position:absolute; left:50%; top:81.7%; width:5.5%;',
    with: '  #dt-bone { position:absolute; left:50%; top:81.1%; width:11.4%;',
    test: 'the screen and the shelf sit on the panels drawn for them, the bone on a bare post' },

  { file: 'MODEL.html',
    name: 'THE FRAME KEEPS THE OLD ASPECT, so the picture stretches and every zone slides',
    find: '    --dt-aspect:1.29; --dt-headroom:16px;',
    with: '    --dt-aspect:0.68; --dt-headroom:16px;',
    test: 'the screen and the shelf sit on the panels drawn for them, the bone on a bare post' },

  // ── AND THE OVERFLOW, WHICH IS THE BUG MOVIE ACTUALLY REPORTED ──────────
  { file: 'MODEL.html',
    name: 'THE BAND IS TOO SHORT FOR WHAT THE DOG SAYS: the last line is clipped away',
    find: 'left:22.2%; top:8%; width:73.4%; height:21.548%;',
    with: 'left:22.2%; top:8%; width:73.4%; height:7%;',
    test: 'nothing the dog says falls off the bottom of his board' },

  { file: 'MODEL.html',
    name: 'THE BAND IS TOO NARROW, so every sentence wraps until it runs off the bottom',
    find: 'left:22.2%; top:8%; width:73.4%; height:21.548%;',
    with: 'left:22.2%; top:8%; width:18%; height:21.548%;',
    test: 'nothing the dog says falls off the bottom of his board' },
];

const run = grep => {
  try {
    execSync(`npx playwright test ${SPEC}`
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES. The restore is `git checkout -- <file>`, so a
// file left out of this guard has any uncommitted work in it silently
// destroyed the first time a mutant touches it.
const dirty = execSync('git status --porcelain MODEL.html',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
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
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
