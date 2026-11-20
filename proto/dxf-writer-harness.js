#!/usr/bin/env node
// A SHEET WRITTEN AS A DXF -- dxf-writer.js, which LAYOUT's SAVE DXF draws
// every sheet through (Movie, 9 Oct: "exactly for engineers to have autocad
// version to manipulate as they need too").
//
// Every check draws onto the recorder the way a painter does and reads the
// written file back with dxf-reader.js -- the reader TRACE opens DXFs with --
// so what is asserted is what an engineer's AutoCAD would be handed. The
// files were also opened in ezdxf when this was written: no audit errors,
// the arcs where the door swings are, the plan 36'-0" across at full size.
//
// Run: node proto/dxf-writer-harness.js
//      node proto/dxf-writer-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const H = require('./harness-env.js');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['an arc goes out as a run of little lines', 'dxf-writer.js',
    c => c.replace('if (fits && similar(seg.m)) {', 'if (false) {')],
  ['a clip is ignored', 'dxf-writer.js',
    c => c.replace('    if (!r) return [pts];', '    return [pts];')],
  ['paper is drawn as ink', 'dxf-writer.js',
    c => c.replace("        if (isPaper(state.strokeStyle, state.globalAlpha)) return;\n        const dashed", "        const dashed")],
  ['every fill is kept, the poché with it', 'dxf-writer.js',
    c => c.replace('if (Math.max(...xs) - Math.min(...xs) > SOLID_MAX || Math.max(...ys) - Math.min(...ys) > SOLID_MAX) return;', '')],
  ['a dashed line goes out solid', 'dxf-writer.js',
    c => c.replace("        if (name && name !== 'CONTINUOUS') put(6, name);\n", '')],
  ['the layer named last is forgotten', 'dxf-writer.js',
    c => c.replace('set dxfLayer(v) { state.dxfLayer = v || layer; },', 'set dxfLayer(v) {},')],
  ['save and restore lose the layer', 'dxf-writer.js',
    c => c.replace('restore() { if (stack.length) state = stack.pop(); },', 'restore() { if (stack.length) state = { ...stack.pop(), dxfLayer: state.dxfLayer }; },')],
  ['a mirrored map turns arcs the wrong way', 'dxf-writer.js',
    c => c.replace('return { ...e, cx, cy, r: e.r * k, a0: flip * e.a0 + turn, sweep: flip * e.sweep };', 'return { ...e, cx, cy, r: e.r * k, a0: e.a0 + turn, sweep: e.sweep };')],
  ['text keeps its em, not its capitals', 'dxf-writer.js',
    c => c.replace('h: size * s * 0.7,', 'h: size * s,')],
  ['a layer keeps lower case and spaces', 'dxf-writer.js',
    c => c.replace(".toUpperCase().replace(/[^A-Z0-9$_-]/g, '_')", '')],
  ['a dot dash goes out DASHED', 'dxf-writer.js',
    c => c.replace("    if (d.length >= 4) return 'CENTER';\n", '')],
  ['a coloured line loses its colour', 'dxf-writer.js',
    c => c.replace('        if (Number.isInteger(e.color)) put(62, e.color);\n', '')],
  ['the ZIP lies about its CRC', 'dxf-writer.js',
    c => c.replace('return (c ^ 0xffffffff) >>> 0;', 'return 0;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('dxf-writer',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = H.loadDraftModules();
const W = win.DraftDxfWriter;
const D = win.DraftDxfReader;

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (String(got) === String(want)) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got  ${got}\n       want ${want}`);
};
// Recorder pixels to drawing units the way LAYOUT maps a sheet: y flipped.
const flip = ([x, y]) => [x, -y];
const written = ctx => W.write({ entities: W.mapEntities(ctx.entities, flip) });
const box = (geo, layer) => {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  geo.paths.filter(p => !layer || p.layer === layer).forEach(p => {
    b = [Math.min(b[0], p.box[0]), Math.min(b[1], p.box[1]), Math.max(b[2], p.box[2]), Math.max(b[3], p.box[3])];
  });
  return b.map(v => Math.round(v * 100) / 100).join(',');
};

// ── LINES, ARCS, LAYERS ────────────────────────────────────────────────────
{
  const ctx = W.recorder({ layer: 'A-PLAN' });
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(100, 0); ctx.stroke();
  ctx.dxfLayer = 'A-DOOR';
  // A door: the leaf from the hinge, then the swing.
  ctx.beginPath(); ctx.moveTo(200, 0); ctx.arc(200, 0, 36, 0, Math.PI / 2); ctx.stroke();
  const text = written(ctx);
  const geo = D.parse(text);
  check('a line on the layer it was drawn on', box(geo, 'A-PLAN'), '0,0,100,0');
  check('a door swing goes out as an ARC', /\r\nARC\r\n8\r\nA-DOOR\r\n/.test(text), true);
  // Canvas y down, CAD y up: the swing from (236, 0) round to (200, 36) on
  // the page lands below the hinge in the file.
  check('the swing turns the way it did on the sheet', box(geo, 'A-DOOR'), '200,-36,236,0');
  check('the layer table names both, with their colours',
    geo.layers.map(l => `${l.name}:${l.color}`).join(' '), 'A-PLAN:null A-DOOR:#00ff00');
  check('an R12 file in architectural units',
    /\$ACADVER\r\n1\r\nAC1009/.test(text) && /\$LUNITS\r\n70\r\n4/.test(text), true);

  const nested = W.recorder({ layer: 'A' });
  nested.dxfLayer = 'B';
  nested.save(); nested.dxfLayer = 'C'; nested.restore();
  nested.beginPath(); nested.moveTo(0, 0); nested.lineTo(1, 0); nested.stroke();
  check('restore puts the layer back, as it does a colour', nested.entities[0].layer, 'B');
  const named = D.parse(W.write({ entities: [{ type: 'poly', layer: 'kitchen walls', pts: [0, 0, 1, 0] }] }));
  check('a layer name AutoCAD R12 would refuse is made one it takes', named.layers.map(l => l.name).join(), 'KITCHEN_WALLS');
}

// ── WHAT IS NOT A LINE ─────────────────────────────────────────────────────
{
  const ctx = W.recorder({ layer: 'A' });
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(50, 0); ctx.stroke();
  ctx.strokeStyle = '#1d1f20';
  ctx.fillStyle = 'rgba(29,31,32,0.9)';
  ctx.fillRect(0, 0, 500, 500);
  ctx.beginPath(); ctx.rect(0, 0, 400, 300); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(6, 3); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
  check('white ink is paper, a big fill is poché, a small dark mark is kept',
    ctx.entities.map(e => e.type).join(), 'solid');
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(50, 50); ctx.stroke();
  check('a dashed line goes out DASHED', /\r\nLINE\r\n8\r\nA\r\n6\r\nDASHED/.test(written(ctx)), true);
}

// ── A LINE'S OWN STYLE AND COLOUR (Movie, 19 Oct) ─────────────────────────
{
  const ctx = W.recorder({ layer: 'A' });
  ctx.strokeStyle = '#1d1f20';
  ctx.setLineDash([12, 5, 2, 5]);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(50, 0); ctx.stroke();
  ctx.setLineDash([2, 4]);
  ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(50, 10); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#ff0000';
  ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(50, 20); ctx.stroke();
  const text = written(ctx);
  check('a dot dash goes out CENTER', /\r\nLINE\r\n8\r\nA\r\n6\r\nCENTER\r\n/.test(text), true);
  check('dots go out DOT', /\r\nLINE\r\n8\r\nA\r\n6\r\nDOT\r\n/.test(text), true);
  check('the table names both linetypes', /\r\nLTYPE\r\n2\r\nCENTER\r\n/.test(text) && /\r\nLTYPE\r\n2\r\nDOT\r\n/.test(text), true);
  check('a red line carries its colour on the entity', /\r\nLINE\r\n8\r\nA\r\n62\r\n1\r\n/.test(text), true);
  check('a grey line keeps its layer\'s colour', (text.match(/\r\n62\r\n/g) || []).length, 2);
}

// ── CLIPPED TO THE VIEWPORT ────────────────────────────────────────────────
{
  const ctx = W.recorder({ layer: 'A' });
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, 100, 100); ctx.clip();
  ctx.beginPath(); ctx.moveTo(-50, 50); ctx.lineTo(150, 50); ctx.stroke();
  ctx.font = '9px sans-serif';
  ctx.fillText('IN', 50, 50); ctx.fillText('OUT', 500, 50);
  ctx.restore();
  const geo = D.parse(written(ctx));
  check('a line across the window stops at its edges', box(geo), '0,-50,100,-50');
  check('and text outside it is not there', geo.texts.map(t => t.lines.join()).join(), 'IN');
}

// ── TEXT ───────────────────────────────────────────────────────────────────
{
  const ctx = W.recorder({ layer: 'A-DIMS' });
  ctx.font = "600 10px 'Barlow Condensed', sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.translate(100, 100); ctx.rotate(-Math.PI / 2); ctx.fillText("12'-6\" °", 0, 0); ctx.restore();
  const text = written(ctx);
  const t = D.parse(text).texts[0];
  check('text is the height of its capitals', Math.round(t.h * 100) / 100, 7);
  check('turned with the page', Math.round((t.rot * 180) / Math.PI), 90);
  check('centred on its point', `${t.align} ${t.baseline}`, 'center middle');
  check('and the degree sign as AutoCAD writes it', /12'-6" %%d/.test(text), true);
}

// ── WHAT AN OPAQUE FILL HIDES (`hide`, for DETAIL SNAPSHOT) ────────────────
//
// jb, 20 Nov 2026: a snapshot is "the lines" of what he is looking at. A
// painter draws a house back to front and covers the far wall with the near
// one's white fill; a DXF leaves fills out; so the first picture the camera
// took of an elevation had the back wall's windows across the front.
{
  const runs = ctx => ctx.entities.filter(e => e.type === 'poly')
    .map(e => e.pts.map(v => Math.round(v * 100) / 100).join(' ') + (e.closed ? ' closed' : '')).join(' | ');
  const far = ctx => { ctx.strokeStyle = '#1d1f20'; ctx.beginPath(); ctx.moveTo(0, 50); ctx.lineTo(100, 50); ctx.stroke(); };
  const wall = (ctx, style) => { ctx.fillStyle = style; ctx.beginPath(); ctx.rect(40, 40, 20, 20); ctx.fill(); };

  const off = W.recorder({ layer: 'A' });
  far(off); wall(off, '#fff');
  check('UNASKED, nothing is hidden: an engineer\'s sheet goes out as it always has', runs(off), '0 50 100 50');

  const on = W.recorder({ layer: 'A', hide: true });
  far(on); wall(on, '#fff');
  check('a line is cut where a white wall stands in front of it', runs(on), '0 50 40 50 | 60 50 100 50');
  on.strokeStyle = '#1d1f20'; on.stroke();
  check('and the wall\'s own outline, drawn after, is whole',
    runs(on), '0 50 40 50 | 60 50 100 50 | 40 40 60 40 60 60 40 60 closed');

  const grey = W.recorder({ layer: 'A', hide: true });
  far(grey); wall(grey, '#8a8d8f');
  check('grey poche hides as white paper does: it is the opacity, not the colour', runs(grey), '0 50 40 50 | 60 50 100 50');

  const tint = W.recorder({ layer: 'A', hide: true });
  far(tint); wall(tint, 'rgba(29,31,32,0.1)');
  check('a tint hides nothing: what is under a tenth of grey still shows', runs(tint), '0 50 100 50');
  const faded = W.recorder({ layer: 'A', hide: true });
  far(faded); faded.globalAlpha = 0.2; wall(faded, '#fff');
  check('nor does a fill laid on at a fifth', runs(faded), '0 50 100 50');

  const rect = W.recorder({ layer: 'A', hide: true });
  far(rect); rect.fillStyle = '#fff'; rect.fillRect(40, 40, 20, 20);
  check('fillRect hides as a filled path does', runs(rect), '0 50 40 50 | 60 50 100 50');
  const turned = W.recorder({ layer: 'A', hide: true });
  far(turned); turned.fillStyle = '#fff';
  turned.save(); turned.translate(50, 50); turned.scale(2, 2); turned.fillRect(-5, -5, 10, 10); turned.restore();
  check('in the transform it was filled in', runs(turned), '0 50 40 50 | 60 50 100 50');

  // ALONG THE EDGE IS NOT UNDER. A line drawn on the edge of a fill is half
  // covered by it and still shows -- and a wall's fill is laid on edges the
  // wall before it drew.
  const edge = W.recorder({ layer: 'A', hide: true });
  edge.strokeStyle = '#1d1f20';
  edge.beginPath(); edge.moveTo(0, 40); edge.lineTo(100, 40); edge.stroke();
  wall(edge, '#fff');
  check('a line along the edge of a fill is kept whole', runs(edge), '0 40 100 40');

  // A FILL ONLY LANDS WHERE THE CLIP LETS IT. A big fill clipped to a gable
  // must not hide what stands beside the gable.
  const gable = W.recorder({ layer: 'A', hide: true });
  far(gable);
  gable.save();
  gable.beginPath(); gable.moveTo(30, 100); gable.lineTo(50, 0); gable.lineTo(70, 100); gable.closePath(); gable.clip();
  gable.fillStyle = '#fff'; gable.fillRect(0, 0, 100, 100);
  gable.restore();
  check('a fill clipped to a gable hides the gable\'s width of the line, not the box round it',
    runs(gable), '0 50 40 50 | 60 50 100 50');
  far(gable);
  gable.fillStyle = '#fff'; gable.fillRect(0, 45, 10, 10);
  // The second line runs whole through where the gable was; the small fill
  // at the left takes ten off it, and off the first line with it.
  check('and the clip is gone with its restore', runs(gable), '10 50 40 50 | 60 50 100 50 | 10 50 100 50');

  // A SLOPING LINE, A CLOSED SHAPE, AND WHAT IS NOT A LINE.
  const mix = W.recorder({ layer: 'A', hide: true });
  mix.strokeStyle = '#1d1f20';
  mix.beginPath(); mix.moveTo(0, 0); mix.lineTo(100, 100); mix.stroke();
  mix.beginPath(); mix.rect(30, 45, 40, 10); mix.stroke();
  mix.font = '10px sans-serif'; mix.fillStyle = '#1d1f20';
  mix.fillText('BEHIND', 50, 50); mix.fillText('BESIDE', 5, 90);
  mix.beginPath(); mix.arc(50, 50, 3, 0, Math.PI * 2); mix.fill();
  wall(mix, '#fff');
  check('a sloping line is cut at the wall\'s two faces; a window frame part under it loses that part',
    runs(mix), '0 0 40 40 | 60 60 100 100 | 60 45 70 45 70 55 60 55 | 40 55 30 55 30 45 40 45');
  check('a word standing behind the wall goes, one beside it stays',
    mix.entities.filter(e => e.type === 'text').map(e => e.text).join(), 'BESIDE');
  check('and a dot behind it goes', mix.entities.filter(e => e.type === 'circle').length, 0);

  const swing = W.recorder({ layer: 'A', hide: true });
  swing.strokeStyle = '#1d1f20';
  swing.beginPath(); swing.arc(50, 50, 30, 0, Math.PI); swing.stroke();
  check('an arc clear of every fill is still an ARC', swing.entities.map(e => e.type).join(), 'arc');
  swing.fillStyle = '#fff'; swing.fillRect(0, 60, 100, 100);
  check('one partly behind a wall goes on as the lines of the part that shows',
    swing.entities.every(e => e.type === 'poly') && swing.entities.length === 2
      && swing.entities.every(e => e.pts.every((v, i) => i % 2 === 0 || v <= 60.01)), true);
}

// ── THE ZIP ────────────────────────────────────────────────────────────────
{
  const bytes = W.zip([{ name: 'a.dxf', text: 'hello' }, { name: 'b.dxf', text: '' }]);
  const u32 = at => (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0;
  check('a ZIP, by its signature', u32(0).toString(16), '4034b50');
  check('each file with its CRC-32', u32(14).toString(16), '3610a686');
  check('and the directory at the end counts both', bytes[bytes.length - 12], 2);
}

console.log(`\n${ran - failed}/${ran} checks passed`);
if (failed) process.exitCode = 1;
