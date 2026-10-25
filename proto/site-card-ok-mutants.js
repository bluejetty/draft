// DOES THE SITE CARD'S OK SPEC CATCH A BUTTON THAT ANSWERS WRONG?
//
// Movie, 16 Oct: "put a big button on the bottom that says OK and make it red
// so it draws attention. if they click that just put in the best fit based on
// the sizes / setbacks", "make it easier for when the user wants to think
// less and read less", "leave all that other stuff in the sITE menu", and
// "highlight the 'DRAW AUTOSITE' button so the user knows when they press OK
// that is what will happen ... make it glow ... until they press another
// button".
//
// A BUTTON THAT ANSWERS FOR SOMEBODY HAS ONE REAL RISK, and every mutant
// below is a version of it: answering with something other than what the card
// is showing him. The wrong size, the right size drawn as the wrong lot, his
// own pick overridden, or the glow pointing at nothing -- each leaves a card
// that looks exactly as it does today and draws a lot he did not ask for.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-site-card-ok.spec.js';

const MUTANTS = [
  { file: 'model/10-tracking-garage.js',
    name: 'OK takes the top of the ladder instead of the first size that '
      + 'fits, so it draws a lot the card marked too small',
    find: '        const best = bestLotTier();\n'
      + '        if (!best) return;\n'
      + '        lotSizeId = best.id;',
    with: '        const best = window.DraftLotSizes.LOT_TIERS[0];\n'
      + '        if (!best) return;\n'
      + '        lotSizeId = best.id;',
    test: 'OK draws the size the ladder itself brightens' },

  { file: 'model/10-tracking-garage.js',
    name: 'OK overrides a size the drafter picked himself',
    find: '      if (!lotChosen()) {\n'
      + '        const best = bestLotTier();',
    with: '      if (true) {\n'
      + '        const best = bestLotTier();',
    test: 'it stops glowing once he presses another button' },

  { file: 'model/10-tracking-garage.js',
    name: 'OK sets the size and never draws, so the loud button does nothing',
    find: '      lotTouched = true;\n'
      + '      paintLotPick();\n'
      + '      drawAutosite();\n'
      + '    });',
    with: '      lotTouched = true;\n'
      + '      paintLotPick();\n'
      + '    });',
    test: 'OK draws the size the ladder itself brightens' },

  { file: 'model/10-tracking-garage.js',
    name: 'the glow never comes on, so OK is a button that answers for him '
      + 'with nothing saying what it answered',
    find: "    draw.classList.toggle('lot-ok-target', !!takes && !lotTouched);",
    with: "    draw.classList.toggle('lot-ok-target', false);",
    test: 'DRAW AUTOSITE glows, so OK is not magic' },

  { file: 'model/10-tracking-garage.js',
    name: 'the glow never goes off, so it points at a verb OK is no longer '
      + 'going to press',
    find: "    draw.classList.toggle('lot-ok-target', !!takes && !lotTouched);",
    with: "    draw.classList.toggle('lot-ok-target', !!takes);",
    test: 'it stops glowing once he presses another button' },

  { file: 'model.css',
    name: 'the glow is named and not drawn: the class goes on and the rule '
      + 'behind it is gone',
    find: '  #lot-pick [data-lot-pick-draw].lot-ok-target {\n'
      + '    animation: lot-ok-points 1.4s ease-in-out infinite; }',
    with: '  #lot-pick [data-lot-pick-draw].lot-ok-target { opacity:1; }',
    test: 'DRAW AUTOSITE glows, so OK is not magic' },

  { file: 'model/10-tracking-garage.js',
    name: 'OK goes dead on a drawing with nothing in it, which is the one '
      + 'card where a way through matters most',
    find: '    const okTier = best || bestLotTier();',
    with: '    const okTier = best;',
    test: 'with nothing drawn yet, OK still has an answer' },

  { file: 'model/10-tracking-garage.js',
    name: 'the empty-drawing fallback takes the narrowest urban lot rather '
      + 'than the one the list calls standard',
    find: "  const STANDARD_LOT_TIER = 'L';",
    with: "  const STANDARD_LOT_TIER = 'S';",
    test: 'with nothing drawn yet, OK still has an answer' },

  { file: 'model.css',
    name: 'the OK is a small button in the row with the rest, not the way '
      + 'through across the bottom',
    find: '  #lot-pick .lot-ok { display:block; width:100%; margin-top:10px;',
    with: '  #lot-pick .lot-ok { display:inline-block; width:auto; margin-top:10px;',
    test: 'everything else in the card is still there' },

  { file: 'MODEL.html',
    name: 'the OK replaces the four commands instead of joining them',
    find: '        <button type="button" data-lot-pick-hand>DRAW IT MYSELF</button>',
    with: '',
    test: 'everything else in the card is still there' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4357' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it, and a guard that fires
// only afterwards lets you walk away believing the gate is running.
const dirty = execSync('git status --porcelain MODEL.html',
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
  const hits = before.split(m.find).length - 1;
  if (hits === 0) {
    console.log(`  SKIPPED   ${m.name}  (anchor not found — re-aim \`find\`)`);
    ambiguous += 1;
    continue;
  }
  if (hits > 1) {
    console.log(`  AMBIGUOUS (${hits} matches)  ${m.name}`);
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
