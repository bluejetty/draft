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

// ─── The recording ctx ────────────────────────────────────────────────────
// A canvas context is a big surface and the painters use a lot of it, so this
// records through a Proxy rather than enumerating methods: any call lands on
// the tape as { op, args }, any assignment as { op: 'set', prop, value }.
//
// Two things it cannot fake away. measureText must return a width or every
// painter that centres a label divides by undefined -- it returns a
// proportional stand-in, so tests may assert that a box is drawn around the
// text but never its exact pixel width. And drawing state that a painter
// reads back must have a plausible default, hence the seeded values.
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

// ── drawUnderlays2D: four separate refusals ──
const underlayEnv = over => ({
  isPrinting: false,
  activeLevel: { id: 'L1' },
  underlays: [{ id: 'u1', levelId: 'L1', x: 0, z: 0, widthFt: 20, heightFt: 14, opacity: 0.5 }],
  imageFor: () => ({ tag: 'image' }),
  ...over,
});

suite('drawUnderlays2D', 'a printing page draws no underlay', R => {
  const ctx = recordingCtx();
  R.drawUnderlays2D(ctx, toS, underlayEnv({ isPrinting: true }));
  expect('nothing is painted', ctx.tape.length, 0);
});

suite('drawUnderlays2D', 'an underlay belonging to another level is skipped', R => {
  const ctx = recordingCtx();
  R.drawUnderlays2D(ctx, toS, underlayEnv({ activeLevel: { id: 'L2' } }));
  expect('nothing is drawn', count(ctx, 'drawImage'), 0);
});

suite('drawUnderlays2D', 'an underlay whose image has not loaded is skipped', R => {
  const ctx = recordingCtx();
  R.drawUnderlays2D(ctx, toS, underlayEnv({ imageFor: () => null }));
  expect('nothing is drawn', count(ctx, 'drawImage'), 0);
});

suite('drawUnderlays2D', 'a sub-pixel underlay is skipped rather than drawn as a smear', R => {
  const ctx = recordingCtx();
  R.drawUnderlays2D(ctx, toS, underlayEnv({
    underlays: [{ id: 'u1', levelId: 'L1', x: 0, z: 0, widthFt: 0.05, heightFt: 0.05, opacity: 1 }],
  }));
  expect('nothing is drawn', count(ctx, 'drawImage'), 0);
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

suite('drawStairs2D', 'a hidden layer paints nothing', R => {
  const ctx = recordingCtx();
  R.drawStairs2D(ctx, toS, stairsEnv({ layer: { visible: false, printable: true } }));
  expect('nothing painted', ctx.tape.length, 0);
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
  const ctx = recordingCtx();
  R.drawStairs2D(ctx, toS, stairsEnv({ stairs: [] }));
  expect('nothing painted', ctx.tape.length, 0);
});

suite('drawStairs2D', 'a run draws two stringers and one tread line per tread, nosing included', R => {
  const ctx = recordingCtx();
  R.drawStairs2D(ctx, toS, stairsEnv({}, { runs: [{ start: { x: 0, z: 0 }, dir: { x: 1, z: 0 }, lenFt: 10, treads: 13 }] }));
  // Stringers are one path of two lines; treads are one path of treads+1.
  expect('14 tread lines for 13 treads', count(ctx, 'lineTo') >= 14, true);
  expect('the run is stroked', count(ctx, 'stroke') >= 2, true);
});

suite('drawStairs2D', 'a run shorter than a pixel is skipped rather than drawn as a dot', R => {
  const ctx = recordingCtx();
  R.drawStairs2D(ctx, toS, stairsEnv({}, {
    runs: [{ start: { x: 0, z: 0 }, dir: { x: 1, z: 0 }, lenFt: 0.01, treads: 0 }],
    walk: [{ x: 0, z: 0 }, { x: 0.02, z: 0 }],
  }));
  expect('no stringers for it', calls(ctx, 'lineTo').length < 6, true);
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
    }
    console.log(`${name.padEnd(24)} ${String(mine.length).padStart(6)}  ${verdict}`);
  }
  console.log('\nbranch mutations');
  console.log('─'.repeat(72));
  const branchResults = runAll(load(dropBulge));
  const caught = branchResults.filter(r => r.failed || r.threw);
  console.log(`strokeSegPath2D bulge branch deleted     ${caught.length ? `caught by ${caught.length} check(s): ${caught.map(c => c.name).join('; ')}` : 'NOTHING NOTICED'}`);
  return caught.length ? 0 : 1;
}

if (process.argv.includes('--coverage')) {
  process.exit(coverage());
} else {
  process.exit(report(runAll(load())) ? 1 : 0);
}
