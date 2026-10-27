// DOES THE BOARD SPEC CATCH A BROKEN BOARD?
//
// Same gate and the same two hardenings as the tool-column and selection
// gates: an ambiguous anchor is refused rather than guessed at, and a survivor
// is re-run against the WHOLE spec before it is called one.
//
// REWRITTEN 16 OCT for the ruling that took the promotion card away; the six
// mutants about Continue / Stay went with it and the ones below took their
// place. The note under this one is kept because its lesson is not about the
// card: a survivor that looks like a redundant line is usually a check aimed
// at the wrong surface.
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
  { file: 'model/17-boot-save.js',
    name: 'the drawing no longer overrides the board the page is on',
    find: "    board = boardOfDrawing();\n    applyBoard();",
    with: '    applyBoard();',
    test: 'records DRAFTING opens on DRAFTING' },
  { file: 'model/14-promotion-tools.js',
    name: 'a file with no board is given one anyway',
    find: "  const boardOfDrawing = () =>\n    window.DraftDrawingFormat.board(drawing?.board) || 'toy';",
    with: "  const boardOfDrawing = () => 'drafting';",
    test: 'never chose one opens on the default' },
  { file: 'model/14-promotion-tools.js',
    name: 'the promotion stops writing the board to the drawing, so the '
      + 'drawing reopens on TOY with a wall TOY could not have made',
    find: "    if (drawing) {\n      drawing.board = window.DraftDrawingFormat.board(next);\n      markDirty();\n    }",
    with: '    if (drawing) { /* nothing */ }',
    test: 'writes the board to the drawing and survives reload' },
  { file: 'model/17-boot-save.js',
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

  // ── THE PROMOTION, WHICH USED TO BE A QUESTION ──────────────────────────
  //
  // Six mutants here were about the Continue / Stay card: that it came up,
  // that Stay recorded nothing, that Continue both promoted AND committed,
  // that it asked once per drawing. Movie took the card away on 15 Oct --
  // "it will automatically place them in DRAFTING MODE" -- and the ways to
  // get THAT wrong are different ones: a number that moves the board and
  // loses the wall, a wall that commits and leaves the board behind, a
  // promotion that fires on a length TOY draws natively, and one that never
  // tells the drafter it happened.
  { file: 'model/14-promotion-tools.js',
    name: 'the board is never moved, so a wall TOY cannot make is drawn on TOY',
    find: "    if (board !== 'toy' || toyCouldHoldIt) return false;\n    setBoard('drafting');",
    with: "    if (board !== 'toy' || toyCouldHoldIt) return false;",
    test: 'promotes on the spot' },
  { file: 'model/14-promotion-tools.js',
    name: 'the promotion eats the wall it was typed for -- the old card\'s '
      + '"nothing commits while it is asking", with nothing asking',
    find: '    promoteForNumber(toyCouldMakeLength(feet), String(lengthBox.value).trim());',
    with: '    if (promoteForNumber(toyCouldMakeLength(feet), String(lengthBox.value).trim())) return;',
    test: 'promotes on the spot' },
  { file: 'model/14-promotion-tools.js',
    name: 'the value is never read: every typed length promotes, even one TOY '
      + 'draws natively',
    find: '    promoteForNumber(toyCouldMakeLength(feet), String(lengthBox.value).trim());',
    with: '    promoteForNumber(false, String(lengthBox.value).trim());',
    test: 'a whole foot in TOY commits without asking' },
  { file: 'model/14-promotion-tools.js',
    name: 'it fires in DRAFTING too, which is a board change to the board it '
      + 'is already on and a strip line saying so',
    find: "    if (board !== 'toy' || toyCouldHoldIt) return false;",
    with: '    if (toyCouldHoldIt) return false;',
    test: 'in DRAFTING a typed length just commits' },
  { file: 'model/14-promotion-tools.js',
    name: 'the promotion says nothing, so the mode flips under a drafter who '
      + 'is watching his wall and not the corner',
    find: '    sayOnStrip(promotionWord(said));',
    with: '',
    test: 'the strip says so' },
  { file: 'model/14-promotion-tools.js',
    name: 'the strip answers with a tidied number instead of what he typed',
    find: '    promoteForNumber(toyCouldMakeLength(feet), String(lengthBox.value).trim());',
    with: '    promoteForNumber(toyCouldMakeLength(feet), `${feet} ft`);',
    test: 'the strip says so' },
  { file: 'model/14-promotion-tools.js',
    name: 'the ANGLE box never promotes, so an off-square bearing is kept on TOY',
    find: '    if (!promoteForNumber(toyCouldMakeAngle(deg), `${deg}°`)) {',
    with: '    if (!promoteForNumber(true, `${deg}°`)) {',
    test: 'an angle TOY cannot draw promotes' },
  { file: 'model/14-promotion-tools.js',
    name: 'a quarter turn promotes too, though it is the angle TOY itself draws',
    find: '  const toyCouldMakeAngle = deg => Math.abs(deg % 90) < 1e-9;',
    with: '  const toyCouldMakeAngle = () => false;',
    test: 'an angle TOY DRAWS ITSELF keeps it on TOY' },
  { file: 'model/14-promotion-tools.js',
    name: 'the lamp is never repainted, so the corner still says TOY',
    find: '    paintBoardLamp();',
    with: '',
    test: 'the lamp goes out with it' },

  // ── AND WHAT TOY STILL IS ───────────────────────────────────────────────
  { file: 'model/13-suites-trim-follow.js',
    name: 'TOY stops squaring when the T-square is down',
    find: "  const squaring = () => tsquareLive() || board === 'toy';",
    with: '  const squaring = () => tsquareLive();',
    test: 'no way to switch on' },
  { file: 'model/13-suites-trim-follow.js',
    name: 'squaring leaks into DRAFTING',
    find: "  const squaring = () => tsquareLive() || board === 'toy';",
    with: '  const squaring = () => true;',
    test: 'does not leak' },
  { file: 'model/10-tracking-garage.js',
    name: 'TOY stops rounding to the foot',
    // RE-POINTED: the board test moved into onTheFoot_if().
    find: "    return onTheFoot_if() ? onTheFoot(drawStart, free) : free;",
    with: '    return free;',
    test: 'TOY commits an axis' },
  { file: 'model/10-tracking-garage.js',
    name: 'the foot rounding leaks into DRAFTING',
    // RE-POINTED: the board test moved into onTheFoot_if().
    find: "    return onTheFoot_if() ? onTheFoot(drawStart, free) : free;",
    with: '    return onTheFoot(drawStart, free);',
    test: 'does not leak' },
  { file: 'model/09-draw-move-stretch.js',
    name: 'the foot is rounded per coordinate instead of along the run',
    find: '    const feet = Math.max(minFeet, Math.round(len));\n    return { x: from.x + (dx / len) * feet, y: 0, z: from.z + (dz / len) * feet };',
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
