// THE PAINTERS, MEASURED IN NODE.
//
// Coverage of the drawing has been expensive because every assertion about it
// went through a browser: serve the repo, boot a page, drive a mouse, then read
// pixels back off a canvas. That cost is why four of fifteen exports in
// render-2d.js have real coverage and eleven do not, and why each extraction
// has been moving untested code into a shared module where two pages can now
// call it.
//
// The painters do not need a browser. Every one of them takes a ctx and calls
// moveTo / lineTo / stroke / fillText on it. A fake ctx that RECORDS those
// calls makes all fifteen testable here, in milliseconds, with no server, no
// Chromium and no fixture.
//
//   node proto/render-2d-harness.js              run the checks
//   node proto/render-2d-harness.js --coverage   the mutation table
//
// --coverage is the part that matters. It re-loads render-2d.js once per
// painter with that painter's body emptied, re-runs every check, and reports
// which checks noticed. A painter whose no-op breaks nothing is not covered,
// whatever the spec names say. That is measured, not assumed -- the same
// question the browser suite is asked below, and the reason this file reports
// a table rather than a pass count.
'use strict';

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'render-2d.js');

// Argument handling is shared: proto/harness-args.js. Both --coverage and
// --mutate work here, and anything else exits 2 rather than running the wrong
// mode quietly. That module is require()d, not source-loaded -- see its header
// for why it is the one file here that must not be mutable by the tests.
const MUTATION_MODE = require('./harness-args.js').mutationMode();

// ─── Loading, with an optional mutation ───────────────────────────────────
// render-2d.js is `if (!window.DraftRender2D) { (() => { ... })(); }` and
// touches nothing else, so a bare object is a sufficient window. Evaluating
// the source text rather than require()ing it is what makes mutation cheap:
// no module cache to defeat, and the mutation is a string edit.
function load(mutate) {
  let src = fs.readFileSync(SRC, 'utf8');
  if (mutate) src = mutate(src);
  const window = {};
  new Function('window', src)(window);
  if (!window.DraftRender2D) throw new Error('render-2d.js defined no DraftRender2D');
  return window.DraftRender2D;
}

// Top-level painters sit at two-space indent, so the first line that is
// exactly "  }" closes one. Nested closures are indented deeper and do not
// match -- drawGrid2D's inner drawGridLines ends "    };".
function painterBody(src, name) {
  const lines = src.split('\n');
  const start = lines.findIndex(l => l.startsWith(`  function ${name}(`));
  if (start < 0) throw new Error(`no painter named ${name} in render-2d.js`);
  const end = lines.findIndex((l, i) => i > start && l === '  }');
  if (end < 0) throw new Error(`could not find the end of ${name}`);
  return { lines, start, end };
}

// Empty a painter, keeping its signature so the module still exports it.
const noop = name => src => {
  const { lines, start, end } = painterBody(src, name);
  return [...lines.slice(0, start + 1), ...lines.slice(end)].join('\n');
};

// The named hole: strokeSegPath2D's curved branch. Deleting it leaves a
// painter that draws every segment straight.
const dropBulge = src => {
  const before = src;
  const out = src.replace(
    `    if (seg.bulge) {
      const c = toS(env.controlPoint(seg));
      ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
    } else {
      ctx.lineTo(b.x, b.y);
    }`,
    '    ctx.lineTo(b.x, b.y);',
  );
  if (out === before) throw new Error('dropBulge matched nothing -- the branch moved');
  return out;
};

// The other named hole: drawWallSeg2D's mitre path. MODEL.html passes
// joins = null, so every wall butts and this half of the painter does not run
// in the live page at all -- which is exactly why it could rot unnoticed.
const dropMitre = src => {
  const before = src;
  const out = src.replace(
    `      if (!joins || !joins.has(pt)) return { point: fallback, resolved: false };
      const join = joins.get(pt);
      if (!join || join.type === 'none') return { point: fallback, resolved: false };`,
    `      return { point: fallback, resolved: false };
      const join = joins.get(pt);`,
  );
  if (out === before) throw new Error('dropMitre matched nothing -- joinPoint moved');
  return out;
};

// drawOrigin2D's colour contract has two halves and they fail differently, so
// they get a mutation each: one page loses its skin, the other loses its
// marker. A single mutation deleting the whole expression would be caught by
// either check and would not tell them apart.
const dropOriginEnvColour = src => {
  const before = src;
  const out = src.replace(
    "ctx.strokeStyle = (env.colors && env.colors.origin) || '#557a46';",
    "ctx.strokeStyle = '#557a46';",
  );
  if (out === before) throw new Error('dropOriginEnvColour matched nothing -- the colour line moved');
  return out;
};

const dropOriginFallback = src => {
  const before = src;
  const out = src.replace(
    "ctx.strokeStyle = (env.colors && env.colors.origin) || '#557a46';",
    'ctx.strokeStyle = env.colors && env.colors.origin;',
  );
  if (out === before) throw new Error('dropOriginFallback matched nothing -- the colour line moved');
  return out;
};

const dropWallEnvColours = src => {
  const before = src;
  const out = src
    .replace("const wallFill      = wallColors.wall            || '#ffffff';",
             "const wallFill      = '#ffffff';")
    .replace("const wallEdge      = wallColors.wallEdge        || '#1d1f20';",
             "const wallEdge      = '#1d1f20';");
  if (out === before) throw new Error('dropWallEnvColours matched nothing -- the resolver moved');
  return out;
};

// The opposite slip: the env is read but nothing catches a caller that
// supplies none. MODEL.dc.html is exactly that caller today, so this one
// would blank every wall on the live page rather than in a test.
const dropWallColourFallback = src => {
  const before = src;
  const out = src
    .replace("wallColors.wall            || '#ffffff'", 'wallColors.wall')
    .replace("wallColors.wallEdge        || '#1d1f20'", 'wallColors.wallEdge');
  if (out === before) throw new Error('dropWallColourFallback matched nothing -- the resolver moved');
  return out;
};

// The body and the boundary are two decisions, not one. A skin that darkens
// the poche and lightens the line is exactly the case where confusing them
// paints the dots into the wall they are meant to mark.
const wallDotsTakeTheFill = src => {
  const before = src;
  const out = src.replace('      ctx.fillStyle = wallEdge;\n      const DOT_R = 2.5;',
                          '      ctx.fillStyle = wallFill;\n      const DOT_R = 2.5;');
  if (out === before) throw new Error('wallDotsTakeTheFill matched nothing -- the dot fill moved');
  return out;
};

// A CONSTANT painter: every fixture draws a stall. Not a deleted painter --
// this one still draws, and draws something real -- it just ignores what it
// was asked for. This is the mutation the two equality checks in
// drawFixture2D exist to catch, and the reason their control is a
// differential rather than "the tape is not empty": an equality between two
// outputs of one function is satisfied by ANY constant function, of which a
// broken one returning nothing is only the loudest case. A "not empty" guard
// would let this one straight through.
const constantFixture = src => {
  const before = src;
  const out = src.replace('    const kind = fixture.kind;', "    const kind = 'stall';");
  if (out === before) throw new Error('constantFixture matched nothing -- the kind dispatch moved');
  return out;
};

// ─── The recording ctx ────────────────────────────────────────────────────
// A canvas context is a big surface and the painters use a lot of it, so this
// records through a Proxy rather than enumerating methods: any call lands on
// the tape as { op, args }, any assignment as { op: 'set', prop, value }.
//
// Three things it cannot fake away. measureText must return a width or every
// painter that centres a label divides by undefined -- it returns a
// proportional stand-in, so tests may assert that a box is drawn around the
// text but never its exact pixel width. Drawing state that a painter reads
// back must have a plausible default, hence the seeded values.
//
// And clip() is RECORDED BUT NOT ENFORCED. A real canvas clips drawing to the
// current path; a tape cannot. drawWallSeg2D fills each layer band, clips to
// it, then rules diagonal hatch lines far outside it and lets the clip cut
// them back -- so the hatch geometry on the tape runs well past the wall.
// Measuring a wall's thickness off the whole tape therefore reads too wide.
// Geometry assertions use boundaryPass() below, which is the unclipped pass.
function recordingCtx() {
  const tape = [];
  const state = {
    globalAlpha: 1, lineWidth: 1, strokeStyle: '#000', fillStyle: '#000',
    font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic',
    lineCap: 'butt', lineJoin: 'miter', miterLimit: 10,
    globalCompositeOperation: 'source-over', shadowBlur: 0, shadowColor: 'transparent',
    canvas: { width: 800, height: 600 },
    tape,
    measureText(text) {
      tape.push({ op: 'measureText', args: [text] });
      return { width: String(text).length * 6 };
    },
    createLinearGradient(...args) {
      tape.push({ op: 'createLinearGradient', args });
      return { addColorStop: (...a) => tape.push({ op: 'addColorStop', args: a }) };
    },
    createPattern(...args) { tape.push({ op: 'createPattern', args }); return null; },
  };
  return new Proxy(state, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol') return undefined;
      return (...args) => { tape.push({ op: String(prop), args }); };
    },
    set(target, prop, value) {
      tape.push({ op: 'set', prop: String(prop), value });
      target[prop] = value;
      return true;
    },
  });
}

// Reading the tape.
const calls = (ctx, op) => ctx.tape.filter(e => e.op === op).map(e => e.args);
const count = (ctx, op) => calls(ctx, op).length;
const sets = (ctx, prop) => ctx.tape.filter(e => e.op === 'set' && e.prop === prop).map(e => e.value);
const painted = ctx => ctx.tape.some(e => ['stroke', 'fill', 'fillText', 'fillRect', 'drawImage', 'strokeRect'].includes(e.op));

// Everything after the last restore(): for drawWallSeg2D that is the boundary
// lines, end caps and endpoint dots -- the part drawn with no clip in force,
// and so the only part whose coordinates a tape can be trusted on.
const boundaryPass = ctx => {
  let last = -1;
  ctx.tape.forEach((e, i) => { if (e.op === 'restore') last = i; });
  const slice = ctx.tape.slice(last + 1);
  return { tape: slice, ...Object.fromEntries([]) };
};
const spanY = ctx => {
  const ys = boundaryPass(ctx).tape
    .filter(e => e.op === 'moveTo' || e.op === 'lineTo')
    .map(e => e.args[1]);
  return { min: Math.min(...ys), max: Math.max(...ys) };
};

// A world→screen transform with a real scale and offset, so a painter that
// forgets to project is visible: unprojected world feet would land near zero.
const toS = p => ({ x: 400 + (p.x || 0) * 10, y: 300 + (p.z || 0) * 10 });

// ─── The checks ───────────────────────────────────────────────────────────
const SUITES = [];
const suite = (painter, name, fn) => SUITES.push({ painter, name, fn });

// ── strokeSegPath2D: the straight branch and the curved one ──
suite('strokeSegPath2D', 'a straight segment strokes a line, not a curve', R => {
  const ctx = recordingCtx();
  R.strokeSegPath2D(ctx, toS, { start: { x: 0, z: 0 }, end: { x: 10, z: 0 } }, {
    controlPoint: () => { throw new Error('controlPoint asked for on a straight segment'); },
  });
  expect('one lineTo', count(ctx, 'lineTo'), 1);
  expect('no curve', count(ctx, 'quadraticCurveTo'), 0);
  expect('the line ends at the projected end', JSON.stringify(calls(ctx, 'lineTo')[0]), '[500,300]');
  expect('it strokes', count(ctx, 'stroke'), 1);
});

suite('strokeSegPath2D', 'a bulged segment curves through its control point', R => {
  const ctx = recordingCtx();
  let asked = 0;
  const seg = { start: { x: 0, z: 0 }, end: { x: 10, z: 0 }, bulge: 0.5 };
  R.strokeSegPath2D(ctx, toS, seg, {
    controlPoint: s => { asked += 1; expect('control point asked about this segment', s, seg); return { x: 5, z: -4 }; },
  });
  expect('the control point is asked for exactly once', asked, 1);
  expect('it curves', count(ctx, 'quadraticCurveTo'), 1);
  expect('and does NOT draw the chord', count(ctx, 'lineTo'), 0);
  expect('the curve bends through the projected control point',
    JSON.stringify(calls(ctx, 'quadraticCurveTo')[0]), '[450,260,500,300]');
});

// ── drawGrid2D: the datum rule and the zoom ladder ──
suite('drawGrid2D', 'no datum, no grid', R => {
  const ctx = recordingCtx();
  R.drawGrid2D(ctx, 800, 600, { datum: null, halfH: 30, gridFine: '#111', gridMajor: '#222', gridCoarse: '#333' });
  expect('nothing is painted at all', ctx.tape.length, 0);
});

suite('drawGrid2D', 'zoomed in draws 1ft and 10ft, never 100ft', R => {
  const ctx = recordingCtx();
  R.drawGrid2D(ctx, 800, 600, {
    datum: { x: 0, z: 0 }, halfH: 20, camX: 0, camZ: 0,
    gridFine: '#f1f1f1', gridMajor: '#f10f10', gridCoarse: '#c0c0c0',
  });
  expect('two passes', count(ctx, 'stroke'), 2);
  expect('the fine colour is used', sets(ctx, 'strokeStyle').includes('#f1f1f1'), true);
  expect('the coarse colour is NOT', sets(ctx, 'strokeStyle').includes('#c0c0c0'), false);
});

suite('drawGrid2D', 'zoomed out draws 10ft and 100ft, never 1ft', R => {
  const ctx = recordingCtx();
  R.drawGrid2D(ctx, 800, 600, {
    datum: { x: 0, z: 0 }, halfH: 200, camX: 0, camZ: 0,
    gridFine: '#f1f1f1', gridMajor: '#f10f10', gridCoarse: '#c0c0c0',
  });
  expect('two passes', count(ctx, 'stroke'), 2);
  expect('the coarse colour is used', sets(ctx, 'strokeStyle').includes('#c0c0c0'), true);
  expect('the fine colour is NOT', sets(ctx, 'strokeStyle').includes('#f1f1f1'), false);
});

