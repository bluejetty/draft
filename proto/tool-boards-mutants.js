// DOES THE BOARDS SPEC CATCH A BOARD THAT STILL REFUSES SOMETHING?
//
// IT USED TO ASK THE OPPOSITE QUESTION. Under §6, "no other tools", TOY
// offered five keys out of twenty and this gate's fear was a board that
// constrained nothing: fifteen greyed keys over a register that still took
// ROOF. Movie overturned that on 15 Oct -- TOY offers the whole roster, the
// switch became a lamp, and a number a foot cannot hold promotes the drawing
// by itself.
//
// SO THE FEAR TURNS OVER WITH IT, and the pairing stays: this work still has
// a LOOK (every key live, a lamp in the corner) and a RULE (the register
// taking the tool, the board seeded nowhere but TOY). A spec can be
// thoroughly green while only one of them is true -- live keys over a
// register that refuses, or a lamp that says TOY on a drawing that is not.
// The mutants below take the two apart.
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
    name: 'TOY goes back to its five tools',
    find: '  const availableOn = (id, _board) => byId.has(id);',
    with: "  const availableOn = (id, board) => byId.has(id)\n"
      + "    && (board !== 'toy' || TOY_TOOLS.includes(id));",
    test: 'the roster offers every tool on every board' },
  { file: 'tool-roster.js',
    name: 'an id that is not a tool is available',
    find: '  const availableOn = (id, _board) => byId.has(id);',
    with: '  const availableOn = (id, _board) => true;',
    test: 'the roster offers every tool on every board' },
  { file: 'tool-roster.js',
    name: 'the panels go back to being off in TOY',
    find: '  const panelOn = (panel, _board) => PANELS.includes(panel);',
    with: "  const panelOn = (panel, board) => PANELS.includes(panel) && board !== 'toy';",
    test: 'the selection filters and the assembly verbs operate on TOY' },

  // ── the look ────────────────────────────────────────────────────────────
  { file: 'MODEL.html',
    name: 'the keypad puts the build keys down anyway',
    find: '      btn.disabled = !usable;',
    with: "      btn.disabled = tool.group === 'build' && board === 'toy';",
    test: 'no key is down on TOY' },
  { file: 'MODEL.html',
    name: 'a key still says the board refuses it',
    find: '      btn.title = tool.name;',
    with: "      btn.title = board === 'toy'\n"
      + "        ? `${tool.name} — the TOY board does not offer this tool` : tool.name;",
    test: 'a key on TOY says its own name' },

  // ── the rule ────────────────────────────────────────────────────────────
  { file: 'MODEL.html',
    name: 'THE REGISTER STILL REFUSES, with every key lit over it -- the look '
      + 'without the rule, which is what this gate is for',
    find: '    const next = roster && roster.availableOn(id, board) ? id : RESTING_TOOL;',
    with: "    const next = roster && roster.availableOn(id, board)\n"
      + "      && !(board === 'toy' && roster.get(id)?.group === 'build') ? id : RESTING_TOOL;",
    test: 'the register ARMS a drafting tool on TOY' },

  // ── the lamp ────────────────────────────────────────────────────────────
  { file: 'MODEL.html',
    name: 'the lamp says TOY whatever board the drawing is on',
    find: "    boardLamp.querySelector('[data-board-lamp]').textContent = toy ? 'TOY' : 'DRAFTING';",
    with: "    boardLamp.querySelector('[data-board-lamp]').textContent = 'TOY';",
    test: 'the lamp says DRAFTING, and goes out' },
  { file: 'MODEL.html',
    name: 'the light never goes out, so a promoted drawing looks like a TOY one',
    find: "    boardLamp.toggleAttribute('data-lit', toy);",
    with: "    boardLamp.toggleAttribute('data-lit', true);",
    test: 'the lamp says DRAFTING, and goes out' },
  { file: 'MODEL.html',
    name: 'the lamp drops its second row, so it is a label rather than an '
      + 'instrument -- "the user will know its 90s / and 1ft"',
    find: "    boardLamp.querySelector('[data-board-lamp-note]').textContent = toy\n"
      + "      ? '1 FT · 90°' : 'ANY LENGTH';",
    with: "    boardLamp.querySelector('[data-board-lamp-note]').textContent = '';",
    test: 'the board is a lamp, and there is nothing to press' },

  // ── where a new drawing starts ──────────────────────────────────────────
  { file: 'MODEL.html',
    name: 'the browser seeds the board again, so one promoted drawing puts '
      + 'every later one on DRAFTING before its first wall',
    find: "    window.DraftDrawingFormat.board(drawing?.board) || 'toy';",
    with: '    window.DraftDrawingFormat.board(drawing?.board) || board;',
    test: 'every new drawing starts on TOY' },
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
