#!/usr/bin/env node
// MUTATION GATE for COPY and PASTE of a LAYOUT viewport (Movie, 25 Oct: "copy
// a layout viewport from one page and then paste it on a different page"):
// COPY holds the selected one; PASTE puts a new one, a new id, on the open
// sheet in the same place, selected; on its own sheet half an inch off;
// Ctrl+C / Ctrl+V the same; one UNDO takes it off.
//
//   node proto/layout-viewport-copy-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-viewport-copy.spec.js';

const MUTANTS = [
  { file: 'LAYOUT.html',
    name: 'the paste lands on the sheet it was copied from',
    find: "    const viewport = { ...JSON.parse(JSON.stringify(held)), id: this.state.nextViewportId, sheet, xIn, yIn };\n",
    with: "    const viewport = { ...JSON.parse(JSON.stringify(held)), id: this.state.nextViewportId, xIn, yIn };\n",
    test: 'COPY on a selected viewport' },
  { file: 'LAYOUT.html',
    name: 'the paste keeps the copied id',
    find: "    const viewport = { ...JSON.parse(JSON.stringify(held)), id: this.state.nextViewportId, sheet, xIn, yIn };\n",
    with: "    const viewport = { ...JSON.parse(JSON.stringify(held)), sheet, xIn, yIn };\n",
    test: 'COPY on a selected viewport' },
  { file: 'LAYOUT.html',
    name: 'the paste is not selected',
    find: "      nextViewportId: viewport.id + 1,\n      selectedViewportId: viewport.id,\n      auto: false,\n    }, () => { this._persistLayout(); this._draw(); });\n    return true;\n  }\n\n  // ONE DELETE",
    with: "      nextViewportId: viewport.id + 1,\n      selectedViewportId: null,\n      auto: false,\n    }, () => { this._persistLayout(); this._draw(); });\n    return true;\n  }\n\n  // ONE DELETE",
    test: 'COPY on a selected viewport' },
  { file: 'LAYOUT.html',
    name: 'PASTE never comes up',
    find: "    document.querySelector('[data-paste-viewport]').hidden = !this._viewportClipboard;\n",
    with: "    document.querySelector('[data-paste-viewport]').hidden = true;\n",
    test: 'COPY on a selected viewport' },
  { file: 'LAYOUT.html',
    name: 'pasted on its own sheet it sits right on the one it copies',
    find: "    while (Number.isFinite(xIn) && Number.isFinite(yIn) && taken(xIn, yIn)) { xIn += STEP_IN; yIn += STEP_IN; }\n",
    with: "",
    test: 'Ctrl+C and Ctrl+V' },
  { file: 'LAYOUT.html',
    name: 'Ctrl+V pastes nothing',
    find: "      if (key === 'v' && this.state.editInModel == null && this._viewportClipboard) {\n",
    with: "      if (false) {\n",
    test: 'Ctrl+C and Ctrl+V' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4590' } });
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
