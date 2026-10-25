#!/usr/bin/env node
// MUTATION GATE for a door's tag taking a typed width, and a width a wall
// cannot carry saying TOO BIG with the widest it can (tests/door-tag-size.spec.js).
//
// Movie, 20 Oct: "when they click on the D48 - if they change that to D60 the
// door width would also change to 5ft wide ... 2 ways to change the width,
// only change height in properties" -- and "ok that's why" on a 5'-0" French
// pair a 5'-3" closet wall could not carry.
//
// Run: node proto/door-tag-size-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/door-tag-size.spec.js';
const MUTANTS = [
  { file: 'model/02-holograms-tags.js', name: 'a door tag takes no press',
    find: '      if (live && placed && (isWindow || opening.garage !== true)) {',
    with: '      if (live && placed && isWindow) {',
    test: 'click D36, type D60' },
  { file: 'model/02-holograms-tags.js', name: 'a door tag is read as a window size',
    find: "    const size = isDoor ? doorWidth() : FL.parseWindowSize(text, { units: drawing?.units });",
    with: "    const size = FL.parseWindowSize(text, { units: drawing?.units });",
    test: 'click D36, type D60' },
  { file: 'model/02-holograms-tags.js', name: 'a door tag takes a W X H',
    find: "      if (!nums || nums.length !== 1 || !(Number(nums[0]) > 0)) return null;",
    with: "      if (!nums || !(Number(nums[0]) > 0)) return null;",
    test: 'takes one number' },
  { file: 'model/02-holograms-tags.js', name: 'a typed door width moves the head',
    find: "      return { widthFt, heightFt: (Number(opening.headHeight) || 0) - (Number(opening.sillHeight) || 0) };",
    with: "      return { widthFt, heightFt: (Number(opening.headHeight) || 0) - (Number(opening.sillHeight) || 0) - 0.5 };",
    test: 'click D36, type D60' },
  { file: 'model/02-holograms-tags.js', name: 'the tag refusal on the strip only',
    find: "      brushWarn(`TOO BIG — ${say(size.widthFt)} is wider than this wall can carry.`",
    with: "      sayOnStrip(`TOO BIG — ${say(size.widthFt)} is wider than this wall can carry.`",
    test: 'too wide for the wall' },
  { file: 'model/02-holograms-tags.js', name: 'no widest named',
    find: "    return most > 0 ? ` The most it can take is ${say(most)}.` : ' It cannot take an opening at all.';",
    with: "    return '';",
    test: 'too wide for the wall' },
  { file: 'model/15-panels.js', name: 'the PROPERTIES refusal on the strip only',
    find: "        brushWarn(said, { opening: refused[0] });\n        return said;",
    with: "        return said;",
    test: 'PROPERTIES WIDTH' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4468' } });
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
