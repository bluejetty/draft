// Portable personal settings and company standards packages for Draft.
// Packages are JSON data only; they never execute code when imported.
if (!window.DraftProfileManager) {
(() => {
  const FORMAT = 'draft-profile-package';
  const VERSION = 1;
  const STORAGE_PREFIX = 'draft-active-package:';

  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const copy = value => JSON.parse(JSON.stringify(value));

  const merge = (base, patch) => {
    const result = { ...(isObject(base) ? base : {}) };
    Object.entries(isObject(patch) ? patch : {}).forEach(([key, value]) => {
      result[key] = isObject(value) && isObject(result[key])
        ? merge(result[key], value)
        : copy(value);
    });
    return result;
  };

  const defaultName = () => {
    const now = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  };

  const extension = kind => `.draft.${kind}`;

  const cleanName = (value, kind) => {
    const suffix = extension(kind);
    let name = String(value || '').trim().replace(new RegExp(`${suffix.replace('.', '\\.')}$`, 'i'), '');
    name = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-');
    return name.replace(/^-|-$/g, '') || defaultName();
  };

  const activeKey = kind => `${STORAGE_PREFIX}${kind}`;

  const getActive = kind => {
    try {
      const raw = localStorage.getItem(activeKey(kind));
      const value = raw ? JSON.parse(raw) : null;
      return value?.format === FORMAT && value?.kind === kind ? value : null;
    } catch {
      return null;
    }
  };

  const saveActive = pkg => {
    try {
      localStorage.setItem(activeKey(pkg.kind), JSON.stringify(pkg));
    } catch (error) {
      console.warn('Unable to remember Draft profile package:', error);
    }
  };

  const createPackage = (kind, name, content) => {
    const previous = getActive(kind);
    return {
      format: FORMAT,
      version: VERSION,
      kind,
      name: cleanName(name, kind),
      createdAt: new Date().toISOString(),
      content: merge(previous?.content, content),
    };
  };

  const filename = pkg => `${cleanName(pkg.name, pkg.kind)}${extension(pkg.kind)}`;

  const download = pkg => {
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename(pkg);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return filename(pkg);
  };

  const parseFile = async (file, expectedKind) => {
    if (!file) throw new Error('Choose a file to import.');
    let pkg;
    try {
      pkg = JSON.parse(await file.text());
    } catch {
      throw new Error('This is not a valid Draft settings or standards file.');
    }
    if (!pkg || pkg.format !== FORMAT || pkg.version !== VERSION || !isObject(pkg.content)) {
      throw new Error('This file is not a supported Draft package.');
    }
    if (pkg.kind !== expectedKind) {
      throw new Error(`Choose a .draft.${expectedKind} file for this import.`);
    }
    return {
      ...pkg,
      name: cleanName(pkg.name || file.name, expectedKind),
      content: copy(pkg.content),
    };
  };

  const DEFAULT_KEYBINDINGS = Object.freeze({
    select: 'S',
    line: 'L',
    node: 'N',
    wall: 'W',
    floor: 'F',
    fenestration: 'E',
    shape: 'P',
    outline: 'U',
    roof: 'O',
    dimension: 'D',
    trim: 'Q',
    tsquare: 'T',
    cut: 'C',
    group: 'Y',
    groupAlt: 'Ctrl+G',
    ungroup: 'Ctrl+Shift+G',
    extend: 'X',
    extendAlt: 'Ctrl+H',
    copy: 'K',
    perspective: '1',
    top: '2',
    front: '3',
    side: '4',
    freezeLength: 'R',
    finish: 'Enter',
    finishAlt: 'Space',
    cancel: 'Escape',
    delete: 'Delete',
    undo: 'Ctrl+Z',
    redo: 'Ctrl+Shift+Z',
    background: 'B',
  });

  // Old defaults these commands used to ship with. A stored binding still
  // sitting on its retired default follows the command to the current one.
  const RETIRED_KEYBINDINGS = Object.freeze({
    group: 'G',
    trim: 'T',
  });

  // Layout presets approximate the muscle memory of other drafting apps as
  // closely as single keys allow. AutoCAD and MicroStation live on typed
  // multi-letter aliases and Revit on two-letter shortcuts, so each preset is
  // a nearest single-key match; picking one just fills the editable bindings.
  const KEYBOARD_LAYOUTS = Object.freeze({
    draft: Object.freeze({
      label: 'DRAFT native',
      note: 'The home layout — every command on its own mnemonic letter.',
      bindings: DEFAULT_KEYBINDINGS,
    }),
    autocad: Object.freeze({
      label: 'AutoCAD style',
      note: 'Nearest single keys to the classic command aliases: A arc, Q trim (TR), E extend (EX), I insert doors/windows, T ortho like F8, Space repeats/commits, Ctrl+Y redo.',
      bindings: Object.freeze({
        ...DEFAULT_KEYBINDINGS,
        node: 'A',
        fenestration: 'I',
        extend: 'E',
        redo: 'Ctrl+Y',
      }),
    }),
    revit: Object.freeze({
      label: 'Revit style',
      note: 'First letters of the two-key shortcuts: W wall (WA), Shift+W window/door (WN/DR), D dimension (DI), Q trim (TR), Ctrl+Y redo.',
      bindings: Object.freeze({
        ...DEFAULT_KEYBINDINGS,
        fenestration: 'Shift+W',
        redo: 'Ctrl+Y',
      }),
    }),
    microstation: Object.freeze({
      label: 'MicroStation style',
      note: 'Q element selection like the task list, P place shape, M trim, mnemonic letters elsewhere; Ctrl+Y stands in for Ctrl+R redo (the browser keeps Ctrl+R).',
      bindings: Object.freeze({
        ...DEFAULT_KEYBINDINGS,
        select: 'Q',
        trim: 'M',
        redo: 'Ctrl+Y',
      }),
    }),
    archicad: Object.freeze({
      label: 'ArchiCAD style',
      note: 'A arrow tool, W wall, Shift+D door/window pair, L line; undo/redo stay Ctrl+Z / Ctrl+Shift+Z as ArchiCAD ships them.',
      bindings: Object.freeze({
        ...DEFAULT_KEYBINDINGS,
        select: 'A',
        fenestration: 'Shift+D',
      }),
    }),
  });

  // Snap magnetic pull: catch radius in screen pixels for each snap type, so
  // the feel stays the same at any zoom.
  const DEFAULT_SNAP_STRENGTH = Object.freeze({ node: 4, midpoint: 4, polar: 4 });
  const SNAP_STRENGTH_RANGE = Object.freeze({ min: 1, max: 60 });

  // Drafter identity: shown at the top of Settings and destined for the
  // titleblock on printed sheets. Free text, kept to a sane length.
  const normaliseDrafter = value => {
    const stored = value && typeof value === 'object' ? value : {};
    const text = raw => (typeof raw === 'string' ? raw.trim().slice(0, 80) : '');
    return { name: text(stored.name), phone: text(stored.phone) };
  };

  const normaliseSnapStrength = value => {
    const stored = value && typeof value === 'object' ? value : {};
    const px = key => {
      const raw = Number(stored[key]);
      return Number.isFinite(raw)
        ? Math.min(SNAP_STRENGTH_RANGE.max, Math.max(SNAP_STRENGTH_RANGE.min, Math.round(raw)))
        : DEFAULT_SNAP_STRENGTH[key];
    };
    return { node: px('node'), midpoint: px('midpoint'), polar: px('polar') };
  };

  // Generic linework is deliberately separate from PLAN/FLOOR/ELECTRIC context.
  // NO-DRAFT is construction-only and is always excluded from printed output.
  const DEFAULT_LINE_LAYERS = Object.freeze({
    draft: Object.freeze({ name: 'DRAFT', visible: true, printable: true }),
    'no-draft': Object.freeze({ name: 'NO-DRAFT', visible: true, printable: false }),
  });

  const normaliseLineLayers = value => {
    const layers = value && typeof value === 'object' ? value : {};
    return {
      draft: {
        name: 'DRAFT',
        visible: typeof layers.draft?.visible === 'boolean'
          ? layers.draft.visible
          : DEFAULT_LINE_LAYERS.draft.visible,
        printable: true,
      },
      'no-draft': {
        name: 'NO-DRAFT',
        visible: typeof layers['no-draft']?.visible === 'boolean'
          ? layers['no-draft'].visible
          : DEFAULT_LINE_LAYERS['no-draft'].visible,
        printable: false,
      },
    };
  };

  const normaliseActiveLineLayer = value => value === 'no-draft' ? 'no-draft' : 'draft';

  // Company-standard CAD layer list. Ids are fixed — they are what commands
  // stamp onto entities — while the display name and print rule are office
  // standards, so exports can match a firm's AutoCAD/DXF layer conventions.
  const DEFAULT_LAYER_STANDARDS = Object.freeze([
    Object.freeze({
      group: 'Generic linework',
      layers: Object.freeze([
        Object.freeze({ id: 'draft', name: 'DRAFT', use: 'Default layer for the Line and Node / Arc tools.', printable: true }),
        Object.freeze({ id: 'no-draft', name: 'NO-DRAFT', use: 'Construction / reference linework; drawing spaces only.', printable: false }),
        Object.freeze({ id: 'SHAPE', name: 'SHAPE', use: 'Closed construction outlines (Shape tool — drawn or captured); source geometry for ROOF and FLOOR.', printable: false }),
        Object.freeze({ id: 'OUTLINE', name: 'OUTLINE', use: 'Building outline reference geometry (Outline tool); bright, never-printing guide with its master in the BONEYARD.', printable: false }),
      ]),
    }),
    Object.freeze({
      group: 'Architectural — PLAN',
      layers: Object.freeze([
        Object.freeze({ id: 'A-WALL-EXT', name: 'A-WALL-EXT', use: 'Exterior walls (Wall tool).', printable: true }),
        Object.freeze({ id: 'A-WALL-INT', name: 'A-WALL-INT', use: 'Interior walls (Wall tool).', printable: true }),
        Object.freeze({ id: 'A-FL', name: 'A-FL', use: 'Floor plan geometry.', printable: true }),
        Object.freeze({ id: 'A-FL-DECK', name: 'A-FL-DECK', use: 'Floor deck.', printable: true }),
        Object.freeze({ id: 'A-FL-FLOORING', name: 'A-FL-FLOORING', use: 'Floor finishes.', printable: true }),
        Object.freeze({ id: 'A-FL-OPNG', name: 'A-FL-OPNG', use: 'Floor openings — stairwells, chases (Fenestration tool on a selected floor).', printable: true }),
        Object.freeze({ id: 'A-DOOR', name: 'A-DOOR', use: 'Door openings (Fenestration tool).', printable: true }),
        Object.freeze({ id: 'A-GLAZ', name: 'A-GLAZ', use: 'Window openings (Fenestration tool).', printable: true }),
        Object.freeze({ id: 'A-STR', name: 'A-STR', use: 'Interior stairs with their handrails and guardrails (Stair tool).', printable: true }),
        Object.freeze({ id: 'A-STR-DECK', name: 'A-STR-DECK', use: 'Exterior / deck stairs with their handrails and guardrails.', printable: true }),
        Object.freeze({ id: 'A-FIXT', name: 'A-FIXT', use: 'Plumbing fixtures and appliances — tub, toilet, sink, fridge, stove, washer/dryer (Fixture tool).', printable: true }),
        Object.freeze({ id: 'A-CASE', name: 'A-CASE', use: 'Casework — base cabinets, vanities, and their countertops (Fixture tool).', printable: true }),
        Object.freeze({ id: 'PLAN DIMENSION', name: 'PLAN DIMENSION', use: 'Dimension strings placed in PLAN.', printable: true }),
        Object.freeze({ id: 'ROOM-IDS-AREA', name: 'ROOM-IDS-AREA', use: 'Room tags and areas.', printable: true }),
      ]),
    }),
    Object.freeze({
      group: 'Structural — FLOOR / FOUNDATION',
      layers: Object.freeze([
        Object.freeze({ id: 'S-BEAM', name: 'S-BEAM', use: 'Beams.', printable: true }),
        Object.freeze({ id: 'S-SLAB', name: 'S-SLAB', use: 'Slabs.', printable: true }),
        Object.freeze({ id: 'FLOOR DIMENSION', name: 'FLOOR DIMENSION', use: 'Dimension strings placed in FLOOR.', printable: true }),
        Object.freeze({ id: 'S-FDN', name: 'S-FDN', use: 'Foundation / frost walls and grade beams (Wall tool in FOUNDATION).', printable: true }),
        Object.freeze({ id: 'S-COL-FOOTING', name: 'S-COL-FOOTING', use: 'Columns and their pad footings.', printable: true }),
        Object.freeze({ id: 'S-FOOTING', name: 'S-FOOTING', use: 'Strip footing linework generated by BUILD HOUSE, centered on the foundation wall.', printable: true }),
        Object.freeze({ id: 'FOUNDATION DIMENSION', name: 'FOUNDATION DIMENSION', use: 'Dimension strings placed in FOUNDATION.', printable: true }),
      ]),
    }),
    Object.freeze({
      group: 'Architectural — ROOF',
      layers: Object.freeze([
        Object.freeze({ id: 'A-ROOF', name: 'A-ROOF', use: 'Roof footprints, ridges, hips, and valleys (Roof tool on ROOF).', printable: true }),
        Object.freeze({ id: 'A-ROOF-OPNG', name: 'A-ROOF-OPNG', use: 'Roof openings — skylights, chimneys, dormers (Fenestration tool on a selected roof).', printable: true }),
      ]),
    }),
    Object.freeze({
      group: 'Electrical — ELECTRIC',
      layers: Object.freeze([
        Object.freeze({ id: 'E-POWER', name: 'E-POWER', use: 'Electric linework (Line tool in ELECTRIC).', printable: true }),
        Object.freeze({ id: 'E-POWER DIMENSION', name: 'E-POWER DIMENSION', use: 'Dimension strings placed in ELECTRIC.', printable: true }),
      ]),
    }),
    Object.freeze({
      group: 'Annotation',
      layers: Object.freeze([
        Object.freeze({ id: 'A-ANNO-NOTE', name: 'NOTES', use: 'Leader notes on any plan or the stair section (Annotation tool). Named NOTES in the house standard; an AIA-style standard renames it A-ANNO-NOTE.', printable: true }),
      ]),
    }),
  ]);

  // Structure rules: office standards controlling how generated structural
  // geometry behaves. Footings ride BUILD HOUSE and stay locked against hand
  // edits unless the office allows freeform footing editing.
  const normaliseStructureStandards = value => {
    const stored = value && typeof value === 'object' ? value : {};
    return { freeformFootings: stored.freeformFootings === true };
  };

  const flatLayerStandards = () => DEFAULT_LAYER_STANDARDS.flatMap(group => group.layers);

  const normaliseLayerStandards = value => {
    const stored = value && typeof value === 'object' ? value : {};
    return Object.fromEntries(flatLayerStandards().map(layer => {
      const entry = stored[layer.id] && typeof stored[layer.id] === 'object' ? stored[layer.id] : {};
      const name = typeof entry.name === 'string' && entry.name.trim()
        ? entry.name.trim().toUpperCase()
        : layer.name;
      const printable = typeof entry.printable === 'boolean' ? entry.printable : layer.printable;
      const visible = typeof entry.visible === 'boolean' ? entry.visible : true;
      return [layer.id, { name, printable, visible }];
    }));
  };

  const normaliseKeyBinding = value => {
    const aliases = {
      esc: 'Escape', escape: 'Escape', spacebar: 'Space', space: 'Space',
      return: 'Enter', enter: 'Enter', del: 'Delete', delete: 'Delete',
      backspace: 'Backspace', ctrl: 'Ctrl', control: 'Ctrl', '`': '~',
      alt: 'Alt', option: 'Alt', shift: 'Shift', meta: 'Meta', cmd: 'Meta', command: 'Meta',
    };
    const pieces = String(value || '').split('+').map(part => part.trim()).filter(Boolean);
    if (!pieces.length) return '';
    const modifiers = [];
    let key = '';
    pieces.forEach(piece => {
      const lower = piece.toLowerCase();
      const resolved = aliases[lower] || (piece.length === 1 ? piece.toUpperCase() : '');
      if (['Ctrl', 'Alt', 'Shift', 'Meta'].includes(resolved)) {
        if (!modifiers.includes(resolved)) modifiers.push(resolved);
      } else if (resolved) {
        key = resolved;
      }
    });
    return key ? [...modifiers, key].join('+') : '';
  };

  const eventBinding = event => {
    if (['Control', 'Alt', 'Meta', 'Shift'].includes(event.key)) return '';
    const raw = event.key === ' ' ? 'Space' : event.key;
    const key = normaliseKeyBinding(raw);
    if (!key) return '';
    return normaliseKeyBinding([
      event.ctrlKey ? 'Ctrl' : '',
      event.altKey ? 'Alt' : '',
      event.shiftKey ? 'Shift' : '',
      event.metaKey ? 'Meta' : '',
      key,
    ].filter(Boolean).join('+'));
  };

  const eventMatchesBinding = (event, binding) => {
    const normalised = normaliseKeyBinding(binding);
    if (!normalised) return false;
    const parts = normalised.split('+');
    const key = parts.pop();
    const has = modifier => parts.includes(modifier);
    // Symbols that live on shifted keys ('~' on grave, '#' on 3) match with or without Shift.
    const shiftAgnostic = key === '~' || key === '#';
    if (event.ctrlKey !== has('Ctrl') || event.altKey !== has('Alt')
      || (!shiftAgnostic && event.shiftKey !== has('Shift')) || event.metaKey !== has('Meta')) return false;
    return normaliseKeyBinding(event.key === ' ' ? 'Space' : event.key) === key;
  };

  const keyBindingLabel = value => normaliseKeyBinding(value).replace('Escape', 'Esc');

  window.DraftProfileManager = {
    defaultName,
    createPackage,
    download,
    parseFile,
    getActive,
    saveActive,
  };
  window.DraftKeyboard = {
    DEFAULT_KEYBINDINGS,
    RETIRED_KEYBINDINGS,
    KEYBOARD_LAYOUTS,
    normaliseKeyBinding,
    eventBinding,
    eventMatchesBinding,
    keyBindingLabel,
  };
  window.DraftSnapStrength = {
    DEFAULT_SNAP_STRENGTH,
    SNAP_STRENGTH_RANGE,
    normaliseSnapStrength,
  };
  window.DraftDrafter = {
    normaliseDrafter,
  };
  window.DraftLineLayers = {
    DEFAULT_LINE_LAYERS,
    normaliseLineLayers,
    normaliseActiveLineLayer,
  };
  window.DraftLayerStandards = {
    DEFAULT_LAYER_STANDARDS,
    normaliseLayerStandards,
  };
  window.DraftStructureStandards = {
    normaliseStructureStandards,
  };
})();
}
