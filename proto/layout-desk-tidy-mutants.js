#!/usr/bin/env node
// MUTATION GATE for the LAYOUT desk tidied (tests/layout-desk-tidy.spec.js)
// and the site's dimension rows on paper (tests/site-dims.spec.js).
//
// Movie, 26 Oct: the site rows "too close together due to the scale and
// size"; pages re-arranged "by dragging their position" on the rail; the
// titleblock's NEW HOME "click on it to change it, and also change it in the
// project information area"; the left SHEET and PLAN LEVEL lists gone.
//
// Run: node proto/layout-desk-tidy-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/layout-desk-tidy.spec.js tests/site-dims.spec.js';

const MUTANTS = [
  { file: 'layout-plan.js',
    name: 'the rows ignore the scale they are laid out at',
    find: "  const siteDimFt = pif => SITE_DIM_PAPER_IN / (pif > 0 ? pif : SITE_DIM_DEFAULT_PIF);\n",
    with: "  const siteDimFt = pif => SITE_DIM_PAPER_IN / SITE_DIM_DEFAULT_PIF;\n",
    test: 'at 1" = 60\' they stand 3/8" and 3/4" of paper off the property line' },
  { file: 'layout-plan.js',
    name: 'the outer row a fixed two feet past the first, as before',
    find: "    const firstFt = siteDimFt(pif), outerFt = 2 * siteDimFt(pif);\n",
    with: "    const firstFt = siteDimFt(pif), outerFt = siteDimFt(pif) + 2;\n",
    test: 'at 1" = 60\' they stand 3/8" and 3/4" of paper off the property line' },
  { file: 'layout-plan.js',
    name: 'what the marks clear is the unscaled row',
    find: "  const siteDimReachFt = pif => 2 * siteDimFt(pif);\n",
    with: "  const siteDimReachFt = pif => 2 * siteDimFt();\n",
    test: 'at 1" = 60\' they stand 3/8" and 3/4" of paper off the property line' },
  { file: 'LAYOUT.html',
    name: 'a viewport does not hand its scale to the plan painter',
    find: "          pif: viewport.pif,\n        });\n",
    with: "        });\n",
    test: 'a site viewport lays its rows out at its own scale, and its frame has paper room for them' },
  { file: 'LAYOUT.html',
    name: 'the site frame keeps no paper for its rows',
    find: "      const padIn = isSiteView(view) ? 2 * SITE_ROWS_ROOM_IN : 0;\n",
    with: "      const padIn = 0;\n",
    test: 'a site viewport lays its rows out at its own scale, and its frame has paper room for them' },
  { file: 'LAYOUT.html',
    name: 'a page let go elsewhere stays where it was',
    find: "      if (over !== from) this._moveSheet(from, over);\n",
    with: "",
    test: 'a page dragged on the rail takes its place in the set; what is on each page goes with it' },
  { file: 'LAYOUT.html',
    name: 'a moved page leaves its drawings behind',
    find: "    const viewports = this.state.viewports.map(viewport => ({ ...viewport, sheet: numberOf(viewport.sheet || 1) }));\n",
    with: "    const viewports = this.state.viewports;\n",
    test: 'a page dragged on the rail takes its place in the set; what is on each page goes with it' },
  { file: 'LAYOUT.html',
    name: 'the project name typed is kept on the sheet only',
    find: "      merged.projectInfo = { ...(base.projectInfo || {}), name: this._projectNameToWrite };\n",
    with: "",
    test: 'the project name on the titleblock is a text box on a press, and the drawing -- so PROJECT -- takes it' },
  { file: 'titleblock.js',
    name: 'the titleblock does not say where the project name is',
    find: "      info.onProjectName({ x, y: arrowB, w: w * 0.5, h: titleB - arrowB });\n",
    with: "",
    test: 'the project name on the titleblock is a text box on a press, and the drawing -- so PROJECT -- takes it' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4784' } });
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
