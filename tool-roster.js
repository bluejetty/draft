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
    // ROOM TAG (Movie, 1 Oct): "if the user want to add a room tag,, there
    // should be a DRAFTING TOOL for ROOM TAG", and "just make ROOM TAG that a
    // user can place and fill out the info". A drafting key, so TOY has none;
    // no letter yet, like ANNOTATION beside it.
    { id: 'roomtag',      name: 'ROOM TAG',     group: 'draw',  kind: 'contextual', command: null },
    // CUT (Movie, 5 Oct): "add the 'CUT' command to the draftng menu and give
    // it LETTER command" -- C, which DEFAULT_KEYBINDINGS has carried for `cut`
    // since the old page. And on TOY too: "why not on TOY? could be on TOY i
    // think" -- a section is a way of LOOKING at the house, not drafting it.
    { id: 'cut',          name: 'CUT',          group: 'draw',  kind: 'contextual', command: 'cut' },
    // ASSEMBLY (Movie, 18 Oct): "put it up in with the other main letters and
    // allow the user to press Y first and THEN ... select ... and THEn press
    // ENTER or DOUBLE CLICK or press Y again to close the assembly as one new
    // unit". Y is the binding the old page already carried for `group`.
    { id: 'assembly',     name: 'ASSEMBLY',     group: 'draw',  kind: 'contextual', command: 'group' },
    { id: 'wall',         name: 'WALL',         group: 'build', kind: 'contextual', command: 'wall' },
    { id: 'fenestration', name: 'FENESTRATION', group: 'build', kind: 'contextual', command: 'fenestration' },
    { id: 'floor',        name: 'FLOOR',        group: 'build', kind: 'contextual', command: 'floor' },
    { id: 'roof',         name: 'ROOF',         group: 'build', kind: 'contextual', command: 'roof' },
    // DORMER (Movie, 18 Oct): "can we make a DORMER command in the BUILD
    // tab?" -- "we will start with the full dormer with only front wall like
    // on the NORTH POINT roof plan", and "i will need to refine it because
    // there are different dormer looks". No letter yet.
    { id: 'dormer',       name: 'DORMER',       group: 'build', kind: 'contextual', command: null },
    { id: 'column',       name: 'COLUMN',       group: 'build', kind: 'contextual', command: null },
    { id: 'beam',         name: 'BEAM',         group: 'build', kind: 'contextual', command: null },
    { id: 'stair',        name: 'STAIR',        group: 'build', kind: 'contextual', command: null },
    { id: 'fixture',      name: 'FIXTURE',      group: 'build', kind: 'contextual', command: null },
    // OUTLINE HAS A KEY AND NO BUTTON, which is not an oversight in this list
    // -- it is what the old page is. MODEL.dc.html's own column is these
    // seventeen and no more (:24035), while `outline` is a live activeTool
    // there with its own binding, U (profile-manager.js). It is reached by
    // pressing U or by picking a house type, never by a key in the column.
    //
    // `group: null` IS THE MECHANISM. The column is built from
    // GROUPS.map(g => inGroup(g.id)), and a tool in no group is in no group's
    // list, so it renders nothing while still answering availableOn, keyFor
    // and the register. A `hidden: true` flag would have needed the column
    // builder to learn about it; this needs nobody to.
    { id: 'outline',      name: 'OUTLINE',      group: null,    kind: 'contextual', command: 'outline' },
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
  // AND OUTLINE JOINS TOY, which is the ruling this file already carried in
  // prose: "no drafting tools EXCEPT the one gesture that makes the outline".
  // Until now that gesture had no tool of its own and the exception had to be
  // spelled 'wall'.
  //
  // WALL STAYS, and the note above predicted it would go. It does not go here
  // and the reason is a measurement I have not made: §1's squaring and
  // foot-landing rule is built on the WALL gesture, so taking wall off this
  // board moves TOY's drawing onto a path that rule does not cover. That is
  // its own rung with its own checks, not a line to change on the way past.
  // Adding outline takes nothing away from anybody; swapping them would.
  // CUT JOINS IT (Movie, 5 Oct, "could be on TOY i think"): cutting a
  // section draws nothing into the house, it only adds a way to look at it.
  // AND TRIM (Movie, 5 Oct, "this is good for now"): it only moves a wall's
  // end on to another wall, so it cannot break §1's foot and right angle.
  // ── AND THEN THE RULING CHANGED: TOY TAKES NO TOOL AWAY ─────────────────
  //
  // Movie, 15 Oct: *"lets always start the users in TOY MODE, but we should
  // allow more features (they all go dim i notices) but maybe the features
  // will be slightly limited (to ft and 90 degrees)"*, and *"maybe don't even
  // offer them to change to DRAFTING MODE, but if they enter a ANGLE or
  // length other than 1ft, it will automatically place them in DRAFTING MODE.
  // so it ill be basically a LIGHT -- not a button"*, and *"so if its in TOY
  // MODE the user will know its 90s / and 1ft"*. Asked which tools that
  // leaves on TOY, he answered: all of them.
  //
  // SO TOY IS NO LONGER A SHORTER LIST, IT IS A CONSTRAINT. The foot and the
  // right angle are what TOY is; the tools are what the page is. A drafter in
  // TOY reaches for DIMENSION and gets DIMENSION, and the first number he
  // types that a foot cannot hold moves the drawing to DRAFTING by itself.
  // That is the whole of the difference now, and it is why the board stopped
  // being a button: there is nothing left to choose.
  //
  // THE OLD LIST IS KEPT, UNUSED BY availableOn, because it is the record of
  // what TOY used to refuse and the gate and the spec both name it. Deleting
  // it would leave the three paragraphs above arguing with nothing.
  const TOY_TOOLS = Object.freeze([RESTING, 'wall', 'outline', 'cut', 'trim']);

  // EVERY TOOL, ON EVERY BOARD. An unknown id is still refused -- it would
  // arm nothing and read as "select is on", a broken state that looks like a
  // working one -- and an unknown BOARD now needs no special case, because
  // there is no board that takes anything away.
  // `_board` IS STILL IN THE SIGNATURE, and still unread on purpose: every
  // call site passes a board, and the day a board takes something away again
  // this is the one place that has to learn it.
  const availableOn = (id, _board) => byId.has(id);
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
  // AND THEY ARE ON IN TOY NOW, for the reason the tools are (above). "they
  // all go dim i notices" was about exactly this -- a drafter in TOY looking
  // at a page where half the chrome is greyed and nothing says what would
  // turn it on. Under the ruling of 15 Oct nothing turns it on, because
  // nothing turns it off: TOY is the foot and the right angle, and a panel is
  // neither. A number typed into one of these that a foot cannot hold goes
  // through the same promotion as a number typed anywhere else.
  const panelOn = (panel, _board) => PANELS.includes(panel);


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
