#!/usr/bin/env node
// THE TOP OF CONCRETE, THE TOP OF THE SILL, AND A PT LADDER'S BOTTOM.
//
// Movie, 4 Oct, on E1 of a MOD BILEVEL: "the grade beam and house sill plates
// don't seem to line up ... there is no LINE at the house. i'm considering
// adding a second line (1.5" down) to show the location of the sill plate".
// Then: "what if the user changes to 'PT LADDER'? -- how about make the lower
// 'sil plate' line lighter and add another line ... down from the top line",
// "give the user the option to make the PT LADDER 5.5" or 3.5"" and "make
// 3.5" the DEFAULT".
//
// So on every elevation: the top of the plate (the bearing line) is a
// full-weight line, the top of concrete 1 1/2" under it a light one, and
// where PROJECT's FND ATTACHMENT is PT LADDER, a light line at the ladder's
// bottom -- its LADDER DEPTH, 3 1/2" or 5 1/2", down from the top line.
//
//   node proto/sill-lines-harness.js
//   node proto/sill-lines-harness.js --mutate    break it, prove each break is caught
const fs = require('fs');
const path = require('path');

const MUTATE = require('./harness-args.js').mutationMode();
const ROOT = path.join(__dirname, '..');

const MUTATIONS = [
  ['a split house\'s concrete runs to the bearing line again', 'cut-view.js',
    c => c.replace(': Math.min(fdn.wallBottom + face.top, fdn.wallTop - houseSillPlateFt()),',
      ': fdn.wallBottom + face.top,')],
  ['the top of concrete is drawn at full weight under a plate', 'cut-view.js',
    c => c.replace("        ctx.strokeStyle = ink(0.45);\n        ctx.beginPath();\n        runs.forEach(r => { ctx.moveTo",
      "        ctx.strokeStyle = INK;\n        ctx.beginPath();\n        runs.forEach(r => { ctx.moveTo")],
  ['no line along the top of the plate', 'cut-view.js',
    c => c.replace('ctx.moveTo(X(p.lo), Y(g.topE + plateLine)); ctx.lineTo(X(p.hi), Y(g.topE + plateLine));', '')],
  ['a ladder\'s depth defaults to the 2x6', 'cut-view.js',
    c => c.replace('return ([3.5, 5.5].includes(inches) ? inches : 3.5) / 12;',
      'return ([3.5, 5.5].includes(inches) ? inches : 5.5) / 12;')],
  ['a sill plate draws a ladder line too', 'cut-view.js',
    c => c.replace("if (!row || row.foundationAttachment !== 'ladder') return 0;", 'if (!row) return 0;')],
  ['an ICF wall takes a ladder', 'cut-view.js',
    c => c.replace("if (String(g.wall?.wallType || '').startsWith('icf')) return 0;", '')],
  ['the split\'s own row is ignored for the drawing\'s', 'cut-view.js',
    c => c.replace('foundationAttachment: split.foundationAttachment ?? top.attachment,',
      'foundationAttachment: top.attachment,')],
  ['a floor on the sill plate paints its band over the plate line', 'cut-view.js',
    c => c.replace('const onSill = !!stack.split && Math.abs(level.floorBottom - fdn.wallTop) < 0.01;', 'const onSill = false;')],
  ['PROJECT\'s ladder defaults to the 2x6', 'project-page.js',
    c => c.replace('const DEFAULT_LADDER_DEPTH_IN = 3.5;', 'const DEFAULT_LADDER_DEPTH_IN = 5.5;')],
];

if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('sill-lines',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}

const { loadDraftModules, buildEnv, standardElevationCuts, paintElevation } = require('./harness-env.js');
const win = loadDraftModules();
const CV = win.DraftCutView;

