#!/usr/bin/env node
// MUTATION GATE for the tool keys' faces (tests/tool-icons.spec.js).
//
// Movie, 27 Oct: "don't put text in the box except the letter, just an icon
// and command letter, and when the user scolls over the tool name should be
// first 'WALL - press W to draw a wall.'" -- and a MULTIPLE placeholder key.
//
// Run: node proto/tool-icons-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/tool-icons.spec.js';

const MUTANTS = [
  { file: 'model/14-promotion-tools.js',
    name: 'the keys get no drawing',
    find: "    icon.innerHTML = window.DraftToolIcons?.svg(id) || '';\n",
    with: "    icon.innerHTML = '';\n",
    test: 'every key shows its letter and a drawing, and no name on its face' },
  { file: 'model.css',
    name: 'the name still shows on the face',
    find: "  [data-tool-name] { position:absolute; width:1px; height:1px; overflow:hidden;\n    clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap; }\n",
    with: "  [data-tool-name] { position:absolute; left:0; right:0; bottom:2px; font-size:6.5px; }\n",
    test: 'every key shows its letter and a drawing, and no name on its face' },
  { file: 'model/14-promotion-tools.js',
    name: 'the tooltip is only the name',
    find: "      btn.title = window.DraftToolIcons ? window.DraftToolIcons.title(tool.name, key, tool.id) : tool.name;\n",
    with: "      btn.title = tool.name;\n",
    test: 'the tooltip names the tool first, then its key and what it does' },
  { file: 'tool-icons.js',
    name: 'a key with no letter says only its name',
    find: "      : `${head} — ${does.charAt(0).toUpperCase()}${does.slice(1)}.`;\n",
    with: "      : head;\n",
    test: 'the tooltip names the tool first, then its key and what it does' },
  { file: 'model/14-promotion-tools.js',
    name: 'MULTIPLE arms itself like a tool',
    find: "          if (tool.placeholder) { sayOnStrip(`${tool.name} is coming soon — copies in a row or a grid.`); return; }\n",
    with: "",
    test: 'MULTIPLE is a key in DRAW / EDIT that says it is coming and arms nothing' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4801' } });
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
