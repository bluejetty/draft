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
    // MOVE AND STRETCH (Movie, 20 Oct: "add another command- 2 more - for the
    // DRAFTING area - MOVE "M" and also STRETCH" -- "HHHHHH" for STRETCH, "YES
    // in drafting keys and keep move bottom too"). MOVE is the foot's MOVE
    // pressed from the column; STRETCH is a crossing box, a base point and a
    // destination.
    { id: 'move',         name: 'MOVE',         group: 'draw',  kind: 'contextual', command: 'move' },
    { id: 'stretch',      name: 'STRETCH',      group: 'draw',  kind: 'contextual', command: 'stretch' },
    // SUPERNODE (Movie, 20 Oct) stood here on the old NODE / ARC slot and
    // its N, and is gone (26 Oct: "maybe we can get rid of that, it didn't
    // work that good").
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
    // MULTIPLE (Movie, 27 Oct: "i notice we don't have a MULTIPLE button yet.
    // put a button in the DRAFTING menu we can work on it later") --
    // ARCHICAD's Multiply. A PLACEHOLDER: the key is there and says it is
    // coming; it arms nothing.
    { id: 'multiple',     name: 'MULTIPLE',     group: 'draw',  kind: 'contextual', command: null, placeholder: true },
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

  // SELECT IS NOT A DRAFTING TOOL, it is the resting state -- the page falls
  // back to it whenever it puts a tool down, so it must always be on offer.
  const RESTING = 'select';
  // EVERY TOOL, ALWAYS. An unknown id is still refused -- it would arm
  // nothing and read as "select is on", a broken state that looks like a
  // working one. The TOY board, which used to offer a shorter list and then
  // (15 Oct) the same list under a whole-foot rule, came out of the program on
  // 9 Nov 2026; the keypad, the register and the panels still ask HERE, so
  // the day one place wants to take a tool away this is the one that learns.
  const availableOn = id => byId.has(id);
  const availableIn = () => TOOLS.filter(tool => availableOn(tool.id));

  // THE OTHER TWO SURFACES: the selection filters and the assembly verbs.
  // They answer from here for the reason the tools do: one place, so a panel
  // cannot look live while the register refuses it. All-or-nothing, unlike
  // tools: a panel is one capability, and a half-lit SELECTION panel is the
  // shape of thing this exists to forbid.
  const PANELS = Object.freeze(['selection', 'assembly']);
  const panelOn = panel => PANELS.includes(panel);


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