suite('drawGrid2D', 'the grid counts from the datum, not from the world origin', R => {
  const lineXs = datum => {
    const ctx = recordingCtx();
    R.drawGrid2D(ctx, 800, 600, {
      datum, halfH: 20, camX: 0, camZ: 0,
      gridFine: '#f1f1f1', gridMajor: '#f10f10', gridCoarse: '#c0c0c0',
    });
    return calls(ctx, 'moveTo').map(a => a[0]).join(',');
  };
  const atOrigin = lineXs({ x: 0, z: 0 });
  const offset = lineXs({ x: 0.5, z: 0.5 });
  expect('moving the datum half a foot moves the lines', atOrigin === offset, false);
});

// ── drawOrigin2D ──
suite('drawOrigin2D', 'no datum, no marker', R => {
  const ctx = recordingCtx();
  R.drawOrigin2D(ctx, toS, { datum: null });
  expect('nothing is painted', ctx.tape.length, 0);
});

suite('drawOrigin2D', 'the marker stands on the datum', R => {
  const ctx = recordingCtx();
  R.drawOrigin2D(ctx, toS, { datum: { x: 10, z: 20 }, elev: 0 });
  expect('a ring is drawn', count(ctx, 'arc'), 1);
  const [cx, cy] = calls(ctx, 'arc')[0];
  expect('centred on the projected datum x', cx, 500);
  expect('centred on the projected datum z', cy, 500);
  expect('with a crosshair through it', count(ctx, 'moveTo'), 2);
});

// The datum marker was the one painter a skinned page could not re-colour: its
// green was a literal. Now it reads env.colors.origin and keeps the literal as
// the fallback. Both halves need pinning, and separately -- a check that only
// proves the supplied colour wins would pass on a painter that had lost its
// fallback, and vice versa.
//
// This is also why the assertion is on the tape and not on pixels: the browser
// spec for this marker measured ANTI-ALIASING around the ring rather than the
// stroke colour, which is why it could fail on a clean tree. A recorded
// strokeStyle has no such ambiguity.
suite('drawOrigin2D', 'a caller that supplies a colour gets it', R => {
  const ctx = recordingCtx();
  R.drawOrigin2D(ctx, toS, {
    datum: { x: 0, z: 0 }, elev: 0, colors: { origin: '#ff00aa' },
  });
  expect('the marker is stroked in the skin colour', sets(ctx, 'strokeStyle')[0], '#ff00aa');
});

suite('drawOrigin2D', 'a caller that supplies none keeps the literal', R => {
  const ctx = recordingCtx();
  R.drawOrigin2D(ctx, toS, { datum: { x: 0, z: 0 }, elev: 0 });
  expect('the fallback is the day value', sets(ctx, 'strokeStyle')[0], '#557a46');
});

// A colors object is not the same as an origin colour in it. The page that
// skins SOME painters and not this one must still get a visible marker.
suite('drawOrigin2D', 'a colours object without an origin key still falls back', R => {
  const ctx = recordingCtx();
  R.drawOrigin2D(ctx, toS, { datum: { x: 0, z: 0 }, elev: 0, colors: { grid: '#123456' } });
  expect('the fallback still applies', sets(ctx, 'strokeStyle')[0], '#557a46');
});

// Ring and crosshair are one colour decision, not two. If a later edit gives
// the crosshair its own strokeStyle, a skinned page could re-colour half the
// marker -- which is the original defect back in a smaller form.
suite('drawOrigin2D', 'the whole marker is one colour decision', R => {
  const ctx = recordingCtx();
  R.drawOrigin2D(ctx, toS, {
    datum: { x: 0, z: 0 }, elev: 0, colors: { origin: '#ff00aa' },
  });
  expect('strokeStyle is set exactly once', sets(ctx, 'strokeStyle').length, 1);
  expect('both strokes use it', count(ctx, 'stroke'), 2);
});

// ── drawUnderlays2D: four separate refusals ──
const underlayEnv = over => ({
  isPrinting: false,
  activeLevel: { id: 'L1' },
  underlays: [{ id: 'u1', levelId: 'L1', x: 0, z: 0, widthFt: 20, heightFt: 14, opacity: 0.5 }],
  imageFor: () => ({ tag: 'image' }),
  ...over,
});

// Each refusal below is stated as a DIFFERENTIAL: the same fixture with one
// field changed, asserted against the same fixture without it. A bare
// "nothing was drawn" is the weakest assertion in the harness -- it passes on
// a painter that has been deleted, on a fixture that was silently malformed,
// and on a refusal for entirely the wrong reason. Pairing each one with its
// control is what makes it evidence rather than an absence.
//
// It also stops the coverage table lying about this painter. Refusal-only
// checks scored it 1/5 against a no-op, the worst row in the suite, when the
// truth was that four of its five checks assert absence and a deleted painter
// satisfies them for free. A low no-op score licenses two readings -- weak
// checks, or checks that assert absence -- and the number cannot tell them
// apart. These pairs settle it: after this, a no-op breaks all five.
const underlayDraws = (R, over) => {
  const ctx = recordingCtx();
  R.drawUnderlays2D(ctx, toS, underlayEnv(over));
  return { images: count(ctx, 'drawImage'), painted: ctx.tape.length };
};

suite('drawUnderlays2D', 'a printing page draws no underlay', R => {
  expect('nothing is painted', underlayDraws(R, { isPrinting: true }).painted, 0);
  expect('but the same page prints one when it is not printing',
    underlayDraws(R, {}).images, 1);
});

suite('drawUnderlays2D', 'an underlay belonging to another level is skipped', R => {
  expect('nothing is drawn', underlayDraws(R, { activeLevel: { id: 'L2' } }).images, 0);
  expect('and the same underlay draws on its own level',
    underlayDraws(R, { activeLevel: { id: 'L1' } }).images, 1);
});

suite('drawUnderlays2D', 'an underlay whose image has not loaded is skipped', R => {
  expect('nothing is drawn', underlayDraws(R, { imageFor: () => null }).images, 0);
  expect('and the same underlay draws once its image arrives',
    underlayDraws(R, { imageFor: () => ({ tag: 'image' }) }).images, 1);
});

// The threshold matters as much as the refusal: too eager and a legitimately
// small underlay vanishes. So the control here is a SMALL one that still
// draws, not the 20ft default -- that is what pins the cut-off in place.
suite('drawUnderlays2D', 'a sub-pixel underlay is skipped rather than drawn as a smear', R => {
  const at = (widthFt, heightFt) => underlayDraws(R, {
    underlays: [{ id: 'u1', levelId: 'L1', x: 0, z: 0, widthFt, heightFt, opacity: 1 }],
  }).images;
  expect('nothing is drawn for a sub-pixel one', at(0.05, 0.05), 0);
  expect('but a small one above the cut-off still draws', at(1, 1), 1);
});

suite('drawUnderlays2D', 'a real underlay is drawn at its own opacity', R => {
  const ctx = recordingCtx();
  R.drawUnderlays2D(ctx, toS, underlayEnv());
  expect('one image', count(ctx, 'drawImage'), 1);
  const [, left, top, w, h] = calls(ctx, 'drawImage')[0];
  expect('left edge projected', left, 300);
  expect('top edge projected', top, 230);
  expect('width in screen units', w, 200);
  expect('height in screen units', h, 140);
  expect('its opacity is applied', sets(ctx, 'globalAlpha')[0], 0.5);
  expect('and the state is put back', count(ctx, 'restore'), 1);
});

// ── drawShape2D ──
const shapeEnv = over => ({
  shapeColor: '#3f8f7a', isPrinting: false,
  flooringTypes: [{ id: 'oak', label: 'Oak' }],
  outlineAreaSqFt: () => 240,
  areaLabel: sqft => `${sqft} sq ft`,
  ...over,
});
const TRI = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }];

suite('drawShape2D', 'a shape of one point is not a shape', R => {
  const ctx = recordingCtx();
  R.drawShape2D(ctx, toS, { points: [{ x: 0, z: 0 }] }, {}, shapeEnv());
  expect('nothing is painted', ctx.tape.length, 0);
});

suite('drawShape2D', 'two points stroke an open line, with no fill', R => {
  const ctx = recordingCtx();
  R.drawShape2D(ctx, toS, { points: TRI.slice(0, 2) }, {}, shapeEnv());
  expect('it strokes', count(ctx, 'stroke'), 1);
  expect('it does not close', count(ctx, 'closePath'), 0);
  expect('it does not fill a body', count(ctx, 'fill'), 0);
});

suite('drawShape2D', 'three points close and fill', R => {
  const ctx = recordingCtx();
  R.drawShape2D(ctx, toS, { points: TRI }, {}, shapeEnv());
  expect('it closes', count(ctx, 'closePath'), 1);
  expect('it fills', count(ctx, 'fill'), 1);
  expect('and wears the page colour', sets(ctx, 'strokeStyle').includes('#3f8f7a'), true);
});

suite('drawShape2D', 'a preview wears its own colour and grows no handles', R => {
  const ctx = recordingCtx();
  R.drawShape2D(ctx, toS, { points: TRI }, { preview: true }, shapeEnv());
  expect('no vertex handles', count(ctx, 'fillRect'), 0);
  expect('not the committed colour', sets(ctx, 'strokeStyle').includes('#3f8f7a'), false);
});

suite('drawShape2D', 'a committed shape grows one handle per vertex', R => {
  const ctx = recordingCtx();
  R.drawShape2D(ctx, toS, { points: TRI }, {}, shapeEnv());
  expect('three handles', count(ctx, 'fillRect'), 3);
});

suite('drawShape2D', 'printing drops the handles but keeps the shape', R => {
  const ctx = recordingCtx();
  R.drawShape2D(ctx, toS, { points: TRI }, {}, shapeEnv({ isPrinting: true }));
  expect('no handles', count(ctx, 'fillRect'), 0);
  expect('the shape is still stroked', count(ctx, 'stroke'), 1);
});

suite('drawShape2D', 'a flooring area labels itself with finish and measured area', R => {
  const ctx = recordingCtx();
  R.drawShape2D(ctx, toS, { points: TRI, flooring: { type: 'oak' } }, {}, shapeEnv());
  expect('one label', count(ctx, 'fillText'), 1);
  expect('reading finish then area', calls(ctx, 'fillText')[0][0], 'Oak · 240 sq ft');
});

suite('drawShape2D', 'a preview never labels itself', R => {
  const ctx = recordingCtx();
  R.drawShape2D(ctx, toS, { points: TRI, flooring: { type: 'oak' } }, { preview: true }, shapeEnv());
  expect('no label', count(ctx, 'fillText'), 0);
});

// ── drawBoneyardMark2D ──
const markEnv = () => ({
  geometryFor: () => ({ center: { x: 10, z: 0 }, ux: 1, uz: 0 }),
  label: () => '',
});

suite('drawBoneyardMark2D', 'a mark with no geometry paints nothing', R => {
  const ctx = recordingCtx();
  R.drawBoneyardMark2D(ctx, toS, {}, { widthFt: 3, type: 'window' }, '#c33', { geometryFor: () => null });
  expect('nothing is painted', ctx.tape.length, 0);
});

suite('drawBoneyardMark2D', 'the three kinds carry three different letters', R => {
  const letterFor = type => {
    const ctx = recordingCtx();
    R.drawBoneyardMark2D(ctx, toS, {}, { widthFt: 3, type }, '#c33', markEnv());
    return calls(ctx, 'fillText')[0][0];
  };
  expect('a door reads D', letterFor('door'), 'D');
  expect('a gable bump reads G', letterFor('gable-bump'), 'G');
  expect('a window reads W', letterFor('window'), 'W');
});

suite('drawBoneyardMark2D', 'the mark wears the colour it was handed', R => {
  const ctx = recordingCtx();
  R.drawBoneyardMark2D(ctx, toS, {}, { widthFt: 3, type: 'window' }, '#abcdef', markEnv());
  expect('stroke', sets(ctx, 'strokeStyle').includes('#abcdef'), true);
  expect('and fill', sets(ctx, 'fillStyle').includes('#abcdef'), true);
});

suite('drawBoneyardMark2D', 'a mark is a bar with a tick at each end', R => {
  const ctx = recordingCtx();
  R.drawBoneyardMark2D(ctx, toS, {}, { widthFt: 4, type: 'window' }, '#c33', markEnv());
  expect('the bar plus two ticks', count(ctx, 'stroke'), 3);
  const bar = calls(ctx, 'lineTo')[0];
  expect('the bar spans the mark width in screen units', bar[0] - calls(ctx, 'moveTo')[0][0], 40);
});

// ── drawNoteScreen2D: the leader, the box, and which way the block grows ──
const noteEnv = { color: '#c33', fillColor: '#ffe' };
const NOTE = { body: 'NOSING 1 IN', end: 'line', fill: false, outline: false };

suite('drawNoteScreen2D', 'the body is painted, one fillText per line', R => {
  const ctx = recordingCtx();
  R.drawNoteScreen2D(ctx, { x: 100, y: 100 }, { x: 200, y: 60 }, { ...NOTE, body: 'TWO\nLINES' }, {}, noteEnv);
  expect('two rows', count(ctx, 'fillText'), 2);
  expect('first row', calls(ctx, 'fillText')[0][0], 'TWO');
  expect('second row', calls(ctx, 'fillText')[1][0], 'LINES');
  const firstY = calls(ctx, 'fillText')[0][2], secondY = calls(ctx, 'fillText')[1][2];
  expect('the second row sits one line lower', secondY - firstY, 14);
});

