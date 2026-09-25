// DOES THE AUTO PILES SPEC CATCH A GARAGE LEFT STANDING ON NOTHING?
//
// The gate for tests/model-html-auto-piles.spec.js, in the shape its
// twenty-two siblings take: an ambiguous anchor is refused rather than
// guessed at, and a survivor is re-run against the whole spec before it is
// called one.
//
// THIS FEATURE'S FAILURE MODE IS SILENCE. A grade beam with no piles under it
// draws exactly like one with piles, from every angle the plan offers -- that
// is how MODEL.html shipped a default of "GRADE BEAM and PILES" with the
// piles missing and nobody saw it. So the mutants below are not typos; each
// one is a way to produce a drawing that looks finished and is not.
//
// AND TWO OF THEM ALREADY HAPPENED. `the beam sweep eats the piles` is the
// bug this branch actually hit -- eleven calculated, zero written, no error
// -- and `no dedup` is the one the harness caught at 19/20. They are kept
// because a bug that has occurred once is the cheapest prediction available
// of where the next one goes.
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const MUTANTS = [
  // ── THE FIRST PILE STANDS BACK FROM THE HOUSE (25 Sep) ──────────────────
  // Movie: "the first pile shouldn't effect the foundation/ footing so
  // therefore needs to be placed min 4'6 from the foundation wall". Its
  // failure mode is the same silence as the rest of this file: a pile drilled
  // against the footing draws exactly like one standing clear of it.
  { file: 'MODEL.html',
    name: 'the page stops asking for the standoff, so the first pile is back '
      + 'against the house footing',
    find: '      standoffFt: GARAGE_PILE_STANDOFF_FT,',
    with: '      standoffFt: 0,',
    test: 'an attached garage stands its first pile back from the house foundation' },
  { file: 'MODEL.html',
    name: 'the standoff shrinks to something that clears nothing',
    find: '  const GARAGE_PILE_STANDOFF_FT = 4.5;',
    with: '  const GARAGE_PILE_STANDOFF_FT = 0.5;',
    test: 'an attached garage stands its first pile back from the house foundation' },
  { file: 'build-house.js',
    name: 'the standoff is measured off the wrong end, so the pile stays on '
      + 'the house and the far corner moves instead',
    find: '      const head = skipped(before) ? standoff : 0;',
    with: '      const head = skipped(after) ? standoff : 0;',
    test: 'an attached garage stands its first pile back from the house foundation' },
  { file: 'build-house.js',
    name: 'every leg stands off, not just the ones meeting the house',
    find: '      const head = skipped(before) ? standoff : 0;',
    with: '      const head = standoff;',
    test: 'the piles ride the beam centreline, not the outline' },
  // ── TWO PILES TOO CLOSE TOGETHER ARE ONE PILE (25 Sep) ──────────────────
  { file: 'MODEL.html',
    name: 'the page stops asking for the gap, so two holes land 2 ft apart',
    find: '      minGapFt: GARAGE_PILE_MIN_GAP_FT,',
    with: '      minGapFt: 0,',
    test: 'two piles that would land within 3 ft become one between them' },
  { file: 'build-house.js',
    name: 'the close pair is merged but the survivor keeps one corner instead '
      + 'of standing between them',
    find: '      pts.splice(best.i, 1, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });',
    with: '      pts.splice(best.i, 1, { x: a.x, z: a.z });',
    test: 'two piles that would land within 3 ft become one between them' },
  { file: 'MODEL.html',
    name: 'THE DEFECT THIS FIXED: a grade-beam garage is built on nothing',
    find: "      if (kind === 'gradebeam') {",
    with: '      if (false) {',
    test: 'a built garage arrives on its piles, marked and on the foundation' },
  { file: 'MODEL.html',
    name: 'the beam sweep eats the piles again (the bug this branch hit)',
    find: '      if (!isMine(column) || isPile(column)) return true;',
    with: '      if (!isMine(column)) return true;',
    test: 'a built garage arrives on its piles, marked and on the foundation' },
  { file: 'MODEL.html',
    name: 'the piles sit on the outline instead of the wall centre',
    find: '    const spine = G.offsetOutline(ring, -wallFt / 2);',
    with: '    const spine = ring;',
    test: 'the piles ride the beam centreline, not the outline' },
  { file: 'MODEL.html',
    name: 'only the corners are piled, however long the leg',
    find: '      maxSpacingFt: GARAGE_PILE_SPACING_FT,',
    with: '      maxSpacingFt: 1000,',
    test: 'the piles ride the beam centreline, not the outline' },
  { file: 'MODEL.html',
    name: 'the pile carries no schedule mark, so the plan and SPECS disagree',
    find: '        pileMark: GARAGE_PILE_MARK,\n        auto: true,',
    with: '        auto: true,',
    test: 'a built garage arrives on its piles, marked and on the foundation' },
  { file: 'MODEL.html',
    name: 'the drawn diameter disagrees with the mark it carries',
    find: "  const GARAGE_PILE_FOOTING = 'pile12';",
    with: "  const GARAGE_PILE_FOOTING = 'pile10';",
    test: 'a built garage arrives on its piles, marked and on the foundation' },
  { file: 'MODEL.html',
    name: 'a frost wall is piled too, under concrete that carries its own footing',
    find: "      && garageFoundationOf(outline) === 'gradebeam');",
    with: "      && garageFoundationOf(outline) !== 'thickened');",
    test: 'a frost wall gets none, and the button says why' },
  { file: 'MODEL.html',
    name: 'a re-run lays a second set of piles on top of the first',
    find: '    const swept = [];\n    drawing.columns = (drawing.columns || []).filter(column => {\n'
      + '      const mine = column.auto === true\n'
      + '        && Number(column.levelId) === FOUNDATION_LEVEL_ID\n'
      + "        && column.view === 'foundation'\n"
      + "        && String(column.footing || '').startsWith('pile');\n"
      + '      if (mine) swept.push(column);\n      return !mine;\n    });',
    with: '    const swept = [];',
    test: 're-running replaces its own piles and leaves a drafter’s column alone' },
  { file: 'MODEL.html',
    name: 'the pile sweep takes the beam’s teleposts with it',
    find: "        && String(column.footing || '').startsWith('pile');",
    with: '        && true;',
    test: 're-running replaces its own piles and leaves a drafter’s column alone' },
  { file: 'MODEL.html',
    name: 'the leg on the house is piled, into concrete the house already carries',
    find: '      skipEdge: onHouse,',
    with: '      skipEdge: null,',
    test: 'an attached garage stands its first pile back from the house foundation' },
  { file: 'MODEL.html',
    name: 'the shared edge is tested on the moved spine, so no leg ever matches',
    // THE GUARD LINE COMES WITH IT. That `const a = ring[index]...` line is
    // WORD FOR WORD raiseRoofOver's gableEdge as well -- same question, same
    // ring, different function -- so the one-line anchor matched twice and
    // the anchor harness refused to guess. The `if (!shared)` above is what
    // tells the two apart; the roof's reads `sharedWith`.
    find: '      if (!shared) return false;\n'
      + '      const a = ring[index], b = ring[(index + 1) % ring.length];',
    with: '      if (!shared) return false;\n'
      + '      const a = spine[index], b = spine[(index + 1) % spine.length];',
    test: 'an attached garage stands its first pile back from the house foundation' },
  { file: 'build-house.js',
    name: 'no dedup, so every corner is piled twice (the one the harness caught)',
    find: '      if (out.some(pt => Math.hypot(pt.x - x, pt.z - z) < MERGE_FT)) return;',
    with: '',
    test: 'the piles ride the beam centreline, not the outline' },
  { file: 'build-house.js',
    name: 'the spacing packs instead of evening out: 9 ft and then a stub',
    find: '      const spans = Math.max(1, Math.ceil(usable / spacing));',
    with: '      const spans = Math.max(1, Math.floor(usable / spacing));',
    test: 'the piles ride the beam centreline, not the outline' },
  { file: 'drawing-format.js',
    name: 'the reader drops the mark, so it is gone one reload later',
    find: "        ...(footing.startsWith('pile')\n"
      + "          && ['P1', 'P2', 'P3'].includes(String(column?.pileMark || '').trim())\n"
      + '          ? { pileMark: String(column.pileMark).trim() } : {}),',
    with: '',
    test: 'every pile survives the reload, mark and all' },
  { file: 'drawing-format.js',
    name: 'a PAD is allowed a pile schedule mark, pointing at a row it has not got',
    find: "        ...(footing.startsWith('pile')\n"
      + "          && ['P1', 'P2', 'P3'].includes(String(column?.pileMark || '').trim())",
    with: "        ...((true)\n"
      + "          && ['P1', 'P2', 'P3'].includes(String(column?.pileMark || '').trim())",
    test: 'every pile survives the reload, mark and all' },
  { file: 'drawing-format.js',
    name: 'any string is taken for a mark, including one with no row',
    find: "          && ['P1', 'P2', 'P3'].includes(String(column?.pileMark || '').trim())",
    with: "          && String(column?.pileMark || '').trim() !== ''",
    test: 'every pile survives the reload, mark and all' },
];

