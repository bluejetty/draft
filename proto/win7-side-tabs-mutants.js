#!/usr/bin/env node
// MUTATION GATE for the side tabs' words in blocks of their own (Movie, 23
// Oct, from Windows 7). Each row breaks one line, runs the one test that
// should notice, and restores the file from HEAD.
//
//   node proto/win7-side-tabs-mutants.js
const { execSync } = require('child_process');
const fs = require('fs');
const ROOT = require('path').resolve(__dirname, '..');

const SPEC = 'tests/win7-side-tabs.spec.js';

const MUTANTS = [
  { file: 'shell-bars.css',
    name: 'the block declares no turn of its own (an old build lays it flat)',
    find: "  .rail-tab-text { display:block; writing-mode:vertical-rl; }\n",
    with: "  .rail-tab-text { display:block; }\n",
    test: 'MODEL: each of the six tabs' },
  { file: 'shell-bars.css',
    name: 'the right edge\'s blocks run the left edge\'s way',
    find: "  #right-tab .rail-tab-text, #notes-tab .rail-tab-text, #history-tab .rail-tab-text { writing-mode:vertical-lr; }\n",
    with: "",
    test: 'MODEL: each of the six tabs' },
  { file: 'MODEL.html',
    name: 'DRAFTING is bare text in its button again',
    find: 'data-left-pane-tab="drafting" hidden><span class="rail-tab-text">DRAFTING</span></button>',
    with: 'data-left-pane-tab="drafting" hidden>DRAFTING</button>',
    test: 'MODEL: each of the six tabs' },
  { file: 'shell-bars.js',
    name: 'the shared bars build a tab with bare text',
    find: '        + `  title="${opts.title || label}"><span class="rail-tab-text">${label}</span></button>\\n`',
    with: '        + `  title="${opts.title || label}">${label}</button>\\n`',
    test: 'a page whose tab the shared bars build' },
  { file: 'MODEL.dc.html',
    name: 'the old page\'s left tab is bare text',
    find: 'title="{{ leftRailTabTitle }}"><span class="rail-tab-text">ROUGHDRAFTER - LITE - DRAFTING TOOLS</span></button>',
    with: 'title="{{ leftRailTabTitle }}">ROUGHDRAFTER - LITE - DRAFTING TOOLS</button>',
    test: 'the old page' },
];

const run = name => {
  try {
    execSync(`npx playwright test ${SPEC} --workers=1 --reporter=line`
      + (name ? ` -g ${JSON.stringify(name)}` : ''),
      { cwd: ROOT, stdio: 'pipe',
        env: { ...process.env, DRAFT_TEST_PORT: '4545' } });
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