suite('drawNoteScreen2D', 'the block grows away from the anchor', R => {
  const leftOf = textX => {
    const ctx = recordingCtx();
    R.drawNoteScreen2D(ctx, { x: 100, y: 100 }, { x: textX, y: 100 }, { ...NOTE, outline: true }, {}, noteEnv);
    return calls(ctx, 'roundRect')[0][0];
  };
  const toTheRight = leftOf(200);
  const toTheLeft = leftOf(20);
  expect('placed right of the anchor, the box starts at the text point', toTheRight, 200);
  expect('placed left of it, the box ends there instead', toTheLeft < 20, true);
});

suite('drawNoteScreen2D', 'the leader meets the near edge of the block', R => {
  const ctx = recordingCtx();
  R.drawNoteScreen2D(ctx, { x: 100, y: 100 }, { x: 200, y: 60 }, NOTE, {}, noteEnv);
  expect('one leader', count(ctx, 'lineTo'), 1);
  expect('it ends on the anchor', JSON.stringify(calls(ctx, 'lineTo')[0]), '[100,100]');
  expect('and starts at the near edge, not the far one', calls(ctx, 'moveTo')[0][0], 200);
});

suite('drawNoteScreen2D', 'end "none" draws no leader at all', R => {
  const ctx = recordingCtx();
  R.drawNoteScreen2D(ctx, { x: 100, y: 100 }, { x: 200, y: 60 }, { ...NOTE, end: 'none' }, {}, noteEnv);
  expect('no leader', count(ctx, 'lineTo'), 0);
  expect('but the text is still painted', count(ctx, 'fillText'), 1);
});

suite('drawNoteScreen2D', 'end "arrow" adds a filled head at the anchor', R => {
  const plain = recordingCtx();
  R.drawNoteScreen2D(plain, { x: 100, y: 100 }, { x: 200, y: 60 }, NOTE, {}, noteEnv);
  const arrow = recordingCtx();
  R.drawNoteScreen2D(arrow, { x: 100, y: 100 }, { x: 200, y: 60 }, { ...NOTE, end: 'arrow' }, {}, noteEnv);
  expect('a plain leader fills nothing', count(plain, 'fill'), 0);
  expect('an arrow head is filled', count(arrow, 'fill'), 1);
  expect('and is built at the anchor', JSON.stringify(calls(arrow, 'moveTo').pop()), '[100,100]');
});

suite('drawNoteScreen2D', 'a filled note uses the fill colour at its own opacity', R => {
  const ctx = recordingCtx();
  R.drawNoteScreen2D(ctx, { x: 100, y: 100 }, { x: 200, y: 60 },
    { ...NOTE, fill: true, fillOpacity: 0.25 }, {}, noteEnv);
  expect('the box is filled', count(ctx, 'fill'), 1);
  expect('in the fill colour', sets(ctx, 'fillStyle').includes('#ffe'), true);
  expect('at the note opacity', sets(ctx, 'globalAlpha').includes(0.25), true);
});

suite('drawNoteScreen2D', 'a preview is drawn faint and dashed', R => {
  const ctx = recordingCtx();
  R.drawNoteScreen2D(ctx, { x: 100, y: 100 }, { x: 200, y: 60 }, NOTE, { preview: true }, noteEnv);
  expect('faint', sets(ctx, 'globalAlpha')[0], 0.6);
  expect('and the leader is dashed', JSON.stringify(calls(ctx, 'setLineDash')[0][0]), '[5,4]');
});

suite('drawNoteScreen2D', 'the bullnose cannot exceed half the box', R => {
  const ctx = recordingCtx();
  R.drawNoteScreen2D(ctx, { x: 100, y: 100 }, { x: 200, y: 60 },
    { ...NOTE, outline: true, bullnose: 9999 }, {}, noteEnv);
  const [, , boxW, boxH, radius] = calls(ctx, 'roundRect')[0];
  expect('clamped to half the shorter side', radius, Math.min(boxH / 2, boxW / 2));
});

// ── drawStairNotes2D: the pane filter, and that a note reaches the painter ──
const stairFrame = over => ({
  stair: { levelId: 'L1' },
  rects: { section: { x: 0, y: 0, w: 400, h: 300 }, plan: { x: 400, y: 0, w: 400, h: 300 } },
  paneScreen: (pane, pt) => ({ x: pt.x + (pane === 'plan' ? 400 : 0), y: pt.y }),
  paneAt: () => 'section',
  ...over,
});
const stairEnv = over => ({
  notes: [], anchor: null, hover: null, pending: null, noteEditor: false, noteDraft: '',
  noteColor: '#c33', noteFillColor: '#ffe',
  previewStyle: body => ({ body, end: 'arrow', fill: false, outline: false }),
  ...over,
});
const COMMITTED = {
  view: 'stair', levelId: 'L1', pane: 'section',
  anchor: { x: 10, y: 10 }, text: { x: 120, y: 40 }, body: 'NOSING 1 IN', end: 'line',
};

suite('drawStairNotes2D', 'a committed note paints its own body', R => {
  const ctx = recordingCtx();
  R.drawStairNotes2D(ctx, stairFrame(), stairEnv({ notes: [COMMITTED] }));
  expect('the text reaches the canvas', calls(ctx, 'fillText').map(a => a[0]).join('|'), 'NOSING 1 IN');
});

suite('drawStairNotes2D', 'a committed note is placed at its pane-projected points', R => {
  const ctx = recordingCtx();
  R.drawStairNotes2D(ctx, stairFrame(), stairEnv({ notes: [COMMITTED] }));
  expect('the leader ends on the projected anchor', JSON.stringify(calls(ctx, 'lineTo')[0]), '[10,10]');
});

suite('drawStairNotes2D', 'a plan-pane note is projected into the plan pane', R => {
  const ctx = recordingCtx();
  R.drawStairNotes2D(ctx, stairFrame(), stairEnv({ notes: [{ ...COMMITTED, pane: 'plan' }] }));
  expect('the anchor carries the plan pane offset', JSON.stringify(calls(ctx, 'lineTo')[0]), '[410,10]');
});

suite('drawStairNotes2D', 'notes belonging elsewhere are left alone', R => {
  const paintedFor = note => {
    const ctx = recordingCtx();
    R.drawStairNotes2D(ctx, stairFrame(), stairEnv({ notes: [note] }));
    return painted(ctx);
  };
  expect('another level', paintedFor({ ...COMMITTED, levelId: 'L2' }), false);
  expect('another view', paintedFor({ ...COMMITTED, view: 'plan' }), false);
  expect('but this one is painted', paintedFor(COMMITTED), true);
});

suite('drawStairNotes2D', 'a note on a pane this frame does not have is skipped', R => {
  const ctx = recordingCtx();
  R.drawStairNotes2D(ctx, stairFrame({ rects: { plan: { x: 0, y: 0 } } }),
    stairEnv({ notes: [COMMITTED] }));
  expect('nothing painted', painted(ctx), false);
});

suite('drawStairNotes2D', 'an anchor being placed with no hover is a bare ring', R => {
  const ctx = recordingCtx();
  R.drawStairNotes2D(ctx, stairFrame(),
    stairEnv({ anchor: { view: 'stair', pane: 'section', pt: { x: 30, y: 40 } } }));
  expect('a ring', count(ctx, 'arc'), 1);
  expect('at the anchor', JSON.stringify(calls(ctx, 'arc')[0].slice(0, 2)), '[30,40]');
  expect('and no note block', count(ctx, 'fillText'), 0);
});

suite('drawStairNotes2D', 'once the cursor moves off the anchor, a preview follows it', R => {
  const ctx = recordingCtx();
  R.drawStairNotes2D(ctx, stairFrame(), stairEnv({
    anchor: { view: 'stair', pane: 'section', pt: { x: 30, y: 40 } },
    hover: { x: 150, y: 90 },
  }));
  expect('no bare ring now', count(ctx, 'arc'), 0);
  expect('a preview block instead', count(ctx, 'fillText'), 1);
  expect('drawn faint, which only arrives as an option', sets(ctx, 'globalAlpha')[0], 0.6);
});

suite('drawStairNotes2D', 'the note being typed is painted only while the editor is open', R => {
  const pending = { view: 'stair', pane: 'section', anchor: { x: 10, y: 10 }, text: { x: 120, y: 40 } };
  const shut = recordingCtx();
  R.drawStairNotes2D(shut, stairFrame(), stairEnv({ pending, noteEditor: false, noteDraft: 'RISER' }));
  expect('editor shut, nothing painted', painted(shut), false);
  const open = recordingCtx();
  R.drawStairNotes2D(open, stairFrame(), stairEnv({ pending, noteEditor: true, noteDraft: 'RISER' }));
  expect('editor open, the draft is painted', calls(open, 'fillText').map(a => a[0]).join('|'), 'RISER');
});

// ── drawDimension2D ──
const dimColors = {
  stroke: '#233', preview: '#39f', selected: '#f60', selectedHalo: '#fd8', labelBack: '#fff',
};
const dimEnv = { colors: dimColors, label: ft => `${ft.toFixed(1)}'` };

suite('drawDimension2D', 'a dimension with no length is not drawn', R => {
  const ctx = recordingCtx();
  R.drawDimension2D(ctx, toS, { start: { x: 5, z: 5 }, end: { x: 5, z: 5 } }, {}, dimEnv);
  expect('nothing painted', ctx.tape.length, 0);
});

suite('drawDimension2D', 'the measurement is the world distance, formatted by the page', R => {
  const ctx = recordingCtx();
  R.drawDimension2D(ctx, toS, { start: { x: 0, z: 0 }, end: { x: 12, z: 5 } }, {}, dimEnv);
  expect('13 feet, through env.label', calls(ctx, 'fillText')[0][0], "13.0'");
});

suite('drawDimension2D', 'both ends carry an arrowhead', R => {
  const ctx = recordingCtx();
  R.drawDimension2D(ctx, toS, { start: { x: 0, z: 0 }, end: { x: 10, z: 0 } }, {}, dimEnv);
  expect('two filled heads', count(ctx, 'fill'), 2);
});

suite('drawDimension2D', 'preview and selected wear their own colours', R => {
  const colourOf = options => {
    const ctx = recordingCtx();
    R.drawDimension2D(ctx, toS, { start: { x: 0, z: 0 }, end: { x: 10, z: 0 } }, options, dimEnv);
    return sets(ctx, 'strokeStyle');
  };
  expect('plain', colourOf({}).includes('#233'), true);
  expect('preview', colourOf({ preview: true }).includes('#39f'), true);
  expect('selected', colourOf({ selected: true }).includes('#f60'), true);
  expect('and selected draws a halo behind it', colourOf({ selected: true }).includes('#fd8'), true);
});

suite('drawDimension2D', 'the label never reads from the left of the sheet', R => {
  // Two dimensions drawn back to back: the text must not flip upside down.
  const angleFor = end => {
    const ctx = recordingCtx();
    R.drawDimension2D(ctx, toS, { start: { x: 0, z: 0 }, end }, {}, dimEnv);
    return calls(ctx, 'rotate')[0][0];
  };
  const rightwards = angleFor({ x: 10, z: 0 });
  const leftwards = angleFor({ x: -10, z: 0 });
  expect('running right, the text is level', rightwards, 0);
  expect('running left, it is levelled too rather than upside down', leftwards, 0);
  const steep = angleFor({ x: 0, z: 10 });
  expect('a vertical dimension stays within a quarter turn', Math.abs(steep) <= Math.PI / 2, true);
});

// ── drawStairs2D: the layer gates, the tread ladder, and the parts ──
const STAIR = { start: { x: 0, y: 0, z: 0 }, widthFt: 3 };
const stairLayout = { risers: 14, riserIn: 7.5 };
const stairParts = over => ({
  runs: [{ start: { x: 0, z: 0 }, dir: { x: 1, z: 0 }, lenFt: 10, treads: 13 }],
  rails: [], landing: null, gap: null,
  walk: [{ x: 0.5, z: 1.5 }, { x: 9.5, z: 1.5 }],
  ...over,
});
const stairsEnv = (over = {}, parts = {}) => ({
  layer: { visible: true, printable: true },
  stairs: [STAIR],
  layoutFor: () => stairLayout,
  partsFor: () => stairParts(parts),
  elev: 0, stairColor: '#5a4', treadRunIn: 10,
  formatInchesOnly: inches => `${inches}"`,
  isPrinting: false,
  ...over,
});

// Each refusal carries its control: the same env with the disqualifying field
// flipped back, proving the fixture would otherwise have drawn. Without that,
// every one of these passes on a painter that has been deleted -- they assert
// an absence, and an absence is what a deleted painter is best at.
const stairsPaints = (R, over, stair) => {
  const ctx = recordingCtx();
  R.drawStairs2D(ctx, toS, stairsEnv(over, stair));
  return ctx.tape.length;
};

suite('drawStairs2D', 'a hidden layer paints nothing', R => {
  expect('nothing painted', stairsPaints(R, { layer: { visible: false, printable: true } }), 0);
  expect('but the same stair on a visible layer does',
    stairsPaints(R, { layer: { visible: true, printable: true } }) > 0, true);
});

suite('drawStairs2D', 'a non-printable layer is dropped from a print, not from the screen', R => {
  const onScreen = recordingCtx();
  R.drawStairs2D(onScreen, toS, stairsEnv({ layer: { visible: true, printable: false } }));
  expect('drawn on screen', painted(onScreen), true);
  const printing = recordingCtx();
  R.drawStairs2D(printing, toS, stairsEnv({ layer: { visible: true, printable: false }, isPrinting: true }));
  expect('and dropped from the print', printing.tape.length, 0);
});

suite('drawStairs2D', 'no stairs, nothing drawn', R => {
  expect('nothing painted', stairsPaints(R, { stairs: [] }), 0);
  expect('but the same page with a stair on it draws', stairsPaints(R, {}) > 0, true);
});

