// elev-snap.js — what a hand drawing over an elevation or section catches.
//
// jb, 14 Nov 2026: "on the sections and elevations can we have 'node snap' on
// the corners intersections etc". The view keeps no records, so the snap
// reads the painter's ink through a recording canvas. The contract held here:
//
//   - a stroked or filled path's straight pieces are kept, in glass px, and
//     the transform the painter set (minus the page's own dpr) is applied;
//   - nothing drawn inside a clip smaller than the glass is kept (hatch:
//     siding courses, stone, shingles), and the clip ends at its restore;
//   - the first clip, before anything was drawn, is the pinned viewport and
//     hides nothing;
//   - the whole-glass ground fill is not a drawing edge;
//   - a straight run traced as a chain of short pieces is one piece, so its
//     joints are not false nodes;
//   - `snapRecordOff` hides what the painter says to hide (the drafter's own
//     marks, and the one in hand);
//   - catchAt prefers a node to a crossing to a point on a line, and a
//     negative reach is off.
//
// Run: node proto/elev-snap-harness.js          (checks)
//      node proto/elev-snap-harness.js --mutate (checks + mutation table)
const fs = require('fs');
const path = require('path');
const SRC = path.join(__dirname, '..', 'elev-snap.js');
const MUTATION_MODE = require('./harness-args.js').mutationMode();

function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) {
    const next = mutate(src);
    if (next === src) throw new Error('mutation matched nothing -- it would prove nothing');
    src = next;
  }
  const window = {};
  new Function('window', src)(window);
  return window.DraftElevSnap;
}

// A canvas that does nothing but keep a transform, as a 2D context does.
function fakeCtx(scale = 2) {
  let m = { a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 };
  const stack = [];
  const mat = o => ({
    ...o,
    inverse() { const det = o.a * o.d - o.b * o.c;
      return mat({ a: o.d / det, b: -o.b / det, c: -o.c / det, d: o.a / det,
        e: (o.c * o.f - o.d * o.e) / det, f: (o.b * o.e - o.a * o.f) / det }); },
    multiply(n) { return mat({ a: o.a * n.a + o.c * n.b, b: o.b * n.a + o.d * n.b,
      c: o.a * n.c + o.c * n.d, d: o.b * n.c + o.d * n.d,
      e: o.a * n.e + o.c * n.f + o.e, f: o.b * n.e + o.d * n.f + o.f }); },
  });
  const noop = () => {};
  return {
    getTransform: () => mat(m),
    translate(x, y) { m = { ...m, e: m.e + m.a * x + m.c * y, f: m.f + m.b * x + m.d * y }; },
    save() { stack.push({ ...m }); }, restore() { m = stack.pop() || m; },
    beginPath: noop, moveTo: noop, lineTo: noop, closePath: noop, rect: noop, arc: noop,
    stroke: noop, fill: noop, clip: noop, strokeRect: noop, fillRect: noop, fillText: noop,
    setTransform: noop,
  };
}

