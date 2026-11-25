#!/usr/bin/env node
// MUTATION GATE for a hologram on a zoomed MODEL elevation (jb, 25 Nov 2026:
// "when i zoom in and out of the elevations weird stuff happens ... on the
// edges left and right"): the holograms behind the house are clipped to the
// same room inside the margins the house is, so no zoom shows them running
// on under the level readings or the rails.
//
//   node proto/hologram-zoom-clip-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/model-html-hologram.spec.js';
const TEST = 'clipped where the house is';

const MUTANTS = [
  { file: 'cut-view.js',
    name: 'the elevation hands the underlay no room to stay in',
    find: '    if (runUnderlay(opts, { x0, y0, pxPerFt, uMin, yTop, external: Boolean(fit) }, ctx, viewRoom)) return true;',
    with: '    if (runUnderlay(opts, { x0, y0, pxPerFt, uMin, yTop, external: Boolean(fit) })) return true;' },
  { file: 'cut-view.js',
    name: 'the underlay is handed the room and ignores it',
    find: '    if (ctx && clip) {\n      ctx.save();\n      ctx.beginPath();\n      ctx.rect(clip.x, clip.y, Math.max(0, clip.w), Math.max(0, clip.h));\n      ctx.clip();\n    }\n',
    with: '    if (ctx && clip) {\n      ctx.save();\n    }\n' },
];

const run = () => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line -g ${JSON.stringify(TEST)}`,
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, DRAFT_TEST_PORT: process.env.DRAFT_TEST_PORT || '4598' } });
    return 'passed';
  } catch { return 'failed'; }
};

const FILES = [...new Set(MUTANTS.map(m => m.file))];
const dirty = execSync(`git status --porcelain ${FILES.join(' ')}`, { cwd: ROOT }).toString().trim();
if (dirty) {
  console.error('REFUSING TO RUN: uncommitted changes; this restores from HEAD.\n' + dirty);
  process.exit(2);
}
if (run() !== 'passed') { console.error('the spec fails on HEAD; nothing to gate'); process.exit(2); }
let survived = 0;
MUTANTS.forEach(m => {
  const path = `${ROOT}/${m.file}`;
  const src = fs.readFileSync(path, 'utf8');
  if (src.split(m.find).length !== 2) { console.error(`anchor not unique/missing: ${m.name}`); process.exit(2); }
  fs.writeFileSync(path, src.replace(m.find, m.with));
  const r = run();
  execSync(`git checkout -- ${m.file}`, { cwd: ROOT });
  console.log(`${r === 'failed' ? 'KILLED  ' : 'SURVIVED'} ${m.name}`);
  if (r !== 'failed') survived += 1;
});
console.log(survived ? `${survived} survived` : 'all killed');
process.exit(survived ? 1 : 0);