suite('drawStairs2D', 'a run draws two stringers and one tread line per tread, nosing included', R => {
  const ctx = recordingCtx();
  R.drawStairs2D(ctx, toS, stairsEnv({}, { runs: [{ start: { x: 0, z: 0 }, dir: { x: 1, z: 0 }, lenFt: 10, treads: 13 }] }));
  // Stringers are one path of two lines; treads are one path of treads+1.
  expect('14 tread lines for 13 treads', count(ctx, 'lineTo') >= 14, true);
  expect('the run is stroked', count(ctx, 'stroke') >= 2, true);
});

// A THRESHOLD refusal needs its control more than a plain `=== 0` does, not
// less: `0 < 6` is true for a deleted painter too, so the assertion is
// satisfied by the painter doing nothing at all.
suite('drawStairs2D', 'a run shorter than a pixel is skipped rather than drawn as a dot', R => {
  const stringersFor = lenFt => {
    const ctx = recordingCtx();
    R.drawStairs2D(ctx, toS, stairsEnv({}, {
      runs: [{ start: { x: 0, z: 0 }, dir: { x: 1, z: 0 }, lenFt, treads: 0 }],
      walk: [{ x: 0, z: 0 }, { x: lenFt * 2, z: 0 }],
    }));
    return calls(ctx, 'lineTo').length;
  };
  expect('no stringers for a sub-pixel run', stringersFor(0.01) < 6, true);
  expect('but a real run draws them', stringersFor(8) >= 6, true);
});

suite('drawStairs2D', 'the tread ladder is spaced by the run increment, not by the tread count', R => {
  const firstGap = treadRunIn => {
    const ctx = recordingCtx();
    R.drawStairs2D(ctx, toS, stairsEnv({ treadRunIn }, {
      runs: [{ start: { x: 0, z: 0 }, dir: { x: 1, z: 0 }, lenFt: 10, treads: 3 }],
    }));
    const xs = calls(ctx, 'moveTo').map(a => a[0]);
    return xs[3] - xs[2];
  };
  expect('a 10in run steps 10in worth of pixels', Math.round(firstGap(10)), Math.round(10 / 12 * 10));
  expect('an 11in run steps further', Math.round(firstGap(11)), Math.round(11 / 12 * 10));
});

suite('drawStairs2D', 'rails, landing, winders and the U gap are each drawn only when present', R => {
  const strokesFor = parts => {
    const ctx = recordingCtx();
    R.drawStairs2D(ctx, toS, stairsEnv({}, parts));
    return count(ctx, 'stroke');
  };
  const bare = strokesFor({});
  expect('a rail path adds a stroke', strokesFor({ rails: [[{ x: 0, z: 0 }, { x: 9, z: 0 }]] }) > bare, true);
  expect('a landing adds strokes', strokesFor({
    landing: { poly: [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 3 }, { x: 0, z: 3 }], winderLines: [] },
  }) > bare, true);
  expect('each winder line adds one more', strokesFor({
    landing: {
      poly: [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 3 }, { x: 0, z: 3 }],
      winderLines: [[{ x: 0, z: 0 }, { x: 3, z: 3 }], [{ x: 0, z: 0 }, { x: 3, z: 1 }]],
    },
  }), strokesFor({
    landing: { poly: [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 3 }, { x: 0, z: 3 }], winderLines: [] },
  }) + 2);
  expect('the U gap adds a stroke', strokesFor({ gap: [{ x: 0, z: 1.5 }, { x: 9, z: 1.5 }] }) > bare, true);
});

suite('drawStairs2D', 'the walk line carries the DN label with its riser count and rise', R => {
  const ctx = recordingCtx();
  R.drawStairs2D(ctx, toS, stairsEnv());
  expect('one label', count(ctx, 'fillText'), 1);
  expect('reading direction, count and rise', calls(ctx, 'fillText')[0][0], 'DN — 14R @ 7.5"');
});

suite('drawStairs2D', 'the label is levelled rather than drawn upside down', R => {
  // The painter turns an upside-down label by adding a half turn, so the
  // angle it ends on may be a full turn away from zero -- 2pi reads upright.
  // Upright is therefore "within a quarter turn once the full turns are
  // taken out", not "equal to zero". Reading it the strict way failed this
  // check against correct code.
  const uprightness = walk => {
    const ctx = recordingCtx();
    R.drawStairs2D(ctx, toS, stairsEnv({}, { walk }));
    let angle = calls(ctx, 'rotate')[0][0] % (Math.PI * 2);
    if (angle > Math.PI) angle -= Math.PI * 2;
    if (angle <= -Math.PI) angle += Math.PI * 2;
    return Math.abs(angle);
  };
  const quarterTurn = Math.PI / 2 + 1e-9;
  expect('walking right', uprightness([{ x: 0, z: 0 }, { x: 9, z: 0 }]) <= quarterTurn, true);
  expect('walking left', uprightness([{ x: 9, z: 0 }, { x: 0, z: 0 }]) <= quarterTurn, true);
  expect('walking down the screen', uprightness([{ x: 0, z: 0 }, { x: 0, z: 9 }]) <= quarterTurn, true);
  expect('and up-left, the diagonal case a single half turn has to cover',
    uprightness([{ x: 9, z: 9 }, { x: 0, z: 0 }]) <= quarterTurn, true);
});

suite('drawStairs2D', 'the stair wears the colour the page handed it', R => {
  const ctx = recordingCtx();
  R.drawStairs2D(ctx, toS, stairsEnv({ stairColor: '#0f0f0f' }));
  expect('stroke', sets(ctx, 'strokeStyle').includes('#0f0f0f'), true);
  expect('and fill', sets(ctx, 'fillStyle').includes('#0f0f0f'), true);
});

suite('drawStairs2D', 'every stair in the list is drawn, not just the first', R => {
  const ctx = recordingCtx();
  R.drawStairs2D(ctx, toS, stairsEnv({ stairs: [STAIR, { ...STAIR, start: { x: 20, y: 0, z: 0 } }] }));
  expect('two DN labels', count(ctx, 'fillText'), 2);
});

// ── drawFixture2D: fifteen kinds down one ladder ──
// The frame is the identity, so "along" and "across" arrive at toS as x and z
// and every assertion below is in plain feet.
const fixtureGeo = over => ({
  frame: { at: (along, across) => ({ x: along, z: across }) },
  alongStart: 0, alongEnd: 4, backOff: 0, frontOff: 2,
  tub: false, tubAlongStart: 0, tubAlongEnd: 5,
  center: { x: 2, z: 1 }, faucetAlong: 0.4, decks: [], wall: null,
  ...over,
});
const fixtureEnv = (over = {}, geo = {}) => ({
  fixtureGeometry: () => fixtureGeo(geo),
  FIXTURE_COLOR: '#4a6', COUNTER_OVERHANG_FT: 0.1,
  CLOSET_WALL_FT: 0.29, CLOSET_ROD_FT: 1, CLOSET_SHELF_FT: 1.5, CLOSET_CLOTHES_FT: 1.83,
  closetDoorFor: () => ({ widthFt: 2 }),
  wallCross: () => null, wallFrame: () => ({ totalFt: 0.46 }), walls: [],
  ...over,
});
const KINDS = ['cabinet', 'vanity', 'sink', 'stove', 'fridge', 'washer', 'dryer', 'dish',
  'island', 'pantry', 'closet', 'toilet', 'tub', 'shower', 'stall'];

// What a kind actually painted: the drawing operations in order, WITH their
// arguments rounded to the tenth of a pixel. An op tally alone is too coarse
// to be a picture -- a toilet and a tub both come out "one rect, one oval" and
// differ only in where they put them, so counting ops alone reported them as
// the same drawing when they are not.
const signature = (R, kind, over, geo) => {
  const ctx = recordingCtx();
  R.drawFixture2D(ctx, toS, { kind }, {}, null, fixtureEnv(over, geo));
  return ctx.tape.filter(e => e.op !== 'set').map(e => {
    const args = (e.args || []).map(a => (typeof a === 'number' ? Math.round(a * 10) / 10 : String(a)));
    return `${e.op}(${args.join(',')})`;
  }).join(' ');
};

suite('drawFixture2D', 'a fixture with no geometry paints nothing', R => {
  const ctx = recordingCtx();
  R.drawFixture2D(ctx, toS, { kind: 'sink' }, {}, null, fixtureEnv({ fixtureGeometry: () => null }));
  expect('nothing painted', ctx.tape.length, 0);
  const withGeo = recordingCtx();
  R.drawFixture2D(withGeo, toS, { kind: 'sink' }, {}, null, fixtureEnv());
  expect('but the same sink with geometry does', withGeo.tape.length > 0, true);
});

suite('drawFixture2D', 'every kind paints something', R => {
  const silent = KINDS.filter(kind => {
    const ctx = recordingCtx();
    R.drawFixture2D(ctx, toS, { kind }, {}, null, fixtureEnv());
    return !painted(ctx);
  });
  expect('no kind draws a blank', silent.join(',') || 'none', 'none');
});

// Two groups share a branch deliberately: the four appliances are one box
// that differs only by its letter, and a stall IS a shower. Those pairs are
// listed rather than asserted apart -- and listed here so that if one of them
// ever grows its own drawing, this check says so instead of quietly allowing
// it.
const SAME_BY_DESIGN = [['fridge', 'washer', 'dryer', 'dish'], ['shower', 'stall']];

suite('drawFixture2D', 'no two kinds paint the same picture, bar the ones that share a branch', R => {
  // The ladder's real risk: drop a branch and that kind silently collapses
  // onto the bare carcass every kind starts from. Equal signatures is what
  // that looks like from outside.
  const groupOf = kind => SAME_BY_DESIGN.findIndex(g => g.includes(kind));
  const seen = new Map();
  const collisions = [];
  KINDS.forEach(kind => {
    const sig = signature(R, kind);
    const prior = seen.get(sig);
    // The appliances differ by letter, so their signatures differ too; only a
    // genuinely identical drawing lands here.
    if (prior !== undefined && !(groupOf(kind) >= 0 && groupOf(kind) === groupOf(prior))) {
      collisions.push(`${prior}=${kind}`);
    } else if (prior === undefined) {
      seen.set(sig, kind);
    }
  });
  expect('each kind is distinguishable', collisions.join(', ') || 'none', 'none');
});

// The two checks below assert that two fixtures draw the SAME thing, and an
// equality holds trivially when both sides are nothing: delete the painter and
// every signature is the empty string, so `stall === shower` passes while the
// drawing is gone. That is a third species of vacuous check, distinct from the
// absence-assertions above and more deceptive -- this one reads as a strong
// structural claim.
//
// The control is a differential rather than a length threshold: the same
// signature function must also tell a stall APART from a sink. That proves it
// discriminates at all, which a "not empty" assertion does not, and it needs
// no magic number.
suite('drawFixture2D', 'a stall is drawn exactly as a shower is', R => {
  const stall = signature(R, 'stall');
  expect('the same pan, curb and drain', stall, signature(R, 'shower'));
  expect('and the signature is not blind -- a sink differs', stall === signature(R, 'sink'), false);
});

suite('drawFixture2D', 'the four appliances are one box that differs only by its letter', R => {
  const withoutLetter = kind => signature(R, kind).replace(/fillText\([^)]*\)/, 'fillText(LETTER)');
  expect('washer matches fridge', withoutLetter('washer'), withoutLetter('fridge'));
  expect('dryer matches fridge', withoutLetter('dryer'), withoutLetter('fridge'));
  expect('dishwasher matches fridge', withoutLetter('dish'), withoutLetter('fridge'));
  expect('and the box is a real box -- a sink is not one of them',
    withoutLetter('fridge') === withoutLetter('sink'), false);
});

suite('drawFixture2D', 'the four appliances carry their own letters', R => {
  const letterFor = kind => {
    const ctx = recordingCtx();
    R.drawFixture2D(ctx, toS, { kind }, {}, null, fixtureEnv());
    return calls(ctx, 'fillText').map(a => a[0]).join('');
  };
  expect('a fridge', letterFor('fridge'), 'REF');
  expect('a washer', letterFor('washer'), 'W');
  expect('a dryer', letterFor('dryer'), 'D');
  expect('a dishwasher', letterFor('dish'), 'DW');
});

suite('drawFixture2D', 'a preview is drawn faint', R => {
  const ctx = recordingCtx();
  R.drawFixture2D(ctx, toS, { kind: 'sink' }, { preview: true }, null, fixtureEnv());
  expect('faint', sets(ctx, 'globalAlpha')[0], 0.55);
  const solid = recordingCtx();
  R.drawFixture2D(solid, toS, { kind: 'sink' }, {}, null, fixtureEnv());
  expect('and a committed one is not', sets(solid, 'globalAlpha')[0], 1);
});

suite('drawFixture2D', 'the fixture wears the colour the page handed it', R => {
  const ctx = recordingCtx();
  R.drawFixture2D(ctx, toS, { kind: 'cabinet' }, {}, null, fixtureEnv({ FIXTURE_COLOR: '#123456' }));
  expect('stroked in it', sets(ctx, 'strokeStyle').includes('#123456'), true);
});

suite('drawFixture2D', 'a countertop edge runs past the cabinet face, on the front side', R => {
  const frontEdge = frontOff => {
    const ctx = recordingCtx();
    R.drawFixture2D(ctx, toS, { kind: 'cabinet' }, {}, null,
      fixtureEnv({ COUNTER_OVERHANG_FT: 0.5 }, { backOff: 0, frontOff }));
    // The counter line is the first stroked pair after the carcass rect.
    return calls(ctx, 'lineTo').map(a => a[1]);
  };
  expect('a front at +2ft puts the counter beyond it', frontEdge(2).includes(300 + 25), true);
  expect('a fixture facing the other way overhangs the other way',
    frontEdge(-2).includes(300 - 25), true);
});

