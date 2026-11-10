// DOES THE SITE PLAN KEY SPEC CATCH THE POP-UP COMING BACK?
//
// jb, 9 Nov 2026: "can i only have this site plan menu pop up when they ask
// for it, maybe SITE PLAN button in build to open that (put it at the end
// make it look like a site plan" -- "that popup popuped up in bad placed too
// many times".
//
// THE RISK IS ONE THING: the card rising when nobody pressed for it. Every
// mutant below is a way it could -- the old show rule back, a flag left up
// across a level change, the build marching him to SITE again -- plus the
// key going missing or opening the card on a level where its answers are
// wrong. Each leaves a page that looks exactly as it does today until the
// pop-up is in the way again.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED when
// the spec fails, so a spec that is already red kills everything and prints a
// perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-site-key.spec.js';

const MUTANTS = [
  { file: 'model/10-tracking-garage.js',
    name: 'the old rule is back: arriving at SITE with no lot raises the card',
    find: '    const show = lotOnSite() && lotReopen;',
    with: '    const show = lotOnSite() && (!lotExists() || lotReopen);',
    test: 'arriving at SITE with no lot asks nothing' },

  // REMOVED, NOT SOFTENED: "NOT NOW hides the card but leaves the flag up".
  // The card repaints on a level change and at boot, not on every frame,
  // and every level change away from SITE drops the flag first (the mutant
  // below), so there is no press a drafter can make that brings the card
  // back from a flag NOT NOW left up. The face-snap gate already holds NOT
  // NOW to putting the flag down (proto/face-snap-lot-mutants.js).

  { file: 'model/10-tracking-garage.js',
    name: 'leaving SITE leaves the flag up, so coming back finds the card waiting',
    find: '  dropLotCard = () => { lotReopen = false; };',
    with: '  dropLotCard = () => {};',
    test: 'leaving SITE with the card up puts it down, and coming back does not raise it' },

  { file: 'model/10-tracking-garage.js',
    name: 'the key opens the card where the drafter stands instead of going to SITE',
    find: '    lotReopen = true;\n'
      + '    if (!lotOnSite()) goToLevel(SITE_LEVEL_ID);\n'
      + '    paintLotPick();',
    with: '    lotReopen = true;\n'
      + '    lotCard.hidden = false;',
    test: 'pressing it from another level goes to SITE and opens the card' },

  { file: 'model/10-tracking-garage.js',
    name: 'over a lot already drawn the key opens a blank card instead of the lot\'s size',
    find: '    if (lotExists()) {\n'
      + '      if (!lotOnSite()) goToLevel(SITE_LEVEL_ID);\n'
      + '      reopenLot();\n'
      + '      return;\n'
      + '    }',
    with: '',
    test: "over a lot already drawn the key reopens the card on the lot's own size" },

  { file: 'model/14-promotion-tools.js',
    name: 'the key is never put on the rail',
    find: "      if (group.id === 'build') {",
    with: '      if (false) {',
    test: 'the SITE PLAN key is the last of the BUILD keys and wears a drawing, not a letter' },

  { file: 'model/14-promotion-tools.js',
    name: 'the key is first of the BUILD keys rather than last',
    find: '        btn.addEventListener(\'click\', () => openLotCard());\n'
      + '        keys.append(btn);',
    with: '        btn.addEventListener(\'click\', () => openLotCard());\n'
      + '        keys.prepend(btn);',
    test: 'the SITE PLAN key is the last of the BUILD keys and wears a drawing, not a letter' },

  { file: 'tool-icons.js',
    name: 'the key has no face: the icon is gone and the key is a blank box',
    find: "    siteplan: '<path d=\"M3 4h18v16H3z\" stroke-dasharray=\"3 1.4 0.8 1.4\" />'",
    with: "    siteplan_: '<path d=\"M3 4h18v16H3z\" stroke-dasharray=\"3 1.4 0.8 1.4\" />'",
    test: 'the SITE PLAN key is the last of the BUILD keys and wears a drawing, not a letter' },

  { file: 'model/03-plan-paint.js',
    name: 'the build marches him to SITE again',
    find: "    if (!boneRevealOn() || !autoElevationCuts().some(cut => String(cut.id) === 'E1')) return;",
    with: "    if (!boneRevealOn() || !autoElevationCuts().some(cut => String(cut.id) === 'E1')) {\n"
      + '      goToLevel(SITE_LEVEL_ID); openLotCard(); return;\n'
      + '    }',
    test: 'a build asks nothing either, with or without the show' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4358' } });
    return 'passed';
  } catch { return 'failed'; }
};

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it.
const files = [...new Set(MUTANTS.map(m => m.file))].join(' ');
const dirty = execSync(`git status --porcelain ${files}`, { cwd: ROOT }).toString().trim();
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

// READ AGAINST WHAT WAS DEFINED, never on its own.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
