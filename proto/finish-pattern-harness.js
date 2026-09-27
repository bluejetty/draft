// THE FINISHES, DRAWN -- what each hatch actually puts on the sheet.
//
//   node proto/finish-pattern-harness.js
//   node proto/finish-pattern-harness.js --mutate   break it, prove each break is caught
//
// A HATCH IS A CLAIM ABOUT A MATERIAL, and the claim is only kept if the mark
// is right. Two of these patterns were wrong the first time they were drawn
// and both were caught by LOOKING at a swatch sheet rather than by any check:
// cedar shake closed into rectangles and read as coursed ashlar, and
// ledgestone's joints lined up into diagonal streaks across the wall. Neither
// was a crash, neither failed anything, and both were plainly wrong on sight.
// So the checks below are the ones that would have said so -- measured on the
// geometry, because "it looks like stone" is not a thing a harness can ask.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const MUTATION_MODE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'finish-patterns.js');
const TABLE = path.join(ROOT, 'wall-types.js');

// ── A CONTEXT THAT REMEMBERS, AND HONOURS translate ───────────────────────
// proto/harness-env.js's recorder treats translate() as a no-op, which is
// right for the elevation painter and wrong here: the relief shadow IS a
// translate, so a recorder that drops it cannot see the one thing the relief
// pass does. It also needs arc(), because roundstone is drawn in circles.
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
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const win = {};
  const sandbox = { window: win, console, Math, Number, String, Object, Array, JSON };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(TABLE, 'utf8'), sandbox, { filename: 'wall-types.js' });
  vm.runInContext(src, sandbox, { filename: 'finish-patterns.js' });
  return win;
}

// A swatch big enough to show a pattern: 14 ft by 8 ft at 26 px/ft, which is
// about what one storey of one wall gets on a full-screen elevation.
const PX_PER_FT = 26;
const BOX = Object.freeze({ x0: 100, x1: 100 + 14 * PX_PER_FT,
  yTop: 50, yBottom: 50 + 8 * PX_PER_FT, pxPerFt: PX_PER_FT });

