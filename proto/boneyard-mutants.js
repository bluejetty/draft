// DOES THE BONEYARD SPEC CATCH A SHELF THAT IS NOT A WORKSPACE?
//
// The gate for BONEYARD-WORKORDER.md on MODEL.html.
//
// ONE MUTANT WAS REMOVED FROM THIS GATE, AND THE REASON IS THE POINT.
//
// It swapped the order of activeLevelId()'s two early returns, on the belief
// that answering the boneyard before thumbTarget made every seat in the view
// rail paint the SHELF instead of its own level -- "a drafter parks a rejected
// kitchen on SHELF 2 and sends the set to the city", arriving by a road the
// order did not name, since MODEL.html has no printing at all.
//
// I believed that because acceptance 5 went red when I first wrote the
// boneyard's outlines() path. IT WAS NOT THE LEAK. It was a RACE inside the
// check: the seat canvases repaint on a frame callback and it was capturing
// one mid-paint. With the race fixed the mutant SURVIVES -- tried with a wall
// parked on the shelf, then with a master on the shelf, then with the real
// boneyardActive flag reaching drawOutlines2D.
//
// So the precedence guard in showingBoneyard() is DEFENSIVE AND UNPROVEN, and
// it is labelled that way in MODEL.html too. Do not re-add this mutant without
// first building a check that can actually see the difference; a gate carrying
// a known survivor reports a red sheet on healthy code, and one quietly
// dropping the mutant teaches the opposite lesson.
//
// MUTANT 4 IS THE ORDER'S OWN WARNING, quoted: "never paste an item carrying
// the id it had on the level it came from -- #392 has already paid for one id
// bug tonight, and a duplicate id is the same family."
const { execSync } = require('child_process');
const fs = require('fs');
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-boneyard.spec.js';

const MUTANTS = [
  // §5a. The freeze is a DIVERGENCE from MODEL.dc.html, which rides the point
  // at its stored offset, so the first mutant is simply DC's own branch put
  // back. A check that only said "not taken back by the master" passed under
  // BOTH -- riding also differs from the master -- which is why the check now
  // asserts the absolute coordinate.
  { file: 'MODEL.html',
    name: 'the override RIDES at its offset instead of freezing (DC\'s branch back)',
    find: '        if (overridden.has(pt.srcId)) return;',
    with: `        if (overridden.has(pt.srcId)) {
          if (Number.isFinite(pt.offX) && Number.isFinite(pt.offZ)) {
            pt.x = src.x + pt.offX; pt.z = src.z + pt.offZ; moved += 1;
          }
          return;
        }`,
    test: '§5a: a hand-moved point FREEZES' },

  // AND THE OVER-BROAD FREEZE, which is the same line with the condition
  // dropped: every point stops following, not just the hand-moved one. That
  // fails as "the outline no longer follows its master at all" and is caught
  // by the untouched-corner assertion in the same check.
  { file: 'MODEL.html',
    name: 'the freeze is over-broad: EVERY point stops following, not just the overridden one',
    find: '        if (overridden.has(pt.srcId)) return;',
    with: '        return;',
    test: '§5a: a hand-moved point FREEZES' },

  { file: 'MODEL.html',
    name: 'THE SHELF IS NOT A WORKSPACE: the level geometry never goes away',
    find: '    if (boneyardActive) return boneyardLevelId();',
    with: '    if (false) return boneyardLevelId();',
    test: 'the BONEYARD card selects, and the level geometry goes' },

  { file: 'MODEL.html',
    name: 'the shelf allocator counts rows, so a new shelf adopts old geometry',
    find: '    const next = Math.max(\n      Number.isInteger(drawing.nextBoneyardShelfId) ? drawing.nextBoneyardShelfId : 1,\n      ...list.map(s => Number(s.id) + 1), 2);',
    with: '    const next = list.length + 1;',
    test: 'a shelf added to a gapped list takes a FREE id' },

  { file: 'MODEL.html',
    name: 'PASTE KEEPS THE SOURCE ID, which is the duplicate-id family again',
    find: "      const copy = { ...rest, id: newDrawingItemId(type), levelId: owner };",
    with: '      const copy = { ...rest, id: raw.id, levelId: owner };',
    test: 'copy a wall from a level, paste it on a shelf' },

  { file: 'MODEL.html',
    name: 'PASTE DOES NOT RE-OWN: the copy lands back on the level it came from',
    find: "      const copy = { ...rest, id: newDrawingItemId(type), levelId: owner };",
    with: '      const copy = { ...rest, id: newDrawingItemId(type), levelId: raw.levelId };',
    test: 'copy a wall from a level, paste it on a shelf' },

  { file: 'MODEL.html',
    name: 'PASTE MOVES rather than copies: the original is taken off the plan',
    find: '      drawing[key] = drawing[key] || [];\n      drawing[key].push(copy);',
    with: '      drawing[key] = (drawing[key] || []).filter(x => x.id !== raw.id);\n      drawing[key].push(copy);',
    test: 'copy a wall from a level, paste it on a shelf' },

  { file: 'MODEL.html',
    name: 'the shelf list is STORED not derived, so an old drawing shows none',
    find: '  const shelves = () => window.DraftDrawingFormat.boneyardShelves(drawing?.boneyardShelves);',
    with: '  const shelves = () => (drawing?.boneyardShelves || []);',
    test: 'a drawing saved before shelves existed loads with the single default' },

  { file: 'MODEL.html',
    name: 'the sync pass does not know the boneyard, so the card never lights',
    find: "      if (card.dataset.boneyard !== undefined) {\n        card.toggleAttribute('data-active', boneyardActive);\n        return;\n      }",
    with: '      /* mutant */',
    test: 'the BONEYARD card selects, and the level geometry goes' },

  { file: 'MODEL.html',
    name: 'leaving for a level does not leave the boneyard: both look active',
    find: '    boneyardActive = false;\n    params.set(\'level\', String(id));',
    with: "    params.set('level', String(id));",
    test: 'leaving the boneyard puts the level geometry back' },

  { file: 'MODEL.html',
    name: 'PASTE READS THE SELECTION, so it is dead exactly when it is wanted',
    find: '      pasteButton.hidden = !held.length || !!activeCut() || modalUp();',
    with: '      pasteButton.hidden = !selection.length || !!activeCut() || modalUp();',
    test: 'copy a wall from a level, paste it on a shelf' },
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
