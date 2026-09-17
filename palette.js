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
    'draw-grid-coarse',  // the 100ft lines drawGrid2D draws when zoomed OUT,
                         // where the 1ft layer is off. Three weights, not two:
                         // fine 1ft / major 10ft / coarse 100ft.
    'draw-line',        // sketch lines: the drafter's own construction ink
    'draw-origin',      // the 0,0 datum marker -- a ring and crosshairs on the
                        // point the drafter first clicked. GOLD since 17 Sep,
                        // green before it; either way the point stands: it is
                        // not geometry, it is the paper's registration mark,
                        // and it must not read as a wall or a shape.
    'draw-dim',         // dimension strings, their witness lines and arrows.
                        // The only drawing role that is TEXT as well as line,
                        // so it answers to AA body contrast (4.5), not the 3.0
                        // a line gets -- and on TWO grounds, because
                        // drawDimension2D paints the label on a plate
                        // (env.colors.labelBack) and the witness lines on the
                        // page. Both values below clear 4.5 on both of theirs.
    // The five painters that had no role of their own until now. Movie, 5 Sep,
    // asked for whichever arrangement "will give us most options later", and
    // that is one key each -- NOT a borrowed neighbour, even where the value
    // is identical today. draw-note could read ink-primary and draw-underlay
    // could read draw-origin, both exact matches; both are refused, because a
    // shared key cannot diverge without a refactor and somebody restyling body
    // text would move every note on every drawing without knowing it. The 32"
    // that drifted did it by sharing one name for two facts.
    'draw-note',        // annotation text and its leader. TEXT, so it answers
                        // to 4.5 like draw-dim, not the 3.0 a line gets.
    'draw-fixture',     // the 2D fixture symbols -- cabinets, plumbing. Plan
                        // symbols today; when they gain a height nothing here
                        // changes, because this is what they are DRAWN in.
    'draw-stair',       // stair runs, nosings and the direction arrow
    'draw-cut',         // the section cut marks: the line, its flags and tail
    'draw-underlay',    // RESERVED, NOT WIRED. Nothing reads this key today,
                        // and saying so is the point: an underlay is a jpg or
                        // a PDF page you trace over, so drawUnderlays2D
                        // (render-2d.js:651) sets an opacity and calls
                        // drawImage and paints no ink at all. The photograph
                        // arrives with its own colours.
                        //
                        // It is reserved rather than dead. The painter has
                        // four refusals -- printing, wrong level, image not
                        // loaded, sub-pixel -- and every one draws nothing,
                        // including the not-loaded case where a grey
                        // placeholder is the obvious thing. So the absence of
                        // ink was chosen, and the two things that would end
                        // it are chrome nobody has built: a border showing
                        // where the page edge is, or an outline while one is
                        // dragged into position. Whoever builds either has
                        // the value and its contrast already measured.
                        //
                        // ITS PAIR IS DELIBERATELY THE SAME AS draw-origin's,
                        // and must not be collapsed into it: a tracing
                        // underlay and the drawing's registration mark are
                        // different things that happen to be the same green,
                        // and one moving is not the other moving.
    'draw-floor',       // floor polygons, a wash rather than a fill
    'draw-floor-edge',  // the slab outline and its corner handles, drawn ON
                        // TOP of that wash -- so the wash, not the page, is
                        // the ground it has to separate from
    'draw-wall',        // the wall body -- poche, not a signal. It is barely
                        // distinct from the page on BOTH skins on purpose
                        // (1.30 night, 1.12 day): a plan does not shout its
                        // walls with fill, it draws them with line.
    'draw-wall-edge',   // layer boundaries, end caps and the centreline
                        // endpoint dots -- the line that actually carries the
                        // wall. Two grounds like draw-floor-edge: the
                        // draw-wall fill it usually sits on, and the page
                        // wherever an end cap crosses bare paper. Both values
                        // clear 3.0 on both of theirs.
    'draw-shape',       // reference shapes: the drafter's own scratch geometry
    'draw-beam',        // beams: one span between two supports, flush or dropped
    'draw-column',      // teleposts and piles, and the cross that marks their centre
    'draw-roof',        // the roof footprint outline, its fill wash and its
                        // GABLE / EAVE tags. The wash and the tag text are
                        // DERIVED from this one value at low alpha rather
                        // than stored, so a roof cannot end up outlined in
                        // one brown and washed in another.
    'draw-roof-guide',  // the generated ridge / hip / valley guides, dashed.
                        // A SECOND role rather than an alpha of draw-roof,
                        // because the guides are a different kind of thing --
                        // computed rather than drawn -- and they must stay
                        // QUIETER than the footprint they belong to. That
                        // ordering is the check: guide contrast below roof
                        // contrast, on both skins.
    // Brand -- the family that actually differs between RUFF and ROUGH
    'accent',           // the one colour that carries the brand
    'accent-ink',       // text that sits ON the accent
    'accent-mark',      // the accent as an OUTLINE or a small label inside a
                        // panel, where the accent is a 1px line or 9px text on
                        // the panel's own ground rather than a fill with
                        // accent-ink on it. Movie, 17 Sep: "small things for
                        // NIGHT version only to turn gold - the stuff outlines
                        // and text in the menu areas (easier to see when its
                        // small if gold when black background)".
                        //
                        // A SECOND ROLE RATHER THAN AN ALPHA OR A TINT of the
                        // accent, because the two are not the same colour made
                        // lighter -- RUFF's red is legible as a filled chip
                        // with white on it and hard to read as a hairline on
                        // black, and the fix for that is a different HUE, not
                        // a different weight of the same one.
                        //
                        // THREE OF THE FOUR SKINS SET IT EQUAL TO accent, and
                        // that is not redundancy: it is the same argument
                        // draw-note and draw-underlay won -- a shared key
                        // cannot diverge without a refactor, and this one is
                        // diverging on exactly one skin today.
  ]);

  // Night is Movie's decided taste, 2 Sep: black ground, white and grey lines,
  // light grey floor. Day is its inverse rather than a separate design.
  // These values are PROVISIONAL -- the skins get designed later, and this
  // table is the one place that changes when they do.
  const BASE = Object.freeze({
    night: Object.freeze({
      'surface-page':    '#1d1f20',
      // HALF TRANSPARENT, AND THE SAME HALF ON BOTH MODES. Movie, 17 Sep:
      // "i'd like to allow the transparency to increase to about 50% or maybe
      // more for that 'tint area' on the side menus and on the top and bott",
      // and "i'd like the tinted panels to be used on both day and night
      // versions". It was 0.82 here and 0.88 on day -- two different amounts
      // of tint for the same idea, which is why the day chrome read as solid
      // white and the night chrome nearly as solid black.
      //
      // ONE TOKEN REACHES ALL OF IT. Every surface he named is this role:
      // both sidebars, the top strip, the bottom bar, and the readout, the
      // switch sets, the seats and the promote card besides.
      //
      // THE DIMENSION LABEL PLATE IS THIS ROLE TOO, and that is the one place
      // the alpha is doing work rather than decoration -- drawDimension2D
      // fills it behind the string. The plate stays legible because this
      // colour is within nine points of surface-page on every channel, so
      // compositing at 0.50 instead of 0.82 moves the ground by about three
      // points, not by the width of the drawing underneath. The harness
      // measures that pair rather than trusting it (proto/palette-harness.js).
      'surface-panel':   'rgba(20,22,23,0.50)',
      'surface-chip':    '#2a2d2e',
      'edge-panel':      '#3a3d3f',
      'ink-primary':     '#e7e5e2',
      'ink-secondary':   '#b9bcbe',
      'ink-quiet':       '#8b8f92',
      'draw-grid-minor': '#26292a',
      'draw-grid-major': '#34383a',
      'draw-grid-coarse': '#454a4c',
      'draw-line':       '#7f8688',
      'draw-dim':        '#6b93bd',   // 5.15 on the page, 5.56 on the plate
      // GOLD, AND IT IS THE GOLD RUFF JUST GAVE UP. Movie, 17 Sep: "can you
      // make the green target in the model space that GOLD color instead of
      // Green". The accent went red the same afternoon, so the amber the page
      // has worn since 3 Sep lands on the datum -- the same pair it always
      // was, bright on night and the dark one on day, moved from the brand to
      // the registration mark.
      //
      // IT IS A DRAWING ROLE, SO BOTH BRANDS GET IT. draw-* lives in BASE and
      // not in the theme overrides: the datum is a fact about the sheet, not
      // about whose shop it is, and a marker that changed colour with the
      // brand would be the page teaching two meanings for one mark.
      'draw-origin':     '#f0b429',   // 8.88 page / 7.78 over a floor wash
      // THE NIGHT COLUMN IS THE NEW INFORMATION HERE; day below is unchanged.
      // Four of these five were painted in their day colour on both skins,
      // and two of them -- notes and fixtures -- were #1d1f20, which IS
      // surface-page on night. Ratio 1.00: not poor contrast, the same
      // colour, so the night page lost its notes and fixtures entirely.
      // Stairs measured 2.22 and cut marks 2.95, both under the 3.0 the
      // drawRoof2D fix used. Measured by Gilligan, re-measured here.
      'draw-note':       '#e7e5e2',   // 13.16 -- body ink's twin, a note is text
      'draw-fixture':    '#e7e5e2',   // 13.16
      'draw-stair':      '#9d8ec9',   // 5.63
      'draw-cut':        '#d4788f',   // 5.42
      // AND HERE IS WHY IT WAS ITS OWN KEY. This held draw-origin's exact
      // value for two weeks under a comment saying the two were different
      // things that happened to be the same green, and that one moving was
      // not the other moving. On 17 Sep the datum went gold and this did not.
      // A shared key would have taken the underlay with it.
      'draw-underlay':   '#6a9a57',   // 5.02 -- the green the datum used to be
      'draw-floor':      'rgba(120,140,150,0.10)',
      'draw-floor-edge': '#5980a6',
      'draw-wall':       '#2f3335',   // 1.30 on the page -- poche, deliberately quiet
      'draw-wall-edge':  '#a7aeb1',   // 5.67 on the wall, 7.35 on the page
      'draw-shape':      '#3f8f7a',
      // STRUCTURE GETS ITS OWN TWO KEYS, and they are new rather than lifted.
      // MODEL.dc.html paints beams #7a4a21 and columns #1d1f20 on its single
      // skin. Both are already-known failures on this one, measured with the
      // same calculator that reproduces every number in this file: the beam
      // brown is 2.23 here, under the 3.0 non-text floor and the exact value
      // draw-roof was moved off for that reason; the column ink is 1.00,
      // literally surface-page, the same way notes and fixtures vanished.
      //
      // The column takes the remedy already proven for those two -- body ink's
      // twin. The beam clears the floor at 5.04 and sits UNDER draw-roof's 5.95
      // deliberately: a roof outline should stay the louder of the two browns.
      // Day keeps the old page's exact values, so the day reading is unchanged.
      'draw-beam':       '#b8834e',   // 5.04 night / 2.94 day -- see day column
      'draw-column':     '#e7e5e2',   // 13.16 -- ink's twin, as note and fixture
      // 5.95 on the page. The old value was #7a4a21 on BOTH skins, which is
      // 2.23 here -- under the 3.0 non-text floor, and the last colour in the
      // app that was actually broken rather than merely quiet. It also
      // inverted the hierarchy: the guides below are 3.90, so the dashed
      // helpers were LOUDER than the footprint they help. This restores the
      // reading day always had.
      'draw-roof':       '#c4915a',
      'draw-roof-guide': '#a3703f',   // 3.90 -- clears 3.0, sits under the roof's 5.95
      'accent-ink':      '#1d1f20',
    }),
    day: Object.freeze({
      'surface-page':    '#f2f2f3',
      // 0.80, NOT NIGHT'S 0.50. Movie, 17 Sep, on seeing it: "make the daytime
      // tint 80% maybe, it looks better darker". So the two modes do NOT carry
      // one number after all -- and that is a taste ruling on a white ground
      // rather than a retreat from "the same tint on both": a panel that
      // passes 50% of a light page through reads as barely there, where the
      // same 50% over a dark one still reads as a panel.
      'surface-panel':   'rgba(255,255,255,0.80)',
      'surface-chip':    '#e4e4e6',
      'edge-panel':      '#c6c8ca',
      'ink-primary':     '#1d1f20',
      'ink-secondary':   '#44484a',
      'ink-quiet':       '#666b6e',
      'draw-grid-minor': '#e0e1e3',
      'draw-grid-major': '#cbcdcf',
      'draw-grid-coarse': '#b0b3b5',
      'draw-line':       '#6b7274',
      'draw-dim':        '#365e86',   // 6.05 on the page, 6.68 on the plate
      // The dark gold, because the bright one is 1.67 on a near-white page --
      // under the 3.0 floor for a non-text mark and not a close call. Same
      // reasoning the day accent took when it was this colour.
      //
      // PICKED TO MATCH THE GREEN IT REPLACES, not to be the boldest gold that
      // passes: the green read 4.41 on the page and 3.90 over a wash, and this
      // is 4.26 and 3.77 -- the closest of the family on both. A hue change
      // should be a hue change, and a datum that got louder on the day skin
      // while only its colour was asked about is a second edit nobody made.
      // The first value tried here, #a37409, sat 0.28 over the non-text floor
      // on the wash, which is a margin to spend on nothing.
      'draw-origin':     '#966b0b',   // 4.26 page / 3.77 wash
      // EVERY ONE OF THESE IS WHAT THE PAINTER ALREADY DREW, so the day page
      // is pixel-identical after this lands. Three came from env keys
      // (NOTE_COLOR, FIXTURE_COLOR, STAIR_COLOR) and two were hardcoded
      // inside render-2d.js, which is why they could not be skinned at all.
      'draw-note':       '#1d1f20',   // 14.79
      'draw-fixture':    '#1d1f20',   // 14.79
      'draw-stair':      '#5d4a8a',   // 6.68
      'draw-cut':        '#b04060',   // 5.01
      'draw-underlay':   '#557a46',   // 4.41 -- the green the datum used to be
      'draw-floor':      'rgba(90,110,120,0.10)',
      'draw-floor-edge': '#5980a6',
      'draw-wall':       '#ffffff',   // 1.12 on the page -- the same quiet relationship
      'draw-wall-edge':  '#1d1f20',   // 16.55 on the wall, 14.79 on the page. Both
                                      // values are what render-2d.js hardcoded before
                                      // this role existed, so DAY IS UNCHANGED.
      'draw-shape':      '#2f6b5b',
      // The old page's own values, unchanged: 6.64 and 14.79 on this ground.
      'draw-beam':       '#7a4a21',   // 6.64
      'draw-column':     '#1d1f20',   // 14.79 -- ink-primary, as the old page
      'draw-roof':       '#7a4a21',   // 6.64 on the page
      'draw-roof-guide': '#a3703f',   // 3.79 -- under the roof's 6.64, same as night's ordering.
                                      // Both values are what render-2d.js hardcoded before this
                                      // role existed, so DAY IS UNCHANGED.
      'accent-ink':      '#ffffff',
    }),
  });

  // What a theme changes. Movie, 3 Sep: "the rough drafter version we will
  // change mainly through logos and colors." So a theme is an OVERRIDE, not a
  // second table -- and today it overrides exactly one role each way, which is
  // the honest size of the difference until the skins are designed.
  const THEME_OVERRIDES = Object.freeze({
    // RUFF IS RED, AND ITS BOXES ARE LETTERED IN WHITE. Movie, 17 Sep:
    // "i guess change all the gold to red, but if there is a red box and text
    // in the box make the text white (not black)", "in the RUFF version",
    // "both night and day to red not gold". So the amber goes on both modes,
    // and night's accent-ink -- which was the page's own near-black, the one
    // thing he named -- goes with it.
    //
    // THE TWO JOBS PULL APART ON NIGHT, AND NO RED SETTLES IT. The accent is
    // read as TEXT on the page (#readout b) and it is also the fill that white
    // lettering sits on, so it must be light enough to clear a near-black page
    // and dark enough to carry white. Solve the two for equality and the
    // ceiling is 4.07:1 -- both bars at once, for EVERY colour, not just for
    // red. 4.5 on both is arithmetically unavailable here, so the harness
    // asserts this pair at the ceiling and says why; see palette-harness.js.
    //
    // #fd0000 IS THE MAXIMIN, searched rather than chosen: of every red that
    // reads as one, it is the value whose WORSE ratio is highest -- 4.08 on
    // the page, 4.06 under white. Prettier reds exist a tenth lower (#e8342a
    // is 3.90/4.24); a tenth of contrast is not worth spending on taste when
    // the budget is already short. Both clear AA large text (3.0) with room.
    //
    // DAY HAS NO SUCH TENSION and so takes no exception: its page is near
    // white, both jobs want a DARK red, and #c0392b clears 4.5 twice over at
    // 4.86 and 5.44. It is the brick the old dark gold was, in red.
    ruff: Object.freeze({
      // THE ONE SKIN WHERE THE MARK LEAVES THE BRAND. Gold is the amber this
      // theme wore until the accent went red, and it is here for a measured
      // reason rather than nostalgia: on the night panel a hairline of #fd0000
      // sits at 4.06, while this gold is at 8.79. At a 1px border and a 9px
      // label that difference is the whole of whether it reads.
      //
      // DAY IS THE ACCENT ITSELF, because he scoped it -- "for NIGHT version
      // only" -- and because the reason does not apply: the day mark is a dark
      // red on a near-white panel at 4.74, which is already comfortable.
      night: Object.freeze({ accent: '#fd0000', 'accent-ink': '#ffffff',
        'accent-mark': '#f0b429' }),
      day:   Object.freeze({ accent: '#c0392b', 'accent-ink': '#ffffff',
        'accent-mark': '#c0392b' }),
    }),
    // ROUGH'S MARK IS ROUGH'S ACCENT, on both modes. The gold above is RUFF's
    // own colour and the argument for it was RUFF's red being hard to read
    // small; this brand's blue has no such problem (5.00 on the night panel),
    // and gold marks inside a blue-branded skin would be a second brand.
    rough: Object.freeze({
      night: Object.freeze({ accent: '#6b91b6',     // the drafting blue (#5980a6, 81 uses
        'accent-mark': '#6b91b6' }),                // in MODEL) lifted to clear AA on black
      day:   Object.freeze({ accent: '#365e86', 'accent-ink': '#ffffff',
        'accent-mark': '#365e86' }),
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
