// THE SEVENTEEN TOOLS, as data.
//
// MODEL.dc.html builds this list inline at :23890-23907 out of two factories,
// `standardTool` (:22789) and `contextualTool` (:22770). That distinction is
// load-bearing and it comes across: a STANDARD tool cancels every other
// in-flight gesture and sets the tool; a CONTEXTUAL tool brings options with
// it and can be unavailable in the current view. Four are standard, thirteen
// are contextual — counted from the old page, not guessed.
//
// THE FIVE BARE KEYS ARE NOT AN OVERSIGHT. ANNOTATION, COLUMN, BEAM, STAIR and
// FIXTURE have no entry in profile-manager.js's DEFAULT_KEYBINDINGS, so the old
// page prints no letter on those five faces. That was read off the running page
// rather than derived, because it cannot be derived from a table the commands
// are absent from — `shortcut(tool)` on a missing command is the empty string,
// and an empty string and a letter nobody wrote down look the same in source.
// Inventing letters for them would be improving on the roster, which the order
// for this work explicitly excludes.
//
// WHAT THIS FILE DOES NOT DO: it holds no state, arms nothing and knows nothing
// about gestures. It is the list and the letters. The register that decides
// which one is active lives in the page.
(() => {
  if (window.DraftToolRoster) return;

  const GROUPS = Object.freeze([
    Object.freeze({ id: 'draw', label: 'DRAW / EDIT' }),
    Object.freeze({ id: 'build', label: 'BUILD' }),
  ]);

  // `command` is the key into DEFAULT_KEYBINDINGS, or null where the old page
  // has none. `name` is the face text exactly as the old page prints it —
  // including "NODE / ARC", which is one tool with a two-part name and not two
  // keys. The standard four are title-case there and the contextual thirteen
  // upper-case; the keypad renders both through one text-transform, so the
  // stored strings stay as measured rather than being flattened here.
  const TOOLS = Object.freeze([
    { id: 'select',       name: 'Select',       group: 'draw',  kind: 'standard',   command: 'select' },
    { id: 'extend',       name: 'Extend',       group: 'draw',  kind: 'standard',   command: 'extend' },
    { id: 'copy',         name: 'Copy',         group: 'draw',  kind: 'standard',   command: 'copy' },
    { id: 'trim',         name: 'Trim',         group: 'draw',  kind: 'standard',   command: 'trim' },
    { id: 'node',         name: 'NODE / ARC',   group: 'draw',  kind: 'contextual', command: 'node' },
    { id: 'line',         name: 'LINE',         group: 'draw',  kind: 'contextual', command: 'line' },
    { id: 'shape',        name: 'SHAPE',        group: 'draw',  kind: 'contextual', command: 'shape' },
    { id: 'dimension',    name: 'DIMENSION',    group: 'draw',  kind: 'contextual', command: 'dimension' },
    { id: 'annotation',   name: 'ANNOTATION',   group: 'draw',  kind: 'contextual', command: null },
    { id: 'wall',         name: 'WALL',         group: 'build', kind: 'contextual', command: 'wall' },
    { id: 'fenestration', name: 'FENESTRATION', group: 'build', kind: 'contextual', command: 'fenestration' },
    { id: 'floor',        name: 'FLOOR',        group: 'build', kind: 'contextual', command: 'floor' },
    { id: 'roof',         name: 'ROOF',         group: 'build', kind: 'contextual', command: 'roof' },
    { id: 'column',       name: 'COLUMN',       group: 'build', kind: 'contextual', command: null },
    { id: 'beam',         name: 'BEAM',         group: 'build', kind: 'contextual', command: null },
    { id: 'stair',        name: 'STAIR',        group: 'build', kind: 'contextual', command: null },
    { id: 'fixture',      name: 'FIXTURE',      group: 'build', kind: 'contextual', command: null },
  ].map(Object.freeze));

  const byId = new Map(TOOLS.map(tool => [tool.id, tool]));

  // ── WHICH TOOLS A BOARD OFFERS ────────────────────────────────────────────
  // ONE PLACE DECIDES, and it is here rather than in the page, because this is
  // the file that owns the list. §6 of the TOY bones order is "no other
  // tools", and the answer has to be one answer: the keypad, the register and
  // the board switch all ask this function, so a key cannot look available
  // while the register refuses it -- a disagreement a drafter reads as the
  // page being broken.
  //
  // THE RULING IT IMPLEMENTS is Skipper's, in
  // RD-DOCUMENTS/IMPORTANT-WORK-ORDERS/SPEC-toy-mode-constraints.md: "A wall
  // can be manipulated ONLY through a grip tab. There is no drafting tool in
  // TOY MODE."
  //
  // WALL IS THE ONE EXCEPTION, AND IT IS NOW RULED RATHER THAN INFERRED.
  // Movie, 13 Sep, relayed: the spec's sentence is the older document, and the
  // OUTLINE GETS DRAWN IN TOY -- drawing the outline is not a drafting tool,
  // it is how a TOY house begins. So §6 reads: no drafting tools EXCEPT the
  // one gesture that makes the outline. §1's squaring and foot-landing is that
  // gesture's rule, and would have been dead code under any other reading.
  //
  // WHY THE KEY IS 'wall' AND NOT 'outline'. The gesture that makes the
  // outline on this page today IS draw-wall -- there is no separate outline
  // tool in the roster, and §1 was built on the wall gesture. The ruling is
  // about the GESTURE, not the key, so if the outline ever becomes a tool of
  // its own this list names that one instead and WALL goes down with the rest.
  // Recorded here because a future reader would otherwise see a wall exception
  // where the rule is an outline exception.
  //
  // SELECT IS NOT A DRAFTING TOOL, it is the resting state -- the page falls
  // back to it whenever it puts a tool down. A board that did not offer it
  // would leave the page with no legal state to rest in -- the fallback would
  // land on a refused tool -- so tests/model-tool-boards.spec.js asserts
  // RESTING is available on EVERY board rather than trusting the list below.
  const BOARDS = Object.freeze(['toy', 'drafting']);
  const RESTING = 'select';
  const TOY_TOOLS = Object.freeze([RESTING, 'wall']);

  // An unknown board is treated as DRAFTING -- the unrestricted one. The other
  // way round, an unknown board would silently strip sixteen tools off the
  // column and look exactly like TOY working, which is the failure mode this
  // whole file is arranged against.
  const availableOn = (id, board) => {
    if (!byId.has(id)) return false;
    return board === 'toy' ? TOY_TOOLS.includes(id) : true;
  };
  const availableIn = board => TOOLS.filter(tool => availableOn(tool.id, board));

  // THE OTHER TWO SURFACES §6 NAMES. Its sentence is "the seventeen-key
  // column, the selection filters, the assembly verbs -- none of them operate
  // in TOY", and the first of those three was all I built. These are the other
  // two, and they answer from here for the reason the tools do: one place, so
  // a panel cannot look live while the board refuses it.
  //
  // ALL-OR-NOTHING, UNLIKE TOOLS. A board offers SOME tools -- TOY keeps the
  // gesture that makes the outline -- but a panel is one capability and it is
  // either on the board or it is not. Modelling panels as a list of individual
  // controls would invite a half-lit SELECTION panel, which is the shape of
  // thing this section exists to forbid.
  const PANELS = Object.freeze(['selection', 'assembly']);
  const panelOn = (panel, board) => {
    if (!PANELS.includes(panel)) return false;
    return board !== 'toy';
  };


  // REMAPS COME FROM SETTINGS, and they come through the same two functions the
  // old page uses (:22765-22766) rather than a second reading of the same
  // stored object. A profile that moves TRIM off Q must move this key face too,
  // or the column tells a drafter to press a key that does nothing.
  const bindings = () => {
    const kb = window.DraftKeyboard;
    if (!kb) return {};
    const stored = window.DraftProfileManager
      ?.getActive('settings')?.content?.keybindings;
    return kb.resolveKeybindings(stored && typeof stored === 'object' ? stored : {});
  };

  // The empty string, not a placeholder: a bare face is what the old page
  // draws, and a '—' or a '?' would be this page inventing a fact about a tool.
  const keyFor = (id, resolved) => {
    const tool = byId.get(id);
    if (!tool || !tool.command) return '';
    const map = resolved || bindings();
    const raw = map[tool.command];
    if (!raw) return '';
    return window.DraftKeyboard?.keyBindingLabel(raw) || '';
  };

  window.DraftToolRoster = Object.freeze({
    GROUPS,
    TOOLS,
    BOARDS,
    RESTING,
    availableOn,
    availableIn,
    PANELS,
    panelOn,
    get: id => byId.get(id) || null,
    inGroup: group => TOOLS.filter(tool => tool.group === group),
    bindings,
    keyFor,
  });
})();
