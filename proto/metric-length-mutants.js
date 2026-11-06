#!/usr/bin/env node
// MUTATION GATE for the LENGTH box on a metric drawing (tests/metric-length.spec.js).
//
// Movie, 6 Nov: "i switched to METRIC but the length box is still IMPERIAL".
// The box, the strip's readout and the cursor tag print in the drawing's
// unit, turn the moment the switch is pressed, and a bare number typed into
// the box on a metric drawing is metres; mm, cm and feet-inches still read.
//
// Run: node proto/metric-length-mutants.js   (refuses a dirty tree; restores from HEAD)
// DRAFT_PW_CONFIG names another Playwright config when the pinned browser is
// not the one installed (a cloud box with /opt/pw-browsers/chromium only).
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/metric-length.spec.js';
const MUTANTS = [
  { file: 'formatters.js', name: 'formatLength prints feet whatever the switch says',
    find: "    return units === 'metric' ? formatMetres(feet) : formatArchitecturalInches(feet * 12);\n",
    with: "    return formatArchitecturalInches(feet * 12);\n",
    test: 'read metres on a metric drawing' },
  { file: 'model/13-suites-trim-follow.js', name: 'the box ignores the drawing\'s unit',
    find: "  const feetLabel = ft => F.formatLength(ft, drawing?.units);\n",
    with: "  const feetLabel = ft => F.formatLength(ft, 'imperial');\n",
    test: 'read metres on a metric drawing' },
  { file: 'model/05-props-shelves-rail.js', name: 'the switch waits for the hand to move',
    find: "    stripRefresh();\n    syncDrawLength();\n    paint();\n  }));",
    with: "    paint();\n  }));",
    test: 'turns the box at once' },
  { file: 'formatters.js', name: 'a bare metric number is read as feet',
    find: "    if (units !== 'metric') return parseArchitecturalLength(value);\n    const raw",
    with: "    if (units !== 'nothing') return parseArchitecturalLength(value);\n    const raw",
    test: 'a bare number is metres' },
  { file: 'formatters.js', name: 'mm and cm are read as metres',
    find: "      const metres = Number(match[1]) * METRES_PER_UNIT[(match[2] || 'm').toLowerCase()];\n",
    with: "      const metres = Number(match[1]);\n",
    test: 'mm says millimetres' },
  { file: 'formatters.js', name: 'the typed metres are snapped to the sixteenth-inch',
    find: "      return { ok: true, inches: metres / 0.0254 };\n",
    with: "      return architecturalLengthResult(metres / 0.0254);\n",
    test: 'a bare number is metres' },
  { file: 'formatters.js', name: 'feet-inches are refused on a metric drawing',
    find: "    const imperial = parseArchitecturalLength(value);\n    if (imperial.ok) return imperial;\n",
    with: "",
    test: 'feet and inches still read' },
  { file: 'model/14-promotion-tools.js', name: 'ENTER on a run reads the box the imperial way',
    find: "    const parsed = readLength(lengthBox.value);\n    if (!parsed.ok) { stripMessage.textContent = parsed.error; return; }\n    const feet = parsed.inches / 12;\n    if (!(feet > 0) || !drawStart || !cursorWorld) return;\n",
    with: "    const parsed = F.parseArchitecturalLength(lengthBox.value);\n    if (!parsed.ok) { stripMessage.textContent = parsed.error; return; }\n    const feet = parsed.inches / 12;\n    if (!(feet > 0) || !drawStart || !cursorWorld) return;\n",
    test: 'a bare number is metres' },
];
const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (process.env.DRAFT_PW_CONFIG ? ` -c ${JSON.stringify(process.env.DRAFT_PW_CONFIG)}` : '')
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4471' } });
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
