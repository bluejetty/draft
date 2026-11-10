#!/usr/bin/env node
// TURTLE PATH (Movie, 10 Nov): the direction and distance table in the NOTES
// pad, walked into points. turtle-path.js is pure, so its rules are proved
// here; the pad's wiring is tests/model-html-turtle.spec.js.
//
// Run: node proto/turtle-path-harness.js [--mutate|--coverage]
const MUTATE = require('./harness-args.js').mutationMode();
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'turtle-path.js');
const CALC = path.join(__dirname, '..', 'calc-engine.js');
const TEXT = fs.readFileSync(SRC, 'utf8');
const load = (mutate = s => s) => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(CALC, 'utf8'), { window });
  vm.runInNewContext(mutate(TEXT), { window });
  return { T: window.DraftTurtlePath, C: window.DraftCalc };
};

const CHECKS = [];
const check = (label, fn) => CHECKS.push({ label, fn });
const deg = (T, s) => { const d = T.parseDirection(s); return d ? d.deg : 'none'; };
const rows = list => list.map(([dir, dist]) => ({ dir, dist }));
const pt = p => `${+p.x.toFixed(3)},${+p.z.toFixed(3)}`;

// ── DIRECTIONS ───────────────────────────────────────────────────────────
check('N is 90, the way the ANGLE box counts', ({ T }) => [deg(T, 'N'), 90]);
check('E is 0, W 180, S 270', ({ T }) => [[deg(T, 'e'), deg(T, 'W'), deg(T, 's')].join(' '), '0 180 270']);
check('NW is 45 past north', ({ T }) => [deg(T, 'NW'), 135]);
check('the halves are 22.5 apart: NNE 67.5, ENE 22.5, WNW 157.5', ({ T }) => [[deg(T, 'NNE'), deg(T, 'ENE'), deg(T, 'WNW')].join(' '), '67.5 22.5 157.5']);
check("Movie's SWW is WSW, the letters in any order", ({ T }) => [[deg(T, 'SWW'), deg(T, 'WSW'), T.parseDirection('sww').word].join(' '), '202.5 202.5 WSW']);
check('NS and EW name nothing', ({ T }) => [[deg(T, 'NS'), deg(T, 'EW'), deg(T, 'NNNE')].join(' '), 'none none none']);
check('a plain number is degrees anticlockwise from east', ({ T }) => [[deg(T, '45'), deg(T, '22.5'), deg(T, '-90'), deg(T, '450')].join(' '), '45 22.5 270 90']);
check('a degree sign is allowed', ({ T }) => [deg(T, '30°'), 30]);
check('a bearing N 30 E is 30 from north toward east', ({ T }) => [[deg(T, 'N 30 E'), deg(T, 'N30E'), deg(T, 'N30W')].join(' '), '60 60 120']);
check('a bearing from south: S 45 W is 225, S45E 315', ({ T }) => [[deg(T, 'S 45 W'), deg(T, 'S45E')].join(' '), '225 315']);
check('a bearing past 90 is refused', ({ T }) => [deg(T, 'N 95 E'), 'none']);
check('L and R are square turns, L30 and R 45 turn by that much', ({ T }) => {
  const t = s => { const d = T.parseDirection(s); return d && d.kind === 'turn' ? d.turn : 'none'; };
  return [[t('L'), t('R'), t('L30'), t('r 45'), t('L-5')].join(' '), '90 -90 30 -45 none'];
});
check('words that are not a direction are refused', ({ T }) => [[deg(T, 'north'), deg(T, ''), deg(T, 'x')].join(' '), 'none none none']);
check('the compass word for an angle that has one', ({ T }) => [[T.compassWordOf(90), T.compassWordOf(202.5), T.compassWordOf(60)].map(String).join(' '), 'N WSW null']);

// ── DISTANCES, read by the calculator ────────────────────────────────────
check('86.86 is decimal feet', ({ T, C }) => [T.parseDistance('86.86', C), 86.86]);
check('feet and inches: 106-10 1/4', ({ T, C }) => [+T.parseDistance('106-10 1/4', C).toFixed(6), +(106 + 10.25 / 12).toFixed(6)]);
check("12'6\" is twelve and a half feet", ({ T, C }) => [T.parseDistance(`12'6"`, C), 12.5]);
check('metres read on either setting', ({ T, C }) => [+T.parseDistance('3.048m', C).toFixed(6), 10]);
check('a bare number is metres on METRIC', ({ T, C }) => [+T.parseDistance('1', C, { metric: true }).toFixed(6), +(C.FT_PER_M).toFixed(6)]);
check("a sum is a distance: 12' x 2", ({ T, C }) => [T.parseDistance("12' x 2", C), 24]);
check('an area, nothing, a minus and words are refused', ({ T, C }) => [[T.parseDistance('12 x 10', C), T.parseDistance('', C), T.parseDistance("-5'", C), T.parseDistance('far', C)].map(String).join(' '), 'null null null null']);

