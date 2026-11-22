// A DECK HIDES THE LINES BEHIND IT (jb, 22 Nov 2026).
//
// jb, on E1 of a house with a deck across the front, two corner lines
// circled where they ran down through the deck's grey band: "these lines
// behind shouldn't show on the deck floor make sense?". The band went down in
// the painter's sort and covered the FACES behind it, but the line passes
// drawn after every face -- the rim bands' corner lines, the face edges --
// knew nothing of decks and were laid straight over it. cut-view.js now lays
// each deck back down after those passes, clipped to where nothing nearer
// than the deck stands.
//
// Read headless (proto/harness-env.js): occlusion in an elevation is PAINT
// ORDER, so "does this line show on the deck" is "was a deck fill laid over
// that spot after the line, inside the clip that fill was laid under".
const { test, expect } = require('@playwright/test');
const H = require('../proto/harness-env.js');

const P = (x, z) => ({ x, y: 0, z });
const wall = (id, a, b, levelId, view) => ({ id, start: a, end: b, levelId, view,
  wallType: view === 'foundation' ? 'concrete_8' : 'stud_2x6', baseHeight: 0, topHeight: 8 });
const ring = (prefix, levelId, view) => {
  const c = [P(0, 0), P(-30, 0), P(-30, -20), P(0, -20)];
  return c.map((a, i) => wall(`${prefix}-${i}`, a, c[(i + 1) % 4], levelId, view));
};
const TH = 10 / 12;
const deck = (id, pts) => ({ id, levelId: 3, view: 'floor', structure: 'floor', thickness: TH,
  points: pts.map(([x, z]) => P(x, z)) });
// A 30 x 20 house. One deck right across the front (z 0..8), 2 ft past
// both ends, so the house's two front corners stand BEHIND it on E1; and a
// narrower one off the back, inside the house's ends, so on E3 the front
// deck is behind the house and shows only past its ends.
const FILE = {
  version: 1,
  levels: [
    { id: 8, name: 'SITE', elev: 0, visible: true }, { id: 7, name: 'ROOF', elev: 9, visible: true },
    { id: 3, name: 'MAIN FL', elev: 0, visible: true }, { id: 1, name: 'FOUNDATION', elev: -10, visible: true },
  ],
  walls: [...ring('m', 3, 'plan'), ...ring('f', 1, 'foundation')],
  lines: [], outlines: [], groups: [], roofs: [], fenestrations: [], dimensions: [], cuts: [],
  floors: [
    { id: 'house', levelId: 3, view: 'floor', structure: 'floor', thickness: 1.0521,
      points: [P(0, 0), P(-30, 0), P(-30, -20), P(0, -20)] },
    deck('front', [[2, 0], [-32, 0], [-32, 8], [2, 8]]),
    deck('back', [[-4, -20], [-26, -20], [-26, -28], [-4, -28]]),
  ],
};

const paint = id => {
  const win = H.loadDraftModules();
  const env = H.buildEnv(win, FILE);
  const cut = H.standardElevationCuts(env).find(c => c.id === id);
  return H.paintElevation(win, env, cut);
};
// Point in polygon, and in a clip of several boxes (pen-up markers split it).
const inPoly = (u, e, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.e > e) !== (b.e > e) && u < (b.u - a.u) * (e - a.e) / (b.e - a.e) + a.u) inside = !inside;
  }
  return inside;
};
const subpaths = pts => {
  const out = [];
  pts.forEach(p => {
    if (p.close) return;
    if (p.move || !out.length) out.push([]);
    out[out.length - 1].push(p);
  });
  return out;
};
const covers = (fill, u, e) => {
  if (!inPoly(u, e, fill.pts)) return false;
  return !fill.clip || subpaths(fill.clip).some(poly => poly.length > 2 && inPoly(u, e, poly));
};
// Ink strokes standing upright across the height `e`, at u in (lo, hi).
const uprightsAcross = (strokes, e, lo, hi) => strokes.flatMap(st => {
  const segs = [];
  for (let i = 1; i < st.pts.length; i++) {
    const a = st.pts[i - 1], b = st.pts[i];
    if (b.move) continue;
    if (Math.abs(a.u - b.u) > 0.02) continue;
    if (Math.min(a.e, b.e) > e - 0.01 || Math.max(a.e, b.e) < e + 0.01) continue;
    if (a.u <= lo + 0.1 || a.u >= hi - 0.1) continue;
    segs.push({ seq: st.seq, u: a.u });
  }
  return segs;
});
// The deck's band: its fills are the rectangles whose box is exactly the
// band (data-decks says the same thing on the page).
const deckFills = (fills, band) => fills.filter(f => {
  const us = f.pts.map(p => p.u), es = f.pts.map(p => p.e);
  return Math.abs(Math.min(...us) - band.lo) < 0.05 && Math.abs(Math.max(...us) - band.hi) < 0.05
    && Math.abs(Math.max(...es) - band.top) < 0.05 && Math.abs(Math.min(...es) - band.bottom) < 0.05;
});
const lastOver = (out, u, e) => {
  const fill = out.modelFills.filter(f => covers(f, u, e)).sort((a, b) => b.seq - a.seq)[0];
  return fill || null;
};

