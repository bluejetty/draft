#!/usr/bin/env node
// MUTATION GATE for SPECIAL finish shapes on a wall (jb, 27 Nov 2026): the
// painter laying a shape of finish along the wall, PFM covering what is
// under it, the file keeping them, and EXT. FINISH placing, resizing,
// moving, snapping and deleting them. tests/ext-finish-special-shapes.spec.js.
//
// Run: node proto/ext-finish-special-shapes-mutants.js   (refuses a dirty tree; restores from HEAD)
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

// LITERALS IN THE TABLE, not constants: proto/mutant-anchors-harness.js reads
// the MUTANTS table on its own, with nothing else of this file defined.
const SPECS = ['tests/ext-finish-special-shapes.spec.js'];
const MUTANTS = [
  { file: "cut-view.js", name: "the painter ignores specials", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "      const specials = !wall.endCapOf && !wall.gableOf && Array.isArray(wall.finishSpecials)\n        ? wall.finishSpecials : [];",
    with: "      const specials = [];",
    test: "a SPECIAL on the wall paints" },
  { file: "cut-view.js", name: "s runs from the wall's end, not its start", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "          const pts = sp.pts.map(q => ({ x: X(face.u1 + du * q.s), y: Y(floorE + q.h) }));",
    with: "          const pts = sp.pts.map(q => ({ x: X(face.u2 - du * q.s), y: Y(floorE + q.h) }));",
    test: "a SPECIAL on the wall paints" },
  { file: "cut-view.js", name: "a special leaves the siding showing under PFM", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "          ctx.fillStyle = C.face;\n          ctx.fillRect(box.x0 - 1, box.yTop - 1, box.x1 - box.x0 + 2, box.yBottom - box.yTop + 2);\n          FP.drawFinish(",
    with: "          FP.drawFinish(",
    test: "PFM paints a plain fill" },
  { file: "cut-view.js", name: "a special has no outline", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "          ctx.strokeStyle = INK; ctx.lineWidth = 1;\n          outline();\n          ctx.stroke();\n        });",
    with: "        });",
    test: "a SPECIAL on the wall paints" },
  { file: "drawing-format.js", name: "the file drops every special", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "      ...(specials.length ? { finishSpecials: specials } : {}),\n    };",
    with: "    };",
    test: "the file keeps good specials" },
  { file: "drawing-format.js", name: "the file keeps a special of any finish", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "      if (!(ids.includes(finishId) || finishId === 'pfm')) return null;",
    with: "",
    test: "the file keeps good specials" },
  { file: "drawing-format.js", name: "the file refuses PFM", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "      if (!(ids.includes(finishId) || finishId === 'pfm')) return null;",
    with: "      if (!ids.includes(finishId)) return null;",
    test: "the file keeps good specials" },
  { file: "proto/harness-env.js", name: "the bench env drops specials", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "      ...(Array.isArray(wall?.finishSpecials) && wall.finishSpecials.length\n        ? { finishSpecials: wall.finishSpecials } : {}),\n      // AND WHICH FACE",
    with: "      // AND WHICH FACE",
    test: "a SPECIAL on the wall paints" },
  { file: "EXTFINISH.html", name: "the rectangle hangs off the mouse to the right whichever way the wall runs", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "        const s0 = o && o.u2 < o.u1 ? at.s - w : at.s;",
    with: "        const s0 = at.s;",
    test: "+ Special rectangle" },
  { file: "EXTFINISH.html", name: "a new W stretches from the low s on every wall", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "        const anchor = o && o.u2 < o.u1 ? b.s1 : b.s0;",
    with: "        const anchor = b.s0;",
    test: "+ Special rectangle" },
  { file: "EXTFINISH.html", name: "a drag does not move the special", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "        else if (inside(pts, x, y)) specialDrag = { kind: 'move', from: shOf(wall, x, y), pts: sp.pts.map(q => ({ ...q })) };",
    with: "",
    test: "+ Special rectangle" },
  { file: "EXTFINISH.html", name: "the wall's own end does not catch a corner", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "        let sx = near([own.u1, own.u2], px, X);",
    with: "        let sx = null;",
    test: "+ Special shape" },
  { file: "EXTFINISH.html", name: "the wall's own corners do not take priority", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "        const corner = closest(ownPts);",
    with: "        const corner = null;",
    test: "+ Special shape" },
  { file: "EXTFINISH.html", name: "a press on the drawing leaves the W box focused", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "        if (typing && /^(INPUT|SELECT|TEXTAREA)$/.test(typing.tagName)) typing.blur();",
    with: "",
    test: "+ Special rectangle" },
  { file: "EXTFINISH.html", name: "a drag on the picked special pans the view too",
    find: "          event.stopImmediatePropagation();\n          try { canvas.setPointerCapture(event.pointerId); } catch { /* gone already */ }\n        }\n      }, true);",
    with: "        }\n      }, true);",
    test: "zoomed in" },
  { file: "EXTFINISH.html", name: "clicking the first corner does not close the shape", spec: 'tests/ext-finish-special-shapes.spec.js',
    find: "          if (first && specialDraft.length >= 3 && Math.hypot(first.x - x, first.y - y) <= SNAP_PX) {",
    with: "          if (false) {",
    test: "+ Special shape" },
];

const run = (name, spec) => {
  try {
    execSync(`npx playwright test ${spec || SPECS.join(' ')} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: process.env.DRAFT_TEST_PORT || '4465' } });
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
  let result = run(m.test, m.spec);
  let note = '';
  if (result === 'passed' && run(null, m.spec) === 'failed') {
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