// ── THE WALK ─────────────────────────────────────────────────────────────
check('a square walked W N E S comes home and CLOSES', ({ T, C }) => {
  const w = T.walk(rows([['W', '100'], ['N', '50'], ['E', '100'], ['S', '50']]), { x: 10, z: 20 }, { calc: C });
  return [`${w.points.map(pt).join(' | ')} gap ${w.gapFt} ${w.closed}`, '10,20 | -90,20 | -90,-30 | 10,-30 | 10,20 gap 0 true'];
});
check('north is -z on the plan, east is +x', ({ T, C }) => {
  const w = T.walk(rows([['N', '10'], ['E', '5']]), { x: 0, z: 0 }, { calc: C });
  return [w.points.map(pt).join(' | '), '0,0 | 0,-10 | 5,-10'];
});
check('45 steps equal parts east and north', ({ T, C }) => [pt(T.walk(rows([['NE', '10']]), { x: 0, z: 0 }, { calc: C }).points[1]), '7.071,-7.071']);
check("Movie's lot: W 86.86 N 106.87 E 106.86 S 106.87 is OPEN by 20 feet", ({ T, C }) => {
  const w = T.walk(rows([['W', '86.86'], ['N', '106.87'], ['E', '106.86'], ['S', '106.87']]), { x: 0, z: 0 }, { calc: C });
  return [`${+w.gapFt.toFixed(3)} ${w.closed}`, '20 false'];
});
check('within an inch of home still closes', ({ T, C }) => {
  const w = T.walk(rows([['W', '100'], ['N', '50'], ['E', '100'], ['S', '50.05']]), { x: 0, z: 0 }, { calc: C });
  return [`${+w.gapFt.toFixed(3)} ${w.closed}`, '0.05 true'];
});
check('two legs back and forth never count as closed', ({ T, C }) => [T.walk(rows([['N', '10'], ['S', '10']]), { x: 0, z: 0 }, { calc: C }).closed, false]);
check('blank rows are skipped, bad rows reported and skipped', ({ T, C }) => {
  const w = T.walk(rows([['N', '10'], ['', ''], ['NS', '5'], ['E', 'far'], ['E', '5']]), { x: 0, z: 0 }, { calc: C });
  return [`${w.legs.map(l => l.row).join(',')} bad ${w.bad.map(b => `${b.row}${b.dir ? 'd' : ''}${b.dist ? 'l' : ''}`).join(',')}`, '0,4 bad 2d,3l'];
});
check('each leg knows its row, angle, length and ends', ({ T, C }) => {
  const l = T.walk(rows([['W', '20']]), { x: 5, z: 5 }, { calc: C }).legs[0];
  return [`${l.row} ${l.deg} ${l.ft} ${pt(l.from)} ${pt(l.to)}`, '0 180 20 5,5 -15,5'];
});
check('a turn works from the last move: N 10 then R 90 goes east', ({ T, C }) => {
  const w = T.walk(rows([['N', '10'], ['R', '5'], ['R', '10'], ['L45', '2']]), { x: 0, z: 0 }, { calc: C });
  return [`${w.points.map(pt).join(' | ')} / ${w.legs.map(l => l.deg).join(',')}`, '0,0 | 0,-10 | 5,-10 | 5,0 | 6.414,1.414 / 90,0,270,315'];
});
check('the first turn is from east', ({ T, C }) => [T.walk(rows([['L', '10']]), { x: 0, z: 0 }, { calc: C }).legs[0].deg, 90]);
check('a square walked by turns closes', ({ T, C }) => [T.walk(rows([['N', '10'], ['R', '10'], ['R', '10'], ['R', '10']]), { x: 0, z: 0 }, { calc: C }).closed, true]);
check('no legs: no gap, not closed', ({ T, C }) => { const w = T.walk([], { x: 0, z: 0 }, { calc: C }); return [`${w.gapFt} ${w.closed} ${w.points.length}`, 'null false 1']; });

// ── READING THE NOTES PAD ────────────────────────────────────────────────
check("Movie's note reads as four moves and drops the '- 20'", ({ T }) =>
  [JSON.stringify(T.rowsFromText('W 86.86 - 20\nN 106.87\nE 106.86  S 106.87')), '[{"dir":"W","dist":"86.86"},{"dir":"N","dist":"106.87"},{"dir":"E","dist":"106.86"},{"dir":"S","dist":"106.87"}]']);
check('feet-inches and a bearing with spaces read as one move each', ({ T }) =>
  [JSON.stringify(T.rowsFromText('N 30 E 50-6 1/2 line 9 west 111-10.25')), '[{"dir":"N30E","dist":"50-6 1/2"}]']);
