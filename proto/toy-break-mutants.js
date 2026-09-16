// DOES THE §4 SPEC CATCH A BREAK THAT DECIDES NOTHING?
//
// The gate for §4 -- the choice, the mark, and the propagation onto the master.
// Same hardenings as the nine before it: an ambiguous anchor is refused rather
// than guessed at, a survivor is re-run against the whole spec before it is
// called one, and the summary reads against what was DEFINED.
//
// MUTANT 5 IS THE ONE THE ORDER WROTE FOR ME. §4 acceptance 7b: "Mutate the
// propagation away so the break lands only on the clicked level. 7a must go
// red on the OTHER floors; if it stays green the check is looking at the wrong
// floor." That mutant is also the defect I actually shipped for an hour --
// `if (o.masterId) continue`, skipping mastered outlines entirely -- and it
// passed all five §4 checks I had written, because every one of them draws a
// single unmastered bone. The first house drawn is master-derived, so the
// feature was broken for its only real user while reading green.
const { execSync } = require('child_process');
const fs = require('fs');
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the click never offers the choice, so §4 has no way in',
    find: '        offerBoneChoice(md.body, md.grab);',
    with: '        /* mutant */',
    test: 'offers break here' },
  { file: 'MODEL.html',
    name: 'THE MARK IS A ROUNDED COORDINATE, not a distance along the run',
    // The rule I broke once tonight for real, in the other direction.
    find: '    return { x: wall.start.x + (rx / run) * feet, y: 0,\n      z: wall.start.z + (rz / run) * feet };',
    with: '    return { x: Math.round(at.x), y: 0, z: Math.round(at.z) };',
    test: 'ALONG THE RUN' },
  { file: 'MODEL.html',
    name: 'the mark does not round at all: the break lands under the cursor',
    find: '    const feet = Math.min(Math.max(Math.round(along), 1), Math.floor(run) - 1 || 1);',
    with: '    const feet = Math.min(Math.max(along, 1), Math.floor(run) - 1 || 1);',
    test: 'BREAK HERE splits the wall' },
  { file: 'MODEL.html',
    name: 'BREAK HERE and MOVE THIS WALL both break, so the choice is theatre',
    find: "  boneChoice.querySelector('[data-break-move]').addEventListener('click', closeBoneChoice);",
    with: "  boneChoice.querySelector('[data-break-move]').addEventListener('click', () => { const p = boneChoiceFor; closeBoneChoice(); if (p) breakBoneAt(p.wall, p.pt); });",
    test: 'MOVE THIS WALL leaves' },
  { file: 'MODEL.html',
    name: 'THE BREAK STOPS AT THE CLICKED LEVEL: the master and its floors keep the old ring',
    // §4 acceptance 7b, written by the order, and the defect I shipped.
    find: '    if (!hit.masterId) return true;        // a purely local bone cuts alone',
    with: '    return true;',
    test: '7a' },
  { file: 'MODEL.html',
    name: 'the master itself is skipped, so only the sibling floors take the cut',
    find: '      if (m.id === hit.masterId) insertOnEdge(m, a, b, pt);',
    with: '      if (false) insertOnEdge(m, a, b, pt);',
    test: '7a' },
  { file: 'MODEL.html',
    name: 'the point is APPENDED to the ring instead of placed on its edge',
    find: '        pts.splice(i + 1, 0, { x: pt.x, y: 0, z: pt.z });',
    with: '        pts.push({ x: pt.x, y: 0, z: pt.z });',
    test: '7a' },
  { file: 'MODEL.html',
    name: 'TOY LEAKS: DRAFTING gets the bone choice too',
    find: "      } else if (board === 'toy' && md.kind === 'wall' && md.body) {",
    with: "      } else if (md.kind === 'wall' && md.body) {",
    test: 'DRAFTING never offers' },
  { file: 'MODEL.html',
    name: 'THE CLAMP GOES: a break can land on the corner and make a null half',
    // Re-aimed. The mutant here attacked `if (feet <= 0 || feet >= run)`,
    // which SURVIVED -- the clamp below already makes it unreachable, so the
    // guard was dead and is gone. The clamp is the thing actually keeping a
    // break off the corners, so that is what gets mutated.
    find: '    const feet = Math.min(Math.max(Math.round(along), 1), Math.floor(run) - 1 || 1);',
    with: '    const feet = Math.round(along);',
    // AIMED AT THE CHECK WRITTEN FOR IT. It named 7a, which clicks mid-wall
    // where clamped and unclamped agree -- so 7a never saw it and the gate's
    // ambiguity flag caught that the kill came from somewhere else.
    test: 'near a corner' },

  // ── §4's SECOND HALF: THE CONNECTOR ──────────────────────────────────────
  // Four mutants, and every one is a failure actually hit building this.
  { file: 'MODEL.html',
    name: 'THE CORNER IS NEVER UNSHARED: dragging half a run swings the other half',
    find: '        splitRunCorners(md);',
    with: '        /* mutant */',
    test: 'grows a connector' },
  { file: 'MODEL.html',
    name: 'EVERY neighbour is split, so an ordinary drag drops a null wall each time',
    // The other arm. A perpendicular neighbour just stretches; splitting there
    // would leave a zero-length wall in the drawing on every single drag.
    find: '      if (!touching.some(other => collinearWith(wall, other))) return;',
    with: '      if (!touching.length) return;',
    test: 'makes no connector' },
  { file: 'MODEL.html',
    name: 'ZERO-LENGTH WALLS GO TO THE MODULE: the connector refuses its own drag',
    // Found by reading inertReason: a wall of no length is not orthogonal, so
    // the connector made the wall that created it inert.
    find: '      .filter(w => Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) >= 1e-6)',
    with: '',
    test: 'grows a connector' },
  { file: 'toy-constraints.js',
    name: 'DETACHED IS IGNORED: the module refuses a bend the page already prevented',
    find: '      if (detached && detached.includes(other.id)) return;',
    with: '      if (false) return;',
    test: 'grows a connector' },
];


const run = grep => {
  try {
    execSync('npx playwright test tests/model-toy-draw.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, not just the page. The restore is
// `git checkout -- <file>`, so a file left out of this guard has any
// uncommitted work in it silently destroyed the first time a mutant touches
// it. §3b added toy-constraints.js to the targets; it belongs here too.
const dirty = execSync('git status --porcelain MODEL.html toy-constraints.js',
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
// THE COUNT IS READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED
// mutant printed "10/10 killed" on another gate today and read like a clean
// sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
