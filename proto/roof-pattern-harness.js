// THE ROOFING MATERIALS, DRAWN -- what each hatch actually puts on the sheet.
//
//   node proto/roof-pattern-harness.js
//   node proto/roof-pattern-harness.js --mutate   break it, prove each break is caught
//
// TWO OF THE WALL PATTERNS WERE WRONG THE FIRST TIME AND BOTH WERE CAUGHT BY
// LOOKING, not by any check: cedar shake closed into rectangles and read as
// coursed ashlar, and ledgestone's joints lined up into diagonal streaks.
// Neither crashed, neither failed anything, and both were plainly wrong on
// sight. So the checks here are the ones that would have said so -- measured
// on the geometry, because "it looks like a tile roof" is not a thing a
// harness can ask.
//
// AND THE CLAIMS ARE THE DISTINCTIONS. Ten materials come to seven pictures,
// which is only worth anything if the seven are actually distinguishable: a
// standing seam that grew courses is a metal panel, a slate laid in line is a
// metal panel, and a barrel tile whose rolls run the full slope is corrugated
// steel. Each of those is a different material at a different weight on a
// sheet somebody frames a house from, so each pair is checked apart.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
const FILES = ['roof-types.js', 'roof-patterns.js'];
const read = name => fs.readFileSync(path.join(ROOT, name), 'utf8');

// A CONTEXT THAT REMEMBERS, AND HONOURS translate: the relief pass IS a
// translate, so a recorder dropping it cannot see the one thing relief does.
function recorder() {
  const strokes = [];
  let cur = null, tx = 0, ty = 0;
  const stack = [];
  const ctx = {
    strokeStyle: '#000', fillStyle: '#000', lineWidth: 1, globalAlpha: 1,
    beginPath() { cur = []; },
    moveTo(x, y) { (cur || (cur = [])).push({ x: x + tx, y: y + ty, move: true }); },
    lineTo(x, y) { (cur || (cur = [])).push({ x: x + tx, y: y + ty }); },
    arc(x, y, r) { (cur || (cur = [])).push({ x: x + tx, y: y + ty, r, arc: true }); },
    closePath() {},
    stroke() {
      if (cur && cur.length) {
        strokes.push({ pts: cur.slice(), alpha: this.globalAlpha,
          w: this.lineWidth, ink: this.strokeStyle });
      }
    },
    fill() {}, fillRect() {}, strokeRect() {}, rect() {}, clip() {},
    save() { stack.push({ tx, ty, a: this.globalAlpha, w: this.lineWidth }); },
    restore() {
      const was = stack.pop();
      if (was) { tx = was.tx; ty = was.ty; this.globalAlpha = was.a; this.lineWidth = was.w; }
    },
    translate(x, y) { tx += x; ty += y; },
    setLineDash() {}, scale() {}, rotate() {},
  };
  return { ctx, strokes };
}

function load(mutate) {
  let src = Object.fromEntries(FILES.map(name => [name, read(name)]));
  if (mutate) {
    const next = mutate({ ...src });
    if (FILES.every(name => next[name] === src[name])) {
      throw new Error('mutation matched nothing -- it would prove nothing');
    }
    src = next;
  }
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON, Set };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const name of FILES) vm.runInContext(src[name], sandbox, { filename: name });
  return win;
}