function run(win) {
  const missed = [];
  const check = (label, ok, detail) => {
    if (!ok) missed.push({ label, detail });
    if (!MUTATION_MODE) console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? `   ${detail}` : ''}`);
    return ok;
  };
  const FP = win.DraftFinishPatterns;
  const T = win.DraftWallTypes;
  if (!FP?.drawFinish || !T?.EXTERIOR_FINISHES) {
    missed.push({ label: 'the module loads and exports drawFinish', detail: `${!!FP} ${!!T}` });
    return missed;
  }
  const F = T.EXTERIOR_FINISHES;
  const draw = (finish, box = BOX) => {
    const { ctx, strokes } = recorder();
    FP.drawFinish(ctx, box, finish, { line: '#000' });
    return strokes;
  };
  const segments = strokes => strokes.flatMap(s => s.pts.slice(1)
    .map((pt, i) => ({ a: s.pts[i], b: pt, alpha: s.alpha }))
    .filter(seg => !seg.b.move && !seg.b.arc));
  const by = id => F.find(f => f.id === id);

  // ── THE FIXTURE'S OWN REACH ───────────────────────────────────────────
  check('fixture: every finish in the table has a pattern to draw',
    F.every(f => typeof FP.PATTERNS[f.pattern] === 'function'),
    F.map(f => `${f.id}:${typeof FP.PATTERNS[f.pattern]}`).filter(s => !s.endsWith('function')).join(' ') || 'all 9');

  // ── STUCCO IS THE QUIET GROUND ────────────────────────────────────────
  check('stucco puts nothing on the sheet at all',
    draw(by('stucco')).length === 0, `${draw(by('stucco')).length} strokes`);
  const drawn = F.filter(f => f.id !== 'stucco').map(f => [f.id, draw(f).length]);
  check('and every other finish draws something at a working scale',
    drawn.every(([, n]) => n > 0), drawn.map(([id, n]) => `${id}:${n}`).join(' '));

  // ── THE SCALE GATE ────────────────────────────────────────────────────
  // A rail seat is 82 px wide. A 4" exposure there is a fifth of a pixel, and
  // drawn anyway the hatch is a grey wash that hides the wall's own outline
  // and says a material is present without saying which.
  const TINY = { x0: 0, x1: 82, yTop: 0, yBottom: 60, pxPerFt: 2 };
  const tiny = F.map(f => [f.id, segments(draw(f, TINY)).length]);
  check('below the gate a thumbnail keeps its plain fill, every material',
    tiny.every(([, n]) => n === 0), tiny.map(([id, n]) => `${id}:${n}`).join(' '));
  check('and the gate is a spacing in PIXELS, so it holds at any scale',
    Number.isFinite(FP.MIN_SPACING_PX) && FP.MIN_SPACING_PX >= 2,
    `${FP.MIN_SPACING_PX} px`);

  // ── THE SAME WALL, TWICE ──────────────────────────────────────────────
  // Fieldstone and roundstone want irregularity, and Math.random() would give
  // it to them differently on every repaint -- a wall shimmering as the window
  // resizes, and no two screenshots of one drawing agreeing.
  const twice = F.map(f => [f.id,
    JSON.stringify(draw(f)) === JSON.stringify(draw(f))]);
  check('a finish drawn twice lands in exactly the same places',
    twice.every(([, same]) => same),
    twice.filter(([, same]) => !same).map(([id]) => id).join(' ') || 'all 9 identical');

  // ── NOTHING OUTSIDE THE BOX ───────────────────────────────────────────
  // The caller clips, so a stray line is invisible rather than wrong -- but it
  // is still ink being computed for every face on the sheet, and a pattern
  // that runs away is one that has lost track of its own bounds.
  //
  // ONE FOOT OF SLACK, not none. A fieldstone laid at the edge of its band
  // hangs over it, and that is the material behaving correctly -- rubble does
  // not stop at a tidy line, and the clip is what cuts it. What this catches
  // is the other thing: a loop whose bound is wrong and walks off the wall.
  // ONE OF THE PATTERN'S OWN UNITS, which is what "straddling its edge" means
  // for a material whose unit is a foot across. Fieldstone is a LATTICE: it
  // has to lay a cell outside the box on each side or the stones at the wall's
  // end are half-stones cut to a ruled line, which is the one thing rubble
  // never looks like. A flat foot of slack said that was a runaway.
  const unitOf = finish => Math.max(6, ...(finish.params || []).map(p => p.in))
    / 12 * BOX.pxPerFt * 1.5;   // a cell outside, plus half its own jitter
  const stray = F.flatMap(f => {
    const slack = unitOf(f);
    return segments(draw(f)).flatMap(seg => [seg.a, seg.b])
      .filter(pt => pt.x < BOX.x0 - slack || pt.x > BOX.x1 + slack
        || pt.y < BOX.yTop - slack || pt.y > BOX.yBottom + slack)
      .map(() => f.id);
  });
  check('no pattern draws outside the box it was given',
    stray.length === 0, [...new Set(stray)].join(' ') || 'none');

  // ── WHICH WAY IT RUNS ─────────────────────────────────────────────────
  const vertical = seg => Math.abs(seg.b.y - seg.a.y) > Math.abs(seg.b.x - seg.a.x);
  // THE LONGEST RUN, not "every run over two feet". That threshold outgrew
  // the stones the day ashlar's blocks were narrowed to five inches: it
  // matched nothing, and a filter that matches nothing passes whatever the
  // code does. What is true of every coursed material at any size is that its
  // LONGEST line is the course.
  const longRun = (id, wantVertical) => {
    const segs = segments(draw(by(id)));
    if (!segs.length) return false;
    const longest = segs.reduce((best, s) =>
      (Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y)
        > Math.hypot(best.b.x - best.a.x, best.b.y - best.a.y) ? s : best));
    return vertical(longest) === wantVertical;
  };
  // BOTH OF THESE USED TO ASSERT THE OPPOSITE, on Movie's 26 Sep word for
  // them, and he caught it himself on the 27th: *"i got them mixed up 90
  // degrees"*. Board and batten is boards STANDING UP with a batten over each
  // joint; lap siding is what runs across.
  check('V. Siding (B&B) stands its boards UP, battens and all',
    longRun('siding_v_bb', true), 'every run over 2 ft is vertical');
  check('and H. Siding laps ACROSS, which is what lap siding is',
    longRun('siding_h', false), 'every run over 2 ft is horizontal');
  // AND THE PAIRING IS WHAT TELLS THEM APART, not merely the direction: a
  // batten sits a couple of inches off its board, so B&B draws close PAIRS at
  // a wide interval where lap siding draws evenly spaced singles.
  check('and B&B draws its lines in PAIRS, where lap siding draws singles',
    (() => {
      const xs = [...new Set(segments(draw(by('siding_v_bb'))).filter(vertical)
        .map(s => Math.round(s.a.x * 100) / 100))].sort((a, b) => a - b);
      const gaps = xs.slice(1).map((x, i) => x - xs[i]);
      const tight = 2 / 12 * PX_PER_FT;
      return gaps.length > 4 && gaps.some(g => Math.abs(g - tight) < 0.4)
        && gaps.some(g => g > tight * 3);
    })(), 'a 2" batten gap alternating with a 12" board');
  check('and so do the coursed ones -- a course is a horizontal by definition',
    ['shake', 'ledgestone', 'ashlar', 'brick'].every(id => longRun(id, false)),
    'shake ledgestone ashlar brick');

  // ── THE SPACING IS THE PARAMETER, NOT A CONSTANT ──────────────────────
  // The whole reason the table stores a number per row: Movie's 6" and 8"
  // vertical are this row with one field edited. A pattern that ignored its
  // own parameter would make that promise false and nothing else would say so.
  const withParam = (id, key, value) => {
    const f = by(id);
    return { ...f, params: f.params.map(p => (p.key === key ? { ...p, in: value } : p)) };
  };
  const at4 = segments(draw(withParam('siding_h', 'exposureIn', 4))).length;
  const at8 = segments(draw(withParam('siding_h', 'exposureIn', 8))).length;
  check('doubling H. Siding-s exposure halves the courses on the wall',
    at4 > 0 && Math.abs(at8 * 2 - at4) <= 2, `4": ${at4}   8": ${at8}`);
  const brick4 = segments(draw(withParam('brick', 'brickHighIn', 2.25))).length;
  const brick8 = segments(draw(withParam('brick', 'brickHighIn', 8))).length;
  check('and a taller brick puts fewer courses on the same wall',
    brick8 < brick4, `2 1/4": ${brick4}   8": ${brick8}`);
  // COURSING IS THE UNIT PLUS ITS JOINT -- the arithmetic the table exists to
  // keep honest, measured on the drawing rather than believed.
  const courseLines = finish => {
    const ys = segments(draw(finish)).filter(s => !vertical(s) && s.alpha > 0.5)
      .map(s => Math.round(s.a.y * 100) / 100);
    return [...new Set(ys)].sort((a, b) => a - b);
  };
  const courses = courseLines(by('brick'));
  const gaps = courses.slice(1).map((y, i) => y - courses[i]);
  const wantGap = (2.25 + 0.375) / 12 * PX_PER_FT;
  check('brick courses sit at the unit PLUS the joint, not at the nominal',
    gaps.length > 2 && gaps.every(g => Math.abs(g - wantGap) < 0.35),
    `${gaps[0]?.toFixed(2)} px, want ${wantGap.toFixed(2)} (2 1/4 + 3/8 at ${PX_PER_FT} px/ft)`);

  // ── A SHAKE IS LAPPED, SO ITS JOINTS ARE STUBS ────────────────────────
  // THE BUG THIS EXISTS FOR. Drawn the full course height the joints close
  // into rectangles and cedar shake reads as coursed ashlar -- which is what
  // the first version did, on a swatch sheet, plainly.
  const shakeStep = 7 / 12 * PX_PER_FT;
  const shakeJoints = segments(draw(by('shake'))).filter(vertical);
  const longestJoint = Math.max(...shakeJoints.map(s => Math.abs(s.b.y - s.a.y)));
  check('a shake-s butt joints are STUBS, not the full course -- or it reads as ashlar',
    shakeJoints.length > 4 && longestJoint < shakeStep * 0.85,
    `longest ${longestJoint.toFixed(1)} px of a ${shakeStep.toFixed(1)} px course`);
  check('and ashlar-s DO run the full course, which is what makes them blocks',
    (() => {
      const high = 8 / 12 * PX_PER_FT;
      const v = segments(draw(by('ashlar'))).filter(vertical);
      return v.length > 4 && Math.max(...v.map(s => Math.abs(s.b.y - s.a.y))) > high * 0.9;
    })(), 'so the two cannot be drawn the same way');

  // ── STACKED STONE IS SORTED, NOT MILLED ───────────────────────────────
  // THE OTHER BUG. Exactly ruled courses with joints hashed per ROW line up
  // into diagonal streaks -- the eye joins near-regular marks faster than it
  // reads the courses they sit in.
  const stackGaps = (() => {
    const ys = courseLines(by('ledgestone'));
    return ys.slice(1).map((y, i) => y - ys[i]).filter(g => g > 0.5);
  })();
  const distinct = new Set(stackGaps.map(g => Math.round(g * 2) / 2));
  check('ledgestone courses are NOT all one height -- ruled, it reads as tile',
    stackGaps.length > 4 && distinct.size > 2,
    `${distinct.size} distinct course heights over ${stackGaps.length} courses`);
  // AND THE PIECES RUN LONG, which is the other half of why it streaked. Thin
  // stone is SORTED thin and laid LONG -- a piece several times its own course
  // height. Broken every three and a half courses, as the first version did,
  // the joints come thick enough for the eye to join them across the wall
  // faster than it reads the courses they sit in, and the whole band goes
  // diagonal. Measured as the run between joints, which is the thing that was
  // actually wrong: the streak is what a too-short stone LOOKS like.
  const jointRuns = finish => {
    const v = segments(draw(finish)).filter(vertical).filter(s => s.alpha > 0.5);
    const byCourse = new Map();
    v.forEach(s => {
      const key = Math.round(Math.max(s.a.y, s.b.y) * 4) / 4;
      byCourse.set(key, (byCourse.get(key) || []).concat(s.a.x));
    });
    return [...byCourse.values()].filter(xs => xs.length > 2).flatMap(xs => {
      const sorted = xs.slice().sort((p, q) => p - q);
      return sorted.slice(1).map((x, i) => x - sorted[i]);
    }).filter(g => g > 0.5).sort((p, q) => p - q);
  };
  const runs = jointRuns(by('ledgestone'));
  const median = runs.length ? runs[Math.floor(runs.length / 2)] : 0;
  const courseHigh = 3 / 12 * PX_PER_FT;
  check('and a ledgestone piece runs LONG -- five times its course at the least',
    runs.length > 8 && median > courseHigh * 5,
    `median run ${median.toFixed(1)} px against a ${courseHigh.toFixed(1)} px course`
    + `  (${(median / courseHigh).toFixed(1)}x)`);
  check('and ashlar-s do NOT, because a squared block is twice its height, not nine times',
    (() => {
      const a2 = jointRuns(by('ashlar'));
      const m = a2.length ? a2[Math.floor(a2.length / 2)] : 0;
      return a2.length > 8 && m < (8 / 12 * PX_PER_FT) * 4;
    })(), 'so the two cannot be drawn to the same proportion');
  // AND SO DO ASHLAR'S, which is the correction Movie's own reference photo
  // forced (assets/textures/Ashlar.png, 27 Sep). This check used to assert the
  // opposite -- "one gap, repeated" -- and the pattern obliged with a uniform
  // running bond. That is a BRICK wall drawn at stone size. What the
  // photograph shows is RANDOM COURSED: a big block beside two small ones,
  // squared and fitted to courses of several different heights.
  //
  // SO WHAT SEPARATES THE TWO IS NOT REGULARITY, IT IS PROPORTION -- the pair
  // of run-length checks above, which is where the distinction now lives:
  // ledgestone laid long and thin, ashlar blocky.
  check('and ashlar-s courses vary too -- one repeated unit is brick at stone size',
    (() => {
      const ys = courseLines(by('ashlar'));
      const g = ys.slice(1).map((y, i) => y - ys[i]).filter(v => v > 0.5);
      return g.length > 3 && new Set(g.map(v => Math.round(v * 2) / 2)).size > 2;
    })(), 'more than two distinct course heights');

  // ── AND FIELDSTONE SHOWS ITS MORTAR ──────────────────────────────────
  //
  // THIS CHECK USED TO ASSERT THE OPPOSITE. Fieldstone was drawn as a
  // displaced lattice -- crazy paving, every corner shared -- and this said
  // so, proudly: 159 of 186 corners carrying three edges. Movie asked for the
  // joints back: *"make the FIELDSTONE look more like the ROUNDSTONE but with
  // more abnormally shaped not as rounded"*, *"(showing the mortar joints
  // like in roundstone)"*. A wall with every corner shared has no mortar in
  // it at all, which is what a lattice means and what he could see.
  //
  // SO THE MEASURE IS THE SAME AND THE ANSWER IS INVERTED: discrete stones,
  // nested but not joined, each carrying only the two edges its own outline
  // gives it.
  const cornerLoad = id => {
    const at = new Map();
    segments(draw(by(id))).filter(seg => seg.alpha > 0.5)
      .forEach(seg => [seg.a, seg.b].forEach(pt => {
        const k = `${Math.round(pt.x * 20)},${Math.round(pt.y * 20)}`;
        at.set(k, (at.get(k) || 0) + 1);
      }));
    return [...at.values()];
  };
  const fieldCorners = cornerLoad('fieldstone');
  const joined = fieldCorners.filter(n => n >= 3).length;
  check('fieldstone shows its mortar -- its stones do NOT share their corners',
    fieldCorners.length > 20 && joined < fieldCorners.length * 0.1,
    `${joined} of ${fieldCorners.length} corners carry three edges or more`);
  // AND A FIELDSTONE IS BROKEN, NOT WORN, which is the only thing separating
  // it from the cobbles now that both are laid the same way: a river stone is
  // rubbed smooth and takes eight sides, a broken one takes five or six and
  // its edges are straight runs meeting at corners.
  const sidesOf = id => {
    const strokes = draw(by(id)).filter(st => st.alpha > 0.5);
    const runs = [];
    strokes.forEach(st => {
      let n = 0;
      st.pts.forEach(pt => {
        if (pt.move) { if (n > 2) runs.push(n); n = 1; } else n += 1;
      });
      if (n > 2) runs.push(n);
    });
    return runs;
  };
  const fieldSides = sidesOf('fieldstone');
  const roundSides = sidesOf('roundstone');
  const midOf = list => (list.length
    ? list.slice().sort((a, b) => a - b)[Math.floor(list.length / 2)] : 0);
  check('and a fieldstone is BROKEN, not worn -- fewer sides than a cobble',
    fieldSides.length > 10 && roundSides.length > 10
      && midOf(fieldSides) < midOf(roundSides),
    `${midOf(fieldSides)} sides against the cobble-s ${midOf(roundSides)}`);

  // AND NO TWO SIDES OF ONE STONE ARE THE SAME LENGTH, which is what "odd
  // shapes" means and the only part of it a side-count cannot say: five equal
  // sides is a PENTAGON, drawn over and over, and it reads as a tiled motif
  // rather than as rubble. The measure is the spread within one outline.
  const sideSpread = id => {
    const out = [];
    draw(by(id)).filter(st => st.alpha > 0.5).forEach(st => {
      let run = [];
      const close = () => {
        if (run.length > 2) {
          const lens = run.slice(1).map((pt, i) =>
            Math.hypot(pt.x - run[i].x, pt.y - run[i].y)).filter(n => n > 0.2);
          if (lens.length > 2) out.push(Math.max(...lens) / Math.min(...lens));
        }
        run = [];
      };
      st.pts.forEach(pt => { if (pt.move) { close(); run = [pt]; } else run.push(pt); });
      close();
    });
    return out;
  };
  // THE NUMBER IS MEASURED, NOT GUESSED. As drawn the median stone's longest
  // side is 1.64 times its shortest; made regular -- every vertex at its full
  // radius -- it falls to 1.21, which is what an ellipse's own squash leaves
  // behind. 1.4 sits between them with room on both sides. The first draft of
  // this check asked for 1.8 and was simply wrong about its own drawing.
  const spread = sideSpread('fieldstone');
  check('and no two sides of one fieldstone are the same length',
    spread.length > 10 && midOf(spread) > 1.4,
    `longest side over shortest, median ${midOf(spread).toFixed(2)} across `
    + `${spread.length} stones`);

  // ── RELIEF: THE STONE STANDS PROUD OF ITS JOINT ───────────────────────
  // Movie: "can we give these texture where the stone stuck out past the
  // mortor". Outlined flat, the same pattern reads as a tile floor stood on
  // end. Measured as the two passes it is drawn in.
  const reliefPasses = id => {
    const s = draw(by(id));
    const alphas = [...new Set(s.map(x => Math.round(x.alpha * 100) / 100))];
    return { strokes: s, alphas };
  };
  check('a relief finish draws TWO passes -- the shadow, then the unit on it',
    reliefPasses('brick').alphas.length === 2,
    reliefPasses('brick').alphas.join(' / '));
  check('and a flat one draws a single pass, having no depth to throw a shadow',
    reliefPasses('siding_h').alphas.length === 1,
    reliefPasses('siding_h').alphas.join(' / '));
  check('the shadow is the FAINTER of the two, or it is not a shadow',
    (() => { const a = reliefPasses('brick').alphas; return Math.min(...a) < Math.max(...a); })(),
    reliefPasses('brick').alphas.join(' / '));
  check('and it is drawn FIRST, so the unit-s own line lands on top of it',
    (() => {
      const s = reliefPasses('brick').strokes;
      const faint = Math.min(...s.map(x => x.alpha));
      return s[0].alpha === faint && s[s.length - 1].alpha !== faint;
    })(), 'shadow, then unit');
  // LIGHT FROM THE UPPER LEFT, which is the convention every set uses, written
  // once so the four stones and the brick cannot each answer it differently.
  const shadowOffset = id => {
    const s = draw(by(id));
    const faint = Math.min(...s.map(x => x.alpha));
    const dark = s.filter(x => x.alpha === faint).flatMap(x => x.pts);
    const lit = s.filter(x => x.alpha !== faint).flatMap(x => x.pts);
    if (!dark.length || !lit.length) return null;
    return { dx: dark[0].x - lit[0].x, dy: dark[0].y - lit[0].y };
  };
  const off = shadowOffset('brick');
  check('the shadow falls DOWN and RIGHT -- light from the upper left',
    off && off.dx > 0 && off.dy > 0, off ? `dx ${off.dx.toFixed(2)}  dy ${off.dy.toFixed(2)}` : 'none');
  check('and every masonry finish throws it the same way, all five',
    T.MASONRY_FINISH_IDS.every(id => {
      const o = shadowOffset(id);
      return o && o.dx > 0 && o.dy > 0;
    }), T.MASONRY_FINISH_IDS.join(' '));
  // THE OFFSET IS THE JOINT, because the shadow's width is what the stone
  // stands proud OF: a 2" stone in a 1" joint throws a wider one than brick in
  // three eighths, and that difference is most of what tells them apart.
  check('a wider joint throws a wider shadow, which is what tells stone from brick',
    FP.reliefOffsetPx(by('ledgestone'), PX_PER_FT)
      > FP.reliefOffsetPx(by('brick'), PX_PER_FT),
    `ledgestone ${FP.reliefOffsetPx(by('ledgestone'), PX_PER_FT).toFixed(2)}`
    + `  brick ${FP.reliefOffsetPx(by('brick'), PX_PER_FT).toFixed(2)}`);

  return missed;
}

const sub = (src, find, repl) => {
  const hits = src.split(find).length - 1;
  if (hits !== 1) {
    throw new Error(`AMBIGUOUS ANCHOR: matches ${hits}x -- ${
      find.replace(/\n/g, ' ').slice(0, 64)}`);
  }
  return src.replace(find, repl);
};

const MUTATIONS = [
  ['stucco grows a hatch, so the ground the others read against is patterned too',
    s => sub(s, '    none: () => {},', "    none: (ctx, box, finish) => PATTERNS.lines(ctx, box, finish),")],
  ['the scale gate opens, so a rail thumbnail fills with a grey wash',
    s => sub(s, '  const MIN_SPACING_PX = 3;', '  const MIN_SPACING_PX = 0;')],
  ['the jitter goes random, so a wall shimmers as the window resizes',
    s => sub(s, '    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;',
      '    const n = Math.random() * 43758.5453;')],
  ['lap siding is stood on end, which is the ninety degrees Movie caught',
    s => sub(s, `      for (let y = box.yBottom - step; y > box.yTop; y -= step) {
        lineAcross(ctx, box.x0, box.x1, y);
      }`, `      for (let x = box.x0 + step; x < box.x1; x += step) {
        ctx.moveTo(x, box.yTop); ctx.lineTo(x, box.yBottom);
      }`)],
  ['board and batten is laid flat, the same ninety degrees the other way',
    s => sub(s, `      for (let x = box.x0 + board; x < box.x1; x += board) {
        ctx.moveTo(x, box.yTop);
        ctx.lineTo(x, box.yBottom);`, `      for (let x = box.yTop + board; x < box.yBottom; x += board) {
        ctx.moveTo(box.x0, x);
        ctx.lineTo(box.x1, x);`)],
  ['the batten loses its board, so B&B draws singles like lap siding',
    s => sub(s, '        if (batten >= 1.5 && x + batten < box.x1) {',
      '        if (false) {')],
  ['a pattern hardcodes its spacing, so the table-s parameters stop meaning anything',
    s => sub(s, "      const step = paramOf(finish, 'exposureIn', 4) / 12 * box.pxPerFt;",
      '      const step = 4 / 12 * box.pxPerFt;')],
  ['brick is coursed on the unit alone, dropping the joint out of the arithmetic',
    s => sub(s, "      const high = (paramOf(finish, 'brickHighIn', 2.25) + joint) / 12 * box.pxPerFt;",
      "      const high = paramOf(finish, 'brickHighIn', 2.25) / 12 * box.pxPerFt;")],
  ['a shake-s joints run the full course again, so it reads as coursed ashlar',
    s => sub(s, '        const stub = Math.min(step * 0.62, y - box.yTop);',
      '        const stub = step;')],
  ['ashlar-s joints go to stubs, so blocks stop being blocks',
    s => sub(s, '    if (x1 < box.x1) { ctx.moveTo(x1, top); ctx.lineTo(x1, bottom); }',
      '    if (x1 < box.x1) { ctx.moveTo(x1, top); ctx.lineTo(x1, top + (bottom - top) * 0.2); }')],
  ['ledgestone is ruled to one course height, so it reads as tile',
    s => sub(s, '        high: row => course * (0.7 + 0.8 * jitter(row, 5)),',
      '        high: () => course,')],
  ['ashlar is ruled to one course height, so it is brick drawn at stone size',
    s => sub(s, '        high: row => high * (0.6 + 1.1 * jitter(row, 5)),',
      '        high: () => high,')],
  ['fieldstone is worn smooth, so it stops telling itself from a cobble',
    s => sub(s, '          const corners = jitter(cell, row + 9) > 0.5 ? 5 : 6;',
      '          const corners = 10;')],
  ['a fieldstone stops being irregular, so every stone is the same shape',
    s => sub(s, '            const wob = 0.52 + 0.92 * jitter(cell + i * 7, row + i);',
      '            const wob = 1;')],
  ['ledgestone breaks every ten inches again, and the streaks come back',
    s => sub(s, '        wide: (row, col) => course * (5 + 10 * jitter(row + 1, col + 3)),',
      '        wide: () => course * 3.5,')],
  ['nothing takes relief, so stone outlines flat and reads as tile stood on end',
    s => sub(s, '    if (finish.relief) {', '    if (false) {')],
  ['the shadow is drawn LAST, so it lies over the unit it should sit behind',
    s => sub(s, `      ctx.restore();
    }
    ctx.strokeStyle = line;
    ctx.globalAlpha = finish.relief ? 0.75 : 0.5;
    ctx.lineWidth = 0.75;
    pattern(ctx, box, finish);
    ctx.restore();`, `      ctx.restore();
    }
    ctx.strokeStyle = line;
    ctx.globalAlpha = finish.relief ? 0.75 : 0.5;
    ctx.lineWidth = 0.75;
    pattern(ctx, box, finish);
    if (finish.relief) {
      const off2 = reliefOffsetPx(finish, box.pxPerFt);
      ctx.save();
      ctx.translate(off2, off2);
      ctx.globalAlpha = 0.28;
      pattern(ctx, box, finish);
      ctx.restore();
    }
    ctx.restore();`)],
  ['the shadow is as dark as the unit, so there is no front and no back',
    s => sub(s, '      ctx.globalAlpha = 0.28;', '      ctx.globalAlpha = 0.75;')],
  ['the light moves to the LOWER left, so every shadow falls the wrong way',
    s => sub(s, '      ctx.translate(off, off);', '      ctx.translate(off, -off);')],
  ['the shadow stops being measured against the joint, so stone and brick match',
    s => sub(s, "    const joint = paramOf(finish, 'jointIn', 0.375);\n"
      + '    return Math.max(0.6, Math.min(2.5, joint / 12 * pxPerFt * 0.9));',
      '    return 1.5;')],
];

console.log('\n' + 'mutation'.padEnd(78) + 'caught by');
let survivors = 0, broken = 0;
for (const [label, mutate] of MUTATIONS) {
  let by;
  try {
    const m = run(load(mutate));
    if (!m.length) survivors += 1;
    by = m.length ? m[0].label : '!!! SURVIVED -- nothing here says this is wrong';
  } catch (error) {
    broken += 1;
    by = `!!! MUTATION DID NOT APPLY: ${error.message}`;
  }
  console.log(label.padEnd(78) + by);
}
console.log(`\n${MUTATIONS.length - survivors - broken}/${MUTATIONS.length} mutations caught`);
if (broken) console.log(`${broken} mutation(s) never applied -- they prove nothing`);

if (!MUTATION_MODE) {
  const missed = run(load(null));
  console.log(missed.length
    ? `\nfinish pattern harness: ${missed.length} check(s) FAILED`
    : '\nfinish pattern harness: all checks passed');
  process.exit(missed.length ? 1 : 0);
}
process.exit(survivors || broken ? 1 : 0);