suite('drawFixture2D', 'a closet door leaves a gap with a jamb line each side', R => {
  const ctx = recordingCtx();
  R.drawFixture2D(ctx, toS, { kind: 'closet' }, {}, null,
    fixtureEnv({ closetDoorFor: () => ({ widthFt: 2 }) }, { alongStart: 0, alongEnd: 4 }));
  const withDoor = count(ctx, 'stroke');
  const solid = recordingCtx();
  R.drawFixture2D(solid, toS, { kind: 'closet' }, {}, null,
    fixtureEnv({ closetDoorFor: () => null }, { alongStart: 0, alongEnd: 4 }));
  expect('a doorless closet strokes fewer times', count(solid, 'stroke') < withDoor, true);
});

suite('drawFixture2D', 'the door follows the closet width, not the space between its side walls', R => {
  // Movie's ruling: a run snugged into a crossing wall skips a side wall and
  // widens the inside, and still gets the same door.
  let askedWith = null;
  R.drawFixture2D(recordingCtx(), toS, { kind: 'closet' }, {}, null,
    fixtureEnv({ closetDoorFor: w => { askedWith = w; return { widthFt: 2 }; } },
      { alongStart: 0, alongEnd: 4 }));
  expect('asked about the full 4ft run', askedWith, 4);
});

suite('drawFixture2D', 'a side wall is skipped where the run snugs into a crossing wall', R => {
  const hostWall = { levelId: 'L1', view: 'plan' };
  const strokesWhenCrossing = crossing => {
    const ctx = recordingCtx();
    R.drawFixture2D(ctx, toS, { kind: 'closet' }, {}, null, fixtureEnv({
      walls: [hostWall, { levelId: 'L1', view: 'plan' }],
      wallCross: () => (crossing ? { s: 0.5, along: 0 } : null),
    }, { wall: hostWall, alongStart: 0, alongEnd: 4 }));
    return count(ctx, 'stroke');
  };
  expect('snugged, one side wall fewer is drawn', strokesWhenCrossing(true) < strokesWhenCrossing(false), true);
});

suite('drawFixture2D', 'a tub is drawn over its own run, not the fixture run', R => {
  const ctx = recordingCtx();
  R.drawFixture2D(ctx, toS, { kind: 'tub' }, {}, null, fixtureEnv({}, {
    tub: true, alongStart: 0, alongEnd: 4, tubAlongStart: 1, tubAlongEnd: 6,
  }));
  const xs = calls(ctx, 'moveTo').map(a => a[0]).concat(calls(ctx, 'lineTo').map(a => a[0]));
  expect('it reaches the tub end at 6ft', Math.max(...xs), 460);
  expect('and starts at the tub start, not zero', Math.min(...xs), 410);
});

// ── drawFloor2D: three modes, holes, and the garage note ──
const RECT = [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 14 }, { x: 0, z: 14 }];
const floorColors = {
  fill: 'rgba(90,90,90,0.2)', fillPreview: 'rgba(90,90,90,0.1)',
  stroke: '#345', strokePreview: '#9ab', selected: '#f60',
};
const floorEnv = over => ({
  colors: floorColors,
  surfaceOpeningsFor: () => [],
  offsetOutline: (pts, by) => pts.map(p => ({ x: p.x - by, z: p.z - by })),
  formatInchesOnly: inches => `${inches}"`,
  garageEdgeDepthIn: 12, garageEdgeTaperRunIn: 12, garageSlabThicknessIn: 4,
  ...over,
});

suite('drawFloor2D', 'a floor of one point is not a floor', R => {
  const ctx = recordingCtx();
  R.drawFloor2D(ctx, toS, { points: [{ x: 0, z: 0 }] }, {}, floorEnv());
  expect('nothing painted', ctx.tape.length, 0);
});

suite('drawFloor2D', 'a committed slab fills, strokes and grows corner handles', R => {
  const ctx = recordingCtx();
  R.drawFloor2D(ctx, toS, { points: RECT }, {}, floorEnv());
  expect('filled even-odd', calls(ctx, 'fill')[0][0], 'evenodd');
  expect('in the page fill colour', sets(ctx, 'fillStyle').includes(floorColors.fill), true);
  expect('one handle per corner', count(ctx, 'fillRect'), 4);
});

suite('drawFloor2D', 'a preview is dashed and grows no handles', R => {
  const ctx = recordingCtx();
  R.drawFloor2D(ctx, toS, { points: RECT }, { preview: true }, floorEnv());
  expect('dashed', JSON.stringify(calls(ctx, 'setLineDash')[0][0]), '[6,4]');
  expect('no handles', count(ctx, 'fillRect'), 0);
  expect('and the preview fill', sets(ctx, 'fillStyle').includes(floorColors.fillPreview), true);
});

suite('drawFloor2D', 'a selected slab is drawn heavier, in the selected colour', R => {
  const plain = recordingCtx();
  R.drawFloor2D(plain, toS, { points: RECT }, {}, floorEnv());
  const picked = recordingCtx();
  R.drawFloor2D(picked, toS, { points: RECT }, { selected: true }, floorEnv());
  expect('heavier', Math.max(...sets(picked, 'lineWidth')) > Math.max(...sets(plain, 'lineWidth')), true);
  expect('and in the selected colour', sets(picked, 'strokeStyle').includes(floorColors.selected), true);
});

suite('drawFloor2D', 'a reference floor is dashed, faint, and stops before the handles', R => {
  const ctx = recordingCtx();
  R.drawFloor2D(ctx, toS, { points: RECT, garage: true, id: 'f1' }, { referenceColor: 'rgba(1,2,3,0.5)' }, floorEnv());
  expect('no handles', count(ctx, 'fillRect'), 0);
  expect('faded to 0.08', sets(ctx, 'fillStyle').includes('rgba(1,2,3,0.08)'), true);
  expect('and no garage note, because it returns first', count(ctx, 'fillText'), 0);
});

suite('drawFloor2D', 'an opening is a hole in the fill, not a shape on top of it', R => {
  const hole = [{ x: 5, z: 5 }, { x: 9, z: 5 }, { x: 9, z: 9 }, { x: 5, z: 9 }];
  const ctx = recordingCtx();
  R.drawFloor2D(ctx, toS, { points: RECT, id: 'f1' }, {},
    floorEnv({ surfaceOpeningsFor: () => [{ points: hole }] }));
  expect('one fill for both rings', count(ctx, 'fill'), 1);
  expect('even-odd, so the hole reads as a hole', calls(ctx, 'fill')[0][0], 'evenodd');
  expect('two closed rings', count(ctx, 'closePath'), 2);
  expect('handles on the slab and on the hole', count(ctx, 'fillRect'), 8);
});

suite('drawFloor2D', 'a floor with no id is never asked for openings', R => {
  let asked = 0;
  R.drawFloor2D(recordingCtx(), toS, { points: RECT }, {},
    floorEnv({ surfaceOpeningsFor: () => { asked += 1; return []; } }));
  expect('not asked', asked, 0);
});

suite('drawFloor2D', 'a garage slab carries its pour note; a plain floor carries none', R => {
  const plain = recordingCtx();
  R.drawFloor2D(plain, toS, { points: RECT }, {}, floorEnv());
  expect('no note on a plain floor', count(plain, 'fillText'), 0);
  const garage = recordingCtx();
  R.drawFloor2D(garage, toS, { points: RECT, garage: true }, {}, floorEnv());
  expect('a garage says so', calls(garage, 'fillText')[0][0], '4" GARAGE SLAB');
});

suite('drawFloor2D', 'a sloped garage slab names the slope and where it falls to', R => {
  const ctx = recordingCtx();
  R.drawFloor2D(ctx, toS, { points: RECT, garage: true, slopeInPerFt: 1 / 8 }, {}, floorEnv());
  expect('the eighth is written as a fraction', calls(ctx, 'fillText')[0][0],
    '4" GARAGE SLAB — SLOPE 1/8"/FT TO DOOR');
});

suite('drawFloor2D', 'a thickened-edge slab reads level, and shows its taper ring', R => {
  const ctx = recordingCtx();
  R.drawFloor2D(ctx, toS, { points: RECT, garage: true, thickenedEdge: true }, {}, floorEnv());
  expect('the note says level, not sloped', calls(ctx, 'fillText')[0][0],
    '4" THICKENED-EDGE SLAB — LEVEL, 1\'-0" EDGE, 45° TAPER');
  expect('and a dashed ring is drawn inside it',
    calls(ctx, 'setLineDash').some(a => JSON.stringify(a[0]) === '[4,4]'), true);
});

// ── drawRoof2D ──
const roofEnv = over => ({
  isPrinting: false,
  surfaceOpeningsFor: () => [],
  offsetOutline: (pts, by) => pts.map(p => ({ x: p.x - by, z: p.z - by })),
  roofSkeleton: () => [],
  ...over,
});
const ROOF = { id: 'r1', points: RECT, edges: ['eave', 'eave', 'eave', 'eave'], overhang: 1 };

suite('drawRoof2D', 'a roof needs three points', R => {
  const ctx = recordingCtx();
  R.drawRoof2D(ctx, toS, { ...ROOF, points: RECT.slice(0, 2) }, {}, roofEnv());
  expect('nothing painted', ctx.tape.length, 0);
});

suite('drawRoof2D', 'a committed roof fills even-odd and dots its vertices', R => {
  const ctx = recordingCtx();
  R.drawRoof2D(ctx, toS, ROOF, {}, roofEnv());
  expect('filled even-odd', calls(ctx, 'fill')[0][0], 'evenodd');
  expect('a dot per corner', count(ctx, 'arc'), 4);
});

suite('drawRoof2D', 'a reference roof is not filled and grows no dots', R => {
  const ctx = recordingCtx();
  R.drawRoof2D(ctx, toS, ROOF, { referenceColor: '#888' }, roofEnv());
  expect('no fill', count(ctx, 'fill'), 0);
  expect('no vertex dots', count(ctx, 'arc'), 0);
  expect('drawn in the reference colour', sets(ctx, 'strokeStyle').includes('#888'), true);
});

suite('drawRoof2D', 'printing keeps the roof but drops the vertex dots', R => {
  const ctx = recordingCtx();
  R.drawRoof2D(ctx, toS, ROOF, {}, roofEnv({ isPrinting: true }));
  expect('no dots', count(ctx, 'arc'), 0);
  expect('the roof is still stroked', count(ctx, 'stroke') >= 1, true);
});

suite('drawRoof2D', 'a gable edge reads as a double line; an eave does not', R => {
  const strokesFor = edges => {
    const ctx = recordingCtx();
    R.drawRoof2D(ctx, toS, { ...ROOF, edges }, {}, roofEnv());
    return count(ctx, 'stroke');
  };
  const allEaves = strokesFor(['eave', 'eave', 'eave', 'eave']);
  expect('one gable adds its wall line', strokesFor(['gable', 'eave', 'eave', 'eave']), allEaves + 1);
  expect('two gables add two', strokesFor(['gable', 'eave', 'gable', 'eave']), allEaves + 2);
});

suite('drawRoof2D', 'with no overhang there is no second line to draw', R => {
  const ctx = recordingCtx();
  R.drawRoof2D(ctx, toS, { ...ROOF, edges: ['gable', 'eave', 'eave', 'eave'], overhang: 0 }, {}, roofEnv());
  const eaves = recordingCtx();
  R.drawRoof2D(eaves, toS, { ...ROOF, edges: ['eave', 'eave', 'eave', 'eave'], overhang: 0 }, {}, roofEnv());
  expect('a gable with no overhang draws no wall ring', count(ctx, 'stroke'), count(eaves, 'stroke'));
});

suite('drawRoof2D', 'tagging labels every edge by what it is', R => {
  const ctx = recordingCtx();
  R.drawRoof2D(ctx, toS, { ...ROOF, edges: ['gable', 'eave', 'gable', 'eave'] },
    { tagging: true }, roofEnv());
  expect('four labels', count(ctx, 'fillText'), 4);
  expect('naming each edge', calls(ctx, 'fillText').map(a => a[0]).join(','), 'GABLE,EAVE,GABLE,EAVE');
});

suite('drawRoof2D', 'a tagged reference roof is not labelled -- it is not the one being edited', R => {
  const ctx = recordingCtx();
  R.drawRoof2D(ctx, toS, ROOF, { tagging: true, referenceColor: '#888' }, roofEnv());
  expect('no labels', count(ctx, 'fillText'), 0);
});

suite('drawRoof2D', 'ridge, hip and valley guides are drawn dashed, from the skeleton', R => {
  const skeleton = [
    { a: { x: 0, z: 7 }, b: { x: 20, z: 7 } },
    { a: { x: 0, z: 0 }, b: { x: 7, z: 7 } },
  ];
  const bare = recordingCtx();
  R.drawRoof2D(bare, toS, ROOF, {}, roofEnv());
  const withGuides = recordingCtx();
  R.drawRoof2D(withGuides, toS, ROOF, {}, roofEnv({ roofSkeleton: () => skeleton }));
  expect('each guide is one more stroke', count(withGuides, 'stroke'), count(bare, 'stroke') + 2);
  expect('drawn dashed', calls(withGuides, 'setLineDash').some(a => JSON.stringify(a[0]) === '[8,5]'), true);
});

suite('drawRoof2D', 'an opening in a roof is a hole, dotted like the roof itself', R => {
  const hole = [{ x: 5, z: 5 }, { x: 9, z: 5 }, { x: 9, z: 9 }, { x: 5, z: 9 }];
  const ctx = recordingCtx();
  R.drawRoof2D(ctx, toS, ROOF, {}, roofEnv({ surfaceOpeningsFor: () => [{ points: hole }] }));
  // Vertex dots are filled too, so count the even-odd body fill on its own
  // rather than every fill on the tape.
  expect('one even-odd fill covers both rings',
    calls(ctx, 'fill').filter(a => a[0] === 'evenodd').length, 1);
  expect('roof corners and hole corners are both dotted', count(ctx, 'arc'), 8);
});

