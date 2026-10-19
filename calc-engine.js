// THE CONSTRUCTION CALCULATOR'S ARITHMETIC (Movie, 18 Oct: "can we add a
// construction calculator tab under the notebook tab ... metric and ft and
// do area" -- "need areas for sure" -- "don't need volumes - except for CONC
// estimation later").
//
// A line the way a drafter writes it -- `367-10 1/4 - 10-1 1/4`, `12'6" x
// 10'`, `3/8 + 1 1/2`, `4.2m x 3600mm` -- read into lengths and areas and
// worked out with the units carried: a length times a length is an area, an
// area over a length is a length, a length plus an area is refused. Kept
// apart from the page so a harness can put every spelling through it.
//
// UNITS ARE FEET INSIDE, square feet for an area. What a bare number means is
// decided by what it meets, the way the drafter means it: added to a length
// it is a length (feet, or metres on METRIC); multiplied by a length it is a
// count ("12'6" x 2" is two of them); two bare numbers multiplied are two
// lengths ("12 x 10" is a room, 120 sq ft); on its own it is just a number.
// A fraction on its own is inches -- 3/8 is three-eighths of an inch, never
// of a foot -- and so is a whole number with a fraction after it.
(() => {
  const FT_PER_M = 1 / 0.3048;
  const UNITS = {
    ft: [1, 1], feet: [1, 1], foot: [1, 1], "'": [1, 1],
    in: [1 / 12, 1], inch: [1 / 12, 1], inches: [1 / 12, 1], '"': [1 / 12, 1],
    m: [FT_PER_M, 1], cm: [FT_PER_M / 100, 1], mm: [FT_PER_M / 1000, 1],
    sqft: [1, 2], sf: [1, 2], ft2: [1, 2],
    sqm: [FT_PER_M * FT_PER_M, 2], m2: [FT_PER_M * FT_PER_M, 2],
  };
  const UNIT_WORDS = Object.keys(UNITS).filter(k => /^[a-z]/.test(k)).sort((a, b) => b.length - a.length);

  // ── READING ────────────────────────────────────────────────────────────
  // Tokens: { t: 'num', v, dim, bare, inch } | { t: 'op', v } | '(' | ')'.
  const tokenize = src => {
    const s = String(src || '').replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-')
      .replace(/[′’]/g, "'").replace(/[″”]/g, '"');
    const out = [];
    let i = 0;
    const ws = () => { while (i < s.length && /\s/.test(s[i])) i += 1; };
    const peekNum = j => /[0-9.]/.test(s[j] || '');
    const readNum = () => {
      const m = /^\d*\.?\d+/.exec(s.slice(i));
      if (!m) return null;
      i += m[0].length;
      return Number(m[0]);
    };
    // "1/4" right here, digits slash digits with no space round the slash.
    const readFraction = () => {
      const m = /^(\d+)\/(\d+)/.exec(s.slice(i));
      if (!m || Number(m[2]) === 0) return null;
      i += m[0].length;
      return Number(m[1]) / Number(m[2]);
    };
    // An inch part after feet: "10", "10 1/4", "10-1/4", "1/4", then an
    // optional ".
    const readInches = () => {
      const save = i;
      ws();
      let inch = null;
      const frac0 = readFraction();
      if (frac0 != null) inch = frac0;
      else if (peekNum(i)) {
        inch = readNum();
        const back = i;
        if (/^[ -]\d+\/\d+/.test(s.slice(i))) { i += 1; const f = readFraction(); if (f != null) inch += f; else i = back; }
      }
      if (inch == null) { i = save; return null; }
      ws();
      if (s[i] === '"') i += 1;
      return inch;
    };
    while (i < s.length) {
      ws();
      if (i >= s.length) break;
      const c = s[i];
      if ('+-*/'.includes(c)) { out.push({ t: 'op', v: c }); i += 1; continue; }
      if (c === '(' || c === ')') { out.push({ t: c }); i += 1; continue; }
      if (!peekNum(i)) throw new Error(`can't read "${s.slice(i, i + 6)}"`);
      const start = i;
      // A FRACTION FIRST: "3/8" is inches.
      const frac = readFraction();
      if (frac != null) {
        ws();
        if (s[i] === '"') i += 1;
        out.push({ t: 'num', v: frac / 12, dim: 1, inch: true });
        continue;
      }
      const n = readNum();
      // FEET AND INCHES WITH A DASH: "367-10 1/4" -- the dash right against
      // both numbers. "367 - 10" with spaces is a minus.
      if (s[i] === '-' && /\d/.test(s[i + 1] || '') && Number.isInteger(n) && start === i - String(n).length) {
        const save = i;
        i += 1;
        const inch = readInches();
        if (inch != null) { out.push({ t: 'num', v: n + inch / 12, dim: 1 }); continue; }
        i = save;
      }
      ws();
      if (s[i] === "'") {
        i += 1;
        const inch = readInches();
        out.push({ t: 'num', v: n + (inch || 0) / 12, dim: 1 });
        continue;
      }
      if (s[i] === '"') { i += 1; out.push({ t: 'num', v: n / 12, dim: 1, inch: true }); continue; }
      // A WHOLE NUMBER AND A FRACTION, "10 1/4": inches.
      if (/^\d+\/\d+/.test(s.slice(i)) && Number.isInteger(n) && i > start + String(n).length - 1 && /\s/.test(s[i - 1])) {
        const f = readFraction();
        ws();
        if (s[i] === '"') i += 1;
        out.push({ t: 'num', v: (n + f) / 12, dim: 1, inch: true });
        continue;
      }
      const word = UNIT_WORDS.find(w => s.slice(i, i + w.length).toLowerCase() === w
        && !/[a-z0-9]/i.test(s[i + w.length] || ''));
      if (word) {
        i += word.length;
        const [k, dim] = UNITS[word];
        out.push({ t: 'num', v: n * k, dim });
        continue;
      }
      out.push({ t: 'num', v: n, dim: 0, bare: true });
    }
    return out;
  };

  // ── WORKING IT OUT ─────────────────────────────────────────────────────
  // Recursive descent: sum := term (+|- term)*; term := unary (*|/ unary)*;
  // unary := -unary | (sum) | num.
  const evaluate = (src, opts = {}) => {
    const metric = opts.metric === true;
    const lengthOfBare = v => v * (metric ? FT_PER_M : 1);
    const toks = tokenize(src);
    if (!toks.length) throw new Error('nothing to work out');
    let k = 0;
    const take = () => toks[k++];
    const peek = () => toks[k];
    const asLength = x => (x.bare ? { v: lengthOfBare(x.v), dim: 1 } : x);
    const add = (a, b, sign) => {
      if (a.bare && b.bare) return { v: a.v + sign * b.v, dim: 0, bare: true };
      const A = a.bare ? { v: b.dim === 2 ? a.v * (metric ? FT_PER_M * FT_PER_M : 1) : lengthOfBare(a.v), dim: b.dim } : a;
      const B = b.bare ? { v: a.dim === 2 ? b.v * (metric ? FT_PER_M * FT_PER_M : 1) : lengthOfBare(b.v), dim: a.dim } : b;
      if (A.dim !== B.dim) throw new Error(A.dim + B.dim === 3 ? "can't add a length to an area" : 'those units do not add');
      return { v: A.v + sign * B.v, dim: A.dim };
    };
    const mul = (a, b) => {
      if (a.bare && b.bare) {
        // Two bare numbers: a room's two sides -- unless one is already the
        // count of a product the other side has started.
        const A = asLength(a), B = asLength(b);
        return { v: A.v * B.v, dim: 2 };
      }
      return { v: a.v * b.v, dim: (a.bare ? 0 : a.dim) + (b.bare ? 0 : b.dim) };
    };
    const div = (a, b) => {
      if (b.v === 0) throw new Error("can't divide by zero");
      if (a.bare && b.bare) return { v: a.v / b.v, dim: 0, bare: true };
      const A = a.bare ? asLength(a) : a;
      const dim = A.dim - (b.bare ? 0 : b.dim);
      return { v: A.v / b.v, dim, ...(dim === 0 ? { bare: true } : {}) };
    };
    const unary = () => {
      const t = take();
      if (!t) throw new Error('the line ends too soon');
      if (t.t === 'op' && t.v === '-') { const x = unary(); return { ...x, v: -x.v }; }
      if (t.t === 'op' && t.v === '+') return unary();
      if (t.t === '(') {
        const x = sum();
        if (!peek() || peek().t !== ')') throw new Error('a bracket is not closed');
        take();
        return x;
      }
      if (t.t === 'num') return { v: t.v, dim: t.dim, ...(t.bare ? { bare: true } : {}) };
      throw new Error('two signs in a row');
    };
    const term = () => {
      let x = unary();
      while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/')) {
        const op = take().v;
        const y = unary();
        // A bare number after a product is a count (mul keeps its units):
        // "12 x 10 x 2" is two rooms of 120, not a volume.
        x = op === '*' ? mul(x, y) : div(x, y);
      }
      return x;
    };
    const sum = () => {
      let x = term();
      while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
        const op = take().v;
        x = add(x, term(), op === '-' ? -1 : 1);
      }
      return x;
    };
    const result = sum();
    if (k < toks.length) throw new Error(toks[k].t === ')' ? 'a bracket closes that never opened' : 'something is left over');
    if (result.dim > 2) throw new Error('that is a volume -- volumes come with the concrete estimate');
    if (result.dim < 0) throw new Error('that unit is upside down');
    return result;
  };

  // ── WRITING IT OUT ─────────────────────────────────────────────────────
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  // Feet to 357'-9 1/16" -- to the nearest `denom` of an inch, the fraction
  // in its lowest terms, the sign in front.
  const feetInches = (ft, denom = 16) => {
    const sign = ft < 0 ? '-' : '';
    let units = Math.round(Math.abs(ft) * 12 * denom);
    const feet = Math.floor(units / (12 * denom));
    units -= feet * 12 * denom;
    const inch = Math.floor(units / denom);
    const part = units - inch * denom;
    const g = part ? gcd(part, denom) : 1;
    const frac = part ? ` ${part / g}/${denom / g}` : '';
    return `${sign}${feet}'-${inch}${frac}"`;
  };
  const trim = (v, places) => {
    const s = v.toFixed(places);
    return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
  };
  const group = s => s.replace(/^(-?\d+)(\d{3})/, '$1,$2').replace(/^(-?\d+)(\d{3}),/, '$1,$2,');
  // The answer, the way the drafter reads it first and the others beside it.
  const describe = (r, opts = {}) => {
    const metric = opts.metric === true;
    if (r.dim === 0) return { main: trim(r.v, 4), alt: [] };
    if (r.dim === 1) {
      const fi = feetInches(r.v, opts.denom || 16);
      const mm = r.v * 304.8;
      const metres = `${trim(mm / 1000, 3)} m`, millis = `${group(trim(mm, 1))} mm`;
      const inches = `${trim(r.v * 12, 4)}"`, dec = `${trim(r.v, 4)}'`;
      return metric ? { main: millis, alt: [metres, fi, inches] } : { main: fi, alt: [inches, dec, millis, metres] };
    }
    const sqm = r.v / (FT_PER_M * FT_PER_M);
    const sf = `${group(trim(r.v, 2))} sq ft`, sm = `${group(trim(sqm, 3))} sq m`;
    return metric ? { main: sm, alt: [sf] } : { main: sf, alt: [sm] };
  };
  const work = (src, opts = {}) => {
    try {
      const r = evaluate(src, opts);
      return { ok: true, ...r, ...describe(r, opts) };
    } catch (err) {
      return { ok: false, why: err.message };
    }
  };

  const api = Object.freeze({ tokenize, evaluate, describe, work, feetInches, FT_PER_M });
  if (typeof window !== 'undefined') window.DraftCalc = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
