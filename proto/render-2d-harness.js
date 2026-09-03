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
      const results = runAll(load(noop(name)));
      const caught = results.filter(r => r.failed || r.threw);
      verdict = caught.length ? `${caught.length}/${mine.length} checks` : 'NOTHING — checks pass without it';
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
