#!/usr/bin/env node
// MUTATION GATE for the PROTRACTOR's steps and the ANGLE lock
// (tests/protractor-steps.spec.js).
//
// Movie, 17 Oct: "it should act similar to the T excep in addition to 90
// degree directions, go in at 45 degree directions, and it should be clickable
// and can change it to 30 degree increments, or back to 45 ... if they click
// the Protractor the T turns off. if they click ANGLE it uses the ANGLE
// textbox and the typed angle is used the ANGLE word is lit up and glow around
// the text box".
//
// Run: node proto/protractor-steps-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/protractor-steps.spec.js';

const MUTANTS = [
  { file: 'model/10-tracking-garage.js',
    name: "the lit protractor turns nothing",
    find: "    if (!protractorOn || board === 'toy' || !from || !at) return null;\n",
    with: "    return null;\n",
    test: "lit, the PROTRACTOR turns the run in 45s: an aim at 41 degrees lands on 45" },
  { file: 'model/10-tracking-garage.js',
    name: "the protractor always turns in 45s",
    find: "    const p = outlineHand(from, at, protractorStep);\n",
    with: "    const p = outlineHand(from, at, 45);\n",
    test: "its step button turns it to 30s and lights it; 45 again on the next press" },
  { file: 'model/13-suites-trim-follow.js',
    name: "the step button does not flip the step",
    find: "    protractorStep = protractorStep === 45 ? 30 : 45;\n",
    with: "",
    test: "its step button turns it to 30s and lights it; 45 again on the next press" },
  { file: 'model/13-suites-trim-follow.js',
    name: "the step button leaves the protractor dark",
    find: "    keepLight('protractorStep', protractorStep);\n    lightInstrument('protractor');\n",
    with: "    keepLight('protractorStep', protractorStep);\n",
    test: "its step button turns it to 30s and lights it; 45 again on the next press" },
  { file: 'model/09-draw-move-stretch.js',
    name: "lighting one leaves the others lit",
    find: "    tsquareOn = which === 'tsquare';\n",
    with: "    tsquareOn = tsquareOn || which === 'tsquare';\n",
    test: "one lit at a time: the PROTRACTOR puts the T out, the T puts the PROTRACTOR out" },
  { file: 'model/14-promotion-tools.js',
    name: "a typed angle is only kept, as it was",
    find: "    lightInstrument('angle');\n    angleBox.blur();",
    with: "    angleBox.blur();",
    test: "a typed ANGLE locks at once: the word lights, the box glows, the run holds 33" },
  { file: 'model/13-suites-trim-follow.js',
    name: "the ANGLE word is never lit on screen",
    find: "    angleWord?.classList.toggle('lit', angleOn);\n",
    with: "",
    test: "a typed ANGLE locks at once: the word lights, the box glows, the run holds 33" },
  { file: 'model/13-suites-trim-follow.js',
    name: "the box does not glow when locked",
    find: "    angleBox.classList.toggle('locked', angleLockDeg() != null);\n",
    with: "",
    test: "a typed ANGLE locks at once: the word lights, the box glows, the run holds 33" },
  { file: 'model/09-draw-move-stretch.js',
    name: "the lock ignores the ANGLE light",
    find: "  const angleLockDeg = () => (angleOn && typedAngle != null",
    with: "  const angleLockDeg = () => (typedAngle != null",
    test: "the T puts the ANGLE out, and the ANGLE word lights it again on the kept number" },
  { file: 'model/13-suites-trim-follow.js',
    name: "the ANGLE word does nothing",
    find: "    lightInstrument(angleOn ? null : 'angle');\n",
    with: "",
    test: "the T puts the ANGLE out, and the ANGLE word lights it again on the kept number" },
  { file: 'model/14-promotion-tools.js',
    name: "an emptied box keeps the lock",
    find: "    if (String(angleBox.value).replace(/[\u00b0\\s]/g, '') === '' && typedAngle != null) commitTypedAngle();\n",
    with: "",
    test: "deleting the number frees the run: the ANGLE goes dark and the press lands where it is" },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4473' } });
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
