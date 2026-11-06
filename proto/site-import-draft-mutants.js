// DOES THE IMPORT-FROM-.DRAFT SPEC CATCH A COMMAND THAT OPENS THE WRONG DOOR?
//
// jb, 6 Nov: "i will draw the site plan on a seperate draft file that i will
// bring in and place, can we make that an option for the site plan setup".
//
// THE COMMAND IS A DOOR TO A ROOM THAT WAS ALREADY THERE, so the only real
// defects are the door opening onto the wrong room, or onto none. Each mutant
// below leaves a card that reads exactly as it does today.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-site-import-draft.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the command is not on the card at all',
    find: '        <button type="button" data-lot-pick-import>IMPORT SITE PLAN FROM .DRAFT</button>',
    with: '',
    test: 'the command is on the card, beside the other four' },

  { file: 'MODEL.html',
    name: 'the command is on the card but outside the commands column, '
      + 'where it reads as something other than one of the options',
    find: '        <button type="button" data-lot-pick-import>IMPORT SITE PLAN FROM .DRAFT</button>\n'
      + '      </div>',
    with: '      </div>\n'
      + '        <button type="button" data-lot-pick-import>IMPORT SITE PLAN FROM .DRAFT</button>',
    test: 'the command is on the card, beside the other four' },

  { file: 'model/10-tracking-garage.js',
    name: 'the press opens the picture picker, which cannot read a .draft',
    find: "      const bringIn = document.querySelector('[data-hologram-ask-upload]');\n"
      + '      if (bringIn) bringIn.click();',
    with: "      const bringIn = document.querySelector('[data-trace-file]');\n"
      + '      if (bringIn) bringIn.click();',
    test: 'pressing it and choosing a .draft brings that file in as a hologram, lot and all' },

  { file: 'model/10-tracking-garage.js',
    name: 'the press opens nothing: the card closes and the drafter is left '
      + 'to find the HOLOGRAM chip himself',
    find: '      if (bringIn) bringIn.click();\n'
      + "      else sayOnStrip('Use the HOLOGRAM chip to bring in a .draft site plan.');",
    with: "      sayOnStrip('Use the HOLOGRAM chip to bring in a .draft site plan.');",
    test: 'pressing it and choosing a .draft brings that file in as a hologram, lot and all' },

  { file: 'model/10-tracking-garage.js',
    name: 'the card stays up under the file dialog',
    find: "    lotCard.querySelector('[data-lot-pick-import]').addEventListener('click', () => {\n"
      + '      lotTouched = true;\n'
      + '      lotAsked = true;\n'
      + '      paintLotPick();',
    with: "    lotCard.querySelector('[data-lot-pick-import]').addEventListener('click', () => {\n"
      + '      lotTouched = true;',
    test: 'pressing it and choosing a .draft brings that file in as a hologram, lot and all' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4361' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it.
const dirty = execSync('git status --porcelain MODEL.html model/10-tracking-garage.js',
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

console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
