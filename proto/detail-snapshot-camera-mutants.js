// DOES ANYTHING CATCH A CAMERA THAT TAKES THE WRONG PICTURE?
//
// jb, 20 Nov 2026: "make a 'square' area and take a 'snapshot' of the
// elevation or section" -- "copies the lines over so they can be edited" --
// "lets call it DETAIL SNAPSHOT and make it camera".
//
// Every wrong camera still takes a picture. One in feet where inches were
// meant, upside down, off centre, of the whole view instead of the box, with
// the far wall showing through the near one, at the screen's zoom instead of
// the house's size: each files a DXF, counts it in the tray and says so on
// the strip. So each is a mutant here, and so are the ways the gesture can
// go wrong while the picture is right -- a tap that ends the box, a drag
// that does not, an ESC that leaves it up.
//
// TWO WITNESSES, AND EACH MUTANT NAMES ITS OWN. The browser spec lays the
// filed picture back over the screen; the two node harnesses pin the
// arithmetic and the hidden-line cut with no browser at all. A mutant aimed
// at the spec is run against the one test that should see it; one aimed at
// a harness is run against that harness.
//
// THE TABLE IS PLAIN DATA, harness paths spelled out in full on every row:
// proto/mutant-anchors-harness.js slices it out of this file and reads it
// without running the file, and a name defined outside the table is a name
// it cannot see.
//
// THE BASELINE RUNS FIRST AND ABORTS THE GATE. A mutant counts as KILLED
// when its witness fails, so a witness that is already red kills everything
// and prints a perfect sheet over broken code.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/detail-snapshot-camera.spec.js';
const WRITER = 'proto/dxf-writer-harness.js';
const CAMERA = 'proto/detail-snapshot-harness.js';

