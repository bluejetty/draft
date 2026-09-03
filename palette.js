// Colour, in one place, for four dashboards: RUFF DRAFTER and ROUGH DRAFTER,
// each night and day. See RD-DOCUMENTS/SPEC-skins.md for the ruling this
// implements and the measurements that shaped it.
//
// WHY THIS IS JAVASCRIPT AND NOT A STYLESHEET.
// MODEL.dc.html carries 743 hex colour literals. Only 59 of them are inside
// its <style> block; 684 are set from JavaScript -- 174 inline style
// attributes and 52 canvas fillStyle/strokeStyle assignments. A palette built
// as CSS custom properties alone would reach 8% of the colour and leave the
// drawing itself unskinned. So one table, two consumers: toCSS() for the
// stylesheet, resolve() for the painters.
//
// ROLES ARE NAMED FOR WHAT A THING IS, NEVER FOR THE COLOUR IT HAPPENS TO BE.
// `--ink-dimension`, not `--white`. In day mode that ink is dark, and a token
// called `--white` would be a lie in half the skins.
if (!window.DraftPalette) {
(() => {
  // Two axes, not one enum of four. Theme picks the brand; mode picks the
  // surface luminance. A fifth brand costs a row and a third mode costs a
  // column; four named skins would cost a rewrite the first time either grows.
  const THEMES = Object.freeze(['ruff', 'rough']);
  const MODES = Object.freeze(['night', 'day']);

  // The role list IS the contract. A painter asking for a role not on it gets
  // a throw, not a silent `undefined` that paints transparent black and looks
  // like a geometry bug for an hour.
  const ROLES = Object.freeze([
    // Surface -- the only family that may carry a texture. See TEXTURE below.
    'surface-page',     // the ground the drawing sits on, and the canvas clear
    'surface-panel',    // readouts, trays, floating chrome
    'surface-chip',     // inline code, tags, small enclosed runs of text
    // Edge
    'edge-panel',       // the line around a panel
    // Ink
    'ink-primary',      // body text
    'ink-secondary',    // supporting text that is still meant to be read
    'ink-quiet',        // hints and captions, deliberately below the fold
    // Drawing -- what the painters put on the canvas
    'draw-grid-minor',
    'draw-grid-major',
    'draw-line',        // sketch lines: the drafter's own construction ink
    'draw-floor',       // floor polygons, a wash rather than a fill
    'draw-shape',       // reference shapes: the drafter's own scratch geometry
    // Brand -- the family that actually differs between RUFF and ROUGH
    'accent',           // the one colour that carries the brand
    'accent-ink',       // text that sits ON the accent
  ]);

  // Night is Movie's decided taste, 2 Sep: black ground, white and grey lines,
  // light grey floor. Day is its inverse rather than a separate design.
  // These values are PROVISIONAL -- the skins get designed later, and this
  // table is the one place that changes when they do.
  const BASE = Object.freeze({
    night: Object.freeze({
      'surface-page':    '#1d1f20',
      'surface-panel':   'rgba(20,22,23,0.82)',
      'surface-chip':    '#2a2d2e',
      'edge-panel':      '#3a3d3f',
      'ink-primary':     '#e7e5e2',
      'ink-secondary':   '#b9bcbe',
      'ink-quiet':       '#8b8f92',
      'draw-grid-minor': '#26292a',
      'draw-grid-major': '#34383a',
      'draw-line':       '#7f8688',
      'draw-floor':      'rgba(120,140,150,0.10)',
      'draw-shape':      '#3f8f7a',
      'accent-ink':      '#1d1f20',
    }),
    day: Object.freeze({
      'surface-page':    '#f2f2f3',
      'surface-panel':   'rgba(255,255,255,0.88)',
      'surface-chip':    '#e4e4e6',
      'edge-panel':      '#c6c8ca',
      'ink-primary':     '#1d1f20',
      'ink-secondary':   '#44484a',
      'ink-quiet':       '#666b6e',
      'draw-grid-minor': '#e0e1e3',
      'draw-grid-major': '#cbcdcf',
      'draw-line':       '#6b7274',
      'draw-floor':      'rgba(90,110,120,0.10)',
      'draw-shape':      '#2f6b5b',
      'accent-ink':      '#ffffff',
    }),
  });

  // What a theme changes. Movie, 3 Sep: "the rough drafter version we will
  // change mainly through logos and colors." So a theme is an OVERRIDE, not a
  // second table -- and today it overrides exactly one role each way, which is
  // the honest size of the difference until the skins are designed.
  const THEME_OVERRIDES = Object.freeze({
    ruff: Object.freeze({
      night: Object.freeze({ accent: '#f0b429' }),  // the warm amber already on the page
      day:   Object.freeze({ accent: '#8a6207', 'accent-ink': '#ffffff' }),
    }),
    rough: Object.freeze({
      night: Object.freeze({ accent: '#6b91b6' }),  // the drafting blue (#5980a6, 81 uses
                                                   // in MODEL) lifted to clear AA on black
      day:   Object.freeze({ accent: '#365e86', 'accent-ink': '#ffffff' }),
    }),
  });

  // Textures are not designed yet and there are none in the app -- 0 gradients,
  // 0 image fills, every surface a flat colour. The cost of keeping them
  // POSSIBLE is one token per surface, spent now: a page writes
  //   background-color: var(--surface-panel);
  //   background-image: var(--surface-panel-tex, none);
  // Two properties rather than the `background:` shorthand, whose layer list
  // parses differently with and without an image. A skin defining no -tex
  // renders the flat fill it renders today.
  const TEXTURABLE = Object.freeze(['surface-page', 'surface-panel', 'surface-chip']);

  const isTheme = t => THEMES.includes(t);
  const isMode = m => MODES.includes(m);

  // Resolve to the flat object the painters read. Frozen, because a painter
  // that writes to the palette is a bug that surfaces three screens later.
  function resolve(theme = 'ruff', mode = 'night') {
    if (!isTheme(theme)) throw new Error(`DraftPalette: unknown theme "${theme}"`);
    if (!isMode(mode)) throw new Error(`DraftPalette: unknown mode "${mode}"`);
    const out = { ...BASE[mode], ...THEME_OVERRIDES[theme][mode] };
    // Every role defined, every key a role. Caught here rather than on screen.
    const missing = ROLES.filter(role => !out[role]);
    if (missing.length) {
      throw new Error(`DraftPalette: ${theme}/${mode} is missing ${missing.join(', ')}`);
    }
    const extra = Object.keys(out).filter(key => !ROLES.includes(key));
    if (extra.length) {
      throw new Error(`DraftPalette: ${theme}/${mode} defines unknown role ${extra.join(', ')}`);
    }
    return Object.freeze(out);
  }

  // The same table as CSS custom property declarations, for the stylesheet.
  // Texturable surfaces get their companion -tex token declared as `none` so
  // the property always exists and a skin only ever overrides it.
  function toCSS(theme = 'ruff', mode = 'night') {
    const values = resolve(theme, mode);
    const lines = ROLES.map(role => `  --${role}: ${values[role]};`);
    TEXTURABLE.forEach(role => lines.push(`  --${role}-tex: none;`));
    return lines.join('\n');
  }

  // Apply to a document at boot: the custom properties, plus the two data
  // attributes a stylesheet or a test can select on.
  function apply(doc, theme = 'ruff', mode = 'night') {
    const values = resolve(theme, mode);
    const root = doc.documentElement;
    ROLES.forEach(role => root.style.setProperty(`--${role}`, values[role]));
    TEXTURABLE.forEach(role => {
      if (!root.style.getPropertyValue(`--${role}-tex`)) {
        root.style.setProperty(`--${role}-tex`, 'none');
      }
    });
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-mode', mode);
    return values;
  }

  // Legibility is a measurement, not a squint. Movie, 2 Sep: "the texts and
  // numbers will change, we will make them more visible." A skin that fails
  // contrast should fail a test. WCAG 2.1 relative luminance; alpha is
  // composited over `over` first, because a panel at 0.82 is not its own
  // colour on screen.
  function parse(css, over = null) {
    const s = String(css).trim();
    let r, g, b, a = 1;
    const rgb = s.match(/^rgba?\(([^)]+)\)$/i);
    if (rgb) {
      const parts = rgb[1].split(',').map(v => parseFloat(v.trim()));
      [r, g, b] = parts;
      if (parts.length > 3) a = parts[3];
    } else {
      let hex = s.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      if (hex.length !== 6 && hex.length !== 8) throw new Error(`DraftPalette: cannot parse "${css}"`);
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
      if (hex.length === 8) a = parseInt(hex.slice(6, 8), 16) / 255;
    }
    if (a < 1 && over) {
      const base = parse(over);
      r = r * a + base.r * (1 - a);
      g = g * a + base.g * (1 - a);
      b = b * a + base.b * (1 - a);
      a = 1;
    }
    return { r, g, b, a };
  }

  function luminance(css, over = null) {
    const { r, g, b } = parse(css, over);
    const channel = v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  // Contrast ratio, 1 to 21. WCAG AA body text wants 4.5; large text 3.
  function contrast(fg, bg, over = null) {
    const a = luminance(fg, over);
    const b = luminance(bg, over);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  window.DraftPalette = Object.freeze({
    THEMES,
    MODES,
    ROLES,
    TEXTURABLE,
    resolve,
    toCSS,
    apply,
    contrast,
    luminance,
  });
})();
}
