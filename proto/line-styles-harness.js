#!/usr/bin/env node
// LINE STYLES (line-styles.js): six named weights thin to thick, four dash
// styles, a colour made safe, and the DXF linetype for what was stroked.
//
// Run: node proto/line-styles-harness.js
//      node proto/line-styles-harness.js --mutate
const MUTATE = require('./harness-args.js').mutationMode();
const path = require('path');
const H = require('./harness-env.js');
const ROOT = path.join(__dirname, '..');
const MUTATIONS = [
  ['five weights, not six', 'line-styles.js',
    c => c.replace("    Object.freeze({ id: 6, name: 'XTRA-BOLD', px: 4.5 }),\n", '')],
  ['the weights are not thin to thick', 'line-styles.js',
    c => c.replace("{ id: 4, name: 'HEAVY', px: 2.5 }", "{ id: 4, name: 'HEAVY', px: 1.2 }")],
  ['an unknown weight is kept', 'line-styles.js',
    c => c.replace('const weightId = raw => (weightOf(raw) ? Number(raw) : DEFAULT_WEIGHT);', 'const weightId = raw => Number(raw) || DEFAULT_WEIGHT;')],
  ['a three-digit colour is refused', 'line-styles.js',
    c => c.replace("    if (/^#[0-9a-f]{3}$/.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;\n", '')],
  ['a dash does not scale with the weight', 'line-styles.js',
    c => c.replace('dash: s.dash.map(d => d * Math.max(1, k) * inkScale)', 'dash: s.dash.slice()')],
  ['a dot dash goes out DASHED', 'line-styles.js',
    c => c.replace("    if (d.length >= 4) return 'CENTER';\n", '')],
];
if (MUTATE) {
  const all = require('./mutant-subprocess.js').runMutations('line-styles',
    MUTATIONS, { root: ROOT, harness: __filename });
  process.exit(all ? 0 : 1);
}
let ran = 0, failed = 0;
const check = (label, got, want) => {
  ran += 1;
  if (String(got) === String(want)) return;
  failed += 1;
  console.log(`  FAIL ${label}\n       got  ${got}\n       want ${want}`);
};
const run = () => {
  const win = H.loadDraftModules();
  const L = win.DraftLineStyles;
  const F = win.DraftDrawingFormat;
  check('six weights', L.WEIGHTS.length, 6);
  check('named thin to thick', L.WEIGHTS.map(w => w.name).join(','), 'HAIR,FINE,MEDIUM,HEAVY,BOLD,XTRA-BOLD');
  check('each thicker than the last', L.WEIGHTS.every((w, i) => i === 0 || w.px > L.WEIGHTS[i - 1].px), true);
  check('XTRA-BOLD is 4.5', L.weightOf(6).px, 4.5);
  check('four styles', L.STYLES.map(s => s.id).join(','), 'solid,dashed,dotdash,dotted');
  check('an unknown weight falls to FINE', L.weightId(9), 2);
  check('a weight comes as a string too', L.weightId('5'), 5);
  check('an unknown style falls to solid', L.styleId('wavy'), 'solid');
  check('a colour is lower-cased', L.colorHex('#FF0000'), '#ff0000');
  check('a short colour is spelt out', L.colorHex('#f80'), '#ff8800');
  check('a word is no colour', L.colorHex('red'), null);
  const bold = L.strokeFor({ weight: 5, style: 'dashed', color: '#00AAff' });
  check('a bold dashed line strokes at 3.5 with its dash scaled', `${bold.lineWidth} ${bold.dash.join(',')} ${bold.color}`, '3.5 28,17.5 #00aaff');
  const plain = L.strokeFor({});
  check('a line with nothing set is FINE and solid in the skin\'s ink', `${plain.lineWidth} ${plain.dash.length} ${plain.color}`, '1 0 null');
  check('print scales the ink', L.strokeFor({ weight: 2 }, { inkScale: 2 }).lineWidth, 2);
  check('CONTINUOUS for no dash', L.dxfLinetypeForDash([]), 'CONTINUOUS');
  check('DASHED for a dash', L.dxfLinetypeForDash([8, 5]), 'DASHED');
  check('CENTER for a dot dash', L.dxfLinetypeForDash([12, 5, 2, 5]), 'CENTER');
  check('DOT for dots', L.dxfLinetypeForDash([2, 4]), 'DOT');
  check('an even 4,4 is DASHED', L.dxfLinetypeForDash([4, 4]), 'DASHED');
  // AND THE FORMAT KEEPS THE THREE FIELDS, bounded by this table.
  if (F && F.lines) {
    const read = raw => F.lines([{ id: 'l', start: { x: 0, z: 0 }, end: { x: 5, z: 0 }, levelId: 3, view: 'plan', ...raw }], new Set([3]))[0];
    const kept = read({ weight: 5, style: 'dotdash', color: '#FF8800' });
    check('the format keeps weight, style and colour', `${kept.weight} ${kept.style} ${kept.color}`, '5 dotdash #ff8800');
    const bad = read({ weight: 9, style: 'wavy', color: 'orange' });
    check('and drops what the table does not know', `${bad.weight} ${bad.style} ${bad.color}`, 'undefined undefined undefined');
    const old = read({});
    check('a line from before carries none of the three', 'weight' in old || 'style' in old || 'color' in old, false);
  } else {
    check('the format exposes its line reader to this harness', typeof (F && F.lines), 'function');
  }
};
run();
console.log(`line-styles: ${ran} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
