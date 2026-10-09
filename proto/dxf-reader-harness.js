#!/usr/bin/env node
// A DXF READ INTO LINES -- dxf-reader.js, which TRACE lays a CAD file under
// the plan with (Movie, 9 Oct: "how about the ability to view DXF").
//
// Every file here is written out pair by pair, so each check names exactly
// the group codes it is about. The shapes were checked against ezdxf when the
// reader was written: Movie's 1._Story.DXF, KITCHENITEMS1/2 and WC_PLAN_2
// gave the same extents to the hundredth of an inch, and a stress file of
// bulges, mirrored arcs, scaled, turned, nested and arrayed blocks matched
// layer by layer.
//
// Run: node proto/dxf-reader-harness.js
//      node proto/dxf-reader-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const H = require('./harness-env.js');
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['the unit in the header is never read', 'dxf-reader.js',
    c => c.replace('if (next && next[0] === 70) units = INSUNITS[parseInt(next[1], 10)] || null;', '')],
  ['a mirrored arc draws the right way round', 'dxf-reader.js',
    c => c.replace("const ocs = obj => (num(obj, 230, 1) < 0 ? [-1, 0, 0, 1, 0, 0] : IDENTITY);", 'const ocs = () => IDENTITY;')],
  ['a bulge bows the other way', 'dxf-reader.js',
    c => c.replace('const cx = mx - uy * h * side, cy = my + ux * h * side;', 'const cx = mx + uy * h * side, cy = my - ux * h * side;')],
  ['a piece on layer 0 in a block keeps layer 0', 'dxf-reader.js',
    c => c.replace("return own === '0' && parent ? parent.layer : own;", 'return own;')],
  ['a BYBLOCK colour ignores the block', 'dxf-reader.js',
    c => c.replace('if (aci === 0 && parent) return parent.color;', '')],
  ['a block\'s base point is ignored', 'dxf-reader.js',
    c => c.replace('mul(scale(sx, sy), translate(-target.base[0], -target.base[1]))', 'scale(sx, sy)')],
  ['an INSERT\'s turn is ignored', 'dxf-reader.js',
    c => c.replace('mul(rotate(rot), mul(translate(c * dc, r * dr),', 'mul(rotate(0), mul(translate(c * dc, r * dr),')],
  ['paper space draws on the plan', 'dxf-reader.js',
    c => c.replace("if (first(obj, 67, '0').trim() === '1') { skip('paper space'); continue; }", '')],
  ['a DIMENSION draws nothing', 'dxf-reader.js',
    c => c.replace('draw(target.entities, m, { layer, color }, depth + 1);\n              break;', 'break;')],
  ['a layer the file has off shows', 'dxf-reader.js',
    c => c.replace('off: color < 0 || Boolean(flags & 1),', 'off: false,')],
  ['the drawing forgets a DXF', 'drawing-format.js',
    c => c.replace("const kind = oneOf(underlay?.kind, ['pdf', 'image', 'dxf'], null);", "const kind = oneOf(underlay?.kind, ['pdf', 'image'], null);")],
  ['the drawing forgets which layers are off', 'drawing-format.js',
    c => c.replace("hiddenLayers: [...new Set((Array.isArray(underlay?.hiddenLayers) ? underlay.hiddenLayers : [])", "hiddenLayers: [...new Set(([])")],
  ['an arc is one straight piece', 'dxf-reader.js',
    c => c.replace('const n = Math.max(1, Math.ceil(Math.abs(sweep) / PIECE_SWEEP - 1e-9));', 'const n = 1;')],
  ['a curve forgets its midpoint', 'dxf-reader.js',
    c => c.replace('segments.push({ layer, color, a, b, mid: pc.mid ? apply(m, pc.mid[0], pc.mid[1]) : null });',
      'segments.push({ layer, color, a, b, mid: null });')],
  ['the bulge is the sagitta, not twice it', 'dxf-reader.js',
    c => c.replace('bulge = Math.abs(off) > 1e-9 ? 2 * off : 0;', 'bulge = Math.abs(off) > 1e-9 ? off : 0;')],
  ['a polyline\'s pieces ignore its bulges', 'dxf-reader.js',
    c => c.replace('const arc = p.bulge ? bulgeArc(p.x, p.y, q.x, q.y, p.bulge) : null;', 'const arc = null;')],
  ['a DXF line\'s layer falls to draft', 'drawing-format.js',
    c => c.replace("          : (imported && String(line?.layer ?? '').trim()) ? String(line.layer).trim().slice(0, 255)\n", '')],
  ['MTEXT keeps its formatting codes', 'dxf-reader.js',
    c => c.replace(".replace(/\\\\[ACFHQTWfhqtwacp][^;\\\\{}]*;/g, '')", '')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('dxf-reader',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const win = H.loadDraftModules();
const D = win.DraftDxfReader;

// A DXF from sections of [code, value, code, value, ...].
const file = ({ header = [], layers = [], blocks = [], entities = [] }) => {
  const pairs = [
    0, 'SECTION', 2, 'HEADER', ...header, 0, 'ENDSEC',
    0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', ...layers, 0, 'ENDTAB', 0, 'ENDSEC',
    0, 'SECTION', 2, 'BLOCKS', ...blocks, 0, 'ENDSEC',
    0, 'SECTION', 2, 'ENTITIES', ...entities, 0, 'ENDSEC', 0, 'EOF',
  ];
  const lines = [];
  for (let i = 0; i < pairs.length; i += 2) lines.push(String(pairs[i]), String(pairs[i + 1]));
  return `${lines.join('\r\n')}\r\n`;
};
const box = (geo, layer) => {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  geo.paths.filter(p => layer == null || p.layer === layer).forEach(p => {
    b = [Math.min(b[0], p.box[0]), Math.min(b[1], p.box[1]), Math.max(b[2], p.box[2]), Math.max(b[3], p.box[3])];
  });
  return b.map(v => Math.round(v * 100) / 100).join(',');
};
const LINE = (layer, x0, y0, x1, y1, more = []) => [0, 'LINE', 8, layer, ...more, 10, x0, 20, y0, 11, x1, 21, y1];

let failed = 0, ran = 0;
const check = (label, got, want) => {
  ran += 1;
  if (String(got) === String(want)) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got  ${got}\n       want ${want}`);
};
const throws = (label, fn, words) => {
  ran += 1;
  try { fn(); } catch (error) {
    if (String(error.message).includes(words)) return;
    failed += 1;
    console.log(`  FAIL ${label}\n       threw "${error.message}"`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${label}\n       did not throw`);
};

// ── UNITS ──────────────────────────────────────────────────────────────────
{
  const one = LINE('A', 0, 0, 10, 0);
  check('$INSUNITS 1 is inches', D.parse(file({ header: [9, '$INSUNITS', 70, 1], entities: one })).units, 'in');
  check('4 is millimetres', D.parse(file({ header: [9, '$INSUNITS', 70, 4], entities: one })).units, 'mm');
  check('and a file that does not say is null, for the page to ask', D.parse(file({ entities: one })).units, null);
}

// ── CURVES ─────────────────────────────────────────────────────────────────
{
  // (0,0) to (10,0), bulge 1: a half circle, counter-clockwise, so below.
  const g = D.parse(file({ entities: [0, 'LWPOLYLINE', 8, 'A', 90, 2, 70, 0, 10, 0, 20, 0, 42, 1, 10, 10, 20, 0] }));
  check('a bulge of 1 is a half circle bowed the way it turns', box(g), '0,-5,10,0');
  // Bulge 0.5 is less than a half circle, so its centre is off the chord
  // and on one side of it only (ezdxf: down to y = -2.5).
  const shallow = D.parse(file({ entities: [0, 'LWPOLYLINE', 8, 'A', 90, 2, 70, 0, 10, 0, 20, 0, 42, 0.5, 10, 10, 20, 0] }));
  check('a shallower bulge keeps its centre on the far side', box(shallow), '0,-2.5,10,0');
  const arc = D.parse(file({ entities: [0, 'ARC', 8, 'A', 10, 0, 20, 0, 40, 10, 50, 0, 51, 90] }));
  check('an arc 0 to 90 degrees', box(arc), '0,0,10,10');
  const mirrored = D.parse(file({ entities: [0, 'ARC', 8, 'A', 10, 0, 20, 0, 40, 10, 50, 0, 51, 90, 230, -1] }));
  check('and one with its extrusion down is mirrored', box(mirrored), '-10,0,0,10');
  const poly = D.parse(file({ entities: [0, 'POLYLINE', 8, 'A', 66, 1, 70, 1,
    0, 'VERTEX', 8, 'A', 10, 0, 20, 0, 0, 'VERTEX', 8, 'A', 10, 4, 20, 0, 0, 'VERTEX', 8, 'A', 10, 4, 20, 3,
    0, 'SEQEND', 8, 'A'] }));
  check('an old POLYLINE takes its VERTEXes to the SEQEND', `${poly.paths.length} ${poly.paths[0].closed} ${box(poly)}`,
    'true'.replace('true', '1 true 0,0,4,3'));
}

// ── BLOCKS ─────────────────────────────────────────────────────────────────
{
  // Block B, base (5,5): a line along its base 10 long, on layer 0 in
  // BYBLOCK colour; a second on its own layer in BYLAYER.
  const blocks = [0, 'BLOCK', 8, '0', 2, 'B', 70, 0, 10, 5, 20, 5,
    ...LINE('0', 5, 5, 15, 5, [62, 0]), ...LINE('KEEP', 5, 5, 5, 7),
    0, 'ENDBLK', 8, '0'];
  const layers = [0, 'LAYER', 2, 'KEEP', 70, 0, 62, 3, 0, 'LAYER', 2, 'DOORS', 70, 0, 62, 1,
    0, 'LAYER', 2, 'GONE', 70, 0, 62, -5];
  const g = D.parse(file({ layers, blocks, entities: [0, 'INSERT', 8, 'DOORS', 62, 5, 2, 'B',
    10, 100, 20, 0, 41, 2, 42, 2, 50, 90] }));
  // Turned a quarter and doubled about its base: (5,5)-(15,5) lands at
  // (100,0)-(100,20).
  check('an INSERT draws its block from the base point, scaled and turned', box(g, 'DOORS'), '100,0,100,20');
  check('a piece on layer 0 takes the INSERT\'s layer', g.paths.filter(p => p.layer === 'DOORS').length, 1);
  check('and a BYBLOCK colour the INSERT\'s', g.paths.find(p => p.layer === 'DOORS').color, '#0000ff');
  check('a BYLAYER piece on its own layer keeps that layer\'s colour', g.paths.find(p => p.layer === 'KEEP').color, '#00ff00');
  check('a layer the file has off says so', g.layers.find(l => l.name === 'GONE').off, true);
  check('and the layer list counts what is on each', g.layers.map(l => `${l.name}:${l.count}`).join(' '), 'KEEP:1 DOORS:1 GONE:0');

  const loop = D.parse(file({ blocks: [0, 'BLOCK', 8, '0', 2, 'L', 70, 0, 10, 0, 20, 0,
    ...LINE('0', 0, 0, 1, 0), 0, 'INSERT', 8, '0', 2, 'L', 10, 1, 20, 0, 0, 'ENDBLK', 8, '0'],
  entities: [0, 'INSERT', 8, 'A', 2, 'L', 10, 0, 20, 0] }));
  check('a block that inserts itself stops, and says why', Boolean(loop.skipped['blocks nested too deep']), true);

  const dim = D.parse(file({ blocks: [0, 'BLOCK', 8, '0', 2, '*D1', 70, 1, 10, 0, 20, 0,
    ...LINE('0', 0, 0, 30, 0), 0, 'ENDBLK', 8, '0'], entities: [0, 'DIMENSION', 8, 'DIMS', 2, '*D1'] }));
  check('a DIMENSION draws the picture its block holds', box(dim, 'DIMS'), '0,0,30,0');
}

// ── WHAT IS LEFT OUT, AND SAID ─────────────────────────────────────────────
{
  const g = D.parse(file({ entities: [...LINE('A', 0, 0, 1, 1), ...LINE('A', 500, 500, 900, 900, [67, 1]),
    0, 'HATCH', 8, 'A'] }));
  check('paper space is not on the plan', box(g), '0,0,1,1');
  check('and a HATCH is counted as skipped', g.skipped.HATCH, 1);
  throws('a binary DXF is refused by name', () => D.parse('AutoCAD Binary DXF\r\n\x1a\x00'), 'binary DXF');
  throws('and a file that is not one at all', () => D.parse('hello\nworld\n'), 'group code');
  throws('a DXF with nothing in model space', () => D.parse(file({})), 'nothing in it is drawn');
}

// ── TEXT AND COLOURS ───────────────────────────────────────────────────────
{
  const g = D.parse(file({ entities: [0, 'MTEXT', 8, 'T', 10, 0, 20, 0, 40, 6, 71, 1,
    1, '{\\fArial|b0|i0;KITCHEN}\\P11\'-6%%d'] }));
  check('MTEXT keeps its words and line breaks, not its codes', JSON.stringify(g.texts[0].lines),
    JSON.stringify(['KITCHEN', '11\'-6°']));
  check('colour 7 is the page\'s ink, handed back as null', D.aciColor(7), null);
  check('and colour 1 is red', D.aciColor(1), '#ff0000');
}

// ── EDITABLE: THE SAME FILE AS THE DRAWING'S OWN LINES ─────────────────────
// TRACE's EDITABLE asks the reader for `segments` and turns them into LINE
// records through piecesToLines. An arc is cut at 45 degrees and every piece
// carries its true midpoint; the plan draws a curved line as a quadratic
// whose halfway point sits half its bulge off the chord -- so that halfway
// point must land on the arc.
{
  const lineMid = l => {
    const dx = l.end.x - l.start.x, dz = l.end.z - l.start.z, len = Math.hypot(dx, dz);
    return { x: (l.start.x + l.end.x) / 2 + (-dz / len) * l.bulge / 2,
      z: (l.start.z + l.end.z) / 2 + (dx / len) * l.bulge / 2 };
  };
  const plan = ([x, y]) => ({ x, z: -y });
  const asked = D.parse(file({ entities: [0, 'CIRCLE', 8, 'C', 10, 5, 20, 5, 40, 10] }), { segments: true });
  check('a file only viewed carries no pieces', 'segments' in D.parse(file({ entities: LINE('A', 0, 0, 1, 0) })), false);
  const circle = D.piecesToLines(asked.segments, plan);
  check('a circle is eight curved lines', `${circle.length} ${circle.every(l => l.bulge !== 0)}`, '8 true');
  check('whose curves pass through the circle', circle.every(l => {
    const m = lineMid(l);
    return Math.abs(Math.hypot(m.x - 5, m.z + 5) - 10) < 1e-6;
  }), true);
  const quarter = D.piecesToLines(D.parse(file({ entities: [0, 'ARC', 8, 'A', 10, 0, 20, 0, 40, 10, 50, 0, 51, 90] }),
    { segments: true }).segments, plan);
  check('a quarter arc is two', quarter.length, 2);
  check('starting and ending where the arc does', JSON.stringify([quarter[0].start, quarter[1].end]
    .map(p => [Math.round(p.x * 1e6) / 1e6, Math.round(p.z * 1e6) / 1e6])), JSON.stringify([[10, 0], [0, -10]]));
  // A bulged polyline segment ends exactly on its vertices, both ways round.
  const poly = D.piecesToLines(D.parse(file({ entities: [0, 'LWPOLYLINE', 8, 'P', 90, 3, 70, 0,
    10, 0, 20, 0, 42, 1, 10, 10, 20, 0, 10, 10, 20, 8] }), { segments: true }).segments, plan);
  check('a polyline: its half circle in four pieces, then its straight', poly.map(l => (l.bulge ? 'C' : 'S')).join(''), 'CCCCS');
  check('the half circle bows the way the file turns', poly.every((l, i) => i === 4 || lineMid(l).z >= -1e-9), true);
  const blocked = D.parse(file({ layers: [0, 'LAYER', 2, 'DOORS', 70, 0, 62, 1],
    blocks: [0, 'BLOCK', 8, '0', 2, 'B', 70, 0, 10, 0, 20, 0, ...LINE('0', 0, 0, 3, 0), 0, 'ENDBLK', 8, '0'],
    entities: [0, 'INSERT', 8, 'DOORS', 2, 'B', 10, 10, 20, 0, 50, 90] }), { segments: true });
  check('a piece in a block lands where the INSERT puts it, on its layer',
    JSON.stringify(D.piecesToLines(blocked.segments, plan).map(l => [l.layer, Math.round(l.end.x * 1e6) / 1e6,
      Math.round(l.end.z * 1e6) / 1e6])), JSON.stringify([['DOORS', 10, -3]]));
}

// ── THE DRAWING KEEPS IT ───────────────────────────────────────────────────
// drawing-format.js holds a DXF underlay's unit and its switched-off layers
// through a save and a load; a photo gets neither.
{
  const F = win.DraftDrawingFormat;
  const base = { id: 'u1', levelId: 3, x: 0, z: 0, widthFt: 20, heightFt: 10 };
  const [dxf] = F.underlays([{ ...base, kind: 'dxf', dxfUnits: 'mm', hiddenLayers: ['FURN', 'FURN', ''] }], new Set([3]));
  check('a DXF underlay keeps its kind, unit and hidden layers (once each)',
    JSON.stringify([dxf.kind, dxf.dxfUnits, dxf.hiddenLayers]), JSON.stringify(['dxf', 'mm', ['FURN']]));
  const [odd] = F.underlays([{ ...base, kind: 'dxf', dxfUnits: 'cubits' }], new Set([3]));
  check('a unit it does not know reads as inches', odd.dxfUnits, 'in');
  const [photo] = F.underlays([{ ...base, kind: 'image', dxfUnits: 'mm' }], new Set([3]));
  check('and a photo carries no DXF fields', 'dxfUnits' in photo || 'hiddenLayers' in photo, false);
  const seg = { start: { x: 0, z: 0 }, end: { x: 4, z: 0 }, levelId: 3, view: 'plan' };
  const [got, own] = F.lines([{ ...seg, id: 'l1', layer: 'AA-WALL-EXTR', importedFrom: 'story.DXF' },
    { ...seg, id: 'l2', layer: 'AA-WALL-EXTR' }], new Set([3]), { knownLayerIds: new Set(['A-WALL']) });
  check('a line from a DXF keeps the layer the file gave it', `${got.layer} ${got.importedFrom}`, 'AA-WALL-EXTR story.DXF');
  check('a drawn line on a layer nobody knows still falls to draft', `${own.layer} ${'importedFrom' in own}`, 'draft false');
}

console.log(`\n${ran - failed}/${ran} checks passed`);
if (failed) process.exitCode = 1;