// ── drawOutlines2D: the scope colours, the marks, and the live trace ──
const OUT_COLORS = {
  boneyard: '#c33', level: '#36c',
  garageBoneyard: '#e83', garageLevel: '#93c',
  traceHouse: '#d22', traceAttached: '#28d',
};
const square = (x, z, w) => [{ x, z }, { x: x + w, z }, { x: x + w, z: z + w }, { x, z: z + w }];
const OUTLINE = { id: 'o1', points: square(0, 0, 10) };
const outlinesEnv = over => ({
  isPrinting: false,
  boneyardActive: false,
  colors: OUT_COLORS,
  outlines: [OUTLINE],
  boneyardOutlines: [],
  isSelected: () => false,
  showHandles: false,
  segmentCount: outline => outline.points.length,
  segment: (outline, i) => ({
    start: outline.points[i],
    end: outline.points[(i + 1) % outline.points.length],
  }),
  controlPoint: () => ({ x: 0, z: 0 }),
  geometryFor: () => ({ center: { x: 5, z: 0 }, ux: 1, uz: 0 }),
  label: () => '',
  activeTool: 'select', fenestrationType: 'window', snapPt: null,
  markPlacement: () => null,
  outlineDrawing: false, outlinePoints: [], outlineStart: null, outlineGarage: null,
  frozenEnd: null,
  ...over,
});

suite('drawOutlines2D', 'outlines are a working aid, not part of a print', R => {
  const ctx = recordingCtx();
  R.drawOutlines2D(ctx, toS, outlinesEnv({ isPrinting: true }));
  expect('nothing painted', ctx.tape.length, 0);
});

suite('drawOutlines2D', 'the scope colours are the red/blue all-levels language', R => {
  const strokeOn = (boneyardActive, garage) => {
    const ctx = recordingCtx();
    R.drawOutlines2D(ctx, toS, outlinesEnv({
      boneyardActive,
      outlines: [{ ...OUTLINE, garage }],
      boneyardOutlines: [{ ...OUTLINE, garage }],
    }));
    return sets(ctx, 'strokeStyle');
  };
  expect('a level edit is local, so BLUE', strokeOn(false, false).includes(OUT_COLORS.level), true);
  expect('a boneyard edit moves every level, so RED', strokeOn(true, false).includes(OUT_COLORS.boneyard), true);
  expect('a garage on a level is one shade over', strokeOn(false, true).includes(OUT_COLORS.garageLevel), true);
  expect('and on the boneyard likewise', strokeOn(true, true).includes(OUT_COLORS.garageBoneyard), true);
});

suite('drawOutlines2D', 'the boneyard shows the masters, not the level outlines', R => {
  const ctx = recordingCtx();
  let askedFor = [];
  R.drawOutlines2D(ctx, toS, outlinesEnv({
    boneyardActive: true,
    outlines: [{ ...OUTLINE, id: 'level' }],
    boneyardOutlines: [{ ...OUTLINE, id: 'master' }],
    segmentCount: outline => { askedFor.push(outline.id); return outline.points.length; },
  }));
  expect('only the master is drawn', [...new Set(askedFor)].join(','), 'master');
});

suite('drawOutlines2D', 'a half-drawn outline of one point is skipped', R => {
  const ctx = recordingCtx();
  R.drawOutlines2D(ctx, toS, outlinesEnv({ outlines: [{ id: 'o', points: [{ x: 0, z: 0 }] }] }));
  expect('nothing painted', painted(ctx), false);
});

suite('drawOutlines2D', 'a selected outline is drawn heavier', R => {
  const widthWhen = selected => {
    const ctx = recordingCtx();
    R.drawOutlines2D(ctx, toS, outlinesEnv({ isSelected: () => selected }));
    return Math.max(...sets(ctx, 'lineWidth'));
  };
  expect('heavier when picked', widthWhen(true) > widthWhen(false), true);
});

suite('drawOutlines2D', 'a bulged edge curves; a straight one does not', R => {
  const ctx = recordingCtx();
  R.drawOutlines2D(ctx, toS, outlinesEnv({
    segment: (outline, i) => ({
      start: outline.points[i],
      end: outline.points[(i + 1) % outline.points.length],
      bulge: i === 0 ? 0.4 : 0,
    }),
    controlPoint: () => ({ x: 5, z: -3 }),
  }));
  expect('one edge curves', count(ctx, 'quadraticCurveTo'), 1);
  expect('through its control point', JSON.stringify(calls(ctx, 'quadraticCurveTo')[0].slice(0, 2)), '[450,270]');
});

suite('drawOutlines2D', 'a garage outline says GARAGE on itself', R => {
  const plain = recordingCtx();
  R.drawOutlines2D(plain, toS, outlinesEnv());
  expect('a house does not', count(plain, 'fillText'), 0);
  const garage = recordingCtx();
  R.drawOutlines2D(garage, toS, outlinesEnv({ outlines: [{ ...OUTLINE, garage: true }] }));
  expect('a garage does', calls(garage, 'fillText')[0][0], 'GARAGE');
});

suite('drawOutlines2D', 'handles appear only when the page asks for them', R => {
  const handlesWhen = showHandles => {
    const ctx = recordingCtx();
    R.drawOutlines2D(ctx, toS, outlinesEnv({ showHandles }));
    return count(ctx, 'fillRect');
  };
  expect('off', handlesWhen(false), 0);
  expect('on, one per corner', handlesWhen(true), 4);
});

suite('drawOutlines2D', 'an outline carries its own fenestration marks', R => {
  const ctx = recordingCtx();
  R.drawOutlines2D(ctx, toS, outlinesEnv({
    outlines: [{ ...OUTLINE, marks: [{ widthFt: 3, type: 'door' }, { widthFt: 3, type: 'window' }] }],
  }));
  expect('both marks lettered', calls(ctx, 'fillText').map(a => a[0]).join(''), 'DW');
});

// The ghost mark under the cursor: four separate conditions gate it.
const ghostEnv = over => outlinesEnv({
  boneyardActive: true,
  boneyardOutlines: [OUTLINE],
  activeTool: 'fenestration',
  fenestrationType: 'window',
  snapPt: { x: 5, z: 0 },
  markPlacement: () => ({ edgeId: 'e0', offsetFt: 2, widthFt: 3, outline: OUTLINE }),
  ...over,
});

suite('drawOutlines2D', 'the fenestration ghost is drawn faint under the cursor', R => {
  const ctx = recordingCtx();
  R.drawOutlines2D(ctx, toS, ghostEnv());
  expect('a ghost letter', calls(ctx, 'fillText').map(a => a[0]).join(''), 'W');
  expect('drawn faint', sets(ctx, 'globalAlpha').includes(0.55), true);
  expect('and the alpha is put back', sets(ctx, 'globalAlpha').pop(), 1);
});

suite('drawOutlines2D', 'each of the ghost gates turns it off on its own', R => {
  const ghosted = over => {
    const ctx = recordingCtx();
    R.drawOutlines2D(ctx, toS, ghostEnv(over));
    return sets(ctx, 'globalAlpha').includes(0.55);
  };
  expect('off the boneyard', ghosted({ boneyardActive: false, outlines: [OUTLINE] }), false);
  expect('with another tool', ghosted({ activeTool: 'select' }), false);
  expect('placing stairs rather than an opening', ghosted({ fenestrationType: 'stairs' }), false);
  expect('with nothing under the cursor', ghosted({ snapPt: null }), false);
  expect('where the placement is refused', ghosted({ markPlacement: () => ({ error: 'no edge' }) }), false);
  expect('but on, with all five satisfied', ghosted({}), true);
});

// The live trace.
const traceEnv = over => outlinesEnv({
  outlines: [],
  outlineDrawing: true,
  outlinePoints: square(0, 0, 10).slice(0, 3),
  outlineStart: { x: 0, z: 0 },
  snapPt: { x: 12, z: 8 },
  ...over,
});

suite('drawOutlines2D', 'the trace wears its own top-bar colour, not the edit-scope one', R => {
  const traceColour = outlineGarage => {
    const ctx = recordingCtx();
    R.drawOutlines2D(ctx, toS, traceEnv({ outlineGarage }));
    return sets(ctx, 'strokeStyle');
  };
  expect('a house trace is HOUSE red', traceColour(null).includes(OUT_COLORS.traceHouse), true);
  expect('an attached garage is BLUE', traceColour('attached').includes(OUT_COLORS.traceAttached), true);
  expect('a detached one is PURPLE', traceColour('detached').includes(OUT_COLORS.garageLevel), true);
});

suite('drawOutlines2D', 'a rubber band runs from the last corner to the cursor', R => {
  const ctx = recordingCtx();
  R.drawOutlines2D(ctx, toS, traceEnv());
  expect('the band reaches the cursor', JSON.stringify(calls(ctx, 'lineTo').pop()), '[520,380]');
});

suite('drawOutlines2D', 'a frozen end wins over the cursor, so a typed length holds', R => {
  const ctx = recordingCtx();
  R.drawOutlines2D(ctx, toS, traceEnv({ frozenEnd: { x: 4, z: 0 } }));
  expect('the band goes to the frozen end', JSON.stringify(calls(ctx, 'lineTo').pop()), '[440,300]');
});

suite('drawOutlines2D', 'with no cursor at all the trace is just its placed corners', R => {
  const ctx = recordingCtx();
  R.drawOutlines2D(ctx, toS, traceEnv({ snapPt: null }));
  expect('two lines for three corners', count(ctx, 'lineTo'), 2);
});

suite('drawOutlines2D', 'a house rings its start once it can close; an attached garage also rings its end', R => {
  const rings = over => {
    const ctx = recordingCtx();
    R.drawOutlines2D(ctx, toS, traceEnv(over));
    return count(ctx, 'arc');
  };
  expect('two corners cannot close yet', rings({ outlinePoints: square(0, 0, 10).slice(0, 2) }), 0);
  expect('three corners ring the start', rings({}), 1);
  expect('an attached garage of three rings only the start', rings({ outlineGarage: 'attached' }), 1);
  expect('at four it rings its last point too, because it finishes there',
    rings({ outlineGarage: 'attached', outlinePoints: square(0, 0, 10) }), 2);
  expect('a detached garage of four still rings only the start',
    rings({ outlineGarage: 'detached', outlinePoints: square(0, 0, 10) }), 1);
});

// ── drawWallSeg2D: the assembly, the reference line, and the two modes ──
// The real wall table, not a stub: an ICF's three layers and a stud wall's
// one are the thing being drawn, so inventing a table here would test the
// invention. wall-types.js reads nothing but its own window slot.
const WALL_TYPES = (() => {
  const w = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'wall-types.js'), 'utf8'))(w);
  return w.DraftWallTypes.WALL_TYPES;
})();
const wallEnv = { wallTypes: WALL_TYPES };
const WALL = { start: { x: 0, z: 0 }, end: { x: 10, z: 0 } };
const typeOf = id => WALL_TYPES.find(w => w.id === id);

suite('drawWallSeg2D', 'a wall with no length is not drawn', R => {
  const ctx = recordingCtx();
  R.drawWallSeg2D(ctx, toS, { start: { x: 5, z: 5 }, end: { x: 5, z: 5 } }, false, null, null, wallEnv);
  expect('nothing painted', ctx.tape.length, 0);
});

suite('drawWallSeg2D', 'an unknown wall type falls back to the 2x6 stud wall', R => {
  const spanOf = wallType => {
    const ctx = recordingCtx();
    R.drawWallSeg2D(ctx, toS, { ...WALL, wallType }, false, null, null, wallEnv);
    const { min, max } = spanY(ctx);
    return max - min;
  };
  expect('a wall type nobody defined is drawn as the default',
    spanOf('no_such_wall'), spanOf('stud_2x6'));
  expect('and that default is the second entry, not the first',
    spanOf('no_such_wall') === spanOf('stud_2x4'), false);
});

suite('drawWallSeg2D', 'the assembly is drawn its own thickness wide', R => {
  const spanOf = wallType => {
    const ctx = recordingCtx();
    R.drawWallSeg2D(ctx, toS, { ...WALL, wallType }, false, null, null, wallEnv);
    const { min, max } = spanY(ctx);
    return Math.round((max - min) * 100) / 100;
  };
  // 10 screen px per foot, so inches/12*10 px.
  expect('a 2x4 is 3.5in wide', spanOf('stud_2x4'), Math.round(3.5 / 12 * 10 * 100) / 100);
  expect('an ICF is 11.25in wide', spanOf('icf'), Math.round(11.25 / 12 * 10 * 100) / 100);
});

suite('drawWallSeg2D', 'the reference line says which side of the drawn line the wall fills', R => {
  const bandFor = refLine => {
    const ctx = recordingCtx();
    R.drawWallSeg2D(ctx, toS, { ...WALL, wallType: 'concrete_8', refLine }, false, null, null, wallEnv);
    return spanY(ctx);
  };
  // The drawn line runs along z=0, which projects to y=300.
  const left = bandFor('left'), right = bandFor('right'), centre = bandFor('center');
  // 'left' means the drawn line is the exterior left face and the body fills
  // to +perp, which for a wall running east is the LOW screen-y edge. Reading
  // that the other way round failed this check against correct code.
  expect('left-referenced, the line IS the face the body grows from', left.min, 300);
  expect('right-referenced, the body grows the other way', right.max, 300);
  expect('centred, the line is in the middle', Math.round((centre.min + centre.max) / 2), 300);
  expect('and all three are the same thickness',
    Math.round(left.max - left.min), Math.round(right.max - right.min));
});

