#!/usr/bin/env node
// MUTATION GATE for a LINE's weight, colour and style (tests/line-properties.spec.js).
//
// Movie, 19 Oct: "for the LINE -- it need some PROPERTIES that can change
// too" -- six weights (with his 4.5 XTRA-BOLD), the full spectrum, and the
// dash styles. Six seams: the painter's width, dash and colour, the undo,
// the next line's default, and the format keeping the field.
//
// Run: node proto/line-properties-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/line-properties.spec.js';

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'every line paints at one width',
    find: '      ctx.lineWidth = ink.lineWidth;\n',
    with: '      ctx.lineWidth = 1;\n',
    test: 'the ink follows: XTRA-BOLD paints thick, DOTTED breaks, red is red' },
  { file: 'MODEL.html',
    name: 'every line paints solid',
    find: '      ctx.setLineDash(ink.dash);\n',
    with: '      ctx.setLineDash([]);\n',
    test: 'the ink follows: XTRA-BOLD paints thick, DOTTED breaks, red is red' },
  { file: 'MODEL.html',
    name: 'every line paints in the skin\'s ink',
    find: "      ctx.strokeStyle = ink.color || skin['draw-line'];\n",
    with: "      ctx.strokeStyle = skin['draw-line'];\n",
    test: 'the ink follows: XTRA-BOLD paints thick, DOTTED breaks, red is red' },
  { file: 'MODEL.html',
    name: 'a style change cannot be undone',
    find: "    undoStack.push({ kind: 'props', edits });\n    lineDefaults = { ...lineDefaults, ...patch };\n",
    with: '    lineDefaults = { ...lineDefaults, ...patch };\n',
    test: 'the LINE panel offers six weights, four styles and a colour; each writes the line and one UNDO takes it back' },
  { file: 'MODEL.html',
    name: 'the next line drawn forgets the last choice',
    find: '      ...lineStyleDefaults(),\n',
    with: '',
    test: 'the last choice sticks: the next line drawn takes it, and a reload remembers it' },
  { file: 'MODEL.html',
    name: 'a reload forgets the last choice',
    find: "      localStorage.setItem(SKIN_KEY, JSON.stringify({ ...keep, [LINE_STYLE_KEY]: lineDefaults }));\n",
    with: '',
    test: 'the last choice sticks: the next line drawn takes it, and a reload remembers it' },
  { file: 'drawing-format.js',
    name: 'the format drops the weight',
    find: '      if (line?.weight != null && LS.weightOf(line.weight)) out.weight = Number(line.weight);\n',
    with: '',
    test: 'the LINE panel offers six weights, four styles and a colour; each writes the line and one UNDO takes it back' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4481' } });
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
