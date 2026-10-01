#!/usr/bin/env node
// A DOOR HAS A TYPE, A STYLE AND A SIZE, AND HANGS ONE OF FOUR WAYS.
//
// Movie, 1 Oct 2026:
//
//   "GARAGE DOOR (TYPE OF DOOR) OVERHEAD DOOR (STYLE) 8ftX8ft (SIZE)
//    EXT DOOR (TYPE) SLIDER (STYLE) 60 (SIZE) FRENCH (STYLE) 60 (SiZE)
//    GARDEN (STYLE) 60 (SIZE) TYP. (STYLE) SIZE (36)"
//   "they won't need seperate categories when selecting the door, only for
//    identifying them they can all be on big list"
//   "if the STLYE changes the size should remain the same, if the TYPE
//    changes the size should go to default"
//   "need to switch door swing on the side vs other side and then also
//    outside vs inswing"
//
// THREE FILES SAY IT, the casement's arrangement again: drawing-format.js
// owns the words a stored door may carry, geometry-2d.js owns the list a
// drafter picks from and its sizes, render-2d.js and cut-view.js draw them.
// The two painters keep their own lists of the styles they draw -- they
// load with nothing else on the page -- so this file is what holds the four
// lists to one another.
//
//   node proto/door-style-harness.js
const MUTATE = require('./harness-args.js').mutationMode();

const fs = require('fs');
const path = require('path');
const E = require('./elevation-harness.js');

const ROOT = path.join(__dirname, '..');