suite('drawWallSeg2D', 'every layer edge is drawn, so a three-layer wall has four', R => {
  // Counted on the boundary pass: the hatch inside each layer strokes too,
  // and counting those made an ICF look like five extra boundaries.
  const edgesFor = wallType => {
    const ctx = recordingCtx();
    R.drawWallSeg2D(ctx, toS, { ...WALL, wallType }, false, null, null, wallEnv);
    const lines = boundaryPass(ctx).tape.filter(e => e.op === 'lineTo');
    // Two of them are the end caps; the rest are layer boundaries.
    return lines.length - 2;
  };
  expect('a one-layer wall has two faces', edgesFor('stud_2x6'), 2);
  expect('a three-layer ICF has four', edgesFor('icf'), 4);
  expect('and an insulated wall likewise', edgesFor('insulation_6'),
    typeOf('insulation_6').layers.length + 1);
});

suite('drawWallSeg2D', 'fill mode stops before the black boundary lines', R => {
  const full = recordingCtx();
  R.drawWallSeg2D(full, toS, { ...WALL, wallType: 'icf' }, false, null, null, wallEnv);
  const filled = recordingCtx();
  R.drawWallSeg2D(filled, toS, { ...WALL, wallType: 'icf' }, false, null, 'fill', wallEnv);
  expect('the full pass draws the ink', sets(full, 'strokeStyle').includes('#1d1f20'), true);
  expect('fill mode does not', sets(filled, 'strokeStyle').includes('#1d1f20'), false);
  expect('and it draws no endpoint dots either', count(filled, 'arc'), 0);
});

suite('drawWallSeg2D', 'stroke mode draws the lines without the layer fills', R => {
  const stroked = recordingCtx();
  R.drawWallSeg2D(stroked, toS, { ...WALL, wallType: 'concrete_8' }, false, null, 'stroke', wallEnv);
  const full = recordingCtx();
  R.drawWallSeg2D(full, toS, { ...WALL, wallType: 'concrete_8' }, false, null, null, wallEnv);
  expect('the full pass fills the concrete', count(full, 'fill') > count(stroked, 'fill'), true);
  expect('stroke mode still draws the boundaries', sets(stroked, 'strokeStyle').includes('#1d1f20'), true);
});

suite('drawWallSeg2D', 'each layer material is filled in its own colour', R => {
  const ctx = recordingCtx();
  R.drawWallSeg2D(ctx, toS, { ...WALL, wallType: 'icf' }, false, null, null, wallEnv);
  const fills = sets(ctx, 'fillStyle');
  expect('concrete grey', fills.some(f => String(f).startsWith('rgba(182,182,182')), true);
  expect('insulation blue', fills.some(f => String(f).startsWith('rgba(205,228,248')), true);
});

suite('drawWallSeg2D', 'a stud bay is white, not tinted, so it reads as a cavity', R => {
  const ctx = recordingCtx();
  R.drawWallSeg2D(ctx, toS, { ...WALL, wallType: 'stud_2x6' }, false, null, null, wallEnv);
  expect('white', sets(ctx, 'fillStyle').includes('#ffffff'), true);
});

suite('drawWallSeg2D', 'a preview is faint and carries no endpoint dots', R => {
  const preview = recordingCtx();
  R.drawWallSeg2D(preview, toS, { ...WALL, wallType: 'stud_2x6' }, true, null, null, wallEnv);
  expect('no dots', count(preview, 'arc'), 0);
  expect('and the ink is faint', sets(preview, 'strokeStyle').includes('rgba(29,31,32,0.45)'), true);
});

suite('drawWallSeg2D', 'a committed wall dots both ends of its centreline', R => {
  const ctx = recordingCtx();
  R.drawWallSeg2D(ctx, toS, { ...WALL, wallType: 'stud_2x6' }, false, null, null, wallEnv);
  expect('two dots', count(ctx, 'arc'), 2);
  const centres = calls(ctx, 'arc').map(a => `${a[0]},${a[1]}`).join(' ');
  expect('one on each end, on the drawn line', centres, '400,300 500,300');
});

suite('drawWallSeg2D', 'an unjoined wall is capped at both ends', R => {
  const ctx = recordingCtx();
  R.drawWallSeg2D(ctx, toS, { ...WALL, wallType: 'stud_2x6' }, false, null, null, wallEnv);
  // Both caps run across the assembly at x=400 and x=500 respectively.
  const across = calls(ctx, 'moveTo').filter((a, i) => calls(ctx, 'lineTo')[i]
    && calls(ctx, 'lineTo')[i][0] === a[0]);
  expect('two end caps', across.length >= 2, true);
});

// ── drawWallSeg2D's two colours: the skin this painter used to ignore ──
//
// The night page is '#1d1f20' and so was the hardcoded boundary line.
// Contrast 1.00 -- an end cap crossing bare paper was drawn in invisible ink,
// and the wall read as a bare white slab on a black page. These checks are
// what makes the pair a decision the CALLER owns.
//
// The three suites above -- white stud bay, faint preview ink, dotted ends --
// pass `wallEnv`, which carries no colours at all. They are therefore already
// the fallback checks, and they are left exactly as they were on purpose: the
// fallbacks ARE the old literals, so an untouched check still passing is the
// evidence that the day skin did not move.
const wallSkin = {
  ...wallEnv,
  colors: {
    wall: '#112233', wallPreview: '#445566',
    wallEdge: '#778899', wallEdgePreview: '#aabbcc',
  },
};

suite('drawWallSeg2D', 'the body and the boundary take their colours from the env', R => {
  const ctx = recordingCtx();
  R.drawWallSeg2D(ctx, toS, { ...WALL, wallType: 'stud_2x6' }, false, null, null, wallSkin);
  expect('the stud bay is filled with draw-wall', sets(ctx, 'fillStyle').includes('#112233'), true);
  expect('the boundary is stroked with draw-wall-edge', sets(ctx, 'strokeStyle').includes('#778899'), true);
  expect('and the white literal is gone', sets(ctx, 'fillStyle').includes('#ffffff'), false);
  expect('as is the black one', sets(ctx, 'strokeStyle').includes('#1d1f20'), false);
});

suite('drawWallSeg2D', 'a preview takes the preview pair, not the committed one', R => {
  const ctx = recordingCtx();
  R.drawWallSeg2D(ctx, toS, { ...WALL, wallType: 'stud_2x6' }, true, null, null, wallSkin);
  expect('faint body', sets(ctx, 'fillStyle').includes('#445566'), true);
  expect('faint boundary', sets(ctx, 'strokeStyle').includes('#aabbcc'), true);
  expect('the committed body is not used', sets(ctx, 'fillStyle').includes('#112233'), false);
});

// The dots sit ON the wall body, so they must follow the line, not the poche.
// Under the night skin the body is nearly the page and the line is nearly the
// ink: take the wrong one and both dots vanish into the wall they mark.
suite('drawWallSeg2D', 'the endpoint dots follow the edge colour, not the body', R => {
  const ctx = recordingCtx();
  R.drawWallSeg2D(ctx, toS, { ...WALL, wallType: 'stud_2x6' }, false, null, null, wallSkin);
  const fills = sets(ctx, 'fillStyle');
  expect('two dots drawn', count(ctx, 'arc'), 2);
  expect('the last fill set is the edge colour', fills[fills.length - 1], '#778899');
});

// ── drawWallSeg2D's joins: the half of the painter nothing reached ──
// THIS PATH RUNS ON EVERY COMMITTED WALL IN THE LIVE PAGE. Do not delete it.
//
// MODEL.dc.html passes real joins at 6520/6521 and 6726/6727 -- every
// committed wall, twice each, fill and stroke. joins = null appears only at
// 6728 and 6731, the pending wall chain and the preview segment, so butted
// ends are the exception for in-progress geometry rather than the rule.
//
// An earlier version of this comment had that backwards, and said the path
// was unreachable. The measurement behind it was right and the conclusion
// inverted: the checks above passed null too, so deleting mitring outright
// left all 244 assertions passing. What that measured was the blindness of
// the tests, NOT that the code was dormant -- and a comment claiming dormancy
// is how live code gets deleted on a green suite. The most-used painter's
// most intricate branch was exercised on every wall in production with
// nothing testing it, which is the paintNote shape one level up.
//
// joins is a Map keyed by the shared POINT OBJECT, and the painter compares
// with ===, so two segments must literally share one endpoint object.
const joined = (type, extra) => {
  const P0 = { x: 0, z: 0 }, P1 = { x: 10, z: 0 }, P2 = { x: 10, z: 10 };
  const a = { start: P0, end: P1, wallType: 'stud_2x6' };
  const b = { start: P1, end: P2, wallType: 'stud_2x6' };
  const join = type === 'tee'
    ? { type: 'tee', host: [{ seg: b, at: 'start' }], stem: { seg: a, at: 'end' }, entries: [] }
    : { type, entries: [{ seg: a, at: 'end' }, { seg: b, at: 'start' }] };
  return { a, b, P1, joins: new Map([[P1, { ...join, ...extra }]]) };
};
const endGeometry = (R, seg, joins) => {
  const ctx = recordingCtx();
  R.drawWallSeg2D(ctx, toS, seg, false, joins, null, wallEnv);
  return boundaryPass(ctx).tape
    .filter(e => e.op === 'moveTo' || e.op === 'lineTo')
    .map(e => `${Math.round(e.args[0] * 10) / 10},${Math.round(e.args[1] * 10) / 10}`);
};

suite('drawWallSeg2D', 'a corner join mitres the end instead of capping it square', R => {
  const { a, joins } = joined('miter');
  const butted = endGeometry(R, a, null);
  const mitred = endGeometry(R, a, joins);
  expect('the drawn geometry changes', butted.join(' ') === mitred.join(' '), false);
  // A square cap puts every point at the shared end on one x; a mitre does not.
  const atEnd = xs => xs.filter(p => Number(p.split(',')[0]) >= 499).length;
  expect('the butted wall ends square on the vertex', atEnd(butted) > 0, true);
  expect('the mitred one runs past it on one face', mitred.some(p => Number(p.split(',')[0]) > 500), true);
});

suite('drawWallSeg2D', 'a resolved join suppresses the end cap; an unresolved one keeps it', R => {
  const { a, joins } = joined('miter');
  const capped = endGeometry(R, a, null).length;
  const resolved = endGeometry(R, a, joins).length;
  expect('the mitred end drops its cap line', resolved < capped, true);
});

suite('drawWallSeg2D', 'an unrecognised join type falls through to mitring', R => {
  // The painter branches on tee / continuation / multi / none and lets
  // everything else mitre. That tolerance is load-bearing -- _wallJoins emits
  // `miter` and the painter never names it -- but it also means a MISSPELLED
  // or invented type mitres silently. It hid a wrong type name in this very
  // file, and in DEFINITIONS, for half a day. Pinned so the behaviour is a
  // decision rather than an accident.
  const { a, joins } = joined('miter');
  const { a: a2, joins: j2 } = joined('corner');   // a kind nothing produces
  expect('the invented kind is drawn exactly as a miter',
    endGeometry(R, a2, j2).join(' '), endGeometry(R, a, joins).join(' '));
});

suite('drawWallSeg2D', 'a join of type none is no join at all', R => {
  const { a, joins } = joined('none');
  expect('drawn exactly as an unjoined wall', endGeometry(R, a, joins).join(' '), endGeometry(R, a, null).join(' '));
});

suite('drawWallSeg2D', 'a join naming other segments entirely is ignored', R => {
  const { a, P1 } = joined('miter');
  const stranger = { start: { x: 50, z: 50 }, end: { x: 60, z: 50 }, wallType: 'stud_2x6' };
  const joins = new Map([[P1, { type: 'miter', entries: [{ seg: stranger, at: 'start' }] }]]);
  expect('and the wall is capped as before',
    endGeometry(R, a, joins).join(' '), endGeometry(R, a, null).join(' '));
});

// A continuation is COLLINEAR -- one wall carrying on into the next. Built
// with a perpendicular peer it is not a continuation at all, and asserting
// against that fixture failed against correct code.
const collinear = (peerType = 'stud_2x6') => {
  const P0 = { x: 0, z: 0 }, P1 = { x: 10, z: 0 }, P2 = { x: 20, z: 0 };
  const a = { start: P0, end: P1, wallType: 'stud_2x6' };
  const b = { start: P1, end: P2, wallType: peerType };
  return {
    a,
    joins: new Map([[P1, {
      type: 'continuation',
      entries: [{ seg: a, at: 'end' }, { seg: b, at: 'start' }],
    }]]),
  };
};

suite('drawWallSeg2D', 'a continuation into an equal wall is seamless -- no cap, no transition', R => {
  const { a, joins } = collinear();
  const capped = endGeometry(R, a, null);
  const continued = endGeometry(R, a, joins);
  expect('the cap is gone', continued.length < capped.length, true);
  expect('and nothing is drawn past the vertex',
    continued.every(p => Number(p.split(',')[0]) <= 500), true);
});

suite('drawWallSeg2D', 'a continuation into a THICKER wall shows only the face transition', R => {
  // The documented case: a full cap would cut through the other wall, and no
  // transition at all would leave the wider profile hanging open.
  const { a, joins } = collinear('icf');
  const seamless = endGeometry(R, collinear().a, collinear().joins);
  const stepped = endGeometry(R, a, joins);
  expect('a step is drawn where the equal join drew nothing', stepped.length > seamless.length, true);
  expect('and it reaches the thicker wall\'s face', stepped.some(p => {
    const y = Number(p.split(',')[1]);
    return Math.abs(y - 300) > (5.5 / 12 * 10) / 2 + 0.01;
  }), true);
});

suite('drawWallSeg2D', 'a tee resolves for the host and clips the stem to its face', R => {
  const { a, b, joins } = joined('tee');
  const hostGeom = endGeometry(R, b, joins);
  const stemGeom = endGeometry(R, a, joins);
  expect('the host loses no geometry to the stem', hostGeom.length > 0, true);
  expect('the stem is drawn differently from an unjoined wall',
    stemGeom.join(' ') === endGeometry(R, a, null).join(' '), false);
});

