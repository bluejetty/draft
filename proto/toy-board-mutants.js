// DOES THE BOARD SPEC CATCH A BROKEN BOARD?
//
// Same gate and the same two hardenings as the tool-column and selection
// gates: an ambiguous anchor is refused rather than guessed at, and a survivor
// is re-run against the WHOLE spec before it is called one.
//
// All six board checks went green first try, which is the state that means
// nothing until each has been seen to fail.
const { execSync } = require('child_process');
const fs = require('fs');

const MUTANTS = [
  { file: 'MODEL.html',
    name: 'the drawing no longer overrides the remembered board',
    find: "    board = boardOfDrawing();\n    applyBoard();",
    with: '    applyBoard();',
    test: 'records DRAFTING opens on DRAFTING' },
  { file: 'MODEL.html',
    name: 'a file with no board is given one anyway',
    find: "  const boardOfDrawing = () =>\n    window.DraftDrawingFormat.board(drawing?.board) || rememberedBoard;",
    with: "  const boardOfDrawing = () => 'drafting';",
    test: 'never chose one opens on the default' },
  { file: 'MODEL.html',
    name: 'switching the board stops writing it to the drawing',
    find: "    if (drawing) {\n      drawing.board = window.DraftDrawingFormat.board(next);\n      markDirty();\n    }",
    with: '    if (drawing) { /* nothing */ }',
    test: 'writes it to the drawing and survives reload' },
  { file: 'MODEL.html',
    name: 'the load stops normalising and spreads the file through',
    find: "      board: F.board(parsed.board),",
    with: '      board: parsed.board,',
    test: 'normalised out of the file' },
  { file: 'drawing-format.js',
    name: 'the normaliser accepts anything',
    find: '  const board = raw => oneOf(raw, BOARDS, null);',
    with: '  const board = raw => raw ?? null;',
    test: 'junk board in the file' },
  { file: 'drawing-format.js',
    name: 'the normaliser invents TOY for a file that never chose',
    find: '  const board = raw => oneOf(raw, BOARDS, null);',
    with: "  const board = raw => oneOf(raw, BOARDS, 'toy');",
    test: 'round-trips' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-toy-board.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: '/home/user/draft', stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html drawing-format.js',
  { cwd: '/home/user/draft' }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `/home/user/draft/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: '/home/user/draft' });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