const MUTANTS = [
  // ── WHAT THE PICTURE IS MEASURED IN ──────────────────────────────────────
  { file: 'detail-snapshot.js',
    name: 'the picture is in FEET: a wall eight feet long comes into a detail eight inches long',
    find: '    const inPerPx = 12 / fine.pxPerFt;',
    with: '    const inPerPx = 1 / fine.pxPerFt;',
    test: 'a box dragged on an elevation files what the screen shows' },

  { file: 'detail-snapshot.js',
    name: 'the picture is upside down: a canvas runs y down, a drawing y up, and nothing turned it over',
    find: '      ([x, y]) => [(x - cx) * inPerPx, (cy - y) * inPerPx]));',
    with: '      ([x, y]) => [(x - cx) * inPerPx, (y - cy) * inPerPx]));',
    test: 'a box dragged on an elevation files what the screen shows' },

  { file: 'detail-snapshot.js',
    name: 'the picture is measured from the box\'s corner, not its middle, so it lands half a box off the frame it is dropped in',
    find: '    const cx = px.x + px.w / 2, cy = px.y + px.h / 2;',
    with: '    const cx = px.x, cy = px.y + px.h / 2;',
    test: 'a box dragged on an elevation files what the screen shows' },

  { file: 'detail-snapshot.js',
    name: 'the box is not set as the clip: the camera files the whole view, whatever was boxed',
    find: '    ctx.rect(px.x, px.y, px.w, px.h);\n    ctx.clip();',
    with: '    ctx.rect(px.x, px.y, px.w, px.h);',
    test: 'a box dragged on an elevation files what the screen shows' },

  { file: 'detail-snapshot.js',
    name: 'nothing is hidden: the back wall\'s windows come through the front elevation',
    find: "    const ctx = W.recorder({ width: width * k, height: height * k, layer: 'SNAPSHOT', hide: true });",
    with: "    const ctx = W.recorder({ width: width * k, height: height * k, layer: 'SNAPSHOT' });",
    test: 'a box dragged on an elevation files what the screen shows' },

  { file: 'detail-snapshot.js',
    name: 'the same, seen by the harness: the level line runs on through the house',
    find: "    const ctx = W.recorder({ width: width * k, height: height * k, layer: 'SNAPSHOT', hide: true });",
    with: "    const ctx = W.recorder({ width: width * k, height: height * k, layer: 'SNAPSHOT' });",
    harness: 'proto/detail-snapshot-harness.js' },

  // ── A CLEAN LINE, AND A TRUE ONE ─────────────────────────────────────────
  //
  // jb, 20 Nov: "the roof lines look kindof scratchy what is that ? how come
  // not crisp clean line?"
  { file: 'detail-snapshot.js',
    name: 'the picture is taken at the screen\'s own scale: every point is on a screen pixel, most of an inch out, and a roof zigzags',
    find: '    const k = Math.max(1, Math.ceil(FINE_PX_PER_FT / frame.pxPerFt));',
    with: '    const k = 1;',
    harness: 'proto/detail-snapshot-harness.js' },

  { file: 'detail-snapshot.js',
    name: 'what lies on one line is left as the pieces it was drawn in: forty steps up a roof, and the edge over them',
    find: '    const entities = tidy(W.mapEntities(ctx.entities,\n      ([x, y]) => [(x - cx) * inPerPx, (cy - y) * inPerPx]));',
    with: '    const entities = (W.mapEntities(ctx.entities,\n      ([x, y]) => [(x - cx) * inPerPx, (cy - y) * inPerPx]));',
    harness: 'proto/detail-snapshot-harness.js' },

  { file: 'detail-snapshot.js',
    name: 'two pieces on one line are joined across the gap between them: a sill runs on through the opening beside it',
    find: '            const hit = spans.filter(sp => t0 <= sp[1] + tol && t1 >= sp[0] - tol);',
    with: '            const hit = spans.filter(sp => t0 <= sp[1] + 1e6 && t1 >= sp[0] - 1e6);',
    harness: 'proto/detail-snapshot-harness.js' },

  { file: 'detail-snapshot.js',
    name: 'a dashed line is swallowed by a solid one on the same line: what was hidden reads as seen',
    find: "  const styleOf = e => `${e.layer}|${e.linetype || ''}|${e.dashed ? 1 : 0}|${e.color ?? ''}`;",
    with: "  const styleOf = e => `${e.layer}`;",
    harness: 'proto/detail-snapshot-harness.js' },

  { file: 'detail-snapshot.js',
    name: 'the frame is made finer but the box is not: the picture is of the top-left corner of the sheet',
    find: '    const px = { x: box.px.x * k, y: box.px.y * k, w: box.px.w * k, h: box.px.h * k };',
    with: '    const px = { x: box.px.x, y: box.px.y, w: box.px.w, h: box.px.h };',
    test: 'a box dragged on an elevation files what the screen shows' },

  { file: 'model/13-suites-trim-follow.js',
    name: 'the lettering is not multiplied with the sheet: a window\'s label comes into the detail a sixteenth its size',
    find: '          frame: at.frame, inkScale: at.scale, markScreen: true }) });',
    with: '          frame: at.frame, markScreen: true }) });',
    test: 'the lines come clean' },

  { file: 'detail-snapshot.js',
    name: 'the same two faults, seen on the house: steps up the gable, and lines kept twice',
    find: '    const entities = tidy(W.mapEntities(ctx.entities,\n      ([x, y]) => [(x - cx) * inPerPx, (cy - y) * inPerPx]));',
    with: '    const entities = (W.mapEntities(ctx.entities,\n      ([x, y]) => [(x - cx) * inPerPx, (cy - y) * inPerPx]));',
    test: 'the lines come clean' },

  // ── THE BOX ──────────────────────────────────────────────────────────────
  { file: 'detail-snapshot.js',
    name: 'the box is only a box from its top-left corner: dragged the other way it has no width and files nothing',
    find: '    const uMin = Math.min(a.u, b.u), uMax = Math.max(a.u, b.u);',
    with: '    const uMin = a.u, uMax = b.u;',
    test: 'and from the far corner back' },

  { file: 'detail-snapshot.js',
    name: 'any box will do: two presses on one spot file a picture of nothing',
    find: '  const bigEnough = box => !!box && box.widthFt >= MIN_FT && box.heightFt >= MIN_FT;',
    with: '  const bigEnough = box => !!box;',
    test: 'a slip is not a picture' },

  { file: 'model/13-suites-trim-follow.js',
    name: 'a box of blank paper is filed: a picture with no line in it sits in the tray',
    find: '    if (!taken || !taken.entities.length) {',
    with: '    if (!taken) {',
    test: 'a slip is not a picture' },

  // ── THE TRAY ─────────────────────────────────────────────────────────────
  { file: 'detail-snapshot.js',
    name: 'every picture is filed under one name, so the second replaces the first',
    find: '  const fileName = id => `${id}.json`;',
    with: "  const fileName = () => 'snapshot.json';",
    test: 'a snapshot changes nothing on the house it was taken of' },

  { file: 'detail-snapshot.js',
    name: 'the tray never lets a picture go: it grows in the browser\'s store for as long as the camera is used',
    find: '    const over = tray.splice(0, Math.max(0, tray.length - TRAY_MAX));',
    with: '    const over = tray.splice(0, 0);',
    test: 'the tray holds two dozen pictures' },

  { file: 'detail-snapshot.js',
    name: 'the tray drops the NEWEST past two dozen: the picture just taken is the one thrown away',
    find: '    const over = tray.splice(0, Math.max(0, tray.length - TRAY_MAX));',
    with: '    const over = tray.splice(TRAY_MAX);',
    test: 'the tray holds two dozen pictures' },

  // ── THE GESTURE ──────────────────────────────────────────────────────────
  { file: 'model/16-gestures-undo.js',
    name: 'lifting the button after a drag does nothing: the box he dragged just hangs there',
    find: "  canvas.addEventListener('pointerup', e => { if (elevSnapPress) elevSnapLift(e); });\n",
    with: '',
    test: 'a box dragged on an elevation files what the screen shows' },

  { file: 'model/13-suites-trim-follow.js',
    name: 'a tap ends the box: the first press takes a picture of nothing and two presses never make one',
    find: '    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) <= 8) return;\n    const rect = canvas.getBoundingClientRect();\n    const lift = elevAt(',
    with: '    const rect = canvas.getBoundingClientRect();\n    const lift = elevAt(',
    test: 'two presses make the box as well as a drag does' },

  { file: 'model/13-suites-trim-follow.js',
    name: 'the box in hand is not drawn: he drags blind',
    find: "    if (activeTool === 'snapshot' && elevSnapStart) {\n      const a = elevSnapStart, b = elevCursor;",
    with: "    if (activeTool === 'snapshot' && elevSnapStart && false) {\n      const a = elevSnapStart, b = elevCursor;",
    test: 'the box shows while it is in hand' },

  { file: 'model/16-gestures-undo.js',
    name: 'ESC leaves the box up',
    find: '    elevLineStart = null;\n    elevSnapStart = null;\n    elevSnapPress = null;\n    elevNotePress = null;',
    with: '    elevLineStart = null;\n    elevNotePress = null;',
    test: 'the box shows while it is in hand' },

  // ── WHICH DRAWING IT IS A PICTURE OF ─────────────────────────────────────
  { file: 'model/13-suites-trim-follow.js',
    name: 'the camera repaints the view FITTED, not as it stands on the screen: zoomed in, the box is laid on a different drawing',
    find: '          frame: at.frame, inkScale: at.scale, markScreen: true }) });',
    with: '          cushion: 0.1, inkScale: at.scale, markScreen: true }) });',
    test: 'zoomed in on the elevation' },

  { file: 'model/13-suites-trim-follow.js',
    name: 'an elevation is filed as a section and a section as an elevation',
    find: "      kind: autoElevationCuts().some(c => c.name === cut.name) ? 'elevation' : 'section',",
    with: "      kind: autoElevationCuts().some(c => c.name === cut.name) ? 'section' : 'elevation',",
    test: 'a section is photographed the same way' },

  { file: 'model/13-suites-trim-follow.js',
    name: 'armed on a plan the camera says nothing, and reads as a key that does not work',
    find: "    if (next === 'snapshot') {\n      sayOnStrip(drawing && activeCut() ? SNAPSHOT_READY",
    with: "    if (next === 'snapshot' && activeCut()) {\n      sayOnStrip(drawing && activeCut() ? SNAPSHOT_READY",
    test: 'on a plan the camera says where it works' },

  // ── THE KEY ──────────────────────────────────────────────────────────────
  { file: 'tool-icons.js',
    name: 'the circle is not in the middle of the square',
    find: '    snapshot: \'<rect x="4" y="4" width="16" height="16" /><circle cx="12" cy="12" r="4.5" />\',',
    with: '    snapshot: \'<rect x="4" y="4" width="16" height="16" /><circle cx="9" cy="12" r="4.5" />\',',
    test: 'the camera is a key in the drafting column' },

  { file: 'tool-icons.js',
    name: 'the key is drawn as a rectangle, not a square',
    find: '    snapshot: \'<rect x="4" y="4" width="16" height="16" /><circle cx="12" cy="12" r="4.5" />\',',
    with: '    snapshot: \'<rect x="4" y="6" width="16" height="12" /><circle cx="12" cy="12" r="4.5" />\',',
    test: 'the camera is a key in the drafting column' },

  { file: 'tool-roster.js',
    name: 'the camera is put with the BUILD keys, where nobody drafting a detail will look',
    find: "    { id: 'snapshot',     name: 'DETAIL SNAPSHOT', group: 'draw', kind: 'contextual', command: null },",
    with: "    { id: 'snapshot',     name: 'DETAIL SNAPSHOT', group: 'build', kind: 'contextual', command: null },",
    test: 'the camera is a key in the drafting column' },

  // ── WHAT AN OPAQUE FILL HIDES (dxf-writer.js, `hide`) ────────────────────
  { file: 'dxf-writer.js',
    name: 'hiding is ON for everyone: LAYOUT\'s DXF for the engineer changes under him without being asked',
    find: "  function recorder({ width = 1000, height = 1000, layer = '0', hide = false } = {}) {",
    with: "  function recorder({ width = 1000, height = 1000, layer = '0', hide = true } = {}) {",
    harness: 'proto/dxf-writer-harness.js' },

  { file: 'dxf-writer.js',
    name: 'a tint hides like a wall: every line under a tenth of grey is cut out of the picture',
    find: '      return !!c && c[3] * state.globalAlpha >= 0.9;',
    with: '      return !!c && c[3] * state.globalAlpha >= 0;',
    harness: 'proto/dxf-writer-harness.js' },

  { file: 'dxf-writer.js',
    name: 'a line along the EDGE of a fill is cut out with what is under it: walls lose the edges the next wall was laid on',
    find: '    if (!inRegion(fill, x, y) || edgeDistance(fill, x, y) <= HIDE_EDGE) return false;',
    with: '    if (!inRegion(fill, x, y) && edgeDistance(fill, x, y) > HIDE_EDGE) return false;',
    harness: 'proto/dxf-writer-harness.js' },

  { file: 'dxf-writer.js',
    name: 'the same, seen on a real elevation: lines the screen shows are missing from the picture',
    find: '    if (!inRegion(fill, x, y) || edgeDistance(fill, x, y) <= HIDE_EDGE) return false;',
    with: '    if (!inRegion(fill, x, y) && edgeDistance(fill, x, y) > HIDE_EDGE) return false;',
    test: 'a box dragged on an elevation files what the screen shows' },

  { file: 'dxf-writer.js',
    name: 'a fill hides the whole of what it was traced round, clip or no clip: a gable\'s fill takes out what stands beside the gable',
    find: '    return clips.every(c => inRegion(c, x, y) && edgeDistance(c, x, y) > HIDE_EDGE);',
    with: '    return true;',
    harness: 'proto/dxf-writer-harness.js' },

  { file: 'dxf-writer.js',
    name: 'fillRect hides nothing: only a traced path does, and a painter uses both',
    find: '      fillRect(x, y, w, h) {\n        if (!hide) return;',
    with: '      fillRect(x, y, w, h) {\n        if (hide || !hide) return;',
    harness: 'proto/dxf-writer-harness.js' },

  { file: 'dxf-writer.js',
    name: 'a word or a dot behind a wall still comes through it',
    find: '      if (at && hiddenAt(at[0], at[1], fill, clips)) return;',
    with: '      if (at && false) return;',
    harness: 'proto/dxf-writer-harness.js' },

  { file: 'dxf-writer.js',
    name: 'a closed shape cut by a wall comes back in three pieces, split where it happened to start',
    find: '    if (closed && runs.length > 1) {',
    with: '    if (closed && runs.length > 1 && false) {',
    harness: 'proto/dxf-writer-harness.js' },

  { file: 'dxf-writer.js',
    name: 'an arc partly behind a wall is kept whole',
    find: "        const runs = showingRuns(pts, false, fill, clips);\n        if (!runs) { out.push(e); return; }\n        const { cx, cy, r, a0, sweep, type, ...rest } = e;",
    with: "        const runs = null;\n        if (!runs) { out.push(e); return; }\n        const { cx, cy, r, a0, sweep, type, ...rest } = e;",
    harness: 'proto/dxf-writer-harness.js' },
];

