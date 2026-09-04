// FOUR SKINS, CHECKED RATHER THAN EYEBALLED.
//
// Movie's ruling, 3 Sep: RUFF DRAFTER and ROUGH DRAFTER, each night and day.
// Design the skins later; insert the possibility now. This proves the
// possibility is real -- every skin resolves, every role is defined exactly
// once, the CSS emission and the painter object agree, and every skin is
// legible by measurement rather than by squint.
//
// Movie, 2 Sep: "the texts and numbers will change, we will make them more
// visible." So legibility is asserted, and a skin that fails it fails here.
global.window = global;
require('../palette.js');
const P = window.DraftPalette;

// This harness has no mutation mode, so it accepts no arguments at all.
// Before this it never read process.argv: `node proto/palette-harness.js
// --mutate` printed a full passing run and exited 0, having mutated nothing --
// exactly the defect the other three guard against, in the one file the lift
// left behind. Note it calls noFlags() rather than mutationMode(): the latter
// would ACCEPT --mutate, hand back a true this file has no code to act on, and
// print green for a mode that does not exist. (Skipper's catch.)
require('./harness-args.js').noFlags();

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '   ' + detail : ''}`);
};

console.log('--- every skin resolves, and only the four');
for (const theme of P.THEMES) {
  for (const mode of P.MODES) {
    let ok = true, n = 0;
    try { n = Object.keys(P.resolve(theme, mode)).length; } catch (e) { ok = false; }
    check(`${theme}/${mode}`, ok && n === P.ROLES.length, `${n} roles`);
  }
}
let threw = false;
try { P.resolve('gruff', 'night'); } catch (e) { threw = true; }
check('an unknown theme throws rather than painting black', threw);
threw = false;
try { P.resolve('ruff', 'dusk'); } catch (e) { threw = true; }
check('an unknown mode throws rather than painting black', threw);

console.log('\n--- the CSS and the painters read the same table');
for (const theme of P.THEMES) {
  for (const mode of P.MODES) {
    const values = P.resolve(theme, mode);
    const css = P.toCSS(theme, mode);
    const mismatched = P.ROLES.filter(role => !css.includes(`--${role}: ${values[role]};`));
    check(`${theme}/${mode} emission matches resolution`, mismatched.length === 0,
      mismatched.length ? `differs on ${mismatched.join(', ')}` : `${P.ROLES.length} roles`);
  }
}

console.log('\n--- textures stay possible: every surface has a companion token');
const css = P.toCSS('ruff', 'night');
P.TEXTURABLE.forEach(role => check(`--${role}-tex declared`, css.includes(`--${role}-tex: none;`)));
check('only surfaces are texturable', P.TEXTURABLE.every(r => r.startsWith('surface-')));

console.log('\n--- legibility, measured (WCAG AA: 4.5 body, 3.0 large)');
// The pairs a reader actually sees. Panel ink is composited over the page
// first, because a panel at 0.82 alpha is not its own colour on screen.
const PAIRS = [
  ['ink-primary', 'surface-page', 4.5],
  ['ink-secondary', 'surface-page', 4.5],
  ['ink-quiet', 'surface-page', 4.5],
  ['accent', 'surface-page', 4.5],
  ['accent-ink', 'accent', 4.5],
  ['ink-primary', 'surface-panel', 4.5],
  ['ink-primary', 'surface-chip', 4.5],
];
let worst = Infinity, worstName = '';
for (const theme of P.THEMES) {
  for (const mode of P.MODES) {
    const v = P.resolve(theme, mode);
    PAIRS.forEach(([fg, bg, min]) => {
      const ratio = P.contrast(v[fg], v[bg], v['surface-page']);
      if (ratio < worst) { worst = ratio; worstName = `${theme}/${mode} ${fg} on ${bg}`; }
      check(`${theme}/${mode}  ${fg} on ${bg}`, ratio >= min, `${ratio.toFixed(2)} (min ${min})`);
    });
  }
}
console.log(`\n  worst pair anywhere: ${worst.toFixed(2)} — ${worstName}`);

console.log('\n--- the drawing ink separates from the ground it is drawn on');
// Not a WCAG case (these are lines, not text), but a grid that cannot be told
// from the page is a grid nobody asked for. 1.15 is a line you can see.
for (const theme of P.THEMES) {
  for (const mode of P.MODES) {
    const v = P.resolve(theme, mode);
    [['draw-grid-minor', 1.05], ['draw-grid-major', 1.15], ['draw-grid-coarse', 1.5],
      ['draw-line', 2.0]].forEach(([role, min]) => {
      const ratio = P.contrast(v[role], v['surface-page']);
      check(`${theme}/${mode}  ${role}`, ratio >= min, `${ratio.toFixed(2)} (min ${min})`);
    });
    // The three grid weights must READ as three weights, in order. Asserting
    // each against the ground separately would pass with all three identical.
    const gw = r => P.contrast(v[r], v['surface-page']);
    check(`${theme}/${mode}  grid weights are ordered fine < major < coarse`,
      gw('draw-grid-minor') < gw('draw-grid-major')
      && gw('draw-grid-major') < gw('draw-grid-coarse'),
      `${gw('draw-grid-minor').toFixed(2)} < ${gw('draw-grid-major').toFixed(2)}`
      + ` < ${gw('draw-grid-coarse').toFixed(2)}`);
    // The slab outline is drawn ON TOP of the floor wash, so the wash
    // composited over the page -- not the bare page -- is its real ground.
    // Measured against the page instead, the edge scores better than it
    // looks, which is the wrong answer arrived at comfortably. 3.0 is the
    // WCAG non-text floor; these are lines, so that is the bar that applies.
    const washed = P.contrast(v['draw-floor-edge'], v['draw-floor'], v['surface-page']);
    check(`${theme}/${mode}  draw-floor-edge over its own wash`, washed >= 3.0,
      `${washed.toFixed(2)} (min 3.0)`);

    // draw-dim is the one drawing role that is TEXT as well as line, so it
    // answers to 4.5 (WCAG AA body), not the 3.0 above -- and to it TWICE.
    // drawDimension2D paints the witness lines and arrows on the page, then
    // fills a plate behind the label and paints the string on THAT. Two
    // grounds, one colour: asserting only the page would pass a colour that
    // vanishes on the plate, and vice versa. The plate is surface-panel,
    // which carries alpha, so the page has to be composited under it.
    const dimOnPage = P.contrast(v['draw-dim'], v['surface-page']);
    const dimOnPlate = P.contrast(v['draw-dim'], v['surface-panel'], v['surface-page']);
    check(`${theme}/${mode}  draw-dim on the page (witness lines)`,
      dimOnPage >= 4.5, `${dimOnPage.toFixed(2)} (min 4.5)`);
    check(`${theme}/${mode}  draw-dim on its label plate (the string)`,
      dimOnPlate >= 4.5, `${dimOnPlate.toFixed(2)} (min 4.5)`);
    // THE GROUND THE WITNESS LINES ARE USUALLY ACTUALLY ON. A dimension
    // measures something, so in a real drawing it is nearly always drawn
    // across a floor, not across bare page. Asserting only the page measures
    // the easy case: the wash lifts the ground toward the ink and takes night
    // from 5.15 to 4.51.
    //
    // 3.0, not 4.5, and that is not a softened bar -- it is the bar that
    // applies. What crosses the wash is LINE work; the string is on the plate
    // above, which is asserted at 4.5. Demanding 4.5 here would assert a
    // WCAG rule against something it does not govern, and it would ride on a
    // 0.01 margin that any tweak to the floor wash flips red for no real
    // legibility reason.
    const dimOnFloor = P.contrast(v['draw-dim'], v['draw-floor'], v['surface-page']);
    check(`${theme}/${mode}  draw-dim over a floor (witness lines)`,
      dimOnFloor >= 3.0, `${dimOnFloor.toFixed(2)} (min 3.0)`);

    // The datum marker is a ring and crosshairs -- non-text, so 3.0. Both
    // grounds again, and the wash is the one that matters: a datum is the
    // drafter's FIRST CLICK, which normally lands on the building, so the
    // marker sits on a slab far more often than on bare page. render-2d.js
    // hardcoded #557a46 for this and it measured 2.94 over the night wash --
    // under the floor, in the exact place the marker usually lands.
    const origOnPage = P.contrast(v['draw-origin'], v['surface-page']);
    const origOnFloor = P.contrast(v['draw-origin'], v['draw-floor'], v['surface-page']);
    check(`${theme}/${mode}  draw-origin on the page`,
      origOnPage >= 3.0, `${origOnPage.toFixed(2)} (min 3.0)`);
    check(`${theme}/${mode}  draw-origin over a floor`,
      origOnFloor >= 3.0, `${origOnFloor.toFixed(2)} (min 3.0)`);
  }
}

console.log(`\n${failures ? failures + ' FAILED' : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