// ── THE MUTANTS ───────────────────────────────────────────────────────────
// Six, one per seam: the vocabulary, a size, the GARDEN split, the reader,
// the plan painter and the flip.
const MUTATIONS = [
  ['the vocabulary grows a style nothing draws', 'drawing-format.js',
    c => c.replace("  const DOOR_STYLES = Object.freeze(['single', 'french', 'pocket', 'barn', 'slide', 'bypass', 'garden', 'overhead']);",
      "  const DOOR_STYLES = Object.freeze(['single', 'french', 'pocket', 'barn', 'slide', 'bypass', 'garden', 'overhead', 'dutch']);")],
  ['an exterior FRENCH door is not the 60 inches he named', 'geometry-2d.js',
    c => c.replace("label: 'EXT – FRENCH', sizes: inches([48, 60, 72]), defaultFt: 60 / 12",
      "label: 'EXT – FRENCH', sizes: inches([48, 60, 72]), defaultFt: 72 / 12")],
  ['a GARDEN with no window share is all door', 'drawing-format.js',
    c => c.replace('    return stored != null && stored < width - 1 / 12 ? stored : width / 2;',
      '    return stored != null && stored < width - 1 / 12 ? stored : 0;')],
  ['a stored style is read straight through', 'drawing-format.js',
    c => c.replace("        : (isGarage ? 'overhead' : oneOf(opening?.doorStyle, DOOR_STYLES.filter(s => s !== 'overhead'), 'single'));",
      "        : (isGarage ? 'overhead' : opening?.doorStyle);")],
  ['a FRENCH door is drawn with one leaf', 'render-2d.js',
    c => c.replace('        swing(0, W / 2, 1);\n        swing(W, W / 2, -1);', '        swing(0, W, 1);')],
  ['FLIP HINGE is ignored', 'render-2d.js',
    c => c.replace('      const flipH = opening.hingeFlip === true;', '      const flipH = false;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('door-style',
    MUTATIONS, { root: ROOT, harness: __filename, preload: true });
  process.exit(all ? 0 : 1);
}

const win = E.loadDraftModules();
const G = win.DraftGeometry2D;
const F = win.DraftDrawingFormat;
// render-2d.js runs bare, as its own harness runs it -- it is not in the
// elevation loader's list -- read with readFileSync so a mutation run's
// preload hands it the bent text.
const R = (() => {
  const sandbox = { window: {} };
  require('vm').runInNewContext(fs.readFileSync(path.join(ROOT, 'render-2d.js'), 'utf8'), sandbox,
    { filename: 'render-2d.js' });
  return sandbox.window.DraftRender2D;
})();

let pass = 0;
const fails = [];
const eq = (label, got, want) => {
  if (String(got) === String(want)) { pass += 1; return; }
  fails.push(`${label} — got ${got}, want ${want}`);
};
const check = (label, ok, detail) => {
  if (ok) { pass += 1; return; }
  fails.push(detail ? `${label} — ${detail}` : label);
};
const inches = ft => Math.round(ft * 12);

// ── THE LIST AND THE WORDS AGREE ──────────────────────────────────────────
const styles = new Set(G.DOOR_CATALOG.map(e => e.style));
const types = new Set(G.DOOR_CATALOG.map(e => e.type));
eq('every style in the list is a word a stored door may carry',
  [...styles].filter(s => !F.DOOR_STYLES.includes(s)).join(','), '');
eq('and every word is offered somewhere in the list',
  F.DOOR_STYLES.filter(s => !styles.has(s)).join(','), '');
eq('every type in the list is a stored type', [...types].filter(t => !F.DOOR_TYPES.includes(t)).join(','), '');
eq('the list ids are unique', new Set(G.DOOR_CATALOG.map(e => e.id)).size, G.DOOR_CATALOG.length);

// ── THE SIZES HE NAMED ────────────────────────────────────────────────────
const entry = id => G.DOOR_CATALOG.find(e => e.id === id);
eq('EXT TYP. starts at 36"', inches(entry('ext-single').defaultFt), 36);
eq('EXT SLIDER at 60"', inches(entry('ext-slide').defaultFt), 60);
eq('EXT FRENCH at 60"', inches(entry('ext-french').defaultFt), 60);
eq('EXT GARDEN at 60"', inches(entry('ext-garden').defaultFt), 60);
eq('a GARAGE OVERHEAD at 8 ft wide', entry('garage-overhead').defaultFt, 8);
eq('and 8 ft tall', entry('garage-overhead').defaultHeightFt, 8);
check('every default is one of its own sizes', G.DOOR_CATALOG.every(e => (e.type === 'garage'
  ? e.sizes.some(s => s.widthFt === e.defaultFt && s.heightFt === e.defaultHeightFt)
  : e.sizes.some(s => Math.abs(s - e.defaultFt) < 1e-9))));
eq('the old single default is still EXT TYP.\'s', G.DEFAULT_DOOR_WIDTH_FT, entry('ext-single').defaultFt);

// ── THE READER ────────────────────────────────────────────────────────────
const ids = new Set([3]);
const read = over => F.fenestrations([{
  id: 'f1', wallId: 'w1', levelId: 3, type: 'door', width: 5, offset: 5,
  sillHeight: 0, headHeight: 6.67, ...over,
}], ids)[0];
eq('a door with nothing stored is a single', read({}).doorStyle, 'single');
eq('and of no stated type', String(read({}).doorType), 'null');
eq('a stored style survives', read({ doorStyle: 'pocket', doorType: 'int' }).doorStyle, 'pocket');
eq('and its type', read({ doorStyle: 'pocket', doorType: 'int' }).doorType, 'int');
eq('a word that is not a style falls back to single', read({ doorStyle: 'revolving' }).doorStyle, 'single');
eq('a garage door is type garage', read({ garage: true }).doorType, 'garage');
eq('and style overhead, whatever was stored', read({ garage: true, doorStyle: 'french' }).doorStyle, 'overhead');
eq('a window carries no door style', String(read({ type: 'window', sillHeight: 3, headHeight: 7 }).doorStyle), 'null');
eq('a GARDEN with no window share splits half and half', read({ doorStyle: 'garden' }).gardenWindowWidth, 2.5);
eq('a GARDEN keeps a share that leaves the leaf room', read({ doorStyle: 'garden', gardenWindowWidth: 2 }).gardenWindowWidth, 2);
eq('and refuses one that would leave no door', read({ doorStyle: 'garden', gardenWindowWidth: 5 }).gardenWindowWidth, 2.5);
eq('a non-GARDEN carries no window share', String(read({ doorStyle: 'french', gardenWindowWidth: 2 }).gardenWindowWidth), 'null');
eq('the flips are read', [read({ hingeFlip: true }).hingeFlip, read({ swingFlip: true }).swingFlip].join(','), 'true,true');
eq('and are false when not stored', [read({}).hingeFlip, read({}).swingFlip].join(','), 'false,false');
eq('the stored format version is unchanged', F.VERSION, 1);

// ── THE PLAN PAINTER ──────────────────────────────────────────────────────
// A 4 ft door in a 6" wall along x, on a tape that records every call.
const tapeCtx = () => {
  const tape = [];
  return new Proxy({ tape, lineWidth: 1 }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol') return undefined;
      return (...args) => tape.push({ op: String(prop), args });
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
};
const toS = p => ({ x: 400 + (p.x || 0) * 10, y: 300 + (p.z || 0) * 10 });
const pz = (x, z) => ({ x, y: 0, z });
const GEO = {
  corners: [pz(-2, -0.25), pz(2, -0.25), pz(2, 0.25), pz(-2, 0.25)],
  jambs: [[pz(-2, -0.25), pz(-2, 0.25)], [pz(2, -0.25), pz(2, 0.25)]],
  glazing: [pz(-2, 0), pz(2, 0)],
  center: pz(0, 0),
};
const paint = over => {
  const ctx = tapeCtx();
  R.drawOpening2D(ctx, toS, { id: 'd', type: 'door', wallId: 'w', width: 4, ...over },
    { geometry: GEO }, { isPrinting: true });
  return ctx.tape;
};
const swings = tape => tape.filter(e => e.op === 'arc'
  && !(e.args[3] === 0 && e.args[4] === Math.PI * 2)).length;
const dashed = tape => tape.some(e => e.op === 'setLineDash' && e.args[0].length > 0);
const fingerprint = tape => JSON.stringify(tape.map(e => [e.op, ...e.args.map(a =>
  (typeof a === 'number' ? Math.round(a * 100) / 100 : a))]));

eq('a single swings once', swings(paint({ doorStyle: 'single' })), 1);
eq('a door with no style swings once', swings(paint({})), 1);
eq('a FRENCH door swings twice', swings(paint({ doorStyle: 'french' })), 2);
eq('a GARDEN swings once', swings(paint({ doorStyle: 'garden' })), 1);
['pocket', 'barn', 'slide', 'bypass'].forEach(style =>
  eq(`a ${style.toUpperCase()} door does not swing`, swings(paint({ doorStyle: style })), 0));
check('the pocket is drawn dashed', dashed(paint({ doorStyle: 'pocket' })));
check('and nothing else is', ['single', 'french', 'barn', 'slide', 'bypass', 'garden']
  .every(style => !dashed(paint({ doorStyle: style }))));
const single = fingerprint(paint({}));
eq('a door stored as single draws exactly as one storing nothing', fingerprint(paint({ doorStyle: 'single' })), single);
F.DOOR_STYLES.filter(s => s !== 'single' && s !== 'overhead').forEach(style =>
  check(`a ${style.toUpperCase()} door draws something a single does not`,
    fingerprint(paint({ doorStyle: style })) !== single));
check('a stored word the painter does not know draws as a single',
  fingerprint(paint({ doorStyle: 'revolving' })) === single);

// THE FOUR WAYS IT HANGS. The leaf's open end -- the arc's centre is the
// hinge -- and which side of the wall the arc bulges into.
const hinge = over => paint(over).find(e => e.op === 'arc' && !(e.args[3] === 0 && e.args[4] === Math.PI * 2)).args;
const plain = hinge({});
const hFlip = hinge({ hingeFlip: true });
const sFlip = hinge({ swingFlip: true });
check('FLIP HINGE moves the hinge to the other jamb', Math.abs(hFlip[0] - plain[0]) > 30,
  `hinge x ${plain[0]} -> ${hFlip[0]}`);
const tipY = over => {
  const tape = paint(over);
  const leaf = tape.filter(e => e.op === 'lineTo').map(e => e.args[1]);
  return leaf.reduce((far, y) => (Math.abs(y - 300) > Math.abs(far - 300) ? y : far), 300);
};
check('FLIP SWING swings to the other side of the wall', Math.sign(tipY({}) - 300) === -Math.sign(tipY({ swingFlip: true }) - 300),
  `leaf tip y ${tipY({})} vs ${tipY({ swingFlip: true })}`);
eq('and leaves the hinge where it was', Math.round(sFlip[0]), Math.round(plain[0]));
const barnSide = over => {
  const xs = paint({ doorStyle: 'barn', ...over }).filter(e => e.op === 'lineTo' || e.op === 'moveTo').map(e => e.args[0]);
  return Math.min(...xs) < 400 - 25 ? 'start' : 'end';
};
check('the barn door parks past the hinge jamb, and moves with it',
  barnSide({}) !== barnSide({ hingeFlip: true }), `${barnSide({})} / ${barnSide({ hingeFlip: true })}`);

// ── THE ELEVATION ─────────────────────────────────────────────────────────
// The fixture's own doors, re-styled: every style other than single changes
// what the elevations draw, and a single stated is a single unstated.
{
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-L-house.draft'), 'utf8'));
  // THE FIXTURE'S ONLY DOOR IS A GARAGE DOOR, so its first window is made a
  // 5 ft door standing on the floor -- wide enough for every style's detail.
  const asDoor = (raw.fenestrations || []).find(f => f.type === 'window');
  if (asDoor) Object.assign(asDoor, { type: 'door', layer: 'A-DOOR', width: 5, sillHeight: 0, headHeight: 6.67 });
  const doors = (raw.fenestrations || []).filter(f => f.type === 'door' && !f.garage);
  check('the fixture carries a door to restyle', doors.length > 0, `${doors.length}`);
  const strokes = saved => {
    const env = E.buildEnv(win, saved);
    return JSON.stringify(E.standardElevationCuts(env).map(cut => E.paintElevation(win, env, cut).rawStrokes));
  };
  const styled = style => {
    const copy = JSON.parse(JSON.stringify(raw));
    copy.fenestrations.filter(f => f.type === 'door' && !f.garage).forEach(f => { f.doorStyle = style; });
    return strokes(copy);
  };
  const base = strokes(raw);
  eq('a door stored as single draws the same elevations as one storing nothing', styled('single') === base, true);
  ['french', 'pocket', 'barn', 'slide', 'bypass', 'garden'].forEach(style =>
    check(`a ${style.toUpperCase()} door changes the elevation`, styled(style) !== base));
}

console.log(`door-style harness: ${pass} checks passed, ${fails.length} failed`);
fails.forEach(line => console.log('  ✘ ' + line));
process.exitCode = fails.length ? 1 : 0;
