// LINE STYLES: the weights, colours and dash patterns a drawn LINE can carry
// (Movie, 19 Oct): "for the LINE -- it need some PROPERTIES that can change
// too. put in 5 line weights from thin to thick ... allow the user to select
// line color from full spectrum as another property, and also if the line is
// DASHED (stuff above), SOLID, DOT DASHED (property lines / beams), etc" --
// and, a minute later, "Add 4.5 XTRA-BOLD".
//
// ONE TABLE FOR THE WEIGHTS. The sheets already stroke at a dozen widths
// (0.5 to 4.5 px, render-2d.js) with no names on any of them; these six are
// named, thin to thick, and the painter, the panel, the saved record and the
// DXF all read this file rather than each keeping a number. The thinnest
// and thickest are the sheets' own extremes.
//
// A STYLE IS A DASH PATTERN, in screen pixels at 1 px of ink, scaled with
// the weight so a bold dashed line keeps its rhythm. SOLID is the empty
// array the canvas takes as "no dash". The DXF names beside them are the
// AutoCAD linetypes a drafter expects for each.
(() => {
  'use strict';
  const WEIGHTS = Object.freeze([
    Object.freeze({ id: 1, name: 'HAIR', px: 0.5 }),
    Object.freeze({ id: 2, name: 'FINE', px: 1 }),
    Object.freeze({ id: 3, name: 'MEDIUM', px: 1.5 }),
    Object.freeze({ id: 4, name: 'HEAVY', px: 2.5 }),
    Object.freeze({ id: 5, name: 'BOLD', px: 3.5 }),
    Object.freeze({ id: 6, name: 'XTRA-BOLD', px: 4.5 }),
  ]);
  const STYLES = Object.freeze([
    Object.freeze({ id: 'solid', name: 'SOLID', dash: Object.freeze([]), dxf: 'CONTINUOUS' }),
    Object.freeze({ id: 'dashed', name: 'DASHED', dash: Object.freeze([8, 5]), dxf: 'DASHED' }),
    Object.freeze({ id: 'dotdash', name: 'DOT DASH', dash: Object.freeze([12, 5, 2, 5]), dxf: 'CENTER' }),
    Object.freeze({ id: 'dotted', name: 'DOTTED', dash: Object.freeze([2, 4]), dxf: 'DOT' }),
  ]);
  const DEFAULT_WEIGHT = 2;
  const DEFAULT_STYLE = 'solid';
  const weightOf = id => WEIGHTS.find(w => w.id === Number(id)) || null;
  const styleOf = id => STYLES.find(s => s.id === String(id)) || null;
  // THE SAVED FIELDS, made safe: a weight is one of the six or the default,
  // a style one of the four or solid, a colour a #rrggbb or none (none means
  // the skin's own line ink, which is what every line drawn before today
  // has). Lower case, six digits, so two spellings of one colour cannot be
  // two colours.
  const weightId = raw => (weightOf(raw) ? Number(raw) : DEFAULT_WEIGHT);
  const styleId = raw => (styleOf(raw) ? String(raw) : DEFAULT_STYLE);
  const colorHex = raw => {
    const s = String(raw ?? '').trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
    return null;
  };
  // WHAT THE PAINTER STROKES WITH. `inkScale` is print's multiplier on
  // every width (render-2d reads env.inkScale the same way), 1 on screen.
  const strokeFor = (line, { inkScale = 1 } = {}) => {
    const w = weightOf(line?.weight) || weightOf(DEFAULT_WEIGHT);
    const s = styleOf(line?.style) || styleOf(DEFAULT_STYLE);
    const k = Math.max(0.5, w.px);
    return { lineWidth: w.px * inkScale, dash: s.dash.map(d => d * Math.max(1, k) * inkScale), color: colorHex(line?.color) };
  };
  // THE DXF LINETYPE FOR A DASH PATTERN the recorder saw, so SAVE DXF can
  // name what was stroked: four marks a DOT DASH (CENTER), a mark well
  // shorter than its gap a DOT, two others DASHED (an even 4,4 is a dash),
  // none CONTINUOUS.
  const dxfLinetypeForDash = dash => {
    const d = Array.isArray(dash) ? dash.filter(Number.isFinite) : [];
    if (!d.length) return 'CONTINUOUS';
    if (d.length >= 4) return 'CENTER';
    return d[0] * 1.5 <= d[1] ? 'DOT' : 'DASHED';
  };
  window.DraftLineStyles = Object.freeze({
    WEIGHTS, STYLES, DEFAULT_WEIGHT, DEFAULT_STYLE,
    weightOf, styleOf, weightId, styleId, colorHex, strokeFor, dxfLinetypeForDash,
  });
})();