test('E1: the house\'s corner lines behind the front deck do not show on it', () => {
  const out = paint('E1');
  // The front deck as E1 sees it: 34 ft across, 2" under the floor, 10" deep.
  const top = -2 / 12, bottom = top - TH, mid = (top + bottom) / 2;
  const fills = out.modelFills.filter(f => {
    const us = f.pts.map(p => p.u), es = f.pts.map(p => p.e);
    return Math.max(...us) - Math.min(...us) > 33.9 && Math.abs(Math.max(...es) - top) < 0.02
      && Math.abs(Math.min(...es) - bottom) < 0.02;
  });
  expect(fills.length, 'the front deck band is painted').toBeGreaterThan(0);
  const us = fills[0].pts.map(p => p.u);
  const band = { lo: Math.min(...us), hi: Math.max(...us), top, bottom };
  // NOT VACUOUS: the house's corner lines ARE drawn across the band's height
  // (the rim band's edges, 0'-0" down through the floor package). jb circled
  // both of them.
  const ups = uprightsAcross(out.strokes, mid, band.lo, band.hi);
  expect(ups.length, 'corner lines cross the deck band\'s height').toBeGreaterThanOrEqual(2);
  // Each is laid over by a deck fill painted after it.
  ups.forEach(({ seq, u }) => {
    const over = deckFills(out.modelFills, band).filter(f => f.seq > seq && covers(f, u, mid));
    expect(over.length, `line at u ${u.toFixed(2)} (seq ${seq}) is covered by the deck`).toBeGreaterThan(0);
  });
});

test('E3: the front deck behind the house stays behind it -- the house and its corner lines are on top', () => {
  const out = paint('E3');
  const top = -2 / 12, bottom = top - TH, mid = (top + bottom) / 2;
  // Across the house's middle at the deck's height, the last paint is NOT
  // the far deck: the house's own floor band stands in front.
  const wide = out.modelFills.filter(f => {
    const us = f.pts.map(p => p.u), es = f.pts.map(p => p.e);
    return Math.max(...us) - Math.min(...us) > 33.9 && Math.abs(Math.max(...es) - top) < 0.02
      && Math.abs(Math.min(...es) - bottom) < 0.02;
  });
  expect(wide.length).toBeGreaterThan(0);
  const us = wide[0].pts.map(p => p.u);
  const band = { lo: Math.min(...us), hi: Math.max(...us), top, bottom };
  const centre = (band.lo + band.hi) / 2;
  const behind = deckFills(out.modelFills, band);
  const last = lastOver(out, centre, mid);
  expect(behind.includes(last), 'the house\'s middle is not painted over by the deck behind it').toBe(false);
  // The house's corners, 2 ft in from the deck's ends, keep their lines: no
  // deck fill comes after them there.
  [band.lo + 2, band.hi - 2].forEach(u => {
    const lines = uprightsAcross(out.strokes, mid, u - 0.2, u + 0.2);
    expect(lines.length, `corner line at ${u}`).toBeGreaterThan(0);
    const seq = Math.max(...lines.map(l => l.seq));
    expect(behind.some(f => f.seq > seq && covers(f, u, mid)), `corner line at ${u} stays on top`).toBe(false);
  });
});
