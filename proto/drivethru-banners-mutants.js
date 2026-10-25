#!/usr/bin/env node
// MUTATION GATE for the drive-thru banners (tests/drivethru-banners.spec.js).
//
// Movie, 16 Oct: two banners with arrows under the tiles once a type is
// picked, the left building the house, the right drawing its outline, on
// both skins, and the press between them wearing the wallet's number. Each
// row below is one way the sign could look right and be wrong.
//
// Run: node proto/drivethru-banners-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/drivethru-banners.spec.js';

const MUTANTS = [
  { file: 'model/04-levels-notes-bars.js',
    name: 'the row never rises: the banners are offered to nobody',
    find: "    document.querySelectorAll('[data-drivethru-banners]').forEach(row => { row.hidden = !canTrace; });",
    with: "    document.querySelectorAll('[data-drivethru-banners]').forEach(row => { row.hidden = true; });",
    test: 'say the short words' },

  { file: 'model/04-levels-notes-bars.js',
    name: 'the row is up before anything is picked',
    find: "    document.querySelectorAll('[data-drivethru-banners]').forEach(row => { row.hidden = !canTrace; });",
    with: "    document.querySelectorAll('[data-drivethru-banners]').forEach(row => { row.hidden = false; });",
    test: 'say the short words' },

  { file: 'model/04-levels-notes-bars.js',
    name: 'the banners say the long sentence instead of his words',
    find: "      press.textContent = banner(press) ? `DRAW ${kind.toUpperCase()}` : buildWords;",
    with: '      press.textContent = buildWords;',
    test: 'say the short words' },

  { file: 'model/04-levels-notes-bars.js',
    name: 'the outline banner says the text link\'s sentence',
    find: "      press.textContent = banner(press) ? `DRAW ${kind.toUpperCase()} OUTLINE` : traceWords;",
    with: '      press.textContent = traceWords;',
    test: 'say the short words' },

  { file: 'MODEL.html',
    name: 'the left banner is not a build press: it joins no handler',
    find: '        data-drivethru-build-now data-drivethru-banner="build"',
    with: '        data-drivethru-banner="build"',
    test: 'the left banner builds the house' },

  { file: 'MODEL.html',
    name: 'the right banner is not an outline press',
    find: '        data-drivethru-outline data-drivethru-banner="outline"',
    with: '        data-drivethru-banner="outline"',
    test: 'the right banner draws the outline too' },

  { file: 'model/04-levels-notes-bars.js',
    name: 'the sign\'s bone never gets the number',
    find: "      el.textContent = boneBalanceEl.textContent;",
    with: "      el.textContent = '';",
    test: 'wears the wallet' },

  { file: 'model.css',
    name: 'the row is left-packed, so the arrows point at nothing',
    find: '    display:flex; align-items:center; justify-content:space-between; gap:1%;\n    pointer-events:none; }\n  #dt-banners[hidden]',
    with: '    display:flex; align-items:center; justify-content:flex-start; gap:1%;\n    pointer-events:none; }\n  #dt-banners[hidden]',
    test: 'the arrows meet the bone' },

  { file: 'model.css',
    name: 'ROUGH keeps the press hidden: the arrows meet an empty gap',
    find: '  html[data-theme="rough"] #dt-banners:not([hidden]) ~ #dt-bone { display:block; }',
    with: '  html[data-theme="rough"] #dt-banners:not([hidden]) ~ #dt-bone { display:none; }',
    test: 'on ROUGH the house press stands between the banners' },

  { file: 'model.css',
    name: 'ROUGH\'s shelf keeps the whole sheet and the row lands on the tiles',
    find: '  html[data-theme="rough"] #dt-tiles { left:6%; top:13%; width:88%; height:56%; }',
    with: '  html[data-theme="rough"] #dt-tiles { left:6%; top:13%; width:88%; height:72%; }',
    test: 'on ROUGH the house press stands between the banners' },
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

const dirty = execSync('git status --porcelain MODEL.html shell-bars.js',
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
