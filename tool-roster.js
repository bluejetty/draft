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
    get: id => byId.get(id) || null,
    inGroup: group => TOOLS.filter(tool => tool.group === group),
    bindings,
    keyFor,
  });
})();