const FILES = [...new Set(MUTANTS.map(m => m.file))];

const runSpec = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line --trace off`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4393' } });
    return 'passed';
  } catch { return 'failed'; }
};
const runHarness = file => {
  try { execSync(`node ${file}`, { cwd: ROOT, stdio: 'pipe' }); return 'passed'; }
  catch { return 'failed'; }
};
const run = m => (m.harness ? runHarness(m.harness) : runSpec(m.test));

// EVERY FILE THIS GATE MUTATES, checked BEFORE the baseline rather than after:
// the restore is `git checkout -- <file>`, so uncommitted work in a mutated
// file is destroyed the first time a mutant touches it, and a guard that fires
// only afterwards lets you walk away believing the gate is running.
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`,
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

{
  const clean = [['the spec', runSpec(null)], [WRITER, runHarness(WRITER)], [CAMERA, runHarness(CAMERA)]];
  const red = clean.filter(([, result]) => result !== 'passed');
  if (red.length) {
    console.log(`REFUSING TO RUN: already failing before any mutant is applied: ${red.map(r => r[0]).join(', ')}.`
      + '\nEvery mutant would read as KILLED and the sheet would be a lie. Fix that first.');
    process.exit(1);
  }
  console.log('baseline: the spec and both harnesses pass unmutated\n');
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  // UNIQUE OR NOT AT ALL. An anchor that matches twice mutates the first
  // match, which on another gate was the wrong call site and read SURVIVED.
  if (before.split(m.find).length !== 2) {
    console.log(`  SKIPPED   ${m.name}  (anchor ${before.includes(m.find) ? 'matches more than once' : 'not found'} — re-aim \`find\`)`);
    ambiguous += 1;
    continue;
  }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m);
  let note = '';
  // A mutant its own witness missed may still be caught by another check in
  // the same witness: that is a KILL, but the mutant is aimed wrong.
  if (result === 'passed' && !m.harness && runSpec(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check — re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}

// READ AGAINST WHAT WAS DEFINED, never on its own: a SKIPPED mutant printed
// "10/10 killed" on another gate and read like a clean sheet.
console.log(`\n${killed}/${ran} killed, ${MUTANTS.length} defined`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
