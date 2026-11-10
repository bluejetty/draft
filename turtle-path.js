// TURTLE PATH -- a table of moves, direction and distance, walked into points.
//
// Movie, 10 Nov: "look over in NOTES / CALC / was thinking of adding a column
// / TURTLE ... W 86.86 - 20 N 106.38 E 106.86 S 106.38 --- i'd like a 2
// column s, each row will be a new MOVE for the line. the user can put all
// his measurements in the rows, 1st column will be direct either N, NW (45),
// W (90), SWW (halfway 22.5 maybe), SW, S, or just put the angles in".
//
// This is the arithmetic and nothing else: no DOM, no drawing, so every rule
// here is proved in node (proto/turtle-path-harness.js). The page
// (model/04-levels-notes-bars.js) owns the table and the lines it draws.
//
// A DIRECTION is one of three spellings:
//   - a compass word, 16 points: N NE E SE S SW W NW and the halves NNE ENE
//     ESE SSE SSW WSW WNW NNW. The letters may come in any order ("SWW" is
//     WSW) because the count of each letter is what names the point.
//   - a bearing the way a survey writes it: N 30 E, S45W -- so many degrees
//     from north or south, toward east or west.
//   - a plain number: degrees the way the ANGLE box counts them, 0 east and
//     90 north, anticlockwise. 90 = N, 180 = W, 270 = S.
//   - a Logo turn, L or R with the degrees: L30 turns 30 left of the way the
//     last move went, R45 turns right; L or R alone is a square turn. The
//     first row's turn is from east, the ANGLE box's zero.
// The absolute three come out as one number, degrees anticlockwise from
// east, a turn as a change to the heading in hand, and
// the walk turns that into a step: x grows east, z grows SOUTH (north is
// -z on the plan, the way model/09's angle lock already steps).
//
// A DISTANCE is whatever the calculator reads: 86.86 is decimal feet,
// 106-10 1/4 is feet and inches, 32.5m is metres, 12 x 2 is 24 feet. The
// calculator is handed in (DraftCalc) so this file has no second parser.
if (!window.DraftTurtlePath) {
(() => {
  const COMPASS = {
    E: 0, ENE: 22.5, NE: 45, NNE: 67.5, N: 90, NNW: 112.5, NW: 135, WNW: 157.5,
    W: 180, WSW: 202.5, SW: 225, SSW: 247.5, S: 270, SSE: 292.5, SE: 315, ESE: 337.5,
  };
  // The point a bag of letters names, by how many of each it holds, so the
  // drafter's "SWW" and "WSW" are the same point. N and S together, or E and
  // W together, name nothing.
  const compassOfLetters = letters => {
    const n = {};
    letters.forEach(ch => { n[ch] = (n[ch] || 0) + 1; });
    if ((n.N && n.S) || (n.E && n.W)) return null;
    const ns = n.N ? 'N' : n.S ? 'S' : '';
    const ew = n.E ? 'E' : n.W ? 'W' : '';
    const cNS = n[ns] || 0, cEW = n[ew] || 0;
    let word;
    if (!ew) word = cNS === 1 ? ns : null;
    else if (!ns) word = cEW === 1 ? ew : null;
    else if (cNS === 1 && cEW === 1) word = ns + ew;
    else if (cNS === 2 && cEW === 1) word = ns + ns + ew;      // NNE: nearer north
    else if (cNS === 1 && cEW === 2) word = ew + ns + ew;      // ENE: nearer east
    else word = null;
    return word && word in COMPASS ? word : null;
  };
  const norm = deg => ((deg % 360) + 360) % 360;
  // Degrees anticlockwise from east, or null when the text names no direction.
  // Also says HOW it read the text, so the table can show N for 90 if asked.
  const parseDirection = text => {
    const s = String(text ?? '').trim().toUpperCase().replace(/[°º]/g, '');
    if (!s) return null;
    // A bearing: N 30 E, S45W, N30-30E is not read (minutes come later).
    const bearing = s.match(/^([NS])\s*(\d+(?:\.\d+)?)\s*([EW])$/);
    if (bearing) {
      const from = bearing[1] === 'N' ? 90 : 270;
      const a = Number(bearing[2]);
      if (a > 90) return null;
      // From north toward east is clockwise, so east takes away; from south
      // toward east is anticlockwise, so east adds.
      const sign = (bearing[1] === 'N') === (bearing[3] === 'E') ? -1 : 1;
      return { deg: norm(from + sign * a), kind: 'bearing' };
    }
    // A LOGO TURN: L, R, L30, R 45. Left is anticlockwise, which is the
    // way the degrees already count.
    const turn = s.match(/^([LR])\s*(\d+(?:\.\d+)?)?$/);
    if (turn) {
      const by = turn[2] === undefined ? 90 : Number(turn[2]);
      return { kind: 'turn', turn: turn[1] === 'L' ? by : -by };
    }
    if (/^[NSEW]{1,3}$/.test(s)) {
      const word = compassOfLetters(s.split(''));
      return word ? { deg: COMPASS[word], kind: 'compass', word } : null;
    }
    if (/^-?\d+(?:\.\d+)?$/.test(s)) return { deg: norm(Number(s)), kind: 'degrees' };
    return null;
  };
  // The compass word for an angle that lands on one, else null.
  const compassWordOf = deg => Object.keys(COMPASS).find(w => Math.abs(norm(deg) - COMPASS[w]) < 1e-9) || null;

  // Feet, or null. `calc` is DraftCalc (or anything with its evaluate); a
  // bare number is feet (metres on METRIC, as the calculator reads it), an
  // area or a refusal is null.
  const parseDistance = (text, calc, opts = {}) => {
    const s = String(text ?? '').trim();
    if (!s || !calc || typeof calc.evaluate !== 'function') return null;
    let r;
    try { r = calc.evaluate(s, { metric: opts.metric === true }); } catch { return null; }
    if (!r || !Number.isFinite(r.v)) return null;
    if (r.dim === 1) return r.v > 0 ? r.v : null;
    // A BARE NUMBER is feet, or metres on METRIC, as the calculator reads
    // one added to a length.
    if (r.dim === 0) return r.v > 0 ? r.v * (opts.metric === true ? calc.FT_PER_M : 1) : null;
    return null;
  };

  // THE WALK. Rows are { dir, dist } strings; blank rows are skipped, rows
  // that do not read are reported in `bad` and skipped. Returns the points
  // in order (start first) and one leg per good row, plus how far the last
  // point is from the start: within `closeFt` the path CLOSES.
  const CLOSE_FT = 1 / 12;   // an inch: survey decimals seldom land exactly
  const walk = (rows, start, env = {}) => {
    const calc = env.calc;
    const at = { x: Number(start?.x) || 0, z: Number(start?.z) || 0 };
    // THE HEADING a turn works from: the last move's direction, east before
    // the first move (the ANGLE box's zero).
    let heading = 0;
    const points = [{ x: at.x, z: at.z }];
    const legs = [], bad = [];
    (rows || []).forEach((row, i) => {
      const dirText = String(row?.dir ?? '').trim(), distText = String(row?.dist ?? '').trim();
      if (!dirText && !distText) return;
      const dir = parseDirection(dirText);
      const ft = parseDistance(distText, calc, env);
      if (!dir || ft === null) { bad.push({ row: i, dir: !dir, dist: ft === null }); return; }
      const deg = dir.kind === 'turn' ? norm(heading + dir.turn) : dir.deg;
      heading = deg;
      const rad = deg * Math.PI / 180;
      const from = { x: at.x, z: at.z };
      // Rounded to a millionth of a foot, so a square walked round comes
      // home at exactly its start and not 1e-14 off it.
      at.x = Math.round((at.x + Math.cos(rad) * ft) * 1e6) / 1e6;
      at.z = Math.round((at.z - Math.sin(rad) * ft) * 1e6) / 1e6;
      const to = { x: at.x, z: at.z };
      points.push(to);
      legs.push({ row: i, deg, ft, from, to });
    });
    const gapFt = legs.length ? Math.hypot(at.x - points[0].x, at.z - points[0].z) : null;
    const closeFt = Number.isFinite(env.closeFt) ? env.closeFt : CLOSE_FT;
    return { points, legs, bad, gapFt, closed: legs.length >= 3 && gapFt <= closeFt };
  };

  // READING A PASTE: "W 86.86 - 20\nN 106.87\nE 106.86 S 106.87" becomes
  // rows. A direction word or bearing followed by a number is a move; a
  // trailing "- 20" after a move is a note and is dropped. The pad's lines
  // are the input the drafter already has (Movie's example came from NOTES).
  const rowsFromText = text => {
    const rows = [];
    const isDist = tok => /^\d[\d.'"\/-]*$/.test(tok) || /^\d+\/\d+$/.test(tok) || /^\d+(\.\d+)?(m|mm)$/i.test(tok);
    String(text ?? '').replace(/\r/g, '').split('\n').forEach(line => {
      const toks = line.trim().split(/\s+/).filter(Boolean);
      let i = 0;
      while (i < toks.length) {
        // A direction is one token (N, WSW, 45, N30E) or three (N 30 E).
        let dir = null, used = 0;
        if (i + 2 < toks.length && /^[NS]$/i.test(toks[i]) && /^\d+(\.\d+)?$/.test(toks[i + 1]) && /^[EW]$/i.test(toks[i + 2])) {
          dir = `${toks[i]}${toks[i + 1]}${toks[i + 2]}`.toUpperCase(); used = 3;
        } else if (/^[NSEW]{1,3}$/i.test(toks[i]) || /^[NS]\d+(\.\d+)?[EW]$/i.test(toks[i]) || /^[LR]\d*(\.\d+)?$/i.test(toks[i])) {
          dir = toks[i].toUpperCase(); used = 1;
        }
        if (!dir || !parseDirection(dir)) { i += 1; continue; }
        i += used;
        const dist = [];
        while (i < toks.length && isDist(toks[i])) { dist.push(toks[i]); i += 1; }
        if (dist.length) rows.push({ dir, dist: dist.join(' ') });
      }
    });
    return rows;
  };

  const api = Object.freeze({ COMPASS, CLOSE_FT, parseDirection, compassWordOf, parseDistance, walk, rowsFromText });
  if (typeof window !== 'undefined') window.DraftTurtlePath = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
}