const run = grep => {
  try {
    execSync('npx playwright test tests/model-html-auto-piles.spec.js'
      + (grep ? ` -g ${JSON.stringify(grep)}` : '') + ' --reporter=line',
      { cwd: ROOT, stdio: 'pipe' });
    return 'passed';
  } catch { return 'failed'; }
};

// THE GUARD COVERS EVERY FILE THE TABLE TOUCHES, not just MODEL.html. The
// siblings all mutate one file and check that one; this table reaches into
// build-house.js and drawing-format.js as well, and `git checkout --` would
// happily throw away a contributor's uncommitted work in either. Derived from
// the table so it cannot fall behind it.
const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`,
  { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(1);
}

let killed = 0, ran = 0, ambiguous = 0;
for (const m of MUTANTS) {
  const path = `${ROOT}/${m.file}`;
  const before = fs.readFileSync(path, 'utf8');
  const hits = before.split(m.find).length - 1;
  if (hits === 0) { console.log(`  SKIPPED (anchor not found): ${m.name}`); continue; }
  if (hits > 1) { console.log(`  AMBIGUOUS (${hits} matches): ${m.name}`); ambiguous += 1; continue; }
  ran += 1;
  fs.writeFileSync(path, before.replace(m.find, m.with));
  let result = run(m.test);
  let note = '';
  if (result === 'passed' && run(null) === 'failed') {
    result = 'failed'; note = '  (caught by another check -- re-aim `test`)';
  }
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  if (result === 'failed') killed += 1;
  console.log(`  ${result === 'failed' ? 'KILLED  ' : 'SURVIVED'}  ${m.name}${note}`);
}
console.log(`\n${killed}/${ran} killed`
  + (ambiguous ? `, ${ambiguous} AMBIGUOUS` : ''));
process.exit(killed === ran && ran === MUTANTS.length && !ambiguous ? 0 : 1);
