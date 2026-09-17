// DOES THE BOARD SPEC CATCH A BROKEN BOARD?
//
// Same gate and the same two hardenings as the tool-column and selection
// gates: an ambiguous anchor is refused rather than guessed at, and a survivor
// is re-run against the WHOLE spec before it is called one.
//
// All six board checks went green first try, which is the state that means
// nothing until each has been seen to fail.
//
// RESULT: 6/6. Five died on the first run; the survivor is worth keeping in
// mind because of WHERE it pointed. Dropping the load-time normalise
// (`board: F.board(parsed.board)` -> `board: parsed.board`) left every check
// green, because boardOfDrawing() normalises too -- so junk never reaches the
// switch by either route, and every check I had written was aimed at the
// switch. What the mutant actually changes is what the SAVE keeps: the file
// would carry "banana" as its board for ever, a value no page can honour.
//
// The rule for that was already written down one key over, in
// persisted-format's own words: "buildType: the reader normalises what it does
// not know, and the writer never emits it". A survivor that looks like a
// redundant line is usually a check aimed at the wrong surface.
const { execSync } = require('child_process');
const fs = require('fs');
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

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
  { file: 'MODEL.html',
    name: 'a typed length in TOY promotes without asking',
    find: "    if (board === 'toy' && !drawing?.boardPromptSeen) {\n      askToPromote(() => commitTypedLength());\n      return;\n    }",
    with: '',
    test: 'asks before it promotes' },
  { file: 'MODEL.html',
    name: 'Stay in TOY records itself as an answer',
    find: "  promote.querySelector('[data-promote-stay]').addEventListener('click', closePromote);",
    with: "  promote.querySelector('[data-promote-stay]').addEventListener('click', () => { if (drawing) drawing.boardPromptSeen = true; closePromote(); });",
    test: 'Stay in TOY changes nothing' },
  { file: 'MODEL.html',
    name: 'Continue promotes but never commits the length',
    find: '    if (go) go();',
    with: '',
    test: 'Continue promotes and commits' },
  { file: 'MODEL.html',
    name: 'Continue commits but forgets to promote',
    find: "    setBoard('drafting');\n    if (go) go();",
    with: '    if (go) go();',
    test: 'Continue promotes and commits' },
  { file: 'MODEL.html',
    name: 'Continue does not remember, so it asks every time',
    find: '    if (drawing) { drawing.boardPromptSeen = true; markDirty(); }',
    with: '',
    test: 'does not ask twice' },
  { file: 'MODEL.html',
    name: 'the confirm fires in DRAFTING too',
    // DISAMBIGUATED. That line guards BOTH typed-length and typed-angle
    // (:7959). This mutation is the LENGTH one -- its test says so -- and
    // replace() taking the first match is the only reason it has been
    // landing there. The askToPromote call names which.
    find: "    if (board === 'toy' && !drawing?.boardPromptSeen) {\n      askToPromote(() => commitTypedLength());",
    with: "    if (!drawing?.boardPromptSeen) {\n      askToPromote(() => commitTypedLength());",
    test: 'in DRAFTING a typed length just commits' },
  { file: 'MODEL.html',
    name: 'TOY stops squaring when the T-square is down',
    find: "  const squaring = () => tsquareOn || board === 'toy';",
    with: '  const squaring = () => tsquareOn;',
    test: 'no way to switch on' },
  { file: 'MODEL.html',
    name: 'squaring leaks into DRAFTING',
    find: "  const squaring = () => tsquareOn || board === 'toy';",
    with: '  const squaring = () => true;',
    test: 'does not leak' },
  { file: 'MODEL.html',
    name: 'TOY stops rounding to the foot',
    // RE-POINTED: the board test moved into onTheFoot_if().
    find: "    return onTheFoot_if() ? onTheFoot(drawStart, free) : free;",
    with: '    return free;',
    test: 'TOY commits an axis' },
  { file: 'MODEL.html',
    name: 'the foot rounding leaks into DRAFTING',
    // RE-POINTED: the board test moved into onTheFoot_if().
    find: "    return onTheFoot_if() ? onTheFoot(drawStart, free) : free;",
    with: '    return onTheFoot(drawStart, free);',
    test: 'does not leak' },
  { file: 'MODEL.html',
    name: 'the foot is rounded per coordinate instead of along the run',
    find: '    const feet = Math.max(1, Math.round(len));\n    return { x: from.x + (dx / len) * feet, y: 0, z: from.z + (dz / len) * feet };',
    with: '    return { x: Math.round(pt.x), y: 0, z: Math.round(pt.z) };',
    test: 'measured along the run' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-toy-board.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html drawing-format.js',
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
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
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
