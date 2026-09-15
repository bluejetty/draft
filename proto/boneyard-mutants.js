// DOES THE BONEYARD SPEC CATCH A SHELF THAT IS NOT A WORKSPACE?
//
// The gate for BONEYARD-WORKORDER.md on MODEL.html.
//
// MUTANT 2 IS NOT INVENTED. It is the defect I shipped for an hour: the
// boneyard's early return sat ABOVE thumbTarget's in activeLevelId(), so with
// the boneyard open every seat in the view rail painted the SHELF instead of
// its own level. That is the failure acceptance 5 is about -- "a drafter parks
// a rejected kitchen on SHELF 2 and sends the set to the city" -- reaching the
// page by a road the order did not name, because MODEL.html has no printing at
// all. The first draft of the check that was supposed to catch it asserted
// that seats EXIST and that the plan had switched, and would have missed it.
//
// MUTANT 4 IS THE ORDER'S OWN WARNING, quoted: "never paste an item carrying
// the id it had on the level it came from -- #392 has already paid for one id
// bug tonight, and a duplicate id is the same family."
const { execSync } = require('child_process');
const fs = require('fs');

const SPEC = 'tests/model-boneyard.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'THE SHELF IS NOT A WORKSPACE: the level geometry never goes away',
    find: '    if (boneyardActive) return boneyardLevelId();',
    with: '    if (false) return boneyardLevelId();',
    test: 'the BONEYARD card selects, and the level geometry goes' },

  { file: 'MODEL.html',
    name: 'THE LEAK I SHIPPED: the shelf paints into every level thumbnail',
    find: "    if (thumbTarget) return thumbTarget.levelId;\n    // Then the boneyard",
    with: "    if (boneyardActive) return boneyardLevelId();\n    if (thumbTarget) return thumbTarget.levelId;\n    // Then the boneyard",
    test: "a shelf's contents stay off every level's thumbnail" },

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
      { cwd: '/home/user/draft', stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES. The restore is `git checkout -- <file>`, so a
// file left out of this guard has any uncommitted work in it silently
// destroyed the first time a mutant touches it.
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
// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