check('a line with no move gives no row', ({ T }) => [T.rowsFromText('full width 367-10.25"').length, 0]);

// ── MUTATIONS ────────────────────────────────────────────────────────────
const MUTATIONS = [
  ['north counts clockwise', s => s.replace("E: 0, ENE: 22.5, NE: 45, NNE: 67.5, N: 90,", "E: 0, ENE: 22.5, NE: 45, NNE: 67.5, N: 270,")],
  ['the halves are quarters', s => s.replace("NNW: 112.5, NW: 135, WNW: 157.5,", "NNW: 112.5, NW: 135, WNW: 160,")],
  ['NNE and ENE are swapped', s => s.replace("else if (cNS === 2 && cEW === 1) word = ns + ns + ew;", "else if (cNS === 2 && cEW === 1) word = ew + ns + ew;")],
  ['N and S together are read', s => s.replace("if ((n.N && n.S) || (n.E && n.W)) return null;", "")],
  ['a bearing turns the wrong way', s => s.replace("const sign = (bearing[1] === 'N') === (bearing[3] === 'E') ? -1 : 1;", "const sign = (bearing[1] === 'N') === (bearing[3] === 'E') ? 1 : -1;")],
  ['a bearing past 90 is taken', s => s.replace("if (a > 90) return null;", "")],
  ['a plain number is not normalised', s => s.replace("return { deg: norm(Number(s)), kind: 'degrees' };", "return { deg: Number(s), kind: 'degrees' };")],
  ['an area passes as a distance', s => s.replace("    if (r.dim === 1) return r.v > 0 ? r.v : null;", "    if (r.dim >= 1) return r.v > 0 ? r.v : null;")],
  ['a minus distance passes', s => s.replace("    if (r.dim === 1) return r.v > 0 ? r.v : null;", "    if (r.dim === 1) return r.v;")],
  ['METRIC does not reach a bare number', s => s.replace("if (r.dim === 0) return r.v > 0 ? r.v * (opts.metric === true ? calc.FT_PER_M : 1) : null;", "if (r.dim === 0) return r.v > 0 ? r.v : null;")],
  ['north is +z', s => s.replace("at.z = Math.round((at.z - Math.sin(rad) * ft) * 1e6) / 1e6;", "at.z = Math.round((at.z + Math.sin(rad) * ft) * 1e6) / 1e6;")],
  ['a bad row is walked anyway', s => s.replace("if (!dir || ft === null) { bad.push({ row: i, dir: !dir, dist: ft === null }); return; }", "if (!dir || ft === null) { bad.push({ row: i, dir: !dir, dist: ft === null }); }")],
  ['a turn is from east every time', s => s.replace("      heading = deg;\n", "")],
  ['R turns left', s => s.replace("return { kind: 'turn', turn: turn[1] === 'L' ? by : -by };", "return { kind: 'turn', turn: by };")],
  ['two legs can close', s => s.replace("closed: legs.length >= 3 && gapFt <= closeFt", "closed: legs.length >= 2 && gapFt <= closeFt")],
  ['an inch off is open', s => s.replace("const CLOSE_FT = 1 / 12;", "const CLOSE_FT = 1 / 1200;")],
  ["the '- 20' is read as a move", s => s.replace("while (i < toks.length && isDist(toks[i])) { dist.push(toks[i]); i += 1; }", "while (i < toks.length && (isDist(toks[i]) || toks[i] === '-')) { dist.push(toks[i]); i += 1; }")],
];

const runChecks = env => CHECKS.map(({ label, fn }) => {
  let got, want;
  try { [got, want] = fn(env); } catch (err) { return { label, ok: false, got: `threw ${err.message}`, want: '' }; }
  return { label, ok: String(got) === String(want), got, want };
});

if (!MUTATE) {
  const results = runChecks(load());
  results.forEach(r => console.log(`${r.ok ? '  ok  ' : '  FAIL'}  ${r.label}${r.ok ? '' : `\n          got ${r.got}\n         want ${r.want}`}`));
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
} else {
  let survived = 0, broken = 0;
  MUTATIONS.forEach(([label, mutate]) => {
    if (mutate(TEXT) === TEXT) { broken += 1; console.log(`!!! NEVER APPLIED  ${label}`); return; }
    let env;
    try { env = load(mutate); } catch (err) { console.log(`caught (load)  ${label}`); return; }
    const caught = runChecks(env).filter(r => !r.ok);
    if (!caught.length) survived += 1;
    console.log(`${caught.length ? 'caught' : '*** SURVIVED'}  ${label}${caught.length ? `  <- ${caught[0].label}` : ''}`);
  });
  console.log(`\n${MUTATIONS.length - survived - broken}/${MUTATIONS.length} mutations caught`);
  process.exitCode = survived || broken ? 1 : 0;
}
