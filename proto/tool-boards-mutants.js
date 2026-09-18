// DOES THE BOARDS SPEC CATCH A BOARD THAT CONSTRAINS NOTHING?
//
// §6, "no other tools". Same gate and the same two hardenings as the four
// before it: an ambiguous anchor is refused rather than guessed at, and a
// survivor is re-run against the WHOLE spec before it is called one.
//
// THE MUTANTS ARE ARRANGED AROUND ONE FEAR. This work has a look (fifteen
// greyed keys) and a rule (the register refusing). The look is the easy half
// and it is the half a test naturally reaches for, so a spec can be thoroughly
// green while the rule is not there at all -- greyed keys over a register that
// still takes ROOF. Mutant 7 removes the rule and leaves the look untouched;
// mutants 11 and 12 do the reverse. If any of those three survives, this file
// is measuring a picture.
const { execSync } = require('child_process');
const fs = require('fs');
// THE REPO ROOT, DERIVED. This read '/home/user/draft', which resolves on
// exactly one machine -- the same fault test.yml records for
// load-order-harness and palette-harness, and the reason nobody on another
// checkout could run this gate at all.
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  // ── the one place that decides ──────────────────────────────────────────
  { file: 'tool-roster.js',
    name: 'TOY offers everything after all',
    find: "    return board === 'toy' ? TOY_TOOLS.includes(id) : true;",
    with: '    return true;',
    test: 'the other fifteen keys are down' },
  { file: 'tool-roster.js',
    name: 'an unknown board falls SHUT instead of open',
    find: "    return board === 'toy' ? TOY_TOOLS.includes(id) : true;",
    with: '    return TOY_TOOLS.includes(id);',
    test: 'the roster answers per board' },
  // THE ANCHOR MOVED WHEN OUTLINE BECAME A TOOL OF ITS OWN (18 Sep) and this
  // file went red the same run, which is exactly what it is for: a mutation
  // whose `find` no longer matches stops testing anything and says nothing.
  { file: 'tool-roster.js',
    name: 'TOY loses the wall tool, so §1 has nothing to run on',
    find: "  const TOY_TOOLS = Object.freeze([RESTING, 'wall', 'outline']);",
    with: "  const TOY_TOOLS = Object.freeze([RESTING, 'outline']);",
    test: 'the roster answers per board' },
  { file: 'tool-roster.js',
    name: 'TOY loses SELECT, so the fallback lands on a refused tool',
    find: "  const TOY_TOOLS = Object.freeze([RESTING, 'wall', 'outline']);",
    with: "  const TOY_TOOLS = Object.freeze(['wall', 'outline']);",
    test: 'the roster answers per board' },
  // AND THE NEW MEMBER GETS ITS OWN. Movie's ruling is that the outline
  // gesture survives on TOY -- "drawing the outline is not a drafting tool, it
  // is how a TOY house begins" -- so a board that drops it is a board that
  // will not let a TOY house start.
  { file: 'tool-roster.js',
    name: 'TOY loses the outline gesture, so a TOY house cannot begin',
    find: "  const TOY_TOOLS = Object.freeze([RESTING, 'wall', 'outline']);",
    with: "  const TOY_TOOLS = Object.freeze([RESTING, 'wall']);",
    test: 'the roster answers per board' },
  { file: 'tool-roster.js',
    name: 'an id that is not a tool is available',
    find: '    if (!byId.has(id)) return false;',
    with: '',
    test: 'the roster answers per board' },

  // ── the look ────────────────────────────────────────────────────────────
  { file: 'MODEL.html',
    name: 'the keypad stops putting the keys down',
    find: '      btn.disabled = !usable;',
    with: '      btn.disabled = false;',
    test: 'the other fifteen keys are down' },
  { file: 'MODEL.html',
    name: 'a down key is dimmed by 2% -- the rule exists and shows nothing',
    find: '  .tool-key:disabled, .tool-key:disabled:hover { opacity:0.35;',
    with: '  .tool-key:disabled, .tool-key:disabled:hover { opacity:0.98;',
    test: 'LOOKS down' },
  { file: 'MODEL.html',
    name: 'the down look is sprayed over every key, available or not',
    find: '  .tool-key:disabled, .tool-key:disabled:hover { opacity:0.35;',
    with: '  .tool-key, .tool-key:disabled:hover { opacity:0.35;',
    test: 'LOOKS down' },
  { file: 'MODEL.html',
    name: 'a down key stops saying why',
    find: "      btn.title = usable ? tool.name\n        : `${tool.name} — the TOY board does not offer this tool`;",
    with: '      btn.title = tool.name;',
    test: 'says WHY' },
  { file: 'MODEL.html',
    name: 'the reason is put on keys it is not true of',
    find: "      btn.title = usable ? tool.name\n        : `${tool.name} — the TOY board does not offer this tool`;",
    with: '      btn.title = `${tool.name} — the TOY board does not offer this tool`;',
    test: 'says WHY' },

  // ── the rule ────────────────────────────────────────────────────────────
  { file: 'MODEL.html',
    name: 'THE REGISTER STOPS REFUSING and only the greying is left',
    find: '    const next = roster && roster.availableOn(id, board) ? id : RESTING_TOOL;',
    with: '    const next = roster && roster.get(id) ? id : RESTING_TOOL;',
    test: 'forced back on' },
  { file: 'MODEL.html',
    name: 'a board change repaints the faces but leaves the tool armed',
    find: '    if (roster && !roster.availableOn(activeTool, board)) setTool(RESTING_TOOL);',
    with: '',
    test: 'puts down a tool TOY does not offer' },
  { file: 'MODEL.html',
    name: 'a board change disarms EVERYTHING, including what the board offers',
    find: '    if (roster && !roster.availableOn(activeTool, board)) setTool(RESTING_TOOL);',
    with: '    setTool(RESTING_TOOL);',
    test: 'survives the switch' },
  { file: 'MODEL.html',
    name: 'the board never tells anyone it changed',
    find: '    boardListeners.forEach(fn => fn(board));',
    with: '',
    test: 'against a browser remembering DRAFTING' },

  { file: 'MODEL.html',
    name: 'THE BUG ITSELF: a board change rebuilds the slot and wipes its neighbours',
    find: '    if (roster && !roster.availableOn(activeTool, board)) setTool(RESTING_TOOL);\n    refreshToolAvailability();',
    with: '    if (roster && !roster.availableOn(activeTool, board)) setTool(RESTING_TOOL);\n    buildToolColumn();',
    test: 'leaves the panels that share the tool slot alone' },

  // ── §6's OTHER TWO SURFACES ─────────────────────────────────────────────
  { file: 'tool-roster.js',
    name: 'every panel is on every board',
    find: "    return board !== 'toy';\n  };",
    with: '    return true;\n  };',
    test: 'the selection filters do not operate in TOY' },
  { file: 'MODEL.html',
    name: 'the selection chips stop obeying the board',
    find: "      const on = window.DraftToolRoster?.panelOn('selection', board) !== false;",
    with: '      const on = true;',
    test: 'the selection filters do not operate in TOY' },
  { file: 'MODEL.html',
    name: 'the chips go down but keep looking live',
    find: '  .sel-chip:disabled, .sel-chip:disabled:hover { opacity:0.35;',
    with: '  .sel-chip:disabled, .sel-chip:disabled:hover { opacity:0.97;',
    test: 'the selection filters do not operate in TOY' },
  { file: 'MODEL.html',
    name: 'the assembly verbs stop obeying the board',
    find: "      const on = window.DraftToolRoster?.panelOn('assembly', board) !== false;",
    with: '      const on = true;',
    test: 'the assembly verbs do not operate in TOY' },
  { file: 'MODEL.html',
    name: 'the selection count beats the board, so TOY frees ASSEMBLY once something is picked',
    find: '      asmBtn.disabled = !on || n === 0;',
    with: '      asmBtn.disabled = n === 0;',
    test: 'the assembly verbs do not operate in TOY' },
  { file: 'MODEL.html',
    name: 'a board change never reaches the two panels',
    find: '    syncSelectionPanel();\n    syncAssembly();',
    with: '',
    test: 'the selection filters do not operate in TOY' },

  // ── §8 ──────────────────────────────────────────────────────────────────
  { file: 'MODEL.html',
    name: 'the disclaimer comes back after the constraint landed',
    // RE-POINTED. The anchor held the title as §6 left it; §1-§5 rewrote it
    // to name the geometry rule too, so the old string stopped matching and
    // this mutation reported SKIPPED -- counted in the score, checking
    // nothing. The behaviour is unchanged: the title states what the board
    // DOES, and must not fall back to disclaiming that nothing is
    // constrained. Taken from the subject verbatim rather than retyped --
    // the em dashes are why this anchor is easy to break by hand.
    find: "    b.title = b.dataset.board === 'toy'\n      ? 'TOY board — walls only, square and whole-foot; the other tools are put away'\n      : 'DRAFTING board — the full tool column, any angle and any length';",
    with: "    b.title = 'Board mode — remembered, but nothing is constrained by it yet';",
    test: 'no longer disclaim' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-tool-boards.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

const dirty = execSync('git status --porcelain MODEL.html tool-roster.js',
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