function run(win) {
  const missed = [];
  const check = (label, ok, detail) => {
    if (!ok) missed.push({ label, detail });
    if (!MUTATION_MODE) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `   ${detail}` : ''}`);
    return ok;
  };
  const T = win.DraftRoofTypes;
  const P = win.DraftRoofPatterns;
  if (!T?.ROOFING_TYPES || !P?.drawRoofing) {
    missed.push({ label: 'both modules load', detail: `${!!T} ${!!P}` });
    return missed;
  }

  // ── THE FRAME EVERY CHECK IS MEASURED IN ──────────────────────────────
  //
  // A PLAIN ONE FIRST: the eave horizontal, up the slope straight up the
  // screen. Nothing about the patterns depends on that -- the sloped frame
  // below proves it -- but a claim stated in an axis-aligned frame is a claim
  // a person can read.
  const PX = 40;                       // 40 px per foot: big enough to hatch
  const FLAT = { ox: 0, oy: 400, ax: 1, ay: 0, ux: 0, uy: -1,
    wide: 600, high: 300, pxPerFt: PX };

  // Every segment a pattern lays down, as {a, b} pairs in screen pixels.
  const segments = strokes => strokes.flatMap(st => {
    const out = [];
    for (let i = 1; i < st.pts.length; i += 1) {
      if (st.pts[i].move) continue;
      out.push({ a: st.pts[i - 1], b: st.pts[i], alpha: st.alpha });
    }
    return out;
  });
  const draw = (id, frame = FLAT) => {
    const { ctx, strokes } = recorder();
    const drew = P.drawRoofing(ctx, frame, T.roofingById(id), { hatch: '#000' });
    return { drew, segs: segments(strokes), strokes };
  };
  // IN THE FRAME'S OWN AXES, which is the only language these claims can be
  // stated in once a roof is sloped: how far along the eave, how far up.
  const inFrame = (frame, pt) => ({
    s: (pt.x - frame.ox) * frame.ax + (pt.y - frame.oy) * frame.ay,
    t: (pt.x - frame.ox) * frame.ux + (pt.y - frame.oy) * frame.uy,
  });
  const EPS = 0.01;
  // A COURSE runs across: both ends at the same height up the slope.
  const courses = (segs, frame = FLAT) => segs.filter(seg =>
    Math.abs(inFrame(frame, seg.a).t - inFrame(frame, seg.b).t) < EPS);
  // A RAKE runs up: both ends at the same place along the eave.
  const rakes = (segs, frame = FLAT) => segs.filter(seg =>
    Math.abs(inFrame(frame, seg.a).s - inFrame(frame, seg.b).s) < EPS);

  // ── THE FIXTURE'S OWN REACH ───────────────────────────────────────────
  //
  // Every claim below is of the shape "this pattern draws X", which is
  // triumphantly false of a pattern that drew nothing -- and a pattern that
  // draws nothing is what a gate set one number too high produces. So the
  // table is walked first and told to put SOMETHING down.
  const silent = T.ROOFING_TYPES.filter(r => !draw(r.id).segs.length);
  check('fixture: at this scale every roofing in the table hatches',
    silent.length === 0, silent.map(r => r.id).join(' ') || 'all ten');
  check('and an unknown pattern draws nothing rather than throwing',
    P.drawRoofing(recorder().ctx, FLAT, { pattern: 'thatch' }, {}) === false, 'false');

  // ── THE SCALE GATE ────────────────────────────────────────────────────
  //
  // Below three pixels a spacing is a grey wash that hides the roof's outline
  // while saying a material is there without saying which. Asked at a scale
  // where every row is under the gate, and just above it, so the check is
  // about the GATE and not about one row's numbers.
  const TINY = { ...FLAT, pxPerFt: 2 };
  const hatchedTiny = T.ROOFING_TYPES.filter(r => draw(r.id, TINY).segs.length);
  check('a roof too small to read takes no hatch at all',
    hatchedTiny.length === 0, hatchedTiny.map(r => r.id).join(' ') || 'none, which is right');
  check('and the gate is three pixels, which is two lines and the gap between them',
    P.MIN_SPACING_PX === 3, `${P.MIN_SPACING_PX}px`);

  // ── THE SEVEN PICTURES, TOLD APART ────────────────────────────────────
  //
  // A STANDING SEAM HAS NO COURSES. It is one continuous sheet eave to ridge,
  // which is most of why it is specified -- a line across it is a joint the
  // roof does not have. This is also the check that separates it from the
  // metal panel, which is the same material in a different profile.
  const seam = draw('pfm_vertical');
  check('a standing seam runs up the slope and lays nothing across it',
    rakes(seam.segs).length > 0 && courses(seam.segs).length === 0,
    `${rakes(seam.segs).length} up, ${courses(seam.segs).length} across`);
  check('and every one of its seams runs the whole slope, eave to ridge',
    rakes(seam.segs).every(seg => Math.abs(
      Math.abs(inFrame(FLAT, seg.a).t - inFrame(FLAT, seg.b).t) - FLAT.high) < 1),
    `${rakes(seam.segs).length} seams of ${FLAT.high}px`);

  // CORRUGATED IS THE SAME PICTURE AT A QUARTER THE SPACING, which is the
  // pair's whole distinction: ribs you can count against seams you can
  // measure. Checked as a RATIO rather than a number, so the claim survives
  // somebody tuning either row.
  const rib = draw('corrugated');
  const spacing = segs => {
    const at = [...new Set(rakes(segs).map(seg => Math.round(inFrame(FLAT, seg.a).s)))]
      .sort((a, b) => a - b);
    const gaps = at.slice(1).map((v, i) => v - at[i]);
    return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  };
  check('corrugated ribs sit closer than standing seams, which is what tells them apart',
    spacing(rib.segs) > 0 && spacing(rib.segs) < spacing(seam.segs) * 0.75,
    `ribs every ${spacing(rib.segs).toFixed(0)}px against seams every `
    + `${spacing(seam.segs).toFixed(0)}px`);
  check('and corrugated lays nothing across either -- a panel has no courses',
    courses(rib.segs).length === 0, `${courses(rib.segs).length} across`);

  // ── THE PAIR THE TABLE KEEPS SEVEN PICTURES FOR ───────────────────────
  //
  // The pressed metal panel is a MODULE, installed in line. Slate is a small
  // unit in a BROKEN BOND. Drawn the same way a metal roof reads as slate at
  // four times the weight, which is the reading that matters to whoever sizes
  // the trusses. Measured as: do the joints of one course line up with the
  // joints of the next.
  //
  // MEASURED BY COURSE BAND AND NOT BY THE JOINT'S OWN ROW, which is the
  // instrument getting this wrong twice before it got it right. Binning a
  // joint by the row it ends in cannot see the metal panel at all -- its
  // joints run the WHOLE slope, so every one lands in the same bin and the
  // measure returns "fewer than two rows" on the very pattern the check is
  // about. A band asks the question the eye asks: standing at this course, are
  // the joints where they were at the last one.
  //
  // AND THE SOLID PASS ONLY. The relief shadow is the same pattern drawn
  // again, offset a couple of pixels down the slope -- so a shadow joint lands
  // in the neighbouring band at a position no real joint holds, and slate came
  // back 52% aligned when it is 0%. Measuring a drawing that draws itself
  // twice means saying which pass you mean.
  const solidOf = segs => segs.filter(seg => seg.alpha >= 0.4);
  const courseGap = segs => {
    const at = [...new Set(courses(segs).map(seg => Math.round(inFrame(FLAT, seg.a).t)))]
      .sort((a, b) => a - b);
    return at.length > 1 ? at[1] - at[0] : 0;
  };
  const alignedRuns = segs => {
    const solid = solidOf(segs);
    const step = courseGap(solid);
    if (!(step > 0)) return null;
    const bands = new Map();
    rakes(solid).forEach(seg => {
      const f = inFrame(FLAT, seg.a), g = inFrame(FLAT, seg.b);
      const lo = Math.min(f.t, g.t), hi = Math.max(f.t, g.t);
      const s = Math.round(f.s);
      for (let k = Math.floor(lo / step); k <= Math.floor((hi - 0.01) / step); k += 1) {
        if (!bands.has(k)) bands.set(k, new Set());
        bands.get(k).add(s);
      }
    });
    const rows = [...bands.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
    if (rows.length < 2) return null;
    let same = 0;
    for (let i = 1; i < rows.length; i += 1) {
      const shared = [...rows[i]].filter(s => rows[i - 1].has(s)).length;
      if (shared > rows[i].size * 0.6) same += 1;
    }
    return same / (rows.length - 1);
  };
  const panel = draw('metal_shingle');
  const slate = draw('slate');
  check('fixture: both the metal panel and the slate lay joints in more than one course',
    alignedRuns(panel.segs) !== null && alignedRuns(slate.segs) !== null,
    `${alignedRuns(panel.segs)} / ${alignedRuns(slate.segs)}`);
  check('a pressed metal panel lines its joints up course to course, being a module',
    alignedRuns(panel.segs) > 0.9, `${(alignedRuns(panel.segs) * 100).toFixed(0)}% aligned`);
  check('and slate breaks its bond, which is the whole of what tells the two apart',
    alignedRuns(slate.segs) < 0.1, `${(alignedRuns(slate.segs) * 100).toFixed(0)}% aligned`);

  // ── AND THE ASPHALT SHINGLE STAGGERS TOO ──────────────────────────────
  const tab = draw('asphalt');
  check('asphalt staggers its tabs half a tab each course, or it reads as a grid',
    alignedRuns(tab.segs) !== null && alignedRuns(tab.segs) < 0.1,
    `${((alignedRuns(tab.segs) ?? 1) * 100).toFixed(0)}% aligned`);
  // AND ITS SLIT IS SHORT, which is what it is on a roof: a cut through one
  // layer with the course below whole underneath. Run the full band it would
  // be the metal panel's grid again.
  const shortest = segs => Math.min(...rakes(solidOf(segs)).map(seg =>
    Math.abs(inFrame(FLAT, seg.a).t - inFrame(FLAT, seg.b).t)));
  check('and the slit is a cut through one layer, not a joint down the whole band',
    shortest(tab.segs) < courseGap(tab.segs) * 0.9,
    `${shortest(tab.segs).toFixed(1)}px into a ${courseGap(tab.segs)}px course`);

  // ── THE TILE'S ROLL IS NOT A RIB ──────────────────────────────────────
  //
  // A barrel tile reads as a row of half-cylinders, so what stands at every
  // cover width is a short mark off its own course. Run the full slope it is
  // corrugated steel -- a different material at a tenth the weight.
  const barrel = draw('terracotta');
  check('barrel tile draws courses, which corrugated metal does not',
    courses(barrel.segs).length > 0, `${courses(barrel.segs).length} courses`);
  check('and its rolls stand off a course rather than running the whole slope',
    rakes(barrel.segs).length > 0
      && rakes(barrel.segs).every(seg => Math.abs(
        inFrame(FLAT, seg.a).t - inFrame(FLAT, seg.b).t) < FLAT.high * 0.5),
    `${rakes(barrel.segs).length} rolls, longest `
    + `${Math.max(...rakes(barrel.segs).map(seg => Math.abs(
      inFrame(FLAT, seg.a).t - inFrame(FLAT, seg.b).t))).toFixed(0)}px of ${FLAT.high}`);

  // ── SHAKE WANDERS, AND THAT IS THE POINT ──────────────────────────────
  //
  // The defect the wall's shake pattern shipped with: a ruled grid reads as
  // panelling, and a joint run through the band closes the shakes into
  // rectangles. Measured as the SPREAD of the gaps -- a sawn unit has one gap,
  // a split one has many.
  const shake = draw('cedar_shake');
  const gapSpread = segs => {
    const at = rakes(segs).map(seg => inFrame(FLAT, seg.a).s).sort((a, b) => a - b);
    const gaps = at.slice(1).map((v, i) => v - at[i]).filter(g => g > 0.5);
    if (gaps.length < 4) return 0;
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
    return sd / mean;
  };
  check('a split shake lays joints at wandering widths, not on a ruled grid',
    gapSpread(shake.segs) > 0.15, `spread ${(gapSpread(shake.segs) * 100).toFixed(0)}%`);
  check('while the pressed panel it must not look like is dead regular',
    gapSpread(panel.segs) < 0.05, `spread ${(gapSpread(panel.segs) * 100).toFixed(0)}%`);
  // AND IT IS THE SAME ROOF TWICE. `Math.random()` would give the wandering
  // too, differently on every repaint -- a roof that shimmers as the window
  // resizes, and no two screenshots of one drawing agreeing.
  // AND ITS JOINT STOPS AT ITS OWN COURSE. This is the defect the WALL's shake
  // pattern shipped with -- a joint run through the band closes the shakes
  // into rectangles and the whole thing reads as coursed ashlar. The spread
  // check above cannot see it: joints running the full slope wander in `s`
  // exactly as much as short ones do. Measured and it survived.
  check('and a shake-s joint stops at its own course rather than running the slope',
    rakes(solidOf(shake.segs)).every(seg => Math.abs(
      inFrame(FLAT, seg.a).t - inFrame(FLAT, seg.b).t) < FLAT.high * 0.5),
    `longest joint ${Math.max(...rakes(solidOf(shake.segs)).map(seg => Math.abs(
      inFrame(FLAT, seg.a).t - inFrame(FLAT, seg.b).t))).toFixed(0)}px of ${FLAT.high}`);
  check('and the same roof drawn twice is the same roof, so nothing shimmers',
    JSON.stringify(draw('cedar_shake').segs) === JSON.stringify(shake.segs),
    `${shake.segs.length} segments, identical`);

  // ── RELIEF FOLLOWS THE SLOPE, NOT THE SCREEN ──────────────────────────
  //
  // A lapped butt throws its shadow BELOW its own course, and on a roof "below"
  // is down the slope -- which on a hip is nothing like down the screen. Asked
  // on a SLOPED frame, because on the flat one the two are the same answer and
  // the check would pass against the bug.
  const SLOPE = { ox: 0, oy: 400, ax: 0.8, ay: 0.6, ux: 0.6, uy: -0.8,
    wide: 500, high: 250, pxPerFt: PX };
  const lapped = draw('cedar_shake', SLOPE);
  const faint = lapped.segs.filter(seg => seg.alpha < 0.4);
  const solid = lapped.segs.filter(seg => seg.alpha >= 0.4);
  check('fixture: a lapped roof draws a faint pass and a solid one',
    faint.length > 0 && solid.length > 0, `${faint.length} faint, ${solid.length} solid`);
  check('and the shadow sits DOWN THE SLOPE of the line it belongs to',
    (() => {
      const lowest = list => Math.min(...list.map(seg => inFrame(SLOPE, seg.a).t));
      return lowest(faint) < lowest(solid) - 0.2;
    })(),
    `faint from ${Math.min(...faint.map(s => inFrame(SLOPE, s.a).t)).toFixed(2)}, `
    + `solid from ${Math.min(...solid.map(s => inFrame(SLOPE, s.a).t)).toFixed(2)}`);
  // AND IT IS DIRECTLY BELOW, not off to one side. A translate down the SCREEN
  // happens to land lower on the slope too, so the check above passes against
  // it -- measured, it survived. What a screen-axis offset also does is shift
  // the shadow ALONG the eave, which no shadow of a horizontal course does.
  check('and directly below it, not shifted along the eave',
    (() => {
      const start = list => Math.min(...list.map(seg => inFrame(SLOPE, seg.a).s));
      return Math.abs(start(faint) - start(solid)) < 0.2;
    })(),
    `faint from s=${Math.min(...faint.map(x => inFrame(SLOPE, x.a).s)).toFixed(2)}, `
    + `solid from s=${Math.min(...solid.map(x => inFrame(SLOPE, x.a).s)).toFixed(2)}`);
  check('and a roof that lies flat takes no shadow at all',
    draw('asphalt').segs.every(seg => seg.alpha >= 0.4),
    `asphalt alphas ${[...new Set(draw('asphalt').segs.map(s => s.alpha))].join(' ')}`);

  // ── THE PATTERN IS DRAWN IN THE ROOF'S AXES, NOT THE SCREEN'S ─────────
  //
  // The claim that makes this file's frame worth having: a hatch on a sloped
  // roof runs parallel to its EAVE. Drawn in screen axes it would run level
  // and cross the roof's own edges, which is the defect a gable seen from the
  // side shows first.
  const sloped = draw('slate', SLOPE);
  check('on a sloped roof the courses still run parallel to the eave',
    courses(sloped.segs, SLOPE).length > 0,
    `${courses(sloped.segs, SLOPE).length} courses in the roof-s own axes`);
  check('and not one of them is level on the screen, which they would be if drawn flat',
    courses(sloped.segs, SLOPE).every(seg => Math.abs(seg.a.y - seg.b.y) > 1),
    'every course follows the slope');

  // ── THE FRAME IS READ OFF THE FACE ────────────────────────────────────
  const POLY = [{ x: 0, y: 400 }, { x: 400, y: 400 }, { x: 200, y: 200 }];
  const gable = P.frameFor(POLY, POLY[0], POLY[1], PX);
  check('a face and its eave give a frame that spans the eave',
    gable && Math.abs(gable.wide - 400) < 0.5, gable ? `${gable.wide.toFixed(0)}px` : 'nothing');
  check('and one that reaches the ridge',
    gable && Math.abs(gable.high - 200) < 0.5, gable ? `${gable.high.toFixed(0)}px` : 'nothing');
  // UP POINTS AT THE ROOF, whichever way the eave was handed over. Both
  // perpendiculars are perpendicular; only one has the face on it, and a roof
  // drawn from the other side would otherwise hatch into thin air.
  const flipped = P.frameFor(POLY, POLY[1], POLY[0], PX);
  check('up points into the face however the eave is handed over',
    gable && flipped && gable.uy < 0 && flipped.uy < 0,
    `${gable?.uy.toFixed(2)} / ${flipped?.uy.toFixed(2)}`);
  // ── AND THE TWO REFUSALS ARE TWO REFUSALS ────────────────────────────
  //
  // GUARDED TWICE IS GUARDED ONCE, which is how both of these survived first
  // time: an eave of zero length makes the axis NaN, so the HEIGHT guard
  // refuses it and the WIDTH guard looks redundant -- and a face with no
  // height has a fine eave, so the width guard refuses nothing and the height
  // guard looks redundant. Each needs the case only it can answer.
  check('an eave of no length gives no frame rather than a division by zero',
    P.frameFor(POLY, POLY[0], POLY[0], PX) === null, 'null');
  // A SUB-PIXEL EAVE has a perfectly good unit vector, so only the width guard
  // stops it -- and a hatch across half a pixel of paper is a smudge.
  const SLIVER = [{ x: 0, y: 400 }, { x: 0.2, y: 400 }, { x: 0.1, y: 200 }];
  check('and neither does an eave too short to draw across',
    P.frameFor(SLIVER, SLIVER[0], SLIVER[1], PX) === null, 'null');
  // A FACE FLAT ON ITS OWN EAVE has a fine eave and no height at all -- a roof
  // seen exactly edge on. Only the height guard answers this one.
  const EDGE = [{ x: 0, y: 400 }, { x: 400, y: 400 }, { x: 200, y: 400 }];
  check('and neither does a face seen so edge on it has no slope to hatch',
    P.frameFor(EDGE, EDGE[0], EDGE[1], PX) === null, 'null');

  return missed;
}

const baseline = run(load(null));
if (!MUTATION_MODE) {
  console.log(`\nroof pattern harness: ${baseline.length ? `${baseline.length} FAILED` : 'all checks passed'}`);
  if (baseline.length) {
    baseline.forEach(m => console.log(`  ✘ ${m.label}${m.detail ? `   ${m.detail}` : ''}`));
    process.exit(1);
  }
  process.exit(0);
}

const sub = (src, file, find, replace) => {
  const hits = src[file].split(find).length - 1;
  if (hits !== 1) throw new Error(`anchor hit ${hits} times in ${file}`);
  return { ...src, [file]: src[file].replace(find, replace) };
};
const F = 'roof-patterns.js';

const MUTATIONS = [
  ['the scale gate is dropped, so a thumbnail draws a grey wash over its roofs',
    s => sub(s, F, '  const MIN_SPACING_PX = 3;', '  const MIN_SPACING_PX = 0;')],
  ['the gate opens wide, so no roof is ever hatched',
    s => sub(s, F, '  const MIN_SPACING_PX = 3;', '  const MIN_SPACING_PX = 400;')],
  ['an unknown pattern draws a default instead of declining',
    s => sub(s, F, '    if (!pattern) return false;', '    if (!pattern) return true;')],

  ['a standing seam grows courses, so it is drawn as a metal panel',
    s => sub(s, F, "      for (let s = pan; s < frame.wide; s += pan) rake(ctx, frame, s);",
      '      for (let s = pan; s < frame.wide; s += pan) rake(ctx, frame, s);\n'
      + '      for (let t = pan; t < frame.high; t += pan) course(ctx, frame, t);')],
  ['a standing seam stops short of the ridge, so the sheet is drawn with a joint',
    s => sub(s, F, "      for (let s = pan; s < frame.wide; s += pan) rake(ctx, frame, s);",
      '      for (let s = pan; s < frame.wide; s += pan) rake(ctx, frame, s, 0, frame.high / 2);')],
  ['corrugated is drawn at the seam spacing, so the two metals become one',
    s => sub(s, F, "      const step = upFt(frame, paramOf(roofing, 'ribIn', 9));",
      "      const step = upFt(frame, paramOf(roofing, 'panIn', 16));")],
  ['corrugated grows courses, which an exposed-fastener panel does not have',
    s => sub(s, F, "      for (let s = step; s < frame.wide; s += step) rake(ctx, frame, s);\n      ctx.stroke();\n    },\n\n    // PRESSED METAL SHINGLE",
      '      for (let s = step; s < frame.wide; s += step) rake(ctx, frame, s);\n'
      + '      for (let t = step; t < frame.high; t += step) course(ctx, frame, t);\n'
      + '      ctx.stroke();\n    },\n\n    // PRESSED METAL SHINGLE')],

  ['slate is laid in line, so it is drawn as a pressed metal panel',
    s => sub(s, F, '        const shift = (row % 2) * wide / 2;\n'
      + '        for (let s = shift; s < frame.wide; s += wide) {\n'
      + '          if (s <= 0) continue;',
      '        const shift = 0;\n'
      + '        for (let s = shift; s < frame.wide; s += wide) {\n'
      + '          if (s <= 0) continue;')],
  ['the metal panel breaks its bond, so a module is drawn as a small unit',
    s => sub(s, F, '        for (let s = wide; s < frame.wide; s += wide) rake(ctx, frame, s);',
      '        for (let s = wide / 2; s < frame.wide; s += wide) rake(ctx, frame, s);\n'
      + '        for (let s = wide; s < frame.wide; s += wide * 2) rake(ctx, frame, s, 0, frame.high / 2);')],
  ['asphalt stops staggering, so a shingle roof reads as a grid',
    s => sub(s, F, '        const shift = (row % 2) * tab / 2;', '        const shift = 0;')],
  ['the asphalt slit runs the whole course, so the tabs close into rectangles',
    s => sub(s, F, '          rake(ctx, frame, s, t - step * 0.55, t);',
      '          rake(ctx, frame, s, t - step, t);')],

  ['the tile-s roll runs the whole slope, so terracotta is drawn as corrugated steel',
    s => sub(s, F, '          rake(ctx, frame, s, t - step * 0.45, t);',
      '          rake(ctx, frame, s);')],
  ['the tile loses its courses, so a pan tile roof has no rows',
    s => sub(s, F, '      for (let t = step; t < frame.high; t += step) {\n'
      + '        course(ctx, frame, t);\n'
      + "        if (cover < MIN_SPACING_PX) continue;",
      '      for (let t = step; t < frame.high; t += step) {\n'
      + "        if (cover < MIN_SPACING_PX) continue;")],

  ['the shake stops wandering, so a split shake is drawn as a sawn one',
    s => sub(s, F, '          s += nominal * (0.55 + jitter(row, i) * 0.9);',
      '          s += nominal;')],
  ['the shake-s wander is random, so the roof shimmers on every repaint',
    s => sub(s, F, '  const jitter = (a, b) => {\n'
      + '    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;\n'
      + '    return n - Math.floor(n);\n  };',
      '  const jitter = () => Math.random();')],
  ['the shake-s joint runs past its own course, closing the shakes into rectangles',
    s => sub(s, F, '          rake(ctx, frame, s, t - step, t);\n        }\n      }\n      ctx.stroke();\n    },\n\n    // BARREL TILE',
      '          rake(ctx, frame, s, 0, frame.high);\n        }\n      }\n      ctx.stroke();\n    },\n\n    // BARREL TILE')],

  ['the relief pass is dropped, so a lapped butt throws no shadow',
    s => sub(s, F, '    if (roofing.relief) {', '    if (false) {')],
  ['every roof takes a shadow, so asphalt is drawn as a lapped material',
    s => sub(s, F, '    if (roofing.relief) {', '    if (true) {')],
  ['the shadow is offset down the SCREEN, so on a hip it falls sideways',
    s => sub(s, F, '      ctx.translate(-frame.ux * off, -frame.uy * off);',
      '      ctx.translate(0, off);')],
  ['the shadow is offset UP the slope, so the light comes from below',
    s => sub(s, F, '      ctx.translate(-frame.ux * off, -frame.uy * off);',
      '      ctx.translate(frame.ux * off, frame.uy * off);')],

  ['the pattern is drawn in screen axes, so a sloped roof is hatched level',
    s => sub(s, F, '  const at = (frame, s, t) => ({\n'
      + '    x: frame.ox + frame.ax * s + frame.ux * t,\n'
      + '    y: frame.oy + frame.ay * s + frame.uy * t,\n  });',
      '  const at = (frame, s, t) => ({ x: frame.ox + s, y: frame.oy - t });')],
  ['the frame-s up axis is assumed rather than read off the face',
    s => sub(s, F, '    if (far < 0) { ux = -ux; uy = -uy; }', '')],
  ['an eave of no length gives a frame anyway, dividing by zero',
    s => sub(s, F, '    if (!(wide > 0.5)) return null;', '')],
  ['the frame stops at the eave, so a roof with no height hatches anyway',
    s => sub(s, F, '    if (!(high > 0.5)) return null;', '')],
];

console.log('\n' + 'mutation'.padEnd(78) + 'caught by');
let survivors = 0, broken = 0;
for (const [label, mutate] of MUTATIONS) {
  let by;
  try {
    const m = run(load(mutate));
    if (!m.length) survivors += 1;
    by = m.length ? m.map(x => x.label).join('\n' + ' '.repeat(78)) : '*** NOTHING ***';
  } catch (err) {
    broken += 1;
    by = `!!! MUTATION DID NOT APPLY: ${err.message}`;
  }
  console.log(`${label.padEnd(78)}${by}`);
}
console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);
if (!MUTATIONS.length) console.log('NO MUTATIONS DEFINED -- this table proves nothing');
process.exit(baseline.length || survivors || broken || !MUTATIONS.length ? 1 : 0);