function run(S) {
  const results = [];
  const check = (name, ok) => results.push({ name, ok: Boolean(ok) });
  const W = 400, H = 300;

  // A FACE AND ITS HATCH
  {
    const rec = S.recorder(fakeCtx(), W, H);
    const c = rec.ctx;
    c.fillRect(0, 0, W, H);
    c.beginPath(); c.rect(0, 0, W, H); c.fill();             // the ground
    c.beginPath(); c.moveTo(50, 50); c.lineTo(150, 50); c.lineTo(150, 120); c.closePath(); c.stroke();
    c.save();
    c.beginPath(); c.rect(50, 50, 100, 70); c.clip();          // a face, siding inside
    c.beginPath(); c.moveTo(50, 60); c.lineTo(150, 60); c.stroke();
    c.restore();
    c.beginPath(); c.moveTo(10, 200); c.lineTo(300, 200); c.stroke(); // grade, after the hatch
    const segs = rec.segments();
    check('the triangle is three pieces', segs.filter(s => s[0].y <= 120 && s[1].y <= 120 && s[0].y >= 50).length === 3);
    check('the hatch course inside the clip is not kept', !segs.some(s => s[0].y === 60 && s[1].y === 60));
    check('the line after the restore is kept', segs.some(s => s[0].y === 200 && s[1].y === 200));
    check('the ground fill is not a drawing edge', !segs.some(s => s[0].x === 0 && s[1].x === W));
  }
  // A RUN DRAWN IN STEPS
  {
    const rec = S.recorder(fakeCtx(), W, H);
    const c = rec.ctx;
    c.beginPath(); c.moveTo(10, 40);
    for (let x = 15; x <= 100; x += 5) c.lineTo(x, 40);
    c.lineTo(100, 90);                                          // and turns the corner
    c.stroke();
    const segs = rec.segments();
    check('a straight run drawn in steps is one piece, its corner kept', segs.length === 2
      && segs[0][0].x === 10 && segs[0][1].x === 100 && segs[1][1].y === 90);
  }
  // THE PINNED FRAME'S CLIP
  {
    const rec = S.recorder(fakeCtx(), W, H);
    const c = rec.ctx;
    c.save();
    c.beginPath(); c.rect(100, 20, 150, 200); c.clip();        // viewport between the rails
    c.beginPath(); c.moveTo(120, 40); c.lineTo(200, 40); c.stroke();
    c.restore();
    check('the first clip before any line hides nothing', rec.segments().length === 1);
  }
  // A TRANSFORM THE PAINTER SET
  {
    const ctx = fakeCtx(2);
    const rec = S.recorder(ctx, W, H);
    const c = rec.ctx;
    c.save(); c.translate(10, 20);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(30, 0); c.stroke();
    c.restore();
    const [s] = rec.segments();
    check('a translate is carried into the glass px', s && s[0].x === 10 && s[0].y === 20 && s[1].x === 40);
  }
  // THE SWITCH
  {
    const rec = S.recorder(fakeCtx(), W, H);
    const c = rec.ctx;
    c.snapRecordOff = true;
    c.beginPath(); c.moveTo(0, 10); c.lineTo(50, 10); c.stroke();
    c.snapRecordOff = false;
    c.beginPath(); c.moveTo(0, 30); c.lineTo(50, 30); c.stroke();
    check('snapRecordOff hides what it is thrown round', rec.segments().length === 1 && rec.segments()[0][0].y === 30);
  }
  // FEET AND THE CATCH
  {
    const frame = { x0: 0, y0: 0, pxPerFt: 10, uMin: 0, yTop: 20 };
    const segs = S.segmentsInFeet(frame, [
      [{ x: 0, y: 100 }, { x: 100, y: 100 }],     // e = 10, u 0..10
      [{ x: 100, y: 100 }, { x: 0, y: 100 }],     // the same edge again
      [{ x: 50, y: 50 }, { x: 50, y: 150 }],      // u = 5, e 15..5
    ]);
    check('px become the view\'s feet, a twice-drawn edge once', segs.length === 2
      && segs[0].a.e === 10 && segs[1].a.u === 5);
    const reach = { node: 0.5, corner: 0.5, line: 0.3 };
    const n = S.catchAt(segs, [], { u: 9.8, e: 10.1 }, reach);
    check('an end is a node', n && n.kind === 'node' && n.at.u === 10 && n.at.e === 10);
    const x = S.catchAt(segs, [], { u: 5.2, e: 10.2 }, reach);
    check('a crossing is a corner', x && x.kind === 'corner' && Math.abs(x.at.u - 5) < 1e-9 && Math.abs(x.at.e - 10) < 1e-9);
    const l = S.catchAt(segs, [], { u: 2, e: 10.2 }, reach);
    check('a point on a line is a line catch', l && l.kind === 'line' && l.at.e === 10 && l.at.u === 2);
    const own = S.catchAt(segs, [{ u: 2.1, e: 10.3 }], { u: 2, e: 10.2 }, reach);
    check('a mark\'s own node beats the line under it', own && own.kind === 'node' && own.at.u === 2.1);
    const first = S.catchAt(segs, [{ u: 5.3, e: 10 }], { u: 5.05, e: 10.05 }, reach);
    check('a node in reach beats a nearer crossing', first && first.kind === 'node' && first.at.u === 5.3);
    const none = S.catchAt(segs, [], { u: 2, e: 10.2 }, { node: -1, corner: -1, line: -1 });
    check('reach off catches nothing', none === null);
    const sq = S.catchAt(segs, [], { u: 2, e: 10.2 }, { node: 0.5, corner: 0.5, line: -1 });
    check('no line catch when the line reach is off', sq === null);
  }
  return results;
}

const MUTANTS = [
  ['hatch kept', s => s.replace('if (off || hatchDepth > 0 || !path.length) return;', 'if (off || !path.length) return;')],
  ['clip never ends', s => s.replace('if (clipStack.length > 1) hatchDepth -= clipStack.pop().length;', 'if (clipStack.length > 1) clipStack.pop();')],
  ['frame clip hides', s => s.replace('const frameClip = !clipsSeen && !segs.length;', 'const frameClip = false;')],
  ['ground kept', s => s.replace('if (bboxShare(path) >= FRAME_CLIP_SHARE) return;', '')],
  ['switch ignored', s => s.replace("if (prop === 'snapRecordOff') { off = !!value; return true; }", '')],
  ['transform ignored', s => s.replace('return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };', 'return { x, y };')],
  ['steps kept apart', s => s.replace('if (cross < STRAIGHT_PX && dot > 0) { prev[1] = b; return; }', '')],
  ['no dedupe', s => s.replace('if (seen.has(k) || seen.has(k2)) return;', '')],
  ['crossing before node', s => s.replace("    if (best) return { kind: best.kind, at: best.at };\n    for (let i", '    for (let i')],
  ['line reach ignored', s => s.replace("near.forEach(s => offer('line', footOn(s, p), reach.line));", "near.forEach(s => offer('line', footOn(s, p), far));")],
];

function report(results) {
  results.forEach(r => console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}`));
  return results.every(r => r.ok);
}

const ok = report(run(load()));
console.log(`\n${ok ? 'all checks pass' : 'CHECKS FAIL'}`);
if (!ok) process.exit(1);
if (MUTATION_MODE) {
  let missed = 0;
  console.log('\nmutation table');
  MUTANTS.forEach(([name, mutate]) => {
    let caught;
    try { caught = !run(load(mutate)).every(r => r.ok); } catch (err) { caught = !/matched nothing/.test(err.message); if (!caught) throw err; }
    if (!caught) missed += 1;
    console.log(`${caught ? 'caught  ' : 'SURVIVED'}  ${name}`);
  });
  console.log(`\nelev-snap: ${MUTANTS.length - missed}/${MUTANTS.length} mutations caught`);
  process.exit(missed ? 1 : 0);
}
