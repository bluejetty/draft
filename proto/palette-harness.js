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

// MODEL.html CARRIES A COPY, AND A COPY DRIFTS. Its :root block declares the
// night values so the page is never unpainted between parse and boot; the
// comment there says palette.js overwrites all of them, which is true and is
// exactly why nothing on screen reveals it when one goes stale.
//
// IT WENT STALE THE DAY THIS WAS WRITTEN. The accent moved to red in
// palette.js and the fallback kept the old gold, and the only symptom was a
// gold frame before boot -- invisible in every screenshot and every spec.
// Caught by reading the file, which is not a method. So it is asserted.
console.log('\n--- a page that re-states a palette role matches the palette');
{
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.join(__dirname, '..');
  const night = P.resolve('ruff', 'night');

  // THE POPULATION IS THE DISK, NOT A PAGE NAMED HERE. This began as
  // MODEL.html only, which was right while MODEL was the only page with
  // pre-boot fallbacks and wrong the moment a second one grew them: a check
  // that names its subject finds the instance and leaves the class. Every
  // .html is scanned; MODEL is asserted below as a FLOOR, not an inventory.
  //
  // RUFF/NIGHT IS THE EXPECTATION AND THE CODE NAMES IT TWICE: apply()'s own
  // signature is `apply(doc, theme = 'ruff', mode = 'night')`, and MODEL's
  // boot reads storedOr('theme', ..., 'ruff') / storedOr('mode', ..., 'night').
  //
  // ONLY THE ROLES A PAGE ACTUALLY DECLARES. The block is a paint-before-boot
  // stopgap for the CHROME, not a second copy of every drawing role, and
  // demanding the rest would be inventing a requirement nobody has.
  //
  // MEMBERSHIP IN ROLES, NOT A NAME PREFIX, and check 2 below freezes why:
  // index.html declares --ink, --paper and --blue-dark, which are ENTRY's own
  // variables. A prefix rule drags ENTRY onto a roster it is deliberately off
  // -- board #310 holds it apart and it takes no skin -- and then demands it
  // match a palette it does not use. --ink is not --ink-primary.
  const decomment = src => src
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  const DECL = /--([a-z][a-z0-9-]*)\s*:\s*(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\s*[;}]/g;
  const rolesIn = src => {
    const out = [];
    DECL.lastIndex = 0;
    let m;
    while ((m = DECL.exec(decomment(src))) !== null) {
      if (P.ROLES.includes(m[1])) out.push([m[1], m[2].toLowerCase()]);
    }
    return out;
  };

  // THE INSTRUMENT BEFORE THE SUBJECT. A scanner that finds nothing reports
  // the same "0 drifted" as a repo with no drift, so it is fed four fixtures
  // by hand: one it MUST find, and three it must NOT count.
  check('the scanner finds a plain role declaration',
    rolesIn(':root { --ink-primary: #e7e5e2; }').length === 1);
  check('the scanner ignores a non-role variable',
    rolesIn(":root { --ink: #163653; --paper: #eef5fb; }").length === 0);
  check('the scanner ignores a role named inside a comment',
    rolesIn('/* --ink-primary: #e7e5e2; was the old value */').length === 0);
  check('the scanner ignores a declaration that is not a hex literal',
    rolesIn(':root { --ink-primary: var(--x); }').length === 0);

  const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();
  check('the scan reaches the pages', pages.length >= 5, `${pages.length} on disk`);

  let declaredAnywhere = 0;
  for (const page of pages) {
    const declared = rolesIn(fs.readFileSync(path.join(ROOT, page), 'utf8'));
    declaredAnywhere += declared.length;
    declared.forEach(([role, value]) => {
      check(`${page}  --${role} matches palette.js`, value === String(night[role]).toLowerCase(),
        value === String(night[role]).toLowerCase() ? value
          : `${value} in ${page}, ${night[role]} in palette.js`);
    });
  }
  check('something declares role fallbacks', declaredAnywhere > 0, `${declaredAnywhere} declarations`);
  // The floor: MODEL carried eight on 30 Sep. A count alone survives a swap.
  check('MODEL.html still carries its pre-boot fallbacks',
    rolesIn(fs.readFileSync(path.join(ROOT, 'MODEL.html'), 'utf8')).length >= 8);
}

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
  // THE MARK IS A HAIRLINE AND A 9px LABEL ON THE PANEL, which is the ground
  // it has to separate from -- not the page. Asserted at 4.5 because half of
  // what it paints is text, and this pair is the whole reason the role exists:
  // RUFF's red measured 4.06 here, which is what "hard to see when its small"
  // was.
  ['accent-mark', 'surface-panel', 4.5],
  // AND ON THE PAGE, which was never asked until SETTINGS' one link stopped
  // wearing MODEL's selection blue and took the mark instead. The mark is
  // measured on a panel because that is where the section headings sit; a
  // link in a paragraph sits on the page, and the two grounds are different
  // colours on every skin.
  ['accent-mark', 'surface-page', 4.5],
  ['ink-primary', 'surface-chip', 4.5],
  // A RESULT SENTENCE IS BODY TEXT, and it is the sentence a drafter is
  // looking for, so it answers to 4.5 rather than to the 3.0 a mark gets.
  // THREE GROUNDS EACH, because the four pages that write one do not agree
  // where it sits: SETTINGS and STANDARDS put it on the page beside the
  // buttons, LAYOUT's is inside a dialog panel, and a chip is one restyle
  // away. Gating only the ground in use today is how #557a46 survived on a
  // white page and then went out on a black one.
  ['ink-good', 'surface-page', 4.5],
  ['ink-good', 'surface-panel', 4.5],
  ['ink-good', 'surface-chip', 4.5],
  ['ink-warn', 'surface-page', 4.5],
  ['ink-warn', 'surface-panel', 4.5],
  ['ink-warn', 'surface-chip', 4.5],
  // AND THEY MUST STAY TWO COLOURS. Equal ratios are not the requirement --
  // a drafter reads "saved" and "could not" apart by hue at a glance, and a
  // palette edit that nudged both to the same lifted green would pass every
  // ratio above while deleting the distinction.
];
// THE ACCENT IS ASKED FOR TWO THINGS THAT PULL APART, AND SOMETIMES 4.5 IS
// NOT AVAILABLE FOR BOTH. It is read as text ON the page (#readout b), so it
// wants to be far from the page; and it is the fill that accent-ink is
// lettered on, so it wants to be far from that ink too. Between a page and an
// ink at opposite ends -- white lettering on a near-black page, which is what
// RUFF asks for from 17 Sep -- the accent is squeezed from both sides.
//
// THE CEILING IS SWEPT, NOT SOLVED, AND THAT IS THE SECOND VERSION OF THIS.
// The first closed form was ceiling = sqrt(contrast(ink, page)), from setting
// the two ratios equal. It is right when the accent is TRAPPED between the
// ink and the page -- white lettering, near-black page -- and badly wrong
// otherwise: on day both the ink and the page are near white, the accent
// escapes downward and both ratios grow together, but sqrt(1.06) = 1.03 and
// the check declared every day skin "squeezed" and then waved it through at
// 1.03. A cap that fires where there is no tension is a green light, which is
// worse than the red it replaced.
//
// So the ceiling is what it always was by definition: the best achievable
// value of min(both ratios), found by walking the accent's luminance across
// its whole range. No case analysis to get wrong -- when ink and page sit
// at opposite ends the sweep returns ~4.07 and the cap binds; when they sit
// together it returns ~18 and 4.5 is asked for as usual.
//
// SO THE BAR IS min(4.5, ceiling), AND IT IS A BAND, NOT A FLOOR, once the
// ceiling binds. A floor alone would pass a skin that scraped 4.07 by being
// 4.07 on one pair and 12 on the other, which is exactly the lopsided choice
// this is here to prevent -- so where the ceiling binds, both pairs must be
// AT it, within a tolerance. That makes this fail two ways: a lazy accent
// fails low, and an accent that could have been better fails for being
// unbalanced.
const CEILING_SLACK = 0.10;
// Relative luminance, read back through the one contrast function this file
// already trusts, rather than a second copy of the WCAG curve to keep in step:
// contrast(c, black) is (L + 0.05) / 0.05.
const lum = c => P.contrast(c, '#000000') * 0.05 - 0.05;
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const accentCeiling = v => {
  const ink = lum(v['accent-ink']);
  const page = lum(v['surface-page']);
  let best = 0;
  for (let i = 0; i <= 2000; i++) {
    const accent = i / 2000;
    best = Math.max(best, Math.min(ratio(ink, accent), ratio(accent, page)));
  }
  return best;
};
let worst = Infinity, worstName = '';
for (const theme of P.THEMES) {
  for (const mode of P.MODES) {
    const v = P.resolve(theme, mode);
    const ceiling = accentCeiling(v);
    const squeezed = ceiling < 4.5;
    PAIRS.forEach(([fg, bg, min]) => {
      const ratio = P.contrast(v[fg], v[bg], v['surface-page']);
      if (ratio < worst) { worst = ratio; worstName = `${theme}/${mode} ${fg} on ${bg}`; }
      const isAccentPair = (fg === 'accent' && bg === 'surface-page')
        || (fg === 'accent-ink' && bg === 'accent');
      if (!(isAccentPair && squeezed)) {
        check(`${theme}/${mode}  ${fg} on ${bg}`, ratio >= min, `${ratio.toFixed(2)} (min ${min})`);
        return;
      }
      check(`${theme}/${mode}  ${fg} on ${bg}`,
        ratio >= ceiling - CEILING_SLACK,
        `${ratio.toFixed(2)} (ceiling ${ceiling.toFixed(2)} — 4.5 is unavailable `
        + `for both accent pairs on this skin; clears AA large text)`);
    });
    if (squeezed) {
      console.log(`  note  ${theme}/${mode}  both accent pairs are capped at `
        + `${ceiling.toFixed(2)} by white-on-near-black; asserted at the cap, not at 4.5`);
    }
  }
}
console.log(`\n  worst pair anywhere: ${worst.toFixed(2)} — ${worstName}`);