let failed = 0, ran = 0;
const check = (label, ok, detail = '') => {
  ran += 1;
  if (ok) return;
  failed += 1;
  console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ''}`);
};

const INK_FULL = '#1d1f20';
const PLATE = 1.5 / 12;
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'proto', 'repro-modbilevel-e1.draft'), 'utf8'));
const saved = base.drawing || base;

// Every level stroke run on E1 at e, within the house's front (x -20..-10 is
// the house alone on this build), with its ink.
const paintE1 = d => {
  const env = buildEnv(win, d);
  const stack = CV.sectionLevelStack(env);
  const cut = standardElevationCuts(env).find(c => c.id === 'E1');
  const painted = paintElevation(win, env, cut, { pxPerFt: 40 });
  const runs = [];
  painted.strokes.forEach(s => s.pts.forEach((b, i) => {
    if (!i || b.move) return;
    const a = s.pts[i - 1];
    if (Math.abs(a.e - b.e) < 0.005 && Math.abs(a.u - b.u) > 0.3) {
      runs.push({ e: a.e, u0: Math.min(a.u, b.u), u1: Math.max(a.u, b.u), ink: s.ink });
    }
  }));
  const houseU = -15 * painted.axis.x + 20 * painted.axis.z;
  const at = e => runs.filter(r => Math.abs(r.e - e) < 0.03 && r.u0 < houseU && r.u1 > houseU);
  return { env, stack, painted, at };
};

// ── THE HOUSE AND THE GARAGE LINE UP, AND BOTH CARRY BOTH LINES ──────────
{
  const { stack, painted, at } = paintE1(saved);
  const fdn = stack.foundation;
  const bear = fdn.wallTop, conc = fdn.wallTop - PLATE;
  // The concrete fills: the house's top is the top of concrete, not the bearing.
  const greys = (painted.modelFills || []).filter(f => f.ink === '#e8e8ea' && f.pts.length === 4);
  const houseU = -15 * painted.axis.x + 20 * painted.axis.z;
  const house = greys.find(f => Math.min(...f.pts.map(p => p.u)) < houseU && Math.max(...f.pts.map(p => p.u)) > houseU);
  const houseTop = house ? Math.max(...house.pts.map(p => p.e)) : null;
  check('the house\'s concrete stops at the top of concrete, a plate under the bearing line',
    houseTop != null && Math.abs(houseTop - conc) < 0.03, `top ${houseTop} want ${conc.toFixed(4)}`);
  const top = at(bear), pour = at(conc);
  check('a full-weight line runs along the top of the house\'s sill plate',
    top.some(r => r.ink === INK_FULL), JSON.stringify(top.map(r => r.ink)));
  check('and a light one along its top of concrete',
    pour.length > 0 && pour.every(r => r.ink !== INK_FULL), JSON.stringify(pour.map(r => r.ink)));
  check('a sill plate draws no ladder line',
    at(bear - 3.5 / 12).length === 0 && at(bear - 5.5 / 12).length === 0);

  // AND NOTHING PAINTED LATER COVERS IT. Movie, 4 Oct: "the sill plate
  // lines don't show both lines on the house" -- the ENTRY's floor band,
  // which bears on that plate, ran a pixel past its bottom and laid a strip
  // over the row the line is drawn on. Measured at the page's own scale,
  // where a pixel is about an inch.
  const small = paintElevation(win, buildEnv(win, saved),
    standardElevationCuts(buildEnv(win, saved)).find(c => c.id === 'E1'), { pxPerFt: 16.6 });
  const px = 1 / 16.6;
  const plateRuns = [];
  small.strokes.forEach(st => st.pts.forEach((b, i) => {
    if (!i || b.move || st.ink !== INK_FULL) return;
    const a = st.pts[i - 1];
    if (Math.abs(a.e - b.e) < 0.005 && Math.abs(a.e - bear) < 2 * px && Math.abs(a.u - b.u) > 1) {
      plateRuns.push({ seq: st.seq, e: a.e, lo: Math.min(a.u, b.u), hi: Math.max(a.u, b.u) });
    }
  }));
  const covered = plateRuns.filter(r => (small.modelFills || []).some(f => {
    if (f.seq <= r.seq) return false;
    const es = f.pts.map(q => q.e), us = f.pts.map(q => q.u);
    return Math.min(...es) < r.e - px / 4 && Math.max(...es) > r.e + px / 4
      && Math.min(...us) < houseU && Math.max(...us) > houseU && r.lo < houseU && r.hi > houseU;
  }));
  check('and the house\'s plate line is not painted over by the floor band on it',
    plateRuns.some(r => r.lo < houseU && r.hi > houseU) && covered.length === 0,
    `${plateRuns.length} plate run(s), ${covered.length} covered`);
}

// ── A PT LADDER: ITS BOTTOM, 3 1/2" BY DEFAULT ───────────────────────────
{
  const d = JSON.parse(JSON.stringify(saved));
  d.foundationAttachment = 'ladder';
  const { stack, at } = paintE1(d);
  const bear = stack.foundation.wallTop;
  const ladder = at(bear - 3.5 / 12);
  check('a PT LADDER draws its bottom 3 1/2" under the top line by default',
    ladder.length > 0 && ladder.every(r => r.ink !== INK_FULL), JSON.stringify(ladder));
  check('and nothing at 5 1/2"', at(bear - 5.5 / 12).length === 0);

  d.foundationLadderIn = 5.5;
  const deep = paintE1(d);
  check('a 2x6 ladder draws it 5 1/2" down', deep.at(bear - 5.5 / 12).length > 0
    && deep.at(bear - 3.5 / 12).length === 0);

  // The split's own row answers before the drawing's.
  const r = JSON.parse(JSON.stringify(saved));
  r.sectionTable = { rows: { [r.buildType]: { foundationAttachment: 'ladder', foundationLadderIn: 5.5 } } };
  const row = paintE1(r);
  check('a split\'s own PROJECT row sets its ladder', row.at(bear - 5.5 / 12).length > 0);

  // An ICF wall takes no ladder (PROJECT: the sill plate is its only option).
  const icf = JSON.parse(JSON.stringify(d));
  icf.walls.forEach(w => { if ((w.view || 'plan') === 'foundation') w.wallType = 'icf'; });
  const i = paintE1(icf);
  check('an ICF foundation draws no ladder line',
    i.at(bear - 5.5 / 12).length === 0 && i.at(bear - 3.5 / 12).length === 0);
}

// ── PROJECT'S OWN DEFAULT, AND THE FORMAT KEEPS THE CHOICE ───────────────
{
  // Loaded the way the sandbox loads the rest, so a mutation run's
  // override of project-page.js is what this reads.
  const PP = (() => {
    const at = process.env.DRAFT_HARNESS_SOURCE_OVERRIDES;
    const over = at ? JSON.parse(fs.readFileSync(at, 'utf8')) : {};
    const read = name => over[name] ?? fs.readFileSync(path.join(ROOT, name), 'utf8');
    const w = {};
    ['level-assembly.js', 'drawing-format.js', 'project-page.js']
      .forEach(name => new Function('window', read(name))(w));
    return w.DraftProjectPage;
  })();
  if (PP) {
    check('PROJECT\'s ladder is a 2x4 by default', PP.ladderDepthIn(undefined) === 3.5);
    check('and a 2x6 when chosen', PP.ladderDepthIn(5.5) === 5.5);
    check('and nothing else', PP.ladderDepthIn(4) === 3.5);
  } else {
    check('project-page.js is reachable', false);
  }
  const table = win.DraftDrawingFormat.sectionTable({ rows: { detachedGarage: { foundationLadderIn: 5.5 } } });
  check('the section table keeps a row\'s ladder depth',
    table.rows.detachedGarage && table.rows.detachedGarage.foundationLadderIn === 5.5,
    JSON.stringify(table.rows.detachedGarage));
}

console.log(`\nsill lines: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
