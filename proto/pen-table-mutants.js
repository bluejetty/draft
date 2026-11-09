#!/usr/bin/env node
// MUTATION GATE for the PEN TABLE (jb, 9 Nov: "walls heavy, dims light,
// hidden dashed", printed and exported that way): the company standard
// keeps a pen weight and a linetype per layer, STANDARDS offers them, a
// LAYOUT sheet strokes each layer at its pen (scaled with the sheet's ink),
// a pen left at DEFAULT leaves the painter's own ink alone and does not
// leak onto the next layer, and the DXF's LAYER table carries the pens.
//
//   node proto/pen-table-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/pen-table.spec.js';
const SHEET = 'a sheet strokes each layer';
const DXF = 'the DXF a sheet saves';
const PAGE = 'STANDARDS offers a pen weight';

const MUTANTS = [
  { file: 'pen-table.js',
    name: 'the weight is never read off the standard',
    find: "    return { px: weight ? weight.px : null, dash: style ? style.dash : null, weight, style };\n",
    with: "    return { px: null, dash: style ? style.dash : null, weight, style };\n",
    test: SHEET },
  { file: 'pen-table.js',
    name: 'a dashed pen strokes the painter\'s own dash',
    find: "        ctx.setLineDash(state.pen.dash.map(d => d * w));\n",
    with: "        ctx.setLineDash(state.dash);\n",
    test: SHEET },
  { file: 'pen-table.js',
    name: 'the pen ignores the sheet\'s ink scale',
    find: "      ctx.lineWidth = state.pen && state.pen.px != null ? state.pen.px * k : state.width;\n",
    with: "      ctx.lineWidth = state.pen && state.pen.px != null ? state.pen.px : state.width;\n",
    test: SHEET },
  { file: 'pen-table.js',
    name: 'naming a layer does not re-ink what the painter already set (the pen leaks onto the next layer)',
    find: "      state.pen = penFor(lookup(id));\n      applyPen();\n",
    with: "      state.pen = penFor(lookup(id));\n",
    test: SHEET },
  { file: 'pen-table.js',
    name: 'the DXF lineweight is the raw figure, not AutoCAD\'s nearest listed weight',
    find: "      out.lineweight = ACAD_WEIGHTS.reduce((best, w) => (Math.abs(w - want) < Math.abs(best - want) ? w : best), ACAD_WEIGHTS[0]);\n",
    with: "      out.lineweight = Math.round(want);\n",
    test: DXF },
  { file: 'layout-plan.js',
    name: 'drawPlan paints without the pen table in front of the context',
    find: "  function drawPlan(ctx, toS, saved, levelId, env = {}) {\n    ctx = penned(ctx, env);\n",
    with: "  function drawPlan(ctx, toS, saved, levelId, env = {}) {\n",
    test: SHEET },
  { file: 'profile-manager.js',
    name: 'the weight is not kept in the layer standard',
    find: "      const weight = penWeightId(entry.weight);\n",
    with: "      const weight = 'default';\n",
    test: PAGE },
  { file: 'profile-manager.js',
    name: 'the linetype is not kept in the layer standard',
    find: "      const linetype = penLinetypeId(entry.linetype);\n",
    with: "      const linetype = 'default';\n",
    test: PAGE },
  { file: 'dxf-writer.js',
    name: 'the LAYER table names no linetype',
    find: "put(6, pen ? pen.linetype : 'CONTINUOUS');\n",
    with: "put(6, 'CONTINUOUS');\n",
    test: DXF },
  { file: 'dxf-writer.js',
    name: 'the LAYER table carries no lineweight',
    find: "      if (pen && Number.isInteger(pen.lineweight)) put(370, pen.lineweight);\n",
    with: "",
    test: DXF },
  { file: 'LAYOUT.html',
    name: 'SAVE DXF hands the writer no pen layers',
    find: "text: W.write({ entities, layers: this._dxfPenLayers() }) });",
    with: "text: W.write({ entities }) });",
    test: DXF },
  { file: 'STANDARDS.html',
    name: 'the linetype select writes the weight',
    find: "            layerStandards = { ...layerStandards, [layerId]: { ...layerStandards[layerId], [field]: value } };\n",
    with: "            layerStandards = { ...layerStandards, [layerId]: { ...layerStandards[layerId], weight: value } };\n",
    test: PAGE },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: process.env.DRAFT_TEST_PORT || '4571' } });
    return 'passed';
  } catch { return 'failed'; }
};

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`, { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}
{
  const clean = run(null);
  if (clean !== 'passed') {
    console.log('REFUSING TO RUN: the spec is already failing before any mutant '
      + 'is applied.\nEvery mutant would read as KILLED and the sheet would be a '
      + 'lie. Fix the spec first.');
    process.exit(1);
  }
  console.log('baseline: the unmutated spec passes\n');
}
let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  if (!before.includes(m.find)) {
    console.log(`  SKIPPED   ${m.name}  (anchor not found — re-aim \`find\`)`);
    ambiguous += 1;
    continue;
  }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check — re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  const caught = result === 'failed';
  if (caught) killed += 1;
  console.log(`  ${caught ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS (anchor missing)` : ''));
process.exit(killed === MUTANTS.length ? 0 : 1);