console.log('\n--- a good result and a bad one are two colours, not one');
// The ratios above are satisfied by making both of these the same lifted
// green, which would read perfectly and say nothing: a drafter tells "saved"
// from "could not" by hue before reading either word. Hue angle, because
// that is the property being relied on -- two colours of equal luminance and
// different hue are exactly the case this must pass, and a contrast ratio
// between the two inks would call them identical.
const hue = css => {
  const hex = String(css).replace('#', '');
  const ch = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(...ch), min = Math.min(...ch), d = max - min;
  if (d === 0) return 0;
  const [rr, gg, bb] = ch;
  let h;
  if (max === rr) h = ((gg - bb) / d) % 6;
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
};
for (const theme of P.THEMES) {
  for (const mode of P.MODES) {
    const v = P.resolve(theme, mode);
    const apart = Math.abs(hue(v['ink-good']) - hue(v['ink-warn']));
    const degrees = Math.min(apart, 360 - apart);
    check(`${theme}/${mode}  ink-good and ink-warn are ${degrees.toFixed(0)}° apart`,
      degrees >= 40, `min 40°`);
  }
}

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

    // THE FIVE PAINTERS THAT HAD NO ROLE UNTIL NOW. Each against the page,
    // at the floor its own kind answers to: draw-note is TEXT, so 4.5 like
    // draw-dim; the other four are line and symbol work, so 3.0.
    //
    // These are the numbers that made the keys necessary rather than tidy.
    // Before them, on night: notes and fixtures were #1d1f20 -- surface-page
    // exactly, ratio 1.00 -- and stairs 2.22, cut marks 2.95, both under 3.0.
    // Two of the five were not skinnable at all, hardcoded inside the
    // painter. The floors below are what catches that class of thing coming
    // back, so they are asserted per role rather than as one aggregate.
    [['draw-note', 4.5], ['draw-fixture', 3.0], ['draw-stair', 3.0],
      ['draw-cut', 3.0], ['draw-underlay', 3.0]].forEach(([role, min]) => {
      const ratio = P.contrast(v[role], v['surface-page']);
      check(`${theme}/${mode}  ${role}`, ratio >= min, `${ratio.toFixed(2)} (min ${min})`);
    });

    // draw-underlay is asserted with the rest and is NOT WIRED to anything.
    // That is deliberate on both counts. drawUnderlays2D paints a jpg or a
    // PDF page and no ink of its own, so no painter reads the key today; it
    // is reserved for the chrome an underlay has not grown yet -- a border
    // showing the page edge, or an outline while one is dragged. Measuring it
    // now is what makes that cheap later, and a green line here means the
    // value is sound, NOT that anything consumes it. See palette.js.

    // NOT ASSERTED, AND THE DIVERGENCE ARRIVED. draw-underlay and draw-origin
    // carried the same pair from 5 Sep until 17 Sep, when the datum went gold
    // and the underlay stayed green. Pinning them EQUAL would have made that
    // a test failure -- a check that fails when the design works -- and a
    // shared key would have dragged the underlay along with it. Both were
    // argued for in advance on exactly this scenario, and both held.

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

    // STRUCTURE: THE TWO ROLES THAT WERE COMMENTS RATHER THAN CHECKS.
    //
    // Movie, 14 Sep: "check the contrast numbers on the beam colours." Every
    // figure in palette.js checked out when measured -- and that is exactly
    // the problem this block fixes. draw-beam and draw-column carried their
    // numbers as COMMENTS, in the one file whose stated job is that a skin is
    // "legible by measurement rather than by squint," while this harness
    // passed green without ever looking at either role. A number nothing
    // re-measures is a claim, and the next edit to those hexes would have
    // moved them silently. Same class as the roof's 2.23: known, written
    // down, unpoliced.
    //
    // THREE GROUNDS, because structure is drawn INSIDE the building. Bare
    // page is the ground a beam is almost never actually on -- it spans a
    // floor, and it lands on walls at each end. Measuring the page alone is
    // the comfortable wrong answer that draw-floor-edge and draw-origin were
    // both caught by. The wall poche is the worst of the three (night beam
    // 3.89 against 5.04 on the page), so it is the one that decides.
    //
    // 3.0, the WCAG non-text floor: a beam is a line and a column is a cross
    // in a circle. Neither carries a string.
    [['draw-beam', 'surface-page', 'the page'],
      ['draw-beam', 'draw-floor', 'a floor'],
      ['draw-beam', 'draw-wall', 'the wall it bears on'],
      ['draw-column', 'surface-page', 'the page'],
      ['draw-column', 'draw-floor', 'a floor']].forEach(([role, ground, where]) => {
      const ratio = P.contrast(v[role], v[ground], v['surface-page']);
      check(`${theme}/${mode}  ${role} on ${where}`, ratio >= 3.0,
        `${ratio.toFixed(2)} (min 3.0)`);
    });

    // The beam never outshouts the roof. palette.js says the night beam
    // "sits UNDER draw-roof's 5.95 deliberately: a roof outline should stay
    // the louder of the two browns" -- prose, until here. Asserting each
    // against the page separately passes with the beam brighter, which is the
    // same inversion the roof guides had.
    //
    // <=, not <, and that is not a softened bar. On DAY both roles are the
    // old page's #7a4a21 and measure 6.64 exactly, because day was left
    // untouched on purpose. Demanding < would fail on a skin that is working
    // as designed -- a check that goes red when nothing is wrong. What this
    // forbids is the real regression: a beam lifted PAST the roof.
    const beamOnPage = P.contrast(v['draw-beam'], v['surface-page']);
    const roofLouder = P.contrast(v['draw-roof'], v['surface-page']);
    check(`${theme}/${mode}  the beam stays no louder than the roof`,
      beamOnPage <= roofLouder,
      `beam ${beamOnPage.toFixed(2)} <= roof ${roofLouder.toFixed(2)}`);

    // THE ROOF, AND THE ORDER IT HAS TO KEEP.
    //
    // draw-roof was #7a4a21 on BOTH skins until 4 Sep -- 6.64 on the day page
    // and 2.23 on the night one, the last colour in the app that was under
    // the floor rather than merely quiet. Night is #c4915a now; day is
    // untouched.
    //
    // The second check is the one worth having. Asserting each role against
    // the ground separately passes with the guides brighter than the roof,
    // which is what night actually had: footprint 2.23, dashed guides 3.90.
    // The generated helpers were louder than the thing they help. So the
    // ordering is pinned, not just the floor -- the same shape as the grid
    // weights above, and for the same reason.
    const roofOnPage = P.contrast(v['draw-roof'], v['surface-page']);
    const guideOnPage = P.contrast(v['draw-roof-guide'], v['surface-page']);
    check(`${theme}/${mode}  draw-roof on the page`,
      roofOnPage >= 3.0, `${roofOnPage.toFixed(2)} (min 3.0)`);
    check(`${theme}/${mode}  draw-roof-guide on the page`,
      guideOnPage >= 3.0, `${guideOnPage.toFixed(2)} (min 3.0)`);
    check(`${theme}/${mode}  the roof guides stay quieter than the roof`,
      guideOnPage < roofOnPage,
      `guide ${guideOnPage.toFixed(2)} < roof ${roofOnPage.toFixed(2)}`);
  }
}

console.log(`\n${failures ? failures + ' FAILED' : 'all checks passed'}`);
process.exit(failures ? 1 : 0);
