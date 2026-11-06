#!/usr/bin/env node
// MUTATION GATE for a shape's hatch, linetype, label, SHOW AREA and
// flooring (jb, 6 Nov). Each row breaks one line, runs the one test that
// should notice, and restores the file from HEAD.
//
//   node proto/shape-hatch-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/shape-hatch.spec.js';
const PANEL = 'the SHAPE panel offers fourteen hatches';
const INK = 'the ink follows';
const LABEL = 'the label and the area read on the sheet';
const TWO = 'two shapes picked together';

const MUTANTS = [
  { file: 'render-2d.js',
    name: 'BLACK draws the wash instead of its fill',
    find: "      } else if (hatch.fill) {\n        ctx.fillStyle = hatch.fill;\n        ctx.fill();\n      }\n",
    with: "      } else if (hatch.fill) {\n        ctx.fillStyle = atAlpha(env.shapeColor, 0.09);\n        ctx.fill();\n      }\n",
    test: INK },
  { file: 'render-2d.js',
    name: 'TRANSPARENT still washes the box',
    find: "      if (!hatch) {\n        ctx.fillStyle = atAlpha(env.shapeColor, preview ? 0.06 : 0.09);\n        ctx.fill();\n      } else if (hatch.fill) {\n",
    with: "      if (!hatch || !hatch.fill) {\n        ctx.fillStyle = atAlpha(env.shapeColor, preview ? 0.06 : 0.09);\n        ctx.fill();\n      } else if (hatch.fill) {\n",
    test: INK },
  { file: 'render-2d.js',
    name: 'the dot screen is never drawn',
    find: "      if (hatch && hatch.dots) { dotScreen(ctx, screenPoints); trace(); }\n",
    with: "",
    test: INK },
  { file: 'render-2d.js',
    name: 'the dots are half the pitch and the screen is a block',
    find: "  const DOT_RADIUS_PX = Math.sqrt(0.25 * DOT_PITCH_PX * DOT_PITCH_PX / Math.PI);\n",
    with: "  const DOT_RADIUS_PX = DOT_PITCH_PX / 2;\n",
    test: INK },
  { file: 'render-2d.js',
    name: 'the dots are a pixel wide and the screen is a wash',
    find: "  const DOT_RADIUS_PX = Math.sqrt(0.25 * DOT_PITCH_PX * DOT_PITCH_PX / Math.PI);\n",
    with: "  const DOT_RADIUS_PX = 0.4;\n",
    test: INK },
  { file: 'render-2d.js',
    name: 'the outline strokes the dots, not the shape',
    find: "      if (hatch && hatch.dots) { dotScreen(ctx, screenPoints); trace(); }\n",
    with: "      if (hatch && hatch.dots) { dotScreen(ctx, screenPoints); }\n",
    test: INK },
  { file: 'render-2d.js',
    name: 'an exterior finish draws nothing in a shape',
    find: "      if (hatch && hatch.finish) { finishScreen(ctx, toS, screenPoints, hatch.finish); trace(); }\n",
    with: "",
    test: INK },
  { file: 'render-2d.js',
    name: 'the finish is not clipped to the shape',
    find: "    ctx.save();\n    ctx.clip();\n    FP.drawFinish(ctx, box, finish, { line: DOT_INK });\n",
    with: "    ctx.save();\n    FP.drawFinish(ctx, box, finish, { line: DOT_INK });\n",
    test: INK },
  { file: 'render-2d.js',
    name: 'SHOW AREA off still writes the figure on a flooring area',
    find: "      const areaOn = shape.showArea === true || (!!shape.flooring && shape.showArea !== false);\n",
    with: "      const areaOn = shape.showArea === true || !!shape.flooring;\n",
    test: LABEL },
  { file: 'render-2d.js',
    name: 'the label is never written',
    find: "        ...(name ? [{ text: name, font: \"700 12px 'Barlow Condensed', system-ui, sans-serif\", high: 16 }] : []),\n",
    with: "",
    test: LABEL },
  { file: 'model/01-skin-view.js',
    name: 'the painter is handed the bare id list and finds no finish',
    find: "    flooringTypes: window.DraftDrawingFormat.FLOORING_FINISHES,\n",
    with: "    flooringTypes: window.DraftDrawingFormat.FLOORING_TYPES,\n",
    test: LABEL },
  { file: 'drawing-format.js',
    name: 'the file forgets the hatch on load',
    find: "        ...(SHAPE_HATCH_IDS.includes(String(shape?.hatch ?? '')) ? { hatch: String(shape.hatch) } : {}),\n",
    with: "",
    test: PANEL },
  { file: 'drawing-format.js',
    name: 'the file forgets the linetype on load',
    find: "        ...(SHAPE_STYLE_IDS.includes(String(shape?.style ?? '')) ? { style: String(shape.style) } : {}),\n",
    with: "",
    test: PANEL },
  { file: 'drawing-format.js',
    name: 'the file forgets the label on load',
    find: "        ...(String(shape?.label ?? '').trim() ? { label: String(shape.label).trim().slice(0, 60) } : {}),\n",
    with: "",
    test: PANEL },
  { file: 'drawing-format.js',
    name: 'the file forgets SHOW AREA on load',
    find: "        ...(typeof shape?.showArea === 'boolean' ? { showArea: shape.showArea } : {}),\n",
    with: "",
    test: PANEL },
  { file: 'model/15-panels.js',
    name: 'a chip writes the shape with no undo step',
    find: "    undoStack.push({ kind: 'props', edits });\n    if ('hatch' in patch || 'style' in patch) {\n",
    with: "    if ('hatch' in patch || 'style' in patch) {\n",
    test: PANEL },
  { file: 'model/15-panels.js',
    name: 'NONE leaves the old hatch on the record',
    find: "        if (value == null) delete shape[key]; else shape[key] = value;\n      });\n      // THE LAYER FOLLOWS THE FLOORING",
    with: "        if (value != null) shape[key] = value;\n      });\n      // THE LAYER FOLLOWS THE FLOORING",
    test: PANEL },
  { file: 'model/15-panels.js',
    name: 'the layer stays SHAPE under a flooring',
    find: "      shape.layer = shape.flooring ? 'A-FL-FLOORING' : 'SHAPE';\n",
    with: "",
    test: PANEL },
  { file: 'model/15-panels.js',
    name: 'the label is written as typed, not as a sheet writes it',
    find: "        const text = label.value.trim().toUpperCase();\n",
    with: "        const text = label.value.trim();\n",
    test: PANEL },
  { file: 'model/15-panels.js',
    name: 'the chips read the first shape only, not every selected one',
    find: "    const same = read => (shapes.every(s => read(s) === read(shapes[0])) ? read(shapes[0]) : undefined);\n",
    with: "    const same = read => read(shapes[0]);\n",
    test: PANEL },
  { file: 'model/15-panels.js',
    name: 'a chip writes the first selected shape only',
    find: "    const edits = list.map(shape => ({ item: shape, before: { ...shape } }));\n    list.forEach(shape => {\n      Object.entries(patch)",
    with: "    list = list.slice(0, 1);\n    const edits = list.map(shape => ({ item: shape, before: { ...shape } }));\n    list.forEach(shape => {\n      Object.entries(patch)",
    test: TWO },
  { file: 'model/15-panels.js',
    name: 'the last pick is not the next shape\\'s',
    find: "  const shapeStyleDefaults = () => ({\n    ...(shapeDefaults.hatch ? { hatch: shapeDefaults.hatch } : {}),\n",
    with: "  const shapeStyleDefaults = () => ({\n",
    test: TWO },
  { file: 'model/11-floor-openings-fixtures.js',
    name: 'a new shape is born bare',
    find: "      ...(typeof shapeStyleDefaults === 'function' ? shapeStyleDefaults() : {}),\n",
    with: "",
    test: TWO },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4561' } });
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
