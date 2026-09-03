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
require('/home/user/draft/palette.js');
const P = window.DraftPalette;

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
  }
}

console.log(`\n${failures ? failures + ' FAILED' : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
