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
    wall: 'W',
    floor: 'F',
    dimension: 'D',
    trim: 'T',
    cut: 'C',
    group: 'G',
    extend: 'X',
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
    gridSnap: '',
  });

  // Generic linework is deliberately separate from PLAN/FLOOR/E-POWER context.
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

  const normaliseKeyBinding = value => {
    const aliases = {
      esc: 'Escape', escape: 'Escape', spacebar: 'Space', space: 'Space',
      return: 'Enter', enter: 'Enter', del: 'Delete', delete: 'Delete',
      backspace: 'Backspace', ctrl: 'Ctrl', control: 'Ctrl',
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
    if (event.ctrlKey !== has('Ctrl') || event.altKey !== has('Alt')
      || event.shiftKey !== has('Shift') || event.metaKey !== has('Meta')) return false;
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
    normaliseKeyBinding,
    eventBinding,
    eventMatchesBinding,
    keyBindingLabel,
  };
  window.DraftLineLayers = {
    DEFAULT_LINE_LAYERS,
    normaliseLineLayers,
    normaliseActiveLineLayer,
  };
})();
}