suite('drawWallSeg2D', 'a mitre longer than the limit falls back to a square cap', R => {
  // Two nearly collinear walls: the mitre spike runs away, and the painter
  // refuses it past 8x the thicker assembly rather than drawing a spear.
  const P0 = { x: 0, z: 0 }, P1 = { x: 10, z: 0 }, P2 = { x: 20, z: 0.0005 };
  const a = { start: P0, end: P1, wallType: 'stud_2x6' };
  const b = { start: P1, end: P2, wallType: 'stud_2x6' };
  const joins = new Map([[P1, { type: 'miter', entries: [{ seg: a, at: 'end' }, { seg: b, at: 'start' }] }]]);
  const drawn = endGeometry(R, a, joins);
  expect('nothing runs off to infinity',
    drawn.every(p => Math.abs(Number(p.split(',')[0])) < 1000), true);
});

// ── drawCutMarks2D / drawCutPreview2D ──
// Lifted out of _drawCuts2D, which was four unrelated things in one function:
// the cuts, the elevation-mark grab handles, the turtle, and TOY MODE's grip
// tabs -- two of them clearing and rebuilding hit regions on the same
// traversal. Only the cuts came; hit-region building is component state and
// does not belong in a module whose contract forbids it.
const CUT = {
  id: 1, name: 'S1', elev: 0, auto: false,
  startPt: { x: 0, z: 0 }, endPt: { x: 20, z: 0 }, dirVec: { x: 0, z: -1 },
};
const cutEnv = over => ({
  bubbleStyle: 'tucked',
  lineSpan: (start, end) => ({ start, end }),
  autoCuts: [],
  cuts: [CUT],
  ...over,
});

suite('drawCutMarks2D', 'no cuts, nothing painted', R => {
  const ctx = recordingCtx();
  R.drawCutMarks2D(ctx, toS, cutEnv({ cuts: [] }));
  expect('nothing on the tape but the save/restore pair', painted(ctx), false);
});

suite('drawCutMarks2D', 'a cut is a dashed line with a bubble at each end', R => {
  const ctx = recordingCtx();
  R.drawCutMarks2D(ctx, toS, cutEnv());
  expect('the line is dashed', calls(ctx, 'setLineDash').some(a => JSON.stringify(a[0]) === '[8,5]'), true);
  expect('two bubbles', count(ctx, 'arc'), 2);
  expect('each labelled with the cut name', calls(ctx, 'fillText').map(a => a[0]).join(','), 'S1,S1');
});

suite('drawCutMarks2D', 'hairlines land on the half-pixel grid', R => {
  const ctx = recordingCtx();
  R.drawCutMarks2D(ctx, toS, cutEnv());
  // The dashed run is the first moveTo/lineTo pair; both must sit on .5 so the
  // dashes stay crisp instead of antialiasing into two washed-out rows.
  const first = calls(ctx, 'moveTo')[0];
  expect('x on the half pixel', Math.abs(first[0] % 1), 0.5);
  expect('y on the half pixel', Math.abs(first[1] % 1), 0.5);
});

suite('drawCutMarks2D', 'a hand-placed cut runs clear across the plan; a standard elevation keeps its ends', R => {
  let askedFor = 0;
  R.drawCutMarks2D(recordingCtx(), toS, cutEnv({
    lineSpan: (start, end) => { askedFor += 1; return { start, end }; },
  }));
  expect('the span is asked for', askedFor, 1);
  askedFor = 0;
  R.drawCutMarks2D(recordingCtx(), toS, cutEnv({
    cuts: [], autoCuts: [{ ...CUT, auto: true }],
    lineSpan: () => { askedFor += 1; return { start: CUT.startPt, end: CUT.endPt }; },
  }));
  expect('and never for a standard elevation', askedFor, 0);
});

suite('drawCutMarks2D', 'the office picks the triangle style, and the two differ', R => {
  const shapeOf = bubbleStyle => {
    const ctx = recordingCtx();
    R.drawCutMarks2D(ctx, toS, cutEnv({ bubbleStyle }));
    return ctx.tape.filter(e => e.op !== 'set').map(e => e.op).join(' ');
  };
  expect('tucked and proud paint differently', shapeOf('tucked') === shapeOf('proud'), false);
});

suite('drawCutMarks2D', 'a long name shrinks to fit rather than growing the bubble', R => {
  const fontFor = name => {
    const ctx = recordingCtx();
    R.drawCutMarks2D(ctx, toS, cutEnv({ cuts: [{ ...CUT, name }] }));
    return sets(ctx, 'font').pop();
  };
  const short = fontFor('S1');
  const long = fontFor('SECTION-THROUGH-STAIR');
  expect('the long name is set smaller', short === long, false);
  expect('and never below the 5px floor',
    Number(long.match(/(\d+(?:\.\d+)?)px/)[1]) >= 5, true);
});

suite('drawCutMarks2D', 'the painter cleans up after itself', R => {
  const ctx = recordingCtx();
  R.drawCutMarks2D(ctx, toS, cutEnv());
  expect('saves and restores in pairs', count(ctx, 'save'), count(ctx, 'restore'));
  expect('and leaves no dash pattern running',
    JSON.stringify(calls(ctx, 'setLineDash').pop()[0]), '[]');
});

// ── the cut being placed ──
const previewEnv = over => ({
  phase: 'placing', cutStart: { x: 0, z: 0 }, cutEnd: null,
  snapPt: { x: 10, z: 0 }, drawElev: 0,
  dirLeft: null, dirRight: null, hoverSide: null,
  ...over,
});

suite('drawCutPreview2D', 'idle paints nothing', R => {
  const ctx = recordingCtx();
  R.drawCutPreview2D(ctx, toS, previewEnv({ phase: 'idle' }));
  expect('nothing painted', painted(ctx), false);
});

suite('drawCutPreview2D', 'no start point, nothing to rubber-band from', R => {
  const ctx = recordingCtx();
  R.drawCutPreview2D(ctx, toS, previewEnv({ cutStart: null }));
  expect('nothing painted', painted(ctx), false);
});

suite('drawCutPreview2D', 'while placing, the band follows the cursor', R => {
  const ctx = recordingCtx();
  R.drawCutPreview2D(ctx, toS, previewEnv({ snapPt: { x: 10, z: 0 } }));
  expect('a dashed band', calls(ctx, 'setLineDash').some(a => JSON.stringify(a[0]) === '[8,5]'), true);
  expect('reaching the cursor', calls(ctx, 'lineTo')[0][0], 500.5);
});

suite('drawCutPreview2D', 'once placed, it holds the committed end instead of the cursor', R => {
  const ctx = recordingCtx();
  R.drawCutPreview2D(ctx, toS, previewEnv({
    phase: 'choosing', cutEnd: { x: 6, z: 0 }, snapPt: { x: 99, z: 0 },
  }));
  expect('the band ends at the committed point, not the cursor', calls(ctx, 'lineTo')[0][0], 460.5);
});

suite('drawCutPreview2D', 'choosing offers one bubble per side, and the cursor side glows', R => {
  const ctx = recordingCtx();
  R.drawCutPreview2D(ctx, toS, previewEnv({
    phase: 'choosing', cutEnd: { x: 10, z: 0 },
    dirLeft: { x: 0, z: -1 }, dirRight: { x: 0, z: 1 }, hoverSide: 'left',
  }));
  expect('two choice bubbles', count(ctx, 'arc'), 2);
  const inks = sets(ctx, 'strokeStyle');
  expect('the hovered side is hot', inks.includes('#ff3366'), true);
  expect('the other is not', inks.includes('#994466'), true);
});

suite('drawCutPreview2D', 'no directions offered means no bubbles, just the band', R => {
  const ctx = recordingCtx();
  R.drawCutPreview2D(ctx, toS, previewEnv({ phase: 'choosing', cutEnd: { x: 10, z: 0 } }));
  expect('no bubbles', count(ctx, 'arc'), 0);
  expect('but the band is drawn', count(ctx, 'stroke') >= 1, true);
});

// ─── Running ──────────────────────────────────────────────────────────────
let current = null;
function expect(label, got, want) {
  current.ran += 1;
  const ok = Object.is(got, want) || (typeof got === 'object' && got === want);
  if (!ok) {
    current.failed += 1;
    current.messages.push(`       ${label}\n         got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}

function runAll(R) {
  const results = [];
  for (const s of SUITES) {
    current = { ran: 0, failed: 0, messages: [] };
    let threw = null;
    try { s.fn(R); } catch (e) { threw = e; }
    results.push({ ...s, ...current, threw });
  }
  return results;
}

function report(results) {
  let ran = 0, failed = 0;
  let painter = null;
  for (const r of results) {
    if (r.painter !== painter) { painter = r.painter; console.log(`\n${painter}`); }
    ran += r.ran;
    const bad = r.failed || r.threw;
    failed += r.failed + (r.threw ? 1 : 0);
    console.log(`  ${bad ? 'FAIL' : 'ok  '}  ${r.name}`);
    r.messages.forEach(m => console.log(m));
    if (r.threw) console.log(`       threw ${r.threw.constructor.name}: ${r.threw.message}`);
  }
  console.log(`\n${ran - failed}/${ran} assertions passed across ${results.length} checks`);
  return failed;
}

// The mutation table. One column that matters: does anything notice?
function coverage() {
  const painters = [...new Set(SUITES.map(s => s.painter))];
  const all = Object.keys(load()).sort();
  console.log('painter                  checks  no-op noticed by');
  console.log('─'.repeat(72));
  for (const name of all) {
    const mine = SUITES.filter(s => s.painter === name);
    let verdict;
    let survivors = [];
    if (!mine.length) {
      verdict = 'NOTHING — no checks here';
    } else {
      // Counted over every suite, not just this painter's own: a no-op also
      // breaks the checks of a painter that calls it, and that is real
      // coverage. drawNoteScreen2D is caught by drawStairNotes2D this way.
      const caught = runAll(load(noop(name))).filter(r => r.failed || r.threw);
      const own = caught.filter(r => r.painter === name).length;
      const viaCallers = caught.length - own;
      verdict = caught.length
        ? `${own}/${mine.length} own${viaCallers ? `, +${viaCallers} via callers` : ''}`
        : 'NOTHING — its own checks pass without it';
      // NAME the survivors, don't just count them. "8/11 own" is a number
      // nobody can act on: it says three checks pass without the painter but
      // not which three, so the first thing any reader does is recompute by
      // hand what this loop already knew and threw away. Some survivors are
      // fine -- a refusal check SHOULD pass when nothing is drawn -- and the
      // only way to tell those from a real gap is to read their names.
      const caughtOwn = new Set(caught.filter(r => r.painter === name).map(r => r.name));
      survivors = mine.filter(s => !caughtOwn.has(s.name)).map(s => s.name);
    }
    console.log(`${name.padEnd(24)} ${String(mine.length).padStart(6)}  ${verdict}`);
    for (const s of survivors) console.log(`${' '.repeat(34)}· ${s}`);
  }
  console.log('\nbranch mutations');
  console.log('─'.repeat(72));
  let missed = 0;
  const BRANCH_MUTATIONS = [
    ['strokeSegPath2D bulge branch', dropBulge],
    ['drawWallSeg2D mitre path', dropMitre],
    ['drawOrigin2D env colour', dropOriginEnvColour],
    ['drawOrigin2D colour fallback', dropOriginFallback],
    ['drawFixture2D kind dispatch (constant painter)', constantFixture],
    ['drawWallSeg2D env colours', dropWallEnvColours],
    ['drawWallSeg2D colour fallbacks', dropWallColourFallback],
    ['drawWallSeg2D dots take the body colour', wallDotsTakeTheFill],
  ];
  BRANCH_MUTATIONS.forEach(([label, mutate]) => {
    const caught = runAll(load(mutate)).filter(r => r.failed || r.threw);
    if (!caught.length) missed += 1;
    console.log(`${(label + ' deleted').padEnd(56)} ${caught.length ? `caught by ${caught.length} check(s)` : 'NOTHING NOTICED'}`);
  });
  // SAY the all-caught state, don't leave it to be inferred. Every row here
  // reads "caught by N check(s)" when things are well, so a healthy run is
  // signalled only by the ABSENCE of the word NOTHING -- the reader has to
  // scan for something that is not there, and a row quietly dropped from the
  // list above looks exactly like a row that passed. The other two harnesses
  // print their total; this one did not. Same shape as the checks this file
  // exists to catch, one level up in the reporting. (Skipper's catch.)
  console.log(`\n${BRANCH_MUTATIONS.length - missed}/${BRANCH_MUTATIONS.length} branch mutations caught`);
  // This one GATES, it does not merely report. Skipper caught that the line
  // printed "16/17 -- MISSING: drawGrid2D" and still exited 0: the mutation
  // count drove the status and the painter count did not. A warning that
  // cannot fail is the thing this whole file exists to catch -- it would have
  // scrolled past in a log and the run would have stayed green.
  //
  // `all` is every export, not a curated list, and that is deliberate: the
  // module's convention is that helpers stay at module scope (cutSnap,
  // cutDashedSeg and cutChoiceMark are not exported for exactly this reason).
  // So an export with no checks is either a painter nobody tested or a
  // convention being broken, and both are worth stopping for.
  //
  // Note this gates --coverage only. CI should run the PLAIN mode, which is
  // unaffected, so adding a painter before its checks does not block anyone
  // mid-work; only a run that explicitly asks "is the coverage complete?"
  // gets a non-zero answer, which is the honest reply to that question.
  const unchecked = all.filter(name => !SUITES.some(s => s.painter === name));
  console.log(`${all.length - unchecked.length}/${all.length} painters have checks`
    + (unchecked.length ? ` -- MISSING: ${unchecked.join(', ')}` : ''));
  return missed || unchecked.length ? 1 : 0;
}

if (MUTATION_MODE) {
  process.exit(coverage());
} else {
  process.exit(report(runAll(load())) ? 1 : 0);
}
